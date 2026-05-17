function passesQualityFilters(place, filters) {
  // Must be operational
  if (place.business_status && place.business_status !== filters.businessStatus) {
    return false;
  }

  // Rating filter
  if (place.rating && place.rating < filters.minRating) {
    return false;
  }

  // Review count filter
  if (place.user_ratings_total && place.user_ratings_total < filters.minReviewCount) {
    return false;
  }

  // Must have a name
  if (!place.name) return false;

  // Must have location
  if (!place.geometry?.location) return false;

  return true;
}

function isNewRestaurant(placeId, existingPlaceIds) {
  return !existingPlaceIds.has(placeId);
}

module.exports = {passesQualityFilters, isNewRestaurant};
