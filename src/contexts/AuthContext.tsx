import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; isDormant?: boolean; userId?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signInWithKakao: () => Promise<void>;
  signOut: () => Promise<void>;
  activateDormantUser: (userId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// role 기반으로 is_admin을 자동 동기화하는 헬퍼
function syncAdminFlag(userData: any): any {
  if (!userData) return userData;
  const isAdmin = userData.role === 'main_admin' || userData.role === 'sub_admin';
  return { ...userData, is_admin: isAdmin };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  // 프로필 조회 순번 — 늦게 도착한 이전 조회 응답이 최신 상태를 덮어쓰는 것을 방지
  const profileSeqRef = useRef(0);

  useEffect(() => {
    // Supabase OAuth PKCE 콜백 처리: URL에 code 파라미터가 있으면
    // exchangeCodeForSession을 통해 세션을 교환한 후 URL을 정리
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          console.error('OAuth code exchange failed:', error.message);
          // URL에서 code 파라미터 제거
          window.history.replaceState({}, '', window.location.pathname);
          setLoading(false);
        } else if (data.session?.user) {
          // URL에서 code 파라미터 제거
          window.history.replaceState({}, '', window.location.pathname);
          setSupabaseUser(data.session.user);
          fetchOrCreateUserProfile(data.session.user);
        }
      }).catch((err) => {
        console.error('OAuth code exchange error:', err);
        window.history.replaceState({}, '', window.location.pathname);
        setLoading(false);
      });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSupabaseUser(session?.user ?? null);
        if (session?.user) {
          fetchOrCreateUserProfile(session.user);
        } else {
          setLoading(false);
        }
      }).catch((err) => {
        console.error('getSession error:', err);
        setLoading(false);
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        fetchOrCreateUserProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchOrCreateUserProfile(authUser: SupabaseUser) {
    const seq = ++profileSeqRef.current;
    const applyUser = (userData: any) => {
      if (seq === profileSeqRef.current) setUser(syncAdminFlag(userData));
    };
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // 프로필이 없는 경우 (카카오 OAuth 첫 로그인 시)
        const kakaoMeta = authUser.user_metadata;
        const name = kakaoMeta?.name || kakaoMeta?.full_name || kakaoMeta?.preferred_username || `유저${authUser.id.slice(0, 6)}`;
        const email = authUser.email || kakaoMeta?.email || '';

        const { data: newProfile, error: insertError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: email,
            name: name,
            is_admin: false,
            role: 'member',
          })
          .select()
          .single();

        if (insertError) {
          if (insertError.message?.includes('duplicate')) {
            const { data: retryData } = await supabase
              .from('users')
              .select('*')
              .eq('id', authUser.id)
              .single();
            applyUser(retryData);
          } else {
            console.error('Error creating user profile:', insertError);
          }
        } else {
          applyUser(newProfile);
        }
      } else if (error) {
        console.error('Error fetching user profile:', error);
      } else {
        applyUser(data);
      }
    } catch (error) {
      console.error('Error in fetchOrCreateUserProfile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return { error };

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

  // 카카오 로그인 - Supabase OAuth 프로바이더 사용
  async function signInWithKakao() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: window.location.origin + '/login',
        scopes: 'profile_nickname',
        queryParams: {
          scope: 'profile_nickname'
        }
      },
    });

    if (error) {
      console.error('Kakao OAuth error:', error);
      throw error;
    }
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
      setUser(syncAdminFlag(data));
    }
  }

  // 프로필(users 행)을 다시 읽어 컨텍스트를 갱신 — 비밀번호 변경 후 플래그 해제 반영 등
  async function refreshProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await fetchOrCreateUserProfile(session.user);
    }
  }

  const value = {
    user,
    supabaseUser,
    loading,
    signIn,
    signUp,
    signInWithKakao,
    signOut,
    activateDormantUser,
    refreshProfile,
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
