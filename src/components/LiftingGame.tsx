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
  const [ballY, setBallY] = useState(50);
  const [ballRotation, setBallRotation] = useState(0);
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [myHighScore, setMyHighScore] = useState(0);
  const [isKicking, setIsKicking] = useState(false);
  const [lastKickSuccess, setLastKickSuccess] = useState<'none' | 'good' | 'perfect'>('none');
  const gameLoopRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const ballVelocityRef = useRef(0);

  // 게임 물리 상수 - 더 현실적인 중력
  const BASE_GRAVITY = 800; // 픽셀/초² (지구 중력 느낌)
  const KICK_POWER = -420; // 차는 힘
  const HIT_ZONE_START = 72;
  const HIT_ZONE_END = 88;
  const PERFECT_ZONE_START = 78;
  const PERFECT_ZONE_END = 84;

  // 난이도 - 점수에 따라 중력 증가
  const getDifficulty = useCallback(() => {
    const level = Math.floor(score / 5);
    return {
      gravity: BASE_GRAVITY + (level * 80), // 5점마다 중력 증가
      kickPower: KICK_POWER - (level * 20), // 차는 힘도 증가
    };
  }, [score]);

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

  const gameLoop = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }

    const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
    lastTimeRef.current = timestamp;

    const { gravity } = getDifficulty();

    setBallY(prevY => {
      const newVelocity = ballVelocityRef.current + gravity * deltaTime;
      ballVelocityRef.current = newVelocity;
      
      // 공 회전 (속도에 비례)
      setBallRotation(prev => prev + newVelocity * deltaTime * 0.5);

      const newY = prevY + newVelocity * deltaTime * 0.15;

      if (newY >= 100) {
        setGameState('gameover');
        saveHighScore();
        return 100;
      }

      if (newY < 5) {
        ballVelocityRef.current = Math.abs(ballVelocityRef.current) * 0.3;
        return 5;
      }

      return newY;
    });

    if (gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameState, getDifficulty]);

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
    ballVelocityRef.current = 0;
        setBallRotation(0);
    setScore(0);
    setLastKickSuccess('none');
  }

  function handleKick() {
    if (gameState !== 'playing') return;

    // 킥 애니메이션
    setIsKicking(true);
    setTimeout(() => setIsKicking(false), 150);

    if (ballY >= HIT_ZONE_START && ballY <= HIT_ZONE_END) {
      const isPerfect = ballY >= PERFECT_ZONE_START && ballY <= PERFECT_ZONE_END;
      const points = isPerfect ? 2 : 1;
      const { kickPower } = getDifficulty();

      setScore(prev => prev + points);
      setLastKickSuccess(isPerfect ? 'perfect' : 'good');
      setTimeout(() => setLastKickSuccess('none'), 300);

      ballVelocityRef.current = kickPower;
          } else {
      setGameState('gameover');
      saveHighScore();
    }
  }

  const currentLevel = Math.floor(score / 5) + 1;

  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">⚽ 리프팅 게임</h2>

      {/* 난이도 표시 */}
      <div className="text-center mb-2">
        <span className="text-sm text-gray-500">레벨 {currentLevel}</span>
        <div className="w-32 mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-red-500 transition-all"
            style={{ width: `${Math.min((score % 5) * 20, 100)}%` }}
          />
        </div>
      </div>

      {/* 게임 영역 */}
      <div
        className="relative mx-auto rounded-xl overflow-hidden select-none"
        style={{
          width: '100%',
          maxWidth: '300px',
          height: '450px',
          background: 'linear-gradient(180deg, #87CEEB 0%, #87CEEB 60%, #228B22 60%, #228B22 100%)'
        }}
        onClick={handleKick}
        onTouchStart={(e) => { e.preventDefault(); handleKick(); }}
      >
        {/* 하늘 구름 */}
        <div className="absolute top-8 left-4 w-16 h-6 bg-white rounded-full opacity-80" />
        <div className="absolute top-12 left-8 w-10 h-4 bg-white rounded-full opacity-80" />
        <div className="absolute top-6 right-8 w-12 h-5 bg-white rounded-full opacity-80" />

        {/* 점수 표시 */}
        <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full text-xl font-bold">
          {score}
        </div>

        {/* 최고기록 */}
        <div className="absolute top-4 right-4 bg-yellow-500/90 text-white px-3 py-1 rounded-full text-sm font-bold">
          최고: {myHighScore}
        </div>

        {/* 피드백 텍스트 */}
        {lastKickSuccess !== 'none' && (
          <div className={`absolute top-16 left-1/2 -translate-x-1/2 font-bold text-xl animate-bounce ${
            lastKickSuccess === 'perfect' ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {lastKickSuccess === 'perfect' ? 'PERFECT! +2' : 'GOOD! +1'}
          </div>
        )}

        {/* 히트존 가이드 (반투명) */}
        <div
          className="absolute left-0 right-0 border-t border-b border-dashed border-white/30"
          style={{
            top: `${HIT_ZONE_START}%`,
            height: `${HIT_ZONE_END - HIT_ZONE_START}%`
          }}
        />

        {/* 축구공 - SVG로 더 현실적으로 */}
        <div
          className="absolute left-1/2 w-14 h-14 transition-transform"
          style={{
            top: `${ballY}%`,
            transform: `translateX(-50%) translateY(-50%) rotate(${ballRotation}deg)`,
          }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
            {/* 공 배경 */}
            <circle cx="50" cy="50" r="48" fill="white" stroke="#333" strokeWidth="2"/>
            {/* 오각형 패턴 */}
            <path d="M50 15 L65 35 L58 55 L42 55 L35 35 Z" fill="#333"/>
            <path d="M20 40 L35 35 L42 55 L30 70 L15 55 Z" fill="#333"/>
            <path d="M80 40 L85 55 L70 70 L58 55 L65 35 Z" fill="#333"/>
            <path d="M30 70 L42 55 L58 55 L70 70 L60 85 L40 85 Z" fill="#333"/>
            {/* 하이라이트 */}
            <ellipse cx="35" cy="30" rx="8" ry="5" fill="white" opacity="0.5"/>
          </svg>
        </div>

        {/* 캐릭터 */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          style={{ width: '120px', height: '180px' }}
        >
          {/* 몸통 (유니폼) */}
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-14 h-16 bg-gradient-to-b from-red-500 to-red-600 rounded-t-lg">
            {/* 등번호 */}
            <div className="text-white text-center font-bold text-lg pt-2">10</div>
          </div>

          {/* 머리 */}
          <div className="absolute bottom-36 left-1/2 -translate-x-1/2 w-10 h-10 bg-amber-200 rounded-full">
            {/* 머리카락 */}
            <div className="absolute -top-1 left-1 right-1 h-4 bg-gray-800 rounded-t-full" />
            {/* 눈 */}
            <div className="absolute top-4 left-2 w-1.5 h-1.5 bg-black rounded-full" />
            <div className="absolute top-4 right-2 w-1.5 h-1.5 bg-black rounded-full" />
          </div>

          {/* 팔 */}
          <div className="absolute bottom-28 left-2 w-3 h-10 bg-red-500 rounded-full transform -rotate-12" />
          <div className="absolute bottom-28 right-2 w-3 h-10 bg-red-500 rounded-full transform rotate-12" />

          {/* 반바지 */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-12 h-8 bg-white rounded-b-lg" />

          {/* 왼쪽 다리 (고정) */}
          <div className="absolute bottom-0 left-6">
            <div className="w-4 h-12 bg-amber-200 rounded" /> {/* 다리 */}
            <div className="absolute bottom-0 w-6 h-3 bg-black rounded" /> {/* 신발 */}
          </div>

          {/* 오른쪽 다리 (리프팅하는 다리) */}
          <div
            className={`absolute right-4 origin-top transition-transform duration-150 ${
              isKicking ? '-rotate-45' : 'rotate-0'
            }`}
            style={{ bottom: isKicking ? '20px' : '0px' }}
          >
            <div className="w-4 h-12 bg-amber-200 rounded" /> {/* 다리 */}
            <div
              className={`absolute w-7 h-3 bg-black rounded transition-transform ${
                isKicking ? 'rotate-45' : ''
              }`}
              style={{ bottom: 0, left: isKicking ? '-4px' : '0' }}
            /> {/* 신발 */}
          </div>
        </div>

        {/* 잔디 디테일 */}
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-green-800/30" />

        {/* 게임 시작 오버레이 */}
        {gameState === 'ready' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white">
            <div className="text-6xl mb-4">⚽</div>
            <p className="text-lg mb-1">공이 발에 닿을 때</p>
            <p className="text-lg mb-4">화면을 터치!</p>
            <p className="text-sm text-yellow-300 mb-4">점수가 올라갈수록 빨라져요!</p>
            <button
              onClick={(e) => { e.stopPropagation(); startGame(); }}
              className="px-8 py-3 bg-green-500 rounded-full text-xl font-bold hover:bg-green-600 transition active:scale-95"
            >
              시작하기
            </button>
          </div>
        )}

        {/* 게임오버 오버레이 */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white">
            <p className="text-2xl font-bold mb-2">게임 오버!</p>
            <p className="text-5xl font-bold text-yellow-400 mb-1">{score}점</p>
            <p className="text-gray-300 mb-2">레벨 {currentLevel} 도달</p>
            {score > 0 && score >= myHighScore && (
              <p className="text-green-400 text-lg mb-4 animate-pulse">🎉 최고기록 달성!</p>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); startGame(); }}
              className="px-8 py-3 bg-green-500 rounded-full text-xl font-bold hover:bg-green-600 transition active:scale-95"
            >
              다시하기
            </button>
          </div>
        )}
      </div>

      {/* 조작 안내 */}
      <p className="text-center text-gray-500 text-sm mt-4">
        화면을 터치하여 리프팅! 타이밍이 중요해요
      </p>

      {/* 랭킹 */}
      <div className="mt-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3">🏆 랭킹</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {highScores.length === 0 ? (
            <p className="text-gray-500 text-center py-4">아직 기록이 없습니다</p>
          ) : (
            highScores.slice(0, 10).map((hs, index) => (
              <div
                key={hs.user_id}
                className={`flex justify-between items-center p-3 rounded-lg ${
                  hs.user_id === user?.id ? 'bg-green-100 border border-green-300' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${
                    index === 0 ? 'text-yellow-500' :
                    index === 1 ? 'text-gray-400' :
                    index === 2 ? 'text-orange-400' : 'text-gray-500'
                  }`}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}위`}
                  </span>
                  <span className="text-gray-800 font-medium">{hs.user_name}</span>
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
