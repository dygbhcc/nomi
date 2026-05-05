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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch((err) => { console.error(err); setLoading(false); });
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
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-700 mb-4">Top restaurants by rating</div>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {(restaurants || []).map((r: any, i: number) => (
                <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                    <span className="text-sm text-gray-700 truncate max-w-48">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{r.budget_level ? '€'.repeat(r.budget_level) : '€€'}</span>
                    <span className="text-sm font-medium text-[#E06A4F]">{r.google_rating?.toFixed(1) || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Signal factors placeholder */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="text-sm font-medium text-gray-700 mb-3">Demand signal factors — Lisbon this week</div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Weather', value: 'Sunny, 24°C', impact: '+18% outdoor demand', color: 'text-green-600' },
              { label: 'Events', value: 'No major events', impact: 'Baseline demand', color: 'text-gray-500' },
              { label: 'Tourism', value: 'Peak season', impact: '+32% vs off-season', color: 'text-green-600' },
            ].map(f => (
              <div key={f.label} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">{f.label}</div>
                <div className="text-sm font-medium text-gray-800">{f.value}</div>
                <div className={`text-xs mt-1 ${f.color}`}>{f.impact}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-3">
            Weather + events API integration coming Day 5–6. Signal factors will be dynamic.
          </div>
        </div>

        <div className="text-xs text-gray-300 text-center mt-6">
          nomi demand intelligence · Lisbon pilot · data updated in real time
        </div>
      </main>
    </div>
  );
}
