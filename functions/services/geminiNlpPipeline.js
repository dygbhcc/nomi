/**
 * Nomi — Gemini NLP Pipeline
 *
 * Runs nightly. Fetches restaurants with nlp_processed:false from Firestore,
 * analyzes them via Gemini 2.5 Flash using internal knowledge,
 * computes weighted confidence scores, and writes results back to Firestore.
 *
 * Weight system: PMO(0.41) > NLP(0.32) > validate(0.18) > swipe(0.09) [normalized to 1.0]
 * PMO scale: 1-9 mapped to confidence 0-100
 * Batch: 50 restaurants/day (free tier)
 */

const {GoogleGenAI} = require("@google/genai");
const admin = require("firebase-admin");

// Nomi canonical mood tags
const MOOD_TAGS = ["romantic", "energetic", "chill", "explorer", "focus", "hungry_quick"];

// Normalized weights (sum = 1.0)
const WEIGHTS = {
  pmo: 0.41,
  nlp: 0.32,
  validate: 0.18,
  swipe: 0.09,
};

/**
 * Maps PMO score (1-9) to confidence (0-100).
 * @param {number} score - PMO score between 1 and 9
 * @return {number|null} Confidence value or null if invalid
 */
function pmoToConfidence(score) {
  if (!score || score < 1 || score > 9) return null;
  return Math.round(((score - 1) / 8) * 100);
}

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
async function analyzeRestaurantWithGemini(ai, restaurant) {
  const {name, address, place_id: placeId} = restaurant;

  const sentimentJson = restaurant.sentiment_breakdown ? JSON.stringify(restaurant.sentiment_breakdown) : "N/A";
  const moodSummary = restaurant.general_mood_summary || "N/A";

  const prompt = `You are a restaurant mood classifier for Nomi, a restaurant discovery app in Lisbon, Portugal.

# Input Data
## Restaurant Details
- Name: ${name}
- Address: ${address || "Lisbon, Portugal"}
- Google Place ID: ${placeId || "unknown"}

## Verified Customer Sentiment & Metadata (Context)
- Quantitative Data: ${sentimentJson}
- Qualitative Summary: ${moodSummary}

# Task
Search for this restaurant on Google, TripAdvisor, RestaurantGuru, Zomato, TheFork, and any other review platforms. Read at least 10-20 reviews if available. Also check Google Photos and Google Maps reviews for atmosphere clues.

Use the reviews you find combined with any provided sentiment metadata to:
1. Score the restaurant for each mood from 0.0 to 1.0
2. Map specific metrics from review data
3. Extract high-level qualitative insights

If the "Verified Customer Sentiment & Metadata" above is "N/A", rely entirely on the reviews you find via search. If sentiment data IS provided, use it as the primary source and supplement with search results.

# Mood Definitions & Scoring Criteria
- romantic: Intimate atmosphere, dim lights, date night, couples.
- energetic: Loud, buzzing, lively crowd, high energy, fun, busy traditional tasca environment.
- chill: Relaxed, no rush, laid-back, warm atmosphere, feels like eating at home.
- explorer: Unique, hidden gem, unusual menu, off the beaten path.
- focus: Quiet, calm, good for work or study, minimal distractions.
- hungry_quick: Fast service, filling food, efficient, good for quick lunch menus.

# Strict Constraints for "insights" Object
1. general_summary: Must be a highly concise summary of ONLY 1 or 2 sentences maximum. Keep it direct and punchy.
2. food_admiration: Array of short keywords representing praised dishes or food qualities (e.g., ["bochechas", "lagartos", "farófias", "migas", "cozido à portuguesa", "bacalhau"]).
3. negative_aspects: Array of short keywords representing weaknesses (e.g., ["estacionamento", "espera", "barulho", "preco"]).

# Strict Output Rules
1. Output MUST be a single, valid JSON object.
2. Do NOT include any markdown formatting (like json ... ), no pre-text, and no post-text. Return ONLY the raw JSON string.
3. Score 0.0 only if you truly have zero information. If you find any reviews or context, score accordingly.

# Expected Output Format
{
  "scores": {
    "romantic": 0.0,
    "energetic": 0.0,
    "chill": 0.0,
    "explorer": 0.0,
    "focus": 0.0,
    "hungry_quick": 0.0
  },
  "metrics": {
    "rating": 0.0,
    "rating_source": "String",
    "positive_comment_rate": 0,
    "most_frequent_emotion": "String",
    "primary_sentiment_nuances": ["String", "String"]
  },
  "insights": {
    "general_summary": "1-2 sentences maximum summary text.",
    "food_admiration": ["bochechas", "lagartos"],
    "negative_aspects": ["estacionamento", "espera"]
  },
  "review_count": 0,
  "review_sources": [],
  "top_keywords": [],
  "confidence": "low|medium|high"
}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{role: "user", parts: [{text: prompt}]}],
      config: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        thinkingConfig: {thinkingBudget: 0},
        tools: [{googleSearch: {}}],
      },
    });

    const response = result.text;

    // Strip markdown code fences Gemini sometimes adds
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error(`[Gemini] Analysis failed for "${name}":`, err.message);
    return null;
  }
}

/**
 * Computes weighted confidence for a single tag
 * using all available signals (PMO, NLP, validate, swipe).
 * Missing signals are excluded from the weighted average.
 * @param {string} tag - Mood tag name
 * @param {object} signals - Object containing pmoScores, nlpScores, validateData, swipeData
 * @return {number|null} Weighted confidence score or null
 */
function calculateWeightedConfidence(tag, {pmoScores, nlpScores, validateData, swipeData}) {
  const signals = [];

  // PMO signal
  if (pmoScores && pmoScores[tag] != null) {
    const conf = pmoToConfidence(pmoScores[tag]);
    if (conf !== null) signals.push({weight: WEIGHTS.pmo, value: conf});
  }

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
 * Fetches PMO scores from the pmo_scores collection for a given restaurant.
 * If multiple scorers exist, averages their scores per tag.
 * @param {object} db - Firestore instance
 * @param {string} restaurantId - Restaurant document ID
 * @return {object} Averaged PMO scores keyed by tag, or empty object
 */
async function fetchPmoScores(db, restaurantId) {
  const pmoSnapshot = await db.collection("pmo_scores")
      .where("restaurant_id", "==", restaurantId)
      .get();

  if (pmoSnapshot.empty) return {};

  // Accumulate scores per tag across all scorers
  const tagTotals = {};
  const tagCounts = {};

  for (const pmoDoc of pmoSnapshot.docs) {
    const scores = pmoDoc.data().scores || {};
    for (const tag of MOOD_TAGS) {
      if (scores[tag] != null && scores[tag] >= 1 && scores[tag] <= 9) {
        tagTotals[tag] = (tagTotals[tag] || 0) + scores[tag];
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }

  // Average
  const averaged = {};
  for (const tag of Object.keys(tagTotals)) {
    averaged[tag] = Math.round(tagTotals[tag] / tagCounts[tag]);
  }

  return averaged;
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
    project: "nomi-mvp",
    location: "us-central1",
  });

  console.log(`[Gemini Pipeline] Starting. Batch size: ${batchSize}`);

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
        await doc.ref.update({
          nlp_error: true,
          nlp_error_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        errors++;
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        continue;
      }

      // Existing confidence scores (from human validation)
      const existingConfidences = restaurant.confidence_scores || {};

      // Fetch PMO scores from separate collection (averaged if multiple scorers)
      const pmoScores = await fetchPmoScores(db, doc.id);

      const newConfidenceScores = {};
      const newMoodTags = [];

      for (const tag of MOOD_TAGS) {
        const weighted = calculateWeightedConfidence(tag, {
          pmoScores,
          nlpScores: geminiResult.scores,
          validateData: existingConfidences,
          swipeData: null,
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

      console.log(`[Gemini] OK ${restaurant.name}: tags=[${newMoodTags.join(", ")}]`);
      processed++;
    } catch (err) {
      console.error(`[Gemini] Error processing "${restaurant.name}":`, err.message);
      errors++;

      await doc.ref.update({
        nlp_error: true,
        nlp_error_message: err.message,
        nlp_error_at: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
    }

    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  await db.collection("pipeline_logs").add({
    type: "gemini_nlp",
    processed,
    errors,
    batch_size: batchSize,
    ran_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`[Gemini Pipeline] Done. OK: ${processed}  Errors: ${errors}`);
  return {processed, errors};
}

module.exports = {runGeminiNlpBatch};
