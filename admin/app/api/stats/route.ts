import { NextResponse } from 'next/server';
import { getSwipeStats, getTopRestaurants, getConfidenceStats, getRestaurantDemandScores, getWeeklySwipeTrend } from '@/lib/queries';

// Prevent build-time prerendering — this route must only query Firestore at request time
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [swipeStats, restaurants, confidenceStats, demandScores, weeklyTrend] = await Promise.all([
      getSwipeStats(),
      getTopRestaurants(10),
      getConfidenceStats(),
      getRestaurantDemandScores(15),
      getWeeklySwipeTrend(),
    ]);

    return NextResponse.json({
      swipeStats,
      restaurants,
      confidenceStats,
      demandScores,
      weeklyTrend,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
