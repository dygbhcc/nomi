/**
 * One-time backfill: set created_at on all restaurants that are missing it.
 * Existing restaurants get today's date; new ones get serverTimestamp() via fetchNew.
 *
 * Run from the repo root:
 *   node scripts/backfillCreatedAt.js
 */

require("dotenv").config({ path: "./functions/.env" });
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.SERVICE_ACCOUNT_PROJECT_ID,
    clientEmail: process.env.SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n"),
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.firestore();
const BATCH_SIZE = 400;

async function run() {
  const snap = await db.collection("restaurants")
    .select() // fetch only doc refs, no fields
    .get();

  const all = snap.docs;
  console.log(`Total restaurants: ${all.length}`);

  // Filter to those missing created_at
  const missing = [];
  for (const doc of all) {
    const data = doc.data();
    if (!data.created_at) missing.push(doc.ref);
  }

  // Need actual data to check field — re-fetch with created_at field
  const withField = await db.collection("restaurants").select("created_at").get();
  const missingRefs = withField.docs
    .filter((d) => !d.data().created_at)
    .map((d) => d.ref);

  console.log(`Missing created_at: ${missingRefs.length}`);

  const timestamp = admin.firestore.Timestamp.fromDate(new Date("2026-08-19T00:00:00Z"));

  let processed = 0;
  for (let i = 0; i < missingRefs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = missingRefs.slice(i, i + BATCH_SIZE);
    for (const ref of chunk) {
      batch.update(ref, { created_at: timestamp });
    }
    await batch.commit();
    processed += chunk.length;
    console.log(`  ${processed}/${missingRefs.length} updated`);
  }

  console.log("Done.");
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
