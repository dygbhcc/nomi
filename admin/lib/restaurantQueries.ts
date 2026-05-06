import { db } from './firebase-admin';

export async function getRestaurantProfile(restaurantId: string) {
  const doc = await db.collection('restaurants').doc(restaurantId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function getRestaurantSwipeStats(restaurantId: string) {
  const snap = await db.collection('swipes')
    .where('restaurant_id', '==', restaurantId)
    .orderBy('timestamp', 'desc')
    .limit(200)
    .get();

  const swipes = snap.docs.map(d => d.data());
  const likes = swipes.filter(s => s.direction === 'like');
  const passes = swipes.filter(s => s.direction === 'pass');

  const hourCounts: Record<number, { likes: number; total: number }> = {};
  const dayCounts: Record<number, { likes: number; total: number }> = {};
  const moodCounts: Record<string, number> = {};
  const weeklyLikes: number[] = Array(7).fill(0);
  const weeklyTotal: number[] = Array(7).fill(0);

  swipes.forEach(s => {
    const ts = s.timestamp?.toDate?.() || new Date();
    const hour = ts.getHours();
    const day = ts.getDay();

    if (!hourCounts[hour]) hourCounts[hour] = { likes: 0, total: 0 };
    if (!dayCounts[day]) dayCounts[day] = { likes: 0, total: 0 };

    hourCounts[hour].total++;
    dayCounts[day].total++;
    weeklyTotal[day]++;

    if (s.direction === 'like') {
      hourCounts[hour].likes++;
      dayCounts[day].likes++;
      weeklyLikes[day]++;
    }

    (s.moods || []).forEach((m: string) => {
      moodCounts[m] = (moodCounts[m] || 0) + 1;
    });
  });

  const peakHour = Object.entries(hourCounts)
    .sort(([,a], [,b]) => b.total - a.total)[0];

  const topMoods = Object.entries(moodCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([mood]) => mood);

  return {
    total: swipes.length,
    likes: likes.length,
    passes: passes.length,
    likeRate: swipes.length > 0 ? Math.round((likes.length / swipes.length) * 100) : 0,
    hourCounts,
    dayCounts,
    weeklyLikes,
    weeklyTotal,
    moodCounts,
    peakHour: peakHour ? `${peakHour[0]}:00` : 'N/A',
    topMoods,
  };
}

export async function getRestaurantDemandScore(restaurantId: string) {
  const snap = await db.collection('restaurants').doc(restaurantId).get();
  if (!snap.exists) return null;

  const data = snap.data()!;
  const confidenceScores = data.confidence_scores || {};
  const confidenceAvg = Object.values(confidenceScores).length > 0
    ? (Object.values(confidenceScores) as number[]).reduce((a, b) => a + b, 0) / Object.values(confidenceScores).length
    : 50;

  const swipeSnap = await db.collection('swipes')
    .where('restaurant_id', '==', restaurantId)
    .limit(100)
    .get();

  const swipes = swipeSnap.docs.map(d => d.data());
  const likes = swipes.filter(s => s.direction === 'like').length;
  const swipeRightRate = swipes.length > 0 ? likes / swipes.length : 0;
  const recencyWeight = Math.min(swipes.length / 10, 1);

  const demandScore = Math.round(
    (swipeRightRate * 0.5 + (confidenceAvg / 100) * 0.3 + recencyWeight * 0.2) * 100
  );

  return {
    demandScore,
    confidenceAvg: Math.round(confidenceAvg),
    swipeRightRate: Math.round(swipeRightRate * 100),
    moodTags: data.mood_tags || [],
    confidenceScores,
    isVerified: data.is_pmo_verified || false,
  };
}

export async function getRestaurantInsights(restaurantId: string) {
  const [stats, demand, demandSignals] = await Promise.all([
    getRestaurantSwipeStats(restaurantId),
    getRestaurantDemandScore(restaurantId),
    db.collection('demand_signals').doc('current').get(),
  ]);

  const signals = demandSignals.exists ? demandSignals.data() : null;
  const topMood = stats.topMoods[0] || 'romantic';
  const moodDemand = signals?.scores?.[topMood] || 50;

  const insights: string[] = [];

  if (stats.likeRate >= 70) {
    insights.push(`Strong performance — ${stats.likeRate}% of users who saw your restaurant liked it.`);
  } else if (stats.likeRate >= 50) {
    insights.push(`Good engagement — ${stats.likeRate}% like rate. Consider updating your mood tags.`);
  } else if (stats.total > 0) {
    insights.push(`Room to improve — only ${stats.likeRate}% like rate. Your photos or mood tags may need updating.`);
  }

  if (moodDemand >= 70 && topMood) {
    insights.push(`High ${topMood} demand in Lisbon right now (${moodDemand}/100) — your top mood. Great time for a promotion.`);
  }

  const peakHourNum = parseInt(stats.peakHour);
  if (peakHourNum >= 19 && peakHourNum <= 22) {
    insights.push(`Your peak discovery time is dinner hours (${stats.peakHour}). Make sure your evening presence is strong.`);
  }

  if (stats.total === 0) {
    insights.push('No swipe data yet. Your restaurant will appear in the app as users explore your area.');
  }

  return { stats, demand, signals, insights };
}
