require("dotenv").config({path: __dirname + "/../functions/.env"});
const admin = require("../functions/node_modules/firebase-admin");

const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json";
const sa = require(saPath);

admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: "nomi-mvp",
});
const db = admin.firestore();

async function run() {
  const snap = await db.collection("restaurants")
      .where("nlp_processed", "==", true)
      .get();

  console.log(`Resetting ${snap.size} restaurants to nlp_processed=false...`);

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let count = 0;

  for (const doc of snap.docs) {
    batch.update(doc.ref, {nlp_processed: false});
    count++;
    if (count % BATCH_SIZE === 0) {
      await batch.commit();
      console.log(`Reset: ${count}/${snap.size}`);
      batch = db.batch();
    }
  }
  if (count % BATCH_SIZE !== 0) {
    await batch.commit();
  }

  console.log(`Done. ${count} restaurants reset.`);

  const remaining = await db.collection("restaurants")
      .where("nlp_processed", "==", false).count().get();
  console.log(`Total nlp_processed=false: ${remaining.data().count}`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
