/**
 * Region-by-region restaurant coverage report, exported to Excel.
 *
 * Assigns every restaurant in Firestore to the nearest configured
 * neighborhood (functions/config/lisbonConfig.js) whose radius contains it,
 * then writes per-neighborhood and per-zone counts. Optionally marks
 * restaurants added since a snapshot taken with a before-snapshot JSON
 * ({docId: {...}} map) to highlight what a discovery run just added.
 *
 * Run from the repo root:
 *   node scripts/neighborhoodReport.js [--before /tmp/restaurants_before.json] [--out scripts/report.xlsx]
 */

require("dotenv").config({path: __dirname + "/../functions/.env"});
const admin = require("firebase-admin");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const {neighborhoods} = require("../functions/config/lisbonConfig");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.SERVICE_ACCOUNT_PROJECT_ID,
    clientEmail: process.env.SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = admin.firestore();

const ZONES = {
  "Cascais Centro": "Cascais", "Estoril": "Cascais", "Monte Estoril": "Cascais",
  "Sintra Centro": "Sintra",
  "Oeiras": "Oeiras",
  "Almada": "South Bank", "Barreiro": "South Bank",
  "Odivelas": "Greater Lisbon", "Amadora": "Greater Lisbon",
};
const zoneOf = (name) => ZONES[name] || "Lisbon";

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Nearest neighborhood whose radius (with a small margin, since Places
// returns results slightly beyond the search radius) contains the point.
function assignNeighborhood(lat, lng) {
  let best = null;
  let bestDist = Infinity;
  for (const n of neighborhoods) {
    const d = haversineMeters(lat, lng, n.lat, n.lng);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  if (best && bestDist <= best.radius * 1.5) {
    return {name: best.name, distance: Math.round(bestDist)};
  }
  return {name: "(outside all regions)", distance: Math.round(bestDist)};
}

function getArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

(async () => {
  const beforePath = getArg("--before", null);
  const outPath = getArg("--out", path.join(__dirname, "neighborhood_report.xlsx"));
  const before = beforePath ? JSON.parse(fs.readFileSync(beforePath, "utf8")) : null;

  const snap = await db.collection("restaurants")
      .select("name", "location", "google_rating", "nlp_processed")
      .get();
  console.log(`Read ${snap.size} restaurants.`);

  const stats = new Map();
  for (const n of neighborhoods) {
    stats.set(n.name, {zone: zoneOf(n.name), count: 0, newCount: 0, ratingSum: 0, rated: 0, nlpDone: 0});
  }
  stats.set("(outside all regions)", {zone: "-", count: 0, newCount: 0, ratingSum: 0, rated: 0, nlpDone: 0});

  const newRestaurants = [];
  snap.forEach((doc) => {
    const r = doc.data();
    const lat = r.location?.lat;
    const lng = r.location?.lng;
    const assigned = (typeof lat === "number" && typeof lng === "number" && lat !== 0) ?
      assignNeighborhood(lat, lng) : {name: "(outside all regions)", distance: null};
    const s = stats.get(assigned.name);
    s.count++;
    if (typeof r.google_rating === "number" && r.google_rating > 0) {
      s.ratingSum += r.google_rating;
      s.rated++;
    }
    if (r.nlp_processed === true) s.nlpDone++;
    if (before && !before[doc.id]) {
      s.newCount++;
      newRestaurants.push({
        Name: r.name || "",
        Neighborhood: assigned.name,
        Zone: s.zone,
        Rating: r.google_rating || "",
        DocId: doc.id,
      });
    }
  });

  const summaryRows = [];
  for (const [name, s] of stats) {
    summaryRows.push({
      Zone: s.zone,
      Neighborhood: name,
      Restaurants: s.count,
      ...(before ? {NewToday: s.newCount} : {}),
      AvgRating: s.rated ? Number((s.ratingSum / s.rated).toFixed(2)) : "",
      NlpProcessed: s.nlpDone,
    });
  }
  summaryRows.sort((a, b) => a.Zone.localeCompare(b.Zone) || b.Restaurants - a.Restaurants);

  const zoneAgg = new Map();
  for (const row of summaryRows) {
    const z = zoneAgg.get(row.Zone) || {Zone: row.Zone, Neighborhoods: 0, Restaurants: 0, NewToday: 0};
    z.Neighborhoods++;
    z.Restaurants += row.Restaurants;
    z.NewToday += row.NewToday || 0;
    zoneAgg.set(row.Zone, z);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Neighborhoods");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...zoneAgg.values()]), "Zones");
  if (newRestaurants.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(newRestaurants), "New Restaurants");
  }
  XLSX.writeFile(wb, outPath);
  console.log(`Report written: ${outPath}${before ? ` (new restaurants: ${newRestaurants.length})` : ""}`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
