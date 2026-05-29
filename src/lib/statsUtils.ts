import { Match } from '../types';

export interface MadeWeekRateResult {
  madeWeeks: number;
  failedWeeks: number;
  totalWeeks: number;
  rate: number;
}

// KST(UTC+9) 기준으로 해당 날짜가 속한 주의 월요일을 YYYY-MM-DD 키로 반환
function getKSTMondayKey(dateStr: string): string {
  const utcMs = new Date(dateStr).getTime();
  // UTC 타임스탬프를 KST 오프셋만큼 밀어서 UTC API로 KST 날짜를 읽음
  const kstMs = utcMs + 9 * 60 * 60 * 1000;
  const kstDate = new Date(kstMs);
  const dow = kstDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToMonday = (dow + 6) % 7; // Mon→0, Tue→1, …, Sun→6
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

export function computeMadeWeekRate(
  matches: Pick<Match, 'match_date' | 'status'>[]
): MadeWeekRateResult {
  // 2026년 확정(메이드 or 파토) 경기만 필터
  const confirmed = matches.filter(
    m =>
      (m.status === 'completed' || m.status === 'cancelled') &&
      getKSTYear(m.match_date) === 2026
  );

  // 주 단위로 그룹핑 (키: KST 기준 월요일 날짜)
  const weekMap = new Map<string, { hasMade: boolean }>();
  for (const m of confirmed) {
    const key = getKSTMondayKey(m.match_date);
    const week = weekMap.get(key) ?? { hasMade: false };
    if (m.status === 'completed') week.hasMade = true;
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
