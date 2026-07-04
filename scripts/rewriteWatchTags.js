/**
 * Rewrite `watch_tags` for existing restaurants using Gemini.
 *
 * The heuristic backfill (backfillReviewTags.js shortenNegative) produced
 * meaningless first-3-word chips like "visitors find bit" / "mention space
 * small". This script re-derives proper badge chips ("gets crowded",
 * "slow service", "noisy") from nlp_insights.negative_aspects, batching
 * ~40 restaurants per Gemini request so the whole collection costs ~45 calls.
 *
 * Only `watch_tags` is touched; love_tags / review_tags / nlp_insights stay
 * as they are. Restaurants with no negative_aspects are skipped.
 *
 * Usage (from repo root):
 *   DRY_RUN=true node scripts/rewriteWatchTags.js   # preview, no writes
 *   node scripts/rewriteWatchTags.js                # apply
 *   LIMIT=80 DRY_RUN=true node scripts/rewriteWatchTags.js  # small preview
 *   BATCHES=25,27,31 node scripts/rewriteWatchTags.js  # retry specific batches
 *     (batch numbering matches a previous full run: same query, same order)
 */
require("dotenv").config({path: __dirname + "/../functions/.env"});
const admin = require("../functions/node_modules/firebase-admin");
const {GoogleGenAI} = require("../functions/node_modules/@google/genai");

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
const LIMIT = parseInt(process.env.LIMIT || "0", 10) || Infinity;
// Optional: only process these 1-based batch numbers (retry after quota failures).
const ONLY_BATCHES = process.env.BATCHES
  ? new Set(process.env.BATCHES.split(",").map((n) => parseInt(n.trim(), 10)))
  : null;
const BATCH_PER_REQUEST = 40;
const DELAY_MS = 4500; // stay under the 15 req/min free-tier ceiling
const MAX_TAGS = 4;

// Keep in sync with functions/services/geminiNlpPipeline.js sanitizeTags.
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
function sanitizeTags(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const t = sanitizeTag(raw);
    const k = t.toLowerCase();
    if (t && t.split(/\s+/).length <= 3 && !seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

function resolveEn(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return value.en || value.pt || Object.values(value)[0] || [];
  return [];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildPrompt(items) {
  const lines = items.map((it) => `${it.idx}. ${it.negatives.join(" | ")}`).join("\n");
  return `You are labeling restaurant downsides as short UI badges.

For each numbered entry below, read the downside sentences and output 1-4 very short English keyword chips (1-3 words each) that summarize the downsides — e.g. "gets crowded", "slow service", "noisy", "pricey", "small space", "dated decor".

Rules:
- Plain descriptive words only. No review source names (Google, TheFork, etc.), no the word "review", no parentheses.
- Each chip must stand alone and be instantly understandable as a caution badge.
- Do not copy sentence fragments verbatim; distill the meaning.
- If the sentences contain no real downside, output an empty array for that entry.

Entries:
${lines}

Return ONLY a JSON object mapping each entry number (as a string) to its array of chips, e.g. {"1": ["gets crowded", "noisy"], "2": []}. No other text.`;
}

async function callGemini(ai, items) {
  const prompt = buildPrompt(items);
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{role: "user", parts: [{text: prompt}]}],
        config: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          thinkingConfig: {thinkingBudget: 0},
        },
      });
      const text = result.text;
      if (!text) throw new SyntaxError("empty response");
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      return parsed;
    } catch (err) {
      const status = err?.status;
      const transient = status === 429 || status === 503 || status === 500;
      const isJsonError = err instanceof SyntaxError;
      if ((transient || isJsonError) && attempt < maxAttempts) {
        // 429s carry a ~30s retry window on the free tier — short backoffs just burn attempts.
        const backoff = status === 429 ? 35000 : 2000 * 2 ** (attempt - 1);
        console.warn(`  [Gemini] retry ${attempt}/${maxAttempts} in ${backoff}ms (${err.message})`);
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
}

(async () => {
  console.log(`rewriteWatchTags — DRY_RUN=${DRY_RUN}${LIMIT !== Infinity ? ` LIMIT=${LIMIT}` : ""}`);
  const snap = await db.collection("restaurants").where("nlp_processed", "==", true).get();

  const targets = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const negatives = resolveEn(d.nlp_insights?.negative_aspects)
        .filter((s) => typeof s === "string" && s.trim());
    if (negatives.length === 0) continue;
    targets.push({ref: doc.ref, name: d.name || doc.id, negatives, old: d.watch_tags || []});
    if (targets.length >= LIMIT) break;
  }
  console.log(`Scanned ${snap.size} processed restaurants, ${targets.length} have negative_aspects.`);
  console.log(`Estimated Gemini requests: ${Math.ceil(targets.length / BATCH_PER_REQUEST)}\n`);

  const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

  let written = 0;
  let unchanged = 0;
  let failedBatches = 0;

  for (let i = 0; i < targets.length; i += BATCH_PER_REQUEST) {
    const chunk = targets.slice(i, i + BATCH_PER_REQUEST).map((t, j) => ({...t, idx: j + 1}));
    const batchNo = Math.floor(i / BATCH_PER_REQUEST) + 1;
    const totalBatches = Math.ceil(targets.length / BATCH_PER_REQUEST);
    if (ONLY_BATCHES && !ONLY_BATCHES.has(batchNo)) continue;
    process.stdout.write(`Batch ${batchNo}/${totalBatches} (${chunk.length} restaurants)... `);

    let mapping;
    try {
      mapping = await callGemini(ai, chunk);
    } catch (err) {
      console.error(`FAILED: ${err.message} — skipping batch, old tags kept`);
      failedBatches++;
      await sleep(DELAY_MS);
      continue;
    }

    const batch = db.batch();
    let batchWrites = 0;
    for (const item of chunk) {
      const tags = sanitizeTags(mapping[String(item.idx)]);
      if (JSON.stringify(tags) === JSON.stringify(item.old)) {
        unchanged++;
        continue;
      }
      if (batchNo <= 2) {
        console.log(`\n  ${item.name}: [${item.old.join(", ")}] -> [${tags.join(", ")}]`);
      }
      if (!DRY_RUN) {
        batch.update(item.ref, {watch_tags: tags});
        batchWrites++;
      }
      written++;
    }
    if (!DRY_RUN && batchWrites > 0) await batch.commit();
    console.log(`ok (${written} ${DRY_RUN ? "would change" : "written"} so far)`);

    if (i + BATCH_PER_REQUEST < targets.length) await sleep(DELAY_MS);
  }

  console.log(`\n=== DONE ===`);
  console.log(`${DRY_RUN ? "Would update" : "Updated"}: ${written}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Failed batches: ${failedBatches}`);
  if (DRY_RUN) console.log("\nDRY RUN — no changes written. Re-run without DRY_RUN to apply.");
  process.exit(0);
})().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
