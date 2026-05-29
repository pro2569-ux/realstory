import { describe, it, expect } from 'vitest';
import { computeMadeWeekRate } from './statsUtils';

// 날짜 확인 (KST +09:00)
// 2026-01-05 월요일, 2026-01-07 수요일, 2026-01-09 금요일 → 주 키 2026-01-05
// 2026-01-12 월요일, 2026-01-14 수요일, 2026-01-18 일요일  → 주 키 2026-01-12

const PAST = new Date('2026-12-31T23:59:59+09:00'); // 모든 2026년 경기가 과거인 기준점
const JAN10 = new Date('2026-01-10T00:00:00+09:00'); // 1/5 이후, 1/12 이전

describe('computeMadeWeekRate', () => {
  it('1주차 파토, 2주차 메이드 → madeWeeks=1, totalWeeks=2, rate=0.5', () => {
    const matches = [
      { match_date: '2026-01-05T10:00:00+09:00', status: 'cancelled' as const },
      { match_date: '2026-01-07T10:00:00+09:00', status: 'cancelled' as const },
      { match_date: '2026-01-09T10:00:00+09:00', status: 'cancelled' as const },
      { match_date: '2026-01-12T10:00:00+09:00', status: 'cancelled' as const },
      { match_date: '2026-01-14T10:00:00+09:00', status: 'cancelled' as const },
      { match_date: '2026-01-18T10:00:00+09:00', status: 'completed' as const },
    ];
    const result = computeMadeWeekRate(matches, PAST);
    expect(result.madeWeeks).toBe(1);
    expect(result.failedWeeks).toBe(1);
    expect(result.totalWeeks).toBe(2);
    expect(result.rate).toBe(0.5);
  });

  it('경기 없는 주는 분모에서 제외', () => {
    const matches = [
      { match_date: '2026-02-02T10:00:00+09:00', status: 'completed' as const },
      { match_date: '2026-02-16T10:00:00+09:00', status: 'cancelled' as const },
    ];
    const result = computeMadeWeekRate(matches, PAST);
    expect(result.totalWeeks).toBe(2);
    expect(result.madeWeeks).toBe(1);
    expect(result.failedWeeks).toBe(1);
  });

  it('미래 upcoming 경기는 집계 제외', () => {
    // JAN10 기준: 1/5는 과거(메이드), 1/12는 미래(제외)
    const matches = [
      { match_date: '2026-01-05T10:00:00+09:00', status: 'upcoming' as const }, // 과거 → 메이드
      { match_date: '2026-01-12T10:00:00+09:00', status: 'upcoming' as const }, // 미래 → 제외
    ];
    const result = computeMadeWeekRate(matches, JAN10);
    expect(result.totalWeeks).toBe(1);
    expect(result.madeWeeks).toBe(1);
    expect(result.failedWeeks).toBe(0);
  });

  it('날짜 지난 upcoming 경기는 메이드 주로 집계', () => {
    const matches = [
      { match_date: '2026-01-05T10:00:00+09:00', status: 'upcoming' as const }, // 과거 → 메이드
      { match_date: '2026-01-12T10:00:00+09:00', status: 'cancelled' as const }, // 파토
    ];
    const result = computeMadeWeekRate(matches, PAST);
    expect(result.madeWeeks).toBe(1);
    expect(result.failedWeeks).toBe(1);
    expect(result.totalWeeks).toBe(2);
    expect(result.rate).toBe(0.5);
  });

  it('한 주에 메이드+파토 혼재 시 메이드 주로 집계', () => {
    const matches = [
      { match_date: '2026-01-05T10:00:00+09:00', status: 'cancelled' as const },
      { match_date: '2026-01-07T10:00:00+09:00', status: 'completed' as const },
    ];
    const result = computeMadeWeekRate(matches, PAST);
    expect(result.madeWeeks).toBe(1);
    expect(result.failedWeeks).toBe(0);
    expect(result.totalWeeks).toBe(1);
    expect(result.rate).toBe(1);
  });

  it('경기 데이터 없으면 rate=0, totalWeeks=0', () => {
    const result = computeMadeWeekRate([], PAST);
    expect(result.totalWeeks).toBe(0);
    expect(result.madeWeeks).toBe(0);
    expect(result.failedWeeks).toBe(0);
    expect(result.rate).toBe(0);
  });

  it('2026년 아닌 경기는 제외', () => {
    const matches = [
      { match_date: '2025-12-31T10:00:00+09:00', status: 'completed' as const },
      { match_date: '2027-01-01T10:00:00+09:00', status: 'cancelled' as const },
    ];
    const result = computeMadeWeekRate(matches, PAST);
    expect(result.totalWeeks).toBe(0);
    expect(result.rate).toBe(0);
  });

  it('KST 자정 경계: UTC 기준 다른 날이어도 KST 기준 같은 주에 묶임', () => {
    const matches = [
      { match_date: '2026-01-12T00:30:00+09:00', status: 'completed' as const }, // KST 월요일
      { match_date: '2026-01-18T23:59:00+09:00', status: 'cancelled' as const }, // KST 일요일
    ];
    const result = computeMadeWeekRate(matches, PAST);
    expect(result.totalWeeks).toBe(1);
    expect(result.madeWeeks).toBe(1);
  });
});
