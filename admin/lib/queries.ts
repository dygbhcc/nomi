import { db } from './firebase-admin';

export async function getTopRestaurants(limit = 10) {
  const snap = await db.collection('restaurants')
    .orderBy('google_rating', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getSwipeStats() {
  const snap = await db.collection('swipes')
    .orderBy('timestamp', 'desc')
    .limit(500)
    .get();

  const swipes = snap.docs.map(d => d.data());

  const moodCounts: Record<string, { likes: number; passes: number }> = {};
  const hourCounts: Record<number, number> = {};
  let totalLikes = 0;
  let totalPasses = 0;

  swipes.forEach(s => {
    const direction = s.direction;
    const moods: string[] = s.moods || [];
    const ts = s.timestamp?.toDate?.() || new Date();
    const hour = ts.getHours();

    if (direction === 'like') totalLikes++;
    else totalPasses++;

    hourCounts[hour] = (hourCounts[hour] || 0) + 1;

    moods.forEach(mood => {
      if (!moodCounts[mood]) moodCounts[mood] = { likes: 0, passes: 0 };
      if (direction === 'like') moodCounts[mood].likes++;
      else moodCounts[mood].passes++;
    });
  });

  return { moodCounts, hourCounts, totalLikes, totalPasses, total: swipes.length };
}

export async function getConfidenceStats() {
  const snap = await db.collection('restaurants')
    .where('mood_tags', '!=', [])
    .limit(200)
    .get();

  const distribution = { high: 0, medium: 0, low: 0, unvalidated: 0 };

  snap.docs.forEach(d => {
    const scores = d.data().confidence_scores || {};
    Object.values(scores).forEach((score: any) => {
      if (score >= 80) distribution.high++;
      else if (score >= 50) distribution.medium++;
      else if (score >= 30) distribution.low++;
      else distribution.unvalidated++;
    });
  });

  return distribution;
}

export async function getRestaurantDemand(restaurantId: string) {
  const snap = await db.collection('swipes')
    .where('restaurant_id', '==', restaurantId)
    .orderBy('timestamp', 'desc')
    .limit(100)
    .get();

  const swipes = snap.docs.map(d => d.data());
  const likes = swipes.filter(s => s.direction === 'like').length;
  const demandScore = swipes.length > 0 ? Math.round((likes / swipes.length) * 100) : 0;

  return { total: swipes.length, likes, demandScore };
}

export async function getRestaurantDemandScores(limit = 20) {
  const swipesSnap = await db.collection('swipes')
    .orderBy('timestamp', 'desc')
    .limit(1000)
    .get();

  const swipes = swipesSnap.docs.map(d => d.data());

  const restaurantStats: Record<string, { likes: number; total: number; moods: string[] }> = {};

  swipes.forEach(s => {
    const rid = s.restaurant_id;
    if (!rid) return;
    if (!restaurantStats[rid]) restaurantStats[rid] = { likes: 0, total: 0, moods: [] };
    restaurantStats[rid].total++;
    if (s.direction === 'like') restaurantStats[rid].likes++;
    if (s.moods) restaurantStats[rid].moods.push(...s.moods);
  });

  const restaurantIds = Object.keys(restaurantStats).slice(0, limit);
  if (restaurantIds.length === 0) return [];

  const docs = await Promise.all(
    restaurantIds.map(id => db.collection('restaurants').doc(id).get())
  );

  return docs
    .filter(d => d.exists)
    .map(d => {
      const data = d.data()!;
      const stats = restaurantStats[d.id];
      const swipeRightRate = stats.total > 0 ? stats.likes / stats.total : 0;
      const confidenceAvg = Object.values(data.confidence_scores || {}).length > 0
        ? Object.values(data.confidence_scores as Record<string, number>)
            .reduce((a, b) => a + b, 0) / Object.values(data.confidence_scores).length
        : 50;
      const recencyWeight = Math.min(stats.total / 10, 1);
      const demandScore = Math.round(
        (swipeRightRate * 0.5 + (confidenceAvg / 100) * 0.3 + recencyWeight * 0.2) * 100
      );

      return {
        id: d.id,
        name: data.name,
        address: data.address,
        google_rating: data.google_rating,
        budget_level: data.budget_level,
        mood_tags: data.mood_tags || [],
        confidence_scores: data.confidence_scores || {},
        swipeRightRate: Math.round(swipeRightRate * 100),
        totalSwipes: stats.total,
        demandScore,
      };
    })
    .sort((a, b) => b.demandScore - a.demandScore);
}

export async function getWeeklySwipeTrend() {
  const snap = await db.collection('swipes')
    .orderBy('timestamp', 'desc')
    .limit(500)
    .get();

  const swipes = snap.docs.map(d => d.data());
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayCounts: Record<number, { likes: number; total: number }> = {};

  for (let i = 0; i < 7; i++) dayCounts[i] = { likes: 0, total: 0 };

  swipes.forEach(s => {
    const ts = s.timestamp?.toDate?.() || new Date();
    const day = ts.getDay();
    dayCounts[day].total++;
    if (s.direction === 'like') dayCounts[day].likes++;
  });

  return days.map((label, i) => ({
    label,
    total: dayCounts[i].total,
    likes: dayCounts[i].likes,
    likeRate: dayCounts[i].total > 0
      ? Math.round((dayCounts[i].likes / dayCounts[i].total) * 100)
      : 0,
  }));
}
