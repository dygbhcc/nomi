import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export async function getRestaurantsByRegion({ lat, lng, radius = 800, maxResults = 40 }) {
  const callFetchAndCache = httpsCallable(functions, "fetchAndCacheRestaurants");
  const response = await callFetchAndCache({ lat, lng, radius, maxResults });
  return response.data;
}
