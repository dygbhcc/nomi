const admin = require("firebase-admin");
const XLSX = require("xlsx");
const path = require("path");

const serviceAccount = require("/Users/duygubahceci/Downloads/nomi-mvp-firebase-adminsdk-fbsvc-8247614e37.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "nomi-mvp",
});
const db = admin.firestore();

async function main() {
  console.log("Fetching all restaurants from Firestore...");
  const snapshot = await db.collection("restaurants").get();
  console.log(`Found ${snapshot.size} restaurants`);

  const rows = [];
  snapshot.docs.forEach((doc) => {
    const d = doc.data();
    rows.push({
      place_id: d.place_id || "",
      name: d.name || "",
      address: d.address || "",
      neighborhood: d.neighborhood || "",
      lat: d.location?.lat || 0,
      lng: d.location?.lng || 0,
      google_rating: d.google_rating || 0,
      review_count: d.review_count || 0,
      budget_level: d.budget_level ?? "",
      business_status: d.business_status || "",
      phone: d.phone || "",
      website: d.website || "",
      noise_level: d.noise_level || "",
      is_local_concept: d.is_local_concept ? "YES" : "NO",
      is_open_monday: d.opening_hours?.is_open_monday ? "YES" : "NO",
      mood_tags: (d.mood_tags || []).join(", "),
      nlp_processed: d.nlp_processed ? "YES" : "NO",
      has_manual_scoring: d.has_manual_scoring ? "YES" : "NO",
      has_pmo_scoring: d.has_pmo_scoring ? "YES" : "NO",
      is_pmo_verified: d.is_pmo_verified ? "YES" : "NO",
      mood_score_romantic: d.nlp_scores?.romantic ?? d.mood_scores?.romantic ?? "",
      mood_score_energetic: d.nlp_scores?.energetic ?? d.mood_scores?.energetic ?? "",
      mood_score_chill: d.nlp_scores?.chill ?? d.mood_scores?.chill ?? "",
      mood_score_explorer: d.nlp_scores?.explorer ?? d.mood_scores?.explorer ?? "",
      mood_score_focus: d.nlp_scores?.focus ?? d.mood_scores?.focus ?? "",
      mood_score_retreat: d.nlp_scores?.retreat ?? d.mood_scores?.retreat ?? "",
      mood_score_hungry_quick: d.nlp_scores?.hungry_quick ?? d.mood_scores?.hungry_quick ?? "",
      mood_score_celebrating: d.nlp_scores?.celebrating ?? d.mood_scores?.celebrating ?? "",
      photo_count: (d.photos || []).length,
    });
  });

  // Sort by name
  rows.sort((a, b) => a.name.localeCompare(b.name));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Restaurants");

  const outputPath = path.join(__dirname, `all_restaurants_${new Date().toISOString().slice(0, 10)}.xlsx`);
  XLSX.writeFile(wb, outputPath);
  console.log(`Excel exported: ${outputPath}`);
  console.log(`Total: ${rows.length} restaurants`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
