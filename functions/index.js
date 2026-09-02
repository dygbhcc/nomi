require("dotenv").config();

const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onMessagePublished} = require("firebase-functions/v2/pubsub");
const {defineSecret} = require("firebase-functions/params");

// Cloudinary credentials from Secret Manager (not .env)
const cloudinaryCloudName = defineSecret("CLOUDINARY_CLOUD_NAME");
const cloudinaryApiKey = defineSecret("CLOUDINARY_API_KEY");
const cloudinaryApiSecret = defineSecret("CLOUDINARY_API_SECRET");
const {nearbySearch, placeDetails} = require("./services/googlePlacesService");
const {getOrUploadPhoto} = require("./services/cloudinaryService");
const {calculateDemandForecast} = require("./services/demandScoringService");
const {runFullPipeline} = require("./services/fullPipelineService");
const {neighborhoods, filters} = require("./config/lisbonConfig");
const {excelBufferToArray} = require("./services/excelService");
const {runGeminiNlpBatch} = require("./services/geminiNlpPipeline");
const {notifyRoomParticipants} = require("./services/notificationService");

admin.initializeApp();
const db = admin.firestore();

const CACHE_TTL_DAYS = 30;
const MAX_RESULTS_DEFAULT = 40;

/**
 * Best-effort in-memory rate limiter for expensive callables. State lives per
 * function instance, so with maxInstances N the effective ceiling is up to
 * N × maxRequests — a burst brake against abuse and runaway clients, not an
 * exact global limit.
 */
const RATE_LIMIT = new Map();

