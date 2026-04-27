const axios = require("axios");

const PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place";

function getApiKey() {
  const key = process.env.GOOGLE_PLACES_API_KEY || "";
  if (!key) {
    throw new Error("GOOGLE_PLACES_API_KEY is not set.");
  }
  return key;
}

async function nearbySearch({lat, lng, radius, type = "restaurant"}) {
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
  return response.data.results || [];
}

async function placeDetails(placeId) {
  const key = getApiKey();
  const url = `${PLACES_BASE_URL}/details/json`;
  const response = await axios.get(url, {
    params: {
      place_id: placeId,
      fields:
        "place_id,name,formatted_address,geometry,opening_hours,formatted_phone_number,website,rating,price_level,photos",
      key,
    },
  });
  return response.data.result || null;
}

module.exports = {
  nearbySearch,
  placeDetails,
};
