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

async function check() {
  console.log('🔍 Checking photos in database...\n');

  const snap = await db.collection('restaurants').limit(10).get();

  let cloudinaryCount = 0;
  let googleCount = 0;
  let noPhotoCount = 0;

  snap.docs.forEach(doc => {
    const data = doc.data();
    const photo = data.photos?.[0];

    if (!photo) {
      noPhotoCount++;
      console.log(`📍 ${data.name} → ❌ No photos`);
    } else if (photo.source === 'cloudinary') {
      cloudinaryCount++;
      console.log(`📍 ${data.name} → ✅ Cloudinary`);
      console.log(`   ${photo.url}\n`);
    } else if (photo.source === 'google') {
      googleCount++;
      console.log(`📍 ${data.name} → ⚠️  Google (fallback)`);
      console.log(`   ${photo.photo_reference.substring(0, 50)}...\n`);
    } else {
      googleCount++;
      console.log(`📍 ${data.name} → ⚠️  Old format (Google reference)`);
      console.log(`   ${photo.photo_reference?.substring(0, 50)}...\n`);
    }
  });

  console.log('\n📊 Summary:');
  console.log(`   Cloudinary: ${cloudinaryCount}`);
  console.log(`   Google: ${googleCount}`);
  console.log(`   No photos: ${noPhotoCount}`);
  console.log(`   Total: ${snap.docs.length}\n`);

  if (cloudinaryCount === 0) {
    console.log('💡 Tip: Photos will be uploaded to Cloudinary when you:');
    console.log('   1. Call fetchAndCacheRestaurants for a new area');
    console.log('   2. Cache expires and data is re-fetched\n');
  }

  process.exit(0);
}

check();
