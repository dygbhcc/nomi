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
const lisbonAndSurroundings = [
  // ── Lisbon Central ─────────────────────────────────────
  {name: "Chiado",              lat: 38.7102, lng: -9.1404, radius: 800,  zone: "lisbon_central"},
  {name: "Alfama",              lat: 38.7139, lng: -9.1334, radius: 800,  zone: "lisbon_central"},
  {name: "Bairro Alto",         lat: 38.7138, lng: -9.1450, radius: 800,  zone: "lisbon_central"},
  {name: "Mouraria",            lat: 38.7162, lng: -9.1347, radius: 800,  zone: "lisbon_central"},
  {name: "Príncipe Real",       lat: 38.7157, lng: -9.1487, radius: 800,  zone: "lisbon_central"},
  {name: "Graça",               lat: 38.7185, lng: -9.1310, radius: 800,  zone: "lisbon_central"},
  {name: "Santos",              lat: 38.7065, lng: -9.1530, radius: 800,  zone: "lisbon_central"},
  {name: "Estrela",             lat: 38.7135, lng: -9.1590, radius: 800,  zone: "lisbon_central"},
  {name: "Cais do Sodré",       lat: 38.7065, lng: -9.1440, radius: 600,  zone: "lisbon_central"},
  {name: "Baixa",               lat: 38.7110, lng: -9.1370, radius: 600,  zone: "lisbon_central"},
  {name: "Avenida da Liberdade",lat: 38.7200, lng: -9.1460, radius: 600,  zone: "lisbon_central"},
  {name: "Campo de Ourique",    lat: 38.7180, lng: -9.1680, radius: 800,  zone: "lisbon_central"},
  {name: "Alcântara",           lat: 38.7050, lng: -9.1750, radius: 800,  zone: "lisbon_central"},
  {name: "Belém",               lat: 38.6970, lng: -9.2060, radius: 1000, zone: "lisbon_central"},
  {name: "Intendente",          lat: 38.7195, lng: -9.1370, radius: 600,  zone: "lisbon_central"},
  {name: "Anjos",               lat: 38.7240, lng: -9.1370, radius: 600,  zone: "lisbon_central"},
  {name: "Lapa",                lat: 38.7100, lng: -9.1600, radius: 600,  zone: "lisbon_central"},
  {name: "Madragoa",            lat: 38.7080, lng: -9.1560, radius: 600,  zone: "lisbon_central"},
  {name: "Parque das Nações",   lat: 38.7630, lng: -9.0940, radius: 1000, zone: "lisbon_central"},
  {name: "Avenidas Novas",      lat: 38.7350, lng: -9.1470, radius: 800,  zone: "lisbon_central"},

  // ── LİZBON KUZEY & DOĞU ──────────────────────────────────────
  {name: "Benfica",             lat: 38.7450, lng: -9.1970, radius: 800,  zone: "lisbon_north"},
  {name: "Alvalade",            lat: 38.7470, lng: -9.1430, radius: 800,  zone: "lisbon_north"},
  {name: "Telheiras",           lat: 38.7590, lng: -9.1640, radius: 800,  zone: "lisbon_north"},
  {name: "Odivelas",            lat: 38.7960, lng: -9.1800, radius: 1000, zone: "lisbon_north"},
  {name: "Loures",              lat: 38.8310, lng: -9.1680, radius: 1000, zone: "lisbon_north"},
  {name: "Lumiar",              lat: 38.7680, lng: -9.1570, radius: 800,  zone: "lisbon_north"},
  {name: "Carnide",             lat: 38.7650, lng: -9.2020, radius: 800,  zone: "lisbon_north"},
  {name: "Amadora",             lat: 38.7540, lng: -9.2290, radius: 1000, zone: "lisbon_north"},

  // ── South Bank (Setúbal Peninsula) ───────────────────
  {name: "Almada",              lat: 38.6796, lng: -9.1574, radius: 1000, zone: "south_bank"},
  {name: "Cacilhas",            lat: 38.6825, lng: -9.1547, radius: 600,  zone: "south_bank"},
  {name: "Costa da Caparica",   lat: 38.6427, lng: -9.2350, radius: 1200, zone: "south_bank"},
  {name: "Barreiro",            lat: 38.6629, lng: -9.0720, radius: 1000, zone: "south_bank"},
  {name: "Setúbal",             lat: 38.5244, lng: -8.8882, radius: 1200, zone: "south_bank"},

  // ── ESTORIL  ──────────────────────────
  {name: "Belém — Torre",       lat: 38.6920, lng: -9.2160, radius: 800,  zone: "estoril_line"},
  {name: "Algés",               lat: 38.7005, lng: -9.2280, radius: 800,  zone: "estoril_line"},
  {name: "Dafundo",             lat: 38.7010, lng: -9.2400, radius: 600,  zone: "estoril_line"},
  {name: "Cruz Quebrada",       lat: 38.7010, lng: -9.2540, radius: 600,  zone: "estoril_line"},
  {name: "Oeiras",              lat: 38.6965, lng: -9.3049, radius: 1000, zone: "estoril_line"},
  {name: "Paço de Arcos",       lat: 38.6938, lng: -9.3028, radius: 800,  zone: "estoril_line"},
  {name: "Caxias",              lat: 38.7033, lng: -9.3150, radius: 600,  zone: "estoril_line"},

  // ── CASCAIS ───────────────────────────────────────────────────
  {name: "Cascais Centro",      lat: 38.6969, lng: -9.4214, radius: 1000, zone: "cascais"},
  {name: "Cascais Beira Mar",   lat: 38.6939, lng: -9.4184, radius: 600,  zone: "cascais"},
  {name: "Monte Estoril",       lat: 38.7039, lng: -9.3980, radius: 800,  zone: "cascais"},
  {name: "Estoril",             lat: 38.7073, lng: -9.3939, radius: 800,  zone: "cascais"},
  {name: "São João do Estoril", lat: 38.7085, lng: -9.3760, radius: 600,  zone: "cascais"},
  {name: "Birre",               lat: 38.7210, lng: -9.4090, radius: 800,  zone: "cascais"},
  {name: "Alcabideche",         lat: 38.7330, lng: -9.4270, radius: 800,  zone: "cascais"},
  {name: "Guincho",             lat: 38.7280, lng: -9.4720, radius: 600,  zone: "cascais"},
  // Cascais
  {name: "Cascais Quinta",      lat: 38.7050, lng: -9.4500, radius: 1000, zone: "cascais"},

  // ── SINTRA ────────────────────────────────────────────────────
  {name: "Sintra Centro",       lat: 38.7974, lng: -9.3869, radius: 1000, zone: "sintra"},
  {name: "Sintra Vila",         lat: 38.7958, lng: -9.3908, radius: 600,  zone: "sintra"},
  {name: "Colares",             lat: 38.7965, lng: -9.4550, radius: 800,  zone: "sintra"},
  {name: "Praia das Maçãs",     lat: 38.8270, lng: -9.4750, radius: 600,  zone: "sintra"},
  {name: "Azenhas do Mar",      lat: 38.8374, lng: -9.4690, radius: 400,  zone: "sintra"},
  {name: "Ericeira",            lat: 38.9620, lng: -9.4160, radius: 1000, zone: "sintra"},
  {name: "Mafra",               lat: 38.9350, lng: -9.3270, radius: 1000, zone: "sintra"},
  {name: "Rio de Mouro",        lat: 38.7740, lng: -9.3300, radius: 800,  zone: "sintra"},
  {name: "Agualva-Cacém",       lat: 38.7650, lng: -9.2970, radius: 1000, zone: "sintra"},

  // ── SETÚBAL ────────────────────────────────
  {name: "Sesimbra",            lat: 38.4440, lng: -9.1020, radius: 1000, zone: "setubal"},
  {name: "Palmela",             lat: 38.5707, lng: -8.9020, radius: 800,  zone: "setubal"},
  {name: "Azeitão",             lat: 38.5280, lng: -8.9750, radius: 800,  zone: "setubal"},
];

