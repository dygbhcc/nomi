import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInAnonymously as firebaseSignInAnonymously,
  sendEmailVerification,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  reload,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from './firebase';
import { callUserApi } from './api';

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
 * shape. The backend callable creates the full document when missing,
 * otherwise backfills only the fields that are absent. Idempotent — safe to
 * call on every sign-in/sign-up. This is the single source of truth for
 * user-document creation so the profile never ends up empty ("user not
 * created") regardless of the entry path.
 */
export const ensureUserDocument = async (
  user: User,
  displayName?: string
): Promise<void> => {
  await callUserApi('ensureDocument', { displayName: deriveName(user, displayName) });
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

  // Send the verification email (best-effort; never block account creation),
  // but surface the real error in dev so delivery failures are diagnosable
  // instead of being silently swallowed.
  try {
    await sendEmailVerification(result.user);
  } catch (e) {
    if (__DEV__) console.error('sendEmailVerification (signUp) failed:', e);
  }

  return result.user;
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

/**
 * Update the user's display name on both the auth profile and the Firestore
 * user document so it stays consistent across the app.
 */
export const updateDisplayName = async (name: string): Promise<void> => {
  const trimmed = name.trim();
  if (!auth.currentUser || !trimmed) return;
  await updateProfile(auth.currentUser, { displayName: trimmed });
  await callUserApi('updateSettings', { displayName: trimmed });
};

/**
 * Send a password-reset email to the given address.
 */
export const sendPasswordReset = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};

/**
 * Validate a password-reset oobCode (from the email deep link) and return the
 * account email it belongs to. Throws if the code is invalid/expired.
 */
export const verifyResetCode = async (oobCode: string): Promise<string> => {
  return verifyPasswordResetCode(auth, oobCode);
};

/**
 * Complete an in-app password reset using the oobCode from the email link.
 */
export const completePasswordReset = async (
  oobCode: string,
  newPassword: string
): Promise<void> => {
  await confirmPasswordReset(auth, oobCode, newPassword);
};

/**
 * Apply an email-verification oobCode from a deep link (marks the account
 * verified without opening the web handler).
 */
export const applyVerificationCode = async (oobCode: string): Promise<void> => {
  await applyActionCode(auth, oobCode);
};

/**
 * Change the signed-in user's password. Re-authenticates with the current
 * password first (Firebase requires a recent login for password changes).
 */
export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const u = auth.currentUser;
  if (!u || !u.email) throw { code: 'auth/no-current-user' };
  const credential = EmailAuthProvider.credential(u.email, currentPassword);
  await reauthenticateWithCredential(u, credential);
  await updatePassword(u, newPassword);
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
