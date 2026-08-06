/**
 * Client-facing API callables.
 *
 * All Firestore/RTDB access from the mobile app goes through these three
 * multiplexed callables (userApi, roomApi, restaurantApi) so the client never
 * touches the database directly. Multiplexing actions into three functions
 * (instead of ~18 separate ones) keeps the deployed Cloud Run service count
 * low and cold starts manageable during MVP.
 *
 * Every action validates request.auth and derives the acting user from
 * request.auth.uid — user ids sent by the client are never trusted.
 */
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const {onCall, HttpsError} = require("firebase-functions/v2/https");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const {FieldValue} = admin.firestore;

const REGION = "europe-west1";
const CANONICAL_MOODS = ["romantic", "energetic", "chill", "explorer", "focus", "hungry_quick"];

// ── Shared helpers ───────────────────────────────────────────────────

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  return request.auth.uid;
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpsError("invalid-argument", `${name} is required`);
  }
  return value;
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

// ── Badge system ─────────────────────────────────────────────────────

// Badge thresholds (must stay in sync with ProfileScreen ALL_BADGES):
//   romantic_scout    — 5 likes while in "romantic" mood
//   local_expert      — 10 validation votes
//   connector         — 3 group rooms organised
//   night_owl         — 3 swipes recorded after 22:00 UTC
//   trendsetter       — first to like 3 different restaurants (tracked on users.trendsetter_count)
//   hidden_gem_hunter — 3 likes on restaurants with google_rating < 3.8 (tracked on users.hidden_gem_count)

async function computeAndUpdateBadges(uid) {
  const [userSnap, romanticLikesAgg, votesAgg, roomsAgg, nightOwlAgg] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("swipes")
        .where("user_id", "==", uid)
        .where("direction", "==", "like")
        .where("moods", "array-contains", "romantic")
        .count().get(),
    db.collection("votes").where("user_id", "==", uid).count().get(),
    db.collection("rooms").where("organizer_uid", "==", uid).count().get(),
    db.collection("swipes")
        .where("user_id", "==", uid)
        .where("hour", ">=", 22)
        .count().get(),
  ]);

  if (!userSnap.exists) return;
  const userData = userSnap.data();

  const earned = [];
  if (romanticLikesAgg.data().count >= 5) earned.push("romantic_scout");
  if (votesAgg.data().count >= 10) earned.push("local_expert");
  if (roomsAgg.data().count >= 3) earned.push("connector");
  if (nightOwlAgg.data().count >= 3) earned.push("night_owl");
  if ((userData.trendsetter_count || 0) >= 3) earned.push("trendsetter");
  if ((userData.hidden_gem_count || 0) >= 3) earned.push("hidden_gem_hunter");

  if (earned.length === 0) return;
  const existing = userData.badges || [];
  const toAdd = earned.filter((b) => !existing.includes(b));
  if (toAdd.length > 0) {
    await db.collection("users").doc(uid).update({badges: FieldValue.arrayUnion(...toAdd)});
  }
}

// ── User actions ─────────────────────────────────────────────────────

async function ensureUserDocument(uid, email, displayName) {
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();

  const emailName = email && email.includes("@") ? email.split("@")[0] : "";
  const name = displayName || emailName || "Foodie";

  if (!snap.exists) {
    await ref.set({
      display_name: name,
      email: email || "",
      points: 0,
      badges: [],
      segment: "new",
      preference_history: {moods: [], budget: 2, dist: 1},
      streak: 0,
      notification_preferences: {
        groupInvites: true,
        newRestaurants: false,
        validateReminders: true,
      },
      created_at: FieldValue.serverTimestamp(),
    });
    return {created: true};
  }

  // Backfill missing core fields without clobbering existing data.
  const data = snap.data();
  const patch = {};
  if (!data.display_name && (displayName || emailName)) {
    patch.display_name = displayName || emailName;
  }
  if (!data.email && email) patch.email = email;
  if (Object.keys(patch).length > 0) {
    await ref.set(patch, {merge: true});
  }
  return {created: false};
}

async function updateUserSettings(uid, data) {
  const patch = {};
  if (typeof data.displayName === "string" && data.displayName.trim()) {
    patch.display_name = data.displayName.trim();
  }
  if (data.notificationPreferences && typeof data.notificationPreferences === "object") {
    patch.notification_preferences = {
      groupInvites: data.notificationPreferences.groupInvites === true,
      newRestaurants: data.notificationPreferences.newRestaurants === true,
      validateReminders: data.notificationPreferences.validateReminders === true,
    };
  }
  if ("pushToken" in data) {
    patch.expo_push_token = typeof data.pushToken === "string" ? data.pushToken : null;
    patch.push_token_updated_at = new Date().toISOString();
  }
  if (Object.keys(patch).length === 0) {
    throw new HttpsError("invalid-argument", "No settings to update");
  }
  await db.collection("users").doc(uid).set(patch, {merge: true});
  return {ok: true};
}

