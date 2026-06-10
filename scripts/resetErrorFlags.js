/**
 * Reset nlp_error flags so failed restaurants get re-queued for NLP processing.
 * Only resets restaurants that have nlp_error == true.
 * Usage: node scripts/resetErrorFlags.js
 */
require("dotenv").config({path: __dirname + "/../functions/.env"});
const admin = require("../functions/node_modules/firebase-admin");

const projectId = process.env.SERVICE_ACCOUNT_PROJECT_ID || "nomi-mvp";
const clientEmail = process.env.SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.SERVICE_ACCOUNT_KEY.replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert({projectId, clientEmail, privateKey}),
});
const db = admin.firestore();

(async () => {
  console.log("Querying restaurants with nlp_error == true...");
  const snapshot = await db.collection("restaurants")
    .where("nlp_error", "==", true)
    .get();

  console.log(`Found ${snapshot.size} restaurants with errors.`);

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let count = 0;
  let updated = 0;

  for (const doc of snapshot.docs) {
    batch.update(doc.ref, {
      nlp_processed: false,
      nlp_error: admin.firestore.FieldValue.delete(),
      nlp_error_message: admin.firestore.FieldValue.delete(),
      nlp_error_at: admin.firestore.FieldValue.delete(),
    });
    count++;
    updated++;
    if (count >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  Committed batch: ${updated} reset so far`);
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
  console.log(`Done. Reset ${updated} restaurants (nlp_error cleared, nlp_processed set to false).`);
  process.exit(0);
})();
