import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  kakaoLogout,
  isKakaoAvailable,
  kakaoAuthorize,
  getKakaoCodeFromUrl,
  exchangeKakaoCode,
  getKakaoUserInfo,
  clearKakaoCodeFromUrl,
} from '../lib/kakao';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; isDormant?: boolean; userId?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signInWithKakao: () => void;
  handleKakaoCallback: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  activateDormantUser: (userId: string) => Promise<void>;
  kakaoAvailable: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

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
    } catch (error) {
      console.error('Error fetching user profile:', error);
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

  // 카카오 로그인 시작 (리다이렉트)
  function signInWithKakao() {
    kakaoAuthorize();
  }

  // 카카오 콜백 처리 (리다이렉트 후)
  async function handleKakaoCallback(): Promise<{ error: any }> {
    const code = getKakaoCodeFromUrl();
    if (!code) {
      return { error: null };
    }

    try {
      // 1. 인가 코드로 토큰 발급
      const tokenData = await exchangeKakaoCode(code);
      clearKakaoCodeFromUrl();

      // 2. 토큰으로 사용자 정보 조회
      const kakaoUser = await getKakaoUserInfo(tokenData.access_token);
      const kakaoId = kakaoUser.id;
      const kakaoEmail = kakaoUser.kakao_account?.email || `kakao_${kakaoId}@kakao.local`;
      const kakaoName = kakaoUser.kakao_account?.profile?.nickname || `카카오유저${kakaoId}`;

      // 3. Supabase 인증
      const kakaoPassword = `kakao_${kakaoId}_fc_realstory_auth`;

      // 먼저 로그인 시도
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: kakaoEmail,
        password: kakaoPassword,
      });

      if (!signInError && signInData.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', signInData.user.id)
          .single();

        if (userData?.role === 'dormant') {
          return { error: new Error('휴면회원입니다. 관리자에게 문의해주세요.') };
        }
        return { error: null };
      }

      // 신규 가입
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: kakaoEmail,
        password: kakaoPassword,
        options: {
          data: {
            provider: 'kakao',
            kakao_id: kakaoId,
          },
        },
      });

      if (signUpError) {
        return { error: signUpError };
      }

      if (signUpData.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: signUpData.user.id,
            email: kakaoEmail,
            name: kakaoName,
            is_admin: false,
            role: 'member',
          });

        if (profileError && !profileError.message?.includes('duplicate')) {
          console.error('Profile creation error:', profileError);
        }
      }

      return { error: null };
    } catch (error: any) {
      clearKakaoCodeFromUrl();
      console.error('Kakao callback error:', error);
      return { error };
    }
  }

  async function signOut() {
    await kakaoLogout();
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

  const kakaoAvailable = isKakaoAvailable();

  const value = {
    user,
    supabaseUser,
    loading,
    signIn,
    signUp,
    signInWithKakao,
    handleKakaoCallback,
    signOut,
    activateDormantUser,
    kakaoAvailable,
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
