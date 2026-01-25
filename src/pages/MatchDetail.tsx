import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase';
import { Match, Vote, Comment, VoteStatus } from '../types';
import { format } from 'date-fns';

const VOTE_OPTIONS = [
  { value: 'attending' as VoteStatus, label: '참석', emoji: '✅', color: 'bg-green-500' },
  { value: 'not_attending' as VoteStatus, label: '불참', emoji: '❌', color: 'bg-red-500' },
  { value: 'maybe' as VoteStatus, label: '미정', emoji: '❓', color: 'bg-yellow-500' },
  { value: 'late' as VoteStatus, label: '늦게도착', emoji: '⏰', color: 'bg-orange-500' },
];

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [match, setMatch] = useState<Match | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [userVote, setUserVote] = useState<Vote | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [voteNote, setVoteNote] = useState('');

  useEffect(() => {
    if (id) {
      loadMatchData();
    }
  }, [id]);

  async function loadMatchData() {
    try {
      const [matchRes, votesRes, commentsRes] = await Promise.all([
        db.getMatch(id!),
        db.getVotes(id!),
        db.getComments(id!),
      ]);

      if (matchRes.error) throw matchRes.error;
      setMatch(matchRes.data);
      setVotes(votesRes.data || []);
      setComments(commentsRes.data || []);

      // Check if user already voted
      const existingVote = (votesRes.data || []).find(v => v.user_id === user?.id);
      if (existingVote) {
        setUserVote(existingVote);
        setVoteNote(existingVote.note || '');
      }
    } catch (error) {
      console.error('Error loading match data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(status: VoteStatus) {
    if (!user || !match) return;

    try {
      if (userVote) {
        // Update existing vote
        const { data, error } = await db.updateVote(userVote.id, {
          status,
          note: voteNote,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        setUserVote(data);
      } else {
        // Create new vote
        const { data, error } = await db.createVote({
          match_id: match.id,
          user_id: user.id,
          status,
          note: voteNote,
        });
        if (error) throw error;
        setUserVote(data);
      }
      
      // Reload votes
      loadMatchData();
    } catch (error) {
      console.error('Error voting:', error);
      alert('투표 중 오류가 발생했습니다.');
    }
  }

  async function handleComment() {
    if (!user || !match || !commentText.trim()) return;

    try {
      const { error } = await db.createComment({
        match_id: match.id,
        user_id: user.id,
        content: commentText,
      });
      
      if (error) throw error;
      setCommentText('');
      loadMatchData();
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('댓글 작성 중 오류가 발생했습니다.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">경기를 찾을 수 없습니다.</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const voteStats = VOTE_OPTIONS.map(option => ({
    ...option,
    count: votes.filter(v => v.status === option.value).length,
  }));

  const attendingCount = votes.filter(v => v.status === 'attending').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/')}
            className="text-green-600 hover:text-green-700 mb-2"
          >
            ← 돌아가기
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{match.title}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Match Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <p className="text-gray-700 mb-4">{match.description}</p>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center text-gray-700">
              <span className="mr-2">📅</span>
              <span>{format(new Date(match.match_date), 'yyyy년 M월 d일 HH:mm')}</span>
            </div>
            <div className="flex items-center text-gray-700">
              <span className="mr-2">📍</span>
              <span>{match.location}</span>
            </div>
            <div className="flex items-center text-gray-700">
              <span className="mr-2">👥</span>
              <span>최대 {match.max_players}명 (현재 {attendingCount}명 참석)</span>
            </div>
          </div>
        </div>

        {/* Vote Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">참석 여부 투표</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {VOTE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleVote(option.value)}
                className={`p-4 rounded-lg border-2 transition ${
                  userVote?.status === option.value
                    ? `${option.color} text-white border-transparent`
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">{option.emoji}</div>
                <div className="font-medium">{option.label}</div>
              </button>
            ))}
          </div>

          <textarea
            value={voteNote}
            onChange={(e) => setVoteNote(e.target.value)}
            placeholder="메모 (선택사항)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            rows={2}
          />
        </div>

        {/* Vote Statistics */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">투표 현황</h2>
          
          <div className="space-y-3 mb-6">
            {voteStats.map((stat) => (
              <div key={stat.value}>
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-gray-700">
                    {stat.emoji} {stat.label}
                  </span>
                  <span className="text-gray-600">{stat.count}명</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${stat.color} h-2 rounded-full transition-all`}
                    style={{ width: `${votes.length > 0 ? (stat.count / votes.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {votes.map((vote) => (
              <div key={vote.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {VOTE_OPTIONS.find(o => o.value === vote.status)?.emoji}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900">{vote.user?.name}</div>
                    {vote.note && <div className="text-sm text-gray-600">{vote.note}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">댓글</h2>
          
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="댓글을 입력하세요..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && handleComment()}
            />
            <button
              onClick={handleComment}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
            >
              작성
            </button>
          </div>

          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="border-l-4 border-green-500 pl-4 py-2">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-gray-900">{comment.user?.name}</span>
                  <span className="text-sm text-gray-500">
                    {format(new Date(comment.created_at), 'M월 d일 HH:mm')}
                  </span>
                </div>
                <p className="text-gray-700">{comment.content}</p>
              </div>
            ))}
            
            {comments.length === 0 && (
              <p className="text-center text-gray-500 py-8">아직 댓글이 없습니다.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
