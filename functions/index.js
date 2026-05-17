require("dotenv").config();

const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const {nearbySearch, placeDetails} = require("./services/googlePlacesService");
const {getOrUploadPhoto} = require("./services/cloudinaryService");
const {calculateDemandForecast} = require("./services/demandScoringService");
const {runFullPipeline} = require("./services/fullPipelineService");
const {neighborhoods, filters} = require("./config/lisbonConfig");

// Define Cloudinary secrets
const cloudinaryCloudName = defineSecret("CLOUDINARY_CLOUD_NAME");
const cloudinaryApiKey = defineSecret("CLOUDINARY_API_KEY");
const cloudinaryApiSecret = defineSecret("CLOUDINARY_API_SECRET");

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

async function buildRestaurantDocument(place) {
  let cloudinaryPhotos = [];

  if (place.photos && place.photos.length > 0) {
    const firstPhoto = place.photos[0];
    const cloudinaryUrl = await getOrUploadPhoto(
        firstPhoto.photo_reference,
        place.place_id,
        0,
    );

    if (cloudinaryUrl) {
      cloudinaryPhotos = [{
        url: cloudinaryUrl,
        source: "cloudinary",
        width: firstPhoto.width,
        height: firstPhoto.height,
      }];
    } else {
      cloudinaryPhotos = [{
        photo_reference: firstPhoto.photo_reference,
        source: "google",
        width: firstPhoto.width,
        height: firstPhoto.height,
      }];
    }
  }

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
    photos: cloudinaryPhotos,
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

  const restaurants = (await Promise.all(
      detailedPlaces
          .filter(Boolean)
          .map(async (place) => {
            try {
              return await buildRestaurantDocument(place);
            } catch (error) {
              logger.warn("buildRestaurantDocument failed", {
                placeId: place.place_id,
                error: error.message,
              });
              return null;
            }
          }),
  )).filter(Boolean).filter((restaurant) => restaurant.place_id);

  await writeRegionCache(regionKey, restaurants);

  return {
    source: "google_places",
    count: restaurants.length,
    restaurants,
  };
}

exports.fetchAndCacheRestaurants = onCall(
    {
      region: "europe-west1",
    },
    async (request) => {
      const data = request.data || {};
      return fetchAndCacheByCoordinates({
        lat: data.lat,
        lng: data.lng,
        radius: data.radius || 800,
        maxResults: data.maxResults || MAX_RESULTS_DEFAULT,
      });
    },
);

exports.warmupLisbonRestaurants = onCall(
    {
      region: "europe-west1",
    },
    async () => {
      const results = [];
      for (const neighborhood of neighborhoods) {
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
        totalNeighborhoods: neighborhoods.length,
        results,
      };
    },
);

/**
 * Callable function to get current demand forecast
 * Combines weather, events, time, and tourism signals
 */
exports.getDemandForecast = onCall(
    {
      region: "europe-west1",
    },
    async () => {
      try {
        const forecast = await calculateDemandForecast();
        return forecast;
      } catch (error) {
        logger.error("getDemandForecast error:", error);
        throw new HttpsError("internal", "Failed to calculate demand forecast");
      }
    },
);

/**
 * Scheduled function to update demand forecast every hour
 * Stores result in Firestore for dashboard consumption
 */
