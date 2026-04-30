require('dotenv').config({ path: '../functions/.env' });
const admin = require('firebase-admin');
const { httpsCallable } = require('firebase-functions/lib/common/providers/https');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.SERVICE_ACCOUNT_PROJECT_ID,
    clientEmail: process.env.SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
  })
});

const db = admin.firestore();

async function test() {
  console.log('🧪 Testing Cloudinary integration...\n');

  // Test coordinates (Lisbon - Bairro Alto area)
  const testCoords = {
    lat: 38.7144,
    lng: -9.1458,
    radius: 500,
    maxResults: 5
  };

  console.log('📍 Fetching restaurants near:', testCoords);
  console.log('⏳ This will take a while as photos are uploaded to Cloudinary...\n');

  try {
    // Clear cache first to force new fetch
    const regionKey = `${testCoords.lat.toFixed(3)}_${testCoords.lng.toFixed(3)}_${testCoords.radius}`;
    await db.collection('cache_regions').doc(regionKey).delete();
    console.log('🗑️  Cache cleared for region:', regionKey, '\n');

    // Note: We can't directly call Firebase Functions from here
    // User needs to call it from their app or Firebase Console
    console.log('⚠️  To test, you need to call the function from:');
    console.log('   1. Your app using Firebase SDK');
    console.log('   2. Firebase Console > Functions > fetchAndCacheRestaurants');
    console.log('   3. Using the Firebase CLI: firebase functions:shell\n');

    console.log('📋 After calling the function, check the results:');
    console.log('   Run: node scripts/checkCloudinaryPhotos.js\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

test();
