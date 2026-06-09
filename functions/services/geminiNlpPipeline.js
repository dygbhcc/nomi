/**
 * Nomi — Gemini NLP Pipeline
 *
 * Runs nightly. Fetches restaurants with nlp_processed:false from Firestore,
 * analyzes them via Gemini 2.5 Flash using internal knowledge,
 * computes weighted confidence scores, and writes results back to Firestore.
 *
 * Weight system: NLP(0.55) > validate(0.30) > swipe(0.15) [normalized to 1.0]
 * Batch: 50 restaurants/day (free tier)
 *
 * Set DRY_RUN=true to run Gemini analysis without writing to Firestore.
 * Useful for validating prompts and output quality before committing results.
 */

const {GoogleGenAI} = require("@google/genai");
const admin = require("firebase-admin");

const DRY_RUN = process.env.DRY_RUN === "true";

// Nomi canonical mood tags
const MOOD_TAGS = ["romantic", "energetic", "chill", "explorer", "focus", "hungry_quick"];

// PMO signal removed June 2026 — weights renormalized (NLP-heavy, Option A)
const WEIGHTS = {
  nlp: 0.55,
  validate: 0.30,
  swipe: 0.15,
};

/**
 * Maps Gemini NLP score (0-1) to confidence (0-100).
 * @param {number} score - NLP score between 0 and 1
 * @return {number} Confidence value
 */
function nlpToConfidence(score) {
  return Math.round(score * 100);
}

/**
 * Runs Gemini analysis for a single restaurant using internal knowledge.
 * @param {object} ai - GoogleGenAI client instance
 * @param {object} restaurant - Restaurant document from Firestore
 * @return {object|null} Parsed Gemini result or null on failure
 */
const MOOD_KEYS = ["romantic", "energetic", "chill", "explorer", "focus", "hungry_quick"];

