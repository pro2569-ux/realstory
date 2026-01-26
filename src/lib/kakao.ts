// Kakao SDK 타입 정의
declare global {
  interface Window {
    Kakao: any;
  }
}

// Kakao SDK 초기화
export function initKakao() {
  if (typeof window === 'undefined') {
    console.log('Window is undefined');
    return;
  }

  if (!window.Kakao) {
    console.error('Kakao SDK not loaded. Check if script tag is present.');
    return;
  }

  if (window.Kakao.isInitialized()) {
    console.log('Kakao SDK already initialized');
    return;
  }

  const kakaoKey = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY;
  console.log('Kakao Key:', kakaoKey ? 'Found' : 'Not found');

  if (kakaoKey && kakaoKey !== 'your_kakao_javascript_key_here') {
    try {
      window.Kakao.init(kakaoKey);
      console.log('✅ Kakao SDK initialized successfully:', window.Kakao.isInitialized());
    } catch (error) {
      console.error('❌ Failed to initialize Kakao SDK:', error);
    }
  } else {
    console.error('❌ Invalid Kakao JavaScript Key');
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
  console.log('📤 Attempting to share match:', match.title);

  // Kakao SDK 확인
  if (!window.Kakao) {
    console.error('❌ Kakao SDK not loaded');
    alert('카카오톡 SDK가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
    return;
  }

  if (!window.Kakao.isInitialized()) {
    console.error('❌ Kakao SDK not initialized');
    alert('카카오톡 SDK가 초기화되지 않았습니다. JavaScript 키를 확인해주세요.');
    return;
  }

  try {
    const matchDate = new Date(match.match_date);
    const dateStr = `${matchDate.getFullYear()}년 ${matchDate.getMonth() + 1}월 ${matchDate.getDate()}일`;
    const timeStr = `${match.match_start_time ?? 0}시 - ${match.match_end_time ?? 0}시`;

    // 배포된 URL을 사용 (환경변수에서 가져오거나 현재 origin 사용)
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const shareUrl = `${appUrl}/match/${match.id}`;

    console.log('📱 Share URL:', shareUrl);

    const shareData = {
      objectType: 'feed',
      content: {
        title: `⚽ ${match.title}`,
        description: `📅 ${dateStr} ${timeStr}\n📍 ${match.location}\n\n${match.description}`,
        imageUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80',
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
    };

    console.log('📋 Share data:', shareData);

    window.Kakao.Share.sendDefault(shareData);
    console.log('✅ Share request sent successfully');
  } catch (error) {
    console.error('❌ Error sharing to Kakao:', error);
    alert(`공유 중 오류가 발생했습니다: ${error}`);
  }
}
