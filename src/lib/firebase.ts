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
const app = initializeApp(firebaseConfig);

// FCM 메시징 인스턴스 (지원되는 경우에만)
let messaging: ReturnType<typeof getMessaging> | null = null;

// FCM 초기화
export async function initializeMessaging() {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.log('이 브라우저는 FCM을 지원하지 않습니다.');
      return null;
    }
    messaging = getMessaging(app);
    return messaging;
  } catch (error) {
    console.log('FCM 초기화 실패:', error);
    return null;
  }
}

// 푸시 토큰 가져오기
export async function getFCMToken(): Promise<string | null> {
  try {
    if (!messaging) {
      await initializeMessaging();
    }
    if (!messaging) return null;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.log('VAPID 키가 설정되지 않았습니다.');
      return null;
    }

    const token = await getToken(messaging, { vapidKey });
    return token;
  } catch (error) {
    console.log('FCM 토큰 가져오기 실패:', error);
    return null;
  }
}

// 포그라운드 메시지 수신 리스너
export function onForegroundMessage(callback: (payload: any) => void) {
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log('포그라운드 메시지 수신:', payload);
    callback(payload);
  });
}

export { app };
