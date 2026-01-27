import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase';
import { shareMatchToKakao } from '../lib/kakao';
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

      const matchData = matchRes.data;
      const votesData = votesRes.data || [];

      // 투표 마감 시 자동 상태 변경
      if (matchData && matchData.status === 'upcoming' && matchData.vote_deadline) {
        const deadline = new Date(matchData.vote_deadline);
        if (deadline < new Date()) {
          const attendCount = votesData.filter(v => v.status === 'attending' || v.status === 'late').length;
          const newStatus = attendCount >= matchData.min_players ? 'completed' : 'cancelled';

          // 상태 업데이트
          await db.updateMatch(matchData.id, { status: newStatus });
          matchData.status = newStatus;
        }
      }

      setMatch(matchData);
      setVotes(votesData);
      setComments(commentsRes.data || []);

      // Check if user already voted
      const existingVote = votesData.find(v => v.user_id === user?.id);
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
        if (error) {
          console.error('Error updating vote:', error);
          alert(`투표 업데이트 중 오류가 발생했습니다: ${error.message}`);
          return;
        }
        setUserVote(data);
      } else {
        // Create new vote
        const { data, error } = await db.createVote({
          match_id: match.id,
          user_id: user.id,
          status,
          note: voteNote,
        });
        if (error) {
          console.error('Error creating vote:', error);
          alert(`투표 생성 중 오류가 발생했습니다: ${error.message}`);
          return;
        }
        setUserVote(data);
      }

      // Reload votes
      loadMatchData();
    } catch (error: any) {
      console.error('Error voting:', error);
      alert(`투표 중 오류가 발생했습니다: ${error?.message || '알 수 없는 오류'}`);
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

      if (error) {
        console.error('Error posting comment:', error);
        alert(`댓글 작성 중 오류가 발생했습니다: ${error.message}`);
        return;
      }
      setCommentText('');
      loadMatchData();
    } catch (error: any) {
      console.error('Error posting comment:', error);
      alert(`댓글 작성 중 오류가 발생했습니다: ${error?.message || '알 수 없는 오류'}`);
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

  const attendingCount = votes.filter(v => v.status === 'attending' || v.status === 'late').length;

  // 투표 마감 여부 체크
  const isVotingClosed = match.vote_deadline
    ? new Date(match.vote_deadline) < new Date()
    : false;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-green-500 to-blue-500 shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4">
          <button
            onClick={() => navigate('/')}
            className="text-white hover:text-white/80 mb-2 flex items-center text-sm sm:text-base"
          >
            ← 돌아가기
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{match.title}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Match Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start gap-3 mb-4">
            <p className="text-gray-700 flex-1">{match.description}</p>
            <button
              onClick={() => shareMatchToKakao(match)}
              className="flex-shrink-0 w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2 bg-[#FEE500] text-[#3C1E1E] rounded-full sm:rounded-lg hover:bg-[#FDD835] active:scale-95 transition-all font-medium flex items-center justify-center gap-2 shadow-md"
              title="카카오톡으로 공유하기"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3C6.48 3 2 6.58 2 11c0 2.8 1.8 5.27 4.5 6.7-.2.77-.7 2.8-.8 3.2-.13.5.18.5.38.36.16-.1 2.46-1.67 3.46-2.36.48.06.97.1 1.46.1 5.52 0 10-3.58 10-8 0-4.42-4.48-8-10-8z"/>
              </svg>
              <span className="hidden sm:inline text-sm font-semibold">공유</span>
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center text-gray-700">
              <span className="mr-2">📅</span>
              <span>{format(new Date(match.match_date), 'yyyy년 M월 d일')} {match.match_start_time ?? 0}시 - {match.match_end_time ?? 0}시</span>
            </div>
            <div className="flex items-center text-gray-700">
              <span className="mr-2">📍</span>
              <span>{match.location}</span>
            </div>
            <div className="flex items-center text-gray-700">
              <span className="mr-2">👥</span>
              <span>최소 {match.min_players}명 (현재 {attendingCount}명 참석)</span>
              {attendingCount >= match.min_players && (
                <span className="ml-2 text-green-600 font-medium">✓ 성립</span>
              )}
            </div>
            {match.vote_deadline && (
              <div className="flex items-center text-gray-700">
                <span className="mr-2">⏰</span>
                <span>
                  투표 마감: {format(new Date(match.vote_deadline), 'M월 d일 HH:mm')}
                  {isVotingClosed && <span className="ml-2 text-red-500 font-medium">(마감됨)</span>}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Vote Section */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">참석 여부 투표</h2>
            {isVotingClosed && (
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                투표 마감
              </span>
            )}
          </div>

          {isVotingClosed ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <p className="text-gray-500 mb-2">투표가 마감되었습니다.</p>
              <p className="text-sm text-gray-400">
                {attendingCount >= match.min_players
                  ? `✅ 최소 인원(${match.min_players}명) 충족 - 경기 진행`
                  : `❌ 최소 인원(${match.min_players}명) 미달 - 경기 취소`}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {VOTE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleVote(option.value)}
                    className={`p-4 sm:p-5 rounded-xl border-2 transition-all ${
                      userVote?.status === option.value
                        ? `${option.color} text-white border-transparent shadow-lg scale-105`
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <div className="text-3xl sm:text-4xl mb-2">{option.emoji}</div>
                    <div className="font-bold text-sm sm:text-base">{option.label}</div>
                  </button>
                ))}
              </div>

              <textarea
                value={voteNote}
                onChange={(e) => setVoteNote(e.target.value)}
                placeholder="메모 (선택사항)"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                rows={2}
              />
            </>
          )}
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
          
          <div className="flex flex-row gap-2 mb-6">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="댓글을 입력하세요..."
              className="flex-1 min-w-0 px-3 sm:px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm sm:text-base"
              onKeyPress={(e) => e.key === 'Enter' && handleComment()}
            />
            <button
              onClick={handleComment}
              className="flex-shrink-0 px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 active:scale-95 transition-all font-medium text-sm shadow-md whitespace-nowrap"
            >
              작성
            </button>
          </div>

          <div className="space-y-4">
            {comments.map((comment) => {
              // 댓글 작성자의 투표 상태 찾기
              const authorVote = votes.find(v => v.user_id === comment.user_id);
              const borderColor = authorVote
                ? authorVote.status === 'attending' ? 'border-green-500'
                : authorVote.status === 'not_attending' ? 'border-red-500'
                : authorVote.status === 'maybe' ? 'border-yellow-500'
                : authorVote.status === 'late' ? 'border-orange-500'
                : 'border-gray-300'
                : 'border-gray-300';

              return (
                <div key={comment.id} className={`border-l-4 ${borderColor} pl-4 py-2`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-gray-900">{comment.user?.name}</span>
                    <span className="text-sm text-gray-500">
                      {format(new Date(comment.created_at), 'M월 d일 HH:mm')}
                    </span>
                  </div>
                  <p className="text-gray-700">{comment.content}</p>
                </div>
              );
            })}
            
            {comments.length === 0 && (
              <p className="text-center text-gray-500 py-8">아직 댓글이 없습니다.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
