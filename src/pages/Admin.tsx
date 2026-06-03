import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase';
import { Match, User, UserRole } from '../types';
import { format, subDays } from 'date-fns';
import { formatSlot } from '../lib/slotUtils';

const ROLE_LABELS: Record<UserRole, string> = {
  main_admin: '메인관리자',
  sub_admin: '서브관리자',
  member: '일반회원',
  dormant: '휴면회원',
};

const ROLE_COLORS: Record<UserRole, string> = {
  main_admin: 'bg-purple-100 text-purple-800',
  sub_admin: 'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  dormant: 'bg-gray-100 text-gray-800',
};

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'matches' | 'users'>('matches');
  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  const isMainAdmin = user?.role === 'main_admin';

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/');
      return;
    }
    loadMatches();
    loadUsers();
  }, [user, navigate]);

  async function loadMatches() {
    const { data } = await db.getMatches();
    setMatches(data || []);
  }

  async function loadUsers() {
    const { data } = await db.getAllUsers();
    setUsers(data || []);
  }

  async function handleDelete(matchId: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    await db.deleteMatch(matchId);
    loadMatches();
  }

  function handleEdit(match: Match) {
    setEditingMatch(match);
    setShowForm(true);
  }

  function handleCreate() {
    setEditingMatch(null);
    setShowForm(true);
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    if (!isMainAdmin) {
      alert('메인관리자만 권한을 변경할 수 있습니다.');
      return;
    }

    const targetUser = users.find(u => u.id === userId);
    if (targetUser?.role === 'main_admin') {
      alert('메인관리자의 권한은 변경할 수 없습니다.');
      return;
    }

    const roleLabel = ROLE_LABELS[newRole];
    if (!confirm(`해당 회원을 ${roleLabel}(으)로 변경하시겠습니까?`)) return;

    const { error } = await db.updateUserRole(userId, newRole);
    if (error) {
      alert('권한 변경 중 오류가 발생했습니다.');
      return;
    }
    loadUsers();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">관리자 페이지</h1>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              홈으로
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('matches')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'matches'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            경기 관리
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'users'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            회원 관리
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'matches' ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">경기 관리</h2>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              >
                + 새 경기 등록
              </button>
            </div>

            {showForm && (
              <MatchForm
                match={editingMatch}
                onClose={() => {
                  setShowForm(false);
                  setEditingMatch(null);
                  loadMatches();
                }}
              />
            )}

            <div className="space-y-4">
              {matches.map((match) => (
                <div key={match.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{match.title}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      match.status === 'upcoming' ? 'bg-green-100 text-green-800' :
                      match.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {match.status === 'upcoming' ? '예정' :
                       match.status === 'completed' ? '완료' : '취소'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1 mb-3">
                    <p>📅 {format(new Date(match.match_date), 'yyyy-MM-dd')}</p>
                    <p>📍 {match.location}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(match)}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(match.id)}
                      className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">회원 관리</h2>
              <span className="text-sm text-gray-500">총 {users.length}명</span>
            </div>

            {!isMainAdmin && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-yellow-800 text-sm">
                  서브관리자는 회원 목록만 조회할 수 있습니다. 권한 변경은 메인관리자만 가능합니다.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {users.map((u) => (
                <div key={u.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{u.name}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${ROLE_COLORS[u.role || 'member']}`}>
                          {ROLE_LABELS[u.role || 'member']}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{u.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        가입일: {format(new Date(u.created_at), 'yyyy-MM-dd')}
                      </p>
                    </div>

                    {isMainAdmin && u.role !== 'main_admin' && (
                      <div className="flex flex-col gap-1">
                        <select
                          value={u.role || 'member'}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                          <option value="sub_admin">서브관리자</option>
                          <option value="member">일반회원</option>
                          <option value="dormant">휴면회원</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function MatchForm({ match, onClose }: { match: Match | null; onClose: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(match?.title || '');
  const [description, setDescription] = useState(match?.description || '');
  const [matchDate, setMatchDate] = useState(
    match?.match_date ? format(new Date(match.match_date), 'yyyy-MM-dd') : ''
  );
  const [location, setLocation] = useState(match?.location || '');
  const [minPlayers, setMinPlayers] = useState(match?.min_players || 10);
  const [status, setStatus] = useState<Match['status']>(match?.status || 'upcoming');

  // 투표 마감: 날짜 + 시(분/초 없음)
  const [deadlineDate, setDeadlineDate] = useState(
    match?.vote_deadline ? format(new Date(match.vote_deadline), 'yyyy-MM-dd') : ''
  );
  const [deadlineHour, setDeadlineHour] = useState(
    match?.vote_deadline ? new Date(match.vote_deadline).getHours() : 14
  );
  // 기존 경기엔 이미 마감값이 있으므로 '손댄 것'으로 간주 → 날짜 변경 시 자동 덮어쓰기 방지
  const [deadlineTouched, setDeadlineTouched] = useState(!!match?.vote_deadline);

  // 경기 시작 시간 슬롯 (체크한 시각들). 각 시각 = 시작 ~ 시작+2시간
  const [selectedHours, setSelectedHours] = useState<number[]>([]);

  // 수정 모드: 기존 슬롯 프리필 (슬롯 없는 레거시 경기는 기존 시작시각 1개로 폴백)
  useEffect(() => {
    let cancelled = false;
    async function loadSlots() {
      if (!match) return;
      const { data } = await db.getMatchSlots(match.id);
      if (cancelled) return;
      if (data && data.length) {
        setSelectedHours(
          data.map((s: { start_hour: number }) => s.start_hour).sort((a, b) => a - b)
        );
      } else if (match.match_start_time != null) {
        setSelectedHours([match.match_start_time]);
      }
    }
    loadSlots();
    return () => {
      cancelled = true;
    };
  }, [match]);

  function handleMatchDateChange(value: string) {
    setMatchDate(value);
    // 사용자가 마감을 손대지 않았을 때만 기본값(경기 −2일 14시) 자동 계산
    if (value && !deadlineTouched) {
      const d = subDays(new Date(value + 'T00:00:00'), 2);
      setDeadlineDate(format(d, 'yyyy-MM-dd'));
      setDeadlineHour(14);
    }
  }

  function toggleHour(h: number) {
    setSelectedHours((prev) =>
      prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h].sort((a, b) => a - b)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (selectedHours.length === 0) {
      alert('경기 시작 시간을 최소 1개 이상 선택하세요.');
      return;
    }

    try {
      const voteDeadlineISO = deadlineDate
        ? new Date(`${deadlineDate}T${String(deadlineHour).padStart(2, '0')}:00:00`).toISOString()
        : null;

      const matchData = {
        title,
        description: description.trim() ? description.trim() : null,
        match_date: new Date(matchDate + 'T00:00:00').toISOString(),
        vote_deadline: voteDeadlineISO,
        location,
        min_players: minPlayers,
        status,
      };

      let matchId: string;
      if (match) {
        const result = await db.updateMatch(match.id, matchData);
        if (result.error) {
          console.error('Error saving match:', result.error);
          alert(`저장 중 오류가 발생했습니다: ${result.error.message}`);
          return;
        }
        matchId = match.id;
      } else {
        const result = await db.createMatch({ ...matchData, created_by: user?.id });
        if (result.error || !result.data) {
          console.error('Error saving match:', result.error);
          alert(`저장 중 오류가 발생했습니다: ${result.error?.message ?? '알 수 없는 오류'}`);
          return;
        }
        matchId = result.data.id;
      }

      const slotRes = await db.saveMatchSlots(matchId, selectedHours);
      if (slotRes.error) {
        console.error('Error saving slots:', slotRes.error);
        alert(`시간 슬롯 저장 중 오류가 발생했습니다: ${slotRes.error.message}`);
        return;
      }

      onClose();
    } catch (error) {
      console.error('Error saving match:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          {match ? '경기 수정' : '새 경기 등록'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명 <span className="text-xs text-gray-400">(선택)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={3}
              placeholder="선택 입력"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">경기 날짜</label>
            <input
              type="date"
              value={matchDate}
              onChange={(e) => handleMatchDateChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              경기 시작 시간{' '}
              <span className="text-xs text-gray-400">(시작 ~ 시작+2시간 · 여러 개 선택 가능)</span>
            </label>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 24 }, (_, h) => (
                <button
                  type="button"
                  key={h}
                  onClick={() => toggleHour(h)}
                  className={`py-2 rounded-lg border text-sm font-medium transition ${
                    selectedHours.includes(h)
                      ? 'bg-green-500 text-white border-green-500 shadow'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                  }`}
                >
                  {h}시
                </button>
              ))}
            </div>
            {selectedHours.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                선택: {selectedHours.map((h) => formatSlot(h)).join(', ')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              투표 마감일시 <span className="text-xs text-gray-400">(시 단위)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => {
                  setDeadlineDate(e.target.value);
                  setDeadlineTouched(true);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <select
                value={deadlineHour}
                onChange={(e) => {
                  setDeadlineHour(parseInt(e.target.value));
                  setDeadlineTouched(true);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i}시
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              기본값: 경기 날짜 2일 전 14시 · 날짜를 비우면 마감 없음
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">장소</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">최소 인원</label>
            <input
              type="number"
              value={minPlayers}
              onChange={(e) => setMinPlayers(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              min="1"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              마감 시 어느 한 시간대라도 최소 인원 이상이면 경기 성립
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Match['status'])}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="upcoming">예정</option>
              <option value="completed">완료</option>
              <option value="cancelled">취소</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition"
            >
              저장
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600 transition"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
