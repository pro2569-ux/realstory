-- 1. users 테이블에 role 컬럼 추가 (없는 경우)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';

-- 2. 기존 is_admin 데이터와 role 동기화
UPDATE users SET role = 'main_admin' WHERE is_admin = true AND (role IS NULL OR role = 'member');
UPDATE users SET is_admin = true WHERE role IN ('main_admin', 'sub_admin') AND (is_admin = false OR is_admin IS NULL);

-- 3. matches INSERT 정책 수정: role 기반도 허용
DROP POLICY IF EXISTS "Admins can create matches" ON matches;
CREATE POLICY "Admins can create matches" ON matches
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (is_admin = true OR role IN ('main_admin', 'sub_admin'))
    )
  );

-- 4. matches UPDATE 정책 수정
DROP POLICY IF EXISTS "Admins can update matches" ON matches;
CREATE POLICY "Admins can update matches" ON matches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (is_admin = true OR role IN ('main_admin', 'sub_admin'))
    )
  );

-- 5. matches DELETE 정책 수정
DROP POLICY IF EXISTS "Admins can delete matches" ON matches;
CREATE POLICY "Admins can delete matches" ON matches
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (is_admin = true OR role IN ('main_admin', 'sub_admin'))
    )
  );

-- 6. users UPDATE 정책 수정: 관리자가 다른 유저의 역할을 변경할 수 있도록
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (
    auth.uid() = id 
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (is_admin = true OR role IN ('main_admin', 'sub_admin'))
    )
  );

-- 7. notifications INSERT 정책 추가 (트리거에서 알림 생성 시 필요)
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);
