// 관리자 비밀번호 초기화 API
// 대표 관리자(main_admin)가 회원 비밀번호를 회원별 랜덤 임시 비밀번호로 재설정하고
// users.must_change_password를 true로 켜서 첫 로그인 시 변경을 강제한다.
// 다른 회원의 비밀번호 변경은 service_role 키가 필요하므로 서버에서만 수행한다.
// 임시 비밀번호는 매번 새로 생성해 응답으로 관리자에게만 보여준다(고정값 금지 —
// 고정값이면 초기화된 계정을 제3자가 선점 로그인으로 탈취할 수 있음).
// 필요 환경변수(Vercel): VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

export const config = { runtime: 'edge' };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// 헷갈리는 문자(0/O, 1/l/I) 제외 알파벳으로 10자리 랜덤 임시 비밀번호 생성
function generateTempPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let password = '';
  for (const byte of bytes) password += alphabet[byte % alphabet.length];
  return password;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json(405, { error: '허용되지 않은 메서드입니다.' });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('admin-reset-password: VITE_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정');
    return json(500, { error: '서버 설정 오류로 요청을 처리할 수 없습니다.' });
  }

  const svcHeaders = { apikey: serviceKey, authorization: `Bearer ${serviceKey}` };

  try {
    // 1. 호출자 확인 (요청의 Bearer 토큰으로 세션 검증)
    const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json(401, { error: '로그인이 필요합니다.' });

    const meRes = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: serviceKey, authorization: `Bearer ${jwt}` },
    });
    if (!meRes.ok) return json(401, { error: '세션이 유효하지 않습니다. 다시 로그인해주세요.' });
    const me = await meRes.json();

    // 2. 호출자가 대표 관리자인지 서버에서 재확인 (클라이언트 가드는 신뢰하지 않음)
    const roleRes = await fetch(`${url}/rest/v1/users?id=eq.${me.id}&select=role`, {
      headers: svcHeaders,
    });
    const roleRows = roleRes.ok ? await roleRes.json() : [];
    if (roleRows[0]?.role !== 'main_admin') {
      return json(403, { error: '대표 관리자만 비밀번호를 초기화할 수 있습니다.' });
    }

    // 3. 대상 회원 확인
    let userId = '';
    try {
      userId = (await req.json())?.userId ?? '';
    } catch {
      // body 파싱 실패 시 아래 형식 검사에서 걸러짐
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return json(400, { error: 'userId가 올바르지 않습니다.' });
    }

    const targetRes = await fetch(`${url}/rest/v1/users?id=eq.${userId}&select=role,name`, {
      headers: svcHeaders,
    });
    const targetRows = targetRes.ok ? await targetRes.json() : [];
    if (!targetRows.length) return json(404, { error: '회원을 찾을 수 없습니다.' });
    // 최고 권한 계정은 본인 포함 초기화 불가 (본인은 정상 비밀번호 변경 경로 사용)
    if (targetRows[0].role === 'main_admin') {
      return json(403, { error: '대표 관리자의 비밀번호는 초기화할 수 없습니다.' });
    }

    // 카카오 OAuth 전용 회원은 비밀번호 로그인이 없으므로 제외
    const authUserRes = await fetch(`${url}/auth/v1/admin/users/${userId}`, { headers: svcHeaders });
    if (!authUserRes.ok) return json(404, { error: '인증 정보를 찾을 수 없습니다.' });
    const authUser = await authUserRes.json();
    const hasEmailLogin = (authUser.identities || []).some(
      (identity: { provider: string }) => identity.provider === 'email'
    );
    if (!hasEmailLogin) {
      return json(400, { error: '카카오 로그인 회원은 비밀번호 초기화 대상이 아닙니다.' });
    }

    // 4. 변경 강제 플래그를 먼저 설정 — 실패하면 비밀번호를 건드리기 전에 중단
    //    (마이그레이션 미실행 등으로 플래그 설정이 불가능한 상태에서
    //     비밀번호만 초기화되는 반쪽 실행을 막는다)
    const flagRes = await fetch(`${url}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...svcHeaders, 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify({ must_change_password: true }),
    });
    if (!flagRes.ok) {
      const flagBody = await flagRes.text();
      if (flagBody.includes('must_change_password')) {
        return json(500, {
          error:
            'DB에 must_change_password 컬럼이 없습니다. 마이그레이션(20260727110000_add_must_change_password.sql)을 Supabase SQL Editor에서 먼저 실행해주세요.',
        });
      }
      console.error('admin-reset-password: 플래그 설정 실패', flagBody);
      return json(500, { error: '변경 강제 설정에 실패해 초기화를 중단했습니다. (비밀번호는 변경되지 않았습니다)' });
    }

    // 5. 임시 비밀번호로 재설정 (Supabase가 대상의 기존 세션을 자동으로 전부 만료시킴)
    const tempPassword = generateTempPassword();
    const resetRes = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: { ...svcHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ password: tempPassword }),
    });
    if (!resetRes.ok) {
      // 비밀번호 변경 실패 시 플래그 원복 시도 (실패해도 무해 — 기존 비밀번호로 로그인 후 변경 화면만 거침)
      await fetch(`${url}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { ...svcHeaders, 'content-type': 'application/json', prefer: 'return=minimal' },
        body: JSON.stringify({ must_change_password: false }),
      }).catch(() => {});
      return json(500, { error: '비밀번호 초기화에 실패했습니다.' });
    }

    return json(200, { ok: true, tempPassword, name: targetRows[0].name });
  } catch (err) {
    console.error('admin-reset-password: 처리 중 오류', err);
    return json(500, { error: '비밀번호 초기화 처리 중 오류가 발생했습니다.' });
  }
}
