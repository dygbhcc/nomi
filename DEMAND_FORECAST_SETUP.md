# Demand Forecast System - Setup Guide

## Overview
Complete weather and events data pipeline integrated into Nomi admin dashboard.

## What Was Implemented

### 1. Cloud Functions (3 new services + 2 functions)

**Services:**
- `weatherService.js` - OpenWeatherMap API integration
  - Fetches current weather and 5-day forecast for Lisbon
  - Calculates weather impact on outdoor dining demand
  - Considers temperature, conditions, humidity, wind speed

- `eventsService.js` - Eventbrite API integration
  - Fetches major events (>500 capacity) in Lisbon for next 7 days
  - Calculates events impact on restaurant demand
  - Handles API failures gracefully (non-critical)

- `demandScoringService.js` - Signal combination engine
  - Combines weather (35%), events (25%), time (25%), tourism (15%)
  - Calculates overall demand score (-50 to +50 range)
  - Returns detailed breakdown by factor

**Cloud Functions:**
- `getDemandForecast` - Callable function for on-demand forecasts
- `scheduledDemandUpdate` - Scheduled function (runs every hour)
  - Stores result in Firestore: `demand_forecasts/latest`
  - Timezone: Europe/Lisbon

### 2. Admin Dashboard Integration

**New API Endpoint:**
- `/api/demand` - Fetches latest forecast from Firestore

**UI Updates:**
- Replaced static "Signal factors" section with live demand forecast
- Shows 4 factors: Weather, Events, Time, Tourism
- Color-coded by impact: high (green), medium (orange), baseline (gray)
- Displays percentage change vs baseline
- Shows last update timestamp

## Setup Instructions

### Step 1: Get API Keys

**OpenWeatherMap:**
1. Sign up at https://openweathermap.org/api
2. Get free API key (includes current weather + 5-day forecast)
3. Copy API key

**Eventbrite (optional):**
1. Go to https://www.eventbrite.com/platform/api
2. Create app and get API key
3. Copy API key
4. Note: If unavailable, events will show as 0 (non-critical)

### Step 2: Configure Environment Variables

Update `functions/.env`:
```bash
OPENWEATHER_API_KEY="your_actual_api_key_here"
EVENTBRITE_API_KEY="your_actual_api_key_here"  # or leave placeholder if not available
```

### Step 3: Deploy Cloud Functions

```bash
# From project root
firebase deploy --only functions:getDemandForecast,functions:scheduledDemandUpdate
```

This will deploy:
- `getDemandForecast` - Callable function
- `scheduledDemandUpdate` - Scheduled to run every hour

### Step 4: Trigger Initial Forecast

Option A - Via Firebase Console:
1. Go to Firebase Console > Functions
2. Find `getDemandForecast`
3. Click "Test function" with empty payload: `{}`
4. Check Firestore > `demand_forecasts/latest` for result

Option B - Via Firebase CLI:
```bash
firebase functions:shell
# Then in shell:
getDemandForecast()
```

Option C - Wait for scheduled run (runs every hour automatically)

### Step 5: Deploy Admin Dashboard

```bash
cd admin
vercel --prod
```

Or if already deployed, Vercel will auto-deploy on next git push.

## Testing Locally

### Test Cloud Functions:
```bash
cd functions
npm run lint  # Should pass
firebase emulators:start --only functions
```

