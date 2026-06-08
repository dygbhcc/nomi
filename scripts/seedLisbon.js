/* eslint-disable no-console */
const admin = require("firebase-admin");

const GOOGLE_PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RADIUS = 800;
const TYPE = "restaurant";
const MAX_RESULTS = 40;

const LISBON_REGIONS = [
  { name: "Chiado", lat: 38.7102, lng: -9.1404 },
  { name: "Alfama", lat: 38.7139, lng: -9.1334 },
  { name: "Bairro Alto", lat: 38.7138, lng: -9.145 },
  { name: "Mouraria", lat: 38.7162, lng: -9.1347 },
  { name: "Principe Real", lat: 38.7157, lng: -9.1487 }
];

function getRegionId(lat, lng, radius) {
  return `${Number(lat).toFixed(4)}_${Number(lng).toFixed(4)}_${Number(radius)}`;
}

function isOpenMonday(openingHours) {
  if (!openingHours || !Array.isArray(openingHours.periods)) {
    return false;
  }
  return openingHours.periods.some((period) => period?.open?.day === 1);
}

function buildConfidenceScores(moodTags) {
  return moodTags.reduce((acc, mood) => {
    acc[mood] = 60;
    return acc;
  }, {});
}

async function fetchNearbyPlaces(apiKey, lat, lng, radius, maxResults) {
  const url = `${GOOGLE_PLACES_BASE_URL}/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${TYPE}&key=${apiKey}`;
  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok || payload.status === "REQUEST_DENIED" || payload.status === "INVALID_REQUEST") {
    throw new Error(`Nearby Search failed: ${payload.status || response.statusText}`);
  }

  return (payload.results || []).slice(0, maxResults);
}

async function fetchPlaceDetails(apiKey, placeId) {
  const fields = [
    "place_id",
    "name",
    "formatted_address",
    "geometry",
    "opening_hours",
    "international_phone_number",
    "website",
    "rating",
    "price_level",
    "photos"
  ].join(",");
  const url = `${GOOGLE_PLACES_BASE_URL}/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${apiKey}`;
  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok || payload.status !== "OK") {
    throw new Error(`Place Details failed (${placeId}): ${payload.status || response.statusText}`);
  }

  return payload.result;
}

async function seedRegion(db, apiKey, region) {
  const { name, lat, lng } = region;
  const regionId = getRegionId(lat, lng, RADIUS);
  const cacheRef = db.collection("restaurant_cache_regions").doc(regionId);
  const cacheSnap = await cacheRef.get();

  if (cacheSnap.exists) {
    const cacheDate = cacheSnap.data()?.cache_date?.toDate?.();
    if (cacheDate && Date.now() - cacheDate.getTime() < THIRTY_DAYS_MS) {
      console.log(`${name}: fresh cache exists, skipping API call.`);
      return 0;
    }
  }

  const places = await fetchNearbyPlaces(apiKey, lat, lng, RADIUS, MAX_RESULTS);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  const ids = [];

  for (const place of places) {
    if (!place.place_id) {
      continue;
    }

    const details = await fetchPlaceDetails(apiKey, place.place_id);
    const location = details?.geometry?.location || place?.geometry?.location || {};
    const moodTags = [];

    const doc = {
      place_id: details.place_id,
      name: details.name || "",
      address: details.formatted_address || "",
      location: { lat: Number(location.lat || 0), lng: Number(location.lng || 0) },
      budget_level: Number.isInteger(details.price_level) ? details.price_level : 2,
      mood_tags: moodTags,
      confidence_scores: buildConfidenceScores(moodTags),
      opening_hours: {
        is_open_monday: isOpenMonday(details.opening_hours),
        periods: Array.isArray(details?.opening_hours?.periods) ? details.opening_hours.periods : []
      },
      noise_level: "unknown",
      phone: details.international_phone_number || "",
      website: details.website || "",
      google_rating: Number(details.rating || 0),
      photos: Array.isArray(details.photos) ? details.photos : [],
      cache_date: now,
      is_local_concept: false
    };

    const restaurantRef = db.collection("restaurants").doc(details.place_id);
    batch.set(restaurantRef, doc, { merge: true });
    ids.push(details.place_id);
  }

  batch.set(
    cacheRef,
    {
      center: { lat, lng },
      radius: RADIUS,
      type: TYPE,
      cache_date: now,
      restaurant_ids: ids
    },
    { merge: true }
  );

  await batch.commit();
  console.log(`${name}: ${ids.length} restaurants cached.`);
  return ids.length;
}

async function run() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is required.");
  }

  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const db = admin.firestore();
  let total = 0;

  for (const region of LISBON_REGIONS) {
    total += await seedRegion(db, apiKey, region);
  }

  console.log(`Seed completed. Total written/updated: ${total}`);
}

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
