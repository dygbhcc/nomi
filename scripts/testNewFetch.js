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

async function clearAndTest() {
  console.log('🧹 Clearing cache for test area...\n');

  // Bairro Alto area - fresh coordinates not in current cache
  const testCoords = {
    lat: 38.714,
    lng: -9.146,
    radius: 500
  };

  const regionKey = `${testCoords.lat.toFixed(3)}_${testCoords.lng.toFixed(3)}_${testCoords.radius}`;

  try {
    await db.collection('cache_regions').doc(regionKey).delete();
    console.log(`✅ Cache cleared for region: ${regionKey}`);
    console.log(`📍 Test coordinates: lat=${testCoords.lat}, lng=${testCoords.lng}, radius=${testCoords.radius}\n`);

    console.log('🎯 Next step:');
    console.log('   Call fetchAndCacheRestaurants from your app with:');
    console.log(`   { lat: ${testCoords.lat}, lng: ${testCoords.lng}, radius: ${testCoords.radius}, maxResults: 5 }\n`);

    console.log('   Or use this curl command:');
    console.log(`   firebase functions:shell`);
    console.log(`   > fetchAndCacheRestaurants({lat: ${testCoords.lat}, lng: ${testCoords.lng}, radius: ${testCoords.radius}, maxResults: 5})\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

clearAndTest();
