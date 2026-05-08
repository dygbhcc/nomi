import { NextRequest, NextResponse } from 'next/server';
import {
  getRestaurantProfile,
  getRestaurantInsights,
} from '@/lib/restaurantQueries';
import { db } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    // Get first restaurant partner's restaurant_id
    const partnerSnap = await db.collection('restaurant_partners')
      .limit(1)
      .get();

    if (partnerSnap.empty) {
      return NextResponse.json({ error: 'No restaurant found' }, { status: 404 });
    }

    const restaurantId = partnerSnap.docs[0].data().restaurant_id;

    const [profile, insights] = await Promise.all([
      getRestaurantProfile(restaurantId),
      getRestaurantInsights(restaurantId),
    ]);

    return NextResponse.json({ profile, ...insights });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load restaurant data' }, { status: 500 });
  }
}
