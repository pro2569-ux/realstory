import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, signIn, signUp, signInWithKakao, handleKakaoCallback, activateDormantUser, kakaoAvailable } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from || '/';

  // user가 로그인되면 자동으로 원래 페이지로 이동
  useEffect(() => {
    if (user && !loading) {
      navigate(from, { replace: true });
    }
  }, [user, loading, from, navigate]);

  // 카카오 콜백 처리 (리다이렉트 후 code 파라미터가 있을 때)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && !loading) {
      setLoading(true);
      setError('');
      handleKakaoCallback().then(({ error }) => {
        if (error) {
          setError(error.message || '카카오 로그인 중 오류가 발생했습니다.');
          setLoading(false);
        }
        // 성공 시 useEffect[user]에서 자동 리다이렉트
      });
    }
  }, []);

  function handleKakaoLogin() {
    setError('');
    try {
      signInWithKakao(); // 카카오 로그인 페이지로 리다이렉트
    } catch (err: any) {
      setError(err.message || '카카오 로그인을 시작할 수 없습니다.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error, isDormant, userId } = await signIn(email, password);
        if (error) throw error;

        if (isDormant && userId) {
          const confirmActivate = window.confirm(
            '휴면회원입니다. 휴면을 해지하시겠습니까?\n\n"확인"을 누르시면 휴면이 해지되고 로그인됩니다.'
          );

          if (confirmActivate) {
            await activateDormantUser(userId);
          } else {
            setError('휴면 해지를 취소하셨습니다. 휴면 해지 후 이용 가능합니다.');
            setLoading(false);
            return;
          }
        }
      } else {
        const { error } = await signUp(email, password, name);
        if (error) throw error;
        setError('회원가입이 완료되었습니다. 로그인해주세요.');
        setIsLogin(true);
        setLoading(false);
      }
    } catch (error: any) {
      setError(error.message || '오류가 발생했습니다.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-blue-400 to-purple-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-5xl sm:text-6xl mb-3">&#9917;</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">FC실화</h1>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2.5 sm:py-3 px-4 rounded-xl font-medium transition-all ${
              isLogin
                ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2.5 sm:py-3 px-4 rounded-xl font-medium transition-all ${
              !isLogin
                ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                placeholder="홍길동"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              placeholder="email@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className={`p-3 rounded-xl text-sm ${
              error.includes('완료') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white py-3 sm:py-4 rounded-xl font-medium hover:from-green-600 hover:to-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-base sm:text-lg"
          >
            {loading ? '처리중...' : isLogin ? '로그인' : '회원가입'}
          </button>
        </form>

        {kakaoAvailable && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-4 text-gray-400">또는</span>
              </div>
            </div>

            <button
              onClick={handleKakaoLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 sm:py-4 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-base sm:text-lg"
              style={{ backgroundColor: '#FEE500', color: '#191919' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3C6.477 3 2 6.477 2 10.5c0 2.58 1.693 4.844 4.243 6.142-.186.695-.673 2.518-.77 2.907-.12.487.178.48.375.35.154-.103 2.454-1.667 3.446-2.344.893.131 1.813.2 2.706.2 5.523 0 10-3.477 10-7.755C22 6.477 17.523 3 12 3z"
                  fill="#191919"
                />
              </svg>
              카카오 로그인
            </button>
          </>
        )}
      </div>
    </div>
  );
}
