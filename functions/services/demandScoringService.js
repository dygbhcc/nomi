const logger = require("firebase-functions/logger");
const {getLisbonWeather, calculateWeatherImpact} = require("./weatherService");
const {getLisbonEvents, calculateEventsImpact} = require("./eventsService");

/**
 * Calculate time-of-day impact on restaurant demand
 * @return {Object} Time impact data
 */
function calculateTimeImpact() {
  const hour = new Date().getHours();
  const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday

  let impactScore = 0;
  let description = "";

  // Weekend bonus
  if (day === 0 || day === 6) {
    impactScore += 20;
    description = "Weekend";
  } else if (day === 5) {
    impactScore += 15;
    description = "Friday";
  } else {
    description = "Weekday";
  }

  // Peak hours (lunch: 12-14, dinner: 19-22)
  if ((hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 22)) {
    impactScore += 25;
    description += " · Peak hours";
  } else if ((hour >= 11 && hour < 12) || (hour >= 18 && hour < 19)) {
    impactScore += 15;
    description += " · Pre-peak";
  } else if (hour >= 23 || hour < 10) {
    impactScore -= 20;
    description += " · Off-hours";
  } else {
    description += " · Moderate";
  }

  return {
    impactScore,
    description,
    hour,
    day,
    category: impactScore > 30 ? "high" : impactScore > 0 ? "medium" : "low",
  };
}

/**
 * Calculate tourism seasonality impact
 * @return {Object} Tourism impact data
 */
function calculateTourismImpact() {
  const month = new Date().getMonth(); // 0 = January, 11 = December

  let impactScore = 0;
  let description = "";

  // Peak season: May-September
  if (month >= 4 && month <= 8) {
    impactScore = 35;
    description = "Peak season";
  } else if (month === 3 || month === 9) {
    // Shoulder season: April, October
    impactScore = 20;
    description = "Shoulder season";
  } else if (month === 10 || month === 11 || month === 2) {
    // Moderate: November, December, March
    impactScore = 10;
    description = "Moderate season";
  } else {
    // Low season: January, February
    impactScore = 0;
    description = "Off-season";
  }

  return {
    impactScore,
    description,
    category: impactScore > 25 ? "high" : impactScore > 10 ? "medium" : "low",
  };
}

/**
 * Calculate overall demand forecast combining all signals
 * @return {Promise<Object>} Complete demand forecast
 */
async function calculateDemandForecast() {
  try {
    logger.info("Calculating demand forecast...");

    const [weatherData, eventsData] = await Promise.all([
      getLisbonWeather(),
      getLisbonEvents(),
    ]);

    const weatherImpact = calculateWeatherImpact(weatherData);
    const eventsImpact = calculateEventsImpact(eventsData);
    const timeImpact = calculateTimeImpact();
    const tourismImpact = calculateTourismImpact();

    // Weighted combination of all factors
    // Weather: 35%, Events: 25%, Time: 25%, Tourism: 15%
    const overallScore = Math.round(
        weatherImpact.impactScore * 0.35 +
      eventsImpact.impactScore * 0.25 +
      timeImpact.impactScore * 0.25 +
      tourismImpact.impactScore * 0.15,
    );

    // Calculate percentage change vs baseline (baseline = 0)
    const percentageChange = overallScore > 0 ? `+${overallScore}%` : `${overallScore}%`;

    // Determine overall category
    let overallCategory = "baseline";
    if (overallScore > 25) overallCategory = "very high";
    else if (overallScore > 15) overallCategory = "high";
    else if (overallScore > 5) overallCategory = "elevated";
    else if (overallScore < -10) overallCategory = "low";

    const forecast = {
      overall: {
        score: overallScore,
        percentageChange,
        category: overallCategory,
        description: `Demand ${overallScore > 0 ? "above" : overallScore < 0 ? "below" : "at"} baseline`,
      },
      factors: {
        weather: {
          ...weatherImpact,
          temperature: Math.round(weatherData.current.temp),
          conditions: weatherData.current.main,
        },
        events: {
          ...eventsImpact,
          majorEventsCount: eventsData.majorEventsCount,
          events: eventsData.events.slice(0, 3), // Top 3 events
        },
        time: {
          ...timeImpact,
          currentHour: timeImpact.hour,
          dayOfWeek: timeImpact.day,
        },
        tourism: {
          ...tourismImpact,
          month: new Date().getMonth(),
        },
      },
      metadata: {
        calculatedAt: new Date().toISOString(),
        weatherFetchedAt: weatherData.fetchedAt,
        eventsFetchedAt: eventsData.fetchedAt,
      },
    };

    logger.info("Demand forecast calculated successfully", {overallScore});
    return forecast;
  } catch (error) {
    logger.error("Failed to calculate demand forecast:", error);
    throw error;
  }
}

module.exports = {
  calculateDemandForecast,
  calculateWeatherImpact,
  calculateEventsImpact,
  calculateTimeImpact,
  calculateTourismImpact,
};
