import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';
import { db } from './firebase';

export const recordSwipe = async (
  userId: string,
  restaurantId: string,
  direction: 'like' | 'pass',
  moods: string[]
): Promise<void> => {
  try {
    await addDoc(collection(db, 'swipes'), {
      user_id: userId,
      restaurant_id: restaurantId,
      direction,
      moods,
      timestamp: serverTimestamp(),
    });

    if (direction === 'like') {
      await updateDoc(doc(db, 'users', userId), {
        liked_restaurants: arrayUnion(restaurantId),
        points: increment(2),
      });
    }
  } catch (error) {
    console.error('recordSwipe error:', error);
  }
};

export const saveRestaurant = async (
  userId: string,
  restaurantId: string
): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), {
    liked_restaurants: arrayUnion(restaurantId),
  });
};

export const unsaveRestaurant = async (
  userId: string,
  restaurantId: string
): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), {
    liked_restaurants: arrayRemove(restaurantId),
  });
};

export const recordValidation = async (
  userId: string,
  restaurantId: string,
  moodTag: string,
  direction: boolean
): Promise<void> => {
  try {
    await addDoc(collection(db, 'votes'), {
      user_id: userId,
      restaurant_id: restaurantId,
      tag: moodTag,
      direction,
      timestamp: serverTimestamp(),
    });

    await updateDoc(doc(db, 'users', userId), {
      points: increment(5),
    });

    const restaurantRef = doc(db, 'restaurants', restaurantId);
    const scoreField = `confidence_scores.${moodTag}`;
    await updateDoc(restaurantRef, {
      [scoreField]: increment(direction ? 5 : -5),
    });
  } catch (error) {
    console.error('recordValidation error:', error);
  }
};

export const addPoints = async (
  userId: string,
  points: number
): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), {
    points: increment(points),
  });
};
