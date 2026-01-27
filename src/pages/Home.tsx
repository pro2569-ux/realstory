import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase';
import { Match } from '../types';
import { format } from 'date-fns';

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadMatches();
  }, []);

  async function loadMatches() {
    try {
      const { data, error } = await db.getMatches();
      if (error) throw error;
      setMatches(data || []);
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  }

  const upcomingMatches = matches.filter(m => m.status === 'upcoming');
  const completedMatches = matches.filter(m => m.status === 'completed');

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">로딩중...</p>
          </div>
        ) : (
          <>
            {/* Upcoming Matches */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">예정된 경기</h2>
              {upcomingMatches.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  예정된 경기가 없습니다.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {upcomingMatches.map((match) => (
                    <MatchCard key={match.id} match={match} onClick={() => navigate(`/match/${match.id}`)} />
                  ))}
                </div>
              )}
            </section>

            {/* Completed Matches */}
            {completedMatches.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">지난 경기</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {completedMatches.map((match) => (
                    <MatchCard key={match.id} match={match} onClick={() => navigate(`/match/${match.id}`)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function MatchCard({ match, onClick }: { match: Match; onClick: () => void }) {
  const matchDate = new Date(match.match_date);
  const isCompleted = match.status === 'completed';

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
          <div className="flex items-center text-gray-700">
            <span className="mr-2 text-lg">📍</span>
            <span className="text-xs sm:text-sm">{match.location}</span>
          </div>
          <div className="flex items-center text-gray-700">
            <span className="mr-2 text-lg">👥</span>
            <span className="text-xs sm:text-sm">최대 {match.max_players}명</span>
          </div>
        </div>

        <button className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white py-3 rounded-lg hover:from-green-600 hover:to-blue-600 transition font-medium shadow-md">
          투표하기
        </button>
      </div>
    </div>
  );
}
