const {Expo} = require("expo-server-sdk");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

const expo = new Expo();

/**
 * Send a push notification to a single user.
 * Checks the user's push token and notification preference before sending.
 *
 * @param {string} targetUid - The user's Firestore uid
 * @param {string} preferenceKey - Key in notification_preferences to check (e.g. 'groupInvites')
 * @param {object} message - { title, body, data }
 * @return {Promise<object>} Result with status
 */
async function sendNotificationToUser(targetUid, preferenceKey, message) {
  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(targetUid).get();

  if (!userDoc.exists) {
    return {status: "skipped", reason: "user_not_found"};
  }

  const userData = userDoc.data();
  const token = userData.expo_push_token;

  if (!token) {
    return {status: "skipped", reason: "no_token"};
  }

  // Check preference
  if (preferenceKey) {
    const prefs = userData.notification_preferences || {};
    if (prefs[preferenceKey] === false) {
      return {status: "skipped", reason: "preference_disabled"};
    }
  }

  // Validate token format
  if (!Expo.isExpoPushToken(token)) {
    logger.warn("Invalid Expo push token", {uid: targetUid, token});
    return {status: "skipped", reason: "invalid_token"};
  }

  try {
    const tickets = await expo.sendPushNotificationsAsync([
      {
        to: token,
        sound: "default",
        title: message.title,
        body: message.body,
        data: message.data || {},
      },
    ]);

    return {status: "sent", ticket: tickets[0]};
  } catch (error) {
    logger.error("Failed to send notification", {
      uid: targetUid,
      error: error.message,
    });
    return {status: "error", error: error.message};
  }
}

/**
 * Send push notifications to multiple users.
 *
 * @param {string[]} targetUids - Array of user uids
 * @param {string} preferenceKey - Preference key to check
 * @param {object} message - { title, body, data }
 * @return {Promise<object[]>} Array of results
 */
async function sendNotificationToUsers(targetUids, preferenceKey, message) {
  const results = await Promise.all(
      targetUids.map((uid) => sendNotificationToUser(uid, preferenceKey, message)),
  );
  return results;
}

/**
 * Send push notifications to all participants in a room, excluding the sender.
 *
 * @param {string} roomCode - The room code
 * @param {string} senderUid - The uid of the user who triggered the notification (excluded)
 * @param {string} preferenceKey - Preference key to check
 * @param {object} message - { title, body, data }
 * @return {Promise<object>} Summary of results
 */
async function notifyRoomParticipants(roomCode, senderUid, preferenceKey, message) {
  const db = admin.firestore();
  const roomDoc = await db.collection("rooms").doc(roomCode).get();

  if (!roomDoc.exists) {
    return {status: "error", reason: "room_not_found"};
  }

  const roomData = roomDoc.data();
  const participants = roomData.participants || {};
  const targetUids = Object.keys(participants).filter((uid) => uid !== senderUid);

  if (targetUids.length === 0) {
    return {status: "skipped", reason: "no_other_participants"};
  }

  const results = await sendNotificationToUsers(targetUids, preferenceKey, message);

  const sent = results.filter((r) => r.status === "sent").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  return {sent, skipped, errors, total: targetUids.length};
}

module.exports = {
  sendNotificationToUser,
  sendNotificationToUsers,
  notifyRoomParticipants,
};
