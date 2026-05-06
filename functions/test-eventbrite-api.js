require("dotenv").config();
const axios = require("axios");

async function testEventbriteAPI() {
  const apiKey = process.env.EVENTBRITE_API_KEY;
  console.log("Testing Eventbrite API...");
  console.log("API Key:", apiKey ? `${apiKey.substring(0, 8)}...` : "NOT FOUND");
  console.log("");

  try {
    // Test 1: Simple events search
    console.log("Test 1: Searching for events in Lisbon...");
    const response = await axios.get("https://www.eventbriteapi.com/v3/events/search/", {
      params: {
        "location.address": "Lisbon, Portugal",
        "location.within": "10km",
        "token": apiKey,
      },
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    console.log("✅ SUCCESS!");
    console.log("Total events found:", response.data.pagination?.object_count || 0);
    console.log("Events returned:", response.data.events?.length || 0);

    if (response.data.events && response.data.events.length > 0) {
      console.log("\nFirst event:");
      console.log("-", response.data.events[0].name.text);
      console.log("-", response.data.events[0].start.local);
    }
  } catch (error) {
    console.log("\n❌ ERROR:");
    console.log("Status:", error.response?.status);
    console.log("Message:", error.response?.data?.error_description || error.response?.data?.error || error.message);

    if (error.response?.status === 401) {
      console.log("\n💡 API Key Issues:");
      console.log("1. The token might be invalid or expired");
      console.log("2. You need to use OAuth token, not API key");
      console.log("3. Eventbrite changed their API authentication");
      console.log("\nEventbrite API docs: https://www.eventbrite.com/platform/api");
    } else if (error.response?.status === 404) {
      console.log("\n💡 Endpoint Issues:");
      console.log("1. The API endpoint structure might have changed");
      console.log("2. This endpoint might require a different authentication method");
      console.log("3. Consider using alternative: Ticketmaster, local event APIs, or manual curation");
    }
  }
}

testEventbriteAPI();
