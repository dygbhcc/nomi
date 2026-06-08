const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_RESULTS = 40;
const GOOGLE_PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place";

function getRegionId(lat, lng, radius) {
  return `${Number(lat).toFixed(4)}_${Number(lng).toFixed(4)}_${Number(radius)}`;
}

function isOpenMonday(openingHours) {
  if (!openingHours || !Array.isArray(openingHours.periods)) {
    return false;
  }

  // Google Places: 0 Sunday ... 6 Saturday, so Monday is 1
  return openingHours.periods.some((period) => period?.open?.day === 1);
}

function buildConfidenceScores(moodTags) {
  return moodTags.reduce((acc, mood) => {
    acc[mood] = 60;
    return acc;
  }, {});
}

async function fetchNearbyPlaces(apiKey, lat, lng, radius, maxResults) {
  const url = `${GOOGLE_PLACES_BASE_URL}/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=restaurant&key=${apiKey}`;
  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok || payload.status === "REQUEST_DENIED" || payload.status === "INVALID_REQUEST") {
    throw new Error(`Nearby Search failed: ${payload.status || response.statusText}`);
  }

  const results = Array.isArray(payload.results) ? payload.results : [];
  return results.slice(0, maxResults);
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

exports.fetchAndCacheRestaurants = functions.https.onCall(async (data) => {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "GOOGLE_PLACES_API_KEY is missing. Keep it in .env.local / runtime env."
      );
    }

    const lat = Number(data?.lat);
    const lng = Number(data?.lng);
    const radius = Number(data?.radius || 800);
    const maxResults = Number(data?.maxResults || DEFAULT_MAX_RESULTS);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius)) {
      throw new functions.https.HttpsError("invalid-argument", "lat, lng and radius must be valid numbers.");
    }

    const regionId = getRegionId(lat, lng, radius);
    const cacheDocRef = db.collection("restaurant_cache_regions").doc(regionId);
    const cacheDoc = await cacheDocRef.get();

    if (cacheDoc.exists) {
      const cacheData = cacheDoc.data();
      const cacheDate = cacheData?.cache_date?.toDate?.();
      if (cacheDate && Date.now() - cacheDate.getTime() < THIRTY_DAYS_MS) {
        const restaurantIds = Array.isArray(cacheData.restaurant_ids) ? cacheData.restaurant_ids : [];
        if (restaurantIds.length > 0) {
          const restaurantRefs = restaurantIds.map((id) => db.collection("restaurants").doc(id));
          const restaurantDocs = await db.getAll(...restaurantRefs);
          const restaurants = restaurantDocs.filter((doc) => doc.exists).map((doc) => ({ id: doc.id, ...doc.data() }));
          return { source: "cache", count: restaurants.length, restaurants };
        }
      }
    }

    const nearbyPlaces = await fetchNearbyPlaces(apiKey, lat, lng, radius, maxResults);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    const storedIds = [];

    for (const place of nearbyPlaces) {
      if (!place.place_id) {
        continue;
      }

      const details = await fetchPlaceDetails(apiKey, place.place_id);
      const location = details?.geometry?.location || {};
      const moodTags = [];
      const isLocalConcept = false;

      const restaurantData = {
        place_id: details.place_id,
        name: details.name || "",
        address: details.formatted_address || "",
        location: {
          lat: Number(location.lat || place?.geometry?.location?.lat || 0),
          lng: Number(location.lng || place?.geometry?.location?.lng || 0)
        },
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
        is_local_concept: isLocalConcept
      };

      const restaurantRef = db.collection("restaurants").doc(details.place_id);
      batch.set(restaurantRef, restaurantData, { merge: true });
      storedIds.push(details.place_id);
    }

    batch.set(
      cacheDocRef,
      {
        center: { lat, lng },
        radius,
        type: "restaurant",
        cache_date: now,
        restaurant_ids: storedIds
      },
      { merge: true }
    );

    await batch.commit();

    const writtenDocs = await Promise.all(
      storedIds.map(async (id) => {
        const snap = await db.collection("restaurants").doc(id).get();
        return snap.exists ? { id: snap.id, ...snap.data() } : null;
      })
    );

    return { source: "places_api", count: storedIds.length, restaurants: writtenDocs.filter(Boolean) };
  } catch (error) {
    console.error("fetchAndCacheRestaurants failed:", error);
    throw new functions.https.HttpsError("internal", error.message || "Unexpected error.");
  }
});
