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

async function checkNew() {
  console.log('🔍 Checking recently added restaurants...\n');

  // Get restaurants ordered by cache_date
  const snap = await db.collection('restaurants')
    .orderBy('cache_date', 'desc')
    .limit(10)
    .get();

  snap.docs.forEach(doc => {
    const data = doc.data();
    const photo = data.photos?.[0];
    const cacheDate = data.cache_date?.toDate();

    console.log(`📍 ${data.name}`);
    console.log(`   Cached: ${cacheDate ? cacheDate.toLocaleString() : 'unknown'}`);

    if (!photo) {
      console.log(`   Photo: ❌ None`);
    } else if (photo.source === 'cloudinary') {
      console.log(`   Photo: ✅ Cloudinary`);
      console.log(`   URL: ${photo.url}`);
    } else if (photo.source === 'google') {
      console.log(`   Photo: ⚠️  Google (fallback)`);
    } else {
      console.log(`   Photo: ⚠️  Old format`);
    }
    console.log('');
  });

  // Count by type
  const allSnap = await db.collection('restaurants').get();
  let cloudinaryCount = 0;
  let googleCount = 0;
  let noPhotoCount = 0;

  allSnap.docs.forEach(doc => {
    const photo = doc.data().photos?.[0];
    if (!photo) {
      noPhotoCount++;
    } else if (photo.source === 'cloudinary') {
      cloudinaryCount++;
    } else {
      googleCount++;
    }
  });

  console.log('📊 Total Summary:');
  console.log(`   Cloudinary photos: ${cloudinaryCount}`);
  console.log(`   Google photos: ${googleCount}`);
  console.log(`   No photos: ${noPhotoCount}`);
  console.log(`   Total restaurants: ${allSnap.size}\n`);

  process.exit(0);
}

checkNew();
