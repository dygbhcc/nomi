const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

/**
 * Fetch manually curated events from Firestore
 * Add events via Firebase Console: Collection "manual_events"
 *
 * Document structure:
 * {
 *   name: "Lisbon Web Summit 2024",
 *   startDate: "2024-11-04",
 *   endDate: "2024-11-07",
 *   capacity: 70000,
 *   category: "tech",
 *   active: true
 * }
 */
async function getLisbonEvents() {
  try {
    const db = admin.firestore();
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const snapshot = await db
        .collection("manual_events")
        .where("active", "==", true)
        .where("startDate", ">=", now.toISOString().split("T")[0])
        .where("startDate", "<=", sevenDaysFromNow.toISOString().split("T")[0])
        .orderBy("startDate", "asc")
        .get();

    const events = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const majorEvents = events.filter((event) => event.capacity > 500);

    return {
      events: majorEvents,
      totalCount: events.length,
      majorEventsCount: majorEvents.length,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn("Manual events fetch error:", error.message);
    return {
      events: [],
      totalCount: 0,
      majorEventsCount: 0,
      fetchedAt: new Date().toISOString(),
      error: error.message,
    };
  }
}

/**
 * Calculate events impact on restaurant demand
 * @param {Object} eventsData - Events data from getLisbonEvents
 * @return {Object} Impact score and description
 */
function calculateEventsImpact(eventsData) {
  const {majorEventsCount, events} = eventsData;

  let impactScore = 0;
  let description = "";

  if (majorEventsCount === 0) {
    impactScore = 0;
    description = "No major events";
  } else if (majorEventsCount === 1) {
    impactScore = 15;
    const eventName = events[0].name.substring(0, 30);
    description = `1 major event: ${eventName}...`;
  } else if (majorEventsCount === 2) {
    impactScore = 25;
    description = `2 major events this week`;
  } else {
    impactScore = 40;
    description = `${majorEventsCount} major events · High tourism`;
  }

  return {
    impactScore,
    description,
    category: impactScore > 30 ? "high" : impactScore > 10 ? "medium" : "baseline",
  };
}

module.exports = {
  getLisbonEvents,
  calculateEventsImpact,
};
