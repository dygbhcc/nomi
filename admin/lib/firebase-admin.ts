import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Decode private key from base64 if encoded, otherwise use as-is with newline replacement
const getPrivateKey = () => {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return undefined;

  // Check if it's base64 encoded (doesn't start with -----)
  if (!key.startsWith('-----')) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf-8');
      // Replace literal \n with actual newlines
      return decoded.replace(/\\n/g, '\n');
    } catch {
      return key.replace(/\\n/g, '\n');
    }
  }

  return key.replace(/\\n/g, '\n');
};

const app = getApps().length === 0
  ? initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: getPrivateKey(),
      }),
    })
  : getApps()[0];

export const db = getFirestore(app);
