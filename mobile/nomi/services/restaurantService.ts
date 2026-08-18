import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { callRestaurantApi } from './api';
import i18n from '../i18n';

/**
 * Resolves a bilingual field value based on current app language.
 * Handles both old format (plain string/array) and new format ({ en: ..., pt: ... }).
 */
export function resolveLocalized<T>(value: T | Record<string, T> | undefined): T | undefined {
  if (value == null) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const langMap = value as Record<string, T>;
    const lang = i18n.language || 'en';
    return langMap[lang] ?? langMap['en'] ?? Object.values(langMap)[0];
  }
  return value as T;
}

export type Restaurant = {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  budget_level: number;
  mood_tags: string[];
  confidence_scores: Record<string, number>;
  opening_hours: {
    is_open_monday: boolean;
    periods: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
  };
  noise_level: string;
  phone: string;
  website: string;
  google_rating: number;
  photos: { photo_reference?: string; url?: string; source?: string; width: number; height: number }[];
  cache_date: Timestamp | Date | null;
  is_local_concept: boolean;
  distance?: string;
  reason?: string;
  nlp_insights?: {
    general_summary?: string | Record<string, string>;
    food_admiration?: string[] | Record<string, string[]>;
    negative_aspects?: string[] | Record<string, string[]>;
  };
  nlp_metrics?: {
    rating?: number;
    rating_source?: string;
    positive_comment_rate?: number;
    most_frequent_emotion?: string;
    primary_sentiment_nuances?: string[];
  };
  nlp_review_count?: number;
  nlp_confidence_level?: 'low' | 'medium' | 'high';
  // B-21: short AI keyword badges summarizing long reviews (quick-scan chips).
  review_tags?: string[];
  love_tags?: string[];   // short badges for "What People Love"
  watch_tags?: string[];  // short badges for "Heads Up"
  place_id?: string;
};

// All restaurant queries run server-side in the restaurantApi callable
// (distance sorting and filtering included) — no direct Firestore access.
export const getRestaurantsByMood = async (
  moods: string[],
  budgetLevel: number,
  maxResults: number = 6,
  userLat?: number | null,
  userLng?: number | null,
  maxDistance?: number | null
): Promise<Restaurant[]> => {
  try {
    const result = await callRestaurantApi<{ restaurants: Restaurant[] }>('getByMood', {
      moods,
      budgetLevel,
      maxResults,
      userLat,
      userLng,
      maxDistance,
    });
    return result.restaurants;
  } catch (error) {
    __DEV__ && console.error('getRestaurantsByMood error:', error);
    return [];
  }
};

export const getRestaurantsByIds = async (ids: string[]): Promise<Restaurant[]> => {
  if (ids.length === 0) return [];
  const snaps = await Promise.all(ids.map(id => getDoc(doc(db, 'restaurants', id))));
  return snaps
    .filter(s => s.exists())
    .map(s => ({ id: s.id, ...s.data() } as Restaurant));
};

export type SmartRecommendationsMeta = {
  algorithm: string;
  candidateCount: number;
  fallback: boolean;
  secondChance: boolean;
};

export type SmartRecommendationsResult = {
  restaurants: Restaurant[];
  meta: SmartRecommendationsMeta;
};

export const getSmartRecommendations = async (
  userId: string | null,
  moods: string[],
  budgetLevel: number,
  distance?: number | null,
  userLat?: number | null,
  userLng?: number | null
): Promise<SmartRecommendationsResult> => {
  try {
    const callable = httpsCallable<
      { userId: string | null; moods: string[]; budgetLevel: number; distance?: number | null; userLat?: number | null; userLng?: number | null },
      { restaurants: Restaurant[]; meta: SmartRecommendationsMeta }
    >(functions, 'getSmartRecommendations');

    const result = await callable({ userId, moods, budgetLevel, distance, userLat, userLng });
    return {
      restaurants: result.data.restaurants,
      meta: result.data.meta,
    };
  } catch (error) {
    __DEV__ && console.error('getSmartRecommendations error, falling back:', error);
    // Fallback to the plain mood query (also server-side)
    const restaurants = await getRestaurantsByMood(moods, budgetLevel, 6, userLat, userLng, distance);
    return {
      restaurants,
      meta: {
        algorithm: 'fallback_direct',
        candidateCount: restaurants.length,
        fallback: true,
        secondChance: false,
      },
    };
  }
};

/**
 * Build a validation queue: restaurants the user has NOT voted on yet,
 * shuffled randomly so each session shows a fresh, unordered set. Runs
 * entirely server-side; the backend resolves the user from auth.
 */
export const getRestaurantsForValidation = async (
  _userId: string | null,
  moods: string[],
  maxResults: number = 10,
  userLat?: number | null,
  userLng?: number | null
): Promise<Restaurant[]> => {
  try {
    const result = await callRestaurantApi<{ restaurants: Restaurant[] }>('getForValidation', {
      moods,
      maxResults,
      userLat,
      userLng,
    });
    return result.restaurants;
  } catch (error) {
    __DEV__ && console.error('getRestaurantsForValidation error:', error);
    return [];
  }
};

export const getRestaurantById = async (id: string): Promise<Restaurant | null> => {
  try {
    return await callRestaurantApi<Restaurant | null>('getById', { id });
  } catch (error) {
    __DEV__ && console.error('getRestaurantById error:', error);
    return null;
  }
};

export const buildReason = (restaurant: Restaurant, selectedMoods: string[]): string => {
  // Use NLP summary when available and confidence is not low
  const summary = resolveLocalized(restaurant.nlp_insights?.general_summary);
  if (summary && restaurant.nlp_confidence_level !== 'low') {
    return summary;
  }
  const matchingMoods = restaurant.mood_tags?.filter(tag => selectedMoods.includes(tag)) || [];
  if (matchingMoods.length > 0) {
    return `Matches your ${matchingMoods.join(' + ')} mood`;
  }
  if (restaurant.google_rating >= 4.5) return 'Highly rated by locals';
  if (restaurant.is_local_concept) return 'Authentic local experience';
  return 'Great spot near you';
};

// Default served width. Cards/detail rarely need more than this; the big
// bandwidth win is f_auto (WebP/AVIF) + q_auto (auto quality) which typically
// cut 50-70% off a raw JPEG — the Cloudinary monthly bandwidth cap is our
// hardest free-tier limit, so every served image goes through this.
const PHOTO_WIDTH = 800;

function optimizeCloudinary(url: string, width: number): string {
  // Inject transforms once, right after /upload/. Skip if already transformed.
  if (!url.includes('/upload/') || /\/upload\/[^/]*(f_auto|q_auto|w_\d)/.test(url)) {
    return url;
  }
  return url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
}

export const getPhotoUrl = (
  restaurant: Restaurant,
  photoIndex = 0,
  width: number = PHOTO_WIDTH
): string | null => {
  if (!restaurant.photos || restaurant.photos.length <= photoIndex) return null;
  const photo = restaurant.photos[photoIndex];
  if (photo.url) {
    return optimizeCloudinary(photo.url, width);
  }
  return null;
};
