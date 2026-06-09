/**
 * Migration script: Convert existing nlp_insights from flat strings/arrays
 * to bilingual { en: ..., pt: ... } format.
 *
 * Existing data is in Portuguese. This script:
 * 1. Moves current values under the "pt" key
 * 2. Calls Gemini to translate to English
 * 3. Writes back as { en: ..., pt: ... }
 *
 * Usage (run from functions/ directory):
 *   DRY_RUN=true node scripts/migrateNlpInsightsBilingual.js   # preview
 *   node scripts/migrateNlpInsightsBilingual.js                  # run
 */

require("dotenv").config();
const fs = require("fs");
const os = require("os");
const path = require("path");
const admin = require("firebase-admin");
const {GoogleGenAI} = require("@google/genai");

const DRY_RUN = process.env.DRY_RUN === "true";
const BATCH_SIZE = 400;
const DELAY_MS = 4000; // Gemini rate limit: 15 req/min

// Initialize with service account from env
const projectId = process.env.SERVICE_ACCOUNT_PROJECT_ID || "nomi-mvp";
const clientEmail = process.env.SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");

if (clientEmail && privateKey) {
  admin.initializeApp({
    credential: admin.credential.cert({projectId, clientEmail, privateKey}),
  });

  // Write temp service account JSON for Vertex AI / GoogleGenAI auth
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const tmpSaPath = path.join(os.tmpdir(), "nomi-sa-tmp.json");
    fs.writeFileSync(tmpSaPath, JSON.stringify({
      type: "service_account",
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    }));
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpSaPath;
  }
} else {
  admin.initializeApp({projectId});
}
const db = admin.firestore();

const ai = new GoogleGenAI({
  vertexai: true,
  project: projectId,
  location: "us-central1",
});

/**
 * Checks if insights are already in bilingual format.
 * @param {object} insights - The insights object to check
 * @return {boolean} True if already bilingual
 */
function isBilingual(insights) {
  if (!insights) return false;
  const summary = insights.general_summary;
  // If general_summary is an object with language keys, it's already migrated
  return summary && typeof summary === "object" && ("en" in summary || "pt" in summary);
}

/**
 * Calls Gemini to translate Portuguese insights to English.
 * @param {object} insights - The insights object to translate
 * @return {Promise<object|null>} Translated insights or null on failure
 */
async function translateToEnglish(insights) {
  const prompt = `Translate the following Portuguese restaurant review keywords and summary to English.
Keep local dish names that are universally known (like "bacalhau", "pastel de nata") unchanged.
Return ONLY a valid JSON object, no markdown, no explanation.

Input:
${JSON.stringify(insights, null, 2)}

Expected output format:
{
  "general_summary": "English translation of the summary",
  "food_admiration": ["english keyword 1", "english keyword 2"],
  "negative_aspects": ["english keyword 1", "english keyword 2"]
}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{role: "user", parts: [{text: prompt}]}],
      config: {
        temperature: 0.1,
        maxOutputTokens: 512,
        thinkingConfig: {thinkingBudget: 0},
      },
    });

    const cleaned = result.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("[Translate] Failed:", err.message);
    return null;
  }
}

async function main() {
  console.log(`[Migration] Starting bilingual NLP insights migration${DRY_RUN ? " (DRY RUN)" : ""}`);

  const snapshot = await db.collection("restaurants")
      .where("nlp_processed", "==", true)
      .get();

  console.log(`[Migration] Found ${snapshot.size} NLP-processed restaurants`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const insights = data.nlp_insights;

    // Skip if no insights or already bilingual
    if (!insights || isBilingual(insights)) {
      skipped++;
      continue;
    }

    // Current data is Portuguese — extract it
    const ptInsights = {
      general_summary: insights.general_summary || "",
      food_admiration: insights.food_admiration || [],
      negative_aspects: insights.negative_aspects || [],
    };

    // Skip if all fields are empty
    if (!ptInsights.general_summary && ptInsights.food_admiration.length === 0 && ptInsights.negative_aspects.length === 0) {
      skipped++;
      continue;
    }

    console.log(`[Migration] Translating: ${data.name}`);

    const enInsights = await translateToEnglish(ptInsights);

    if (!enInsights) {
      console.error(`[Migration] FAIL: ${data.name}`);
      errors++;
      await new Promise((r) => setTimeout(r, DELAY_MS));
      continue;
    }

    const bilingualInsights = {
      general_summary: {
        en: enInsights.general_summary || ptInsights.general_summary,
        pt: ptInsights.general_summary,
      },
      food_admiration: {
        en: enInsights.food_admiration || ptInsights.food_admiration,
        pt: ptInsights.food_admiration,
      },
      negative_aspects: {
        en: enInsights.negative_aspects || ptInsights.negative_aspects,
        pt: ptInsights.negative_aspects,
      },
    };

    if (DRY_RUN) {
      console.log(`[Migration] DRY RUN ${data.name}:`);
      console.log(`  PT: ${JSON.stringify(ptInsights)}`);
      console.log(`  EN: ${JSON.stringify(enInsights)}`);
    } else {
      batch.update(doc.ref, {nlp_insights: bilingualInsights});
      batchCount++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`[Migration] Committed batch: ${migrated + batchCount} migrated`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    migrated++;
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  // Commit remaining
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  console.log(`[Migration] Done.${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

main().catch(console.error);
