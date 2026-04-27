/**
 * Fetches Lisbon restaurants from Google Places API, saves to Firestore,
 * and exports to Excel for manual tagging.
 *
 * Usage:
 *   node scripts/exporttoexcel.js           # use cached Firestore data if available
 *   node scripts/exporttoexcel.js --fresh    # force re-fetch from Google Places API
 */

const admin = require("firebase-admin");
const axios = require("axios");
const XLSX = require("xlsx");
const path = require("path");

const serviceAccount = require("/Users/duygubahceci/Downloads/nomi-mvp-firebase-adminsdk-fbsvc-8247614e37.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "nomi-mvp",
});
const db = admin.firestore();

const GOOGLE_PLACES_API_KEY = "AIzaSyDKrlkf5rUemQK46mj25RA3_ab0Z0UW_s8";
const PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place";

const lisbonNeighborhoods = [
  // Central
  {name: "Chiado", lat: 38.7102, lng: -9.1404, radius: 800},
  {name: "Alfama", lat: 38.7139, lng: -9.1334, radius: 800},
  {name: "Bairro Alto", lat: 38.7138, lng: -9.145, radius: 800},
  {name: "Mouraria", lat: 38.7162, lng: -9.1347, radius: 800},
  {name: "Principe Real", lat: 38.7157, lng: -9.1487, radius: 800},
  // Extended neighborhoods
  {name: "Graça", lat: 38.7185, lng: -9.1310, radius: 800},
  {name: "Santos", lat: 38.7065, lng: -9.1530, radius: 800},
  {name: "Estrela", lat: 38.7135, lng: -9.1590, radius: 800},
  {name: "Cais do Sodré", lat: 38.7065, lng: -9.1440, radius: 600},
  {name: "Baixa", lat: 38.7110, lng: -9.1370, radius: 600},
  {name: "Avenida da Liberdade", lat: 38.7200, lng: -9.1460, radius: 600},
  {name: "Campo de Ourique", lat: 38.7180, lng: -9.1680, radius: 800},
  {name: "Alcântara", lat: 38.7050, lng: -9.1750, radius: 800},
  {name: "Belém", lat: 38.6970, lng: -9.2060, radius: 1000},
  {name: "Intendente", lat: 38.7195, lng: -9.1370, radius: 600},
  {name: "Anjos", lat: 38.7240, lng: -9.1370, radius: 600},
  {name: "Lapa", lat: 38.7100, lng: -9.1600, radius: 600},
  {name: "Madragoa", lat: 38.7080, lng: -9.1560, radius: 600},
  {name: "Parque das Nações", lat: 38.7630, lng: -9.0940, radius: 1000},
  {name: "Avenidas Novas", lat: 38.7350, lng: -9.1470, radius: 800},
];

