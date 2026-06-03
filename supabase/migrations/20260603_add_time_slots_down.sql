-- ============================================================
-- FC실화 — 경기 시간 슬롯 & 다중 투표 마이그레이션 (DOWN / 롤백)
-- 적용 방법: Supabase 대시보드 > SQL Editor 에 붙여넣고 실행
-- 주의: vote_time_slots / match_time_slots 데이터가 함께 삭제된다.
-- ============================================================

-- 투표-슬롯 조인 먼저 제거
DROP TABLE IF EXISTS vote_time_slots;

-- 확정 슬롯 FK/컬럼 제거 (슬롯 테이블보다 먼저)
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_confirmed_slot_id_fkey;
ALTER TABLE matches DROP COLUMN IF EXISTS confirmed_slot_id;

-- 후보 슬롯 테이블 제거
DROP TABLE IF EXISTS match_time_slots;

-- description NOT NULL 복원은 선택 사항.
-- NULL 값이 있으면 실패하므로, 복원하려면 먼저 빈 문자열로 채운 뒤 실행할 것:
--   UPDATE matches SET description = '' WHERE description IS NULL;
--   ALTER TABLE matches ALTER COLUMN description SET NOT NULL;
