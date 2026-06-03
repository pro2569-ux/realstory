-- ============================================================
-- FC실화 — 경기 시간 슬롯 & 다중 투표 마이그레이션 (UP)
-- 적용 방법: Supabase 대시보드 > SQL Editor 에 붙여넣고 실행
-- 재실행 안전(idempotent). 롤백은 20260603_add_time_slots_down.sql 참고
-- ============================================================

-- 1) 설명(description)을 선택 입력으로: NOT NULL 해제
ALTER TABLE matches ALTER COLUMN description DROP NOT NULL;

-- 2) 확정 슬롯 FK 컬럼 (메이드 시 확정된 시간 슬롯)
--    슬롯 테이블 생성 이후 FK 제약을 추가한다.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS confirmed_slot_id UUID;

-- 3) 후보 시간 슬롯 (관리자가 등록한 시작 시각들)
--    start_hour = 0~23 정수. 종료는 표시 시 start_hour + 2 로 계산(자정 넘기면 익일 표기).
CREATE TABLE IF NOT EXISTS match_time_slots (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  start_hour INTEGER NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (match_id, start_hour)
);

-- confirmed_slot_id → match_time_slots(id) FK (슬롯 삭제 시 NULL 처리)
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_confirmed_slot_id_fkey;
ALTER TABLE matches
  ADD CONSTRAINT matches_confirmed_slot_id_fkey
  FOREIGN KEY (confirmed_slot_id) REFERENCES match_time_slots(id) ON DELETE SET NULL;

-- 4) 투표별 슬롯 다중 선택 (참석/늦게도착 시 1개 이상)
CREATE TABLE IF NOT EXISTS vote_time_slots (
  vote_id    UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  slot_id    UUID NOT NULL REFERENCES match_time_slots(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (vote_id, slot_id)
);

-- 5) 인덱스
CREATE INDEX IF NOT EXISTS idx_match_time_slots_match ON match_time_slots(match_id);
CREATE INDEX IF NOT EXISTS idx_vote_time_slots_vote  ON vote_time_slots(vote_id);
CREATE INDEX IF NOT EXISTS idx_vote_time_slots_slot  ON vote_time_slots(slot_id);

-- 6) RLS
ALTER TABLE match_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_time_slots  ENABLE ROW LEVEL SECURITY;

-- match_time_slots: 읽기는 누구나, 쓰기는 관리자만 (기존 matches 정책 패턴 동일)
DROP POLICY IF EXISTS "Anyone can view match_time_slots" ON match_time_slots;
CREATE POLICY "Anyone can view match_time_slots" ON match_time_slots
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage match_time_slots" ON match_time_slots;
CREATE POLICY "Admins manage match_time_slots" ON match_time_slots
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND (is_admin = true OR role IN ('main_admin','sub_admin')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND (is_admin = true OR role IN ('main_admin','sub_admin')))
  );

-- vote_time_slots: 읽기는 누구나, 쓰기는 본인 vote 에 한해서만
DROP POLICY IF EXISTS "Anyone can view vote_time_slots" ON vote_time_slots;
CREATE POLICY "Anyone can view vote_time_slots" ON vote_time_slots
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own vote_time_slots" ON vote_time_slots;
CREATE POLICY "Users manage own vote_time_slots" ON vote_time_slots
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM votes v WHERE v.id = vote_time_slots.vote_id AND v.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM votes v WHERE v.id = vote_time_slots.vote_id AND v.user_id = auth.uid())
  );