const MOOD_OPTIONS = [
  "romantic", "trendy", "cozy", "lively", "traditional",
  "family_friendly", "business", "casual", "fine_dining", "hipster",
];
const NOISE_OPTIONS = ["quiet", "moderate", "loud"];
const BUDGET_OPTIONS = ["1 (cheap)", "2 (moderate)", "3 (expensive)", "4 (very expensive)"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function nearbySearch({lat, lng, radius}) {
  const url = `${PLACES_BASE_URL}/nearbysearch/json`;
  let allResults = [];

  const response = await axios.get(url, {
    params: {location: `${lat},${lng}`, radius, type: "restaurant", key: GOOGLE_PLACES_API_KEY},
  });
  allResults = allResults.concat(response.data.results || []);

  // Paginate through next pages (max 2 extra pages = up to 60 results)
  let nextPageToken = response.data.next_page_token;
  let page = 1;
  while (nextPageToken && page < 3) {
    // Google requires a short delay before next_page_token becomes valid
    await sleep(2000);
    const nextResponse = await axios.get(url, {
      params: {pagetoken: nextPageToken, key: GOOGLE_PLACES_API_KEY},
    });
    allResults = allResults.concat(nextResponse.data.results || []);
    nextPageToken = nextResponse.data.next_page_token;
    page++;
  }

  return allResults;
}

async function placeDetails(placeId) {
  const url = `${PLACES_BASE_URL}/details/json`;
  const response = await axios.get(url, {
    params: {
      place_id: placeId,
      fields: "place_id,name,formatted_address,geometry,opening_hours,formatted_phone_number,website,rating,price_level,photos",
      key: GOOGLE_PLACES_API_KEY,
    },
  });
  return response.data.result || null;
}

function isOpenMonday(openingHours) {
  if (!openingHours || !Array.isArray(openingHours.weekday_text)) return false;
  const mondayEntry = openingHours.weekday_text.find((item) => item.toLowerCase().startsWith("monday"));
  if (!mondayEntry) return false;
  return !mondayEntry.toLowerCase().includes("closed");
}

function buildRestaurantDocument(place, neighborhood) {
  return {
    place_id: place.place_id || "",
    name: place.name || "",
    address: place.formatted_address || "",
    neighborhood: neighborhood || "",
    location: {
      lat: place.geometry?.location?.lat || 0,
      lng: place.geometry?.location?.lng || 0,
    },
    budget_level: Number.isInteger(place.price_level) ? place.price_level : null,
    mood_tags: [],
    confidence_scores: {},
    opening_hours: {
      is_open_monday: isOpenMonday(place.opening_hours),
      periods: place.opening_hours?.periods || [],
    },
    noise_level: "",
    phone: place.formatted_phone_number || "",
    website: place.website || "",
    google_rating: place.rating || 0,
    photos: (place.photos || []).map((photo) => ({
      photo_reference: photo.photo_reference || "",
      width: photo.width || 0,
      height: photo.height || 0,
    })),
    cache_date: admin.firestore.FieldValue.serverTimestamp(),
    is_local_concept: null,
  };
}

async function warmupAndFetch() {
  const allRestaurants = new Map();

  for (const neighborhood of lisbonNeighborhoods) {
    console.log(`Scanning ${neighborhood.name}...`);
    const nearby = await nearbySearch({
      lat: neighborhood.lat,
      lng: neighborhood.lng,
      radius: neighborhood.radius,
    });
    console.log(`  ${nearby.length} results found, fetching details...`);

    for (const item of nearby) {
      if (allRestaurants.has(item.place_id)) continue;
      try {
        const details = await placeDetails(item.place_id);
        if (details) {
          const doc = buildRestaurantDocument(details, neighborhood.name);
          allRestaurants.set(doc.place_id, doc);
        }
      } catch (err) {
        console.warn(`  Failed to fetch details: ${item.place_id} - ${err.message}`);
      }
    }
    console.log(`  Total unique restaurants: ${allRestaurants.size}`);
  }

  // Save to Firestore (batch limit is 500)
  console.log("\nSaving to Firestore...");
  const entries = Array.from(allRestaurants.entries());
  for (let i = 0; i < entries.length; i += 450) {
    const chunk = entries.slice(i, i + 450);
    const batch = db.batch();
    for (const [placeId, restaurant] of chunk) {
      batch.set(db.collection("restaurants").doc(placeId), restaurant, {merge: true});
    }
    await batch.commit();
    console.log(`  Batch ${Math.floor(i / 450) + 1}: ${chunk.length} restaurants saved.`);
  }
  console.log(`Total ${entries.length} restaurants saved to Firestore.`);

  return Array.from(allRestaurants.values());
}

function exportToExcel(restaurants) {
  const rows = restaurants
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .map((d) => ({
      place_id: d.place_id,
      name: d.name,
      neighborhood: d.neighborhood || "",
      address: d.address,
      lat: d.location?.lat || "",
      lng: d.location?.lng || "",
      google_rating: d.google_rating || "",
      budget_level: d.budget_level != null ? d.budget_level : "",
      phone: d.phone || "",
      website: d.website || "",
      is_open_monday: d.opening_hours?.is_open_monday ? "YES" : "NO",
      // Manual tagging fields
      mood_tag_1: "",
      mood_tag_2: "",
      mood_tag_3: "",
      mood_tag_4: "",
      mood_tag_5: "",
      mood_tag_6: "",
      mood_tag_7: "",
      mood_tag_8: "",
      noise_level: "",
      is_local_concept: "",
      notes: "",
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    {wch: 30}, // place_id
    {wch: 35}, // name
    {wch: 18}, // neighborhood
    {wch: 50}, // address
    {wch: 10}, // lat
    {wch: 10}, // lng
    {wch: 12}, // google_rating
    {wch: 12}, // budget_level
    {wch: 18}, // phone
    {wch: 40}, // website
    {wch: 14}, // is_open_monday
    {wch: 18}, // mood_tag_1
    {wch: 18}, // mood_tag_2
    {wch: 18}, // mood_tag_3
    {wch: 18}, // mood_tag_4
    {wch: 18}, // mood_tag_5
    {wch: 18}, // mood_tag_6
    {wch: 18}, // mood_tag_7
    {wch: 18}, // mood_tag_8
    {wch: 14}, // noise_level
    {wch: 16}, // is_local_concept
    {wch: 30}, // notes
  ];

  const legendRows = [
    {field: "mood_tag_1 / mood_tag_2 / mood_tag_3", valid_values: MOOD_OPTIONS.join(", ")},
    {field: "noise_level", valid_values: NOISE_OPTIONS.join(", ")},
    {field: "budget_level", valid_values: BUDGET_OPTIONS.join(", ")},
    {field: "is_local_concept", valid_values: "YES, NO"},
  ];
  const wsLegend = XLSX.utils.json_to_sheet(legendRows);
  wsLegend["!cols"] = [{wch: 35}, {wch: 80}];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Restaurants");
  XLSX.utils.book_append_sheet(wb, wsLegend, "Legend");

  const outputPath = path.join(__dirname, "lisbon_restaurants.xlsx");
  XLSX.writeFile(wb, outputPath);
  console.log(`\nExcel file created: ${outputPath}`);
  console.log(`Total ${rows.length} restaurants.`);
}

async function main() {
  const forceFresh = process.argv.includes("--fresh");
  const snapshot = await db.collection("restaurants").get();

  let restaurants;
  if (snapshot.empty || forceFresh) {
    console.log(forceFresh ? "Fresh fetch requested..." : "Firestore empty, fetching from Google Places API...");
    restaurants = await warmupAndFetch();
  } else {
    console.log(`${snapshot.size} restaurants found in Firestore, exporting to Excel...`);
    restaurants = [];
    snapshot.forEach((doc) => restaurants.push({id: doc.id, ...doc.data()}));
  }

  exportToExcel(restaurants);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
