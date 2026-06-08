const MAX_DISTANCE_KM = 5;

export function filterOpenMondayRestaurants(restaurants = []) {
  return restaurants.filter((r) => r?.opening_hours?.is_open_monday === true);
}

export function scoreByMood(restaurants = [], selectedMoods = []) {
  return restaurants
    .map((restaurant) => {
      const confidenceScores = restaurant.confidence_scores || {};
      const moodScore = selectedMoods.reduce((sum, mood) => sum + (confidenceScores[mood] || 0), 0);
      return { ...restaurant, moodScore };
    })
    .sort((a, b) => b.moodScore - a.moodScore);
}

export function clampDistancePreference(distanceKm) {
  return Math.max(0, Math.min(MAX_DISTANCE_KM, Number(distanceKm || 0)));
}
