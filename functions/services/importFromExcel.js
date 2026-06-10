require("dotenv").config();
const admin = require("firebase-admin");
const axios = require("axios");
const XLSX = require("xlsx");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;
const MIN_RATING = 3.0;
const MIN_REVIEWS = 10;

async function getPlaceDetails(placeId) {
  const url = "https://maps.googleapis.com/maps/api/place/details/json";
  const response = await axios.get(url, {
    params: {
      place_id: placeId,
      fields: "place_id,name,formatted_address,geometry,opening_hours,formatted_phone_number,website,rating,price_level,photos,user_ratings_total,business_status",
      key: PLACES_KEY,
    },
    timeout: 10000,
  });
  return response.data.result;
}

async function main() {
  const workbook = XLSX.readFile("./data/lisbon_restaurants.xlsx");
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`📋 Excel rows: ${rows.length}`);

  // Get existing place_ids from Firestore
  const existingSnap = await db.collection("restaurants").select("place_id").get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.data().place_id).filter(Boolean));
  console.log(`✅ Already in Firestore: ${existingIds.size}`);

  // Filter: not already in Firestore, not closed
  const toFetch = rows.filter((row) => {
    if (!row.place_id) return false;
    if (row["closed "] === "X") return false;
    if (existingIds.has(row.place_id)) return false;
    return true;
  });

  console.log(`🔍 New places to fetch from API: ${toFetch.length}`);

  let added = 0;
  let skipped = 0;
  const batchSize = 450;
  let batch = db.batch();
  let batchCount = 0;

  for (let i = 0; i < toFetch.length; i++) {
    const row = toFetch[i];

    try {
      const details = await getPlaceDetails(row.place_id);
      if (!details) {
        skipped++; continue;
      }

      // Quality filters
      if (details.business_status && details.business_status !== "OPERATIONAL") {
        console.log(`⏭ ${details.name}: not operational`);
        skipped++;
        continue;
      }

      if (details.rating && details.rating < MIN_RATING) {
        console.log(`⏭ ${details.name}: rating ${details.rating} < ${MIN_RATING}`);
        skipped++;
        continue;
      }

      if (details.user_ratings_total && details.user_ratings_total < MIN_REVIEWS) {
        console.log(`⏭ ${details.name}: only ${details.user_ratings_total} reviews`);
        skipped++;
        continue;
      }

      const doc = {
        place_id: details.place_id,
        name: details.name,
        address: details.formatted_address || "",
        location: {
          lat: details.geometry?.location?.lat || 0,
          lng: details.geometry?.location?.lng || 0,
        },
        budget_level: details.price_level || 2,
        mood_tags: [],
        confidence_scores: {},
        opening_hours: {
          is_open_monday: true,
          periods: details.opening_hours?.periods || [],
        },
        business_status: details.business_status || "OPERATIONAL",
        noise_level: "unknown",
        phone: details.formatted_phone_number || "",
        website: details.website || "",
        google_rating: details.rating || 0,
        review_count: details.user_ratings_total || 0,
        photos: details.photos ? [{
          photo_reference: details.photos[0].photo_reference,
          source: "google",
          width: details.photos[0].width,
          height: details.photos[0].height,
        }] : [],
        cache_date: admin.firestore.FieldValue.serverTimestamp(),
        is_local_concept: false,
        nlp_processed: false,
      };

      const ref = db.collection("restaurants").doc(doc.place_id);
      batch.set(ref, doc, {merge: true});
      batchCount++;
      added++;

      if (batchCount >= batchSize) {
        await batch.commit();
        console.log(`💾 Committed batch of ${batchCount}`);
        batch = db.batch();
        batchCount = 0;
      }

      if (i % 10 === 0) {
        console.log(`Progress: ${i}/${toFetch.length} — added: ${added}, skipped: ${skipped}`);
      }

      // Rate limit delay
      await new Promise((r) => setTimeout(r, 200));
    } catch (error) {
      console.error(`❌ Error for ${row.place_id}:`, error.message);
      skipped++;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`💾 Final batch committed: ${batchCount}`);
  }

  console.log("\n=== PIPELINE COMPLETE ===");
  console.log(`✅ Added: ${added}`);
  console.log(`⏭ Skipped: ${skipped}`);
  console.log(`📊 Total in Firestore: ~${existingIds.size + added}`);
  process.exit(0);
}

main().catch(console.error);
