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

    // Service Worker 등록 및 활성화 대기
    console.log('[FCM] Service Worker 확인 중...');
    let swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');

    if (!swRegistration) {
      console.log('[FCM] Service Worker 등록 중...');
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('[FCM] ✅ Service Worker 등록 완료');
    } else {
      console.log('[FCM] ✅ 기존 Service Worker 사용');
    }

    // Service Worker가 완전히 활성화될 때까지 대기 (최대 10초)
    console.log('[FCM] Service Worker 활성화 대기 중...');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Service Worker 활성화 타임아웃')), 10000)
    );

    const readyPromise = navigator.serviceWorker.ready;

    await Promise.race([readyPromise, timeoutPromise]);
    console.log('[FCM] ✅ Service Worker 활성화 완료');

    // Service Worker가 활성화된 후 추가 대기 (안정화)
    await new Promise(resolve => setTimeout(resolve, 500));

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
