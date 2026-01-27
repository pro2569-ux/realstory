import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase';
import { Match } from '../types';
import { format } from 'date-fns';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/');
      return;
    }
    loadMatches();
  }, [user, navigate]);

  async function loadMatches() {
    const { data } = await db.getMatches();
    setMatches(data || []);
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  제목
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  날짜
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  장소
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {matches.map((match) => (
                <tr key={match.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{match.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {format(new Date(match.match_date), 'yyyy-MM-dd')} {match.match_start_time ?? 0}시 - {match.match_end_time ?? 0}시
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{match.location}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      match.status === 'upcoming' ? 'bg-green-100 text-green-800' :
                      match.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {match.status === 'upcoming' ? '예정' : 
                       match.status === 'completed' ? '완료' : '취소'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(match)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(match.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function MatchForm({ match, onClose }: { match: Match | null; onClose: () => void }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: match?.title || '',
    description: match?.description || '',
    match_date: match?.match_date ? format(new Date(match.match_date), 'yyyy-MM-dd') : '',
    match_start_time: match?.match_start_time ?? 19,
    match_end_time: match?.match_end_time ?? 21,
    vote_deadline: match?.vote_deadline ? format(new Date(match.vote_deadline), "yyyy-MM-dd'T'HH:mm") : '',
    location: match?.location || '',
    max_players: match?.max_players || 12,
    status: match?.status || 'upcoming',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      // 날짜를 ISO 형식으로 변환
      const matchData = {
        ...formData,
        match_date: new Date(formData.match_date + 'T00:00:00').toISOString(),
        vote_deadline: formData.vote_deadline ? new Date(formData.vote_deadline).toISOString() : null,
      };

      let result;
      if (match) {
        result = await db.updateMatch(match.id, matchData);
      } else {
        result = await db.createMatch({
          ...matchData,
          created_by: user?.id,
        });
      }

      if (result.error) {
        console.error('Error saving match:', result.error);
        alert(`저장 중 오류가 발생했습니다: ${result.error.message}`);
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              제목
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              경기 날짜
            </label>
            <input
              type="date"
              value={formData.match_date}
              onChange={(e) => setFormData({ ...formData, match_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              투표 마감일시
            </label>
            <input
              type="datetime-local"
              value={formData.vote_deadline}
              onChange={(e) => setFormData({ ...formData, vote_deadline: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">설정하지 않으면 투표 마감 없음</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시작 시간
              </label>
              <select
                value={formData.match_start_time}
                onChange={(e) => setFormData({ ...formData, match_start_time: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i}시
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료 시간
              </label>
              <select
                value={formData.match_end_time}
                onChange={(e) => setFormData({ ...formData, match_end_time: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i}시
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              장소
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              최대 인원
            </label>
            <input
              type="number"
              value={formData.max_players}
              onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              min="1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상태
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
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
