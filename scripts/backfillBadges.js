/**
 * One-time backfill: computes badge signals for all existing users and awards
 * earned badges based on historical data.
 *
 * Steps:
 *   1. Add `hour` field to existing swipes that are missing it (needed for night_owl index).
 *   2. Set `first_liker` on restaurants that have been liked but lack the field
 *      (earliest swipe wins), and update users' `trendsetter_count`.
 *   3. Compute `hidden_gem_count` for each user from their liked restaurants.
 *   4. Award badges to all users who have earned them.
 *
 * Run from the repo root:
 *   node scripts/backfillBadges.js
 */

require("dotenv").config({ path: "./functions/.env" });
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.SERVICE_ACCOUNT_PROJECT_ID,
    clientEmail: process.env.SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const BADGE_THRESHOLDS = {
  romantic_scout: 5,
  local_expert: 10,
  connector: 3,
  night_owl: 3,
  trendsetter: 3,
  hidden_gem_hunter: 3,
};

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function commitBatch(batch) {
  await batch.commit();
}

// ── Step 1: backfill `hour` on swipes ──────────────────────────────

async function backfillSwipeHours() {
  console.log("\n[1/4] Backfilling hour field on swipes...");
  const snap = await db.collection("swipes").get();
  const toUpdate = snap.docs.filter((d) => d.data().hour === undefined);
  console.log(`  ${toUpdate.length} swipes missing hour field`);

  let updated = 0;
  for (const chunks of chunk(toUpdate, 400)) {
    const b = db.batch();
    for (const doc of chunks) {
      const ts = doc.data().timestamp;
      const hour = ts ? ts.toDate().getUTCHours() : 12; // default noon if no timestamp
      b.update(doc.ref, { hour });
    }
    await commitBatch(b);
    updated += chunks.length;
    process.stdout.write(`  updated ${updated}/${toUpdate.length}\r`);
  }
  console.log(`  Done — ${updated} swipes updated.`);
}

// ── Step 2: set first_liker + trendsetter_count ─────────────────────

async function backfillFirstLikers() {
  console.log("\n[2/4] Computing first likers...");

  // Read all swipes and filter/sort in memory (avoids needing a direction+timestamp index).
  const swipesSnap = await db.collection("swipes").get();
  const likeSwipes = swipesSnap.docs
      .filter((d) => d.data().direction === "like")
      .sort((a, b) => {
        const ta = a.data().timestamp?.toMillis() || 0;
        const tb = b.data().timestamp?.toMillis() || 0;
        return ta - tb;
      });

  // Map restaurant → earliest liker uid.
  const firstLikers = {};
  for (const doc of likeSwipes) {
    const { restaurant_id, user_id } = doc.data();
    if (!firstLikers[restaurant_id]) firstLikers[restaurant_id] = user_id;
  }

  // For each restaurant without first_liker, set it.
  const restaurantIds = Object.keys(firstLikers);
  console.log(`  ${restaurantIds.length} restaurants have at least one like`);

  const trendsetterDelta = {}; // uid → count to increment

  for (const ids of chunk(restaurantIds, 10)) {
    const refs = ids.map((id) => db.collection("restaurants").doc(id));
    const snaps = await db.getAll(...refs);
    const b = db.batch();
    for (const s of snaps) {
      if (!s.exists) continue;
      if (!s.data().first_liker) {
        const uid = firstLikers[s.id];
        b.update(s.ref, { first_liker: uid });
        trendsetterDelta[uid] = (trendsetterDelta[uid] || 0) + 1;
      }
    }
    await commitBatch(b);
  }

  // Write trendsetter_count to users.
  const trendsetterEntries = Object.entries(trendsetterDelta);
  console.log(`  ${trendsetterEntries.length} users get trendsetter_count`);
  for (const entries of chunk(trendsetterEntries, 400)) {
    const b = db.batch();
    for (const [uid, delta] of entries) {
      b.set(
          db.collection("users").doc(uid),
          { trendsetter_count: FieldValue.increment(delta) },
          { merge: true }
      );
    }
    await commitBatch(b);
  }
  console.log("  Done.");
}

// ── Step 3: compute hidden_gem_count ───────────────────────────────

