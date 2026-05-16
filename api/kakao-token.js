// Vercel Serverless Function: 카카오 OAuth 토큰 교환
// 브라우저에서 직접 kauth.kakao.com을 호출하면 CORS 문제 발생 가능
// 서버사이드에서 토큰 교환을 처리하여 문제 해결

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: 헬스체크 (배포 확인용)
  if (req.method === 'GET') {
    const restApiKey = process.env.KAKAO_REST_API_KEY || process.env.VITE_KAKAO_REST_API_KEY;
    return res.status(200).json({
      status: 'ok',
      hasRestApiKey: !!restApiKey,
      keyPrefix: restApiKey ? restApiKey.substring(0, 4) + '...' : 'NOT SET',
      envVars: {
        KAKAO_REST_API_KEY: !!process.env.KAKAO_REST_API_KEY,
        VITE_KAKAO_REST_API_KEY: !!process.env.VITE_KAKAO_REST_API_KEY,
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, redirect_uri } = req.body;

    if (!code || !redirect_uri) {
      return res.status(400).json({ error: 'Missing required parameters: code, redirect_uri' });
    }

    // 서버 환경변수에서 REST API 키 읽기 (VITE_ 접두사 포함/미포함 모두 지원)
    const restApiKey = process.env.KAKAO_REST_API_KEY || process.env.VITE_KAKAO_REST_API_KEY;
    const clientSecret = process.env.KAKAO_CLIENT_SECRET || process.env.VITE_KAKAO_CLIENT_SECRET;

    if (!restApiKey) {
      console.error('KAKAO_REST_API_KEY or VITE_KAKAO_REST_API_KEY not set');
      return res.status(500).json({ error: 'Server configuration error: REST API key not found' });
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: restApiKey,
      redirect_uri: redirect_uri,
      code: code,
    });

    if (clientSecret) {
      params.append('client_secret', clientSecret);
    }

    console.log('Kakao token exchange:', {
      client_id: restApiKey.substring(0, 6) + '...',
      redirect_uri,
      has_client_secret: !!clientSecret,
    });

    const response = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Kakao token exchange failed:', data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Kakao token exchange error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
