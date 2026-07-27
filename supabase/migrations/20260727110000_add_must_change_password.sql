-- 비밀번호 초기화 시스템: 관리자가 초기 비밀번호로 리셋한 회원은
-- 첫 로그인 때 비밀번호 변경을 강제하기 위한 플래그
-- ⚠️ Supabase 대시보드 SQL Editor에서 직접 실행하세요.
--    (migrations 폴더 정리 전까지 `supabase db push` 사용 금지)

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