async function getUserProfile(uid) {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data();

  // Counts via server-side aggregation — 1 read each instead of N docs.
  const [votesAgg, roomsAgg] = await Promise.all([
    db.collection("votes").where("user_id", "==", uid).count().get(),
    db.collection("rooms").where("organizer_uid", "==", uid).count().get(),
  ]);

  const emailName =
    typeof data.email === "string" && data.email.includes("@") ?
      data.email.split("@")[0] :
      null;

  return {
    displayName: data.display_name || data.displayName || emailName || "Foodie",
    points: data.points || 0,
    createdAtMs: data.created_at ? data.created_at.toMillis() : null,
    restaurantsVisited: data.liked_restaurants?.length || 0,
    restaurantsValidated: votesAgg.data().count,
    groupSessions: roomsAgg.data().count,
    badges: data.badges || [],
    likedRestaurants: data.liked_restaurants || [],
  };
}

async function getSavedRestaurants(uid) {
  const userSnap = await db.collection("users").doc(uid).get();
  const ids = (userSnap.exists && userSnap.data().liked_restaurants || [])
      .filter((id) => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return [];

  const refs = ids.map((id) => db.collection("restaurants").doc(id));
  const snaps = await db.getAll(...refs);
  return snaps
      .filter((s) => s.exists)
      .map((s) => ({id: s.id, ...s.data()}));
}

async function setRestaurantSaved(uid, restaurantId, saved) {
  await db.collection("users").doc(uid).set({
    liked_restaurants: saved ?
      FieldValue.arrayUnion(restaurantId) :
      FieldValue.arrayRemove(restaurantId),
  }, {merge: true});
  return {ok: true};
}

async function isRestaurantSaved(uid, restaurantId) {
  const snap = await db.collection("users").doc(uid).get();
  const liked = snap.exists ? (snap.data().liked_restaurants || []) : [];
  return {saved: liked.includes(restaurantId)};
}

async function recordSwipe(uid, restaurantId, direction, moods) {
  if (direction !== "like" && direction !== "pass") {
    throw new HttpsError("invalid-argument", "direction must be like or pass");
  }
  const safeMoods = Array.isArray(moods) ?
    moods.filter((m) => CANONICAL_MOODS.includes(m)) :
    [];

  // UTC hour is stored so night_owl badge can be computed via a count query.
  const hour = new Date().getUTCHours();

  const batch = db.batch();
  batch.set(db.collection("swipes").doc(), {
    user_id: uid,
    restaurant_id: restaurantId,
    direction,
    moods: safeMoods,
    hour,
    timestamp: FieldValue.serverTimestamp(),
  });

  if (direction === "like") {
    const userUpdate = {
      liked_restaurants: FieldValue.arrayUnion(restaurantId),
      points: FieldValue.increment(2),
    };

    // Read restaurant once to derive badge signals.
    const restaurantSnap = await db.collection("restaurants").doc(restaurantId).get();
    if (restaurantSnap.exists) {
      const r = restaurantSnap.data();

      // hidden_gem_hunter: liked a restaurant with a below-average rating.
      if (typeof r.google_rating === "number" && r.google_rating < 3.8) {
        userUpdate.hidden_gem_count = FieldValue.increment(1);
      }

      // trendsetter: first user to like this restaurant (best-effort, no transaction).
      if (!r.first_liker) {
        batch.update(db.collection("restaurants").doc(restaurantId), {first_liker: uid});
        userUpdate.trendsetter_count = FieldValue.increment(1);
      }
    }

    batch.set(db.collection("users").doc(uid), userUpdate, {merge: true});
  }

  await batch.commit();
  computeAndUpdateBadges(uid).catch((e) =>
    logger.error("badge compute error", {uid, error: e.message}),
  );
  return {ok: true};
}

async function recordValidation(uid, restaurantId, moodTag, direction) {
  if (!CANONICAL_MOODS.includes(moodTag)) {
    throw new HttpsError("invalid-argument", "Unknown mood tag");
  }
  if (typeof direction !== "boolean") {
    throw new HttpsError("invalid-argument", "direction must be a boolean");
  }

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const restaurantSnap = await restaurantRef.get();

  const batch = db.batch();
  batch.set(db.collection("votes").doc(), {
    user_id: uid,
    restaurant_id: restaurantId,
    tag: moodTag,
    direction,
    timestamp: FieldValue.serverTimestamp(),
  });
  batch.set(db.collection("users").doc(uid), {
    points: FieldValue.increment(5),
  }, {merge: true});
  if (restaurantSnap.exists) {
    batch.set(restaurantRef, {
      confidence_scores: {[moodTag]: FieldValue.increment(direction ? 5 : -5)},
    }, {merge: true});
  }
  await batch.commit();
  computeAndUpdateBadges(uid).catch((e) =>
    logger.error("badge compute error", {uid, error: e.message}),
  );
  return {ok: true};
}

exports.userApi = onCall(
    {
      region: REGION,
      maxInstances: 10,
      minInstances: 0,
      concurrency: 1,
      timeoutSeconds: 60,
    },
    async (request) => {
      const uid = requireAuth(request);
      const data = request.data || {};
      const action = requireString(data.action, "action");

      try {
        switch (action) {
          case "ensureDocument":
            return await ensureUserDocument(uid, request.auth.token.email || "", data.displayName);
          case "updateSettings":
            return await updateUserSettings(uid, data);
          case "getProfile":
            return await getUserProfile(uid);
          case "getSavedRestaurants":
            return await getSavedRestaurants(uid);
          case "setRestaurantSaved":
            return await setRestaurantSaved(uid, requireString(data.restaurantId, "restaurantId"), data.saved === true);
          case "isRestaurantSaved":
            return await isRestaurantSaved(uid, requireString(data.restaurantId, "restaurantId"));
          case "recordSwipe":
            return await recordSwipe(uid, requireString(data.restaurantId, "restaurantId"), data.direction, data.moods);
          case "recordValidation":
            return await recordValidation(uid, requireString(data.restaurantId, "restaurantId"), data.moodTag, data.direction);
          default:
            throw new HttpsError("invalid-argument", `Unknown action: ${action}`);
        }
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error("userApi error", {action, uid, error: error.message});
        throw new HttpsError("internal", "Operation failed");
      }
    },
);

// ── Room actions ─────────────────────────────────────────────────────

async function createRoom(uid, code, name, preferences) {
  await db.collection("rooms").doc(code).set({
    code,
    organizer_uid: uid,
    participants: {
      [uid]: {
        name: name || "Host",
        joined_at: admin.firestore.Timestamp.now(),
      },
    },
    votes: {},
    status: "waiting",
    created_at: admin.firestore.Timestamp.now(),
    ...(preferences && {preferences}),
  });
  computeAndUpdateBadges(uid).catch((e) =>
    logger.error("badge compute error", {uid, error: e.message}),
  );
  return {ok: true};
}

async function joinRoom(uid, code, name, token) {
  if (token?.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("permission-denied", "Sign in with an account to join group rooms");
  }
  const roomRef = db.collection("rooms").doc(code);
  const snap = await roomRef.get();
  if (!snap.exists) return {ok: false};

  await roomRef.update({
    [`participants.${uid}`]: {
      name: name || "Guest",
      joined_at: admin.firestore.Timestamp.now(),
    },
  });
  return {ok: true};
}

async function setRoomRestaurantList(uid, code, restaurantIds) {
  if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
    throw new HttpsError("invalid-argument", "restaurantIds must be a non-empty array");
  }
  const roomRef = db.collection("rooms").doc(code);
  const snap = await roomRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Room not found");
  if (snap.data().organizer_uid !== uid) {
    throw new HttpsError("permission-denied", "Only organizer can set restaurant list");
  }
  await roomRef.update({restaurant_ids: restaurantIds});
  return {ok: true};
}

