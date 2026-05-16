// Kakao SDK 타입 정의
declare global {
  interface Window {
    Kakao: any;
  }
}

export interface KakaoUserProfile {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
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
      console.log('Kakao SDK initialized successfully:', window.Kakao.isInitialized());
    } catch (error) {
      console.error('Failed to initialize Kakao SDK:', error);
    }
  } else {
    console.error('Invalid Kakao JavaScript Key');
  }
}

// 카카오 SDK 사용 가능 여부 확인
export function isKakaoAvailable(): boolean {
  return !!(window.Kakao && window.Kakao.isInitialized());
}

// 카카오 로그인 시작 (SDK v2 - authorize 리다이렉트 방식)
export function kakaoAuthorize() {
  if (!isKakaoAvailable()) {
    throw new Error('카카오 SDK가 초기화되지 않았습니다.');
  }

  const baseUrl = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');

  window.Kakao.Auth.authorize({
    redirectUri: baseUrl + '/login',
    scope: 'profile_nickname',
  });
}

// URL에서 카카오 인가 코드 추출
export function getKakaoCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

// 카카오 인가 코드로 토큰 발급 (REST API)
export async function exchangeKakaoCode(code: string): Promise<{ access_token: string }> {
  const restApiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
  const redirectUri = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '') + '/login';

  const response = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: restApiKey,
      redirect_uri: redirectUri,
      code: code,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error_description || '카카오 토큰 발급에 실패했습니다.');
  }

  return response.json();
}

// 카카오 액세스 토큰으로 사용자 정보 조회
export async function getKakaoUserInfo(accessToken: string): Promise<KakaoUserProfile> {
  const response = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('카카오 사용자 정보를 가져올 수 없습니다.');
  }

  return response.json();
}

// 카카오 로그아웃 (SDK v2)
export function kakaoLogout(): Promise<void> {
  return new Promise((resolve) => {
    if (!isKakaoAvailable()) {
      resolve();
      return;
    }

    try {
      if (window.Kakao.Auth.getAccessToken()) {
        window.Kakao.Auth.logout(() => {
          console.log('Kakao logout success');
          resolve();
        });
      } else {
        resolve();
      }
    } catch {
      resolve();
    }
  });
}

// URL에서 카카오 코드 파라미터 제거
export function clearKakaoCodeFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  window.history.replaceState({}, '', url.pathname);
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
    const timeStr = `${match.match_start_time ?? 0}시 - ${match.match_end_time ?? 0}시`;

    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const shareUrl = `${appUrl}/match/${match.id}`;

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

    window.Kakao.Share.sendDefault(shareData);
  } catch (error) {
    console.error('Error sharing to Kakao:', error);
    alert('공유 중 오류가 발생했습니다: ' + error);
  }
}
