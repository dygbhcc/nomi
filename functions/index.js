require("dotenv").config();

const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {nearbySearch, placeDetails} = require("./services/googlePlacesService");
const {calculateDemandForecast} = require("./services/demandScoringService");
const {runFullPipeline} = require("./services/fullPipelineService");
const {neighborhoods, filters} = require("./config/lisbonConfig");
const {excelBufferToArray, arrayToExcelBuffer} = require("./services/excelService");
const {runGeminiNlpBatch} = require("./services/geminiNlpPipeline");

admin.initializeApp();
const db = admin.firestore();

const CACHE_TTL_DAYS = 30;
const MAX_RESULTS_DEFAULT = 40;

function normalizeRegionKey(lat, lng, radius) {
  const latBucket = Number(lat).toFixed(3);
  const lngBucket = Number(lng).toFixed(3);
  return `${latBucket}_${lngBucket}_${radius}`;
}

/**
 * Generate Google Photo API URL for frontend display
 * @param {string} photoReference - photo_reference from Google Places
 * @param {number} maxWidth - Photo width (default: 400px)
 * @return {string} Google Photos API URL
 *
 * Usage:
 * const photoUrl = getGooglePhotoUrl(restaurant.photos[0].photo_reference, 800);
 * <img src={photoUrl} alt={restaurant.name} />
 *
 * IMPORTANT: Always display html_attributions (required for copyright compliance)
 */
