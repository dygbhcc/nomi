const axios = require("axios");
const admin = require("firebase-admin");
const {logger} = require("firebase-functions");

const PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place";
const CACHE_TTL_DAYS = 30;
const CACHE_COLLECTION = "places_cache";

function getApiKey() {
  const key = process.env.GOOGLE_PLACES_API_KEY || "";
  if (!key) {
    throw new Error("GOOGLE_PLACES_API_KEY is not set.");
  }
  return key;
}

function buildCacheKey(lat, lng, radius, type) {
  return `${Math.round(lat * 100) / 100}_${Math.round(lng * 100) / 100}_${radius}_${type}`;
}

function isCacheValid(cacheDoc) {
  if (!cacheDoc.exists) return false;
  const data = cacheDoc.data();
  if (!data.cache_date) return false;
  const cacheDate = data.cache_date.toDate();
  const ageMs = Date.now() - cacheDate.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays < CACHE_TTL_DAYS;
}

async function nearbySearch({lat, lng, radius, type = "restaurant", force = false}) {
  const db = admin.firestore();
  const cacheKey = buildCacheKey(lat, lng, radius, type);
  const cacheRef = db.collection(CACHE_COLLECTION).doc(cacheKey);

  if (force) {
    logger.info("[Places Cache] BYPASS (force):", cacheKey);
  } else {
    try {
      const cacheDoc = await cacheRef.get();
      if (isCacheValid(cacheDoc)) {
        logger.info("[Places Cache] HIT:", cacheKey);
        return cacheDoc.data().results;
      }
    } catch (err) {
      logger.warn("[Places Cache] Read error, falling through to API:", err.message);
    }

    logger.info("[Places Cache] MISS:", cacheKey);
  }

  const key = getApiKey();
  const url = `${PLACES_BASE_URL}/nearbysearch/json`;
  const response = await axios.get(url, {
    params: {
      location: `${lat},${lng}`,
      radius,
      type,
      key,
    },
  });
  const results = response.data.results || [];

  try {
    await cacheRef.set({
      results,
      cache_date: admin.firestore.FieldValue.serverTimestamp(),
      lat,
      lng,
      radius,
      type,
    });
  } catch (err) {
    logger.warn("[Places Cache] Write error:", err.message);
  }

  return results;
}

async function placeDetails(placeId) {
  const key = getApiKey();
  const url = `${PLACES_BASE_URL}/details/json`;
  const response = await axios.get(url, {
    params: {
      place_id: placeId,
      fields:
        "place_id,name,formatted_address,geometry,opening_hours,formatted_phone_number,website,rating,price_level,photos,user_ratings_total,business_status",
      key,
    },
  });
  return response.data.result || null;
}

module.exports = {
  nearbySearch,
  placeDetails,
};
