import {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
  arrayUnion,
  arrayRemove,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
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
  place_id?: string;
};

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const getRestaurantsByMood = async (
  moods: string[],
  budgetLevel: number,
  maxResults: number = 6,
  userLat?: number | null,
  userLng?: number | null,
  maxDistance?: number | null
): Promise<Restaurant[]> => {
  const seen = new Set<string>();
  let restaurants: Restaurant[] = [];

  const addDocs = (snap: any) => {
    for (const d of snap.docs) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        restaurants.push({ id: d.id, ...d.data() } as Restaurant);
      }
    }
  };

  const pool = maxResults * 3;

  // Tier 1: mood + budget
  try {
    if (moods.length > 0) {
      const snap = await getDocs(query(
        collection(db, 'restaurants'),
        where('mood_tags', 'array-contains-any', moods),
        where('budget_level', '==', budgetLevel),
        limit(pool)
      ));
      addDocs(snap);
    }
  } catch (_) { /* index missing, skip */ }

  // Tier 2: mood only
  if (restaurants.length < pool && moods.length > 0) {
    try {
      const snap = await getDocs(query(
        collection(db, 'restaurants'),
        where('mood_tags', 'array-contains-any', moods),
        limit(pool)
      ));
      addDocs(snap);
    } catch (_) { /* skip */ }
  }

  // Tier 3: budget only
  if (restaurants.length < pool) {
    try {
      const snap = await getDocs(query(
        collection(db, 'restaurants'),
        where('budget_level', '==', budgetLevel),
        limit(pool)
      ));
      addDocs(snap);
    } catch (_) { /* skip */ }
  }

  // Tier 4: all restaurants
  if (restaurants.length < maxResults) {
    try {
      const snap = await getDocs(query(
        collection(db, 'restaurants'),
        limit(pool)
      ));
      addDocs(snap);
    } catch (_) { /* skip */ }
  }

  // Compute metre distances for sorting & filtering
  if (userLat != null && userLng != null) {
    for (const r of restaurants) {
      const lat = r.location?.lat;
      const lng = r.location?.lng;
      if (lat != null && lng != null) {
        const dist = haversineDistance(userLat, userLng, lat, lng);
        (r as any)._m = dist;
        r.distance = dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`;
      }
    }

    // Sort closest first
    restaurants.sort((a, b) => ((a as any)._m ?? Infinity) - ((b as any)._m ?? Infinity));

    // Prefer within maxDistance, fill if not enough
    if (maxDistance) {
      const inside = restaurants.filter(r => (r as any)._m == null || (r as any)._m <= maxDistance);
      const outside = restaurants.filter(r => (r as any)._m != null && (r as any)._m > maxDistance);
      restaurants = [...inside, ...outside];
    }

    // Clean up temp field
    for (const r of restaurants) delete (r as any)._m;
  }

  return restaurants.slice(0, maxResults);
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
    // Fallback to direct Firestore query with client-side distance
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
 * shuffled randomly so each session shows a fresh, unordered set.
 * Prefers restaurants that match the selected moods, then fills from the
 * general pool. Distances are computed for display only (no filtering).
 */
export const getRestaurantsForValidation = async (
  userId: string | null,
  moods: string[],
  maxResults: number = 10,
  userLat?: number | null,
  userLng?: number | null
): Promise<Restaurant[]> => {
  // 1. Collect restaurant ids this user has already voted on
  const votedIds = new Set<string>();
  if (userId) {
    try {
      const votesSnap = await getDocs(query(
        collection(db, 'votes'),
        where('user_id', '==', userId)
      ));
      votesSnap.forEach((d) => {
        const rid = d.data().restaurant_id;
        if (rid) votedIds.add(rid);
      });
    } catch (e) {
      __DEV__ && console.error('getRestaurantsForValidation votes error:', e);
    }
  }

  // 2. Build a candidate pool, excluding already-voted restaurants
  const seen = new Set<string>();
  const pool: Restaurant[] = [];
  const addDocs = (snap: any) => {
    for (const d of snap.docs) {
      if (!seen.has(d.id) && !votedIds.has(d.id)) {
        seen.add(d.id);
        pool.push({ id: d.id, ...d.data() } as Restaurant);
      }
    }
  };

  const fetchLimit = Math.max(maxResults * 4, 40);

  // Tier 1: restaurants matching the selected moods
  try {
    if (moods.length > 0) {
      const snap = await getDocs(query(
        collection(db, 'restaurants'),
        where('mood_tags', 'array-contains-any', moods),
        limit(fetchLimit)
      ));
      addDocs(snap);
    }
  } catch (_) { /* index missing, skip */ }

  // Tier 2: fill from the general pool
  if (pool.length < maxResults) {
    try {
      const snap = await getDocs(query(
        collection(db, 'restaurants'),
        limit(fetchLimit)
      ));
      addDocs(snap);
    } catch (_) { /* skip */ }
  }

  // 3. Compute display distances
  if (userLat != null && userLng != null) {
    for (const r of pool) {
      const lat = r.location?.lat;
      const lng = r.location?.lng;
      if (lat != null && lng != null) {
        const dist = haversineDistance(userLat, userLng, lat, lng);
        r.distance = dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`;
      }
    }
  }

  // 4. Shuffle (Fisher-Yates) so the order is random every session
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, maxResults);
};

export const getRestaurantById = async (id: string): Promise<Restaurant | null> => {
  try {
    const docRef = doc(db, 'restaurants', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Restaurant;
  } catch (error) {
    __DEV__ && console.error('getRestaurantById error:', error);
    return null;
  }
};

export const saveRestaurant = async (userId: string, restaurantId: string): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    liked_restaurants: arrayUnion(restaurantId)
  });
};

export const unsaveRestaurant = async (userId: string, restaurantId: string): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    liked_restaurants: arrayRemove(restaurantId)
  });
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

export const getPhotoUrl = (restaurant: Restaurant, photoIndex = 0): string | null => {
  if (!restaurant.photos || restaurant.photos.length <= photoIndex) return null;
  const photo = restaurant.photos[photoIndex];
  if (photo.url) {
    return photo.url;
  }
  if (photo.photo_reference) {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`;
  }
  return null;
};