function getGooglePhotoUrl(photoReference, maxWidth = 400) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || "";
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${apiKey}`;
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
  let photos = [];

  if (place.photos && place.photos.length > 0) {
    // Get first 5 photos (or total available)
    const maxPhotos = Math.min(5, place.photos.length);

    // Sort photos by size (highest resolution first)
    const sortedPhotos = [...place.photos]
        .sort((a, b) => (b.width * b.height) - (a.width * a.height))
        .slice(0, maxPhotos);

    photos = sortedPhotos.map((photo, index) => ({
      photo_reference: photo.photo_reference,
      width: photo.width,
      height: photo.height,
      html_attributions: photo.html_attributions || [],
      index: index,
      source: "google",
    }));
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
    photos: photos,
    cache_date: admin.firestore.FieldValue.serverTimestamp(),
    is_local_concept: false,
    nlp_processed: false,
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
  // Skip permanently closed restaurants — no need to spend effort on them
  const filtered = nearby.filter((p) => p.business_status !== "CLOSED_PERMANENTLY");
  const selected = filtered.slice(0, maxResultsNumber);

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
          .filter((place) => place.business_status !== "CLOSED_PERMANENTLY")
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
      let deletedPermanently = 0;
      let markedTemporary = 0;
      let markedOpen = 0;
      let errors = 0;
      let batch = db.batch();
      let batchCount = 0;
      const deletedList = [];

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
          const ref = db.collection("restaurants").doc(doc.id);

          if (businessStatus === "CLOSED_PERMANENTLY") {
            // Delete permanently closed restaurants — no need to keep them
            batch.delete(ref);
            batchCount++;
            deletedPermanently++;
            deletedList.push({name: restaurant.name, place_id: placeId});
          } else if (businessStatus === "CLOSED_TEMPORARILY") {
            batch.update(ref, {
              business_status: businessStatus,
              last_status_check: admin.firestore.FieldValue.serverTimestamp(),
            });
            batchCount++;
            markedTemporary++;
          } else {
            batch.update(ref, {
              business_status: businessStatus,
              last_status_check: admin.firestore.FieldValue.serverTimestamp(),
            });
            batchCount++;
            markedOpen++;
          }

          // Commit batch every batchSize updates
          if (batchCount >= batchSize) {
            await batch.commit();
            logger.info(`Processed ${checked}/${snapshot.size} - Deleted: ${deletedPermanently}, Temporary: ${markedTemporary}, Open: ${markedOpen}`);
            batch = db.batch();
            batchCount = 0;
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
        deletedPermanently,
        markedTemporary,
        markedOpen,
        errors,
        deletedSample: deletedList.slice(0, 20),
      };

      logger.info("Finished checking restaurants", result);
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
          has_manual_scoring: firestoreData.has_manual_scoring,
          mood_scores: firestoreData.mood_scores,
          noise_level: firestoreData.noise_level,
          is_local_concept: firestoreData.is_local_concept,
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

/**
 * Import manual scores from Excel data
 * Expects base64 encoded Excel file in request.data.fileData
 */
exports.importManualScoresFromExcel = onCall(
    {
      region: "europe-west1",
      timeoutSeconds: 540,
      memory: "1GiB",
    },
    async (request) => {
      const {fileData} = request.data;

      if (!fileData) {
        throw new HttpsError("invalid-argument", "fileData is required");
      }

      logger.info("Starting Excel import...");

      // Decode base64 to buffer
      const buffer = Buffer.from(fileData, "base64");
      const excelData = excelBufferToArray(buffer);

      logger.info(`Found ${excelData.length} rows in Excel`);

      const results = {
        total: excelData.length,
        updated: 0,
        notFound: 0,
        markedClosed: 0,
        errors: 0,
        notFoundList: [],
      };

      const BATCH_SIZE = 400;
      let batch = db.batch();
      let batchCount = 0;

      for (const row of excelData) {
        try {
          const placeId = row.place_id;

          if (!placeId) {
            results.errors++;
            continue;
          }

          // Find restaurant by place_id
          const snapshot = await db.collection("restaurants")
              .where("place_id", "==", placeId)
              .limit(1)
              .get();

          if (snapshot.empty) {
            results.notFound++;
            results.notFoundList.push({
              place_id: placeId,
              name: row.name,
            });
            continue;
          }

          const doc = snapshot.docs[0];

          // Build update object
          const updateData = {};
          let hasAnyScore = false;

          // Map mood tags
          if (row.mood_tag_energetic !== undefined && row.mood_tag_energetic !== "") {
            updateData["mood_scores.energetic"] = Number(row.mood_tag_energetic);
            hasAnyScore = true;
          }
          if (row.mood_tag_chill !== undefined && row.mood_tag_chill !== "") {
            updateData["mood_scores.chill"] = Number(row.mood_tag_chill);
            hasAnyScore = true;
          }
          if (row.mood_tag_hungry !== undefined && row.mood_tag_hungry !== "") {
            updateData["mood_scores.hungry"] = Number(row.mood_tag_hungry);
            hasAnyScore = true;
          }

          // Noise level
          if (row.noise_level !== undefined && row.noise_level !== "") {
            updateData.noise_level = Number(row.noise_level);
            hasAnyScore = true;
          }

          // Is local concept
          if (row.is_local_concept !== undefined && row.is_local_concept !== "") {
            updateData.is_local_concept = row.is_local_concept.toLowerCase() === "yes";
            hasAnyScore = true;
          }

          // Only mark as manually scored if at least one field has a value
          if (hasAnyScore) {
            updateData.has_manual_scoring = true;
            updateData.manual_scoring_date = admin.firestore.FieldValue.serverTimestamp();
          }

          // Check if closed — delete permanently closed restaurants instead of keeping them
          const closedValue = row["closed "] || row.closed; // Handle space in column name
          if (closedValue && (closedValue === "X" || closedValue === "x")) {
            batch.delete(doc.ref);
            batchCount++;
            results.markedClosed++;
            continue;
          }

          // Only update if there's something to update
          if (Object.keys(updateData).length > 0) {
            batch.update(doc.ref, updateData);
            batchCount++;
            results.updated++;
          }

          // Commit batch when full
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            logger.info(`Committed batch: ${results.updated}/${excelData.length}`);
            batch = db.batch();
            batchCount = 0;
          }
        } catch (error) {
          logger.error(`Error processing row:`, error.message);
          results.errors++;
        }
      }

      // Commit remaining
      if (batchCount > 0) {
        await batch.commit();
      }

      logger.info("Import completed", results);

      return {
        ...results,
        notFoundList: results.notFoundList.slice(0, 20), // Limit response size
      };
    },
);

/**
 * Fix has_manual_scoring flag - only keep it true if restaurant actually has mood scores
 */
exports.fixManualScoringFlags = onCall(
    {
      region: "europe-west1",
      timeoutSeconds: 300,
    },
    async () => {
      logger.info("Fixing manual scoring flags...");

      const snapshot = await db.collection("restaurants")
          .where("has_manual_scoring", "==", true)
          .get();

      logger.info(`Checking ${snapshot.size} restaurants with has_manual_scoring=true`);

      let needsReset = 0;
      let actuallyHasScores = 0;
      const BATCH_SIZE = 400;
      let batch = db.batch();
      let batchCount = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();

        // Check if restaurant actually has mood scores with valid values
        const hasEnergetic = typeof data.mood_scores?.energetic === "number" && data.mood_scores.energetic > 0;
        const hasChill = typeof data.mood_scores?.chill === "number" && data.mood_scores.chill > 0;
        const hasHungry = typeof data.mood_scores?.hungry === "number" && data.mood_scores.hungry > 0;
        const hasNoise = typeof data.noise_level === "number" && data.noise_level > 0;
        const hasLocal = typeof data.is_local_concept === "boolean";
        const isManuallyClosed = data.is_manually_marked_closed === true;

        const hasAnyScore = hasEnergetic || hasChill || hasHungry || hasNoise || hasLocal || isManuallyClosed;

        if (!hasAnyScore) {
          // Restaurant doesn't actually have scores, remove the flag
          batch.update(doc.ref, {
            has_manual_scoring: false,
            manual_scoring_date: admin.firestore.FieldValue.delete(),
          });
          batchCount++;
          needsReset++;

          if (batchCount >= BATCH_SIZE) {
            batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        } else {
          actuallyHasScores++;
        }
      });

      // Commit remaining
      if (batchCount > 0) {
        await batch.commit();
      }

      return {
        checked: snapshot.size,
        actuallyHasScores,
        needsReset,
      };
    },
);

/**
 * Delete restaurants with rating = 0 or rating < 3
 */
exports.deleteLowRatingRestaurants = onCall(
    {
      region: "europe-west1",
      timeoutSeconds: 300,
    },
    async () => {
      logger.info("Starting to delete low rating restaurants...");

      const snapshot = await db.collection("restaurants").get();

      const toDelete = [];
      const stats = {
        total: snapshot.size,
        zeroRating: 0,
        lessThan3: 0,
        deleted: 0,
        zeroRatingManualScored: 0,
        lessThan3ManualScored: 0,
      };

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const rating = data.google_rating || 0;
        const hasManualScoring = data.has_manual_scoring === true;

        // Count all low rating restaurants
        if (rating === 0) {
          stats.zeroRating++;
          if (hasManualScoring) stats.zeroRatingManualScored++;
        } else if (rating < 3) {
          stats.lessThan3++;
          if (hasManualScoring) stats.lessThan3ManualScored++;
        }

        // Only delete if low rating AND no manual scoring
        if ((rating === 0 || rating < 3) && !hasManualScoring) {
          toDelete.push({
            id: doc.id,
            name: data.name,
            rating: rating,
            hasManualScoring: hasManualScoring,
          });
        }
      });

      logger.info(`Found ${toDelete.length} restaurants to delete`);

      // Delete in batches
      const BATCH_SIZE = 400;
      let batch = db.batch();
      let batchCount = 0;

      for (const restaurant of toDelete) {
        batch.delete(db.collection("restaurants").doc(restaurant.id));
        batchCount++;
        stats.deleted++;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          logger.info(`Deleted ${stats.deleted}/${toDelete.length}`);
          batch = db.batch();
          batchCount = 0;
        }
      }

      // Commit remaining
      if (batchCount > 0) {
        await batch.commit();
      }

      logger.info("Deletion completed", stats);

      return {
        ...stats,
        deletedSample: toDelete.slice(0, 20).map((r) => ({
          name: r.name,
          rating: r.rating,
          hadManualScoring: r.hasManualScoring,
        })),
      };
    },
);

/**
 * Delete all CLOSED_PERMANENTLY restaurants from Firestore
 * One-time cleanup to remove restaurants that are permanently closed
 */
exports.deleteClosedPermanentlyRestaurants = onCall(
    {
      region: "europe-west1",
      timeoutSeconds: 300,
    },
    async () => {
      logger.info("Deleting all CLOSED_PERMANENTLY restaurants...");

      const snapshot = await db.collection("restaurants")
          .where("business_status", "==", "CLOSED_PERMANENTLY")
          .get();

      logger.info(`Found ${snapshot.size} permanently closed restaurants to delete`);

      if (snapshot.size === 0) {
        return {total: 0, deleted: 0, deletedList: []};
      }

      const BATCH_SIZE = 400;
      let batch = db.batch();
      let batchCount = 0;
      let deleted = 0;
      const deletedList = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        deletedList.push({name: data.name, place_id: data.place_id});

        batch.delete(doc.ref);
        batchCount++;
        deleted++;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          logger.info(`Deleted ${deleted}/${snapshot.size}`);
          batch = db.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      logger.info(`Deletion completed: ${deleted} restaurants removed`);

      return {
        total: snapshot.size,
        deleted,
        deletedSample: deletedList.slice(0, 30).map((r) => ({
          name: r.name,
          place_id: r.place_id,
        })),
      };
    },
);

/**
 * Get statistics about restaurant ratings
 */
exports.getRestaurantRatingStats = onCall(
    {
      region: "europe-west1",
    },
    async () => {
      const snapshot = await db.collection("restaurants").get();

      const stats = {
        total: snapshot.size,
        withManualScoring: 0,
        withoutManualScoring: 0,
        zeroRating: 0,
        lessThan3: 0,
        lessThan35: 0,
        above35: 0,
        zeroRatingWithScoring: 0,
        lowRatingWithScoring: 0,
      };

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const rating = data.google_rating || 0;
        const hasScoring = data.has_manual_scoring === true;

        if (hasScoring) {
          stats.withManualScoring++;
        } else {
          stats.withoutManualScoring++;
        }

        if (rating === 0) {
          stats.zeroRating++;
          if (hasScoring) stats.zeroRatingWithScoring++;
        } else if (rating < 3) {
          stats.lessThan3++;
          if (hasScoring) stats.lowRatingWithScoring++;
        } else if (rating < 3.5) {
          stats.lessThan35++;
        } else {
          stats.above35++;
        }
      });

      return stats;
    },
);

/**
 * Generate Google Photo URLs for frontend
 * Creates URLs on backend to avoid exposing API key on client-side
 */
exports.getPhotoUrls = onCall(
    {
      region: "europe-west1",
    },
    async (request) => {
      const {photoReferences, maxWidth = 400} = request.data || {};

      if (!photoReferences || !Array.isArray(photoReferences)) {
        throw new HttpsError("invalid-argument", "photoReferences array is required");
      }

      const urls = photoReferences.map((ref) =>
        getGooglePhotoUrl(ref, maxWidth),
      );

      return {urls};
    },
);

/**
 * Export restaurants without manual scoring to Excel format
 * Returns base64 encoded Excel file
 */
exports.exportRestaurantsWithoutScoring = onCall(
    {
      region: "europe-west1",
      timeoutSeconds: 300,
      memory: "512MiB",
    },
    async () => {
      logger.info("Exporting restaurants without manual scoring...");

      const snapshot = await db.collection("restaurants")
          .where("has_manual_scoring", "==", false)
          .get();

      logger.info(`Found ${snapshot.size} restaurants without manual scoring`);

      const XLSX = require("xlsx");
      const restaurants = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        restaurants.push({
          place_id: data.place_id,
          name: data.name,
          neighborhood: data.neighborhood || "",
          address: data.address,
          lat: data.location?.lat || 0,
          lng: data.location?.lng || 0,
          google_rating: data.google_rating || 0,
          budget_level: data.budget_level || 1,
          phone: data.phone || "",
          website: data.website || "",
          is_open_monday: data.opening_hours?.is_open_monday ? "YES" : "NO",
          mood_tag_energetic: "",
          mood_tag_chill: "",
          mood_tag_hungry: "",
          noise_level: "",
          is_local_concept: "",
          closed: "",
        });
      });

      // Convert to Excel
      const worksheet = XLSX.utils.json_to_sheet(restaurants);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Restaurants");
      const buffer = XLSX.write(workbook, {type: "buffer", bookType: "xlsx"});

      // Convert to base64
      const base64 = buffer.toString("base64");

      return {
        count: restaurants.length,
        fileData: base64,
        filename: `restaurants_to_score_${Date.now()}.xlsx`,
      };
    },
);

/**
 * Export NLP-processed restaurants for PMO scoring
 * Returns base64 encoded Excel with 8 mood tag columns (1-9 scale)
 */
exports.exportForPmoScoring = onRequest(
    {
      region: "europe-west1",
      timeoutSeconds: 300,
      memory: "512MiB",
    },
    async (req, res) => {
      const secret = req.headers["x-nomi-secret"];
      if (secret !== process.env.MANUAL_TRIGGER_SECRET) {
        return res.status(401).json({error: "Unauthorized"});
      }

      logger.info("Exporting restaurants for PMO scoring...");

      const snapshot = await db.collection("restaurants")
          .where("nlp_processed", "==", true)
          .get();

      logger.info(`Found ${snapshot.size} NLP-processed restaurants`);

      const rows = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        rows.push({
          place_id: data.place_id || "",
          name: data.name || "",
          address: data.address || "",
          neighborhood: data.neighborhood || "",
          google_rating: data.google_rating || 0,
          romantic: "",
          energetic: "",
          chill: "",
          explorer: "",
          focus: "",
          retreat: "",
          hungry_quick: "",
          celebrating: "",
          scored_by: "",
          notes: "",
        });
      });

      const buffer = arrayToExcelBuffer(rows);
      const base64 = buffer.toString("base64");

      return res.json({
        count: rows.length,
        fileData: base64,
        filename: `pmo_scoring_${Date.now()}.xlsx`,
      });
    },
);

/**
 * Import PMO scores from Excel into pmo_scores collection
 * Expects base64 encoded Excel file in request body
 */
exports.importPmoScores = onRequest(
    {
      region: "europe-west1",
      timeoutSeconds: 540,
      memory: "1GiB",
    },
    async (req, res) => {
      const secret = req.headers["x-nomi-secret"];
      if (secret !== process.env.MANUAL_TRIGGER_SECRET) {
        return res.status(401).json({error: "Unauthorized"});
      }

      const {fileData} = req.body || {};
      if (!fileData) {
        return res.status(400).json({error: "fileData is required"});
      }

      logger.info("Starting PMO scores import...");

      const buffer = Buffer.from(fileData, "base64");
      const excelData = excelBufferToArray(buffer);

      logger.info(`Found ${excelData.length} rows in Excel`);

      const MOOD_TAGS = ["romantic", "energetic", "chill", "explorer", "focus", "retreat", "hungry_quick", "celebrating"];
      const results = {
        total: excelData.length,
        imported: 0,
        notFound: 0,
        skipped: 0,
        errors: 0,
        notFoundList: [],
      };

      const BATCH_SIZE = 400;
      let batch = db.batch();
      let batchCount = 0;

      for (const row of excelData) {
        try {
          const placeId = row.place_id;
          if (!placeId) {
            results.errors++;
            continue;
          }

          // Build scores object — skip row if no mood scores provided
          const scores = {};
          let hasAnyScore = false;
          for (const tag of MOOD_TAGS) {
            if (row[tag] !== undefined && row[tag] !== "" && row[tag] !== null) {
              const val = Number(row[tag]);
              if (val >= 1 && val <= 9) {
                scores[tag] = val;
                hasAnyScore = true;
              }
            }
          }

          if (!hasAnyScore) {
            results.skipped++;
            continue;
          }

          // Find restaurant by place_id to get doc ID
          const snapshot = await db.collection("restaurants")
              .where("place_id", "==", placeId)
              .limit(1)
              .get();

          if (snapshot.empty) {
            results.notFound++;
            results.notFoundList.push({place_id: placeId, name: row.name || ""});
            continue;
          }

          const restaurantDoc = snapshot.docs[0];

          // Write to pmo_scores collection
          const pmoRef = db.collection("pmo_scores").doc();
          batch.set(pmoRef, {
            restaurant_id: restaurantDoc.id,
            place_id: placeId,
            scored_by: row.scored_by || "excel_import",
            scored_at: admin.firestore.FieldValue.serverTimestamp(),
            scores,
            notes: row.notes || "",
          });
          batchCount++;

          // Set has_pmo_scoring flag on restaurant
          batch.update(restaurantDoc.ref, {has_pmo_scoring: true});
          batchCount++;

          results.imported++;

          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            logger.info(`Committed batch: ${results.imported}/${excelData.length}`);
            batch = db.batch();
            batchCount = 0;
          }
        } catch (error) {
          logger.error("Error processing PMO row:", error.message);
          results.errors++;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      logger.info("PMO import completed", results);

      return res.json({
        ...results,
        notFoundList: results.notFoundList.slice(0, 20),
      });
    },
);

exports.scheduledGeminiNlp = onSchedule(
    {
      schedule: "0 1 * * *",
      timeZone: "Europe/Lisbon",
      region: "europe-west1",
      timeoutSeconds: 540,
      memory: "256MiB",
    },
    async () => {
      const result = await runGeminiNlpBatch(50);
      console.log("[Scheduler] Result:", result);
    },
);

exports.manualGeminiNlp = onRequest(
    {
      region: "europe-west1",
      timeoutSeconds: 540,
      memory: "256MiB",
    },
    async (req, res) => {
      const secret = req.headers["x-nomi-secret"];
      if (secret !== process.env.MANUAL_TRIGGER_SECRET) {
        return res.status(401).json({error: "Unauthorized"});
      }
      const batchSize = req.body?.batchSize || 10;
      const result = await runGeminiNlpBatch(batchSize);
      return res.json(result);
    },
);

/**
 * One-time: set nlp_processed=false on all restaurants missing the field
 */
exports.initNlpFlags = onRequest(
    {
      region: "europe-west1",
      timeoutSeconds: 300,
    },
    async (req, res) => {
      const secret = req.headers["x-nomi-secret"];
      if (secret !== process.env.MANUAL_TRIGGER_SECRET) {
        return res.status(401).json({error: "Unauthorized"});
      }

      const snapshot = await db.collection("restaurants").get();
      const BATCH_SIZE = 400;
      let batch = db.batch();
      let batchCount = 0;
      let updated = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.nlp_processed !== false) {
          batch.update(doc.ref, {nlp_processed: false});
          batchCount++;
          updated++;

          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      logger.info(`initNlpFlags: ${updated}/${snapshot.size} updated`);
      return res.json({total: snapshot.size, updated});
    },
);
