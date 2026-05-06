require("dotenv").config();
const admin = require("firebase-admin");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.SERVICE_ACCOUNT_PROJECT_ID,
    clientEmail: process.env.SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

// Mock demand forecast data
const mockForecast = {
  overall: {
    score: 32,
    percentageChange: "+32%",
    category: "very high",
    description: "Demand above baseline",
  },
  factors: {
    weather: {
      impactScore: 45,
      description: "Perfect weather (22°C) · Sunny",
      category: "high",
      temperature: 22,
      conditions: "Clear",
    },
    events: {
      impactScore: 25,
      description: "2 major events this week",
      category: "high",
      majorEventsCount: 2,
      events: [
        {
          id: "mock1",
          name: "Lisbon Web Summit 2024",
          startDate: new Date().toISOString(),
          capacity: 70000,
        },
        {
          id: "mock2",
          name: "Street Food Festival",
          startDate: new Date().toISOString(),
          capacity: 5000,
        },
      ],
    },
    time: {
      impactScore: 40,
      description: "Weekend · Peak hours",
      category: "high",
      currentHour: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
    },
    tourism: {
      impactScore: 35,
      description: "Peak season",
      category: "high",
      month: new Date().getMonth(),
    },
  },
  metadata: {
    calculatedAt: new Date().toISOString(),
    weatherFetchedAt: new Date().toISOString(),
    eventsFetchedAt: new Date().toISOString(),
    isMockData: true,
  },
};

async function writeMockForecast() {
  console.log("📊 Writing mock demand forecast to Firestore...\n");

  try {
    await db.collection("demand_forecasts").doc("latest").set({
      ...mockForecast,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ SUCCESS! Mock forecast written to Firestore\n");
    console.log("Overall Score:", mockForecast.overall.score);
    console.log("Category:", mockForecast.overall.category);
    console.log("\nFactors:");
    console.log("- Weather:", mockForecast.factors.weather.description);
    console.log("- Events:", mockForecast.factors.events.description);
    console.log("- Time:", mockForecast.factors.time.description);
    console.log("- Tourism:", mockForecast.factors.tourism.description);
    console.log("\n🎯 Now check your admin dashboard at http://localhost:3000");
    console.log("   The 'Live demand forecast' section should show this data!\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    process.exit(1);
  }
}

writeMockForecast();
