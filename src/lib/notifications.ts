// 푸시 알림 유틸리티

// 브라우저가 알림을 지원하는지 확인
function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' &&
         'Notification' in window &&
         typeof Notification !== 'undefined';
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (!isNotificationSupported()) {
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
  } catch {
    return false;
  }
}

export function sendNotification(title: string, options?: NotificationOptions): void {
  try {
    if (!isNotificationSupported()) return;
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
  } catch {
    // 알림 발송 실패 - 무시
  }
}

export function sendMatchNotification(matchTitle: string, matchDate: string): void {
  try {
    sendNotification('새로운 경기가 등록되었습니다!', {
      body: `${matchTitle}\n${matchDate}`,
      tag: 'new-match',
    });
  } catch {
    // 알림 발송 실패 - 무시
  }
}
