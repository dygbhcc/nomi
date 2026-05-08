import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  points: number;
  badges: number;
};

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
 * Fetch top users by points for leaderboard
 */
export const getLeaderboard = async (topN: number = 10): Promise<LeaderboardEntry[]> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      orderBy('points', 'desc'),
      limit(topN)
    );

    const snapshot = await getDocs(q);
    const leaderboard: LeaderboardEntry[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      leaderboard.push({
        userId: doc.id,
        displayName: data.display_name || data.displayName || 'Anonymous',
        points: data.points || 0,
        badges: data.badges?.length || 0,
      });
    });

    return leaderboard;
  } catch (error) {
    console.error('getLeaderboard error:', error);
    return [];
  }
};

/**
 * Get user's rank in leaderboard
 */
export const getUserRank = async (userId: string): Promise<number> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return -1;

    const userPoints = userSnap.data().points || 0;

    // Count users with more points
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('points', '>', userPoints));
    const snapshot = await getDocs(q);

    return snapshot.size + 1; // Rank is number of users ahead + 1
  } catch (error) {
    console.error('getUserRank error:', error);
    return -1;
  }
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

    return {
      displayName: data.display_name || data.displayName || 'Anonymous',
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
  try {
    if (restaurantIds.length === 0) return [];

    const restaurants = [];

    // Fetch each restaurant
    for (const id of restaurantIds) {
      const restaurantRef = doc(db, 'restaurants', id);
      const restaurantSnap = await getDoc(restaurantRef);

      if (restaurantSnap.exists()) {
        restaurants.push({
          id: restaurantSnap.id,
          ...restaurantSnap.data(),
        });
      }
    }

    return restaurants;
  } catch (error) {
    console.error('getSavedRestaurants error:', error);
    return [];
  }
};
