import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper functions for database operations
export const db = {
  // User operations
  async getUser(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  // Match operations
  async getMatches() {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('match_date', { ascending: true });
    return { data, error };
  },

  async getMatch(matchId: string) {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();
    return { data, error };
  },

  async createMatch(match: any) {
    const { data, error } = await supabase
      .from('matches')
      .insert(match)
      .select()
      .single();
    return { data, error };
  },

  async updateMatch(matchId: string, updates: any) {
    const { data, error } = await supabase
      .from('matches')
      .update(updates)
      .eq('id', matchId)
      .select()
      .single();
    return { data, error };
  },

  async deleteMatch(matchId: string) {
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', matchId);
    return { error };
  },

  // Vote operations
  async getVotes(matchId: string) {
    const { data, error } = await supabase
      .from('votes')
      .select(`
        *,
        user:users(id, name, email)
      `)
      .eq('match_id', matchId);
    return { data, error };
  },

  async getAllVotes() {
    const { data, error } = await supabase
      .from('votes')
      .select('match_id, status');
    return { data, error };
  },

  async createVote(vote: any) {
    const { data, error } = await supabase
      .from('votes')
      .insert(vote)
      .select()
      .single();
    return { data, error };
  },

  async updateVote(voteId: string, updates: any) {
    const { data, error } = await supabase
      .from('votes')
      .update(updates)
      .eq('id', voteId)
      .select()
      .single();
    return { data, error };
  },

  async getUserVote(matchId: string, userId: string) {
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('match_id', matchId)
      .eq('user_id', userId)
      .single();
    return { data, error };
  },

  // 전체 투표 (홈 슬롯 집계용: id/match_id/user_id/status)
  async getAllVotesDetailed() {
    const { data, error } = await supabase
      .from('votes')
      .select('id, match_id, user_id, status');
    return { data, error };
  },

  // Time slot operations (match_time_slots)
  async getMatchSlots(matchId: string) {
    const { data, error } = await supabase
      .from('match_time_slots')
      .select('*')
      .eq('match_id', matchId)
      .order('start_hour', { ascending: true });
    return { data, error };
  },

  async getAllMatchSlots() {
    const { data, error } = await supabase
      .from('match_time_slots')
      .select('id, match_id, start_hour');
    return { data, error };
  },

  // 관리자: 경기의 후보 슬롯을 desired 시각 목록으로 동기화(diff).
  // 변경 없는 시각은 그대로 두어 회원들의 슬롯 선택을 보존한다.
  async saveMatchSlots(matchId: string, hours: number[]) {
    const { data: existing } = await supabase
      .from('match_time_slots')
      .select('id, start_hour')
      .eq('match_id', matchId);

    const existingHours = new Set((existing ?? []).map((s) => s.start_hour));
    const desired = new Set(hours);

    const toAdd = hours.filter((h) => !existingHours.has(h));
    const toRemoveIds = (existing ?? [])
      .filter((s) => !desired.has(s.start_hour))
      .map((s) => s.id);

    if (toRemoveIds.length) {
      await supabase.from('match_time_slots').delete().in('id', toRemoveIds);
    }
    if (toAdd.length) {
      const { error } = await supabase
        .from('match_time_slots')
        .insert(toAdd.map((h) => ({ match_id: matchId, start_hour: h })));
      if (error) return { error };
    }
    return { error: null };
  },

  // Vote slot operations (vote_time_slots)
  async getVoteSlots(voteId: string) {
    const { data, error } = await supabase
      .from('vote_time_slots')
      .select('slot_id')
      .eq('vote_id', voteId);
    return { data, error };
  },

  // 경기의 모든 투표-슬롯 (슬롯 id 경유)
  async getVoteSlotsForMatch(matchId: string) {
    const { data: slots } = await supabase
      .from('match_time_slots')
      .select('id')
      .eq('match_id', matchId);
    const ids = (slots ?? []).map((s) => s.id);
    if (!ids.length) return { data: [], error: null };
    const { data, error } = await supabase
      .from('vote_time_slots')
      .select('vote_id, slot_id')
      .in('slot_id', ids);
    return { data, error };
  },

  async getAllVoteSlots() {
    const { data, error } = await supabase
      .from('vote_time_slots')
      .select('vote_id, slot_id');
    return { data, error };
  },

  // 한 투표의 선택 슬롯을 교체 (참석/늦게도착=slotIds, 불참/미정=[])
  async replaceVoteSlots(voteId: string, slotIds: string[]) {
    await supabase.from('vote_time_slots').delete().eq('vote_id', voteId);
    if (slotIds.length) {
      const { error } = await supabase
        .from('vote_time_slots')
        .insert(slotIds.map((slot_id) => ({ vote_id: voteId, slot_id })));
      return { error };
    }
    return { error: null };
  },

  // Comment operations
  async getComments(matchId: string) {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:users(id, name, email)
      `)
      .eq('match_id', matchId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async createComment(comment: any) {
    const { data, error } = await supabase
      .from('comments')
      .insert(comment)
      .select()
      .single();
    return { data, error };
  },

  // Notification operations
  async getNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async markNotificationAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    return { error };
  },

  // User management operations
  async getAllUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async updateUserRole(userId: string, role: string) {
    const isAdmin = role === 'main_admin' || role === 'sub_admin';
    const { data, error } = await supabase
      .from('users')
      .update({ role, is_admin: isAdmin })
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  },

  async activateDormantUser(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .update({ role: 'member' })
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  },

  // High score operations for lifting game
  async getHighScores() {
    const { data, error } = await supabase
      .from('high_scores')
      .select(`
        user_id,
        score,
        user:users(name)
      `)
      .order('score', { ascending: false })
      .limit(20);

    // Transform data to include user_name
    const transformed = data?.map(item => ({
      user_id: item.user_id,
      score: item.score,
      user_name: (item.user as any)?.name || '알 수 없음'
    }));

    return { data: transformed, error };
  },

  async saveHighScore(userId: string, score: number) {
    // Upsert - update if exists, insert if not
    const { data, error } = await supabase
      .from('high_scores')
      .upsert(
        { user_id: userId, score, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select()
      .single();
    return { data, error };
  },
};
