// Firebase Messaging Service Worker
// Firebase SDK 버전은 package.json의 firebase 버전과 맞춰야 함 (현재 12.8.0)
importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-messaging-compat.js');

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
