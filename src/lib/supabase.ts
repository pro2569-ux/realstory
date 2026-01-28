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

  // Push token operations
  async savePushToken(userId: string, token: string) {
    const { data, error } = await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select()
      .single();
    return { data, error };
  },

  async getAllPushTokens() {
    const { data, error } = await supabase
      .from('push_tokens')
      .select('token');
    return { data, error };
  },

  async deletePushToken(userId: string) {
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId);
    return { error };
  },
};
