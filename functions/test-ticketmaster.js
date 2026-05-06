require("dotenv").config();
const {getLisbonEvents, calculateEventsImpact} = require("./services/eventsService");

async function test() {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  console.log("🎫 Testing Ticketmaster API...");
  console.log("API Key:", apiKey ? `${apiKey.substring(0, 8)}...` : "NOT FOUND\n");

  if (!apiKey || apiKey === "your_ticketmaster_api_key_here") {
    console.log("\n❌ API key not configured!");
    console.log("\n📝 To get your API key:");
    console.log("1. Sign up: https://developer.ticketmaster.com/");
    console.log("2. Get your Consumer Key");
    console.log("3. Update functions/.env with your key");
    console.log("\nSee TICKETMASTER_SETUP.md for details.");
    process.exit(1);
  }

  console.log("");

  try {
    console.log("Fetching events in Lisbon...\n");
    const eventsData = await getLisbonEvents();

    if (eventsData.error) {
      console.log("⚠️  API Warning:", eventsData.error);
    }

    console.log("✅ SUCCESS!\n");
    console.log("Events found:", eventsData.totalCount);
    console.log("Major events:", eventsData.majorEventsCount);

    if (eventsData.majorEventsCount > 0) {
      console.log("\nUpcoming events:");
      eventsData.events.slice(0, 5).forEach((event, i) => {
        console.log(`${i + 1}. ${event.name}`);
        console.log(`   ${event.startDate} at ${event.venueName}`);
        console.log(`   Category: ${event.category}`);
      });
    } else {
      console.log("\nNo major events found in Lisbon for the next 7 days.");
      console.log("(This is normal - not an error!)");
    }

    const impact = calculateEventsImpact(eventsData);
    console.log("\n📊 Demand Impact:");
    console.log("- Score:", impact.impactScore);
    console.log("- Category:", impact.category);
    console.log("- Description:", impact.description);

    console.log("\n🎉 Ticketmaster integration working!");
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error);
  }
}

test();
