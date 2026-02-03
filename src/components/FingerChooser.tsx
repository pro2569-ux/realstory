import { useState, useRef, useEffect, useCallback } from 'react';

interface TouchPoint {
  id: number;
  x: number;
  y: number;
  color: string;
}

const COLORS = [
  '#FF6B6B', // 빨강
  '#4ECDC4', // 청록
  '#FFE66D', // 노랑
  '#95E1D3', // 민트
  '#F38181', // 코랄
  '#AA96DA', // 보라
  '#FF9F43', // 주황
  '#5C7AEA', // 파랑
  '#2ECC71', // 초록
  '#E056FD', // 분홍
];

type GamePhase = 'select' | 'waiting' | 'spinning' | 'result';

export default function FingerChooser() {
  const [phase, setPhase] = useState<GamePhase>('select');
  const [requiredPlayers, setRequiredPlayers] = useState(2);
  const [touches, setTouches] = useState<TouchPoint[]>([]);
  const [spinAngle, setSpinAngle] = useState(0);
  const [winner, setWinner] = useState<TouchPoint | null>(null);
  const [countdown, setCountdown] = useState(3);
  const containerRef = useRef<HTMLDivElement>(null);
  const spinIntervalRef = useRef<number>();
  const countdownRef = useRef<number>();

  // 터치 이벤트 핸들러
  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (phase !== 'waiting' && phase !== 'spinning') return;

    const newTouches: TouchPoint[] = [];
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      newTouches.push({
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        color: COLORS[i % COLORS.length],
      });
    }
    setTouches(newTouches);
  }, [phase]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (phase !== 'waiting' && phase !== 'spinning') return;

    const newTouches: TouchPoint[] = [];
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      newTouches.push({
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        color: COLORS[i % COLORS.length],
      });
    }
    setTouches(newTouches);
  }, [phase]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (phase === 'result') return;

    // 남은 터치 업데이트
    const newTouches: TouchPoint[] = [];
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      newTouches.push({
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        color: COLORS[i % COLORS.length],
      });
    }
    setTouches(newTouches);

    // 스피닝 중에 손을 떼면 리셋
    if (phase === 'spinning' && newTouches.length < requiredPlayers) {
      clearInterval(spinIntervalRef.current);
      clearTimeout(countdownRef.current);
      setPhase('waiting');
      setCountdown(3);
    }
  }, [phase, requiredPlayers]);

  // 터치 이벤트 등록
  useEffect(() => {
    const container = containerRef.current;
    if (!container || phase === 'select' || phase === 'result') return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [phase, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // 필요한 인원이 모이면 스피닝 시작
  useEffect(() => {
    if (phase === 'waiting' && touches.length >= requiredPlayers) {
      setPhase('spinning');
      setCountdown(3);

      // 스피닝 애니메이션
      spinIntervalRef.current = window.setInterval(() => {
        setSpinAngle(prev => prev + 15);
      }, 50);

      // 카운트다운
      let count = 3;
      const countdownTick = () => {
        count--;
        setCountdown(count);
        if (count > 0) {
          countdownRef.current = window.setTimeout(countdownTick, 1000);
        } else {
          // 당첨자 선정
          clearInterval(spinIntervalRef.current);
          const winnerIndex = Math.floor(Math.random() * requiredPlayers);
          setWinner(touches[winnerIndex]);
          setPhase('result');
        }
      };
      countdownRef.current = window.setTimeout(countdownTick, 1000);
    }
  }, [phase, touches.length, requiredPlayers, touches]);

  // 인원 미달 시 스피닝 중단
  useEffect(() => {
    if (phase === 'spinning' && touches.length < requiredPlayers) {
      clearInterval(spinIntervalRef.current);
      clearTimeout(countdownRef.current);
      setPhase('waiting');
      setCountdown(3);
    }
  }, [phase, touches.length, requiredPlayers]);

  // 게임 시작
  function startGame() {
    setPhase('waiting');
    setTouches([]);
    setWinner(null);
    setSpinAngle(0);
    setCountdown(3);
  }

  // 리셋
  function resetGame() {
    clearInterval(spinIntervalRef.current);
    clearTimeout(countdownRef.current);
    setPhase('select');
    setTouches([]);
    setWinner(null);
    setSpinAngle(0);
    setCountdown(3);
  }

  // 인원 선택 화면
  if (phase === 'select') {
    return (
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl shadow-lg p-6 min-h-[500px] flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-white mb-2">손가락 룰렛</h2>
        <p className="text-white/80 mb-8">참여할 인원을 선택하세요</p>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
            <button
              key={num}
              onClick={() => setRequiredPlayers(num)}
              className={`w-16 h-16 rounded-xl text-2xl font-bold transition-all ${
                requiredPlayers === num
                  ? 'bg-white text-purple-600 scale-110 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {num}
            </button>
          ))}
        </div>

        <button
          onClick={startGame}
          className="px-8 py-4 bg-white text-purple-600 rounded-full text-xl font-bold shadow-lg hover:scale-105 transition-all active:scale-95"
        >
          시작하기
        </button>

        <p className="text-white/60 text-sm mt-6">
          {requiredPlayers}명이 동시에 화면을 터치하면 시작됩니다
        </p>
      </div>
    );
  }

  // 결과 화면
  if (phase === 'result' && winner) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center"
        style={{ backgroundColor: winner.color }}
        onClick={resetGame}
      >
        <div className="text-white text-center animate-bounce">
          <div className="text-8xl mb-4">🎉</div>
          <div className="text-4xl font-bold mb-2">당첨!</div>
          <p className="text-xl opacity-80">화면을 터치하여 다시하기</p>
        </div>

        {/* 당첨자 위치에 표시 */}
        <div
          className="absolute w-24 h-24 rounded-full border-4 border-white flex items-center justify-center animate-pulse"
          style={{
            left: winner.x - 48,
            top: winner.y - 48,
            backgroundColor: 'rgba(255,255,255,0.3)',
          }}
        >
          <span className="text-4xl">👆</span>
        </div>
      </div>
    );
  }

  // 대기/스피닝 화면
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center select-none"
      style={{ touchAction: 'none' }}
    >
      {/* 뒤로가기 버튼 */}
      <button
        onClick={resetGame}
        className="absolute top-4 left-4 z-10 px-4 py-2 bg-white/20 text-white rounded-lg"
      >
        ← 뒤로
      </button>

      {/* 안내 문구 */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center">
        <p className="text-white text-lg font-medium">
          {touches.length} / {requiredPlayers}
        </p>
        {phase === 'waiting' && (
          <p className="text-white/60 text-sm">
            {requiredPlayers}명이 화면을 터치하세요
          </p>
        )}
        {phase === 'spinning' && (
          <p className="text-yellow-400 text-4xl font-bold animate-pulse">
            {countdown}
          </p>
        )}
      </div>

      {/* 터치 포인트들 */}
      {touches.map((touch, index) => (
        <div
          key={touch.id}
          className="absolute pointer-events-none"
          style={{
            left: touch.x,
            top: touch.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* 외곽 회전 링 */}
          <div
            className="absolute w-32 h-32 rounded-full border-8 opacity-50"
            style={{
              borderColor: touch.color,
              transform: `translate(-50%, -50%) rotate(${spinAngle + index * 45}deg)`,
              borderTopColor: 'transparent',
              left: '50%',
              top: '50%',
            }}
          />
          {/* 내부 원 */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
            style={{
              backgroundColor: touch.color,
              boxShadow: `0 0 30px ${touch.color}`,
            }}
          >
            <span className="text-white text-2xl font-bold">{index + 1}</span>
          </div>
          {/* 색상 이름 (스피닝 중에만 빙글빙글) */}
          {phase === 'spinning' && (
            <div
              className="absolute w-40 h-40"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) rotate(${spinAngle * 2}deg)`,
              }}
            >
              {COLORS.slice(0, requiredPlayers).map((color, i) => (
                <div
                  key={i}
                  className="absolute w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: color,
                    left: '50%',
                    top: '50%',
                    transform: `rotate(${(360 / requiredPlayers) * i}deg) translateY(-60px) translate(-50%, -50%)`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* 빈 슬롯 표시 */}
      {touches.length < requiredPlayers && (
        <div className="text-white/30 text-center mt-32">
          <div className="text-6xl mb-4">👆</div>
          <p>화면을 터치하세요</p>
        </div>
      )}
    </div>
  );
}
