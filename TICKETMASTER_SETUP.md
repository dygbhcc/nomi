# Ticketmaster API Setup Guide

## ✅ What Changed
- Replaced Eventbrite with Ticketmaster API
- Updated `eventsService.js` to use Ticketmaster
- Backed up old service: `eventsService-eventbrite.js.backup`

## 🎫 Get Your Ticketmaster API Key (5 minutes)

### Step 1: Sign Up
1. Go to: https://developer.ticketmaster.com/
2. Click "Get Your API Key" or "Sign Up"
3. Fill in:
   - Name
   - Email
   - Create password
4. Verify email

### Step 2: Get API Key
1. Log in to: https://developer-acct.ticketmaster.com/
2. Go to "My Apps" or "API Keys"
3. Create new app:
   - App name: "Nomi Demand Intelligence"
   - Description: "Restaurant demand forecasting"
4. Copy your **Consumer Key** (this is your API key)

### Step 3: Add to .env
```bash
cd functions
nano .env  # or use your editor
```

Update this line:
```bash
TICKETMASTER_API_KEY="your_actual_key_here"
```

Save and exit.

## 🧪 Test It

```bash
cd functions
node test-ticketmaster.js
```

Expected output:
```
✅ SUCCESS!
Events found in Lisbon: 15
Major events: 3
- Event 1: Concert Name
- Event 2: Festival Name
- Event 3: Sports Event
```

## 🚀 Deploy

```bash
# From project root
firebase deploy --only functions:getDemandForecast,functions:scheduledDemandUpdate
```

## 📊 What You Get

**Ticketmaster vs Eventbrite:**
- ✅ Free tier: 5,000 API calls/day (vs Eventbrite issues)
- ✅ Better documentation
- ✅ More reliable endpoints
- ✅ Includes concerts, sports, festivals, theater

**Event Categories:**
- Music (concerts, festivals)
- Sports (football, basketball)
- Arts & Theatre
- Family events
- More comprehensive than Eventbrite

## 🔧 Troubleshooting

**Issue: 401 Unauthorized**
- Check API key is correct
- Make sure you copied the "Consumer Key" not "Consumer Secret"

**Issue: No events found**
- Ticketmaster might have limited events in Lisbon
- This is normal - shows "No major events" (not an error)
- System still works perfectly

**Issue: Rate limit**
- Free tier: 5,000 calls/day
- Hourly updates = 24 calls/day
- Plenty of headroom!

## 💰 Cost

**Free Forever:**
- 5,000 API calls per day
- Your usage: ~24 calls per day (hourly updates)
- No credit card required

## 📝 API Limits

**Free Tier Includes:**
- 5,000 requests/day
- Rate limit: 5 requests/second
- Access to all event types
- Global event data

**More than enough for:**
- Hourly scheduled updates
- On-demand dashboard refreshes
- Testing and development

---

Once you have your API key, update `.env` and test it! 🎉
