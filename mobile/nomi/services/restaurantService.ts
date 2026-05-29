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
  photos: { photo_reference: string; width: number; height: number }[];
  cache_date: Timestamp | Date | null;
  is_local_concept: boolean;
  distance?: string;
  reason?: string;
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

function addDistanceToRestaurants(
  restaurants: Restaurant[],
  userLat?: number | null,
  userLng?: number | null,
  maxDistance?: number | null
): Restaurant[] {
  if (userLat == null || userLng == null) return restaurants;

  let results = restaurants.map(r => {
    const lat = r.location?.lat;
    const lng = r.location?.lng;
    if (lat != null && lng != null) {
      const dist = haversineDistance(userLat, userLng, lat, lng);
      return {
        ...r,
        distance: dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`,
        _distMetres: dist,
      };
    }
    return r;
  });

  if (maxDistance) {
    results = results.filter(r => (r as any)._distMetres == null || (r as any)._distMetres <= maxDistance);
  }

  return results.map(({ _distMetres, ...rest }: any) => rest as Restaurant);
}

export const getRestaurantsByMood = async (
  moods: string[],
  budgetLevel: number,
  maxResults: number = 9,
  userLat?: number | null,
  userLng?: number | null,
  maxDistance?: number | null
): Promise<Restaurant[]> => {
  try {
    let q;

    if (moods.length > 0) {
      q = query(
        collection(db, 'restaurants'),
        where('mood_tags', 'array-contains-any', moods),
        where('budget_level', '==', budgetLevel),
        limit(maxResults * 3)
      );
    } else {
      q = query(
        collection(db, 'restaurants'),
        where('budget_level', '==', budgetLevel),
        limit(maxResults * 3)
      );
    }

    const snapshot = await getDocs(q);

    let restaurants: Restaurant[];
    if (snapshot.empty) {
      const fallbackQ = query(
        collection(db, 'restaurants'),
        limit(maxResults * 3)
      );
      const fallbackSnap = await getDocs(fallbackQ);
      restaurants = fallbackSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Restaurant));
    } else {
      restaurants = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Restaurant));
    }

    restaurants = addDistanceToRestaurants(restaurants, userLat, userLng, maxDistance);
    return restaurants.slice(0, maxResults);

  } catch (error) {
    __DEV__ && console.error('getRestaurantsByMood error:', error);
    return [];
  }
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
    const restaurants = await getRestaurantsByMood(moods, budgetLevel, 9, userLat, userLng, distance);
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
  const matchingMoods = restaurant.mood_tags?.filter(tag => selectedMoods.includes(tag)) || [];
  if (matchingMoods.length > 0) {
    return `Matches your ${matchingMoods.join(' + ')} mood`;
  }
  if (restaurant.google_rating >= 4.5) return 'Highly rated by locals';
  if (restaurant.is_local_concept) return 'Authentic local experience';
  return 'Great spot near you';
};

export const getPhotoUrl = (restaurant: Restaurant): string | null => {
  if (!restaurant.photos || restaurant.photos.length === 0) return null;
  const photo = restaurant.photos[0];
  if (photo.photo_reference) {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`;
  }
  return null;
};
