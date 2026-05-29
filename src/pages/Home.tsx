import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase';
import { Match } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
const LiftingGame = lazy(() => import('../components/LiftingGame'));
const FingerChooser = lazy(() => import('../components/FingerChooser'));

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [attendingCounts, setAttendingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar' | 'game' | 'picker'>('list');
  const [matchTab, setMatchTab] = useState<'upcoming' | 'past'>('upcoming');
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isMainAdmin = user?.role === 'main_admin';

  useEffect(() => {
    loadMatches();
  }, []);

  async function loadMatches() {
    try {
      const [matchesRes, votesRes] = await Promise.all([
        db.getMatches(),
        db.getAllVotes(),
      ]);
      if (matchesRes.error) throw matchesRes.error;
      setMatches(matchesRes.data || []);

      // 참석 인원 계산
      const counts: Record<string, number> = {};
      (votesRes.data || []).forEach((vote: { match_id: string; status: string }) => {
        if (vote.status === 'attending' || vote.status === 'late') {
          counts[vote.match_id] = (counts[vote.match_id] || 0) + 1;
        }
      });
      setAttendingCounts(counts);
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  }

  const now = new Date();
  const upcomingMatches = matches.filter(m => {
    const deadline = m.vote_deadline ? new Date(m.vote_deadline) : null;
    if (!deadline) return new Date(m.match_date) > now;
    return deadline > now;
  });
  const completedMatches = matches.filter(m => {
    const deadline = m.vote_deadline ? new Date(m.vote_deadline) : null;
    if (!deadline) return new Date(m.match_date) <= now;
    return deadline <= now;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-500 to-blue-500 shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">⚽ FC실화</h1>
              <p className="text-xs sm:text-sm text-white/90">환영합니다, {user?.name}님</p>
            </div>
            <div className="flex gap-2">
              {user?.is_admin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/20 backdrop-blur text-white rounded-lg hover:bg-white/30 transition text-sm sm:text-base"
                >
                  관리자
                </button>
              )}
              <button
                onClick={() => navigate('/statistics')}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/20 backdrop-blur text-white rounded-lg hover:bg-white/30 transition text-sm sm:text-base"
              >
                통계
              </button>
              <button
                onClick={() => navigate('/notifications')}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/20 backdrop-blur text-white rounded-lg hover:bg-white/30 transition text-sm sm:text-base"
              >
                알림
              </button>
              <button
                onClick={signOut}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-red-500/80 backdrop-blur text-white rounded-lg hover:bg-red-600 transition text-sm sm:text-base"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'list'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📋 리스트
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'calendar'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📅 달력
          </button>
          {isMainAdmin && (
            <button
              onClick={() => setActiveTab('game')}
              className={`px-4 py-2 font-medium transition ${
                activeTab === 'game'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ⚽ 게임
            </button>
          )}
          <button
            onClick={() => setActiveTab('picker')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'picker'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            👆 룰렛
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">로딩중...</p>
          </div>
        ) : activeTab === 'list' ? (
          <>
            {/* Match Sub-Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setMatchTab('upcoming')}
                className={`px-4 py-2 font-medium rounded-lg transition ${
                  matchTab === 'upcoming'
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                예정된 경기
              </button>
              <button
                onClick={() => setMatchTab('past')}
                className={`px-4 py-2 font-medium rounded-lg transition ${
                  matchTab === 'past'
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                지난 경기
              </button>
            </div>

            {/* Upcoming Matches Tab */}
            {matchTab === 'upcoming' && (
              <section>
                {upcomingMatches.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    예정된 경기가 없습니다.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {upcomingMatches.map((match) => (
                      <MatchCard key={match.id} match={match} attendingCount={attendingCounts[match.id] || 0} onClick={() => navigate(`/match/${match.id}`)} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Past Matches Tab */}
            {matchTab === 'past' && (
              <section>
                {completedMatches.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    지난 경기가 없습니다.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    {completedMatches.map((match) => (
                      <CompactMatchCard key={match.id} match={match} attendingCount={attendingCounts[match.id] || 0} onClick={() => navigate(`/match/${match.id}`)} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        ) : activeTab === 'calendar' ? (
          <CalendarView matches={matches} onMatchClick={(id) => navigate(`/match/${id}`)} />
        ) : activeTab === 'game' && isMainAdmin ? (
          <Suspense fallback={<div className="text-center py-12 text-gray-500">게임 로딩 중...</div>}><LiftingGame /></Suspense>
        ) : activeTab === 'picker' ? (
          <Suspense fallback={<div className="text-center py-12 text-gray-500">로딩 중...</div>}><FingerChooser /></Suspense>
        ) : null}
      </main>
    </div>
  );
}

function MatchCard({ match, attendingCount, onClick }: { match: Match; attendingCount: number; onClick: () => void }) {
  const matchDate = new Date(match.match_date);
  const isCompleted = match.status === 'completed';
  const isVotingClosed = match.vote_deadline ? new Date(match.vote_deadline) < new Date() : false;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer overflow-hidden ${
        isCompleted ? 'opacity-75' : ''
      }`}
    >
      <div className={`h-2 ${isCompleted ? 'bg-gray-400' : 'bg-gradient-to-r from-green-400 to-blue-400'}`}></div>

      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex-1">{match.title}</h3>
          {isCompleted && (
            <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full">완료</span>
          )}
        </div>

        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{match.description}</p>

        <div className="space-y-2 text-sm mb-4">
          <div className="flex items-center text-gray-700">
            <span className="mr-2 text-lg">📅</span>
            <span className="text-xs sm:text-sm">
              {format(matchDate, 'yyyy년 M월 d일')} {match.match_start_time ?? 0}시 - {match.match_end_time ?? 0}시
            </span>
          </div>
          {match.vote_deadline && (
            <div className="flex items-center text-gray-500 ml-7">
              <span className="text-xs">
                투표마감 {format(new Date(match.vote_deadline), 'M/d HH:mm')}
                {isVotingClosed && <span className="ml-1 text-red-500">(마감)</span>}
              </span>
            </div>
          )}
          <div className="flex items-center text-gray-700">
            <span className="mr-2 text-lg">📍</span>
            <span className="text-xs sm:text-sm">{match.location}</span>
          </div>
          <div className="flex items-center text-gray-700">
            <span className="mr-2 text-lg">👥</span>
            <span className="text-xs sm:text-sm">최소 {match.min_players}명</span>
            <span className="ml-2 text-xs sm:text-sm font-medium text-blue-600">현재 {attendingCount}명</span>
            {attendingCount >= match.min_players && (
              <span className="ml-1 text-green-600 text-xs">✓</span>
            )}
          </div>
        </div>

        <button className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white py-3 rounded-lg hover:from-green-600 hover:to-blue-600 transition font-medium shadow-md">
          투표하기
        </button>
      </div>
    </div>
  );
}

function CompactMatchCard({ match, attendingCount, onClick }: { match: Match; attendingCount: number; onClick: () => void }) {
  const matchDate = new Date(match.match_date);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow hover:shadow-md transition-all cursor-pointer overflow-hidden border border-gray-100"
    >
      <div className="h-1 bg-gray-300"></div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-gray-800 truncate">{match.title}</h3>
        <div className="mt-1 space-y-0.5 text-xs text-gray-500">
          <p>📅 {format(matchDate, 'M/d')} {match.match_start_time ?? 0}시-{match.match_end_time ?? 0}시</p>
          <p>📍 {match.location}</p>
          <p>👥 {attendingCount}명 참석</p>
        </div>
      </div>
    </div>
  );
}

function CalendarView({ matches, onMatchClick }: { matches: Match[]; onMatchClick: (id: string) => void }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // 첫째 주 시작 요일 맞추기 (일요일 = 0)
  const startDay = monthStart.getDay();
  const emptyDays = Array(startDay).fill(null);

  const getMatchesForDate = (date: Date) => {
    return matches.filter(match => isSameDay(new Date(match.match_date), date));
  };

  const selectedDateMatches = selectedDate ? getMatchesForDate(selectedDate) : [];

  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
      {/* Calendar Header */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          ◀
        </button>
        <h2 className="text-xl font-bold text-gray-900">
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          ▶
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
          <div
            key={day}
            className={`text-center text-sm font-medium py-2 ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {emptyDays.map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square"></div>
        ))}
        {days.map((day) => {
          const dayMatches = getMatchesForDate(day);
          const hasMatch = dayMatches.length > 0;
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          const dayOfWeek = day.getDay();

          return (
            <button
              key={day.toString()}
              onClick={() => setSelectedDate(day)}
              className={`aspect-square p-1 rounded-lg transition relative ${
                isSelected
                  ? 'bg-green-500 text-white'
                  : isToday
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100'
              } ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''}`}
            >
              <span className={`text-sm ${isSelected ? 'text-white' : ''}`}>
                {format(day, 'd')}
              </span>
              {hasMatch && (
                <div className={`absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5`}>
                  {dayMatches.slice(0, 3).map((m, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-white' :
                        m.status === 'upcoming' ? 'bg-green-500' :
                        m.status === 'completed' ? 'bg-gray-400' : 'bg-red-500'
                      }`}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Date Matches */}
      {selectedDate && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="font-bold text-gray-900 mb-3">
            {format(selectedDate, 'M월 d일 (EEE)', { locale: ko })} 경기
          </h3>
          {selectedDateMatches.length === 0 ? (
            <p className="text-gray-500 text-sm">이 날짜에 경기가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {selectedDateMatches.map((match) => (
                <div
                  key={match.id}
                  onClick={() => onMatchClick(match.id)}
                  className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-gray-900">{match.title}</h4>
                      <p className="text-sm text-gray-600">
                        {match.match_start_time ?? 0}시 - {match.match_end_time ?? 0}시 | {match.location}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      match.status === 'upcoming' ? 'bg-green-100 text-green-700' :
                      match.status === 'completed' ? 'bg-gray-200 text-gray-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {match.status === 'upcoming' ? '예정' :
                       match.status === 'completed' ? '완료' : '취소'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 버전 표시 */}
      <div className="text-right mt-4">
        <span className="text-xs text-gray-400">v1.5.0</span>
      </div>
    </div>
  );
}
