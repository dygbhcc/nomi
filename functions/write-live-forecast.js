require("dotenv").config();
const admin = require("firebase-admin");
const {calculateDemandForecast} = require("./services/demandScoringService");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.SERVICE_ACCOUNT_PROJECT_ID,
    clientEmail: process.env.SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

async function writeLiveForecast() {
  console.log("📊 Fetching live demand forecast...\n");

  try {
    const forecast = await calculateDemandForecast();

    await db.collection("demand_forecasts").doc("latest").set({
      ...forecast,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ SUCCESS! Live forecast written to Firestore\n");
    console.log("Overall Score:", forecast.overall.score);
    console.log("Category:", forecast.overall.category);
    console.log("\nFactors:");
    console.log("- Weather:", forecast.factors.weather.description);
    console.log("- Events:", forecast.factors.events.description);
    console.log("- Time:", forecast.factors.time.description);
    console.log("- Tourism:", forecast.factors.tourism.description);
    console.log("\n🎯 Check your admin dashboard at:");
    console.log("   Local: http://localhost:3000");
    console.log("   Prod:  https://admin-rho-coral.vercel.app\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    process.exit(1);
  }
}

writeLiveForecast();
