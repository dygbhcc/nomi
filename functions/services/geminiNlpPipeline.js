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
const MOOD_TAGS = ["romantic", "energetic", "chill", "explorer", "focus", "retreat", "hungry_quick", "celebrating"];

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

  const prompt = `You are a restaurant mood classifier for Nomi, a restaurant discovery app in Lisbon, Portugal.

Restaurant details:
- Name: ${name}
- Address: ${address || "Lisbon, Portugal"}
- Google Place ID: ${placeId || "unknown"}

Based on your knowledge of this restaurant, its location, cuisine type, and typical atmosphere in Lisbon, score it for each mood from 0.0 to 1.0:

- romantic: Intimate atmosphere, dim lights, date night, couples
- energetic: Loud, buzzing, lively crowd, high energy, fun
- chill: Relaxed, no rush, laid-back, warm atmosphere
- explorer: Unique, hidden gem, unusual menu, off the beaten path
- focus: Quiet, calm, good for work or study, minimal distractions
- retreat: Peaceful, slow pace, sanctuary feel, recharge
- hungry_quick: Fast service, filling food, efficient, no wait
- celebrating: Special occasions, group celebrations, festive, birthdays

Rules:
- Score 0.0 if you have no information or it clearly does not apply
- Score above 0.5 only if you are reasonably confident
- A restaurant can score high on multiple moods
- If you do not recognize the restaurant, score based on its name, address, and neighborhood context

Return ONLY valid JSON, no markdown, no explanation:
{
  "scores": {
    "romantic": 0.0,
    "energetic": 0.0,
    "chill": 0.0,
    "explorer": 0.0,
    "focus": 0.0,
    "retreat": 0.0,
    "hungry_quick": 0.0,
    "celebrating": 0.0
  },
  "review_count": 0,
  "review_sources": [],
  "top_keywords": [],
  "confidence": "low"
}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{role: "user", parts: [{text: prompt}]}],
      config: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        thinkingConfig: {thinkingBudget: 0},
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

      // Existing confidence scores (from human validation) and PMO scores (from Excel import)
      const existingConfidences = restaurant.confidence_scores || {};
      const pmoScores = restaurant.pmo_scores || {};

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
          if (weighted >= 50) newMoodTags.push(tag);
        }
      }

      await doc.ref.update({
        mood_tags: newMoodTags,
        confidence_scores: newConfidenceScores,
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
