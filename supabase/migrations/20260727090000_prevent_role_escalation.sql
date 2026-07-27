-- 권한 상승 차단: 일반 회원이 자기 role/is_admin을 관리자 등급으로 바꾸는 것을 금지
-- ⚠️ Supabase 대시보드 SQL Editor에서 직접 실행하세요.
--    (migrations 폴더 정리 전까지 `supabase db push` 사용 금지 — 다운 스크립트가 함께 적용됨)
--
-- 배경: users UPDATE RLS 정책이 USING (auth.uid() = id)뿐이라 컬럼 제한이 없어,
--       회원이 PATCH /rest/v1/users?id=eq.<본인id> 로 {"role":"main_admin","is_admin":true}를
--       보내면 그대로 반영되어 모든 관리자 권한(경기 생성·수정·삭제, 타 회원 role 변경)을 얻는다.
--       RLS의 WITH CHECK로는 변경 전 값(OLD)을 참조할 수 없어 트리거로 강제한다.
--
-- 허용 유지되는 기존 기능:
--   - 일반 가입: INSERT (role='member', is_admin=false)          → 통과
--   - 휴면 해제: 본인 UPDATE (dormant → member, is_admin 무변경)  → 통과
--   - 대표 관리자의 회원 등급 변경(updateUserRole)                → 통과 (main_admin 확인)
--   - SQL Editor / service_role 등 auth.uid()가 없는 운영 경로     → 통과

CREATE OR REPLACE FUNCTION public.guard_user_privileges()
RETURNS TRIGGER AS $$
DECLARE
  privileged_change BOOLEAN;
  caller_role TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    privileged_change := COALESCE(
      NEW.is_admin = true OR NEW.role IN ('main_admin', 'sub_admin'),
      false
    );
  ELSE
    privileged_change := COALESCE(
      NEW.is_admin IS DISTINCT FROM OLD.is_admin
      OR (NEW.role IS DISTINCT FROM OLD.role
          AND (NEW.role IN ('main_admin', 'sub_admin')
               OR OLD.role IN ('main_admin', 'sub_admin'))),
      false
    );
  END IF;

  IF NOT privileged_change THEN
    RETURN NEW;
  END IF;

  -- SQL Editor·service_role 등 PostgREST 인증 컨텍스트가 없는 경로는 허용
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'main_admin' THEN
    RAISE EXCEPTION '관리자 권한 변경은 대표 관리자만 할 수 있습니다'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_guard_user_privileges ON public.users;
CREATE TRIGGER trigger_guard_user_privileges
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_privileges();
