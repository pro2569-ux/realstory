// Firebase Messaging Service Worker
// Firebase SDK 버전은 package.json의 firebase 버전과 맞춰야 함 (현재 12.8.0)
importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-messaging-compat.js');

// Service Worker 버전 (SDK 버전 변경 시 함께 올려서 캐시 강제 갱신)
const SW_VERSION = '1.4.5';

// Service Worker 설치 시 - 즉시 활성화
self.addEventListener('install', (event) => {
  console.log('[FCM SW] 설치됨 - 버전:', SW_VERSION);
  self.skipWaiting(); // 대기 중인 SW 즉시 활성화
});

// Service Worker 활성화 시 - 기존 캐시 정리 및 클라이언트 제어
self.addEventListener('activate', (event) => {
  console.log('[FCM SW] 활성화됨 - 버전:', SW_VERSION);
  event.waitUntil(
    Promise.all([
      // 모든 클라이언트 즉시 제어
      self.clients.claim(),
      // 기존 캐시 정리 (필요시)
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.includes('firebase')) {
              console.log('[FCM SW] 캐시 삭제:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Firebase 설정
firebase.initializeApp({
  apiKey: "AIzaSyD4_FTsnvmGOJ1G1exO6lJ5fj2DQUVc6iQ",
  authDomain: "fcrealstory-fa2f6.firebaseapp.com",
  projectId: "fcrealstory-fa2f6",
  storageBucket: "fcrealstory-fa2f6.firebasestorage.app",
  messagingSenderId: "740180899539",
  appId: "1:740180899539:web:b08be7ebcc5dd9c728c626",
});

const messaging = firebase.messaging();

// 백그라운드 메시지 수신
messaging.onBackgroundMessage((payload) => {
  console.log('백그라운드 메시지 수신:', payload);

  const notificationTitle = payload.notification?.title || '새로운 알림';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    tag: 'fc-realstory-notification',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
