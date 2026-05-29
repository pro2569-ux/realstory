import { Match } from '../types';

export interface MadeWeekRateResult {
  madeWeeks: number;
  failedWeeks: number;
  totalWeeks: number;
  rate: number;
}

// KST(UTC+9) 기준으로 해당 날짜가 속한 주의 월요일을 YYYY-MM-DD 키로 반환
function getKSTMondayKey(dateStr: string): string {
  const kstMs = new Date(dateStr).getTime() + 9 * 60 * 60 * 1000;
  const kstDate = new Date(kstMs);
  const dow = kstDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToMonday = (dow + 6) % 7;
  const mondayMs = kstMs - daysToMonday * 24 * 60 * 60 * 1000;
  const monday = new Date(mondayMs);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getKSTYear(dateStr: string): number {
  const kstMs = new Date(dateStr).getTime() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).getUTCFullYear();
}

// now를 파라미터로 받아 테스트 가능하게 유지
export function computeMadeWeekRate(
  matches: Pick<Match, 'match_date' | 'status'>[],
  now: Date = new Date()
): MadeWeekRateResult {
  // 2026년 경기 중 집계 대상 필터:
  //   cancelled          → 파토 (명시적 취소)
  //   completed          → 메이드 (명시적 완료)
  //   upcoming + 날짜 경과 → 메이드 (관리자가 완료 처리 안 한 진행 경기)
  //   upcoming + 미래     → 제외 (아직 안 열린 경기)
  const relevant = matches.filter(m => {
    if (getKSTYear(m.match_date) !== 2026) return false;
    if (m.status === 'cancelled' || m.status === 'completed') return true;
    if (m.status === 'upcoming') return new Date(m.match_date) <= now;
    return false;
  });

  // 주 단위 그룹핑
  const weekMap = new Map<string, { hasMade: boolean }>();
  for (const m of relevant) {
    const key = getKSTMondayKey(m.match_date);
    const week = weekMap.get(key) ?? { hasMade: false };
    // cancelled = 파토, 그 외(completed / past upcoming) = 메이드
    if (m.status !== 'cancelled') week.hasMade = true;
    weekMap.set(key, week);
  }

  let madeWeeks = 0;
  let failedWeeks = 0;
  for (const week of weekMap.values()) {
    if (week.hasMade) madeWeeks++;
    else failedWeeks++;
  }

  const totalWeeks = madeWeeks + failedWeeks;
  const rate = totalWeeks === 0 ? 0 : madeWeeks / totalWeeks;

  return { madeWeeks, failedWeeks, totalWeeks, rate };
}
