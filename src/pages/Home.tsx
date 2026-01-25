import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase';
import { Match } from '../types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

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
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">⚽ FC실화</h1>
              <p className="text-sm text-gray-500">환영합니다, {user?.name}님</p>
            </div>
            <div className="flex gap-3">
              {user?.is_admin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  관리자
                </button>
              )}
              <button
                onClick={() => navigate('/notifications')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                알림
              </button>
              <button
                onClick={signOut}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
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
      className={`bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer p-6 ${
        isCompleted ? 'opacity-75' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-bold text-gray-900">{match.title}</h3>
        {isCompleted && (
          <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">완료</span>
        )}
      </div>
      
      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{match.description}</p>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-center text-gray-700">
          <span className="mr-2">📅</span>
          <span>{format(matchDate, 'yyyy년 M월 d일 (E) HH:mm', { locale: ko })}</span>
        </div>
        <div className="flex items-center text-gray-700">
          <span className="mr-2">📍</span>
          <span>{match.location}</span>
        </div>
        <div className="flex items-center text-gray-700">
          <span className="mr-2">👥</span>
          <span>최대 {match.max_players}명</span>
        </div>
      </div>

      <button className="mt-4 w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition">
        투표하기
      </button>
    </div>
  );
}
