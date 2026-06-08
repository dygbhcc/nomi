# WSWE Context (Hafta 1)

## Product Goal
WSWE (What Should We Eat?) mood bazli restoran onerisi uygulamasi.
Bu sprint hedefi: Lizbon'daki ilk 100 restoran kaydini Firestore'a almak.

## Tech Stack Decisions
- Mobile: React Native + Expo
- Backend: Firebase Cloud Functions (Node.js 18)
- Database: Firestore (ana veri) + Realtime Database (canli oylama)
- Image/CDN: Cloudinary
- AI (Faz 2): Google Cloud Vision API
- Admin Panel (sonraki sprint): Next.js + Vercel

## Firestore Collections
- `restaurants/{restaurantId}`
  - `place_id`, `name`, `address`
  - `location: { lat, lng }`
  - `budget_level`
  - `mood_tags[]`
  - `confidence_scores{}`
  - `opening_hours: { is_open_monday, periods[] }`
  - `noise_level`, `phone`, `website`, `google_rating`
  - `photos[]`, `cache_date`, `is_local_concept`
- `users/{userId}`
  - `display_name`, `email`, `points`, `badges[]`, `segment`
  - `preference_history: { moods[], budget, dist }`
  - `streak`, `last_active`, `fcm_token`, `created_at`
- `rooms/{roomId}`
  - `name`, `organizer_uid`
  - `participants{}`, `preferences{}`
  - `restaurants[]`, `votes{}`
  - `winner_id`, `status`, `created_at`
- `restaurant_cache_regions/{regionId}`
  - `center`, `radius`, `type`, `cache_date`, `restaurant_ids[]`

## Realtime DB Paths
- `votes/{roomId}/{userId}/{restaurantId}`
  - `direction`, `timestamp`, `restaurant_name`
- `occupancy/{restaurantId}/live`
  - `score`, `wait_minutes`, `reporter_uid`, `expires_at`

## Mood Tag Dictionary (Fixed)
- Evrensel:
  - romantic, chill, energetic, fresh, pet_friendly, hidden_gem, lively, terrace
- Portekiz'e ozgu (`is_local_concept: true`):
  - tasca, fado, petiscos, miradouro, saudade, marisqueira

## Lisbon Seed Regions (Places API)
- Chiado: `38.7102, -9.1404`
- Alfama: `38.7139, -9.1334`
- Bairro Alto: `38.7138, -9.1450`
- Mouraria: `38.7162, -9.1347`
- Principe Real: `38.7157, -9.1487`
- Standard query: `radius=800`, `type=restaurant`, `maxResults=40`

## Coding Standards
- Async/await kullan, callback kullanma
- Her Cloud Function icin try/catch zorunlu
- Secrets ve config degerleri `.env.local` / runtime env icinde olmali
- API key client-side'da kullanilmaz, yalnizca Cloud Functions tarafinda kullanilir
- Firestore'da gereksiz read yapma, 30 gun cache zorunlu
- TypeScript tercih edilir (mevcut week-1 scaffold JS, ilerleyen adimda TS'e tasinabilir)
- Kapali mekan yonlendirmesi yapma:
  - oneriden once `is_open_monday` ve mevcut saat kontrolu yap
- Firebase Storage kullanma (Cloudinary veya Google URL kullan)

## Security Rules Intent
- User sadece kendi `users/{uid}` kaydini yazabilir
- User sadece kendi room preference kaydini yazabilir
- User sadece kendi vote node'unu yazabilir
- `restaurants/` herkes okur, sadece admin yazar

## Week-1 Deliverables in Repo
- `firestore.rules`
- `database.rules.json`
- `functions/src/places/fetchAndCacheRestaurants.js`
- `scripts/import.js`
- `scripts/seedLisbon.js`
- `mobile/src/services/{firebase,places,algorithm}.js`
- `mobile/src/constants/{moods,colors}.js`

## Repository Scripts
- `scripts/import.js`
  - CSV/JSON toplu restoran importu
  - 100 kayitta bir `batch.commit()` yapar
- `scripts/seedLisbon.js`
  - 5 Lizbon mahallesi icin Places API'den cekip Firestore'a yazar
  - 30 gunluk `restaurant_cache_regions` cache kontrolu yapar

## TypeScript Migration Baseline
- `functions/tsconfig.json`: `allowJs` acik, kademeli gecis icin hazir
- `mobile/tsconfig.json`: Expo + strict TS ayarlari
- `functions/package.json`: `build` ve `typecheck` scriptleri eklendi
- `mobile/package.json`: Expo scriptleri ve `typecheck` eklendi
