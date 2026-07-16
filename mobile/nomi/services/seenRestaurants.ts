import AsyncStorage from '@react-native-async-storage/async-storage';

// Local swipe-history cache so the spark-mode fallback deck can avoid
// repeating restaurants. Device-local by design: the swipes collection is
// create-only for clients, so the seen list cannot be read back from
// Firestore without a rules change.
const KEY = '@nomi_seen_restaurant_ids';
const CAP = 500;

export const getSeenRestaurantIds = async (): Promise<Set<string>> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};

export const markRestaurantSeen = async (id: string): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (ids.includes(id)) return;
    ids.push(id);
    // Keep only the newest CAP entries so storage stays bounded
    await AsyncStorage.setItem(KEY, JSON.stringify(ids.slice(-CAP)));
  } catch {
    // Best-effort local cache; losing an entry only means a repeat card
  }
};
