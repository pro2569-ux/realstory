import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

// Firebase 설정 - 환경변수에서 가져옴
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Firebase 초기화
let app: ReturnType<typeof initializeApp> | null = null;

function getApp() {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

// FCM 메시징 인스턴스
let messaging: ReturnType<typeof getMessaging> | null = null;

// FCM 초기화
export async function initializeMessaging() {
  try {
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.warn('[FCM] ❌ Firebase 설정이 없습니다. Vercel 환경변수를 확인하세요.');
      console.warn('[FCM] apiKey:', firebaseConfig.apiKey ? '있음' : '없음');
      console.warn('[FCM] projectId:', firebaseConfig.projectId ? '있음' : '없음');
      return null;
    }

    const supported = await isSupported();
    if (!supported) {
      console.warn('[FCM] ❌ 이 브라우저는 FCM을 지원하지 않습니다.');
      return null;
    }

    messaging = getMessaging(getApp());
    console.log('[FCM] ✅ FCM 초기화 성공');
    return messaging;
  } catch (error) {
    console.error('[FCM] ❌ FCM 초기화 실패:', error);
    return null;
  }
}

// 푸시 토큰 가져오기
export async function getFCMToken(): Promise<string | null> {
  try {
    if (!messaging) {
      await initializeMessaging();
    }
    if (!messaging) {
      console.warn('[FCM] ❌ messaging 인스턴스가 없어서 토큰 발급 불가');
      return null;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('[FCM] ❌ VAPID 키가 없습니다. Vercel에 VITE_FIREBASE_VAPID_KEY를 설정하세요.');
      return null;
    }

    // 알림 권한 확인 및 요청
    if (!('Notification' in window)) {
      console.warn('[FCM] ❌ 이 브라우저는 Notification API를 지원하지 않습니다.');
      return null;
    }

    let permission = Notification.permission;
    if (permission === 'default') {
      console.log('[FCM] 알림 권한 요청 중...');
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      console.warn('[FCM] ❌ 알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
      return null;
    }
    console.log('[FCM] ✅ 알림 권한 허용됨');

    // Firebase Messaging Service Worker 명시적 등록
    console.log('[FCM] Service Worker 등록 중...');
    const swRegistration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js'
    );
    console.log('[FCM] ✅ Service Worker 등록 완료');

    await navigator.serviceWorker.ready;

    console.log('[FCM] 토큰 발급 요청 중...');
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      console.log('[FCM] ✅ 토큰 발급 성공:', token.substring(0, 20) + '...');
    } else {
      console.warn('[FCM] ❌ 토큰이 null입니다.');
    }
    return token;
  } catch (error) {
    console.error('[FCM] ❌ 토큰 발급 실패:', error);
    return null;
  }
}

// 포그라운드 메시지 수신 리스너
export function onForegroundMessage(callback: (payload: any) => void) {
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log('[FCM] 포그라운드 메시지 수신:', payload);
    callback(payload);
  });
}

// 클라이언트에서 직접 FCM 푸시 발송 (Legacy HTTP API)
export async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string
): Promise<{ success: number; fail: number }> {
  const serverKey = import.meta.env.VITE_FIREBASE_SERVER_KEY;
  if (!serverKey) {
    console.error('[PUSH] ❌ VITE_FIREBASE_SERVER_KEY가 설정되지 않았습니다.');
    return { success: 0, fail: 0 };
  }

  if (tokens.length === 0) {
    console.warn('[PUSH] 발송할 토큰이 없습니다.');
    return { success: 0, fail: 0 };
  }

  let success = 0;
  let fail = 0;

  // 토큰을 1000개 단위로 나눠서 발송 (FCM 제한)
  const chunkSize = 1000;
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);

    try {
      const res = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${serverKey}`,
        },
        body: JSON.stringify({
          registration_ids: chunk,
          notification: { title, body, icon: '/icons/icon-192x192.png' },
          data: { title, body },
        }),
      });

      if (!res.ok) {
        console.error('[PUSH] ❌ FCM 응답 에러:', res.status, await res.text());
        fail += chunk.length;
        continue;
      }

      const result = await res.json();
      success += result.success || 0;
      fail += result.failure || 0;
      console.log(`[PUSH] ✅ 발송 결과: 성공 ${result.success}, 실패 ${result.failure}`);
    } catch (err) {
      console.error('[PUSH] ❌ 발송 오류:', err);
      fail += chunk.length;
    }
  }

  return { success, fail };
}
