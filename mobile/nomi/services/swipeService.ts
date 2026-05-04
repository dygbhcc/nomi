import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  setDoc,
  getDoc
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
      await setDoc(doc(db, 'users', userId), {
        liked_restaurants: arrayUnion(restaurantId),
        points: increment(2),
      }, { merge: true });
    }
  } catch (error) {
    console.error('recordSwipe error:', error);
  }
};

export const saveRestaurant = async (
  userId: string,
  restaurantId: string
): Promise<void> => {
  await setDoc(doc(db, 'users', userId), {
    liked_restaurants: arrayUnion(restaurantId),
  }, { merge: true });
};

export const unsaveRestaurant = async (
  userId: string,
  restaurantId: string
): Promise<void> => {
  await setDoc(doc(db, 'users', userId), {
    liked_restaurants: arrayRemove(restaurantId),
  }, { merge: true });
};

export const recordValidation = async (
  userId: string,
  restaurantId: string,
  moodTag: string,
  direction: boolean
): Promise<void> => {
  try {
    // 1. Add vote document
    __DEV__ && console.log('📝 Adding vote document...');
    await addDoc(collection(db, 'votes'), {
      user_id: userId,
      restaurant_id: restaurantId,
      tag: moodTag,
      direction,
      timestamp: serverTimestamp(),
    });
    __DEV__ && console.log('✅ Vote document added');

    // 2. Update user points (create user doc if it doesn't exist)
    __DEV__ && console.log('👤 Updating user points...');
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      points: increment(5),
    }, { merge: true });
    __DEV__ && console.log('✅ User points updated');

    // 3. Update restaurant confidence scores (ONLY if restaurant already exists)
    __DEV__ && console.log('🍽️ Updating restaurant confidence scores...');
    const restaurantRef = doc(db, 'restaurants', restaurantId);
    const restaurantSnap = await getDoc(restaurantRef);

    if (restaurantSnap.exists()) {
      const scoreField = `confidence_scores.${moodTag}`;
      await setDoc(restaurantRef, {
        [scoreField]: increment(direction ? 5 : -5),
      }, { merge: true });
      __DEV__ && console.log('✅ Restaurant scores updated');
    } else {
      __DEV__ && console.warn('⚠️ Restaurant does not exist, skipping score update:', restaurantId);
    }
  } catch (error) {
    console.error('recordValidation error:', error);
    throw error; // Re-throw to see the actual error
  }
};

export const addPoints = async (
  userId: string,
  points: number
): Promise<void> => {
  await setDoc(doc(db, 'users', userId), {
    points: increment(points),
  }, { merge: true });
};
