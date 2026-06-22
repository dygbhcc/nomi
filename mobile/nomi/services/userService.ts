import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';

export type UserProfile = {
  displayName: string;
  points: number;
  memberSince: string;
  restaurantsVisited: number;
  restaurantsValidated: number;
  groupSessions: number;
  badges: string[];
  likedRestaurants: string[];
};

/**
 * Fetch user profile data
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    const data = userSnap.data();

    // Count validations (votes)
    const votesRef = collection(db, 'votes');
    const votesQuery = query(votesRef, where('user_id', '==', userId));
    const votesSnap = await getDocs(votesQuery);
    const validationsCount = votesSnap.size;

    // Count group sessions as organizer
    const roomsRef = collection(db, 'rooms');
    const roomsQuery = query(roomsRef, where('organizer_uid', '==', userId));
    const roomsSnap = await getDocs(roomsQuery);
    const groupSessionsCount = roomsSnap.size;

    // Format member since date
    const createdAt = data.created_at?.toDate();
    const memberSince = createdAt
      ? createdAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'Recently';

    // B-12: prefer a stored name; otherwise derive a friendly name from the
    // email instead of showing "Anonymous".
    const emailName =
      typeof data.email === 'string' && data.email.includes('@')
        ? data.email.split('@')[0]
        : null;

    return {
      displayName: data.display_name || data.displayName || emailName || 'Foodie',
      points: data.points || 0,
      memberSince,
      restaurantsVisited: data.liked_restaurants?.length || 0,
      restaurantsValidated: validationsCount,
      groupSessions: groupSessionsCount,
      badges: data.badges || [],
      likedRestaurants: data.liked_restaurants || [],
    };
  } catch (error) {
    console.error('getUserProfile error:', error);
    return null;
  }
};

/**
 * Get saved restaurants details
 */
export const getSavedRestaurants = async (restaurantIds: string[]): Promise<any[]> => {
  if (!restaurantIds || restaurantIds.length === 0) return [];

  // Fetch in parallel and isolate failures per id, so one stale/missing id
  // can no longer wipe out the entire saved list (previous version returned []
  // on the first error). Skip empty/invalid ids defensively.
  const results = await Promise.all(
    restaurantIds
      .filter((id) => typeof id === 'string' && id.length > 0)
      .map(async (id) => {
        try {
          const snap = await getDoc(doc(db, 'restaurants', id));
          return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        } catch (error) {
          console.error('getSavedRestaurants item error:', id, error);
          return null;
        }
      })
  );

  return results.filter((r) => r !== null);
};
