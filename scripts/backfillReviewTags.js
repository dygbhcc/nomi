/**
 * Backfill `review_tags` for existing restaurants — ZERO AI cost.
 *
 * B-21: show short keyword badges instead of long review text. The data is
 * already produced by the nightly Gemini run, so this script just derives a
 * compact `review_tags` array from existing fields (food_admiration,
 * primary_sentiment_nuances, top_keywords). The long summary is left intact.
 *
 * Usage:
 *   DRY_RUN=true node scripts/backfillReviewTags.js   # preview, no writes
 *   node scripts/backfillReviewTags.js                # write
 *   FORCE=true node scripts/backfillReviewTags.js     # overwrite existing tags
 */
require("dotenv").config({path: __dirname + "/../functions/.env"});
const admin = require("../functions/node_modules/firebase-admin");

const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json";
const sa = require(saPath);

admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: "nomi-mvp",
});
const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN === "true";
const FORCE = process.env.FORCE === "true";
const MAX_TAGS = 6;
const BAD_VALUES = new Set(["n/a", "na", "null", "none", "", "unknown"]);

// Resolve a field that may be a plain array or a bilingual { en, pt } map.
function resolveEn(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return value.en || value.pt || Object.values(value)[0] || [];
  return [];
}

function clean(list) {
  return (list || [])
      .filter((s) => typeof s === "string")
      .map((s) => s.trim())
      .filter((s) => s && !BAD_VALUES.has(s.toLowerCase()));
}

function dedupCap(list, cap) {
  const seen = new Set();
  const out = [];
  for (const tag of list) {
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(tag);
    }
    if (out.length >= cap) break;
  }
  return out;
}

// Keep only short badge-style chips (1-3 words). Long sentences leak in from
// rich fields like food_admiration; those belong in the summary, not a badge.
const MAX_CHIP_WORDS = 3;
const MAX_CHIP_CHARS = 28;
function isChip(tag) {
  return tag.split(/\s+/).length <= MAX_CHIP_WORDS && tag.length <= MAX_CHIP_CHARS;
}

// Build a compact, de-duplicated tag set from the richest existing signals.
function deriveReviewTags(d) {
  const nuances = clean(d.nlp_metrics?.primary_sentiment_nuances);
  const admiration = clean(resolveEn(d.nlp_insights?.food_admiration));
  const keywords = clean(d.nlp_top_keywords);
  return dedupCap([...nuances, ...admiration, ...keywords].filter(isChip), MAX_TAGS);
}

// Heuristic: shorten a long "negative aspect" sentence into a 2-4 word chip.
// Best-effort fallback for existing data; the nightly Gemini run produces
// proper watch_tags going forward.
// Filler/aux words stripped anywhere in the phrase so only content words remain.
const NEG_STOP = new Set([
  "it", "can", "get", "gets", "be", "is", "are", "was", "were", "the", "a", "an",
  "some", "reviews", "suggest", "service", "sometimes", "may", "might", "there",
  "this", "that", "place", "often", "quite", "very", "to", "of", "due", "for",
  "its", "merely", "really", "on", "in", "at", "with", "also", "more", "less",
  "not", "become", "becomes", "considered", "and", "or",
]);
function shortenNegative(sentence) {
  if (!sentence) return "";
  // Take the first clause, drop filler words anywhere, keep up to 3 content words.
  const s = sentence.split(/[,;.]|\bespecially\b|\bdue to\b|\bbecause\b|\bbut\b|\balthough\b/i)[0];
  const words = s
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .trim()
      .split(/\s+/)
      .filter((w) => w && !NEG_STOP.has(w));
  return words.slice(0, 3).join(" ").trim();
}

function deriveWatchTags(d) {
  const negatives = clean(resolveEn(d.nlp_insights?.negative_aspects));
  const short = negatives.map(shortenNegative).filter((s) => s.split(" ").length <= 4 && s.length > 2);
  return dedupCap(short, 4);
}

async function run() {
  const snap = await db.collection("restaurants").where("nlp_processed", "==", true).get();
  console.log(`Scanning ${snap.size} processed restaurants...${DRY_RUN ? " (DRY RUN)" : ""}`);

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0;
  let written = 0;
  let skippedExisting = 0;
  let skippedEmpty = 0;
  const samples = [];

  for (const doc of snap.docs) {
    const d = doc.data();

    const update = {};
    const reviewTags = deriveReviewTags(d);
    const watchTags = deriveWatchTags(d);
    // love_tags = the short positive set (reuse review_tags, already short).
    const loveTags = reviewTags;

    if ((FORCE || !d.review_tags?.length) && reviewTags.length) update.review_tags = reviewTags;
    if ((FORCE || !d.love_tags?.length) && loveTags.length) update.love_tags = loveTags;
    if ((FORCE || !d.watch_tags?.length) && watchTags.length) update.watch_tags = watchTags;

    if (Object.keys(update).length === 0) {
      if (d.review_tags?.length || d.love_tags?.length) skippedExisting++;
      else skippedEmpty++;
      continue;
    }

    if (samples.length < 10) {
      samples.push(`${d.name}: love=[${(update.love_tags || d.love_tags || []).join(", ")}] watch=[${(update.watch_tags || d.watch_tags || []).join(", ")}]`);
    }

    if (!DRY_RUN) {
      batch.update(doc.ref, update);
      batchCount++;
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    written++;
  }

  if (!DRY_RUN && batchCount > 0) await batch.commit();

  console.log("\n=== Sample ===");
  samples.forEach((s) => console.log("  " + s));
  console.log("\n=== DONE ===");
  console.log(`Would write / wrote: ${written}`);
  console.log(`Skipped (already had tags): ${skippedExisting}`);
  console.log(`Skipped (no source data):   ${skippedEmpty}`);
  if (DRY_RUN) console.log("\nDRY RUN — no changes written. Re-run without DRY_RUN to apply.");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
