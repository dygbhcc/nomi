require("dotenv").config();
const axios = require("axios");

async function testWeatherAPI() {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  console.log("Testing OpenWeatherMap API...");
  console.log("API Key:", apiKey ? `${apiKey.substring(0, 8)}...` : "NOT FOUND");

  try {
    const response = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
      params: {
        lat: 38.7223,
        lon: -9.1393,
        appid: apiKey,
        units: "metric",
      },
    });

    console.log("\n✅ SUCCESS!");
    console.log("Location:", response.data.name);
    console.log("Temperature:", response.data.main.temp, "°C");
    console.log("Weather:", response.data.weather[0].description);
  } catch (error) {
    console.log("\n❌ ERROR:");
    console.log("Status:", error.response?.status);
    console.log("Message:", error.response?.data?.message || error.message);

    if (error.response?.status === 401) {
      console.log("\n💡 Possible issues:");
      console.log("1. API key not activated yet (can take a few hours after signup)");
      console.log("2. API key is invalid");
      console.log("3. Free tier limits exceeded");
      console.log("\nTo get a valid key:");
      console.log("- Sign up at https://openweathermap.org/api");
      console.log("- Go to API keys section in your account");
      console.log("- Wait ~2 hours for key activation");
    }
  }
}

testWeatherAPI();
