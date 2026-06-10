/**
 * Bulk NLP processing using Vertex AI (no grounding).
 * Processes all restaurants with nlp_processed == false.
 *
 * Vertex AI: 15 RPM for Gemini 2.5 Flash → 4 sec delay between requests.
 * Usage: node scripts/bulkNlpProcess.js
 */

require("dotenv").config({path: __dirname + "/../functions/.env"});
const admin = require("../functions/node_modules/firebase-admin");
const {GoogleGenAI} = require("../functions/node_modules/@google/genai");
const fs = require("fs");
const os = require("os");
const path = require("path");

const projectId = process.env.SERVICE_ACCOUNT_PROJECT_ID || "nomi-mvp";
const clientEmail = process.env.SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.SERVICE_ACCOUNT_KEY.replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert({projectId, clientEmail, privateKey}),
});
const db = admin.firestore();

// Vertex AI auth
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const tmpSaPath = path.join(os.tmpdir(), "nomi-sa-bulk.json");
  fs.writeFileSync(tmpSaPath, JSON.stringify({
    type: "service_account",
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  }));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpSaPath;
}

const ai = new GoogleGenAI({
  vertexai: true,
  project: projectId,
  location: "us-central1",
});

const MOOD_TAGS = ["romantic", "energetic", "chill", "explorer", "focus", "hungry_quick"];
// PMO signal removed June 2026 — weights renormalized (NLP-heavy, Option A)
const WEIGHTS = {nlp: 0.55, validate: 0.30, swipe: 0.15};

// Vertex AI: 15 RPM → 4 sec between requests
const DELAY_MS = 4000;
// No daily limit on Vertex AI, process all
const MAX_PER_RUN = 2000;

function nlpToConfidence(score) {
  return Math.round(score * 100);
}

function calculateWeightedConfidence(tag, {nlpScores, validateData}) {
  const signals = [];
  if (nlpScores && nlpScores[tag] != null) {
    signals.push({weight: WEIGHTS.nlp, value: nlpToConfidence(nlpScores[tag])});
  }
  if (validateData && validateData[tag] != null) {
    signals.push({weight: WEIGHTS.validate, value: validateData[tag]});
  }
  if (signals.length === 0) return null;
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  return Math.round(signals.reduce((sum, s) => sum + s.value * (s.weight / totalWeight), 0));
}

function validateAnalysis(data) {
  if (!data || typeof data !== "object" || !data.scores) return null;
  const scores = {};
  for (const key of MOOD_TAGS) {
    const raw = Number(data.scores[key]);
    scores[key] = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
  }
  return {...data, scores};
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeWithGemini(restaurant, localeKey = "pt") {
  const {name, address, place_id: placeId} = restaurant;
  const sentimentJson = restaurant.sentiment_breakdown ? JSON.stringify(restaurant.sentiment_breakdown) : "N/A";
  const moodSummary = restaurant.general_mood_summary || "N/A";

  const prompt = `You are a restaurant mood classifier for Nomi, a venue discovery app in Lisbon, Portugal.

# Input Data
- Name: ${name}
- Address: ${address || "Lisbon, Portugal"}
- Google Place ID: ${placeId || "unknown"}
- Quantitative sentiment: ${sentimentJson}
- Qualitative summary: ${moodSummary}

# Task
Using the provided sentiment metadata and your training knowledge about this venue, score each mood 0.0-1.0, map metrics, and extract insights. If sentiment metadata is "N/A", rely on your knowledge about the venue.

# Mood Definitions
- romantic: Intimate, dim-lit spaces for couples and date nights. Quiet enough to talk closely; cozy, candlelit. NOT loud or crowded.
- energetic: Loud, buzzing venues with a high-energy crowd — party vibes, music, DJ sets, dancing, celebrations and big group nights. Includes bars, music venues and entertainment-forward spots, not only restaurants. The atmosphere is the main draw.
- chill: Relaxed, laid-back, no rush. Warm and welcoming, feels like eating at home. Good for unwinding with friends. NOT a work/study spot and NOT high-energy.
- explorer: Unique, off the beaten path. Hidden gems, unusual or unexpected menus, places most people don't know about.
- focus: Quiet and calm with minimal distractions — good wifi, good for working or studying solo. Functional rather than social.
- hungry_quick: Fast, efficient, filling. Counter service, quick lunch menus, grab-and-go; no wait, no reservation needed.

# Insight Rules
All insight fields are bilingual objects with "en" and "${localeKey}" keys. Summaries: 1-2 sentences max, direct. Keep local dish names unchanged across languages.

# Output Rules
1. Output MUST be a single valid JSON object. No markdown, no pre/post text.
2. Score 0.0 for a mood ONLY if it clearly does not apply. A venue can score high on multiple moods.

# Expected Format
{
  "scores": { "romantic": 0.0, "energetic": 0.0, "chill": 0.0, "explorer": 0.0, "focus": 0.0, "hungry_quick": 0.0 },
  "metrics": { "rating": 0.0, "rating_source": "String", "most_frequent_emotion": "String", "primary_sentiment_nuances": ["String"] },
  "insights": {
    "general_summary": { "en": "...", "${localeKey}": "..." },
    "food_admiration": { "en": ["..."], "${localeKey}": ["..."] },
    "negative_aspects": { "en": ["..."], "${localeKey}": ["..."] }
  },
  "review_count": 0,
  "review_sources": [],
  "top_keywords": [],
  "confidence": "low|medium|high"
}`;

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{role: "user", parts: [{text: prompt}]}],
        config: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          thinkingConfig: {thinkingBudget: 0},
        },
      });

      const finishReason = result.candidates?.[0]?.finishReason;
      if (finishReason === "MAX_TOKENS") {
        console.error(`[Gemini] Truncated output for "${name}" — raise maxOutputTokens`);
        return null;
      }

      const text = result.text;
      if (!text) {
        console.error(`[Gemini] Empty response for "${name}" (finishReason: ${finishReason})`);
        return null;
      }

      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      return validateAnalysis(JSON.parse(cleaned));
    } catch (err) {
      const status = err?.status;
      const transient = status === 429 || status === 503 || status === 500;
      if (transient && attempt < maxAttempts) {
        const backoff = 1000 * 2 ** (attempt - 1) + Math.random() * 500;
        console.warn(`[Gemini] Transient error for "${name}" (attempt ${attempt}), retrying in ${Math.round(backoff)}ms`);
        await sleep(backoff);
        continue;
      }
      console.error(`[Gemini] Analysis failed for "${name}":`, err.message);
      return null;
    }
  }
  return null;
}

