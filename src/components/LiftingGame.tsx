import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase';

interface HighScore {
  user_id: string;
  user_name: string;
  score: number;
}

export default function LiftingGame() {
  const { user } = useAuth();
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'gameover'>('ready');
  const [ballY, setBallY] = useState(50); // 공 위치 (0-100%)
  const [ballVelocity, setBallVelocity] = useState(0);
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [myHighScore, setMyHighScore] = useState(0);
  const [hitZone, setHitZone] = useState(false);
  const gameLoopRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const GRAVITY = 120; // 중력 가속도
  const KICK_POWER = -65; // 차는 힘 (위로)
  const HIT_ZONE_START = 75; // 히트존 시작 (%)
  const HIT_ZONE_END = 92; // 히트존 끝 (%)
  const PERFECT_ZONE_START = 82;
  const PERFECT_ZONE_END = 88;

  // 최고 점수 로드
  useEffect(() => {
    loadHighScores();
  }, []);

  async function loadHighScores() {
    try {
      const { data, error } = await db.getHighScores();
      if (!error && data) {
        setHighScores(data);
        const myScore = data.find((s: HighScore) => s.user_id === user?.id);
        if (myScore) setMyHighScore(myScore.score);
      }
    } catch (e) {
      console.error('Error loading high scores:', e);
    }
  }

  // 게임 루프
  const gameLoop = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }

    const deltaTime = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    setBallY(prevY => {
      const newVelocity = ballVelocity + GRAVITY * deltaTime;
      setBallVelocity(newVelocity);

      const newY = prevY + newVelocity * deltaTime;

      // 히트존 체크
      setHitZone(newY >= HIT_ZONE_START && newY <= HIT_ZONE_END);

      // 바닥에 닿으면 게임오버
      if (newY >= 100) {
        setGameState('gameover');
        saveHighScore();
        return 100;
      }

      // 천장 체크
      if (newY < 0) {
        setBallVelocity(Math.abs(newVelocity) * 0.3);
        return 0;
      }

      return newY;
    });

    if (gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [ballVelocity, gameState]);

  useEffect(() => {
    if (gameState === 'playing') {
      lastTimeRef.current = 0;
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);

  async function saveHighScore() {
    if (score > myHighScore && user) {
      try {
        await db.saveHighScore(user.id, score);
        setMyHighScore(score);
        loadHighScores();
      } catch (e) {
        console.error('Error saving high score:', e);
      }
    }
  }

  function startGame() {
    setGameState('playing');
    setBallY(30);
    setBallVelocity(0);
    setScore(0);
  }

  function handleKick() {
    if (gameState !== 'playing') return;

    // 히트존 안에 있을 때만 성공
    if (ballY >= HIT_ZONE_START && ballY <= HIT_ZONE_END) {
      // 퍼펙트존 보너스
      const isPerfect = ballY >= PERFECT_ZONE_START && ballY <= PERFECT_ZONE_END;
      const points = isPerfect ? 2 : 1;

      setScore(prev => prev + points);
      setBallVelocity(KICK_POWER);
    } else {
      // 타이밍 실패 - 게임오버
      setGameState('gameover');
      saveHighScore();
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">⚽ 리프팅 게임</h2>

      {/* 게임 영역 */}
      <div
        className="relative bg-gradient-to-b from-sky-300 to-green-400 rounded-xl overflow-hidden mx-auto"
        style={{ width: '100%', maxWidth: '300px', height: '400px' }}
        onClick={handleKick}
        onTouchStart={(e) => { e.preventDefault(); handleKick(); }}
      >
        {/* 점수 표시 */}
        <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-lg font-bold">
          {score}
        </div>

        {/* 최고기록 */}
        <div className="absolute top-4 right-4 bg-yellow-500/80 text-white px-3 py-1 rounded-full text-sm font-bold">
          최고: {myHighScore}
        </div>

        {/* 히트존 표시 */}
        <div
          className="absolute left-0 right-0 border-t-2 border-b-2 border-dashed border-yellow-400/50"
          style={{
            top: `${HIT_ZONE_START}%`,
            height: `${HIT_ZONE_END - HIT_ZONE_START}%`
          }}
        />

        {/* 퍼펙트존 */}
        <div
          className="absolute left-0 right-0 bg-yellow-400/30"
          style={{
            top: `${PERFECT_ZONE_START}%`,
            height: `${PERFECT_ZONE_END - PERFECT_ZONE_START}%`
          }}
        />

        {/* 공 */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-12 h-12 transition-transform ${hitZone ? 'scale-110' : ''}`}
          style={{ top: `${ballY}%`, transform: `translateX(-50%) translateY(-50%)` }}
        >
          <div className="w-full h-full rounded-full bg-white border-2 border-gray-800 shadow-lg flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border border-gray-400" style={{
              background: 'repeating-conic-gradient(#000 0deg 90deg, #fff 90deg 180deg)'
            }}/>
          </div>
        </div>

        {/* 발 */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-5xl">
          🦶
        </div>

        {/* 게임 시작/종료 오버레이 */}
        {gameState === 'ready' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
            <p className="text-lg mb-2">공이 발에 닿을 때</p>
            <p className="text-lg mb-4">터치하세요!</p>
            <button
              onClick={(e) => { e.stopPropagation(); startGame(); }}
              className="px-8 py-3 bg-green-500 rounded-full text-xl font-bold hover:bg-green-600 transition"
            >
              시작
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
            <p className="text-2xl font-bold mb-2">게임 오버!</p>
            <p className="text-4xl font-bold text-yellow-400 mb-2">{score}점</p>
            {score > 0 && score === myHighScore && (
              <p className="text-green-400 mb-4">🎉 최고기록!</p>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); startGame(); }}
              className="px-8 py-3 bg-green-500 rounded-full text-xl font-bold hover:bg-green-600 transition"
            >
              다시하기
            </button>
          </div>
        )}
      </div>

      {/* 조작 안내 */}
      <p className="text-center text-gray-500 text-sm mt-4">
        화면을 터치하여 리프팅!
      </p>

      {/* 랭킹 */}
      <div className="mt-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3">🏆 랭킹</h3>
        <div className="space-y-2">
          {highScores.length === 0 ? (
            <p className="text-gray-500 text-center py-4">아직 기록이 없습니다</p>
          ) : (
            highScores.slice(0, 10).map((hs, index) => (
              <div
                key={hs.user_id}
                className={`flex justify-between items-center p-2 rounded-lg ${
                  hs.user_id === user?.id ? 'bg-green-100' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${
                    index === 0 ? 'text-yellow-500' :
                    index === 1 ? 'text-gray-400' :
                    index === 2 ? 'text-orange-400' : 'text-gray-600'
                  }`}>
                    {index + 1}위
                  </span>
                  <span className="text-gray-800">{hs.user_name}</span>
                </div>
                <span className="font-bold text-blue-600">{hs.score}점</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
