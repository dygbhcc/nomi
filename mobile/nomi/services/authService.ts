import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInAnonymously as firebaseSignInAnonymously,
  updateProfile,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export const signIn = async (email: string, password: string): Promise<User> => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const signUp = async (
  email: string,
  password: string,
  displayName: string
): Promise<User> => {
  const result = await createUserWithEmailAndPassword(auth, email, password);

  await updateProfile(result.user, { displayName });

  await setDoc(doc(db, 'users', result.user.uid), {
    display_name: displayName,
    email: email,
    points: 0,
    badges: [],
    segment: 'new',
    preference_history: { moods: [], budget: 2, dist: 1 },
    streak: 0,
    created_at: serverTimestamp(),
  });

  return result.user;
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

export const signInAnonymously = async (): Promise<User> => {
  const result = await firebaseSignInAnonymously(auth);
  return result.user;
};

export { onAuthStateChanged, auth };
export type { User };
