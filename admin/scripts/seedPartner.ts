import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);

async function seed() {
  const restaurants = await db.collection('restaurants')
    .limit(3)
    .get();

  for (const doc of restaurants.docs) {
    const data = doc.data();
    await db.collection('restaurant_partners').add({
      restaurant_id: doc.id,
      restaurant_name: data.name,
      email: `demo-${doc.id.slice(0, 6)}@nomi.app`,
      password: 'nomi2026',
      address: data.address,
      created_at: new Date(),
    });
    console.log(`✅ Created partner: ${data.name} → demo-${doc.id.slice(0, 6)}@nomi.app`);
  }
  process.exit(0);
}

seed().catch(console.error);
