import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

// KST 기준 연도 추출
function getKSTYear(dateStr: string): number {
  return new Date(new Date(dateStr).getTime() + 9 * 60 * 60 * 1000).getUTCFullYear();
}

// KST 기준 해당 주 월요일 키 (YYYY-MM-DD)
function getKSTMondayKey(dateStr: string): string {
  const kstMs = new Date(dateStr).getTime() + 9 * 60 * 60 * 1000;
  const kstDate = new Date(kstMs);
  const dow = kstDate.getUTCDay();
  const daysToMonday = (dow + 6) % 7;
  const monday = new Date(kstMs - daysToMonday * 24 * 60 * 60 * 1000);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default async function handler() {
  // ── 폰트 로딩 (Google Fonts 서브셋) ──────────────────────────
  let fontData: ArrayBuffer | null = null;
  try {
    const chars = 'FC실화년메이드파토주비율전체';
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(chars)}&display=block`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    ).then((r) => r.text());

    const fontUrl = css.match(/url\((.+?)\)/)?.[1];
    if (fontUrl) {
      fontData = await fetch(fontUrl).then((r) => r.arrayBuffer());
    }
  } catch {
    // 폰트 로딩 실패 시 sans-serif 폴백
  }

  // ── Supabase에서 경기 데이터 조회 ────────────────────────────
  let madeWeeks = 0;
  let failedWeeks = 0;

  try {
    const url = process.env.VITE_SUPABASE_URL ?? '';
    const key = process.env.VITE_SUPABASE_ANON_KEY ?? '';
    const matches: { match_date: string; status: string }[] = await fetch(
      `${url}/rest/v1/matches?select=match_date,status`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    ).then((r) => r.json());

    const confirmed = matches.filter(
      (m) =>
        (m.status === 'completed' || m.status === 'cancelled') &&
        getKSTYear(m.match_date) === 2026
    );
    const weekMap = new Map<string, { hasMade: boolean }>();
    for (const m of confirmed) {
      const k = getKSTMondayKey(m.match_date);
      const w = weekMap.get(k) ?? { hasMade: false };
      if (m.status === 'completed') w.hasMade = true;
      weekMap.set(k, w);
    }
    for (const w of weekMap.values()) {
      if (w.hasMade) madeWeeks++;
      else failedWeeks++;
    }
  } catch {
    // Supabase 조회 실패 시 0/0 으로 폴백
  }

  const totalWeeks = madeWeeks + failedWeeks;
  const rate = totalWeeks === 0 ? 0 : madeWeeks / totalWeeks;
  const pct = Math.round(rate * 100);

  // ── SVG 도넛 파라미터 ──────────────────────────────────────
  const R = 70;
  const SW = 16;
  const circ = 2 * Math.PI * R;
  const filled = circ * rate;
  const gap = circ - filled;
  // CSS transform 대신 strokeDashoffset으로 12시 방향 시작 (circ/4 = 90° 역방향 오프셋)
  const offset = circ / 4;

  const fontFamily = fontData ? 'NotoSansKR' : 'sans-serif';
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
          backgroundImage: 'linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'white',
            borderRadius: '20px',
            padding: '32px 52px',
            gap: '0px',
          }}
        >
          {/* 타이틀 */}
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: '#111827' }}>
            ⚽ FC실화
          </div>
          <div style={{ display: 'flex', fontSize: 15, color: '#6b7280', marginTop: 4, marginBottom: 20 }}>
            2026년 메이드 주 비율
          </div>

          {/* 도넛 차트 */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              width: 170,
              height: 170,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="170"
              height="170"
              viewBox="0 0 170 170"
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
              <circle cx="85" cy="85" r={R} fill="none" stroke="#e5e7eb" strokeWidth={SW} />
              <circle
                cx="85"
                cy="85"
                r={R}
                fill="none"
                stroke="#22c55e"
                strokeWidth={SW}
                strokeLinecap="round"
                strokeDasharray={`${filled} ${gap}`}
                strokeDashoffset={offset}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 42, fontWeight: 800, color: '#111827', lineHeight: '1' }}>
                {pct}%
              </span>
            </div>
          </div>

          {/* 보조 텍스트 */}
          <div style={{ display: 'flex', fontSize: 17, fontWeight: 600, color: '#374151', marginTop: 16 }}>
            메이드 {madeWeeks}주 / 전체 {totalWeeks}주
          </div>

          {/* 뱃지 */}
          <div style={{ display: 'flex', gap: '12px', marginTop: 14 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: '#f0fdf4',
                borderRadius: '12px',
                padding: '10px 22px',
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{madeWeeks}</span>
              <span style={{ fontSize: 13, color: '#16a34a', marginTop: 2 }}>✅ 메이드</span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: '#fff1f2',
                borderRadius: '12px',
                padding: '10px 22px',
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{failedWeeks}</span>
              <span style={{ fontSize: 13, color: '#dc2626', marginTop: 2 }}>❌ 파토</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 600,
      height: 400,
      fonts,
    }
  );
}
