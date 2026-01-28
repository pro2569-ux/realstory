// 푸시 알림 유틸리티

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('이 브라우저는 알림을 지원하지 않습니다.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export function sendNotification(title: string, options?: NotificationOptions): void {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const notification = new Notification(title, {
      icon: '/logo-192.png',
      badge: '/logo-192.png',
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.log('알림 발송 실패:', error);
  }
}

export function sendMatchNotification(matchTitle: string, matchDate: string): void {
  sendNotification('새로운 경기가 등록되었습니다!', {
    body: `${matchTitle}\n${matchDate}`,
    tag: 'new-match',
    requireInteraction: true,
  });
}