async function leaveRoom(uid, code) {
  const roomRef = db.collection("rooms").doc(code);
  const snap = await roomRef.get();
  if (!snap.exists) return {ok: true};

  await roomRef.update({
    [`participants.${uid}`]: FieldValue.delete(),
  });
  return {ok: true};
}

async function setRoomPreferences(code, preferences) {
  if (!preferences || typeof preferences !== "object") {
    throw new HttpsError("invalid-argument", "preferences is required");
  }
  await db.collection("rooms").doc(code).update({preferences});
  return {ok: true};
}

async function getRoomPreferences(code) {
  const snap = await db.collection("rooms").doc(code).get();
  if (!snap.exists) return {preferences: null};
  return {preferences: snap.data().preferences || null};
}

async function recordRoomVote(uid, code, restaurantId, vote) {
  if (vote !== "like" && vote !== "pass") {
    throw new HttpsError("invalid-argument", "vote must be like or pass");
  }
  await db.collection("rooms").doc(code).update({
    [`votes.${uid}.${restaurantId}`]: vote,
  });
  return {ok: true};
}

async function declareWinner(uid, code, winnerId) {
  const roomRef = db.collection("rooms").doc(code);
  const snap = await roomRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Room not found");
  }
  if (snap.data().organizer_uid !== uid) {
    throw new HttpsError("permission-denied", "Only the organizer can declare a winner");
  }

  const batch = db.batch();
  batch.update(roomRef, {winner_id: winnerId, status: "decided"});
  batch.set(db.collection("users").doc(uid), {
    points: FieldValue.increment(100),
  }, {merge: true});
  await batch.commit();
  return {ok: true};
}

