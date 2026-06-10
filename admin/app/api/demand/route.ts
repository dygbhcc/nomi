import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

// Prevent build-time prerendering — this route must only query Firestore at request time
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch latest demand forecast from Firestore
    const forecastDoc = await db.collection('demand_forecasts').doc('latest').get();

    if (!forecastDoc.exists) {
      return NextResponse.json({
        error: 'No forecast data available yet. Trigger initial update.',
        suggestion: 'Call getDemandForecast Cloud Function or wait for scheduled update.',
      }, { status: 404 });
    }

    const forecast = forecastDoc.data();

    return NextResponse.json({
      ...forecast,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Demand API error:', error);
    return NextResponse.json({ error: 'Failed to fetch demand forecast' }, { status: 500 });
  }
}