async function main() {
  console.log("=== Bulk NLP Processing (Vertex AI, no grounding) ===\n");

  const snapshot = await db.collection("restaurants")
      .where("nlp_processed", "==", false)
      .limit(MAX_PER_RUN)
      .get();

  if (snapshot.empty) {
    console.log("No unprocessed restaurants. Done!");
    process.exit(0);
  }

  const total = snapshot.size;
  console.log(`Found ${total} restaurants to process`);
  console.log(`Delay: ${DELAY_MS}ms between requests (free tier rate limit)`);
  console.log(`Estimated time: ~${Math.round(total * DELAY_MS / 60000)} minutes\n`);

  let processed = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const doc of snapshot.docs) {
    const restaurant = doc.data();
    const idx = processed + errors + 1;

    try {
      process.stdout.write(`[${idx}/${total}] ${restaurant.name}... `);

      const geminiResult = await analyzeWithGemini(restaurant);

      if (!geminiResult) {
        await doc.ref.update({
          nlp_error: true,
          nlp_error_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log("FAILED (null result)");
        errors++;
        await new Promise((r) => setTimeout(r, DELAY_MS));
        continue;
      }

      const existingConfidences = restaurant.confidence_scores || {};

      const newConfidenceScores = {};
      const newMoodTags = [];

      for (const tag of MOOD_TAGS) {
        const weighted = calculateWeightedConfidence(tag, {
          nlpScores: geminiResult.scores,
          validateData: existingConfidences,
        });
        if (weighted !== null) {
          newConfidenceScores[tag] = weighted;
          if (weighted >= 40) newMoodTags.push(tag);
        }
      }

      await doc.ref.update({
        mood_tags: newMoodTags,
        confidence_scores: newConfidenceScores,
        nlp_scores: geminiResult.scores || {},
        nlp_metrics: geminiResult.metrics || {},
        nlp_insights: geminiResult.insights || {},
        nlp_processed: true,
        nlp_processed_at: admin.firestore.FieldValue.serverTimestamp(),
        nlp_review_count: geminiResult.review_count || 0,
        nlp_review_sources: geminiResult.review_sources || [],
        nlp_top_keywords: geminiResult.top_keywords || [],
        nlp_confidence_level: geminiResult.confidence || "low",
      });

      console.log(`OK [${newMoodTags.join(", ")}]`);
      processed++;
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      errors++;

      await doc.ref.update({
        nlp_error: true,
        nlp_error_message: err.message,
        nlp_error_at: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const elapsed = Math.round((Date.now() - startTime) / 60000);

  console.log("\n=== DONE ===");
  console.log(`Processed: ${processed}`);
  console.log(`Errors:    ${errors}`);
  console.log(`Time:      ${elapsed} minutes`);

  // Check remaining
  const remaining = await db.collection("restaurants")
      .where("nlp_processed", "==", false)
      .count()
      .get();
  console.log(`Remaining: ${remaining.data().count}`);

  if (remaining.data().count > 0) {
    console.log("\nRun this script again to process the next batch.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
