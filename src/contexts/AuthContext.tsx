import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, db } from '../lib/supabase';
import { User } from '../types';
import { initializeMessaging, getFCMToken } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; isDormant?: boolean; userId?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  activateDormantUser: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUser(data);

      // FCM 토큰 등록 (비동기로 처리, 실패해도 무시)
      registerFCMToken(userId);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function registerFCMToken(userId: string) {
    try {
      console.log('[FCM] 토큰 등록 시작 - userId:', userId);
      await initializeMessaging();
      const token = await getFCMToken();
      if (token) {
        const { error } = await db.savePushToken(userId, token);
        if (error) {
          console.error('[FCM] ❌ DB 저장 실패:', error.message);
          console.error('[FCM] 💡 push_tokens 테이블과 RLS 정책을 확인하세요.');
        } else {
          console.log('[FCM] ✅ 토큰 DB 저장 완료');
        }
      } else {
        console.warn('[FCM] ❌ 토큰이 없어서 DB 저장 건너뜀');
      }
    } catch (error) {
      console.error('[FCM] ❌ 토큰 등록 실패:', error);
    }
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return { error };

    // 휴면회원인지 확인
    if (data.user) {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (userData?.role === 'dormant') {
        return { error: null, isDormant: true, userId: data.user.id };
      }
    }

    return { error: null, isDormant: false };
  }

  async function signUp(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) return { error };

    if (data.user) {
      // Create user profile with default role
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: data.user.email,
          name,
          is_admin: false,
          role: 'member',
        });

      if (profileError) return { error: profileError };
    }

    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSupabaseUser(null);
  }

  async function activateDormantUser(userId: string) {
    const { data } = await supabase
      .from('users')
      .update({ role: 'member' })
      .eq('id', userId)
      .select()
      .single();

    if (data) {
      setUser(data);
    }
  }

  const value = {
    user,
    supabaseUser,
    loading,
    signIn,
    signUp,
    signOut,
    activateDormantUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
