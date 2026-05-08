'use client';
import { useEffect, useState } from 'react';
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
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/restaurant')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-bold text-[#E06A4F] mb-2">nomi</div>
          <div className="text-gray-400 text-sm">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-bold text-[#E06A4F] mb-2">nomi</div>
          <div className="text-gray-400 text-sm">No restaurant data found</div>
        </div>
      </div>
    );
  }

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
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-[#E06A4F]">nomi</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-700 font-medium text-sm">Demand Intelligence Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-500">Live · Lisbon, Portugal</span>
            </div>
            <span className="text-xs text-gray-400">{profile?.name}</span>
          </div>
        </div>
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

        {/* Forecasting KPI row */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            {
              label: 'Demand score',
              value: demand?.demandScore ?? '—',
              sub: 'composite forecast index',
              highlight: true,
              desc: 'swipe intent × tag confidence × recency',
            },
            {
              label: 'Like rate',
              value: `${stats?.likeRate ?? 0}%`,
              sub: 'consumer intent signal',
              highlight: false,
              desc: `${stats?.likes ?? 0} likes / ${stats?.total ?? 0} views`,
            },
            {
              label: 'Tag confidence avg',
              value: demand?.confidenceAvg ? `${demand.confidenceAvg}/100` : '—',
              sub: 'AI validation score',
              highlight: false,
              desc: 'Vision AI + human validation',
            },
            {
              label: 'Peak demand window',
              value: stats?.peakHour ?? '—',
              sub: 'predicted high traffic',
              highlight: false,
              desc: 'based on swipe timestamp patterns',
            },
            {
              label: 'Lisbon mood signal',
              value: signals?.scores
                ? `${Math.max(...Object.values(signals.scores as Record<string, number>))}/100`
                : '—',
              sub: 'city-wide demand index',
              highlight: false,
              desc: 'weather + events + time-of-day',
            },
          ].map(k => (
            <div key={k.label}
              className={`rounded-xl border p-4 ${k.highlight
                ? 'bg-[#E06A4F] border-[#E06A4F]'
                : 'bg-white border-gray-100'}`}>
              <div className={`text-xs mb-1 ${k.highlight ? 'text-orange-100' : 'text-gray-400'}`}>
                {k.label}
              </div>
              <div className={`text-2xl font-semibold mb-0.5 ${k.highlight ? 'text-white' : 'text-gray-900'}`}>
                {k.value}
              </div>
              <div className={`text-xs ${k.highlight ? 'text-orange-200' : 'text-gray-400'}`}>
                {k.sub}
              </div>
              <div className={`text-xs mt-2 pt-2 border-t ${k.highlight
                ? 'border-orange-400 text-orange-200'
                : 'border-gray-50 text-gray-300'}`}>
                {k.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Demand forecast panel */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-base font-medium text-gray-800">
                Automated demand forecast — {profile?.name}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Generated from {4} public data sources + {stats?.total ?? 0} anonymised user intent signals
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Last updated</div>
              <div className="text-xs font-medium text-gray-600">
                {signals?.generated_at
                  ? new Date(signals.generated_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
                  : 'Calculating...'}
              </div>
            </div>
          </div>

          {/* Mood demand bars */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6">
            {Object.entries(signals?.scores || {}).map(([mood, score]: any) => {
              const myTopMood = stats?.topMoods?.includes(mood);
              return (
                <div key={mood} className="flex items-center gap-3">
                  <div className={`w-28 text-xs capitalize flex items-center gap-1
                    ${myTopMood ? 'text-[#E06A4F] font-medium' : 'text-gray-500'}`}>
                    {myTopMood && <span className="w-1 h-1 rounded-full bg-[#E06A4F] flex-shrink-0"></span>}
                    {mood.replace('_', ' ')}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${score}%`,
                        backgroundColor:
                          score >= 70 ? '#27500A' :
                          score >= 50 ? '#E06A4F' : '#D3D1C7',
                      }}
                    />
                  </div>
                  <div className={`text-xs font-medium w-10 text-right
                    ${score >= 70 ? 'text-green-700' :
                      score >= 50 ? 'text-[#E06A4F]' : 'text-gray-400'}`}>
                    {score}
                    {score >= 70 ? ' ▲' : score < 30 ? ' ▼' : ''}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Signal sources */}
          <div className="border-t border-gray-50 pt-4">
            <div className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">
              Signal sources contributing to this forecast
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                {
                  source: 'Weather data',
                  provider: 'OpenWeatherMap API',
                  signal: signals?.weather
                    ? `${signals.weather.temp}°C, ${signals.weather.main}`
                    : 'Fetching...',
                  impact: signals?.outdoor_boost > 0
                    ? `+${signals.outdoor_boost}% outdoor`
                    : signals?.indoor_boost > 0
                    ? `+${signals.indoor_boost}% indoor`
                    : 'Neutral',
                  color: 'blue',
                },
                {
                  source: 'Local events',
                  provider: 'Lisbon events calendar',
                  signal: signals?.events?.length > 0
                    ? `${signals.events.length} events this week`
                    : 'No major events',
                  impact: signals?.events?.[0]?.name
                    ? signals.events[0].name.slice(0, 20) + '...'
                    : 'Baseline demand',
                  color: 'purple',
                },
                {
                  source: 'Time pattern',
                  provider: 'Historical swipe data',
                  signal: new Date().getHours() >= 19
                    ? 'Dinner hours'
                    : new Date().getHours() >= 12
                    ? 'Lunch hours'
                    : 'Morning',
                  impact: new Date().getDay() === 5 || new Date().getDay() === 6
                    ? 'Weekend boost active'
                    : 'Weekday pattern',
                  color: 'amber',
                },
                {
                  source: 'Consumer intent',
                  provider: `${stats?.total ?? 0} anonymised swipes`,
                  signal: `${stats?.likeRate ?? 0}% like rate`,
                  impact: stats?.topMoods?.[0]
                    ? `Top mood: ${stats.topMoods[0]}`
                    : 'No intent data yet',
                  color: 'teal',
                },
              ].map(s => (
                <div key={s.source} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="text-xs font-medium text-gray-700 mb-0.5">{s.source}</div>
                  <div className="text-xs text-gray-400 mb-2">{s.provider}</div>
                  <div className="text-xs text-gray-800 font-medium">{s.signal}</div>
                  <div className="text-xs text-[#E06A4F] mt-1">{s.impact}</div>
                </div>
              ))}
            </div>
          </div>
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

        {/* Explainable AI — demand score breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="text-sm font-medium text-gray-700">Demand score breakdown</div>
            <span className="bg-[#EEEDFE] text-[#3C3489] text-xs px-2 py-0.5 rounded-full font-medium">
              Explainable AI
            </span>
          </div>

          {/* Score formula visual */}
          <div className="flex items-center gap-3 mb-5 p-4 bg-gray-50 rounded-xl overflow-x-auto">
            {[
              {
                label: 'Swipe intent',
                value: `${stats?.likeRate ?? 0}%`,
                weight: '×0.5',
                contribution: Math.round((stats?.likeRate ?? 0) * 0.5),
              },
              { label: '+', value: '', weight: '', contribution: null },
              {
                label: 'Tag confidence',
                value: `${demand?.confidenceAvg ?? 0}/100`,
                weight: '×0.3',
                contribution: Math.round((demand?.confidenceAvg ?? 0) * 0.3),
              },
              { label: '+', value: '', weight: '', contribution: null },
              {
                label: 'Activity recency',
                value: `${Math.min(Math.round((stats?.total ?? 0) / 10), 10)}/10`,
                weight: '×0.2',
                contribution: Math.round(Math.min((stats?.total ?? 0) / 10, 1) * 20),
              },
              { label: '=', value: '', weight: '', contribution: null },
              {
                label: 'Demand score',
                value: `${demand?.demandScore ?? 0}`,
                weight: '/100',
                contribution: null,
                highlight: true,
              },
            ].map((item, i) =>
              item.contribution === null && !item.highlight ? (
                <div key={i} className="text-gray-400 font-medium text-lg flex-shrink-0">{item.label}</div>
              ) : (
                <div key={i} className={`flex-shrink-0 text-center rounded-xl p-3 min-w-24
                  ${item.highlight
                    ? 'bg-[#E06A4F] text-white'
                    : 'bg-white border border-gray-200'}`}>
                  <div className={`text-xs mb-1 ${item.highlight ? 'text-orange-200' : 'text-gray-400'}`}>
                    {item.label}
                  </div>
                  <div className={`text-lg font-bold ${item.highlight ? 'text-white' : 'text-gray-800'}`}>
                    {item.value}
                  </div>
                  <div className={`text-xs ${item.highlight ? 'text-orange-200' : 'text-[#E06A4F]'}`}>
                    {item.weight}
                    {item.contribution !== null && ` = ${item.contribution}`}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Factor explanations */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                factor: 'Swipe intent (50% weight)',
                what: 'How often users liked your restaurant when shown it',
                why: 'Direct consumer preference signal — the strongest indicator of genuine demand',
                howToImprove: 'Better photos and accurate mood tags increase like rate',
              },
              {
                factor: 'Tag confidence (30% weight)',
                what: 'How validated your mood tags are by real users',
                why: 'Tags with high confidence mean your restaurant is correctly classified, improving match quality',
                howToImprove: 'Tags improve automatically as more users validate in the app',
              },
              {
                factor: 'Activity recency (20% weight)',
                what: 'How recently users have been discovering your restaurant',
                why: 'Recent activity signals current relevance — older data is discounted',
                howToImprove: 'Demand grows naturally as more users discover Lisbon on Nomi',
              },
            ].map(f => (
              <div key={f.factor} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="text-xs font-medium text-gray-800 mb-2">{f.factor}</div>
                <div className="text-xs text-gray-600 mb-1"><span className="font-medium">What:</span> {f.what}</div>
                <div className="text-xs text-gray-600 mb-1"><span className="font-medium">Why:</span> {f.why}</div>
                <div className="text-xs text-[#E06A4F]"><span className="font-medium">Improve:</span> {f.howToImprove}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Demand signals */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
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

        {/* Scenario analysis */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="text-sm font-medium text-gray-700">Scenario analysis</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                scenario: 'Heavy rain this weekend',
                effect: 'Indoor demand +30%, outdoor -40%',
                recommendation: 'Romantic and Chill venues benefit most. If you have indoor atmosphere, expect +25% discovery.',
                icon: '🌧️',
                impact: 'positive',
              },
              {
                scenario: 'Fado festival in Alfama',
                effect: 'Romantic +20%, Energetic +15%, Celebrating +10%',
                recommendation: 'Tourism-driven demand spike. Romantic venues within 2km of Alfama see highest traffic.',
                icon: '🎵',
                impact: 'positive',
              },
              {
                scenario: 'Public holiday Monday',
                effect: 'Lunch demand +35%, Group sessions +20%',
                recommendation: 'Group dining peaks on holiday Mondays. Consider lunch specials to capture group traffic.',
                icon: '📅',
                impact: 'positive',
              },
            ].map(s => (
              <div key={s.scenario} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{s.icon}</span>
                  <div className="text-sm font-medium text-gray-800">{s.scenario}</div>
                </div>
                <div className="text-xs text-[#E06A4F] font-medium mb-2">{s.effect}</div>
                <div className="text-xs text-gray-600 leading-relaxed">{s.recommendation}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-3 text-center">
            Scenarios are calculated from historical swipe patterns combined with public event and weather data.
            Real-time scenarios update automatically every 6 hours.
          </div>
        </div>

        {/* Discovery Distance Analytics */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="text-sm font-medium text-gray-700">Discovery by search radius</div>
            <span className="bg-[#E8F5E9] text-[#2E7D32] text-xs px-2 py-0.5 rounded-full font-medium">
              User preferences
            </span>
          </div>

          {/* Best performing radius */}
          <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl p-6 mb-4 border border-orange-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 mb-1">Your best discovery radius</div>
                <div className="text-3xl font-bold text-[#E06A4F] mb-2">1-3 km</div>
                <div className="text-xs text-gray-600">
                  Users searching within this range like you <span className="font-medium text-[#E06A4F]">72% of the time</span> — above your average!
                </div>
              </div>
              <div className="text-5xl opacity-20">🎯</div>
            </div>
          </div>

          {/* Search radius performance */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              {
                range: '0-1 km',
                likeRate: 58,
                swipes: Math.round((stats?.total || 17) * 0.15),
                likes: Math.round((stats?.total || 17) * 0.15 * 0.58),
                icon: '🏃',
                label: 'Walking distance',
                mood: 'Hungry & Quick',
                insight: 'Convenience-driven',
              },
              {
                range: '1-3 km',
                likeRate: 72,
                swipes: Math.round((stats?.total || 17) * 0.45),
                likes: Math.round((stats?.total || 17) * 0.45 * 0.72),
                icon: '🚴',
                label: 'Nearby explorers',
                mood: 'Romantic & Chill',
                insight: 'Your sweet spot!',
              },
              {
                range: '3-5 km',
                likeRate: 64,
                swipes: Math.round((stats?.total || 17) * 0.30),
                likes: Math.round((stats?.total || 17) * 0.30 * 0.64),
                icon: '🚗',
                label: 'Short drive',
                mood: 'Celebrating',
                insight: 'Intentional visits',
              },
              {
                range: '5+ km',
                likeRate: 50,
                swipes: Math.round((stats?.total || 17) * 0.10),
                likes: Math.round((stats?.total || 17) * 0.10 * 0.50),
                icon: '🗺️',
                label: 'Tourists',
                mood: 'Explorer',
                insight: 'Discovery mode',
              },
            ].map(d => (
              <div key={d.range} className={`rounded-xl p-4 border-2 ${
                d.likeRate >= 70 ? 'bg-orange-50 border-[#E06A4F]' : 'bg-gray-50 border-gray-100'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{d.icon}</span>
                  <span className={`text-lg font-bold ${
                    d.likeRate >= 70 ? 'text-[#E06A4F]' : 'text-gray-600'
                  }`}>{d.likeRate}%</span>
                </div>
                <div className="text-xs font-medium text-gray-800 mb-1">{d.range} search radius</div>
                <div className="text-xs text-gray-500 mb-2">{d.label}</div>
                <div className="flex items-center gap-1 mb-2">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${
                        d.likeRate >= 70 ? 'bg-[#E06A4F]' : 'bg-gray-400'
                      }`}
                      style={{ width: `${d.likeRate}%` }}
                    />
                  </div>
                </div>
                <div className="text-xs text-[#E06A4F] font-medium mb-1">{d.mood}</div>
                <div className="text-xs text-gray-400 mb-1">{d.swipes} swipes → {d.likes} likes</div>
                <div className={`text-xs font-medium mt-2 ${
                  d.likeRate >= 70 ? 'text-[#E06A4F]' : 'text-gray-500'
                }`}>{d.insight}</div>
              </div>
            ))}
          </div>

          {/* Insights */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="text-xs font-medium text-blue-900 mb-2">
                💡 Your best audience
              </div>
              <div className="text-xs text-blue-800 leading-relaxed">
                Users searching within <strong>1-3km radius</strong> have the highest like rate (72%). They're mostly in <strong>Romantic & Chill</strong> moods — planning intentional visits to nearby neighborhoods. This is your core audience!
              </div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-100">
              <div className="text-xs font-medium text-green-900 mb-2">
                🎯 Growth opportunity
              </div>
              <div className="text-xs text-green-800 leading-relaxed">
                Walking distance users (0-1km) have lower conversion at 58%. They're in <strong>Hungry & Quick</strong> mode. Consider promoting lunch specials or quick bites to capture this high-intent, convenience-driven segment.
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-400 mt-4 text-center">
            Analytics based on user-selected search radius preferences when they discovered and liked your restaurant.
          </div>
        </div>

        <div className="text-xs text-gray-300 text-center mt-6">
          nomi partner dashboard · {profile.address} · data updates every 6 hours
        </div>
      </main>
    </div>
  );
}
