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
    // ── Supabase 데이터 조회 ────────────────────────────────
    let madeWeeks = 0;
    let failedWeeks = 0;

    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
      const res = await fetch(
        `${supabaseUrl}/rest/v1/matches?select=match_date,status`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      const matches: { match_date: string; status: string }[] = await res.json();

      const weekMap = new Map<string, boolean>();
      for (const m of matches) {
        if (
          (m.status === 'completed' || m.status === 'cancelled') &&
          getKSTYear(m.match_date) === 2026
        ) {
          const k = getKSTMondayKey(m.match_date);
          weekMap.set(k, weekMap.get(k) === true || m.status === 'completed');
        }
      }
      for (const made of weekMap.values()) {
        if (made) madeWeeks++;
        else failedWeeks++;
      }
    } catch {
      // Supabase 실패 → 0/0으로 폴백
    }

    const totalWeeks = madeWeeks + failedWeeks;
    const pct = totalWeeks === 0 ? 0 : Math.round((madeWeeks / totalWeeks) * 100);

    // ── 이미지 렌더링 (SVG 없이 순수 CSS) ─────────────────
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'white',
              borderRadius: '24px',
              padding: '36px 56px',
              gap: '0px',
            }}
          >
            {/* 타이틀 */}
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: '#111827' }}>
              FC실화 2026
            </div>
            <div style={{ display: 'flex', fontSize: 15, color: '#6b7280', marginTop: 4, marginBottom: 24 }}>
              Made Week Rate
            </div>

            {/* 원형 퍼센트 표시 (CSS border only, no SVG) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 160,
                height: 160,
                borderRadius: '80px',
                border: '14px solid #22c55e',
                background: '#f0fdf4',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 50, fontWeight: 900, color: '#16a34a', lineHeight: '1' }}>
                  {pct}%
                </span>
              </div>
            </div>

            {/* 주 요약 */}
            <div style={{ display: 'flex', fontSize: 17, fontWeight: 600, color: '#374151', marginTop: 20 }}>
              {madeWeeks}wks made / {totalWeeks}wks total
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
                  padding: '10px 24px',
                }}
              >
                <span style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{madeWeeks}</span>
                <span style={{ fontSize: 13, color: '#16a34a' }}>Made</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: '#fff1f2',
                  borderRadius: '12px',
                  padding: '10px 24px',
                }}
              >
                <span style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{failedWeeks}</span>
                <span style={{ fontSize: 13, color: '#dc2626' }}>Fail</span>
              </div>
            </div>
          </div>
        </div>
      ),
      { width: 600, height: 400 }
    );
  } catch (err) {
    // 최후 폴백: 에러 내용을 이미지로 반환
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            background: '#ef4444',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 24,
            padding: 40,
          }}
        >
          {String(err)}
        </div>
      ),
      { width: 600, height: 400 }
    );
  }
}
