# Nomi — Claude Code Rules

## Core Principles

### Cost & Performance
- Always minimize Firebase read/write operations — batch where possible
- Prefer Firestore cache over live API calls (TTL: 30 days for Places, 24h for demand)
- Never run Gemini NLP on already-processed restaurants (check nlp_processed: true first)
- Cloud Functions must be stateless and lightweight — no unnecessary dependencies
- Always use useNativeDriver: true for React Native animations
- Lazy load screens and heavy components

### Security
- Never hardcode API keys, secrets, or file paths in source code
- All secrets via process.env only
- Firestore writes from client are forbidden — Cloud Functions only
- Always validate request.auth before any Firestore operation

### Code Quality
- All code comments and log strings in English only — no Turkish, no Portuguese
- No console.log in production code — use firebase-functions logger
- Every Cloud Function must have try/catch with proper error logging
- DRY_RUN mode must be respected before any destructive batch operation

### Architecture
- Stack: React Native (Expo), Firebase (Firestore + RTDB + Functions), Gemini 2.5 Flash, Cloudinary
- Region: europe-west1 for all Cloud Functions
- Confidence scoring weights: nlp: 0.55, validate: 0.30, swipe: 0.15
- PMO signal permanently removed — do not reintroduce

### Before Every Change
- Read before modifying — audit first, then implement
- Show before/after diff for every file changed
- If a change affects Firestore schema, flag it explicitly
- If a change increases API call volume, flag it explicitly

### React Native
- Always check if expo package is available before using native modules
- Test on both iOS and Android mentally before implementing
- AsyncStorage for local cache, Firestore for persistent data

## Project Structure
- Mobile app: mobile/nomi/
- Cloud Functions: functions/
- B2B Dashboard: admin/
- Scripts (local only, not deployed): scripts/
- Config: config/

## Mood System (canonical, do not modify)
romantic | energetic | chill | explorer | focus | retreat | hungry_quick | celebrating

## Cost Guardrails
- Google Places API: always check Firestore cache first (geohash)
- Gemini API: free tier = 15 req/min, batch max 50/night
- Cloudinary: signed uploads only, never unsigned
- Firebase Functions: target < 50K invocations/month during MVP
