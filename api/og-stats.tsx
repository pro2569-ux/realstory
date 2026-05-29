import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

function getKSTYear(dateStr: string): number {
  return new Date(new Date(dateStr).getTime() + 9 * 60 * 60 * 1000).getUTCFullYear();
}

function getKSTMondayKey(dateStr: string): string {
  const kstMs = new Date(dateStr).getTime() + 9 * 60 * 60 * 1000;
  const dow = new Date(kstMs).getUTCDay();
  const mondayMs = kstMs - ((dow + 6) % 7) * 86400000;
  const d = new Date(mondayMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export default async function handler() {
  try {
    // ── 한국어 서브셋 폰트 로딩 ────────────────────────────
    let fontData: ArrayBuffer | null = null;
    try {
      const chars = 'FC실화년메이드파토주전체율';
      const css = await fetch(
        `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(chars)}&display=block`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }
      ).then(r => r.text());
      const fontUrl = css.match(/url\((.+?)\)/)?.[1];
      if (fontUrl) fontData = await fetch(fontUrl).then(r => r.arrayBuffer());
    } catch { /* 폰트 없으면 sans-serif 폴백 */ }

    // ── Supabase 데이터 조회 ────────────────────────────────
    let madeWeeks = 0;
    let failedWeeks = 0;
    try {
      const url = process.env.VITE_SUPABASE_URL ?? '';
      const key = process.env.VITE_SUPABASE_ANON_KEY ?? '';
      const now = new Date();
      const matches: { match_date: string; status: string }[] = await fetch(
        `${url}/rest/v1/matches?select=match_date,status`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      ).then(r => r.json());

      const weekMap = new Map<string, boolean>();
      for (const m of matches) {
        if (getKSTYear(m.match_date) !== 2026) continue;
        const isMade = m.status === 'completed' || (m.status === 'upcoming' && new Date(m.match_date) <= now);
        const isPato = m.status === 'cancelled';
        if (!isMade && !isPato) continue;
        const k = getKSTMondayKey(m.match_date);
        weekMap.set(k, weekMap.get(k) === true || isMade);
      }
      for (const made of weekMap.values()) {
        if (made) madeWeeks++;
        else failedWeeks++;
      }
    } catch { /* Supabase 실패 → 0/0 폴백 */ }

    const totalWeeks = madeWeeks + failedWeeks;
    const rate = totalWeeks === 0 ? 0 : madeWeeks / totalWeeks;
    const pct = Math.round(rate * 100);

    // ── SVG 도넛 파라미터 ───────────────────────────────────
    const R = 72;
    const SW = 14;
    const circ = 2 * Math.PI * R;
    const filled = circ * rate;
    const gap = circ - filled;
    // strokeDashoffset = circ/4 → 12시 방향 시작 (CSS transform 없이)
    const dashOffset = circ / 4;

    const ff = fontData ? 'NotoSansKR' : 'sans-serif';
    const fonts = fontData
      ? [{ name: 'NotoSansKR', data: fontData, weight: 700 as const, style: 'normal' as const }]
      : [];

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #0f2027 0%, #1a3a4a 50%, #0d3320 100%)',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: ff,
          }}
        >
          {/* 글로우 원 장식 */}
          <div style={{
            position: 'absolute', top: -60, right: -60,
            width: 300, height: 300,
            borderRadius: '150px',
            background: 'rgba(34,197,94,0.08)',
            display: 'flex',
          }} />
          <div style={{
            position: 'absolute', bottom: -80, left: -40,
            width: 260, height: 260,
            borderRadius: '130px',
            background: 'rgba(59,130,246,0.08)',
            display: 'flex',
          }} />

          {/* 메인 카드 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            zIndex: 1,
          }}>
            {/* 타이틀 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', letterSpacing: 2 }}>⚽</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 2 }}>FC실화</span>
            </div>
            <div style={{ display: 'flex', fontSize: 15, color: 'rgba(255,255,255,0.35)', marginBottom: 28 }}>
              2026년 메이드율
            </div>

            {/* 도넛 차트 + 중앙 텍스트 */}
            <div style={{
              position: 'relative',
              display: 'flex',
              width: 190,
              height: 190,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {/* SVG 도넛 */}
              <svg
                width="190"
                height="190"
                viewBox="0 0 190 190"
                style={{ position: 'absolute', top: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                {/* 배경 트랙 */}
                <circle
                  cx="95" cy="95" r={R}
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={SW}
                />
                {/* 진행 호 */}
                <circle
                  cx="95" cy="95" r={R}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={SW}
                  strokeLinecap="round"
                  strokeDasharray={`${filled} ${gap}`}
                  strokeDashoffset={String(dashOffset)}
                />
              </svg>
              {/* 중앙 텍스트 */}
              <div style={{
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: 52, fontWeight: 900, color: 'white', lineHeight: '1' }}>
                  {pct}%
                </span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                  메이드율
                </span>
              </div>
            </div>

            {/* 통계 뱃지 3개 */}
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              {/* 메이드 */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                background: 'rgba(34,197,94,0.15)',
                border: '1px solid rgba(34,197,94,0.35)',
                borderRadius: '14px',
                padding: '10px 20px',
              }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: '#4ade80' }}>{madeWeeks}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>메이드</span>
              </div>
              {/* 파토 */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: '14px',
                padding: '10px 20px',
              }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: '#f87171' }}>{failedWeeks}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>파토</span>
              </div>
              {/* 전체 */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '14px',
                padding: '10px 20px',
              }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{totalWeeks}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>전체</span>
              </div>
            </div>
          </div>
        </div>
      ),
      { width: 600, height: 400, fonts }
    );
  } catch (err) {
    return new ImageResponse(
      (
        <div style={{ display: 'flex', width: '100%', height: '100%', background: '#ef4444', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20, padding: 40 }}>
          {String(err)}
        </div>
      ),
      { width: 600, height: 400 }
    );
  }
}
