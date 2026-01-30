import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { initializeMessaging, getFCMToken } from '../lib/firebase';
import { db } from '../lib/supabase';

type StatusType = 'idle' | 'loading' | 'success' | 'error';

interface ActionStatus {
  status: StatusType;
  message: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [notificationStatus, setNotificationStatus] = useState<ActionStatus>({ status: 'idle', message: '' });
  const [cacheStatus, setCacheStatus] = useState<ActionStatus>({ status: 'idle', message: '' });
  const [tokenDeleteStatus, setTokenDeleteStatus] = useState<ActionStatus>({ status: 'idle', message: '' });
  const [swStatus, setSwStatus] = useState<ActionStatus>({ status: 'idle', message: '' });

  // 현재 알림 권한 상태
  const currentPermission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  // 알림 재설정: 권한 재요청 + FCM 토큰 재발급 + DB 저장
  async function handleResetNotification() {
    setNotificationStatus({ status: 'loading', message: '알림 재설정 중...' });
    try {
      if (!('Notification' in window)) {
        setNotificationStatus({ status: 'error', message: '이 브라우저는 알림을 지원하지 않습니다.' });
        return;
      }

      const permission = Notification.permission;

      if (permission === 'denied') {
        setNotificationStatus({
          status: 'error',
          message: '알림이 차단된 상태입니다. 브라우저 주소창 왼쪽 자물쇠 아이콘을 눌러 알림을 허용으로 변경한 후 다시 시도하세요.',
        });
        return;
      }

      // 권한이 default면 요청, granted면 바로 토큰 발급
      if (permission === 'default') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') {
          setNotificationStatus({ status: 'error', message: '알림 권한이 거부되었습니다.' });
          return;
        }
      }

      // FCM 초기화 + 토큰 발급
      await initializeMessaging();
      const token = await getFCMToken();

      if (token && user) {
        const { error } = await db.savePushToken(user.id, token);
        if (error) {
          setNotificationStatus({ status: 'error', message: `토큰 저장 실패: ${error.message}` });
          return;
        }
        setNotificationStatus({ status: 'success', message: '알림이 성공적으로 재설정되었습니다!' });
      } else if (!token) {
        setNotificationStatus({ status: 'error', message: 'FCM 토큰 발급에 실패했습니다. 잠시 후 다시 시도하세요.' });
      }
    } catch (error: any) {
      setNotificationStatus({ status: 'error', message: `오류: ${error.message || '알 수 없는 오류'}` });
    }
  }

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

  // 서비스워커 재등록
  async function handleResetServiceWorker() {
    setSwStatus({ status: 'loading', message: '서비스워커 재등록 중...' });
    try {
      if (!('serviceWorker' in navigator)) {
        setSwStatus({ status: 'error', message: '이 브라우저는 서비스워커를 지원하지 않습니다.' });
        return;
      }

      // 기존 서비스워커 모두 해제
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));

      // FCM 서비스워커 재등록
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      await navigator.serviceWorker.ready;

      setSwStatus({
        status: 'success',
        message: `기존 ${registrations.length}개 해제 후 재등록 완료!`,
      });
    } catch (error: any) {
      setSwStatus({ status: 'error', message: `오류: ${error.message || '서비스워커 재등록 실패'}` });
    }
  }

  // 푸시 토큰 삭제 (알림 받기 중단)
  async function handleDeleteToken() {
    setTokenDeleteStatus({ status: 'loading', message: '토큰 삭제 중...' });
    try {
      if (!user) {
        setTokenDeleteStatus({ status: 'error', message: '로그인이 필요합니다.' });
        return;
      }
      const { error } = await db.deletePushToken(user.id);
      if (error) {
        setTokenDeleteStatus({ status: 'error', message: `삭제 실패: ${error.message}` });
        return;
      }
      setTokenDeleteStatus({ status: 'success', message: '푸시 토큰이 삭제되었습니다. 더 이상 알림을 받지 않습니다.' });
    } catch (error: any) {
      setTokenDeleteStatus({ status: 'error', message: `오류: ${error.message || '토큰 삭제 실패'}` });
    }
  }

  const permissionLabel: Record<string, { text: string; color: string }> = {
    granted: { text: '허용됨', color: 'text-green-600 bg-green-100' },
    denied: { text: '차단됨', color: 'text-red-600 bg-red-100' },
    default: { text: '미설정', color: 'text-yellow-600 bg-yellow-100' },
    unsupported: { text: '미지원', color: 'text-gray-600 bg-gray-100' },
  };

  const perm = permissionLabel[currentPermission] || permissionLabel.unsupported;

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
              <span className="text-gray-600">알림 권한</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${perm.color}`}>
                {perm.text}
              </span>
            </div>
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

        {/* 알림 재설정 */}
        <SettingsCard
          title="알림 재설정"
          description="알림 권한을 다시 요청하고, FCM 푸시 토큰을 재발급합니다. 알림이 안 올 때 사용하세요."
          buttonText="알림 재설정"
          buttonColor="bg-green-500 hover:bg-green-600"
          onClick={handleResetNotification}
          actionStatus={notificationStatus}
        />

        {/* 푸시 알림 중단 */}
        <SettingsCard
          title="푸시 알림 중단"
          description="서버에 저장된 푸시 토큰을 삭제하여 더 이상 알림을 받지 않습니다. 알림 재설정으로 다시 받을 수 있습니다."
          buttonText="알림 중단"
          buttonColor="bg-orange-500 hover:bg-orange-600"
          onClick={handleDeleteToken}
          actionStatus={tokenDeleteStatus}
        />

        {/* 캐시 초기화 */}
        <SettingsCard
          title="캐시 초기화"
          description="브라우저에 저장된 캐시를 모두 삭제합니다. 앱이 이상하게 동작하거나 업데이트가 반영되지 않을 때 사용하세요."
          buttonText="캐시 삭제"
          buttonColor="bg-blue-500 hover:bg-blue-600"
          onClick={handleClearCache}
          actionStatus={cacheStatus}
        />

        {/* 서비스워커 재등록 */}
        <SettingsCard
          title="서비스워커 재등록"
          description="백그라운드 알림 수신을 위한 서비스워커를 재등록합니다. 푸시 알림이 백그라운드에서 안 올 때 사용하세요."
          buttonText="서비스워커 재등록"
          buttonColor="bg-purple-500 hover:bg-purple-600"
          onClick={handleResetServiceWorker}
          actionStatus={swStatus}
        />

        {/* 안내 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          <p className="font-semibold mb-1">알림이 차단된 경우</p>
          <p>브라우저에서 알림을 "차단"으로 설정한 경우, 사이트 내에서 직접 해제할 수 없습니다.</p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
            <li><b>모바일 (Chrome)</b>: 주소창 좌측 자물쇠 → 권한 → 알림 → 허용</li>
            <li><b>PC (Chrome)</b>: 주소창 좌측 자물쇠 → 사이트 설정 → 알림 → 허용</li>
            <li><b>Safari</b>: 설정 → 웹사이트 → 알림 → 해당 사이트 허용</li>
          </ul>
          <p className="mt-2 text-xs">변경 후 이 페이지에서 "알림 재설정" 버튼을 눌러주세요.</p>
        </div>
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