async function setEventDetails(code, details) {
  if (!details || typeof details !== "object") {
    throw new HttpsError("invalid-argument", "details is required");
  }
  const payload = {
    event_time: details.event_time || "",
    restaurant_id: details.restaurant_id || "",
    attendance: details.attendance || {},
    note: details.note || "",
  };

  // RTDB for real-time sync, Firestore for persistence.
  await admin.database().ref(`rooms/${code}/event`).update(payload);
  await db.collection("rooms").doc(code).update({
    event_time: payload.event_time,
    restaurant_id: payload.restaurant_id,
    note: payload.note,
  });
  return {ok: true};
}

async function updateAttendance(uid, code, status) {
  if (!["going", "not_going", "maybe"].includes(status)) {
    throw new HttpsError("invalid-argument", "Invalid attendance status");
  }
  await admin.database().ref(`rooms/${code}/event/attendance/${uid}`).set(status);
  return {ok: true};
}

async function recordFinalVote(uid, code, restaurantId) {
  await admin.database().ref(`rooms/${code}/final_votes/${uid}`).set(restaurantId);
  return {ok: true};
}

async function recordPreferenceVote(uid, code, preferences) {
  if (!preferences || typeof preferences !== "object") {
    throw new HttpsError("invalid-argument", "preferences is required");
  }
  await admin.database().ref(`rooms/${code}/preference_votes/${uid}`).set({
    moods: Array.isArray(preferences.moods) ? preferences.moods : [],
    budget: Number(preferences.budget) || 2,
    distance: Number(preferences.distance) || 5,
  });
  return {ok: true};
}

exports.roomApi = onCall(
    {
      region: REGION,
      maxInstances: 10,
      minInstances: 0,
      concurrency: 1,
      timeoutSeconds: 60,
    },
    async (request) => {
      const uid = requireAuth(request);
      const data = request.data || {};
      const action = requireString(data.action, "action");
      const code = requireString(data.code, "code");

      try {
        switch (action) {
          case "create":
            return await createRoom(uid, code, data.name, data.preferences);
          case "join":
            return await joinRoom(uid, code, data.name, request.auth.token);
          case "setRestaurantList":
            return await setRoomRestaurantList(uid, code, data.restaurantIds);
          case "leave":
            return await leaveRoom(uid, code);
          case "setPreferences":
            return await setRoomPreferences(code, data.preferences);
          case "getPreferences":
            return await getRoomPreferences(code);
          case "recordVote":
            return await recordRoomVote(uid, code, requireString(data.restaurantId, "restaurantId"), data.vote);
          case "declareWinner":
            return await declareWinner(uid, code, requireString(data.winnerId, "winnerId"));
          case "setEventDetails":
            return await setEventDetails(code, data.details);
          case "updateAttendance":
            return await updateAttendance(uid, code, data.status);
          case "recordFinalVote":
            return await recordFinalVote(uid, code, requireString(data.restaurantId, "restaurantId"));
          case "recordPreferenceVote":
            return await recordPreferenceVote(uid, code, data.preferences);
          default:
            throw new HttpsError("invalid-argument", `Unknown action: ${action}`);
        }
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error("roomApi error", {action, uid, error: error.message});
        throw new HttpsError("internal", "Operation failed");
      }
    },
);

// ── Restaurant actions ───────────────────────────────────────────────

function attachDistances(restaurants, userLat, userLng, maxDistance) {
  if (userLat == null || userLng == null) return restaurants;

  for (const r of restaurants) {
    const lat = r.location?.lat;
    const lng = r.location?.lng;
    if (lat != null && lng != null) {
      const dist = haversineDistance(userLat, userLng, lat, lng);
      r._m = dist;
      r.distance = formatDistance(dist);
    }
  }

  restaurants.sort((a, b) => (a._m ?? Infinity) - (b._m ?? Infinity));

  if (maxDistance) {
    const inside = restaurants.filter((r) => r._m == null || r._m <= maxDistance);
    const outside = restaurants.filter((r) => r._m != null && r._m > maxDistance);
    restaurants = [...inside, ...outside];
  }

  for (const r of restaurants) delete r._m;
  return restaurants;
}

