# NOMI - What Should We Eat?

Week 1 setup for the Portugal MVP.

## Stack
- Mobile: React Native (Expo)
- Backend: Firebase Cloud Functions (Node.js 18)
- DB: Firestore + Realtime Database
- Media: Cloudinary

## Project Structure
- `mobile/`: React Native (Expo) app placeholder for next tasks
- `admin/`: Next.js admin placeholder for future sprint
- `functions/`: Cloud Functions code (`fetchAndCacheRestaurants`)
- `scripts/`: one-off scripts (`importRestaurants.js`)
- `config/`: constants (mood tags and Lisbon neighborhoods)
- `data/`: seed/import files
- `firestore.rules`: Firestore security rules
- `database.rules.json`: Realtime Database rules

## Environment Variables
Use separate environment files by scope:

- `functions/.env` for Cloud Functions runtime variables:
  - `GOOGLE_PLACES_API_KEY`
- root `.env` for local admin scripts (for example `scripts/importRestaurants.js`):
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`

For functions environment variables, use Firebase secrets or env config. Example:

```bash
firebase functions:secrets:set GOOGLE_PLACES_API_KEY
```

## Install
```bash
npm install
cd functions && npm install
```

## Batch Import
```bash
npm run import:restaurants -- --input=./data/restaurants.sample.csv
```

Supported input formats:
- CSV
- JSON array

## Cloud Functions
`fetchAndCacheRestaurants` callable input:

```json
{
  "lat": 38.7102,
  "lng": -9.1404,
  "radius": 800,
  "maxResults": 40
}
```

`warmupLisbonRestaurants` callable:
- runs `fetchAndCacheRestaurants` for 5 Lisbon neighborhoods
- uses `radius: 800` and `maxResults: 40`

## Lisbon neighborhoods for cache warm-up
- Chiado: `38.7102, -9.1404`
- Alfama: `38.7139, -9.1334`
- Bairro Alto: `38.7138, -9.1450`
- Mouraria: `38.7162, -9.1347`
- Principe Real: `38.7157, -9.1487`
