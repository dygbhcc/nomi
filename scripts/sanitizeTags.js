/**
 * Sanitize existing `review_tags` / `love_tags` / `watch_tags` on restaurants.
 *
 * The Gemini NLP run sometimes leaked review-source names into the short badge
 * arrays — e.g. watch_tags ["traffic noise thefork", "tight tables google"] or
 * parenthetical citations "traffic noise (TheFork review)". The pipeline now
 * strips these on write (geminiNlpPipeline.sanitizeTags); this is the zero-AI
 * backfill for docs already written with the dirty values.
 *
 * Usage (from repo root):
 *   DRY_RUN=true node scripts/sanitizeTags.js   # preview, no writes
 *   node scripts/sanitizeTags.js                # apply
 */
require("dotenv").config({ path: __dirname + "/../functions/.env" });
const admin = require("../functions/node_modules/firebase-admin");

const key = (process.env.SERVICE_ACCOUNT_KEY || "").replace(/\\n/g, "\n");
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.SERVICE_ACCOUNT_PROJECT_ID,
    clientEmail: process.env.SERVICE_ACCOUNT_EMAIL,
    privateKey: key,
  }),
  projectId: process.env.SERVICE_ACCOUNT_PROJECT_ID || "nomi-mvp",
});
const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN === "true";

// Keep in sync with functions/services/geminiNlpPipeline.js
const TAG_SOURCE_WORDS = [
  "restaurant guru", "thefork", "the fork", "google", "zomato", "tripadvisor",
  "trip advisor", "foursquare", "facebook", "yelp", "instagram",
];

function sanitizeTag(tag) {
  if (typeof tag !== "string") return "";
  let s = tag.replace(/\([^)]*\)/g, " ");
  for (const w of TAG_SOURCE_WORDS) {
    s = s.replace(new RegExp(`\\b${w}\\b`, "gi"), " ");
  }
  return s.replace(/\s+/g, " ").trim();
}

// Backfill semantics: ONLY clean dirty content (source-name leak, parenthetical
// citation) and drop tags that become empty + de-dupe. Do NOT truncate to a new
// cap — preserving the existing tag count keeps this a pure bugfix, not a
// content/length change. Going-forward capping is handled in the pipeline.
function sanitizeTags(arr) {
  if (!Array.isArray(arr)) return null; // null = field absent, leave untouched
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const t = sanitizeTag(raw);
    const k = t.toLowerCase();
    if (t && !seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  return out;
}

const FIELDS = ["review_tags", "love_tags", "watch_tags"];

(async () => {
  console.log(`sanitizeTags — DRY_RUN=${DRY_RUN}`);
  const snap = await db.collection("restaurants").get();
  let scanned = 0;
  let changed = 0;
  let batch = db.batch();
  let pending = 0;

  for (const doc of snap.docs) {
    scanned++;
    const data = doc.data();
    const patch = {};
    for (const field of FIELDS) {
      if (!Array.isArray(data[field])) continue;
      const cleaned = sanitizeTags(data[field]);
      if (JSON.stringify(cleaned) !== JSON.stringify(data[field])) {
        patch[field] = cleaned;
      }
    }
    if (Object.keys(patch).length > 0) {
      changed++;
      if (changed <= 20) {
        console.log(`  ${data.name || doc.id}:`, JSON.stringify(patch));
      }
      if (!DRY_RUN) {
        batch.update(doc.ref, patch);
        pending++;
        if (pending >= 400) {
          await batch.commit();
          batch = db.batch();
          pending = 0;
        }
      }
    }
  }
  if (!DRY_RUN && pending > 0) await batch.commit();

  console.log(`\nScanned ${scanned}, ${DRY_RUN ? "would change" : "changed"} ${changed}.`);
  process.exit(0);
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
