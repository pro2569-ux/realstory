// Kakao SDK 타입 정의
declare global {
  interface Window {
    Kakao: any;
  }
}

// Kakao SDK 초기화
export function initKakao() {
  if (typeof window !== 'undefined' && window.Kakao && !window.Kakao.isInitialized()) {
    const kakaoKey = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY;
    if (kakaoKey && kakaoKey !== 'your_kakao_javascript_key_here') {
      window.Kakao.init(kakaoKey);
      console.log('Kakao SDK initialized:', window.Kakao.isInitialized());
    }
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
}) {
  if (!window.Kakao || !window.Kakao.isInitialized()) {
    alert('카카오톡 SDK가 초기화되지 않았습니다. JavaScript 키를 확인해주세요.');
    return;
  }

  const matchDate = new Date(match.match_date);
  const dateStr = `${matchDate.getFullYear()}년 ${matchDate.getMonth() + 1}월 ${matchDate.getDate()}일`;
  const timeStr = `${match.match_start_time ?? 0}시 - ${match.match_end_time ?? 0}시`;

  // 현재 URL 기반으로 경기 상세 페이지 URL 생성
  const shareUrl = `${window.location.origin}/match/${match.id}`;

  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: `⚽ ${match.title}`,
      description: `📅 ${dateStr} ${timeStr}\n📍 ${match.location}\n\n${match.description}`,
      imageUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800',
      link: {
        mobileWebUrl: shareUrl,
        webUrl: shareUrl,
      },
    },
    buttons: [
      {
        title: '투표하러 가기',
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
        },
      },
    ],
  });
}
