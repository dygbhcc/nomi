import {
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
  documentId,
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

    // Counts via server-side aggregation — reads ~1 instead of every matching
    // vote/room doc (cost: a heavy user no longer costs N reads just to count).
    const [votesAgg, roomsAgg] = await Promise.all([
      getCountFromServer(query(collection(db, 'votes'), where('user_id', '==', userId))),
      getCountFromServer(query(collection(db, 'rooms'), where('organizer_uid', '==', userId))),
    ]);
    const validationsCount = votesAgg.data().count;
    const groupSessionsCount = roomsAgg.data().count;

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

  // Batch by documentId() `in` queries (max 30 per query) instead of one
  // getDoc per id — fewer round-trips, same low read count. Failures are
  // isolated per chunk so one bad id can't wipe the whole list.
  const ids = restaurantIds.filter((id) => typeof id === 'string' && id.length > 0);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));

  const results: any[] = [];
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const snap = await getDocs(
          query(collection(db, 'restaurants'), where(documentId(), 'in', chunk))
        );
        snap.forEach((d) => results.push({ id: d.id, ...d.data() }));
      } catch (error) {
        console.error('getSavedRestaurants chunk error:', error);
      }
    })
  );

  return results;
};
