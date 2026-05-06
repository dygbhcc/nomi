const axios = require("axios");
const logger = require("firebase-functions/logger");

const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const WEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5";

/**
 * Fetch current weather and 5-day forecast for Lisbon
 * @return {Promise<Object>} Weather data with current and forecast
 */
async function getLisbonWeather() {
  const LISBON_LAT = 38.7223;
  const LISBON_LNG = -9.1393;

  try {
    const [current, forecast] = await Promise.all([
      axios.get(`${WEATHER_BASE_URL}/weather`, {
        params: {
          lat: LISBON_LAT,
          lon: LISBON_LNG,
          appid: WEATHER_API_KEY,
          units: "metric",
        },
      }),
      axios.get(`${WEATHER_BASE_URL}/forecast`, {
        params: {
          lat: LISBON_LAT,
          lon: LISBON_LNG,
          appid: WEATHER_API_KEY,
          units: "metric",
        },
      }),
    ]);

    return {
      current: {
        temp: current.data.main.temp,
        feelsLike: current.data.main.feels_like,
        description: current.data.weather[0].description,
        main: current.data.weather[0].main, // Clear, Clouds, Rain, etc.
        humidity: current.data.main.humidity,
        windSpeed: current.data.wind.speed,
      },
      forecast: forecast.data.list.slice(0, 8).map((item) => ({
        timestamp: item.dt,
        temp: item.main.temp,
        description: item.weather[0].description,
        main: item.weather[0].main,
        pop: item.pop, // probability of precipitation
      })),
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Weather API error:", error.message);
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}

/**
 * Calculate weather impact on outdoor dining demand
 * @param {Object} weatherData - Current weather data
 * @return {Object} Impact score and description
 */
function calculateWeatherImpact(weatherData) {
  const {temp, main, windSpeed} = weatherData.current;

  let impactScore = 0;
  let description = "";

  // Temperature impact (optimal: 18-26°C)
  if (temp >= 18 && temp <= 26) {
    impactScore += 30;
    description = `Perfect weather (${Math.round(temp)}°C)`;
  } else if (temp >= 15 && temp < 18) {
    impactScore += 15;
    description = `Cool but pleasant (${Math.round(temp)}°C)`;
  } else if (temp > 26 && temp <= 30) {
    impactScore += 20;
    description = `Warm (${Math.round(temp)}°C)`;
  } else if (temp > 30) {
    impactScore -= 10;
    description = `Very hot (${Math.round(temp)}°C)`;
  } else {
    impactScore -= 15;
    description = `Cold (${Math.round(temp)}°C)`;
  }

  // Weather condition impact
  if (main === "Clear") {
    impactScore += 20;
    description += " · Sunny";
  } else if (main === "Clouds") {
    impactScore += 10;
    description += " · Cloudy";
  } else if (main === "Rain") {
    impactScore -= 30;
    description += " · Rainy";
  } else if (main === "Drizzle") {
    impactScore -= 15;
    description += " · Light rain";
  }

  // Wind impact (strong wind reduces outdoor appeal)
  if (windSpeed > 8) {
    impactScore -= 10;
    description += " · Windy";
  }

  // Normalize to -50 to +50 range
  impactScore = Math.max(-50, Math.min(50, impactScore));

  return {
    impactScore,
    description,
    category: impactScore > 30 ? "high" : impactScore > 0 ? "medium" : "low",
  };
}

module.exports = {
  getLisbonWeather,
  calculateWeatherImpact,
};
