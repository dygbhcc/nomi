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
