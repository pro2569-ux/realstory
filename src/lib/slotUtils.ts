import { MatchTimeSlot, Vote, VoteTimeSlot } from '../types';

export const SLOT_LENGTH_HOURS = 2;

// 메이드/파토 집계에 포함되는 투표 상태 (늦게도착 포함 — 사용자 확정)
const COUNTED_STATUSES = new Set(['attending', 'late']);

// 시작시각 → 표시 문자열. 예) 19 → "19시~21시", 23 → "23시~익일 1시", 22 → "22시~24시"
export function formatSlot(startHour: number): string {
  const end = startHour + SLOT_LENGTH_HOURS;
  if (end < 24) return `${startHour}시~${end}시`;
  if (end === 24) return `${startHour}시~24시`;
  return `${startHour}시~익일 ${end - 24}시`;
}

// slotId → 인원 수 (참석/늦게도착 투표자 중 해당 슬롯을 선택한 사람).
// votes는 (match_id, user_id) UNIQUE 이므로 vote 1건 = 1명.
export function countBySlot(
  votes: Pick<Vote, 'id' | 'status'>[],
  voteSlots: VoteTimeSlot[]
): Map<string, number> {
  const countedVoteIds = new Set(
    votes.filter(v => COUNTED_STATUSES.has(v.status)).map(v => v.id)
  );
  const counts = new Map<string, number>();
  for (const vs of voteSlots) {
    if (!countedVoteIds.has(vs.vote_id)) continue;
    counts.set(vs.slot_id, (counts.get(vs.slot_id) ?? 0) + 1);
  }
  return counts;
}

export interface MatchSlotStats {
  /** 최다 슬롯 인원. 슬롯이 없으면 전체 참석+늦게도착 수로 폴백 */
  maxCount: number;
  /** 인원이 가장 많은 슬롯(동률 시 빠른 시간). 인원 0 또는 슬롯 없으면 null */
  confirmedSlotId: string | null;
  /** maxCount >= minPlayers */
  made: boolean;
  /** 슬롯이 등록된 경기인지 (false면 레거시 폴백 경로) */
  hasSlots: boolean;
}

// 슬롯 기준 메이드/파토 판정.
// - 슬롯이 하나라도 minPlayers 이상이면 made = true, 그 슬롯을 확정.
// - 슬롯이 없는 레거시 경기는 전체 참석+늦게도착 수로 폴백 판정.
export function computeMatchSlotStats(
  slots: Pick<MatchTimeSlot, 'id' | 'start_hour'>[],
  votes: Pick<Vote, 'id' | 'status'>[],
  voteSlots: VoteTimeSlot[],
  minPlayers: number
): MatchSlotStats {
  if (slots.length === 0) {
    const total = votes.filter(v => COUNTED_STATUSES.has(v.status)).length;
    return { maxCount: total, confirmedSlotId: null, made: total >= minPlayers, hasSlots: false };
  }

  const counts = countBySlot(votes, voteSlots);
  let best: { id: string; count: number } | null = null;
  // 시작시간 오름차순 순회 → 동률 시 빠른 시간이 자연 선택됨
  for (const s of [...slots].sort((a, b) => a.start_hour - b.start_hour)) {
    const c = counts.get(s.id) ?? 0;
    if (best === null || c > best.count) best = { id: s.id, count: c };
  }

  const maxCount = best?.count ?? 0;
  return {
    maxCount,
    confirmedSlotId: maxCount > 0 ? best!.id : null,
    made: maxCount >= minPlayers,
    hasSlots: true,
  };
}

// 경기 시간 표시 라벨: 확정 슬롯 > 후보 슬롯 목록 > 레거시 시작/종료 > '미정'
export function matchTimeLabel(
  match: { confirmed_slot_id?: string | null; match_start_time?: number; match_end_time?: number },
  slots: { id: string; start_hour: number }[]
): string {
  const confirmed = match.confirmed_slot_id
    ? slots.find((s) => s.id === match.confirmed_slot_id)
    : undefined;
  if (confirmed) return `${formatSlot(confirmed.start_hour)} 확정`;
  if (slots.length) return slots.map((s) => formatSlot(s.start_hour)).join(', ');
  if (match.match_start_time != null) {
    return `${match.match_start_time}시~${match.match_end_time ?? match.match_start_time}시`;
  }
  return '미정';
}
