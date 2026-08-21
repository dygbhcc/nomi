import { callUserApi } from './api';

// All writes go through the userApi callable — the backend derives the acting
// user from request.auth, so the userId params below are kept only for
// call-site signature compatibility.

export const recordSwipe = async (
  _userId: string,
  restaurantId: string,
  direction: 'like' | 'pass',
  moods: string[],
  sessionId?: string
): Promise<void> => {
  try {
    await callUserApi('recordSwipe', { restaurantId, direction, moods, ...(sessionId ? { sessionId } : {}) });
  } catch (error) {
    __DEV__ && console.error('recordSwipe error:', error);
  }
};

export const saveRestaurant = async (
  _userId: string,
  restaurantId: string
): Promise<void> => {
  await callUserApi('setRestaurantSaved', { restaurantId, saved: true });
};

export const unsaveRestaurant = async (
  _userId: string,
  restaurantId: string
): Promise<void> => {
  await callUserApi('setRestaurantSaved', { restaurantId, saved: false });
};

// B-13: check whether a restaurant is already saved so the detail screen can
// show the correct Save/Saved state on open.
export const isRestaurantSaved = async (
  _userId: string,
  restaurantId: string
): Promise<boolean> => {
  try {
    const result = await callUserApi<{ saved: boolean }>('isRestaurantSaved', { restaurantId });
    return result.saved;
  } catch (error) {
    __DEV__ && console.error('isRestaurantSaved error:', error);
    return false;
  }
};

export const recordValidation = async (
  _userId: string,
  restaurantId: string,
  moodTag: string,
  direction: boolean
): Promise<void> => {
  await callUserApi('recordValidation', { restaurantId, moodTag, direction });
};
