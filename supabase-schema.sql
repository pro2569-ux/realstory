-- Supabase 데이터베이스 스키마
-- 이 SQL을 Supabase SQL Editor에서 실행하세요

-- Users 테이블 (Supabase Auth와 연동)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  role TEXT DEFAULT 'member' CHECK (role IN ('main_admin', 'sub_admin', 'member', 'dormant')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matches 테이블
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  match_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 12,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes 테이블
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('attending', 'not_attending', 'maybe', 'late')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);

-- Comments 테이블
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications 테이블
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users 정책
CREATE POLICY "Users can view all profiles" ON users
  FOR SELECT USING (true);

-- 주의: 이 정책은 행 단위만 제한하므로 role/is_admin 컬럼 보호는
-- 하단의 guard_user_privileges 트리거가 담당한다 (권한 상승 차단).
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (is_admin = true OR role IN ('main_admin', 'sub_admin')))
  );

-- Matches 정책
CREATE POLICY "Anyone can view matches" ON matches
  FOR SELECT USING (true);

CREATE POLICY "Admins can create matches" ON matches
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (is_admin = true OR role IN ('main_admin', 'sub_admin')))
  );

CREATE POLICY "Admins can update matches" ON matches
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (is_admin = true OR role IN ('main_admin', 'sub_admin')))
  );

CREATE POLICY "Admins can delete matches" ON matches
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (is_admin = true OR role IN ('main_admin', 'sub_admin')))
  );

-- Votes 정책
CREATE POLICY "Anyone can view votes" ON votes
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own votes" ON votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes" ON votes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes" ON votes
  FOR DELETE USING (auth.uid() = user_id);

-- Comments 정책
CREATE POLICY "Anyone can view comments" ON comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);

-- Notifications 정책
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 인덱스 생성
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_votes_match ON votes(match_id);
CREATE INDEX idx_votes_user ON votes(user_id);
CREATE INDEX idx_comments_match ON comments(match_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- 함수: 투표 생성 시 알림 생성
CREATE OR REPLACE FUNCTION notify_new_vote()
RETURNS TRIGGER AS $$
BEGIN
  -- 관리자들에게 알림
  INSERT INTO notifications (user_id, title, message)
  SELECT 
    u.id,
    '새로운 투표',
    (SELECT name FROM users WHERE id = NEW.user_id) || '님이 ' || 
    (SELECT title FROM matches WHERE id = NEW.match_id) || ' 경기에 투표했습니다.'
  FROM users u
  WHERE u.is_admin = true AND u.id != NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_vote
  AFTER INSERT ON votes
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_vote();

-- 함수: 새 경기 생성 시 모든 사용자에게 알림
CREATE OR REPLACE FUNCTION notify_new_match()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message)
  SELECT 
    u.id,
    '새로운 경기',
    '새로운 경기가 등록되었습니다: ' || NEW.title
  FROM users u
  WHERE u.id != NEW.created_by;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_match
  AFTER INSERT ON matches
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_match();

-- 함수: 권한 상승 차단 — role/is_admin의 관리자 등급 관련 변경은 main_admin만 가능
-- (일반 가입 member/false, 휴면 해제 dormant→member 셀프 전환, SQL Editor 경로는 허용)
CREATE OR REPLACE FUNCTION guard_user_privileges()
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

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM users WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'main_admin' THEN
    RAISE EXCEPTION '관리자 권한 변경은 대표 관리자만 할 수 있습니다'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_guard_user_privileges
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION guard_user_privileges();
