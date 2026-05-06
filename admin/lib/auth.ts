import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from './firebase-admin';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Restaurant Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const snap = await db.collection('restaurant_partners')
          .where('email', '==', credentials.email)
          .limit(1)
          .get();

        if (snap.empty) return null;

        const partner = snap.docs[0].data();

        if (partner.password !== credentials.password) return null;

        return {
          id: snap.docs[0].id,
          email: partner.email,
          name: partner.restaurant_name,
          restaurantId: partner.restaurant_id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.restaurantId = (user as any).restaurantId;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).restaurantId = token.restaurantId;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
