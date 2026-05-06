const axios = require("axios");
const logger = require("firebase-functions/logger");

const EVENTBRITE_API_KEY = process.env.EVENTBRITE_API_KEY;
const EVENTBRITE_BASE_URL = "https://www.eventbriteapi.com/v3";

/**
 * Fetch major events in Lisbon for the next 7 days
 * @return {Promise<Object>} Events data with impact analysis
 */
async function getLisbonEvents() {
  try {
    // Search for events in Lisbon
    const response = await axios.get(`${EVENTBRITE_BASE_URL}/events/search/`, {
      params: {
        "location.address": "Lisbon, Portugal",
        "location.within": "10km",
        "start_date.range_start": new Date().toISOString(),
        "start_date.range_end": new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        "expand": "venue",
        "token": EVENTBRITE_API_KEY,
      },
    });

    const events = response.data.events || [];

    // Filter for major events (>500 capacity or high profile)
    const majorEvents = events
        .filter((event) => event.capacity > 500 || event.is_reserved_seating)
        .slice(0, 10)
        .map((event) => ({
          id: event.id,
          name: event.name.text,
          description: event.description?.text?.substring(0, 200) || "",
          startDate: event.start.local,
          endDate: event.end.local,
          capacity: event.capacity,
          venueId: event.venue_id,
          venueName: event.venue?.name || "",
          url: event.url,
        }));

    return {
      events: majorEvents,
      totalCount: events.length,
      majorEventsCount: majorEvents.length,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn("Eventbrite API error:", error.message);
    // Return empty events if API fails (non-critical)
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
 * @param {Object} eventsData - Events data
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
