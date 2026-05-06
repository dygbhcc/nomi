'use client';
import { useEffect, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

const ACCENT = '#E06A4F';
const MOODS = ['romantic', 'energetic', 'chill', 'explorer', 'focus', 'retreat', 'hungry_quick', 'celebrating'];
const HOURS = Array.from({ length: 16 }, (_, i) => `${i + 8}:00`);

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [demandData, setDemandData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch stats and demand forecast in parallel
    Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/demand').then(r => r.json()).catch(() => null),
    ])
      .then(([stats, demand]) => {
        setData(stats);
        setDemandData(demand);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl font-bold text-[#E06A4F] mb-2">nomi</div>
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    </div>
  );

  const { swipeStats, restaurants, confidenceStats } = data || {};

  // Mood bar chart data
  const moodData = {
    labels: MOODS,
    datasets: [
      {
        label: 'Likes',
        data: MOODS.map(m => swipeStats?.moodCounts?.[m]?.likes || 0),
        backgroundColor: ACCENT,
        borderRadius: 6,
      },
      {
        label: 'Passes',
        data: MOODS.map(m => swipeStats?.moodCounts?.[m]?.passes || 0),
        backgroundColor: '#F0E8E5',
        borderRadius: 6,
      }
    ]
  };

  // Hour distribution
  const hourData = {
    labels: HOURS,
    datasets: [{
      label: 'Swipes',
      data: HOURS.map((_, i) => swipeStats?.hourCounts?.[i + 8] || 0),
      borderColor: ACCENT,
      backgroundColor: 'rgba(224,106,79,0.1)',
      tension: 0.4,
      fill: true,
    }]
  };

  // Confidence doughnut
  const confData = {
    labels: ['Validated (≥80)', 'Medium (50–79)', 'Low (30–49)', 'Unvalidated'],
    datasets: [{
      data: [
        confidenceStats?.high || 0,
        confidenceStats?.medium || 0,
        confidenceStats?.low || 0,
        confidenceStats?.unvalidated || 0,
      ],
      backgroundColor: ['#27500A', ACCENT, '#FAC775', '#E8E8E8'],
      borderWidth: 0,
    }]
  };

  const likeRate = swipeStats?.total > 0
    ? Math.round((swipeStats.totalLikes / swipeStats.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-[#E06A4F]">nomi</span>
          <span className="text-gray-400 text-sm">|</span>
          <span className="text-gray-600 text-sm font-medium">Demand Intelligence Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-xs text-gray-500">Lisbon, Portugal — Live</span>
        </div>
      </header>

      <main className="px-8 py-6 max-w-7xl mx-auto">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total swipes', value: swipeStats?.total || 0, sub: 'last 500 sessions' },
            { label: 'Like rate', value: likeRate + '%', sub: 'engagement score' },
            { label: 'Restaurants indexed', value: '2,301', sub: 'Lisbon database' },
            { label: 'Validated tags', value: confidenceStats?.high || 0, sub: 'confidence ≥ 80' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="text-xs text-gray-400 mb-1">{k.label}</div>
              <div className="text-2xl font-semibold text-gray-900">{k.value}</div>
              <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-700 mb-4">Demand by mood category</div>
            <Bar data={moodData} options={{
              responsive: true,
              plugins: { legend: { position: 'top' } },
              scales: { x: { grid: { display: false } }, y: { grid: { color: '#F5F5F5' } } }
            }} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-700 mb-4">Tag confidence distribution</div>
            <Doughnut data={confData} options={{
              responsive: true,
              plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
              cutout: '65%'
            }} />
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-700 mb-4">Activity by hour of day</div>
            <Line data={hourData} options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { x: { grid: { display: false } }, y: { grid: { color: '#F5F5F5' } } }
            }} />
          </div>
          {/* Demand score table */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-700 mb-4">
              Restaurant demand scores
              <span className="text-xs text-gray-400 ml-2 font-normal">
                swipe rate × confidence × activity
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Restaurant</th>
                  <th className="text-center pb-2 font-medium">Swipes</th>
                  <th className="text-center pb-2 font-medium">Like rate</th>
                  <th className="text-center pb-2 font-medium">Demand score</th>
                </tr>
              </thead>
              <tbody>
                {(data?.demandScores || []).map((r: any) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-4">
                      <div className="font-medium text-gray-800 truncate max-w-48">{r.name}</div>
                      <div className="text-xs text-gray-400">{r.mood_tags?.slice(0, 2).join(' · ')}</div>
                    </td>
                    <td className="py-2 text-center text-gray-600">{r.totalSwipes}</td>
                    <td className="py-2 text-center text-gray-600">{r.swipeRightRate}%</td>
                    <td className="py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                        ${r.demandScore >= 70 ? 'bg-green-50 text-green-700' :
                          r.demandScore >= 40 ? 'bg-orange-50 text-orange-700' :
                          'bg-gray-50 text-gray-600'}`}>
                        {r.demandScore}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!data?.demandScores || data.demandScores.length === 0) && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-400 text-sm">
                    No swipe data yet — start swiping in the app
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Weekly trend chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <div className="text-sm font-medium text-gray-700 mb-4">Weekly demand pattern</div>
          <Bar
            data={{
              labels: (data?.weeklyTrend || []).map((d: any) => d.label),
              datasets: [
                {
                  label: 'Like rate %',
                  data: (data?.weeklyTrend || []).map((d: any) => d.likeRate),
                  backgroundColor: ACCENT,
                  borderRadius: 6,
                },
                {
                  label: 'Total swipes',
                  data: (data?.weeklyTrend || []).map((d: any) => d.total),
                  backgroundColor: '#F0E8E5',
                  borderRadius: 6,
                }
              ]
            }}
            options={{
              responsive: true,
              plugins: { legend: { position: 'top' } },
              scales: {
                x: { grid: { display: false } },
                y: { grid: { color: '#F5F5F5' } }
              }
            }}
          />
        </div>

        {/* Explainable AI section */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <div className="text-sm font-medium text-gray-700 mb-3">
            How demand scores are calculated
            <span className="ml-2 text-xs font-normal text-[#E06A4F]">Explainable AI</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { factor: 'Swipe right rate', weight: '50%', desc: 'How often users liked this restaurant vs passed', icon: '→' },
              { factor: 'Confidence score', weight: '30%', desc: 'How validated the mood tags are (Vision AI + human)', icon: '✓' },
              { factor: 'Activity recency', weight: '20%', desc: 'How recently users have been discovering this venue', icon: '◉' },
            ].map(f => (
              <div key={f.factor} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{f.factor}</span>
                  <span className="text-xs font-bold text-[#E06A4F]">{f.weight}</span>
                </div>
                <div className="text-xs text-gray-500">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Live demand signals */}
        {demandData && !demandData.error ? (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-700">Live demand forecast — Lisbon right now</div>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                demandData.overall?.category === 'very high' ? 'bg-green-100 text-green-700' :
                demandData.overall?.category === 'high' ? 'bg-green-50 text-green-600' :
                demandData.overall?.category === 'elevated' ? 'bg-orange-50 text-orange-600' :
                demandData.overall?.category === 'low' ? 'bg-gray-100 text-gray-600' :
                'bg-gray-50 text-gray-500'
              }`}>
                {demandData.overall?.percentageChange || '0%'} vs baseline
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Weather</div>
                <div className="text-sm font-medium text-gray-800">
                  {demandData.factors?.weather?.conditions}, {demandData.factors?.weather?.temperature}°C
                </div>
                <div className={`text-xs mt-1 ${
                  demandData.factors?.weather?.category === 'high' ? 'text-green-600' :
                  demandData.factors?.weather?.category === 'medium' ? 'text-orange-600' :
                  'text-gray-500'
                }`}>
                  {demandData.factors?.weather?.description}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Events</div>
                <div className="text-sm font-medium text-gray-800">
                  {demandData.factors?.events?.majorEventsCount > 0
                    ? `${demandData.factors?.events?.majorEventsCount} major event${demandData.factors?.events?.majorEventsCount > 1 ? 's' : ''}`
                    : 'No major events'}
                </div>
                <div className={`text-xs mt-1 ${
                  demandData.factors?.events?.category === 'high' ? 'text-green-600' :
                  demandData.factors?.events?.category === 'medium' ? 'text-orange-600' :
                  'text-gray-500'
                }`}>
                  {demandData.factors?.events?.description}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Time</div>
                <div className="text-sm font-medium text-gray-800">
                  {demandData.factors?.time?.currentHour}:00 · {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][demandData.factors?.time?.dayOfWeek]}
                </div>
                <div className={`text-xs mt-1 ${
                  demandData.factors?.time?.category === 'high' ? 'text-green-600' :
                  demandData.factors?.time?.category === 'medium' ? 'text-orange-600' :
                  'text-gray-500'
                }`}>
                  {demandData.factors?.time?.description}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Tourism</div>
                <div className="text-sm font-medium text-gray-800">
                  {demandData.factors?.tourism?.description}
                </div>
                <div className={`text-xs mt-1 ${
                  demandData.factors?.tourism?.category === 'high' ? 'text-green-600' :
                  demandData.factors?.tourism?.category === 'medium' ? 'text-orange-600' :
                  'text-gray-500'
                }`}>
                  {demandData.factors?.tourism?.impactScore > 0 ? `+${demandData.factors?.tourism?.impactScore}%` : `${demandData.factors?.tourism?.impactScore}%`}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-3">
              Live data from OpenWeatherMap + Eventbrite · Updated every hour · Last update: {demandData.metadata?.calculatedAt ? new Date(demandData.metadata.calculatedAt).toLocaleTimeString() : 'N/A'}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-700 mb-3">Demand signal factors — Lisbon this week</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Weather', value: 'Loading...', impact: 'Fetching live data', color: 'text-gray-400' },
                { label: 'Events', value: 'Loading...', impact: 'Fetching live data', color: 'text-gray-400' },
                { label: 'Tourism', value: 'Loading...', impact: 'Fetching live data', color: 'text-gray-400' },
              ].map(f => (
                <div key={f.label} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">{f.label}</div>
                  <div className="text-sm font-medium text-gray-800">{f.value}</div>
                  <div className={`text-xs mt-1 ${f.color}`}>{f.impact}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-3">
              {demandData?.error || 'Initializing demand forecast system...'}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-300 text-center mt-6">
          nomi demand intelligence · Lisbon pilot · data updated in real time
        </div>
      </main>
    </div>
  );
}
