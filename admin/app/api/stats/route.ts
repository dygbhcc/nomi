import { NextResponse } from 'next/server';
import { getSwipeStats, getTopRestaurants, getConfidenceStats } from '@/lib/queries';

export async function GET() {
  try {
    const [swipeStats, restaurants, confidenceStats] = await Promise.all([
      getSwipeStats(),
      getTopRestaurants(10),
      getConfidenceStats(),
    ]);

    return NextResponse.json({
      swipeStats,
      restaurants,
      confidenceStats,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
