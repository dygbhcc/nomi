const admin = require("firebase-admin");
const {nearbySearch, placeDetails} = require("./googlePlacesService");
const {passesQualityFilters, isNewRestaurant} = require("./qualityFilterService");
const {getOrUploadPhoto} = require("./cloudinaryService");
const logger = require("firebase-functions/logger");

function getDb() {
  return admin.firestore();
}

async function getExistingPlaceIds() {
  const db = getDb();
  const snap = await db.collection("restaurants")
      .select("place_id")
      .get();
  return new Set(snap.docs.map((d) => d.data().place_id).filter(Boolean));
}

async function fetchNeighborhoodRestaurants(neighborhood, filters, existingPlaceIds) {
  const {name, lat, lng, radius} = neighborhood;

  logger.info(`Fetching: ${name}`);

  const nearby = await nearbySearch({
    lat, lng, radius,
    type: filters.type,
  });

  const newPlaces = nearby.filter((place) =>
    passesQualityFilters(place, filters) &&
    isNewRestaurant(place.place_id, existingPlaceIds),
  );

  logger.info(`${name}: ${nearby.length} found, ${newPlaces.length} new after filters`);

  const results = [];

  for (const place of newPlaces) {
    try {
      const details = await placeDetails(place.place_id);
      if (!details) continue;

      if (!passesQualityFilters(details, filters)) continue;

      let photoUrl = null;
      if (details.photos && details.photos.length > 0) {
        photoUrl = await getOrUploadPhoto(
            details.photos[0].photo_reference,
            details.place_id,
            0,
        ).catch(() => null);
      }

      const doc = {
        place_id: details.place_id,
        name: details.name,
        address: details.formatted_address || "",
        location: {
          lat: details.geometry.location.lat,
          lng: details.geometry.location.lng,
        },
        budget_level: details.price_level || 2,
        mood_tags: [],
        confidence_scores: {},
        opening_hours: {
          is_open_monday: isOpenMonday(details.opening_hours),
          periods: details.opening_hours?.periods || [],
        },
        business_status: details.business_status || "OPERATIONAL",
        noise_level: "unknown",
        phone: details.formatted_phone_number || "",
        website: details.website || "",
        google_rating: details.rating || 0,
        review_count: details.user_ratings_total || 0,
        photos: photoUrl ? [{
          url: photoUrl,
          source: "cloudinary",
          width: details.photos[0].width,
          height: details.photos[0].height,
        }] : [],
        neighborhood: name,
        cache_date: admin.firestore.FieldValue.serverTimestamp(),
        is_local_concept: false,
        is_pmo_verified: false,
      };

      results.push(doc);
      existingPlaceIds.add(details.place_id);
    } catch (error) {
      logger.warn(`Failed to fetch details for ${place.place_id}:`, error.message);
    }
  }

  return results;
}

function isOpenMonday(openingHours) {
  if (!openingHours?.weekday_text) return false;
  const monday = openingHours.weekday_text.find((t) => t.toLowerCase().startsWith("monday"));
  return monday ? !monday.toLowerCase().includes("closed") : false;
}

async function batchWriteToFirestore(restaurants) {
  const db = getDb();
  const BATCH_SIZE = 400;
  let written = 0;

  for (let i = 0; i < restaurants.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = restaurants.slice(i, i + BATCH_SIZE);

    chunk.forEach((restaurant) => {
      const ref = db.collection("restaurants").doc(restaurant.place_id);
      batch.set(ref, restaurant, {merge: true});
    });

    await batch.commit();
    written += chunk.length;
    logger.info(`Written ${written}/${restaurants.length} restaurants`);
  }

  return written;
}

async function runFullPipeline(neighborhoods, filters) {
  logger.info("Starting full pipeline...");

  const existingPlaceIds = await getExistingPlaceIds();
  logger.info(`Existing restaurants in Firestore: ${existingPlaceIds.size}`);

  const allNewRestaurants = [];

  for (const neighborhood of neighborhoods) {
    try {
      const newRestaurants = await fetchNeighborhoodRestaurants(
          neighborhood,
          filters,
          existingPlaceIds,
      );
      allNewRestaurants.push(...newRestaurants);

      // Small delay to avoid API rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      logger.error(`Failed for ${neighborhood.name}:`, error.message);
    }
  }

  logger.info(`Total new restaurants found: ${allNewRestaurants.length}`);

  if (allNewRestaurants.length > 0) {
    const written = await batchWriteToFirestore(allNewRestaurants);
    logger.info(`Successfully written: ${written}`);
  }

  return {
    existingCount: existingPlaceIds.size,
    newCount: allNewRestaurants.length,
    totalAfter: existingPlaceIds.size + allNewRestaurants.length,
  };
}

module.exports = {runFullPipeline};
