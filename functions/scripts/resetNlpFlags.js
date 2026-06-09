require("dotenv").config();
const admin = require("firebase-admin");

const projectId = process.env.SERVICE_ACCOUNT_PROJECT_ID || "nomi-mvp";
const clientEmail = process.env.SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.SERVICE_ACCOUNT_KEY.replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert({projectId, clientEmail, privateKey}),
});
const db = admin.firestore();

(async () => {
  console.log("Resetting nlp_processed flags...");
  const snapshot = await db.collection("restaurants").get();
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let count = 0;
  let updated = 0;

  for (const doc of snapshot.docs) {
    if (doc.data().nlp_processed !== false) {
      batch.update(doc.ref, {nlp_processed: false});
      count++;
      updated++;
      if (count >= BATCH_SIZE) {
        await batch.commit();
        console.log("  Committed batch:", updated);
        batch = db.batch();
        count = 0;
      }
    }
  }
  if (count > 0) await batch.commit();
  console.log("Done. Reset " + updated + " / " + snapshot.size + " restaurants");
})();
