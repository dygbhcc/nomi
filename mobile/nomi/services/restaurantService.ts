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
import { db } from './firebase';

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

export const getRestaurantsByMood = async (
  moods: string[],
  budgetLevel: number,
  maxResults: number = 6
): Promise<Restaurant[]> => {
  try {
    let q;

    if (moods.length > 0) {
      q = query(
        collection(db, 'restaurants'),
        where('mood_tags', 'array-contains-any', moods),
        where('budget_level', '==', budgetLevel),
        limit(maxResults)
      );
    } else {
      q = query(
        collection(db, 'restaurants'),
        where('budget_level', '==', budgetLevel),
        limit(maxResults)
      );
    }

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Fallback — ignore budget filter if no results
      const fallbackQ = query(
        collection(db, 'restaurants'),
        limit(maxResults)
      );
      const fallbackSnap = await getDocs(fallbackQ);
      return fallbackSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Restaurant));
    }

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Restaurant));

  } catch (error) {
    __DEV__ && console.error('getRestaurantsByMood error:', error);
    return [];
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