async function getRestaurantById(id) {
  const snap = await db.collection("restaurants").doc(id).get();
  if (!snap.exists) return null;
  return {id: snap.id, ...snap.data()};
}

async function getRestaurantsByMood(data) {
  const moods = Array.isArray(data.moods) ?
    data.moods.filter((m) => CANONICAL_MOODS.includes(m)) :
    [];
  const budgetLevel = Number(data.budgetLevel) || 2;
  const maxResults = Math.min(Number(data.maxResults) || 6, 30);
  const pool = maxResults * 3;

  const seen = new Set();
  let restaurants = [];
  const addDocs = (snap) => {
    for (const d of snap.docs) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        restaurants.push({id: d.id, ...d.data()});
      }
    }
  };

  const col = db.collection("restaurants");

  // Tier 1: mood + budget
  try {
    if (moods.length > 0) {
      addDocs(await col
          .where("mood_tags", "array-contains-any", moods)
          .where("budget_level", "==", budgetLevel)
          .limit(pool).get());
    }
  } catch (_) {/* index missing, skip */}

  // Tier 2: mood only
  if (restaurants.length < pool && moods.length > 0) {
    try {
      addDocs(await col
          .where("mood_tags", "array-contains-any", moods)
          .limit(pool).get());
    } catch (_) {/* skip */}
  }

  // Tier 3: budget only
  if (restaurants.length < pool) {
    try {
      addDocs(await col.where("budget_level", "==", budgetLevel).limit(pool).get());
    } catch (_) {/* skip */}
  }

  // Tier 4: all restaurants
  if (restaurants.length < maxResults) {
    try {
      addDocs(await col.limit(pool).get());
    } catch (_) {/* skip */}
  }

  restaurants = attachDistances(restaurants, data.userLat, data.userLng, data.maxDistance);
  return {restaurants: restaurants.slice(0, maxResults)};
}

async function getRestaurantsForValidation(uid, data) {
  const moods = Array.isArray(data.moods) ?
    data.moods.filter((m) => CANONICAL_MOODS.includes(m)) :
    [];
  const maxResults = Math.min(Number(data.maxResults) || 10, 30);

  // 1. Restaurants this user has already voted on
  const votedIds = new Set();
  const votesSnap = await db.collection("votes").where("user_id", "==", uid).get();
  votesSnap.forEach((d) => {
    const rid = d.data().restaurant_id;
    if (rid) votedIds.add(rid);
  });

  // 2. Candidate pool, excluding already-voted restaurants
  const seen = new Set();
  const pool = [];
  const addDocs = (snap) => {
    for (const d of snap.docs) {
      if (!seen.has(d.id) && !votedIds.has(d.id)) {
        seen.add(d.id);
        pool.push({id: d.id, ...d.data()});
      }
    }
  };

  const fetchLimit = Math.max(maxResults * 3, 30);
  const col = db.collection("restaurants");

  try {
    if (moods.length > 0) {
      addDocs(await col
          .where("mood_tags", "array-contains-any", moods)
          .limit(fetchLimit).get());
    }
  } catch (_) {/* index missing, skip */}

  if (pool.length < maxResults) {
    try {
      addDocs(await col.limit(fetchLimit).get());
    } catch (_) {/* skip */}
  }

  // 3. Display distances (no filtering)
  if (data.userLat != null && data.userLng != null) {
    for (const r of pool) {
      const lat = r.location?.lat;
      const lng = r.location?.lng;
      if (lat != null && lng != null) {
        r.distance = formatDistance(haversineDistance(data.userLat, data.userLng, lat, lng));
      }
    }
  }

  // 4. Shuffle (Fisher-Yates) so the order is random every session
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return {restaurants: pool.slice(0, maxResults)};
}

exports.restaurantApi = onCall(
    {
      region: REGION,
      maxInstances: 10,
      minInstances: 0,
      concurrency: 1,
      timeoutSeconds: 60,
    },
    async (request) => {
      const uid = requireAuth(request);
      const data = request.data || {};
      const action = requireString(data.action, "action");

      try {
        switch (action) {
          case "getById":
            return await getRestaurantById(requireString(data.id, "id"));
          case "getByMood":
            return await getRestaurantsByMood(data);
          case "getForValidation":
            return await getRestaurantsForValidation(uid, data);
          default:
            throw new HttpsError("invalid-argument", `Unknown action: ${action}`);
        }
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error("restaurantApi error", {action, uid, error: error.message});
        throw new HttpsError("internal", "Operation failed");
      }
    },
);