// Clamp/normalize before the output reaches the confidence-scoring pipeline.
// This is the ONLY guarantee we have when grounding blocks responseSchema.
function validateAnalysis(data) {
  if (!data || typeof data !== "object" || !data.scores) return null;
  const scores = {};
  for (const key of MOOD_KEYS) {
    const raw = Number(data.scores[key]);
    scores[key] = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
  }
  return {...data, scores};
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeRestaurantWithGemini(ai, restaurant, localeKey = "pt") {
  const {name, address, place_id: placeId} = restaurant;

  const sentimentJson = restaurant.sentiment_breakdown ?
    JSON.stringify(restaurant.sentiment_breakdown) :
    "N/A";
  const moodSummary = restaurant.general_mood_summary || "N/A";

  const prompt = `You are a restaurant mood classifier for Nomi, a venue discovery app in Lisbon, Portugal.

# Input Data
- Name: ${name}
- Address: ${address || "Lisbon, Portugal"}
- Google Place ID: ${placeId || "unknown"}
- Quantitative sentiment: ${sentimentJson}
- Qualitative summary: ${moodSummary}

# Task
Search Google, TripAdvisor, RestaurantGuru, Zomato and TheFork for this venue and read the available reviews and photos. Combine what you find with any provided sentiment metadata to score each mood 0.0-1.0, map metrics, and extract insights. If sentiment metadata is "N/A", rely on the reviews you find.

# Mood Definitions
- romantic: Intimate, dim-lit spaces for couples and date nights. Quiet enough to talk closely; cozy, candlelit. NOT loud or crowded.
- energetic: Loud, buzzing venues with a high-energy crowd — party vibes, music, DJ sets, dancing, celebrations and big group nights. Includes bars, music venues and entertainment-forward spots, not only restaurants. The atmosphere is the main draw.
- chill: Relaxed, laid-back, no rush. Warm and welcoming, feels like eating at home. Good for unwinding with friends. NOT a work/study spot and NOT high-energy.
- explorer: Unique, off the beaten path. Hidden gems, unusual or unexpected menus, places most people don't know about.
- focus: Quiet and calm with minimal distractions — good wifi, good for working or studying solo. Functional rather than social.
- hungry_quick: Fast, efficient, filling. Counter service, quick lunch menus, grab-and-go; no wait, no reservation needed.

# Insight Rules
All insight fields are bilingual objects with "en" and "${localeKey}" keys. Summaries: 1-2 sentences max, direct. Keep local dish names unchanged across languages.

# Output Rules — CRITICAL
1. Your ENTIRE response must be a single valid JSON object. Start with { and end with }.
2. Do NOT write any text before or after the JSON. No explanations, no commentary, no markdown.
3. If you cannot find information about this restaurant, still return the JSON with 0.0 scores and empty arrays.
4. Score 0.0 for a mood ONLY if it clearly does not apply. A venue can score high on multiple moods.

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
          maxOutputTokens: 4096, // was 2048 — bilingual payload truncates and silently nulls
          thinkingConfig: {thinkingBudget: 0},
          tools: [{googleSearch: {}}],
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

      // Try to extract JSON object if Gemini prefixed with plain text
      let jsonStr = cleaned;
      if (!jsonStr.startsWith("{")) {
        const firstBrace = jsonStr.indexOf("{");
        const lastBrace = jsonStr.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        }
      }

      return validateAnalysis(JSON.parse(jsonStr));
    } catch (err) {
      const status = err?.status;
      const transient = status === 429 || status === 503 || status === 500;
      const isJsonError = err instanceof SyntaxError;
      const shouldRetry = (transient || isJsonError) && attempt < maxAttempts;
      if (shouldRetry) {
        const backoff = 1000 * 2 ** (attempt - 1) + Math.random() * 500;
        console.warn(`[Gemini] ${isJsonError ? "JSON parse" : "Transient"} error for "${name}" (attempt ${attempt}/${maxAttempts}), retrying in ${Math.round(backoff)}ms`);
        await sleep(backoff);
        continue;
      }
      console.error(`[Gemini] Analysis failed for "${name}":`, err.message);
      return null;
    }
  }
  return null;
}

/**
 * Computes weighted confidence for a single tag
 * using available signals (NLP, validate, swipe).
 * Missing signals are excluded from the weighted average.
 * @param {string} tag - Mood tag name
 * @param {object} signals - Object containing nlpScores, validateData, swipeData
 * @return {number|null} Weighted confidence score or null
 */
function calculateWeightedConfidence(tag, {nlpScores, validateData, swipeData}) {
  const signals = [];

  // NLP signal (Gemini output)
  if (nlpScores && nlpScores[tag] != null) {
    signals.push({weight: WEIGHTS.nlp, value: nlpToConfidence(nlpScores[tag])});
  }

  // Validate signal (existing confidence_scores from human votes)
  if (validateData && validateData[tag] != null) {
    signals.push({weight: WEIGHTS.validate, value: validateData[tag]});
  }

  // Swipe signal
  if (swipeData && swipeData[tag] != null) {
    signals.push({weight: WEIGHTS.swipe, value: swipeData[tag]});
  }

  if (signals.length === 0) return null;

  // Re-normalize across present signals only
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const weighted = signals.reduce((sum, s) => sum + s.value * (s.weight / totalWeight), 0);

  return Math.round(weighted);
}

/**
 * Main pipeline — fetches a batch from Firestore, runs Gemini, writes results.
 * @param {number} batchSize - Number of restaurants to process
 * @return {object} Result with processed and errors counts
 */
async function runGeminiNlpBatch(batchSize = 50) {
  const db = admin.firestore();
  const ai = new GoogleGenAI({
    vertexai: true,
    project: process.env.GCLOUD_PROJECT || "nomi-mvp",
    location: "us-central1",
  });

  console.log(`[Gemini Pipeline] Starting. Batch size: ${batchSize}${DRY_RUN ? " (DRY RUN)" : ""}`);

  const snapshot = await db.collection("restaurants")
      .where("nlp_processed", "==", false)
      .limit(batchSize)
      .get();

  if (snapshot.empty) {
    console.log("[Gemini Pipeline] No restaurants left to process.");
    return {processed: 0, errors: 0};
  }

  console.log(`[Gemini Pipeline] Processing ${snapshot.size} restaurants`);

  let processed = 0;
  let errors = 0;

  // Rate limit: 15 req/min -> 4 sec delay between requests
  const DELAY_MS = 4000;

  for (const doc of snapshot.docs) {
    const restaurant = doc.data();

    try {
      console.log(`[Gemini] Analyzing: ${restaurant.name}`);

      const geminiResult = await analyzeRestaurantWithGemini(ai, restaurant);

      if (!geminiResult) {
        if (!DRY_RUN) {
          await doc.ref.update({
            nlp_error: true,
            nlp_error_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        console.log(`[Gemini] FAIL ${restaurant.name}${DRY_RUN ? " (dry run, skip write)" : ""}`);
        errors++;
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        continue;
      }

      // Existing confidence scores (from human validation)
      const existingConfidences = restaurant.confidence_scores || {};

      const newConfidenceScores = {};
      const newMoodTags = [];

      for (const tag of MOOD_TAGS) {
        const weighted = calculateWeightedConfidence(tag, {
          nlpScores: geminiResult.scores,
          validateData: existingConfidences,
          swipeData: null,
        });

        if (weighted !== null) {
          newConfidenceScores[tag] = weighted;
          if (weighted >= 40) newMoodTags.push(tag);
        }
      }

      if (DRY_RUN) {
        console.log(`[Gemini] DRY RUN ${restaurant.name}: tags=[${newMoodTags.join(", ")}] scores=${JSON.stringify(newConfidenceScores)}`);
      } else {
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
        console.log(`[Gemini] OK ${restaurant.name}: tags=[${newMoodTags.join(", ")}]`);
      }
      processed++;
    } catch (err) {
      console.error(`[Gemini] Error processing "${restaurant.name}":`, err.message);
      errors++;

      if (!DRY_RUN) {
        await doc.ref.update({
          nlp_error: true,
          nlp_error_message: err.message,
          nlp_error_at: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {});
      }
    }

    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  if (!DRY_RUN) {
    await db.collection("pipeline_logs").add({
      type: "gemini_nlp",
      processed,
      errors,
      batch_size: batchSize,
      ran_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  console.log(`[Gemini Pipeline] Done.${DRY_RUN ? " (DRY RUN)" : ""} OK: ${processed}  Errors: ${errors}`);
  return {processed, errors, dryRun: DRY_RUN};
}

module.exports = {runGeminiNlpBatch};
