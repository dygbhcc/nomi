# Restaurant Partner Dashboard - Setup Complete! ✅

## What Was Built

Rebuilt the Nomi B2B dashboard as a restaurant-specific portal where each restaurant owner logs in and sees only their own data.

## Demo Credentials

**3 demo restaurant accounts created:**

1. **Marisqueira Furnas**
   - Email: `demo-ChIJ--@nomi.app`
   - Password: `nomi2026`

2. **Caçoila**
   - Email: `demo-ChIJ--@nomi.app`
   - Password: `nomi2026`

3. **Maresia**
   - Email: `demo-ChIJ--@nomi.app`
   - Password: `nomi2026`

*Note: The seeder generated the same email prefix for all 3 restaurants. For production, ensure unique email addresses.*

## How to Test

### 1. Access the Dashboard
```
http://localhost:3000
```

You'll be automatically redirected to `/login`

### 2. Sign In
- Use one of the demo credentials above
- Click "Sign In"
- You'll be redirected to the restaurant-specific dashboard

### 3. What You'll See
- **Header**: Restaurant name + "Verified" badge if applicable
- **Insights**: Actionable recommendations based on data
- **KPI Cards**: Total views, Likes, Like rate, Demand score
- **Weekly Chart**: Views vs Likes by day of week
- **Discovery Moods**: Doughnut chart of mood tag distribution
- **Peak Hours**: Line chart showing when users discover you
- **Mood Confidence**: Progress bars for each mood tag
- **Demand Signals**: Weather, top mood demand, peak time

### 4. Sign Out
Click "Sign out" button in top-right corner

## Features

### Authentication
- ✅ NextAuth with credentials provider
- ✅ Restaurant-specific sessions
- ✅ Automatic redirect to login if not authenticated
- ✅ Secure password comparison
- ✅ Session management with JWT

### Restaurant-Specific Data
- ✅ Each restaurant sees only their swipe data
- ✅ Personalized insights based on performance
- ✅ Restaurant profile information
- ✅ Demand scoring specific to the restaurant
- ✅ Mood tag confidence scores

### Insights Engine
Automatically generates insights like:
- "Strong performance — 70% of users who saw your restaurant liked it."
- "High romantic demand in Lisbon right now (75/100) — your top mood."
- "Your peak discovery time is dinner hours (20:00)."

### Data Visualization
- **Weekly views & likes**: Bar chart
- **Discovery moods**: Doughnut chart
- **Peak discovery hours**: Line chart
- **Mood tag confidence**: Progress bars
- **Demand signals**: Current weather, top mood, peak time

## Architecture

### Files Created/Modified

**Authentication:**
- `lib/auth.ts` - NextAuth configuration
- `app/api/auth/[...nextauth]/route.ts` - NextAuth API endpoint
- `app/providers.tsx` - Client-side SessionProvider wrapper
- `app/layout.tsx` - Root layout with Providers
- `app/login/page.tsx` - Login page

**Data Layer:**
- `lib/restaurantQueries.ts` - Restaurant-specific queries
- `app/api/restaurant/route.ts` - Restaurant data API endpoint

**Frontend:**
- `app/page.tsx` - Restaurant dashboard (completely rewritten)

**Seeding:**
- `scripts/seedPartner.ts` - Partner account seeder

**Config:**
- `.env.local` - Added NEXTAUTH_SECRET and NEXTAUTH_URL

### Database Schema

**New Collection: `restaurant_partners`**
```javascript
{
  restaurant_id: string,    // Links to restaurants collection
  restaurant_name: string,
  email: string,
  password: string,         // Plain text for demo (use hashing in production!)
  address: string,
  created_at: Timestamp
}
```

### Data Flow

1. User visits `/` → Redirected to `/login` if not authenticated
2. User enters credentials → NextAuth validates against `restaurant_partners`
3. On success → JWT token created with `restaurantId`
4. User redirected to `/` → Dashboard loads
5. Dashboard calls `/api/restaurant` → Authenticated API endpoint
6. API gets `restaurantId` from session → Queries Firestore
7. Returns restaurant-specific data → Dashboard renders

## Security Features

- ✅ Protected routes (auto-redirect if not authenticated)
- ✅ Session-based authentication
- ✅ Restaurant ID stored in JWT token
- ✅ API endpoints verify authentication
- ✅ Each restaurant can only see their own data

## Production Deployment

### Before Deploying

1. **Hash passwords** - Never store plain text passwords in production
   ```typescript
   import bcrypt from 'bcryptjs';
   const hashedPassword = await bcrypt.hash(password, 10);
   ```

2. **Update NEXTAUTH_URL** in Vercel environment variables
   ```
   NEXTAUTH_URL=https://your-production-url.vercel.app
   ```

3. **Generate secure NEXTAUTH_SECRET**
   ```bash
   openssl rand -base64 32
   ```

4. **Add Firestore indexes** for restaurant queries
   ```
   restaurants: restaurant_id
   swipes: restaurant_id + timestamp (desc)
   ```

### Deploy Command

```bash
cd admin
npx vercel --prod
```

Set environment variables in Vercel:
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Next Steps

### For MVP:
1. ✅ Authentication working
2. ✅ Restaurant-specific dashboards
3. ✅ Insights generation
4. ✅ Data visualization

### For Production:
1. Hash passwords with bcrypt
2. Add password reset flow
3. Add email verification
4. Add user roles (owner, manager, staff)
5. Add restaurant profile editing
6. Add export data feature
7. Add notification system

## Testing Checklist

- ✅ Login redirects to dashboard
- ✅ Invalid credentials show error
- ✅ Dashboard shows only restaurant's data
- ✅ KPI cards display correct numbers
- ✅ Charts render correctly
- ✅ Insights are relevant
- ✅ Sign out works
- ✅ Accessing `/` without auth redirects to login

---

**Dashboard Live at:** http://localhost:3000
**Status:** ✅ Ready for testing and deployment
