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

// Nearby Search returns at most 20 results per page and 3 pages total.
const NEARBY_PAGE_SIZE = 20;
const NEARBY_MAX_PAGES = 3;
// next_page_token takes a moment to become valid on Google's side.
const PAGE_TOKEN_DELAY_MS = 2000;

async function nearbySearch({lat, lng, radius, type = "restaurant", force = false, maxResults = NEARBY_PAGE_SIZE}) {
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
  const results = [];
  let pageToken = null;

  for (let page = 0; page < NEARBY_MAX_PAGES && results.length < maxResults; page++) {
    let data;
    if (pageToken) {
      await new Promise((resolve) => setTimeout(resolve, PAGE_TOKEN_DELAY_MS));
      const response = await axios.get(url, {params: {pagetoken: pageToken, key}});
      data = response.data;
      if (data.status === "INVALID_REQUEST") {
        // Token not active yet — one more wait, then retry once.
        await new Promise((resolve) => setTimeout(resolve, PAGE_TOKEN_DELAY_MS));
        const retry = await axios.get(url, {params: {pagetoken: pageToken, key}});
        data = retry.data;
      }
    } else {
      const response = await axios.get(url, {
        params: {location: `${lat},${lng}`, radius, type, key},
      });
      data = response.data;
    }

    // Anything other than OK / ZERO_RESULTS (e.g. OVER_QUERY_LIMIT,
    // REQUEST_DENIED) must fail loudly — caching an empty result here would
    // poison the region cache for 30 days.
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Nearby search failed: ${data.status} ${data.error_message || ""}`);
    }

    results.push(...(data.results || []));
    pageToken = data.next_page_token || null;
    if (!pageToken) break;
  }

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
  const {status, result, error_message: errorMessage} = response.data;
  if (status === "ZERO_RESULTS" || status === "NOT_FOUND") return null;
  if (status !== "OK") {
    throw new Error(`Place details failed: ${status} ${errorMessage || ""}`);
  }
  return result || null;
}

module.exports = {
  nearbySearch,
  placeDetails,
};
