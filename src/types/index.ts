export type VoteStatus = 'attending' | 'not_attending' | 'maybe' | 'late';
export type UserRole = 'main_admin' | 'sub_admin' | 'member' | 'dormant';

export interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  role: UserRole;
  /** 관리자가 비밀번호를 초기화한 경우 true — 첫 로그인 시 변경 강제 */
  must_change_password?: boolean;
  created_at: string;
}

export interface Match {
  id: string;
  title: string;
  description?: string | null;
  match_date: string;
  /** @deprecated 슬롯(match_time_slots)으로 대체됨. 레거시 경기 폴백 표시에만 사용 */
  match_start_time?: number;
  /** @deprecated 슬롯(match_time_slots)으로 대체됨. 레거시 경기 폴백 표시에만 사용 */
  match_end_time?: number;
  vote_deadline?: string;
  location: string;
  min_players: number;
  created_by: string;
  created_at: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  /** 메이드 확정 시 인원이 가장 많았던 슬롯 */
  confirmed_slot_id?: string | null;
}

// 관리자가 등록한 후보 시간 슬롯 (start_hour ~ start_hour+2시간)
export interface MatchTimeSlot {
  id: string;
  match_id: string;
  start_hour: number;
  created_at?: string;
}

// 투표별 선택 슬롯 (참석/늦게도착 시 다중)
export interface VoteTimeSlot {
  vote_id: string;
  slot_id: string;
  created_at?: string;
}

export interface Vote {
  id: string;
  match_id: string;
  user_id: string;
  status: VoteStatus;
  note?: string;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface Comment {
  id: string;
  match_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: User;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}
