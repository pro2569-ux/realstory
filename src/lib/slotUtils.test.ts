import { describe, it, expect } from 'vitest';
import { formatSlot, countBySlot, computeMatchSlotStats } from './slotUtils';

describe('formatSlot', () => {
  it('일반 시간대는 시작~시작+2시간', () => {
    expect(formatSlot(19)).toBe('19시~21시');
    expect(formatSlot(9)).toBe('9시~11시');
  });
  it('22시는 24시로 표기', () => {
    expect(formatSlot(22)).toBe('22시~24시');
  });
  it('자정 넘기면 익일 표기', () => {
    expect(formatSlot(23)).toBe('23시~익일 1시');
  });
});

// 테스트용 헬퍼
const v = (id: string, status: 'attending' | 'not_attending' | 'maybe' | 'late') => ({ id, status });
const vs = (vote_id: string, slot_id: string) => ({ vote_id, slot_id });

describe('countBySlot', () => {
  it('참석/늦게도착만 집계, 불참/미정 제외', () => {
    const votes = [v('a', 'attending'), v('b', 'late'), v('c', 'not_attending'), v('d', 'maybe')];
    const voteSlots = [vs('a', 's1'), vs('b', 's1'), vs('c', 's1'), vs('d', 's1')];
    const counts = countBySlot(votes, voteSlots);
    expect(counts.get('s1')).toBe(2); // a, b만
  });

  it('한 명이 여러 슬롯 선택 시 각 슬롯에 카운트', () => {
    const votes = [v('a', 'attending')];
    const voteSlots = [vs('a', 's1'), vs('a', 's2')];
    const counts = countBySlot(votes, voteSlots);
    expect(counts.get('s1')).toBe(1);
    expect(counts.get('s2')).toBe(1);
  });
});

describe('computeMatchSlotStats', () => {
  const slots = [
    { id: 's19', start_hour: 19 },
    { id: 's21', start_hour: 21 },
  ];

  it('어느 한 슬롯이라도 최소인원 이상이면 made', () => {
    const votes = [v('a', 'attending'), v('b', 'attending'), v('c', 'late')];
    const voteSlots = [vs('a', 's21'), vs('b', 's21'), vs('c', 's21'), vs('a', 's19')];
    const r = computeMatchSlotStats(slots, votes, voteSlots, 3);
    expect(r.made).toBe(true);
    expect(r.maxCount).toBe(3);          // s21 = 3명
    expect(r.confirmedSlotId).toBe('s21');
    expect(r.hasSlots).toBe(true);
  });

  it('모든 슬롯이 최소인원 미만이면 파토', () => {
    const votes = [v('a', 'attending'), v('b', 'attending')];
    const voteSlots = [vs('a', 's19'), vs('b', 's21')];
    const r = computeMatchSlotStats(slots, votes, voteSlots, 3);
    expect(r.made).toBe(false);
    expect(r.maxCount).toBe(1);
  });

  it('동률이면 빠른 시간 슬롯으로 확정', () => {
    const votes = [v('a', 'attending'), v('b', 'attending')];
    const voteSlots = [vs('a', 's19'), vs('b', 's21')]; // s19=1, s21=1 동률
    const r = computeMatchSlotStats(slots, votes, voteSlots, 1);
    expect(r.made).toBe(true);
    expect(r.confirmedSlotId).toBe('s19'); // 빠른 시간
  });

  it('늦게도착도 인원에 포함', () => {
    const votes = [v('a', 'late'), v('b', 'late')];
    const voteSlots = [vs('a', 's19'), vs('b', 's19')];
    const r = computeMatchSlotStats(slots, votes, voteSlots, 2);
    expect(r.made).toBe(true);
    expect(r.maxCount).toBe(2);
  });

  it('슬롯 없는 레거시 경기는 전체 참석수로 폴백', () => {
    const votes = [v('a', 'attending'), v('b', 'late'), v('c', 'not_attending')];
    const r = computeMatchSlotStats([], votes, [], 2);
    expect(r.hasSlots).toBe(false);
    expect(r.maxCount).toBe(2);  // a, b
    expect(r.made).toBe(true);
    expect(r.confirmedSlotId).toBeNull();
  });

  it('투표 없으면 maxCount=0, 파토', () => {
    const r = computeMatchSlotStats(slots, [], [], 3);
    expect(r.maxCount).toBe(0);
    expect(r.made).toBe(false);
    expect(r.confirmedSlotId).toBeNull();
  });
});
