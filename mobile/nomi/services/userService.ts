import { callUserApi } from './api';

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

type ProfileResponse = {
  displayName: string;
  points: number;
  createdAtMs: number | null;
  restaurantsVisited: number;
  restaurantsValidated: number;
  groupSessions: number;
  badges: string[];
  likedRestaurants: string[];
} | null;

/**
 * Fetch user profile data (backend resolves the user from auth).
 */
export const getUserProfile = async (_userId: string): Promise<UserProfile | null> => {
  try {
    const data = await callUserApi<ProfileResponse>('getProfile');
    if (!data) return null;

    const memberSince = data.createdAtMs
      ? new Date(data.createdAtMs).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'Recently';

    return {
      displayName: data.displayName,
      points: data.points,
      memberSince,
      restaurantsVisited: data.restaurantsVisited,
      restaurantsValidated: data.restaurantsValidated,
      groupSessions: data.groupSessions,
      badges: data.badges,
      likedRestaurants: data.likedRestaurants,
    };
  } catch (error) {
    __DEV__ && console.error('getUserProfile error:', error);
    return null;
  }
};

/**
 * Get saved restaurants details. The backend derives the saved list from the
 * user document, so the ids argument is kept only for signature compatibility.
 */
export const getSavedRestaurants = async (_restaurantIds: string[]): Promise<any[]> => {
  try {
    return await callUserApi<any[]>('getSavedRestaurants');
  } catch (error) {
    __DEV__ && console.error('getSavedRestaurants error:', error);
    return [];
  }
};
