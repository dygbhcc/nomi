import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getFunctions as getFirebaseFunctions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Metro resolves @firebase/auth to its RN bundle which exports getReactNativePersistence;
// the browser typings don't include it so we require() to skip the tsc module check.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('@firebase/auth') as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getReactNativePersistence: (storage: typeof AsyncStorage) => any;
};

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Use LOCAL persistence via AsyncStorage so the session survives app restarts.
// initializeAuth throws if called twice (hot reload) — fall back to getAuth().
let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const database = getDatabase(app);
export const functions = getFirebaseFunctions(app, 'europe-west1');
export default app;