async function backfillHiddenGemCounts() {
  console.log("\n[3/4] Computing hidden gem counts...");

  const usersSnap = await db.collection("users").get();
  const allLikedIds = new Set();
  const userLiked = {};
  for (const doc of usersSnap.docs) {
    const liked = doc.data().liked_restaurants || [];
    userLiked[doc.id] = liked;
    liked.forEach((id) => allLikedIds.add(id));
  }

  // Batch-read all liked restaurants.
  const restaurantIdList = [...allLikedIds];
  const ratingMap = {};
  for (const ids of chunk(restaurantIdList, 10)) {
    const refs = ids.map((id) => db.collection("restaurants").doc(id));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      if (s.exists) ratingMap[s.id] = s.data().google_rating;
    }
  }

  // Compute per-user hidden gem counts.
  const gemCounts = {};
  for (const [uid, liked] of Object.entries(userLiked)) {
    const count = liked.filter(
        (id) => typeof ratingMap[id] === "number" && ratingMap[id] < 3.8
    ).length;
    if (count > 0) gemCounts[uid] = count;
  }

  console.log(`  ${Object.keys(gemCounts).length} users have hidden gem likes`);
  for (const entries of chunk(Object.entries(gemCounts), 400)) {
    const b = db.batch();
    for (const [uid, count] of entries) {
      b.set(
          db.collection("users").doc(uid),
          { hidden_gem_count: count },
          { merge: true }
      );
    }
    await commitBatch(b);
  }
  console.log("  Done.");
}

// ── Step 4: award badges ───────────────────────────────────────────
// Computes entirely in memory from a single read of each collection so it does
// not depend on the new composite indexes (which may still be building).

async function backfillBadges() {
  console.log("\n[4/4] Awarding badges (in-memory computation)...");

  // Read everything we need in one shot.
  const [usersSnap, swipesSnap, votesSnap, roomsSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("swipes").get(),
    db.collection("votes").get(),
    db.collection("rooms").get(),
  ]);

  // Build per-user aggregates from raw data.
  const romanticLikes = {}; // uid → count of romantic likes
  const nightOwlSwipes = {}; // uid → count of swipes with hour >= 22
  const voteCount = {}; // uid → total votes
  const roomCount = {}; // uid → rooms organised

  for (const doc of swipesSnap.docs) {
    const { user_id, direction, moods, hour } = doc.data();
    if (direction === "like" && Array.isArray(moods) && moods.includes("romantic")) {
      romanticLikes[user_id] = (romanticLikes[user_id] || 0) + 1;
    }
    if (typeof hour === "number" && hour >= 22) {
      nightOwlSwipes[user_id] = (nightOwlSwipes[user_id] || 0) + 1;
    }
  }
  for (const doc of votesSnap.docs) {
    const { user_id } = doc.data();
    voteCount[user_id] = (voteCount[user_id] || 0) + 1;
  }
  for (const doc of roomsSnap.docs) {
    const { organizer_uid } = doc.data();
    if (organizer_uid) roomCount[organizer_uid] = (roomCount[organizer_uid] || 0) + 1;
  }

  // Award badges.
  const activeUsers = usersSnap.docs.filter(
      (d) => (d.data().points || 0) > 0 || (d.data().liked_restaurants || []).length > 0
  );
  console.log(`  Processing ${activeUsers.length} active users`);

  let awarded = 0;
  for (const userDoc of activeUsers) {
    const uid = userDoc.id;
    const userData = userDoc.data();

    const earned = [];
    if ((romanticLikes[uid] || 0) >= BADGE_THRESHOLDS.romantic_scout) earned.push("romantic_scout");
    if ((voteCount[uid] || 0) >= BADGE_THRESHOLDS.local_expert) earned.push("local_expert");
    if ((roomCount[uid] || 0) >= BADGE_THRESHOLDS.connector) earned.push("connector");
    if ((nightOwlSwipes[uid] || 0) >= BADGE_THRESHOLDS.night_owl) earned.push("night_owl");
    if ((userData.trendsetter_count || 0) >= BADGE_THRESHOLDS.trendsetter) earned.push("trendsetter");
    if ((userData.hidden_gem_count || 0) >= BADGE_THRESHOLDS.hidden_gem_hunter) earned.push("hidden_gem_hunter");

    if (earned.length > 0) {
      const existing = userData.badges || [];
      const toAdd = earned.filter((b) => !existing.includes(b));
      if (toAdd.length > 0) {
        await db.collection("users").doc(uid).update({
          badges: FieldValue.arrayUnion(...toAdd),
        });
        console.log(`  ${userData.display_name || uid.substring(0, 8)} → +[${toAdd.join(", ")}]`);
        awarded++;
      }
    }
  }
  console.log(`  Done — ${awarded} users received new badges.`);
}

async function main() {
  console.log("=== Badge Backfill ===");
  await backfillSwipeHours();
  await backfillFirstLikers();
  await backfillHiddenGemCounts();
  await backfillBadges();
  console.log("\n=== Complete ===");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
