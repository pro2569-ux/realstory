import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Google OAuth2로 FCM V1 API용 액세스 토큰 발급
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  // Base64url 인코딩
  function base64url(data: string): string {
    return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))
  const unsignedToken = `${encodedHeader}.${encodedPayload}`

  // PEM → CryptoKey
  const pemContent = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  )

  const encodedSignature = base64url(
    String.fromCharCode(...new Uint8Array(signature))
  )
  const jwt = `${unsignedToken}.${encodedSignature}`

  // JWT로 액세스 토큰 교환
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    throw new Error(`토큰 발급 실패: ${JSON.stringify(tokenData)}`)
  }
  return tokenData.access_token
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title, body } = await req.json()
    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'title과 body가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 서비스 계정 키 (Supabase Secret에 저장)
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT 환경변수가 설정되지 않았습니다.')
    }
    const serviceAccount = JSON.parse(serviceAccountJson)
    const projectId = serviceAccount.project_id

    // FCM V1 API용 액세스 토큰
    const accessToken = await getAccessToken(serviceAccount)

    // Supabase에서 모든 푸시 토큰 조회
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: tokens, error: dbError } = await supabase
      .from('push_tokens')
      .select('token')
    if (dbError) {
      throw new Error(`토큰 조회 실패: ${dbError.message}`)
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: 0, fail: 0, message: '등록된 토큰이 없습니다.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 각 토큰에 FCM V1 API로 발송
    let success = 0
    let fail = 0
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

    for (const { token } of tokens) {
      try {
        const res = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              webpush: {
                notification: {
                  title,
                  body,
                  icon: '/icons/icon-192x192.png',
                },
              },
            },
          }),
        })

        if (res.ok) {
          success++
        } else {
          const errData = await res.json()
          console.error(`FCM 발송 실패 (${token.substring(0, 10)}...):`, errData)
          fail++
        }
      } catch (err) {
        console.error(`FCM 발송 오류:`, err)
        fail++
      }
    }

    return new Response(
      JSON.stringify({ success, fail, total: tokens.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Edge Function 오류:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
