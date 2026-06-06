require("dotenv").config({path: __dirname + "/../functions/.env"});
const admin = require("../functions/node_modules/firebase-admin");

const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json";
const sa = require(saPath);

admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: "nomi-mvp",
});
const db = admin.firestore();

const CANONICAL = ["romantic", "energetic", "chill", "explorer", "focus", "hungry_quick"];
const THRESHOLD = 50;

async function run() {
  const snap = await db.collection("restaurants")
      .where("nlp_processed", "==", true)
      .get();

  console.log(`Processing ${snap.size} restaurants...`);

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0;
  let updated = 0;
  let tagsChanged = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const cs = d.confidence_scores || {};
    const nlp = d.nlp_scores || {};
    const oldTags = d.mood_tags || [];

    // Keep only canonical 6 tags in confidence_scores
    const newCs = {};
    for (const tag of CANONICAL) {
      if (cs[tag] !== undefined && cs[tag] !== null) {
        newCs[tag] = cs[tag];
      }
    }

    // Keep only canonical 6 tags in nlp_scores
    const newNlp = {};
    for (const tag of CANONICAL) {
      if (nlp[tag] !== undefined && nlp[tag] !== null) {
        newNlp[tag] = nlp[tag];
      }
    }

    // Recalculate mood_tags from canonical confidence_scores
    const newTags = CANONICAL.filter((tag) => (newCs[tag] || 0) >= THRESHOLD);

    const oldSorted = JSON.stringify([...oldTags].sort());
    const newSorted = JSON.stringify([...newTags].sort());

    batch.update(doc.ref, {
      confidence_scores: newCs,
      nlp_scores: newNlp,
      mood_tags: newTags,
    });
    batchCount++;
    updated++;

    if (oldSorted !== newSorted) tagsChanged++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`Committed: ${updated}/${snap.size}`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log("");
  console.log("=== DONE ===");
  console.log(`Updated:      ${updated}`);
  console.log(`Tags changed: ${tagsChanged}`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
