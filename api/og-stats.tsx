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
  const rate = totalWeeks === 0 ? 0 : madeWeeks / totalWeeks;
  const pct = Math.round(rate * 100);
  const R = 63;
  const circ = 2 * Math.PI * R;
  const filled = circ * rate;
  const gap = circ - filled;
  const offset = circ / 4; // 12시 방향 시작

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: '#1a0e00',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 타이틀 */}
        <span style={{ fontSize: 16, fontWeight: 700, color: '#92400e', marginBottom: 20 }}>
          ⚽ FC실화 — 2026년 메이드 주 비율
        </span>

        {/* SVG 도넛 게이지 */}
        <svg width="160" height="160" viewBox="0 0 160 160">
          {/* 배경 트랙 */}
          <circle
            cx="80" cy="80" r={R}
            fill="none"
            stroke="#3d1c00"
            strokeWidth="14"
          />
          {/* 진행 호 */}
          <circle
            cx="80" cy="80" r={R}
            fill="none"
            stroke="#f97316"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${gap}`}
            strokeDashoffset={String(offset)}
          />
          {/* 중앙 텍스트 */}
          <text
            x="80" y="76"
            textAnchor="middle"
            fontSize="40"
            fontWeight="bold"
            fill="white"
          >{pct}%</text>
          <text
            x="80" y="100"
            textAnchor="middle"
            fontSize="13"
            fill="#a16207"
          >made rate</text>
        </svg>

        {/* 배지 3개 */}
        <div style={{ display: 'flex', marginTop: 28 }}>
          {/* 메이드 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginRight: 12,
              paddingTop: 10,
              paddingBottom: 10,
              paddingLeft: 24,
              paddingRight: 24,
              borderRadius: 12,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#f97316',
            }}
          >
            <span style={{ fontSize: 30, fontWeight: 700, color: '#fb923c' }}>
              {madeWeeks}
            </span>
            <span style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
              메이드
            </span>
          </div>

          {/* 파토 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginRight: 12,
              paddingTop: 10,
              paddingBottom: 10,
              paddingLeft: 24,
              paddingRight: 24,
              borderRadius: 12,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#7c2d12',
            }}
          >
            <span style={{ fontSize: 30, fontWeight: 700, color: '#ea580c' }}>
              {failedWeeks}
            </span>
            <span style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
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
              paddingLeft: 24,
              paddingRight: 24,
              borderRadius: 12,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#3d1c00',
            }}
          >
            <span style={{ fontSize: 30, fontWeight: 700, color: '#fed7aa' }}>
              {totalWeeks}
            </span>
            <span style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
              전체
            </span>
          </div>
        </div>
      </div>
    ),
    { width: 600, height: 400 }
  );
}
