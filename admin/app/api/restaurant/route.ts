import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getRestaurantProfile,
  getRestaurantInsights,
} from '@/lib/restaurantQueries';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const restaurantId = (session as any).restaurantId;
  if (!restaurantId) {
    return NextResponse.json({ error: 'No restaurant linked to this account' }, { status: 400 });
  }

  try {
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
