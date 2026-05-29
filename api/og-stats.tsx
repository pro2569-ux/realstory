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

export default async function handler(_req: Request) {
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
  } catch { /* 폴백 0/0 */ }

  const totalWeeks = madeWeeks + failedWeeks;
  const pct = totalWeeks === 0 ? 0 : Math.round((madeWeeks / totalWeeks) * 100);

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          backgroundColor: '#0f2027',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 원형 게이지 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 160,
            height: 160,
            borderRadius: 80,
            borderWidth: 14,
            borderStyle: 'solid',
            borderColor: '#22c55e',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 48, fontWeight: 700, color: 'white' }}>
              {pct}%
            </span>
            <span style={{ fontSize: 13, color: '#888888' }}>
              메이드율
            </span>
          </div>
        </div>

        {/* 오른쪽 정보 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginLeft: 48,
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 6 }}>
            FC실화
          </span>
          <span style={{ fontSize: 14, color: '#666666', marginBottom: 24 }}>
            2026년 메이드 주 비율
          </span>

          <div style={{ display: 'flex' }}>
            {/* 메이드 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginRight: 10,
                paddingTop: 10,
                paddingBottom: 10,
                paddingLeft: 20,
                paddingRight: 20,
                borderRadius: 12,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: '#22c55e',
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 700, color: '#4ade80' }}>
                {madeWeeks}
              </span>
              <span style={{ fontSize: 11, color: '#888888', marginTop: 2 }}>
                메이드
              </span>
            </div>

            {/* 파토 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginRight: 10,
                paddingTop: 10,
                paddingBottom: 10,
                paddingLeft: 20,
                paddingRight: 20,
                borderRadius: 12,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: '#ef4444',
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 700, color: '#f87171' }}>
                {failedWeeks}
              </span>
              <span style={{ fontSize: 11, color: '#888888', marginTop: 2 }}>
                파토
              </span>
            </div>

            {/* 전체 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 10,
                paddingBottom: 10,
                paddingLeft: 20,
                paddingRight: 20,
                borderRadius: 12,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: '#555555',
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>
                {totalWeeks}
              </span>
              <span style={{ fontSize: 11, color: '#888888', marginTop: 2 }}>
                전체
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 600, height: 400 }
  );
}
