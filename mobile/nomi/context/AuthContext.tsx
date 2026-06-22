import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  auth,
  signIn,
  signUp,
  signOut,
  signInAnonymously,
  resendVerificationEmail,
  refreshEmailVerified,
  sendPasswordReset,
} from '../services/authService';
import { removePushTokenFromFirestore } from '../services/notificationService';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshVerification: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  // Bumped to force a re-render after reload() updates user.emailVerified in
  // place (onAuthStateChanged does not fire on reload).
  const [, setAuthVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    setIsGuest(false);
    await signIn(email, password);
  };

  const handleSignUp = async (email: string, password: string, displayName: string) => {
    setIsGuest(false);
    await signUp(email, password, displayName);
  };

  const handleSignOut = async () => {
    if (user) {
      await removePushTokenFromFirestore(user.uid).catch(() => {});
    }
    setIsGuest(false);
    await signOut();
  };

  const continueAsGuest = async () => {
    // Require a real anonymous user. A failed anonymous sign-in must not flip
    // isGuest=true with user=null — that produced a broken guest session where
    // saves/points were written nowhere and silently lost.
    await signInAnonymously();
    setIsGuest(true);
  };

  const resendVerification = async () => {
    await resendVerificationEmail();
  };

  const refreshVerification = async () => {
    const verified = await refreshEmailVerified();
    setAuthVersion((v) => v + 1); // force re-render; user.emailVerified updated in place
    return verified;
  };

  const resetPassword = async (email: string) => {
    await sendPasswordReset(email);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isGuest,
      signIn: handleSignIn,
      signUp: handleSignUp,
      signOut: handleSignOut,
      continueAsGuest,
      resendVerification,
      refreshVerification,
      resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
