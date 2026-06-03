import { describe, it, expect } from 'vitest';
import { computeMadeWeekRate } from './statsUtils';

// 날짜 확인 (KST +09:00) — 집계 대상은 2026년 6~12월
// 2026-06-01 월요일, 2026-06-03 수요일, 2026-06-05 금요일 → 주 키 2026-06-01
// 2026-06-08 월요일, 2026-06-10 수요일, 2026-06-14 일요일  → 주 키 2026-06-08

const PAST = new Date('2026-12-31T23:59:59+09:00'); // 모든 2026년 하반기 경기가 과거인 기준점
const JUN04 = new Date('2026-06-04T00:00:00+09:00'); // 6/1 이후, 6/8 이전

describe('computeMadeWeekRate', () => {
  it('1주차 파토, 2주차 메이드 → madeWeeks=1, totalWeeks=2, rate=0.5', () => {
    const matches = [
      { match_date: '2026-06-01T10:00:00+09:00', status: 'cancelled' as const },
      { match_date: '2026-06-03T10:00:00+09:00', status: 'cancelled' as const },
      { match_date: '2026-06-05T10:00:00+09:00', status: 'cancelled' as const },
      { match_date: '2026-06-08T10:00:00+09:00', status: 'cancelled' as const },
      { match_date: '2026-06-10T10:00:00+09:00', status: 'cancelled' as const },
      { match_date: '2026-06-14T10:00:00+09:00', status: 'completed' as const },
    ];
    const result = computeMadeWeekRate(matches, PAST);
    expect(result.madeWeeks).toBe(1);
    expect(result.failedWeeks).toBe(1);
    expect(result.totalWeeks).toBe(2);
    expect(result.rate).toBe(0.5);
  });

  it('경기 없는 주는 분모에서 제외', () => {
    const matches = [
      { match_date: '2026-07-06T10:00:00+09:00', status: 'completed' as const },
      { match_date: '2026-07-20T10:00:00+09:00', status: 'cancelled' as const },
    ];
    const result = computeMadeWeekRate(matches, PAST);
    expect(result.totalWeeks).toBe(2);
    expect(result.madeWeeks).toBe(1);
    expect(result.failedWeeks).toBe(1);
  });

  it('미래 upcoming 경기는 집계 제외', () => {
    // JUN04 기준: 6/1은 과거(메이드), 6/8은 미래(제외)
    const matches = [
      { match_date: '2026-06-01T10:00:00+09:00', status: 'upcoming' as const }, // 과거 → 메이드
      { match_date: '2026-06-08T10:00:00+09:00', status: 'upcoming' as const }, // 미래 → 제외
    ];
    const result = computeMadeWeekRate(matches, JUN04);
    expect(result.totalWeeks).toBe(1);
    expect(result.madeWeeks).toBe(1);
    expect(result.failedWeeks).toBe(0);
  });

  it('날짜 지난 upcoming 경기는 메이드 주로 집계', () => {
    const matches = [
      { match_date: '2026-06-01T10:00:00+09:00', status: 'upcoming' as const }, // 과거 → 메이드
      { match_date: '2026-06-08T10:00:00+09:00', status: 'cancelled' as const }, // 파토
    ];
    const result = computeMadeWeekRate(matches, PAST);
    expect(result.madeWeeks).toBe(1);
    expect(result.failedWeeks).toBe(1);
    expect(result.totalWeeks).toBe(2);
    expect(result.rate).toBe(0.5);
  });

  it('한 주에 메이드+파토 혼재 시 메이드 주로 집계', () => {
    const matches = [
      { match_date: '2026-06-01T10:00:00+09:00', status: 'cancelled' as const },
      { match_date: '2026-06-03T10:00:00+09:00', status: 'completed' as const },
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

  it('2026년 6~12월 외 경기는 제외', () => {
    const matches = [
      { match_date: '2025-12-31T10:00:00+09:00', status: 'completed' as const }, // 다른 연도
      { match_date: '2027-01-01T10:00:00+09:00', status: 'cancelled' as const }, // 다른 연도
      { match_date: '2026-01-05T10:00:00+09:00', status: 'completed' as const }, // 2026년이지만 6월 이전 → 제외
      { match_date: '2026-05-31T10:00:00+09:00', status: 'cancelled' as const }, // 5월 → 제외
    ];
    const result = computeMadeWeekRate(matches, PAST);
    expect(result.totalWeeks).toBe(0);
    expect(result.rate).toBe(0);
  });

  it('6월 1일은 포함, 5월 31일은 제외 (하반기 시작 경계)', () => {
    const matches = [
      { match_date: '2026-05-31T10:00:00+09:00', status: 'completed' as const }, // 제외
      { match_date: '2026-06-01T10:00:00+09:00', status: 'completed' as const }, // 포함
    ];
    const result = computeMadeWeekRate(matches, PAST);
    expect(result.totalWeeks).toBe(1);
    expect(result.madeWeeks).toBe(1);
  });

  it('KST 자정 경계: UTC 기준 다른 날이어도 KST 기준 같은 주에 묶임', () => {
    const matches = [
      { match_date: '2026-06-08T00:30:00+09:00', status: 'completed' as const }, // KST 월요일
      { match_date: '2026-06-14T23:59:00+09:00', status: 'cancelled' as const }, // KST 일요일
    ];
    const result = computeMadeWeekRate(matches, PAST);
    expect(result.totalWeeks).toBe(1);
    expect(result.madeWeeks).toBe(1);
  });
});
