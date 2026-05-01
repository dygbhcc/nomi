require('dotenv').config({ path: './functions/.env' });
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.SERVICE_ACCOUNT_PROJECT_ID,
    clientEmail: process.env.SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
  })
});

const db = admin.firestore();

async function checkSwipes() {
  console.log('🔍 Checking swipes collection...\n');

  const swipesSnap = await db.collection('swipes').limit(10).get();
  const votesSnap = await db.collection('votes').limit(10).get();

  console.log(`📊 Swipes count: ${swipesSnap.size}`);
  console.log(`📊 Votes count: ${votesSnap.size}\n`);

  if (swipesSnap.size > 0) {
    console.log('Recent swipes:');
    swipesSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.direction} on restaurant ${data.restaurant_id.substring(0, 20)}... by user ${data.user_id.substring(0, 8)}`);
    });
  } else {
    console.log('⚠️  No swipes yet. Swipe in the app to create some!');
  }

  console.log('');

  if (votesSnap.size > 0) {
    console.log('Recent votes:');
    votesSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.direction ? 'YES' : 'NO'} for ${data.tag} on ${data.restaurant_id.substring(0, 20)}...`);
    });
  } else {
    console.log('⚠️  No votes yet. Validate in the app to create some!');
  }

  process.exit(0);
}

checkSwipes();