Then in another terminal:
```bash
curl http://localhost:5001/nomi-mvp/europe-west1/getDemandForecast \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Test Admin Dashboard:
```bash
cd admin
npm run dev
```

Visit http://localhost:3000 and check the "Live demand forecast" section.

## Data Structure

### Firestore: `demand_forecasts/latest`
```json
{
  "overall": {
    "score": 28,
    "percentageChange": "+28%",
    "category": "very high",
    "description": "Demand above baseline"
  },
  "factors": {
    "weather": {
      "impactScore": 50,
      "description": "Perfect weather (22°C) · Sunny",
      "category": "high",
      "temperature": 22,
      "conditions": "Clear"
    },
    "events": {
      "impactScore": 25,
      "description": "2 major events this week",
      "category": "high",
      "majorEventsCount": 2
    },
    "time": {
      "impactScore": 40,
      "description": "Friday · Peak hours",
      "category": "high",
      "currentHour": 20,
      "dayOfWeek": 5
    },
    "tourism": {
      "impactScore": 35,
      "description": "Peak season",
      "category": "high"
    }
  },
  "metadata": {
    "calculatedAt": "2024-05-05T18:30:00.000Z",
    "weatherFetchedAt": "2024-05-05T18:30:00.000Z",
    "eventsFetchedAt": "2024-05-05T18:30:00.000Z"
  },
  "updatedAt": "2024-05-05T18:30:00.000Z"
}
```

## Architecture

```
┌─────────────────────────────────────────┐
│  Scheduled Cloud Function (every hour)  │
│  scheduledDemandUpdate()                 │
└──────────────┬──────────────────────────┘
               │
               ├─► weatherService.getLisbonWeather()
               │   └─► OpenWeatherMap API
               │
               ├─► eventsService.getLisbonEvents()
               │   └─► Eventbrite API
               │
               └─► demandScoringService.calculateDemandForecast()
                   └─► Combines all signals
                       └─► Stores in Firestore: demand_forecasts/latest

┌─────────────────────────────────────────┐
│  Admin Dashboard (Next.js)               │
│  /api/demand                             │
└──────────────┬──────────────────────────┘
               │
               └─► Reads from Firestore: demand_forecasts/latest
                   └─► Displays live forecast in UI
```

## Weighting Formula

```
overallScore =
  weatherImpact × 0.35 +
  eventsImpact × 0.25 +
  timeImpact × 0.25 +
  tourismImpact × 0.15
```

**Weather (35%):** Temperature, conditions, wind
**Events (25%):** Major events count, tourism boost
**Time (25%):** Hour of day, day of week
**Tourism (15%):** Seasonality (peak: May-Sep)

## Cost Estimates

**OpenWeatherMap:**
- Free tier: 1,000 calls/day
- With hourly updates: 24 calls/day
- Cost: $0/month

**Eventbrite:**
- Free tier: 1,000 requests/day (if available)
- Cost: $0/month

**Cloud Functions:**
- Scheduled function: 24 invocations/day
- Callable function: As needed
- Estimated: ~$0.01-0.05/month

**Firestore:**
- 1 document write/hour = 720 writes/month
- Minimal reads for dashboard
- Estimated: $0.00/month (well within free tier)

**Total: ~$0.01-0.05/month**

## Monitoring

### Check Scheduled Function Logs:
```bash
firebase functions:log --only scheduledDemandUpdate
```

### Check Latest Forecast:
Firebase Console > Firestore > `demand_forecasts/latest`

### Dashboard Health:
Visit admin dashboard > Check "Live demand forecast" section

## Troubleshooting

**Issue: "No forecast data available yet"**
- Trigger initial forecast using getDemandForecast() function
- Or wait for next hourly scheduled run

**Issue: Weather shows as "Loading..."**
- Check OPENWEATHER_API_KEY in functions/.env
- Verify API key is active and has available quota
- Check function logs: `firebase functions:log`

**Issue: Events always show "0 major events"**
- Eventbrite API might be unavailable (non-critical)
- Check EVENTBRITE_API_KEY configuration
- System will work without events data

**Issue: Forecast never updates**
- Check Cloud Scheduler is enabled in GCP Console
- Verify scheduledDemandUpdate is deployed
- Check function logs for errors

## Next Steps

1. **Get API keys** and update functions/.env
2. **Deploy functions**: `firebase deploy --only functions`
3. **Trigger initial forecast** via getDemandForecast()
4. **Verify dashboard** shows live data
5. **Monitor** for 24 hours to ensure hourly updates work

## Files Modified/Created

### Functions:
- `functions/services/weatherService.js` (new)
- `functions/services/eventsService.js` (new)
- `functions/services/demandScoringService.js` (new)
- `functions/index.js` (modified - added 2 functions)
- `functions/.env` (modified - added API keys)
- `functions/.env.example` (modified)

### Admin:
- `admin/app/api/demand/route.ts` (new)
- `admin/app/page.tsx` (modified - added live forecast section)

---

Built for Nomi demand intelligence platform 🍽️
```
