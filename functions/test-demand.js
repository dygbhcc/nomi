require("dotenv").config();
const {calculateDemandForecast} = require("./services/demandScoringService");

async function test() {
  console.log("🧪 Testing demand forecast calculation...\n");

  try {
    const forecast = await calculateDemandForecast();

    console.log("✅ SUCCESS!\n");
    console.log("Overall Score:", forecast.overall.score);
    console.log("Percentage Change:", forecast.overall.percentageChange);
    console.log("Category:", forecast.overall.category);
    console.log("\nFactors:");
    console.log("- Weather:", forecast.factors.weather.description);
    console.log("- Events:", forecast.factors.events.description);
    console.log("- Time:", forecast.factors.time.description);
    console.log("- Tourism:", forecast.factors.tourism.description);
    console.log("\n📊 Full forecast:");
    console.log(JSON.stringify(forecast, null, 2));
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    console.error(error);
  }
}

test();
