require("dotenv").config();
const axios = require("axios");

async function testAlternatives() {
  const apiKey = process.env.EVENTBRITE_API_KEY;

  console.log("Testing alternative Eventbrite endpoints...\n");

  // Test 1: Try without /search/ path
  try {
    console.log("Test 1: Direct events endpoint...");
    const response = await axios.get("https://www.eventbriteapi.com/v3/events", {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });
    console.log("✅ SUCCESS! Found endpoint:", response.config.url);
    return;
  } catch (error) {
    console.log("❌ Failed:", error.response?.status, error.response?.data?.error);
  }

  // Test 2: Try user's events
  try {
    console.log("\nTest 2: User's events...");
    const response = await axios.get("https://www.eventbriteapi.com/v3/users/me/events/", {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });
    console.log("✅ SUCCESS! Found endpoint:", response.config.url);
    return;
  } catch (error) {
    console.log("❌ Failed:", error.response?.status, error.response?.data?.error);
  }

  // Test 3: Destination search
  try {
    console.log("\nTest 3: Destination search...");
    const response = await axios.get("https://www.eventbriteapi.com/v3/destination/search/", {
      params: {
        "q": "Lisbon",
      },
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });
    console.log("✅ SUCCESS! Found endpoint:", response.config.url);
    return;
  } catch (error) {
    console.log("❌ Failed:", error.response?.status, error.response?.data?.error);
  }

  console.log("\n❌ All Eventbrite endpoints failed");
  console.log("\n💡 Recommendations:");
  console.log("1. Use Ticketmaster API (free tier available)");
  console.log("2. Use Predicthq API (events + demand intelligence)");
  console.log("3. Use web scraping for local event sites");
  console.log("4. Manually curate major events in Firestore");
  console.log("5. Skip events data (system works without it)");
}

testAlternatives();
