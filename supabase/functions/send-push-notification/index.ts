// FCM V1 API를 사용한 푸시 알림 발송 Edge Function
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushNotificationRequest {
  title: string
  body: string
  data?: Record<string, string>
}

// JWT 생성 및 액세스 토큰 요청
async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwtHeader = {
    alg: 'RS256',
    typ: 'JWT'
  }

  const now = Math.floor(Date.now() / 1000)
  const jwtClaim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }

  // Base64url 인코딩
  const base64url = (str: string) => {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  const encodedHeader = base64url(JSON.stringify(jwtHeader))
  const encodedClaim = base64url(JSON.stringify(jwtClaim))
  const signInput = `${encodedHeader}.${encodedClaim}`

  // Private key 준비 (PEM 형식에서 헤더/푸터 제거 및 개행 제거)
  const privateKeyPem = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\n/g, '')
    .trim()

  // Base64 디코딩하여 ArrayBuffer로 변환
  const binaryDer = Uint8Array.from(atob(privateKeyPem), c => c.charCodeAt(0))

  // Private key import
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  )

  // 서명 생성
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signInput)
  )

  // 서명을 Base64url로 인코딩
  const signature = base64url(String.fromCharCode(...new Uint8Array(signatureBuffer)))
  const jwt = `${signInput}.${signature}`

  // JWT로 액세스 토큰 요청
  console.log('[PUSH] OAuth 토큰 요청 중...')
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text()
    console.error('[PUSH] ❌ OAuth 토큰 요청 실패:', errorText)
    throw new Error(`Failed to get access token: ${errorText}`)
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

Deno.serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[PUSH] Edge Function 시작')

    // Firebase 서비스 계정 JSON 키 확인
    const FIREBASE_SERVICE_ACCOUNT = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!FIREBASE_SERVICE_ACCOUNT) {
      console.error('[PUSH] ❌ FIREBASE_SERVICE_ACCOUNT 환경변수가 설정되지 않았습니다.')
      throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured')
    }

    const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT)
    const projectId = serviceAccount.project_id

    console.log('[PUSH] Project ID:', projectId)

    // Supabase 클라이언트 생성
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 요청 데이터 파싱
    const { title, body, data }: PushNotificationRequest = await req.json()
    console.log('[PUSH] 요청 데이터:', { title, body })

    // 모든 FCM 토큰 가져오기
    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('token')

    if (tokensError) {
      console.error('[PUSH] ❌ 토큰 조회 실패:', tokensError)
      throw tokensError
    }

    if (!tokens || tokens.length === 0) {
      console.log('[PUSH] ⚠️ 등록된 FCM 토큰이 없습니다.')
      return new Response(
        JSON.stringify({ success: true, message: 'No tokens registered', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[PUSH] 발송 대상: ${tokens.length}개 토큰`)

    // OAuth 2.0 액세스 토큰 생성
    console.log('[PUSH] OAuth 액세스 토큰 생성 중...')
    const accessToken = await getAccessToken(serviceAccount)
    console.log('[PUSH] ✅ 액세스 토큰 생성 완료')

    // FCM V1 API로 푸시 알림 발송
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

    // 만료된 토큰 목록 (나중에 삭제)
    const invalidTokens: string[] = []

    const sendPromises = tokens.map(async ({ token }) => {
      try {
        const message = {
          message: {
            token: token,
            notification: {
              title: title,
              body: body,
            },
            webpush: {
              notification: {
                icon: '/logo-192.png',
                badge: '/logo-192.png',
              },
            },
            data: data || {},
          },
        }

        const response = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(message),
        })

        if (response.ok) {
          const result = await response.json()
          console.log('[PUSH] ✅ 발송 성공:', token.substring(0, 20) + '...', result)
          return { success: true }
        } else {
          const errorData = await response.text()
          console.error('[PUSH] ❌ 발송 실패:', token.substring(0, 20) + '...', errorData)

          // 만료되거나 유효하지 않은 토큰 감지 (UNREGISTERED, INVALID_ARGUMENT 등)
          if (errorData.includes('UNREGISTERED') ||
              errorData.includes('INVALID_ARGUMENT') ||
              errorData.includes('not a valid FCM')) {
            console.log('[PUSH] 🗑️ 만료된 토큰 감지:', token.substring(0, 20) + '...')
            invalidTokens.push(token)
          }

          return { success: false, error: errorData }
        }
      } catch (error) {
        console.error('[PUSH] ❌ 발송 에러:', error)
        return { success: false, error: String(error) }
      }
    })

    const results = await Promise.all(sendPromises)
    const successResults = results.filter(r => r.success).length
    const failedResults = results.filter(r => !r.success).length

    console.log(`[PUSH] 완료: 성공 ${successResults}개, 실패 ${failedResults}개`)

    // 만료된 토큰 DB에서 삭제
    if (invalidTokens.length > 0) {
      console.log(`[PUSH] 🗑️ 만료된 토큰 ${invalidTokens.length}개 삭제 중...`)
      const { error: deleteError } = await supabase
        .from('push_tokens')
        .delete()
        .in('token', invalidTokens)

      if (deleteError) {
        console.error('[PUSH] ❌ 토큰 삭제 실패:', deleteError)
      } else {
        console.log(`[PUSH] ✅ 만료된 토큰 ${invalidTokens.length}개 삭제 완료`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successResults,
        failed: failedResults,
        total: tokens.length,
        invalidTokensRemoved: invalidTokens.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[PUSH] ❌ Edge Function 에러:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
