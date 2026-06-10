/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { parse } = require("csv-parse/sync");
const admin = require("firebase-admin");
const { ALL_MOOD_TAGS } = require("../config/moodTags");

dotenv.config();

function getArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function validateEnv() {
  const required = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}

function initFirebaseAdmin() {
  validateEnv();
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
}

function parseInputFile(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  const raw = fs.readFileSync(inputPath, "utf8");

  if (ext === ".json") {
    return JSON.parse(raw);
  }

  if (ext === ".csv") {
    return parse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  }

  throw new Error("Unsupported input format. Use .csv or .json");
}

function splitMoodTags(moodTagsValue) {
  return String(moodTagsValue || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => ALL_MOOD_TAGS.includes(tag));
}

function buildConfidenceScores(tags) {
  const result = {};
  tags.forEach((tag) => {
    result[tag] = 60;
  });
  return result;
}

function mapRowToDocument(row) {
  const moodTags = splitMoodTags(row.mood_tags);
  return {
    place_id: String(row.place_id),
    name: String(row.name || ""),
    address: String(row.address || ""),
    location: {
      lat: Number(row.lat || 0),
      lng: Number(row.lng || 0)
    },
    budget_level: Number.parseInt(row.budget_level, 10) || 1,
    mood_tags: moodTags,
    confidence_scores: buildConfidenceScores(moodTags),
    opening_hours: {
      is_open_monday:
        String(row.is_open_monday || "")
          .trim()
          .toLowerCase() === "true",
      periods: []
    },
    noise_level: String(row.noise_level || "unknown"),
    phone: String(row.phone || ""),
    website: String(row.website || ""),
    google_rating: Number(row.google_rating || 0),
    photos: [],
    cache_date: admin.firestore.FieldValue.serverTimestamp(),
    is_local_concept:
      String(row.is_local_concept || "")
        .trim()
        .toLowerCase() === "true",
    nlp_processed: false,
  };
}

async function run() {
  const input = getArg("input");
  if (!input) {
    throw new Error("Usage: npm run import:restaurants -- --input=./data/restaurants.csv");
  }

  const inputPath = path.resolve(process.cwd(), input);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  initFirebaseAdmin();
  const db = admin.firestore();

  const rows = parseInputFile(inputPath);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Input file has no rows.");
  }

  const batch = db.batch();
  let imported = 0;

  rows.slice(0, 100).forEach((row) => {
    const doc = mapRowToDocument(row);
    if (!doc.place_id) {
      return;
    }
    const ref = db.collection("restaurants").doc(doc.place_id);
    batch.set(ref, doc, { merge: true });
    imported += 1;
  });

  await batch.commit();
  console.log(`Imported ${imported} restaurants.`);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
