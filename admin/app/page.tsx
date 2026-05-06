'use client';
import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend);

const ACCENT = '#E06A4F';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 16 }, (_, i) => `${i + 8}:00`);

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/restaurant')
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-bold text-[#E06A4F] mb-2">nomi</div>
          <div className="text-gray-400 text-sm">Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  if (!data?.profile) return null;

  const { profile, stats, demand, signals, insights } = data;

  const weeklyData = {
    labels: DAYS,
    datasets: [
      {
        label: 'Views',
        data: stats?.weeklyTotal || Array(7).fill(0),
        backgroundColor: '#F0E8E5',
        borderRadius: 6,
      },
      {
        label: 'Likes',
        data: stats?.weeklyLikes || Array(7).fill(0),
        backgroundColor: ACCENT,
        borderRadius: 6,
      },
    ],
  };

  const hourData = {
    labels: HOURS,
    datasets: [{
      label: 'Discovery activity',
      data: HOURS.map((_, i) => stats?.hourCounts?.[i + 8]?.total || 0),
      borderColor: ACCENT,
      backgroundColor: 'rgba(224,106,79,0.08)',
      tension: 0.4,
      fill: true,
    }],
  };

  const moodData = {
    labels: Object.keys(stats?.moodCounts || {}),
    datasets: [{
      data: Object.values(stats?.moodCounts || {}),
      backgroundColor: [
        '#E06A4F', '#F0997B', '#FAC775', '#97C459',
        '#5DCAA5', '#85B7EB', '#AFA9EC', '#ED93B1'
      ],
      borderWidth: 0,
    }],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-[#E06A4F]">nomi</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-700 font-medium text-sm">{profile.name}</span>
          {demand?.isVerified && (
            <span className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
              Verified
            </span>
          )}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Sign out
        </button>
      </header>

      <main className="px-8 py-6 max-w-6xl mx-auto">

        {/* Insights */}
        {insights?.length > 0 && (
          <div className="mb-6 space-y-2">
            {insights.map((insight: string, i: number) => (
              <div key={i} className="bg-[#FDF0EC] border border-[#F0997B] rounded-xl px-4 py-3 text-sm text-[#712B13]">
                {insight}
              </div>
            ))}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total views', value: stats?.total || 0, sub: 'times your restaurant appeared' },
            { label: 'Likes', value: stats?.likes || 0, sub: 'users who liked you' },
            { label: 'Like rate', value: `${stats?.likeRate || 0}%`, sub: 'engagement score' },
            { label: 'Demand score', value: demand?.demandScore || 0, sub: 'out of 100' },
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
            <div className="text-sm font-medium text-gray-700 mb-4">Weekly views & likes</div>
            <Bar data={weeklyData} options={{
              responsive: true,
              plugins: { legend: { position: 'top' } },
              scales: {
                x: { grid: { display: false } },
                y: { grid: { color: '#F5F5F5' }, beginAtZero: true },
              },
            }} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-700 mb-4">Discovery moods</div>
            {Object.keys(stats?.moodCounts || {}).length > 0 ? (
              <Doughnut data={moodData} options={{
                responsive: true,
                plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
                cutout: '60%',
              }} />
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                No mood data yet
              </div>
            )}
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-700 mb-4">Peak discovery hours</div>
            <Line data={hourData} options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                x: { grid: { display: false } },
                y: { grid: { color: '#F5F5F5' }, beginAtZero: true },
              },
            }} />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-700 mb-3">Mood tag confidence</div>
            <div className="space-y-2">
              {Object.entries(demand?.confidenceScores || {}).map(([mood, score]: any) => (
                <div key={mood} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-gray-600 capitalize">
                    {mood.replace('_', ' ')}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${score}%`,
                        backgroundColor: score >= 80 ? '#27500A' : score >= 50 ? ACCENT : '#E8E8E8',
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 w-8 text-right">{score}</div>
                </div>
              ))}
              {Object.keys(demand?.confidenceScores || {}).length === 0 && (
                <div className="text-sm text-gray-400 text-center py-4">
                  No mood tags validated yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Demand signals */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="text-sm font-medium text-gray-700 mb-3">
            Lisbon demand signals today
            <span className="text-xs text-gray-400 font-normal ml-2">affects all restaurants</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Weather</div>
              <div className="text-sm font-medium text-gray-800">
                {signals?.weather
                  ? `${signals.weather.temp}°C — ${signals.weather.description}`
                  : 'Data loading...'}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Top mood demand</div>
              {Object.entries(signals?.scores || {})
                .sort(([,a]: any, [,b]: any) => b - a)
                .slice(0, 1)
                .map(([mood, score]: any) => (
                  <div key={mood}>
                    <div className="text-sm font-medium text-gray-800 capitalize">
                      {mood.replace('_', ' ')}
                    </div>
                    <div className="text-xs text-[#E06A4F] mt-1">{score}/100 demand score</div>
                  </div>
                ))}
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Your peak time</div>
              <div className="text-sm font-medium text-gray-800">{stats?.peakHour || 'N/A'}</div>
              <div className="text-xs text-gray-500 mt-1">based on swipe data</div>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-300 text-center mt-6">
          nomi partner dashboard · {profile.address} · data updates every 6 hours
        </div>
      </main>
    </div>
  );
}
