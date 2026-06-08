const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const { fetchAndCacheRestaurants } = require("./src/places/fetchAndCacheRestaurants");

exports.fetchAndCacheRestaurants = fetchAndCacheRestaurants;
