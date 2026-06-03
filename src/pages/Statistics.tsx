import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/supabase';
import { isKakaoAvailable, shareStatsToKakao } from '../lib/kakao';
import { Match } from '../types';
import { computeMadeWeekRate, MadeWeekRateResult } from '../lib/statsUtils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

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
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle
          cx={cx} cy={cy} r={radius}
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
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold text-gray-800">{pct}%</span>
        <span className="text-sm text-gray-500 mt-1">메이드율</span>
      </div>
    </div>
  );
}

// 경기 결과 판정 (null = 미래/제외)
function getMatchResult(match: Match, now: Date): 'made' | 'pato' | null {
  if (match.status === 'cancelled') return 'pato';
  if (match.status === 'completed') return 'made';
  if (match.status === 'upcoming' && new Date(match.match_date) <= now) return 'made';
  return null;
}

export default function Statistics() {
  const navigate = useNavigate();
  const [result, setResult] = useState<MadeWeekRateResult | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    try {
      const { data, error } = await db.getMatches();
      if (error) throw error;
      const all = (data ?? []) as Match[];
      setMatches(all);
      setResult(computeMadeWeekRate(all));
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const now = new Date();

  // 2026년 6~12월 + 과거 경기만, 날짜 내림차순
  const pastMatches2026 = matches
    .filter(m => {
      const kst = new Date(new Date(m.match_date).getTime() + 9 * 60 * 60 * 1000);
      const year = kst.getUTCFullYear();
      const month = kst.getUTCMonth() + 1;
      return year === 2026 && month >= 6 && getMatchResult(m, now) !== null;
    })
    .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());

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

      <main className="max-w-lg mx-auto px-4 pt-10 pb-16 space-y-6">
        <h2 className="text-xl font-bold text-gray-800 text-center">
          2026년 하반기(6~12월) 메이드 주 비율
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

        {!loading && !error && result && (
          <>
            {/* ── 도넛 게이지 카드 ── */}
            {result.totalWeeks === 0 ? (
              <div className="bg-white rounded-2xl shadow p-10 text-center">
                <p className="text-5xl mb-4">⚽</p>
                <p className="text-gray-500">2026년 하반기 확정된 경기 데이터가 없습니다.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow p-8 flex flex-col items-center gap-6">
                <DonutGauge rate={result.rate} />
                <p className="text-lg font-semibold text-gray-700">
                  메이드&nbsp;<span className="text-green-600">{result.madeWeeks}주</span>
                  &nbsp;/&nbsp;전체&nbsp;<span className="text-gray-800">{result.totalWeeks}주</span>
                </p>
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

            {/* ── 경기별 상세 목록 ── */}
            {pastMatches2026.length > 0 && (
              <div className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800">경기별 결과</h3>
                  <p className="text-xs text-gray-400 mt-0.5">총 {pastMatches2026.length}경기</p>
                </div>
                <ul className="divide-y divide-gray-50">
                  {pastMatches2026.map(m => {
                    const result = getMatchResult(m, now);
                    const date = new Date(m.match_date);
                    return (
                      <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                        {/* 결과 뱃지 */}
                        <span className={`flex-shrink-0 w-14 text-center text-xs font-bold px-2 py-1 rounded-full ${
                          result === 'made'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {result === 'made' ? '✅ 메이드' : '❌ 파토'}
                        </span>
                        {/* 날짜 */}
                        <span className="flex-shrink-0 text-sm text-gray-500 w-24">
                          {format(date, 'M월 d일 (E)', { locale: ko })}
                        </span>
                        {/* 제목 */}
                        <span className="text-sm text-gray-700 truncate">{m.title}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