function checkRateLimit(callerId, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const key = callerId || "anonymous";
  const entry = RATE_LIMIT.get(key);

  if (!entry || now > entry.resetAt) {
    RATE_LIMIT.set(key, {count: 1, resetAt: now + windowMs});
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count++;
  return true;
}

function rateLimitCallerId(request) {
  return request.auth?.uid || request.rawRequest?.ip || "anonymous";
}

function enforceRateLimit(request, maxRequests, windowMs = 60000) {
  if (!checkRateLimit(rateLimitCallerId(request), maxRequests, windowMs)) {
    throw new HttpsError("resource-exhausted", "Rate limit exceeded. Please wait before retrying.");
  }
}

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
    const maxPhotos = Math.min(3, place.photos.length);

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

/**
 * Fetch new restaurants not yet in Firestore.
 * Rotates through neighborhoods daily, checks each nearbySearch result
 * against Firestore, and only calls placeDetails for new ones.
 * Stops after reaching targetCount.
 * @param {number} targetCount - Number of new restaurants to find
 * @return {object} { newCount, nearbySearchCalls, detailsCalls }
 */
async function fetchNewRestaurants(targetCount = 20) {
  let newCount = 0;
  let nearbySearchCalls = 0;
  let detailsCalls = 0;

  // Start from a different neighborhood each day
  const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const startIdx = dayOfYear % neighborhoods.length;

  for (let i = 0; i < neighborhoods.length; i++) {
    if (newCount >= targetCount) break;

    const hood = neighborhoods[(startIdx + i) % neighborhoods.length];

    let nearby;
    try {
      nearby = await nearbySearch({
        lat: hood.lat,
        lng: hood.lng,
        radius: hood.radius,
        type: "restaurant",
      });
      nearbySearchCalls++;
    } catch (error) {
      logger.warn(`[fetchNew] nearbySearch failed for ${hood.name}:`, error.message);
      continue;
    }

    const filtered = nearby.filter((p) => p.business_status !== "CLOSED_PERMANENTLY");
    if (filtered.length === 0) continue;

    // Batch check which restaurants already exist in Firestore
    const refs = filtered.map((p) => db.collection("restaurants").doc(p.place_id));
    const docs = await db.getAll(...refs);
    const existingIds = new Set(docs.filter((d) => d.exists).map((d) => d.id));

    const newPlaces = filtered.filter((p) => !existingIds.has(p.place_id));
    if (newPlaces.length === 0) continue;

    logger.info(`[fetchNew] ${hood.name}: ${newPlaces.length} new out of ${filtered.length}`);

    for (const place of newPlaces) {
      if (newCount >= targetCount) break;

      try {
        const details = await placeDetails(place.place_id);
        detailsCalls++;
        if (!details || details.business_status === "CLOSED_PERMANENTLY") continue;

        if (!details.user_ratings_total || details.user_ratings_total < 10) {
          logger.info(`[fetchNew] Skipped (no reviews): ${details.name}`);
          continue;
        }
        const restaurant = await buildRestaurantDocument(details);
        restaurant.created_at = admin.firestore.FieldValue.serverTimestamp();
        await db.collection("restaurants").doc(restaurant.place_id).set(restaurant);
        newCount++;
        logger.info(`[fetchNew] Added: ${restaurant.name} (${hood.name})`);
      } catch (error) {
        logger.warn(`[fetchNew] placeDetails failed:`, {placeId: place.place_id, error: error.message});
      }
    }
  }

  return {newCount, nearbySearchCalls, detailsCalls};
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

// Fields owned by enrichment (NLP pipeline, validation votes, Cloudinary
// uploads, manual curation) — a Places refresh must never clobber them on
// documents that already exist. buildRestaurantDocument emits empty/default
// values for these, and set({merge:true}) overwrites any field present in
// the payload, so they are stripped for existing docs.
const ENRICHMENT_FIELDS = [
  "mood_tags", "confidence_scores", "nlp_processed",
  "photos", "is_local_concept", "noise_level",
];

async function writeRegionCache(regionKey, restaurants, uploadNewPhotos = false) {
  const regionRef = db.collection("cache_regions").doc(regionKey);
  const batch = db.batch();
  const restaurantIds = [];

  const refs = restaurants.map((r) => db.collection("restaurants").doc(r.place_id));
  const existingSnaps = refs.length ? await db.getAll(...refs) : [];
  const existingIds = new Set(existingSnaps.filter((s) => s.exists).map((s) => s.id));

  for (const restaurant of restaurants) {
    const docId = restaurant.place_id;
    restaurantIds.push(docId);
    let payload = restaurant;
    if (existingIds.has(docId)) {
      payload = {...restaurant};
      for (const field of ENRICHMENT_FIELDS) delete payload[field];
    } else if (uploadNewPhotos && payload.photos?.some((p) => p.photo_reference)) {
      // New restaurant: upload ALL photos to Cloudinary so the carousel never
      // falls back to the Google Photos endpoint (which is billed per request).
      // Failures keep the original photo_reference as a fallback.
      payload.photos = await Promise.all(
          payload.photos.map(async (photo, idx) => {
            if (!photo.photo_reference) return photo;
            const url = await getOrUploadPhoto(photo.photo_reference, docId, idx);
            if (url) return {url, source: "cloudinary", width: photo.width, height: photo.height};
            return photo;
          }),
      );
    }
    batch.set(db.collection("restaurants").doc(docId), payload, {merge: true});
  }

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

/**
 * Global kill-switch for scheduled jobs, flipped automatically by
 * onBudgetAlert the moment real (credit-exhausted) spend appears.
 * Missing doc defaults to enabled so a fresh project still runs.
 */
async function getScheduleConfig() {
  const snap = await db.collection("config").doc("schedules").get();
  const data = snap.exists ? snap.data() : {};
  return {
    enabled: data.enabled !== false,
    hardDisabled: data.hard_disabled === true,
    discoveryEndDate: data.discovery_end_date || null, // "YYYY-MM-DD"
    discoveryCursor: Number(data.discovery_cursor) || 0,
  };
}

/**
 * Budget hard stop: once the billing budget is exceeded, every path that
 * spends on external APIs must refuse until manually re-enabled.
 */
async function assertSpendingAllowed() {
  const config = await getScheduleConfig();
  if (config.hardDisabled) {
    throw new HttpsError("failed-precondition", "Service temporarily disabled by budget guard.");
  }
}

async function fetchAndCacheByCoordinates({lat, lng, radius = 800, maxResults = MAX_RESULTS_DEFAULT, force = false}) {
  const latNumber = Number(lat);
  const lngNumber = Number(lng);
  const radiusNumber = Number(radius);
  const maxResultsNumber = Number(maxResults);

  if (!Number.isFinite(latNumber) || !Number.isFinite(lngNumber)) {
    throw new HttpsError("invalid-argument", "lat and lng are required");
  }

  const regionKey = normalizeRegionKey(latNumber, lngNumber, radiusNumber);
  if (!force) {
    const cachedRestaurants = await readRegionCache(regionKey);
    if (cachedRestaurants) {
      return {source: "cache", count: cachedRestaurants.length, restaurants: cachedRestaurants};
    }
  }

  const nearby = await nearbySearch({
    lat: latNumber,
    lng: lngNumber,
    radius: radiusNumber,
    type: "restaurant",
    force,
    maxResults: maxResultsNumber,
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

  // If nearby returned places but every detail fetch failed (e.g. quota
  // exhausted mid-run), do not overwrite the region cache with an empty list.
  if (selected.length > 0 && restaurants.length === 0) {
    throw new Error("All place detail fetches failed — keeping existing region cache.");
  }

  // Photo uploads only on force (scheduled crawl) — client-facing calls
  // must not pay the upload latency.
  await writeRegionCache(regionKey, restaurants, force);

  return {
    source: "google_places",
    count: restaurants.length,
    restaurants,
  };
}

exports.fetchAndCacheRestaurants = onCall(
    {
      region: "europe-west1",
      maxInstances: 10,
      minInstances: 0,
      concurrency: 1,
      timeoutSeconds: 60,
    },
    async (request) => {
      enforceRateLimit(request, 10);
      await assertSpendingAllowed();
      if (process.env.PIPELINES_DISABLED === "true") {
        return {disabled: true, message: "Pipelines disabled — use cached data only"};
      }
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
      // Crawls every neighborhood — one admin invocation at a time is plenty.
      maxInstances: 1,
      minInstances: 0,
      concurrency: 1,
      timeoutSeconds: 300,
    },
    async () => {
      await assertSpendingAllowed();
      if (process.env.PIPELINES_DISABLED === "true") {
        return {disabled: true, message: "Pipelines disabled for launch"};
      }
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
      maxInstances: 10,
      minInstances: 0,
      concurrency: 1,
      timeoutSeconds: 60,
    },
    async (request) => {
      enforceRateLimit(request, 5);
      try {
        const cached = await db.collection("demand_forecasts").doc("latest").get();
        if (cached.exists) {
          return cached.data();
        }
        return {overall: {score: 0, label: "Unknown"}, message: "No forecast data available"};
      } catch (error) {
        logger.error("getDemandForecast error:", error);
        throw new HttpsError("internal", "Failed to get demand forecast");
      }
    },
);

/**
 * Scheduled function to update demand forecast daily at 08:00 Lisbon.
 * Stores result in Firestore for dashboard/client consumption.
 */
exports.scheduledDemandUpdate = onSchedule(
    {
      schedule: "0 8 * * *",
      timeZone: "Europe/Lisbon",
      region: "europe-west1",
      maxInstances: 1,
    },
    async () => {
      const config = await getScheduleConfig();
      if (!config.enabled) {
        logger.warn("[scheduledDemandUpdate] Schedules disabled (kill switch) — skipping.");
        return;
      }
      logger.info("[scheduledDemandUpdate] Starting daily demand forecast...");
      try {
        const forecast = await calculateDemandForecast();
        await db.collection("demand_forecasts").doc("latest").set({
          ...forecast,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info("[scheduledDemandUpdate] Done.", {score: forecast?.overall?.score});
      } catch (error) {
        logger.error("[scheduledDemandUpdate] Failed:", error);
      }
    },
);

/**
 * Daily restaurant discovery — runs every day at 09:00 Lisbon while the
 * Blaze trial credit lasts (config/schedules.discovery_end_date, then the
 * job goes dormant and the 30-day cache TTL governs again).
 *
 * 09:00 is deliberate: the Places API daily quota resets at midnight
 * Pacific (07:00/08:00 Lisbon), so the job always starts a fresh quota day
 * instead of consuming the tail of the previous one.
 *
 * Force-refreshes NEIGHBORHOODS_PER_DAY neighborhoods in rotation (cursor in
 * config/schedules), so all 44 neighborhoods are re-crawled roughly every
 * 22 days and newly opened restaurants appear within that window.
 *
 * Each neighborhood is crawled up to DISCOVERY_MAX_RESULTS deep (3 paginated
 * nearbySearch pages), so discovery is not limited to the top-20 most
 * prominent places.
 *
 * cost: ~6 nearbySearch pages + ~120 placeDetails per day worst case
 * (~180 + ~3600/month), enforced by monthly counters in
 * api_usage/places_{YYYY-MM} with hard caps below the Places API free-SKU
 * limits — the job stops itself rather than spill into paid usage.
 */
const NEIGHBORHOODS_PER_DAY = 2;
const DISCOVERY_MAX_RESULTS = 60;
const NEARBY_PAGES_PER_NEIGHBORHOOD = 3;
const NEARBY_MONTHLY_CAP = 4000;
const DETAILS_MONTHLY_CAP = 3500;

exports.scheduledMonthlyRefresh = onSchedule(
    {
      schedule: "0 9 * * *",
      timeZone: "Europe/Lisbon",
      region: "europe-west1",
      timeoutSeconds: 540,
      memory: "512MiB",
      maxInstances: 1,
      secrets: [cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret],
    },
    async () => {
      const config = await getScheduleConfig();
      if (!config.enabled) {
        logger.warn("[dailyDiscovery] Schedules disabled (kill switch) — skipping.");
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      if (config.discoveryEndDate && today > config.discoveryEndDate) {
        logger.info("[dailyDiscovery] Past discovery_end_date — skipping.", {
          endDate: config.discoveryEndDate,
        });
        return;
      }

      const monthKey = `places_${today.slice(0, 7)}`;
      const usageRef = db.collection("api_usage").doc(monthKey);
      const usageSnap = await usageRef.get();
      const usage = usageSnap.exists ? usageSnap.data() : {};
      let nearbyCalls = Number(usage.nearby_calls) || 0;
      let detailCalls = Number(usage.detail_calls) || 0;

      let cursor = config.discoveryCursor % neighborhoods.length;
      let refreshed = 0;
      let found = 0;
      let errors = 0;

      for (let i = 0; i < NEIGHBORHOODS_PER_DAY; i++) {
        // Stop before any call that could break the monthly free-tier caps.
        if (nearbyCalls + NEARBY_PAGES_PER_NEIGHBORHOOD > NEARBY_MONTHLY_CAP ||
            detailCalls + DISCOVERY_MAX_RESULTS > DETAILS_MONTHLY_CAP) {
          logger.warn("[dailyDiscovery] Monthly Places cap reached — stopping early.", {
            nearbyCalls, detailCalls,
          });
          break;
        }

        const neighborhood = neighborhoods[cursor];

        try {
          const response = await fetchAndCacheByCoordinates({
            lat: neighborhood.lat,
            lng: neighborhood.lng,
            radius: neighborhood.radius,
            maxResults: DISCOVERY_MAX_RESULTS,
            force: true,
          });
          refreshed++;
          found += response.count;
          // Conservative overcount: reserve the pagination worst case.
          nearbyCalls += NEARBY_PAGES_PER_NEIGHBORHOOD;
          detailCalls += response.count;
          logger.info(`[dailyDiscovery] Refreshed ${neighborhood.name}`, {
            count: response.count,
          });
          // Advance only on success so a failed neighborhood (transient API
          // error, quota exhaustion) is retried tomorrow instead of waiting
          // a full rotation cycle.
          cursor = (cursor + 1) % neighborhoods.length;
        } catch (error) {
          logger.error(`[dailyDiscovery] Failed for ${neighborhood.name}:`, error);
          errors++;
          break;
        }
      }

      await usageRef.set({
        nearby_calls: nearbyCalls,
        detail_calls: detailCalls,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      await db.collection("config").doc("schedules").set({
        discovery_cursor: cursor,
      }, {merge: true});

      logger.info("[dailyDiscovery] Done.", {refreshed, found, errors, cursor});
    },
);

/**
 * Budget kill switch. The billing budget (credits included) publishes spend
 * snapshots to the budget-alerts topic; the instant real cost appears the
 * scheduled jobs are disabled via config/schedules.enabled = false.
 */
exports.onBudgetAlert = onMessagePublished(
    {
      topic: "budget-alerts",
      region: "europe-west1",
      maxInstances: 1,
    },
    async (event) => {
      try {
        const data = event.data.message.json;
        const cost = Number(data.costAmount) || 0;
        // The console budget amount is the line. Fallback guard if the
        // message ever arrives without one.
        const budget = Number(data.budgetAmount) || 50;

        if (cost >= budget) {
          // 100%: full stop — schedulers skip and every external-API path
          // (Places, Gemini, photo uploads) refuses via assertSpendingAllowed.
          await db.collection("config").doc("schedules").set({
            enabled: false,
            hard_disabled: true,
            disabled_reason: `budget exceeded: cost ${cost}/${budget} ${data.currencyCode || ""}`,
            disabled_at: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
          logger.error("[onBudgetAlert] BUDGET EXCEEDED — system spending HARD-DISABLED.", {
            costAmount: cost, budgetAmount: budget,
          });
        } else if (cost >= budget * 0.9) {
          // 90%: stop discretionary scheduled spend, keep serving users.
          await db.collection("config").doc("schedules").set({
            enabled: false,
            disabled_reason: `budget at 90%: cost ${cost}/${budget} ${data.currencyCode || ""}`,
            disabled_at: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
          logger.warn("[onBudgetAlert] Budget at 90% — scheduled jobs disabled.", {
            costAmount: cost, budgetAmount: budget,
          });
        } else {
          logger.info("[onBudgetAlert] Spend update within budget.", {
            costAmount: cost, budgetAmount: budget,
          });
        }
      } catch (error) {
        logger.error("[onBudgetAlert] Failed to process budget message:", error);
      }
    },
);

exports.runFullLisbonPipeline = onCall(
    {
      region: "europe-west1",
      timeoutSeconds: 540,
      memory: "1GiB",
      maxInstances: 1,
      secrets: [cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret],
    },
    async () => {
      await assertSpendingAllowed();
      if (process.env.PIPELINES_DISABLED === "true") {
        return {disabled: true, message: "Pipelines disabled for launch"};
      }
      return await runFullPipeline(neighborhoods, filters);
    },
);

/**
 * Check all restaurants in Firestore against Google Places API
 * and update business_status field (OPERATIONAL, CLOSED_PERMANENTLY, CLOSED_TEMPORARILY)
 */

/**
 * Check a specific restaurant by place_id
 */
exports.checkRestaurantById = onCall(
    {
      region: "europe-west1",
      maxInstances: 10,
      minInstances: 0,
      concurrency: 1,
      timeoutSeconds: 60,
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

      // Get from Google Places API (skip if pipelines disabled)
      let googleData = null;
      if (process.env.PIPELINES_DISABLED !== "true") {
        try {
          googleData = await placeDetails(placeId);
        } catch (error) {
          logger.error("Failed to fetch from Google", error);
        }
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

/**
 * Import manual scores from Excel data
 * Expects base64 encoded Excel file in request.data.fileData
 */
exports.importManualScoresFromExcel = onCall(
    {
      region: "europe-west1",
      timeoutSeconds: 540,
      memory: "1GiB",
      maxInstances: 1,
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
      maxInstances: 1,
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


/**
 * Get statistics about restaurant ratings
 */
exports.getRestaurantRatingStats = onCall(
    {
      region: "europe-west1",
      maxInstances: 10,
      minInstances: 0,
      concurrency: 1,
      timeoutSeconds: 60,
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
 * Export all restaurants from Firestore to Excel
 * Returns base64 encoded Excel file with all restaurant fields
 */
exports.exportAllRestaurants = onRequest(
    {
      region: "europe-west1",
      timeoutSeconds: 300,
      memory: "512MiB",
      maxInstances: 1,
    },
    async (req, res) => {
      const secret = req.headers["x-nomi-secret"];
      if (secret !== process.env.MANUAL_TRIGGER_SECRET) {
        return res.status(401).json({error: "Unauthorized"});
      }

      logger.info("Exporting all restaurants...");

      const snapshot = await db.collection("restaurants").get();
      logger.info(`Found ${snapshot.size} restaurants to export`);

      const XLSX = require("xlsx");
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
          budget_level: d.budget_level || "",
          business_status: d.business_status || "",
          phone: d.phone || "",
          website: d.website || "",
          noise_level: d.noise_level || "",
          is_local_concept: d.is_local_concept ? "YES" : "NO",
          is_open_monday: d.opening_hours?.is_open_monday ? "YES" : "NO",
          mood_tags: (d.mood_tags || []).join(", "),
          nlp_processed: d.nlp_processed ? "YES" : "NO",
          has_manual_scoring: d.has_manual_scoring ? "YES" : "NO",
          mood_score_romantic: d.nlp_scores?.romantic ?? d.mood_scores?.romantic ?? "",
          mood_score_energetic: d.nlp_scores?.energetic ?? d.mood_scores?.energetic ?? "",
          mood_score_chill: d.nlp_scores?.chill ?? d.mood_scores?.chill ?? "",
          mood_score_explorer: d.nlp_scores?.explorer ?? d.mood_scores?.explorer ?? "",
          mood_score_focus: d.nlp_scores?.focus ?? d.mood_scores?.focus ?? "",
          mood_score_hungry_quick: d.nlp_scores?.hungry_quick ?? d.mood_scores?.hungry_quick ?? "",
          photo_count: (d.photos || []).length,
        });
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Restaurants");
      const buffer = XLSX.write(workbook, {type: "buffer", bookType: "xlsx"});
      const base64 = buffer.toString("base64");

      logger.info(`Export completed: ${rows.length} restaurants`);

      return res.json({
        count: rows.length,
        fileData: base64,
        filename: `all_restaurants_${Date.now()}.xlsx`,
      });
    },
);

/**
 * Generate Google Photo URLs for frontend
 * Creates URLs on backend to avoid exposing API key on client-side
 */
exports.getPhotoUrls = onCall(
    {
      region: "europe-west1",
      maxInstances: 10,
      minInstances: 0,
      concurrency: 1,
      timeoutSeconds: 60,
    },
    async (request) => {
      enforceRateLimit(request, 20);
      await assertSpendingAllowed();
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
      maxInstances: 1,
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

// PMO scoring endpoints (exportForPmoScoring, importPmoScores) removed June 2026

/**
 * Haversine distance in metres between two lat/lng points
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @return {number} Distance in metres
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // metres
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Smart 6 Recommendation Algorithm
 * Returns 6 personalized restaurant recommendations based on mood, budget,
 * distance, swipe history, and diversity rules.
 *
 * Input: { userId, moods[], budgetLevel, distance, userLat, userLng }
 * Output: { restaurants[6], meta: { algorithm, candidateCount, fallback, secondChance } }
 */
exports.getSmartRecommendations = onCall(
    {
      region: "europe-west1",
      timeoutSeconds: 30,
      maxInstances: 10,
      minInstances: 0,
      concurrency: 1,
    },
    async (request) => {
      enforceRateLimit(request, 15);
      const {userId, moods = [], budgetLevel, distance, userLat, userLng} = request.data || {};

      // Normalize moods: "hungry&quick" → "hungry_quick"
      const normalizedMoods = moods.map((m) =>
        m.replace(/&/g, "_").replace(/\s+/g, "_").toLowerCase(),
      );

      const meta = {
        algorithm: "smart6_v1",
        candidateCount: 0,
        fallback: false,
        secondChance: false,
      };

      // Daily Firestore read quota guard — tracked in RTDB (free, sub-ms).
      // Soft-throttles at 40K/day to stay safely under the 50K free-tier limit.
      const today = new Date().toISOString().slice(0, 10);
      const quotaRef = admin.database().ref(`quotaGuard/firestoreReads/${today}`);
      let estimatedReads = 1; // counts reads accumulated during this call
      try {
        const currentReads = (await quotaRef.once("value")).val() || 0;
        if (currentReads >= 40000) {
          logger.warn("[quota] Daily Firestore read limit reached", {currentReads});
          throw new HttpsError("resource-exhausted", "Service busy, try again later");
        }
      } catch (e) {
        if (e instanceof HttpsError) throw e;
        logger.warn("[quota] read counter check failed:", e.message);
      }

      try {
        // --- 1. Build candidate pool ---
        let candidates = [];

        // Cost: geohash region cache. The candidate pool is shared across users
        // in the same coarse area + prefs, so we cache it and read 1 doc instead
        // of querying dozens. Per-user swipe filtering and scoring still run.
        const CANDIDATE_LIMIT = 40;
        const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
        const round = (n) => Math.round(n * 100) / 100; // ~1.1km grid cell
        const moodKey = [...normalizedMoods].sort().join("-") || "any";
        // Distance is part of the key: the location-first pool below depends
        // on the selected range, so a 500m pool must not be served to a 10km
        // request in the same grid cell.
        const regionKey = (userLat != null && userLng != null) ?
          `${round(userLat)}_${round(userLng)}_${budgetLevel || "any"}_${moodKey}_${distance || "any"}` :
          null;

        let cacheHit = false;
        if (regionKey) {
          try {
            const cacheSnap = await db.collection("recommendation_cache").doc(regionKey).get();
            if (cacheSnap.exists) {
              const cdata = cacheSnap.data();
              const ageMs = Date.now() - (cdata.cached_at?.toMillis?.() ?? 0);
              if (ageMs < CACHE_TTL_MS && Array.isArray(cdata.candidates) && cdata.candidates.length) {
                candidates = cdata.candidates;
                cacheHit = true;
                meta.cached = true;
              }
            }
          } catch (e) {
            logger.warn("recommendation_cache read failed:", e?.message);
          }
        }

        // --- 1a. Location-first pool ---
        // The user's position and selected range are the primary signal: pull
        // restaurants around them from the crawl region caches and hard-filter
        // to the selected range. The city-wide mood/budget queries below only
        // top up when this local list is thin, so a "Nearby/500m" user in
        // Cascais is never handed a Lisbon restaurant while closer ones exist.
        const LOCAL_DOC_CAP = 60;
        if (!cacheHit && userLat != null && userLng != null) {
          const searchRadius = distance || 10000;
          const nearbyHoods = neighborhoods.filter((n) =>
            haversineDistance(userLat, userLng, n.lat, n.lng) <= searchRadius + n.radius);
          if (nearbyHoods.length > 0) {
            const regionRefs = nearbyHoods.map((n) =>
              db.collection("cache_regions").doc(normalizeRegionKey(n.lat, n.lng, n.radius)));
            const regionSnaps = await db.getAll(...regionRefs);
            estimatedReads += regionSnaps.length;
            const localIds = new Set();
            regionSnaps.forEach((s) => {
              if (s.exists) {
                (s.data().restaurant_ids || []).forEach((id) => localIds.add(id));
              }
            });
            const idList = [...localIds].slice(0, LOCAL_DOC_CAP);
            if (idList.length > 0) {
              const docs = await db.getAll(
                  ...idList.map((id) => db.collection("restaurants").doc(id)));
              estimatedReads += idList.length;
              candidates = docs
                  .filter((d) => d.exists)
                  .map((d) => ({id: d.id, ...d.data(), _local: true}))
                  .filter((c) => {
                    const lat = c.location?.lat;
                    const lng = c.location?.lng;
                    if (lat == null || lng == null) return false;
                    if (c.business_status && c.business_status !== "OPERATIONAL") return false;
                    if (budgetLevel && c.budget_level && c.budget_level > budgetLevel) return false;
                    return haversineDistance(userLat, userLng, lat, lng) <= searchRadius;
                  });
              meta.localCount = candidates.length;
            }
          }
        }

        // Primary query: mood_tags + business_status OPERATIONAL + budget_level.
        // Only tops up when the location-first pool is thin.
        if (!cacheHit && candidates.length < 10 && normalizedMoods.length > 0 && budgetLevel) {
          const primaryQuery = db.collection("restaurants")
              .where("mood_tags", "array-contains-any", normalizedMoods)
              .where("business_status", "==", "OPERATIONAL")
              .where("budget_level", "==", budgetLevel)
              .orderBy("google_rating", "desc")
              .limit(CANDIDATE_LIMIT);
          const primarySnap = await primaryQuery.get();
          estimatedReads += primarySnap.size;
          const existingIds = new Set(candidates.map((c) => c.id));
          primarySnap.docs.forEach((doc) => {
            if (!existingIds.has(doc.id)) {
              candidates.push({id: doc.id, ...doc.data()});
              existingIds.add(doc.id);
            }
          });
        }

        // Fallback tier 0: mood + business_status (no budget filter)
        if (!cacheHit && candidates.length < 10 && normalizedMoods.length > 0) {
          const moodStatusQuery = db.collection("restaurants")
              .where("mood_tags", "array-contains-any", normalizedMoods)
              .where("business_status", "==", "OPERATIONAL")
              .orderBy("google_rating", "desc")
              .limit(CANDIDATE_LIMIT);
          const moodStatusSnap = await moodStatusQuery.get();
          estimatedReads += moodStatusSnap.size;
          const existingIds = new Set(candidates.map((c) => c.id));
          moodStatusSnap.docs.forEach((doc) => {
            if (!existingIds.has(doc.id)) {
              candidates.push({id: doc.id, ...doc.data()});
              existingIds.add(doc.id);
            }
          });
        }

        // Fallback tier 1: mood only (no business_status filter)
        if (!cacheHit && candidates.length < 10 && normalizedMoods.length > 0) {
          const moodOnlyQuery = db.collection("restaurants")
              .where("mood_tags", "array-contains-any", normalizedMoods)
              .orderBy("google_rating", "desc")
              .limit(CANDIDATE_LIMIT);
          const moodOnlySnap = await moodOnlyQuery.get();
          estimatedReads += moodOnlySnap.size;
          const existingIds = new Set(candidates.map((c) => c.id));
          moodOnlySnap.docs.forEach((doc) => {
            if (!existingIds.has(doc.id)) {
              candidates.push({id: doc.id, ...doc.data()});
              existingIds.add(doc.id);
            }
          });
        }

        // Fallback tier 2: budget only
        if (!cacheHit && candidates.length < 10) {
          const budgetQuery = db.collection("restaurants")
              .where("budget_level", "==", budgetLevel)
              .orderBy("google_rating", "desc")
              .limit(CANDIDATE_LIMIT);
          const budgetSnap = await budgetQuery.get();
          estimatedReads += budgetSnap.size;
          const existingIds = new Set(candidates.map((c) => c.id));
          budgetSnap.docs.forEach((doc) => {
            if (!existingIds.has(doc.id)) {
              candidates.push({id: doc.id, ...doc.data()});
              existingIds.add(doc.id);
            }
          });
        }

        // Fallback tier 3: all restaurants
        if (!cacheHit && candidates.length < 10) {
          const allQuery = db.collection("restaurants")
              .orderBy("google_rating", "desc")
              .limit(CANDIDATE_LIMIT);
          const allSnap = await allQuery.get();
          estimatedReads += allSnap.size;
          const existingIds = new Set(candidates.map((c) => c.id));
          allSnap.docs.forEach((doc) => {
            if (!existingIds.has(doc.id)) {
              candidates.push({id: doc.id, ...doc.data()});
              existingIds.add(doc.id);
            }
          });
        }

        // Cache the freshly-built shared pool (trimmed to keep the doc small;
        // write is best-effort — if it fails we just skip caching this round).
        if (!cacheHit && regionKey && candidates.length) {
          try {
            await db.collection("recommendation_cache").doc(regionKey).set({
              candidates: candidates.slice(0, 30),
              cached_at: admin.firestore.FieldValue.serverTimestamp(),
              mood_key: moodKey,
              budget_level: budgetLevel || null,
            });
          } catch (e) {
            logger.warn("recommendation_cache write failed:", e?.message);
          }
        }

        // Budget post-filter: strict match → escalate one level → full pool.
        // Keeps expensive restaurants out when enough cheaper ones exist, but
        // never leaves the user with an empty deck.
        if (budgetLevel) {
          const strictMatch = candidates.filter(
              (c) => !c.budget_level || c.budget_level <= budgetLevel,
          );
          if (strictMatch.length >= 6) {
            candidates = strictMatch;
          } else if (budgetLevel < 3) {
            const nextLevel = candidates.filter(
                (c) => !c.budget_level || c.budget_level <= budgetLevel + 1,
            );
            if (nextLevel.length >= 6) {
              candidates = nextLevel;
            }
            // else: keep full pool as last resort
          }
        }

        // Exclude restaurants with no Cloudinary photo — they would show a blank card
        candidates = candidates.filter((c) => c.photos?.[0]?.url);

        meta.candidateCount = candidates.length;

        // --- 1b. Distance filtering ---
        if (userLat != null && userLng != null) {
          candidates = candidates.map((c) => {
            const lat = c.location?.lat;
            const lng = c.location?.lng;
            if (lat != null && lng != null) {
              const dist = haversineDistance(userLat, userLng, lat, lng);
              c._distanceMetres = dist;
              c.distance = dist < 1000 ?
                `${Math.round(dist)} m` :
                `${(dist / 1000).toFixed(1)} km`;
            }
            return c;
          });

          if (distance) {
            // Soft distance filter: prefer restaurants within range, but if too
            // few qualify (e.g. "Nearby/500m" around a sparse area), backfill
            // with the nearest out-of-range ones so we never return an empty
            // list. Mirrors the client-side fallback behaviour.
            const TARGET = 12;
            const inRange = candidates.filter(
                (c) => c._distanceMetres == null || c._distanceMetres <= distance,
            );
            // Anything within the selected range counts as local, wherever it
            // came from — the location-first sort must rank it above far
            // backfills.
            inRange.forEach((c) => {
              if (c._distanceMetres != null) c._local = true;
            });
            if (inRange.length >= TARGET) {
              candidates = inRange;
            } else {
              const outRange = candidates
                  .filter((c) => c._distanceMetres != null &&
                                 c._distanceMetres > distance)
                  .sort((a, b) => a._distanceMetres - b._distanceMetres);
              candidates = [
                ...inRange,
                ...outRange.slice(0, TARGET - inRange.length),
              ];
            }
          }
        }

        // --- 2. Fetch ALL swipe history ---
        const likedIds = new Set();
        const passedIds = new Set();

        if (userId) {
          const swipeQuery = db.collection("swipes")
              .where("user_id", "==", userId)
              .orderBy("timestamp", "desc")
              .limit(400); // cost: bound the per-call swipe history read
          const swipeSnap = await swipeQuery.get();
          estimatedReads += swipeSnap.size;

          swipeSnap.docs.forEach((doc) => {
            const data = doc.data();
            if (data.direction === "like") {
              likedIds.add(data.restaurant_id);
            } else {
              passedIds.add(data.restaurant_id);
            }
          });
        }

        // --- 3. Filter candidates ---
        // Always exclude liked (already saved)
        let filtered = candidates.filter((c) => !likedIds.has(c.id));
        // In normal mode, also exclude passed
        const passedCandidates = filtered.filter((c) => passedIds.has(c.id));
        filtered = filtered.filter((c) => !passedIds.has(c.id));

        // --- 4. Second Chance ---
        if (filtered.length < 9 && passedCandidates.length > 0) {
          meta.secondChance = true;
          // Add passed restaurants back with low freshness
          passedCandidates.forEach((c) => {
            c._secondChance = true;
            filtered.push(c);
          });
        }

        // If all restaurants were liked, return empty
        if (filtered.length === 0) {
          return {restaurants: [], meta};
        }

        // --- 5. Score each candidate ---
        const scored = filtered.map((c) => {
          // Mood match score (from confidence_scores)
          let moodScore = 0;
          if (normalizedMoods.length > 0 && c.confidence_scores) {
            const scores = normalizedMoods
                .map((m) => c.confidence_scores[m] || 0)
                .filter((s) => s > 0);
            moodScore = scores.length > 0 ?
              scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          }
          // Fallback: check if mood_tags match
          if (moodScore === 0 && c.mood_tags && normalizedMoods.length > 0) {
            const matchCount = normalizedMoods.filter(
                (m) => c.mood_tags.includes(m),
            ).length;
            moodScore = matchCount > 0 ? (matchCount / normalizedMoods.length) * 70 : 0;
          }

          // Quality score
          const qualityScore = ((c.google_rating || 0) / 5) * 100;

          // Freshness
          let freshness = 100; // never seen
          if (c._secondChance) {
            freshness = 20;
          }

          // Photo bonus: restaurants with photos rank higher
          const hasPhotos = Array.isArray(c.photos) && c.photos.length > 0;
          const photoBonus = hasPhotos ? 100 : 0;

          // Random factor
          const randomFactor = Math.random() * 100;

          // Budget penalty: heavily demote restaurants that exceed the selected level.
          const overBudget = budgetLevel && c.budget_level && c.budget_level > budgetLevel;
          const budgetPenalty = overBudget ? -80 : 0;

          const selectionScore =
            moodScore * 0.50 +
            qualityScore * 0.18 +
            freshness * 0.12 +
            photoBonus * 0.12 +
            randomFactor * 0.08 +
            budgetPenalty;

          return {...c, _selectionScore: selectionScore};
        });

        // Sort location-first: candidates from the user's selected range beat
        // city-wide pool top-ups regardless of score; score orders within
        // each group.
        scored.sort((a, b) =>
          ((b._local ? 1 : 0) - (a._local ? 1 : 0)) ||
          (b._selectionScore - a._selectionScore));

        // --- 6. Diversity enforcement ---
        const selected = [];
        const neighborhoodCount = {};
        const budgetCount = {};

        const pickIfDiverse = (candidate) => {
          const hood = candidate.neighborhood || "unknown";
          const bLevel = candidate.budget_level || 0;

          // Neighborhood diversity only makes sense for city-wide pools:
          // within a selected range everything shares a neighborhood, so
          // capping would push far backfills into the deck. Unknown hoods are
          // not a real group either.
          const hoodCapApplies = !candidate._local && hood !== "unknown";
          if (hoodCapApplies && (neighborhoodCount[hood] || 0) >= 2) return false;
          if ((budgetCount[bLevel] || 0) >= 5) return false;

          selected.push(candidate);
          neighborhoodCount[hood] = (neighborhoodCount[hood] || 0) + 1;
          budgetCount[bLevel] = (budgetCount[bLevel] || 0) + 1;
          return true;
        };

        // --- 7. Slot allocation ---
        const selectedIds = new Set();

        // Slots 1-4: Top scoring
        for (const c of scored) {
          if (selected.length >= 4) break;
          if (selectedIds.has(c.id)) continue;
          if (pickIfDiverse(c)) {
            selectedIds.add(c.id);
          }
        }

        // Slots 5-6: Random from top 20%
        const top20Cutoff = Math.max(1, Math.ceil(scored.length * 0.2));
        const top20Pool = scored
            .slice(0, top20Cutoff)
            .filter((c) => !selectedIds.has(c.id));
        // Shuffle top 20% pool
        for (let i = top20Pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [top20Pool[i], top20Pool[j]] = [top20Pool[j], top20Pool[i]];
        }
        for (const c of top20Pool) {
          if (selected.length >= 6) break;
          if (selectedIds.has(c.id)) continue;
          if (pickIfDiverse(c)) {
            selectedIds.add(c.id);
          }
        }

        // Fill remaining slots from scored list
        for (const c of scored) {
          if (selected.length >= 6) break;
          if (selectedIds.has(c.id)) continue;
          if (pickIfDiverse(c)) {
            selectedIds.add(c.id);
          }
        }

        // If diversity rules prevented filling, relax and fill
        if (selected.length < 6) {
          for (const c of scored) {
            if (selected.length >= 6) break;
            if (selectedIds.has(c.id)) continue;
            selected.push(c);
            selectedIds.add(c.id);
          }
        }

        // Clean internal fields before returning
        const restaurants = selected.map((c) => {
          delete c._selectionScore;
          delete c._secondChance;
          delete c._distanceMetres;
          delete c._local;
          return c;
        });

        const sessionRef = db.collection("recommendation_sessions").doc();
        await sessionRef.set({
          uid: request.auth?.uid ?? null,
          moods: normalizedMoods,
          budget_level: budgetLevel || 2,
          shown_restaurant_ids: restaurants.map((r) => r.id),
          algorithm: meta.algorithm,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Persist read count to RTDB — fire-and-forget, never blocks the response.
        quotaRef.transaction((n) => (n || 0) + estimatedReads).catch((e) =>
          logger.warn("[quota] counter update failed:", e.message),
        );

        return {restaurants, meta, sessionId: sessionRef.id};
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error("getSmartRecommendations error:", error);
        throw new HttpsError("internal", "Failed to get recommendations");
      }
    },
);

exports.scheduledGeminiNlp = onSchedule(
    {
      schedule: "0 1 * * *",
      timeZone: "Europe/Lisbon",
      region: "europe-west1",
      timeoutSeconds: 540,
      memory: "512MiB",
      maxInstances: 1,
    },
    async () => {
      const config = await getScheduleConfig();
      if (!config.enabled) {
        logger.warn("[scheduledGeminiNlp] Schedules disabled (kill switch) — skipping.");
        return;
      }
      // Step 1: Fetch up to 20 new restaurants not yet in Firestore
      logger.info("[scheduledGeminiNlp] Step 1: Fetching new restaurants...");
      const fetchResult = await fetchNewRestaurants(20);
      logger.info("[scheduledGeminiNlp] Fetch done.", fetchResult);

      // Step 2: Run NLP on unprocessed restaurants (batch of 20, free tier daily limit)
      logger.info("[scheduledGeminiNlp] Step 2: Running NLP batch (20)...");
      const nlpResult = await runGeminiNlpBatch(20);
      logger.info("[scheduledGeminiNlp] Done.", nlpResult);
    },
);

exports.manualGeminiNlp = onRequest(
    {
      region: "europe-west1",
      timeoutSeconds: 540,
      memory: "256MiB",
      maxInstances: 1,
    },
    async (req, res) => {
      const config = await getScheduleConfig();
      if (config.hardDisabled) {
        return res.status(503).json({error: "Service temporarily disabled by budget guard."});
      }
      if (process.env.PIPELINES_DISABLED === "true") {
        return res.json({disabled: true, message: "Pipelines disabled for launch"});
      }
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
      maxInstances: 1,
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

// ─── Push Notification Functions ───────────────────────────────────────────────

/**
 * Notify room participants when a new user joins a group room
 */
exports.notifyGroupInvite = onCall(
    {
      region: "europe-west1",
      maxInstances: 10,
      minInstances: 0,
      concurrency: 1,
      timeoutSeconds: 60,
    },
    async (request) => {
      const {roomCode, inviterName} = request.data || {};
      const senderUid = request.auth?.uid;

      if (!roomCode) {
        throw new HttpsError("invalid-argument", "roomCode is required");
      }

      const result = await notifyRoomParticipants(roomCode, senderUid, "groupInvites", {
        title: "Someone joined your room!",
        body: `${inviterName || "A friend"} joined room ${roomCode}`,
        data: {type: "group_invite", roomCode},
      });

      logger.info("notifyGroupInvite result", {roomCode, result});
      return result;
    },
);

/**
 * Notify room participants when the host starts voting
 */
exports.notifyVotingStarted = onCall(
    {
      region: "europe-west1",
      maxInstances: 10,
      minInstances: 0,
      concurrency: 1,
      timeoutSeconds: 60,
    },
    async (request) => {
      const {roomCode} = request.data || {};
      const senderUid = request.auth?.uid;

      if (!roomCode) {
        throw new HttpsError("invalid-argument", "roomCode is required");
      }

      const result = await notifyRoomParticipants(roomCode, senderUid, "groupInvites", {
        title: "Voting has started!",
        body: "Time to swipe and pick your favourites",
        data: {type: "voting_started", roomCode},
      });

      logger.info("notifyVotingStarted result", {roomCode, result});
      return result;
    },
);

/**
 * Notify room participants when the group vote result is ready
 */
exports.notifyResultReady = onCall(
    {
      region: "europe-west1",
      maxInstances: 10,
      minInstances: 0,
      concurrency: 1,
      timeoutSeconds: 60,
    },
    async (request) => {
      const {roomCode, restaurantName} = request.data || {};
      const senderUid = request.auth?.uid;

      if (!roomCode) {
        throw new HttpsError("invalid-argument", "roomCode is required");
      }

      const body = restaurantName ?
        `The group has decided: ${restaurantName}!` :
        "The group has decided! Check the result.";

      const result = await notifyRoomParticipants(roomCode, senderUid, "groupInvites", {
        title: "Nomi has decided!",
        body,
        data: {type: "result_ready", roomCode},
      });

      logger.info("notifyResultReady result", {roomCode, result});
      return result;
    },
);

// Client-facing API callables — the mobile app never touches Firestore/RTDB
// directly; all reads/writes go through these (see clientApi.js).
const clientApi = require("./clientApi");
exports.userApi = clientApi.userApi;
exports.roomApi = clientApi.roomApi;
exports.restaurantApi = clientApi.restaurantApi;
