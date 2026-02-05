import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type StatusType = 'idle' | 'loading' | 'success' | 'error';

interface ActionStatus {
  status: StatusType;
  message: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [cacheStatus, setCacheStatus] = useState<ActionStatus>({ status: 'idle', message: '' });

  // 캐시 초기화: Cache Storage + 서비스워커 캐시 삭제
  async function handleClearCache() {
    setCacheStatus({ status: 'loading', message: '캐시 삭제 중...' });
    try {
      let cleared = 0;

      // Cache Storage 삭제
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        cleared += cacheNames.length;
      }

      setCacheStatus({
        status: 'success',
        message: cleared > 0
          ? `캐시 ${cleared}개가 삭제되었습니다. 페이지가 새로고침됩니다.`
          : '삭제할 캐시가 없습니다.',
      });

      if (cleared > 0) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (error: any) {
      setCacheStatus({ status: 'error', message: `오류: ${error.message || '캐시 삭제 실패'}` });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-500 to-blue-500 shadow-lg sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">설정</h1>
          <button
            onClick={() => navigate('/')}
            className="px-3 py-1.5 bg-white/20 backdrop-blur text-white rounded-lg hover:bg-white/30 transition text-sm"
          >
            홈으로
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* 현재 상태 카드 */}
        <div className="bg-white rounded-xl shadow-md p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">현재 상태</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">사용자</span>
              <span className="text-gray-900 font-medium">{user?.name || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">역할</span>
              <span className="text-gray-900 font-medium">
                {user?.role === 'main_admin' ? '대표 관리자' :
                 user?.role === 'sub_admin' ? '부관리자' :
                 user?.role === 'member' ? '회원' : user?.role || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* 캐시 초기화 */}
        <SettingsCard
          title="캐시 초기화"
          description="브라우저에 저장된 캐시를 모두 삭제합니다. 앱이 이상하게 동작하거나 업데이트가 반영되지 않을 때 사용하세요."
          buttonText="캐시 삭제"
          buttonColor="bg-blue-500 hover:bg-blue-600"
          onClick={handleClearCache}
          actionStatus={cacheStatus}
        />
      </main>
    </div>
  );
}

function SettingsCard({
  title,
  description,
  buttonText,
  buttonColor,
  onClick,
  actionStatus,
}: {
  title: string;
  description: string;
  buttonText: string;
  buttonColor: string;
  onClick: () => void;
  actionStatus: ActionStatus;
}) {
  const isLoading = actionStatus.status === 'loading';

  return (
    <div className="bg-white rounded-xl shadow-md p-5">
      <h2 className="text-lg font-bold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <button
        onClick={onClick}
        disabled={isLoading}
        className={`w-full text-white py-2.5 rounded-lg transition font-medium shadow-md disabled:opacity-50 ${buttonColor}`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            처리 중...
          </span>
        ) : (
          buttonText
        )}
      </button>
      {actionStatus.message && actionStatus.status !== 'idle' && (
        <p className={`mt-3 text-sm ${
          actionStatus.status === 'success' ? 'text-green-600' :
          actionStatus.status === 'error' ? 'text-red-600' :
          'text-gray-600'
        }`}>
          {actionStatus.message}
        </p>
      )}
    </div>
  );
}
