/* eslint-disable no-console */
const fs = require("fs/promises");
const path = require("path");
const admin = require("firebase-admin");

const REQUIRED_HEADERS = [
  "name",
  "place_id",
  "lat",
  "lng",
  "budget_level",
  "mood_tags",
  "is_open_monday",
  "noise_level",
  "is_local_concept"
];

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  return String(value).trim().toLowerCase() === "true";
}

function parseCsvLine(line) {
  // Minimal CSV parser that supports quoted fields and commas in quotes
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);

  return out.map((v) => v.trim());
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  REQUIRED_HEADERS.forEach((required) => {
    if (!headers.includes(required)) {
      throw new Error(`Missing required CSV header: ${required}`);
    }
  });

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    return row;
  });
}

function normalizeRestaurant(row) {
  const moodTags = String(row.mood_tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const confidenceScores = moodTags.reduce((acc, tag) => {
    acc[tag] = 60;
    return acc;
  }, {});

  return {
    place_id: String(row.place_id),
    name: String(row.name || ""),
    address: String(row.address || ""),
    location: {
      lat: Number(row.lat || 0),
      lng: Number(row.lng || 0)
    },
    budget_level: Number.parseInt(row.budget_level, 10) || 2,
    mood_tags: moodTags,
    confidence_scores: confidenceScores,
    opening_hours: {
      is_open_monday: parseBoolean(row.is_open_monday),
      periods: []
    },
    noise_level: String(row.noise_level || "unknown"),
    phone: String(row.phone || ""),
    website: String(row.website || ""),
    google_rating: Number(row.google_rating || 0),
    photos: [],
    cache_date: admin.firestore.FieldValue.serverTimestamp(),
    is_local_concept: parseBoolean(row.is_local_concept)
  };
}

async function readInput(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const raw = await fs.readFile(filePath, "utf8");

  if (ext === ".json") {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("JSON input must be an array.");
    }
    return parsed;
  }

  if (ext === ".csv") {
    return parseCsv(raw);
  }

  throw new Error("Unsupported input file format. Use .csv or .json.");
}

async function run() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: node scripts/import.js <path-to-restaurants.csv|json>");
  }

  if (!admin.apps.length) {
    admin.initializeApp();
  }
  const db = admin.firestore();

  const rows = await readInput(path.resolve(inputPath));
  if (rows.length === 0) {
    console.log("No rows found to import.");
    return;
  }

  let batch = db.batch();
  let opCount = 0;
  let importedCount = 0;

  for (const row of rows) {
    if (!row.place_id) {
      // Skip invalid rows without a stable identifier
      continue;
    }

    const data = normalizeRestaurant(row);
    const ref = db.collection("restaurants").doc(data.place_id);
    batch.set(ref, data, { merge: true });
    opCount += 1;
    importedCount += 1;

    if (opCount === 100) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  console.log(`Import completed. ${importedCount} restaurants written.`);
}

run().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
