import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET() {
  try {
    // Test Firebase connection
    const testQuery = await db.collection('restaurant_partners')
      .limit(1)
      .get();

    if (testQuery.empty) {
      return NextResponse.json({
        status: 'warning',
        message: 'Firebase connected but no partners found',
        hasEnvVars: {
          projectId: !!process.env.FIREBASE_PROJECT_ID,
          clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        }
      });
    }

    const partner = testQuery.docs[0].data();

    return NextResponse.json({
      status: 'success',
      message: 'Firebase connected successfully',
      sample: {
        email: partner.email,
        restaurant: partner.restaurant_name,
      },
      hasEnvVars: {
        projectId: !!process.env.FIREBASE_PROJECT_ID,
        clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message,
      hasEnvVars: {
        projectId: !!process.env.FIREBASE_PROJECT_ID,
        clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      }
    }, { status: 500 });
  }
}
