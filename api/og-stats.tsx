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
    // ── 한국어 서브셋 폰트 로딩 ──────────────────────────────
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

    // ── Supabase 데이터 조회 ──────────────────────────────────
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

    const ff = fontData ? 'NotoSansKR' : 'sans-serif';
    const fonts = fontData
      ? [{ name: 'NotoSansKR', data: fontData, weight: 700 as const, style: 'normal' as const }]
      : [];

    // conic-gradient로 도넛 차트 (SVG 미사용)
    // pct% 만큼 초록→파랑, 나머지는 반투명 흰색
    const donutBg = `conic-gradient(#22c55e 0% ${pct}%, rgba(255,255,255,0.12) ${pct}% 100%)`;

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
          {/* 메인 레이아웃: 도넛 + 우측 정보 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>

            {/* 도넛 차트 (CSS conic-gradient) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 180,
              height: 180,
              borderRadius: '90px',
              background: donutBg,
            }}>
              {/* 도넛 구멍 + 중앙 텍스트 */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 124,
                height: 124,
                borderRadius: '62px',
                background: '#162535',
              }}>
                <span style={{ fontSize: 44, fontWeight: 700, color: 'white', lineHeight: '1' }}>
                  {pct}%
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                  메이드율
                </span>
              </div>
            </div>

            {/* 우측: 타이틀 + 배지 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* 타이틀 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 22, color: 'white' }}>⚽</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>FC실화</span>
              </div>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
                2026년 메이드 주 비율
              </span>

              {/* 배지 3개 */}
              <div style={{ display: 'flex', gap: 10 }}>
                {/* 메이드 */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: 'rgba(34,197,94,0.15)',
                  border: '1px solid rgba(34,197,94,0.4)',
                  borderRadius: '12px',
                  padding: '10px 18px',
                }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: '#4ade80' }}>{madeWeeks}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>메이드</span>
                </div>
                {/* 파토 */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  borderRadius: '12px',
                  padding: '10px 18px',
                }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: '#f87171' }}>{failedWeeks}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>파토</span>
                </div>
                {/* 전체 */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '12px',
                  padding: '10px 18px',
                }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{totalWeeks}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>전체</span>
                </div>
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
