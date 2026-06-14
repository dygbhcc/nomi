import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

// Fallback location: Lisbon center. Used when the user denies permission, the
// device location is unavailable, or the user is outside the coverage area
// (the restaurant catalogue is Lisbon-based).
export const LISBON_COORDS: Coords = { lat: 38.7223, lng: -9.1393 };

// Coverage radius around Lisbon center. Users farther than this (e.g. remote
// testers abroad) are snapped to Lisbon center so they still get usable
// results instead of restaurants thousands of km away. Lift/expand this when
// the catalogue grows beyond Lisbon.
const COVERAGE_RADIUS_METRES = 50000; // 50 km — greater Lisbon area

function distanceMetres(a: Coords, b: Coords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Requests foreground location permission and returns the device coordinates.
 * - Returns null if permission is denied or the location cannot be resolved, so
 *   callers can fall back to a default (e.g. LISBON_COORDS).
 * - If the user is outside the Lisbon coverage area, returns LISBON_COORDS so
 *   recommendations remain usable.
 */
export const getUserCoords = async (): Promise<Coords | null> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    // Prefer the last known position (instant); fall back to a fresh fix.
    let pos = await Location.getLastKnownPositionAsync();
    if (!pos) {
      pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    }
    if (!pos) return null;

    const coords: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };

    // Outside coverage → snap to Lisbon center.
    if (distanceMetres(coords, LISBON_COORDS) > COVERAGE_RADIUS_METRES) {
      return LISBON_COORDS;
    }

    return coords;
  } catch {
    return null;
  }
};
