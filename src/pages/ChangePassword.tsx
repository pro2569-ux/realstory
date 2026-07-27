import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// 관리자가 비밀번호를 초기화한 회원이 첫 로그인 시 강제로 거치는 비밀번호 변경 페이지
export default function ChangePassword() {
  const { user, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // 이전 제출에서 updateUser까지는 성공했는지 추적 —
  // 플래그 해제만 실패한 뒤 같은 비밀번호로 재시도하면 GoTrue가
  // same-password 에러를 내는데, 그 경우 비밀번호 단계는 건너뛰고 플래그 해제만 재시도
  const passwordChangedRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        const samePassword = updateError.message?.includes('different from the old password');
        if (!(samePassword && passwordChangedRef.current)) throw updateError;
      } else {
        passwordChangedRef.current = true;
      }

      if (user) {
        const { error: flagError } = await supabase
          .from('users')
          .update({ must_change_password: false })
          .eq('id', user.id);
        if (flagError) throw flagError;
      }

      await refreshProfile();
      navigate('/', { replace: true });
    } catch (err: any) {
      const message = err?.message?.includes('different from the old password')
        ? '이전 비밀번호와 다른 새 비밀번호를 입력해주세요.'
        : err?.message || '비밀번호 변경 중 오류가 발생했습니다.';
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-blue-400 to-purple-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-5xl sm:text-6xl mb-3">&#128274;</div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">비밀번호 변경</h1>
          <p className="text-sm text-gray-500">
            임시 비밀번호로 로그인했습니다.
            <br />
            새 비밀번호를 설정해야 서비스를 이용할 수 있습니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              placeholder="6자 이상"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white py-3 sm:py-4 rounded-xl font-medium hover:from-green-600 hover:to-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>

        <button
          onClick={() => signOut()}
          className="w-full mt-4 text-sm text-gray-400 hover:text-gray-600 transition"
        >
          다른 계정으로 로그인
        </button>
      </div>
    </div>
  );
}
