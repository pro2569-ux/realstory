import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/supabase';
import { isKakaoAvailable, shareStatsToKakao } from '../lib/kakao';
import { Match } from '../types';
import { computeMadeWeekRate, MadeWeekRateResult } from '../lib/statsUtils';

function DonutGauge({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const radius = 80;
  const stroke = 18;
  const cx = 100;
  const cy = 100;
  const circumference = 2 * Math.PI * radius;
  const filledLength = circumference * rate;
  const gapLength = circumference - filledLength;

  return (
    <div className="relative flex items-center justify-center w-52 h-52 mx-auto">
      <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
        {/* 배경 트랙 */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
        />
        {/* 메이드 비율 */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="url(#madeGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filledLength} ${gapLength}`}
        />
        <defs>
          <linearGradient id="madeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>
      {/* 중앙 텍스트 */}
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold text-gray-800">{pct}%</span>
        <span className="text-sm text-gray-500 mt-1">메이드율</span>
      </div>
    </div>
  );
}

export default function Statistics() {
  const navigate = useNavigate();
  const [result, setResult] = useState<MadeWeekRateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const { data, error } = await db.getMatches();
      if (error) throw error;
      const stats = computeMadeWeekRate((data ?? []) as Pick<Match, 'match_date' | 'status'>[]);
      setResult(stats);
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-500 to-blue-500 shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-white/90 hover:text-white transition text-sm sm:text-base"
          >
            ← 홈으로
          </button>
          <h1 className="text-xl font-bold text-white">📊 통계</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-10 pb-16">
        <h2 className="text-xl font-bold text-gray-800 text-center mb-8">
          2026년 메이드 주 비율
        </h2>

        {loading && (
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadStats}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && result && result.totalWeeks === 0 && (
          <div className="bg-white rounded-2xl shadow p-10 text-center">
            <p className="text-5xl mb-4">⚽</p>
            <p className="text-gray-500">2026년 확정된 경기 데이터가 없습니다.</p>
          </div>
        )}

        {!loading && !error && result && result.totalWeeks > 0 && (
          <div className="bg-white rounded-2xl shadow p-8 flex flex-col items-center gap-6">
            <DonutGauge rate={result.rate} />

            {/* 보조 텍스트 */}
            <p className="text-lg font-semibold text-gray-700">
              메이드&nbsp;
              <span className="text-green-600">{result.madeWeeks}주</span>
              &nbsp;/&nbsp;전체&nbsp;
              <span className="text-gray-800">{result.totalWeeks}주</span>
            </p>

            {/* 주 분류 상세 */}
            <div className="w-full grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{result.madeWeeks}</p>
                <p className="text-sm text-green-700 mt-1">✅ 메이드 주</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-500">{result.failedWeeks}</p>
                <p className="text-sm text-red-600 mt-1">❌ 파토 주</p>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center leading-relaxed">
              확정(메이드·파토)된 경기가 있는 주만 집계합니다.<br />
              한 주에 메이드가 한 번이라도 있으면 메이드 주로 분류합니다.
            </p>

            {isKakaoAvailable() && (
              <button
                onClick={shareStatsToKakao}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#FEE500] text-[#3C1E1E] rounded-xl hover:bg-[#FDD835] active:scale-95 transition-all font-semibold shadow-sm"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.48 3 2 6.69 2 11.25c0 2.88 1.7 5.42 4.29 6.96-.19.68-.69 2.47-.79 2.85-.13.48.18.47.38.34.16-.1 2.09-1.41 2.93-1.98.71.1 1.44.16 2.19.16 5.52 0 10-3.69 10-8.25C22 6.69 17.52 3 12 3z"/>
                </svg>
                카카오톡으로 공유하기
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
