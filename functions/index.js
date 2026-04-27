const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {nearbySearch, placeDetails} = require("./services/googlePlacesService");
const lisbonNeighborhoods = require("./config/lisbonNeighborhoods");

admin.initializeApp();
const db = admin.firestore();

const CACHE_TTL_DAYS = 30;
const MAX_RESULTS_DEFAULT = 40;

function normalizeRegionKey(lat, lng, radius) {
  const latBucket = Number(lat).toFixed(3);
  const lngBucket = Number(lng).toFixed(3);
  return `${latBucket}_${lngBucket}_${radius}`;
}

function isOpenMonday(openingHours) {
  if (!openingHours || !Array.isArray(openingHours.weekday_text)) {
    return false;
  }

  const mondayEntry = openingHours.weekday_text.find((item) =>
    item.toLowerCase().startsWith("monday"),
  );

  if (!mondayEntry) {
    return false;
  }

  return !mondayEntry.toLowerCase().includes("closed");
}

function buildRestaurantDocument(place) {
  return {
    place_id: place.place_id || "",
    name: place.name || "",
    address: place.formatted_address || "",
    location: {
      lat: place.geometry?.location?.lat || 0,
      lng: place.geometry?.location?.lng || 0,
    },
    budget_level: Number.isInteger(place.price_level) ? place.price_level : 1,
    mood_tags: [],
    confidence_scores: {},
    opening_hours: {
      is_open_monday: isOpenMonday(place.opening_hours),
      periods: place.opening_hours?.periods || [],
    },
    noise_level: "unknown",
    phone: place.formatted_phone_number || "",
    website: place.website || "",
    google_rating: place.rating || 0,
    photos: (place.photos || []).map((photo) => ({
      photo_reference: photo.photo_reference || "",
      width: photo.width || 0,
      height: photo.height || 0,
    })),
    cache_date: admin.firestore.FieldValue.serverTimestamp(),
    is_local_concept: false,
  };
}

async function readRegionCache(regionKey) {
  const regionRef = db.collection("cache_regions").doc(regionKey);
  const regionSnap = await regionRef.get();

  if (!regionSnap.exists) {
    return null;
  }

  const data = regionSnap.data();
  const cachedAt = data.cached_at?.toDate ? data.cached_at.toDate() : null;
  if (!cachedAt) {
    return null;
  }

  const ageMs = Date.now() - cachedAt.getTime();
  const maxAgeMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  if (ageMs > maxAgeMs) {
    return null;
  }

  const restaurantIds = data.restaurant_ids || [];
  if (!restaurantIds.length) {
    return [];
  }

  const docs = await Promise.all(
      restaurantIds.map((id) => db.collection("restaurants").doc(id).get()),
  );

  return docs.filter((doc) => doc.exists).map((doc) => ({id: doc.id, ...doc.data()}));
}

async function writeRegionCache(regionKey, restaurants) {
  const regionRef = db.collection("cache_regions").doc(regionKey);
  const batch = db.batch();
  const restaurantIds = [];

  restaurants.forEach((restaurant) => {
    const docId = restaurant.place_id;
    restaurantIds.push(docId);
    batch.set(db.collection("restaurants").doc(docId), restaurant, {merge: true});
  });

  batch.set(
      regionRef,
      {
        restaurant_ids: restaurantIds,
        cached_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
  );

  await batch.commit();
}

async function fetchAndCacheByCoordinates({lat, lng, radius = 800, maxResults = MAX_RESULTS_DEFAULT}) {
  const latNumber = Number(lat);
  const lngNumber = Number(lng);
  const radiusNumber = Number(radius);
  const maxResultsNumber = Number(maxResults);

  if (!Number.isFinite(latNumber) || !Number.isFinite(lngNumber)) {
    throw new HttpsError("invalid-argument", "lat and lng are required");
  }

  const regionKey = normalizeRegionKey(latNumber, lngNumber, radiusNumber);
  const cachedRestaurants = await readRegionCache(regionKey);
  if (cachedRestaurants) {
    return {source: "cache", count: cachedRestaurants.length, restaurants: cachedRestaurants};
  }

  const nearby = await nearbySearch({
    lat: latNumber,
    lng: lngNumber,
    radius: radiusNumber,
    type: "restaurant",
  });
  const selected = nearby.slice(0, maxResultsNumber);

  const detailedPlaces = await Promise.all(
      selected.map(async (item) => {
        try {
          return await placeDetails(item.place_id);
        } catch (error) {
          logger.warn("Place details fetch failed", {
            placeId: item.place_id,
            error: error.message,
          });
          return null;
        }
      }),
  );

  const restaurants = detailedPlaces
      .filter(Boolean)
      .map((place) => buildRestaurantDocument(place))
      .filter((restaurant) => restaurant.place_id);

  await writeRegionCache(regionKey, restaurants);

  return {
    source: "google_places",
    count: restaurants.length,
    restaurants,
  };
}

exports.fetchAndCacheRestaurants = onCall({region: "europe-west1"}, async (request) => {
  const data = request.data || {};
  return fetchAndCacheByCoordinates({
    lat: data.lat,
    lng: data.lng,
    radius: data.radius || 800,
    maxResults: data.maxResults || MAX_RESULTS_DEFAULT,
  });
});

exports.warmupLisbonRestaurants = onCall({region: "europe-west1"}, async () => {
  const results = [];
  for (const neighborhood of lisbonNeighborhoods) {
    const response = await fetchAndCacheByCoordinates({
      lat: neighborhood.lat,
      lng: neighborhood.lng,
      radius: neighborhood.radius,
      maxResults: 40,
    });
    results.push({
      neighborhood: neighborhood.name,
      source: response.source,
      count: response.count,
    });
  }

  return {
    totalNeighborhoods: lisbonNeighborhoods.length,
    results,
  };
});