exports.scheduledDemandUpdate = onSchedule(
    {
      schedule: "every 1 hours",
      timeZone: "Europe/Lisbon",
      region: "europe-west1",
    },
    async () => {
      try {
        logger.info("Running scheduled demand forecast update...");

        const forecast = await calculateDemandForecast();

        // Store in Firestore for admin dashboard
        await db.collection("demand_forecasts").doc("latest").set({
          ...forecast,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info("Demand forecast updated successfully", {
          overallScore: forecast.overall.score,
        });

        return {success: true, score: forecast.overall.score};
      } catch (error) {
        logger.error("scheduledDemandUpdate failed:", error);
        throw error;
      }
    },
);

exports.runFullLisbonPipeline = onCall(
    {
      region: "europe-west1",
      timeoutSeconds: 540,
      memory: "1GiB",
      secrets: [cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret],
    },
    async () => {
      return await runFullPipeline(neighborhoods, filters);
    },
);

/**
 * Check all restaurants in Firestore against Google Places API
 * and update business_status field (OPERATIONAL, CLOSED_PERMANENTLY, CLOSED_TEMPORARILY)
 */
exports.markClosedRestaurants = onCall(
    {
      region: "europe-west1",
      timeoutSeconds: 540,
      memory: "512MiB",
    },
    async (request) => {
      const batchSize = request.data?.batchSize || 50;
      const delayMs = request.data?.delayMs || 100;

      logger.info("Starting to check and mark closed restaurants...");

      // Get all restaurants
      const snapshot = await db.collection("restaurants").get();
      logger.info(`Found ${snapshot.size} restaurants to check`);

      let checked = 0;
      let markedClosed = 0;
      let markedOpen = 0;
      let errors = 0;
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        try {
          const restaurant = doc.data();
          const placeId = restaurant.place_id;

          if (!placeId) {
            errors++;
            continue;
          }

          // Get current status from Google Places
          const details = await placeDetails(placeId);
          checked++;

          if (!details) {
            logger.warn(`Could not fetch details for ${placeId}`);
            errors++;
            continue;
          }

          const businessStatus = details.business_status || "OPERATIONAL";
          const isClosed = businessStatus === "CLOSED_PERMANENTLY" ||
                          businessStatus === "CLOSED_TEMPORARILY";

          // Update the document
          const ref = db.collection("restaurants").doc(doc.id);
          batch.update(ref, {
            business_status: businessStatus,
            last_status_check: admin.firestore.FieldValue.serverTimestamp(),
          });

          batchCount++;
          if (isClosed) {
            markedClosed++;
          } else {
            markedOpen++;
          }

          // Commit batch every batchSize updates
          if (batchCount >= batchSize) {
            await batch.commit();
            logger.info(`Processed ${checked}/${snapshot.size} - Closed: ${markedClosed}, Open: ${markedOpen}`);
            batch = db.batch(); // Create new batch
            batchCount = 0;
            // Small delay to avoid rate limits
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        } catch (error) {
          logger.error(`Error checking restaurant ${doc.id}:`, error.message);
          errors++;
        }
      }

      // Commit remaining updates
      if (batchCount > 0) {
        await batch.commit();
      }

      const result = {
        total: snapshot.size,
        checked,
        markedClosed,
        markedOpen,
        errors,
      };

      logger.info("Finished marking closed restaurants", result);
      return result;
    },
);

/**
 * Check a specific restaurant by place_id
 */
exports.checkRestaurantById = onCall(
    {
      region: "europe-west1",
    },
    async (request) => {
      const placeId = request.data?.placeId;

      if (!placeId) {
        throw new HttpsError("invalid-argument", "placeId is required");
      }

      // Get from Firestore
      const snapshot = await db.collection("restaurants")
          .where("place_id", "==", placeId)
          .limit(1)
          .get();

      let firestoreData = null;
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        firestoreData = {
          id: doc.id,
          ...doc.data(),
        };
      }

      // Get from Google Places API
      let googleData = null;
      try {
        googleData = await placeDetails(placeId);
      } catch (error) {
        logger.error("Failed to fetch from Google", error);
      }

      return {
        placeId,
        existsInFirestore: !!firestoreData,
        firestoreData: firestoreData ? {
          name: firestoreData.name,
          address: firestoreData.address,
          business_status: firestoreData.business_status,
          last_status_check: firestoreData.last_status_check,
        } : null,
        googleData: googleData ? {
          name: googleData.name,
          business_status: googleData.business_status,
          permanently_closed: googleData.permanently_closed,
          formatted_address: googleData.formatted_address,
        } : null,
      };
    },
);

/**
 * Get restaurants status breakdown
 */
exports.getRestaurantStatusBreakdown = onCall(
    {
      region: "europe-west1",
    },
    async () => {
      const snapshot = await db.collection("restaurants").get();

      const statusBreakdown = {};
      const closed = [];
      const noStatus = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const status = data.business_status || "NO_STATUS";

        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

        if (status === "CLOSED_PERMANENTLY" || status === "CLOSED_TEMPORARILY") {
          closed.push({
            name: data.name,
            address: data.address,
            status: status,
            place_id: data.place_id,
          });
        }

        if (!data.business_status) {
          noStatus.push({
            name: data.name,
            place_id: data.place_id,
          });
        }
      });

      return {
        total: snapshot.size,
        statusBreakdown,
        closedCount: closed.length,
        closedRestaurants: closed,
        noStatusCount: noStatus.length,
        noStatusSample: noStatus.slice(0, 10),
      };
    },
);
