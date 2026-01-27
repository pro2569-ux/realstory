export type VoteStatus = 'attending' | 'not_attending' | 'maybe' | 'late';
export type UserRole = 'main_admin' | 'sub_admin' | 'member' | 'dormant';

export interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  role: UserRole;
  created_at: string;
}

export interface Match {
  id: string;
  title: string;
  description: string;
  match_date: string;
  match_start_time?: number;
  match_end_time?: number;
  vote_deadline?: string;
  location: string;
  min_players: number;
  created_by: string;
  created_at: string;
  status: 'upcoming' | 'completed' | 'cancelled';
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
