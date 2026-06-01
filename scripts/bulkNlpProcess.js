/**
 * Bulk NLP processing using Vertex AI (Blaze credits).
 * Processes all restaurants with nlp_processed == false.
 *
 * Vertex AI: 15 RPM for Gemini 2.5 Flash → 4 sec delay between requests.
 * Usage: node scripts/bulkNlpProcess.js
 */

const admin = require("../functions/node_modules/firebase-admin");
const {GoogleGenAI} = require("../functions/node_modules/@google/genai");

const serviceAccount = require("/Users/duygubahceci/Downloads/nomi-mvp-firebase-adminsdk-fbsvc-8247614e37.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "nomi-mvp",
});
const db = admin.firestore();

// Vertex AI (Blaze credits)
const ai = new GoogleGenAI({
  vertexai: true,
  project: "nomi-mvp",
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

async function analyzeWithGemini(restaurant) {
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
  const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

async function main() {
  console.log("=== Bulk NLP Processing (AI Studio Free Tier) ===\n");

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
