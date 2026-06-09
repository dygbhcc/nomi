import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChanged, auth, signIn, signUp, signOut, signInAnonymously } from '../services/authService';
import { removePushTokenFromFirestore } from '../services/notificationService';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

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
    try {
      await signInAnonymously();
      // onAuthStateChanged will pick up the anonymous user and set user.uid
      setIsGuest(true);
    } catch (error) {
      // Fallback: still allow guest mode even if anonymous auth fails
      setIsGuest(true);
      setLoading(false);
    }
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
