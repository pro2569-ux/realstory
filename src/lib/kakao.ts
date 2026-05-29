// Kakao SDK 타입 정의
declare global {
  interface Window {
    Kakao: any;
  }
}

// Kakao SDK 초기화 (카카오톡 공유 기능용)
export function initKakao() {
  if (typeof window === 'undefined') return;
  if (!window.Kakao) return;
  if (window.Kakao.isInitialized()) return;

  const kakaoKey = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY;
  if (kakaoKey && kakaoKey !== 'your_kakao_javascript_key_here') {
    try {
      window.Kakao.init(kakaoKey);
    } catch (error) {
      console.error('Failed to initialize Kakao SDK:', error);
    }
  }
}

// 카카오 SDK 사용 가능 여부 확인 (공유 기능용)
export function isKakaoAvailable(): boolean {
  return !!(window.Kakao && window.Kakao.isInitialized());
}

// 2026 메이드율 통계 공유하기
export function shareStatsToKakao() {
  if (!window.Kakao) {
    alert('카카오톡 SDK가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
    return;
  }
  if (!window.Kakao.isInitialized()) {
    alert('카카오톡 SDK가 초기화되지 않았습니다. JavaScript 키를 확인해주세요.');
    return;
  }

  try {
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    // 날짜를 붙여 카카오 이미지 캐시를 매일 갱신
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const imageUrl = `${appUrl}/api/og-stats?d=${ts}`;
    const shareUrl = `${appUrl}/statistics`;

    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: '⚽ FC실화 2026 메이드율',
        description: '우리 팀의 2026년 메이드 주 비율을 확인해보세요!',
        imageUrl,
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
        },
      },
      buttons: [
        {
          title: '통계 보러 가기',
          link: {
            mobileWebUrl: shareUrl,
            webUrl: shareUrl,
          },
        },
      ],
    });
  } catch (error) {
    console.error('Error sharing stats to Kakao:', error);
    alert('공유 중 오류가 발생했습니다: ' + error);
  }
}

// 경기 공유하기
export function shareMatchToKakao(match: {
  id: string;
  title: string;
  description: string;
  match_date: string;
  match_start_time?: number;
  match_end_time?: number;
  location: string;
  vote_deadline?: string;
}) {
  if (!window.Kakao) {
    alert('카카오톡 SDK가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
    return;
  }

  if (!window.Kakao.isInitialized()) {
    alert('카카오톡 SDK가 초기화되지 않았습니다. JavaScript 키를 확인해주세요.');
    return;
  }

  try {
    const matchDate = new Date(match.match_date);
    const dateStr = `${matchDate.getFullYear()}년 ${matchDate.getMonth() + 1}월 ${matchDate.getDate()}일`;

    let deadlineStr = '없음';
    if (match.vote_deadline) {
      const dl = new Date(match.vote_deadline);
      deadlineStr = `${dl.getMonth() + 1}월 ${dl.getDate()}일 ${dl.getHours()}시`;
    }

    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const shareUrl = `${appUrl}/match/${match.id}`;

    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `⚽ ${match.title}`,
        description: `📅 ${dateStr}\n⏰ 투표 마감: ${deadlineStr}`,
        imageUrl: `${appUrl}/api/og-stats`,
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
        },
      },
      buttons: [
        {
          title: '투표하러가기!',
          link: {
            mobileWebUrl: shareUrl,
            webUrl: shareUrl,
          },
        },
      ],
    });
  } catch (error) {
    console.error('Error sharing to Kakao:', error);
    alert('공유 중 오류가 발생했습니다: ' + error);
  }
}
