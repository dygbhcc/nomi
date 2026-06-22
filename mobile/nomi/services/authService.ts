import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInAnonymously as firebaseSignInAnonymously,
  sendEmailVerification,
  updateProfile,
  reload,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * Derive a friendly display name from the auth profile or email local-part.
 */
function deriveName(user: User, displayName?: string): string {
  return (
    displayName ||
    user.displayName ||
    (user.email ? user.email.split('@')[0] : '') ||
    'Foodie'
  );
}

/**
 * Guarantee that a `users/{uid}` document exists with the expected default
 * shape. Creates the full document when missing, otherwise backfills only the
 * fields that are absent. Idempotent — safe to call on every sign-in/sign-up.
 * This is the single source of truth for user-document creation so the profile
 * never ends up empty ("user not created") regardless of the entry path.
 */
export const ensureUserDocument = async (
  user: User,
  displayName?: string
): Promise<void> => {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      display_name: deriveName(user, displayName),
      email: user.email || '',
      points: 0,
      badges: [],
      segment: 'new',
      preference_history: { moods: [], budget: 2, dist: 1 },
      streak: 0,
      notification_preferences: {
        groupInvites: true,
        newRestaurants: false,
        validateReminders: true,
      },
      created_at: serverTimestamp(),
    });
    return;
  }

  // Backfill missing core fields on an existing doc without clobbering data.
  const data = snap.data();
  const patch: Record<string, unknown> = {};
  if (!data.display_name && (displayName || user.displayName)) {
    patch.display_name = displayName || user.displayName;
  }
  if (!data.email && user.email) patch.email = user.email;
  if (Object.keys(patch).length > 0) {
    await setDoc(ref, patch, { merge: true });
  }
};

export const signIn = async (email: string, password: string): Promise<User> => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  // Pull the freshest emailVerified flag, then make sure a user doc exists.
  await reload(result.user).catch(() => {});
  await ensureUserDocument(result.user);
  return result.user;
};

export const signUp = async (
  email: string,
  password: string,
  displayName: string
): Promise<User> => {
  const result = await createUserWithEmailAndPassword(auth, email, password);

  await updateProfile(result.user, { displayName });
  await ensureUserDocument(result.user, displayName);

  // Send the verification email (best-effort; never block account creation).
  await sendEmailVerification(result.user).catch(() => {});

  return result.user;
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

export const signInAnonymously = async (): Promise<User> => {
  const result = await firebaseSignInAnonymously(auth);
  return result.user;
};

/**
 * Re-send the verification email to the currently signed-in user.
 */
export const resendVerificationEmail = async (): Promise<void> => {
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  }
};

/**
 * Reload the current user from Firebase and return the latest emailVerified
 * flag (used by the "I've verified" button).
 */
export const refreshEmailVerified = async (): Promise<boolean> => {
  if (!auth.currentUser) return false;
  await reload(auth.currentUser);
  return auth.currentUser.emailVerified;
};

export { onAuthStateChanged, auth };
export type { User };