// ── ZONE TANIMLARI ─────────────────────────────────────────────
const ZONES = {
  lisbon_central: {
    label:       "Lisbon Central",
    emoji:       "🏙",
    priority:    1,           // MVP önce burası
    max_results: 40,          // Places API sonuç limiti
    seed_target: 100,         // başlangıç restoran hedefi
  },
  lisbon_north: {
    label:       "Lisbon North",
    emoji:       "🏘",
    priority:    2,
    max_results: 30,
    seed_target: 40,
  },
  estoril_line: {
    label:       "Estoril Line",
    emoji:       "🚂",
    priority:    3,
    max_results: 20,
    seed_target: 30,
  },
  cascais: {
    label:       "Cascais",
    emoji:       "⛵",
    priority:    4,
    max_results: 30,
    seed_target: 50,
  },
  sintra: {
    label:       "Sintra",
    emoji:       "🏰",
    priority:    5,
    max_results: 25,
    seed_target: 40,
  },
  south_bank: {
    label:       "Margem Sul",
    emoji:       "🌉",
    priority:    6,
    max_results: 20,
    seed_target: 30,
  },
  setubal: {
    label:       "Setúbal & Sesimbra",
    emoji:       "🏖",
    priority:    7,
    max_results: 20,
    seed_target: 30,
  },
};

// ── Helper Functions ──────────────────────────────────────

//  only specific zone's neighborhoods
const getByZone = (zone) =>
  lisbonAndSurroundings.filter(n => n.zone === zone);

// for mvp, we focus on Lisbon Central first
const MVP_NEIGHBORHOODS = getByZone("lisbon_central");

// proritiesed neighborhood list (MVP zone first, then others by defined priority)
const SORTED_NEIGHBORHOODS = [...lisbonAndSurroundings]
  .sort((a, b) => {
    const pa = ZONES[a.zone]?.priority ?? 99;
    const pb = ZONES[b.zone]?.priority ?? 99;
    return pa - pb;
  });


const toPlacesQuery = (neighborhood) => ({
  location:  `${neighborhood.lat},${neighborhood.lng}`,
  radius:    neighborhood.radius,
  type:      "restaurant",
  zone:      neighborhood.zone,
  zone_label: ZONES[neighborhood.zone]?.label,
});

module.exports = {
  lisbonAndSurroundings,
  ZONES,
  MVP_NEIGHBORHOODS,
  SORTED_NEIGHBORHOODS,
  getByZone,
  toPlacesQuery,
};
const MOOD_OPTIONS = [
  "romantic",
  "energetic", 
  "chill",
  "explorer",
  "focus",
  "retreat",
  "hungry_quick",   
  "celebrating",
  "tasca",
  "fado",
  "petiscos",
  "miradouro",
  "marisqueira",
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

  for (const neighborhood of lisbonAndSurroundings) {
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
