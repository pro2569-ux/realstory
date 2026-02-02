import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase';
import * as THREE from 'three';

interface HighScore {
  user_id: string;
  user_name: string;
  score: number;
}

// ─── 3D 축구공 ───
function SoccerBall({ positionY, rotation }: { positionY: number; rotation: number }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.y = positionY;
      meshRef.current.rotation.x = rotation * 0.02;
      meshRef.current.rotation.z = rotation * 0.015;
    }
  });

  // 축구공 패턴 텍스처를 절차적으로 생성
  const ballTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // 흰색 배경
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);

    // 검정 오각형 패턴
    ctx.fillStyle = '#1a1a1a';
    const pentagons = [
      [128, 40, 30], [40, 100, 28], [216, 100, 28],
      [70, 200, 28], [186, 200, 28], [128, 140, 32],
    ];
    for (const [cx, cy, r] of pentagons) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }

    // 선 패턴
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.5;
    const lines: [number, number, number, number][] = [
      [128, 70, 40, 100], [128, 70, 216, 100], [40, 100, 70, 200],
      [216, 100, 186, 200], [70, 200, 186, 200], [128, 172, 70, 200],
      [128, 172, 186, 200], [128, 172, 40, 100], [128, 172, 216, 100],
    ];
    for (const [x1, y1, x2, y2] of lines) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);

  return (
    <mesh ref={meshRef} castShadow position={[0.3, positionY, 0]}>
      <sphereGeometry args={[0.35, 32, 32]} />
      <meshStandardMaterial map={ballTexture} roughness={0.4} metalness={0.05} />
    </mesh>
  );
}

// ─── 3D 캐릭터 (심플 로봇 축구선수) ───
function Player({ isKicking }: { isKicking: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);
  const kickLegRef = useRef<THREE.Group>(null!);
  const supportArmRef = useRef<THREE.Group>(null!);
  const kickAngleRef = useRef(0);

  useFrame(() => {
    // 킥 애니메이션 보간
    const target = isKicking ? -1.4 : 0;
    kickAngleRef.current += (target - kickAngleRef.current) * 0.25;

    if (kickLegRef.current) {
      kickLegRef.current.rotation.x = kickAngleRef.current;
    }
    if (supportArmRef.current) {
      supportArmRef.current.rotation.x = isKicking ? 0.5 : 0.15;
    }
  });

  return (
    <group ref={groupRef} position={[-0.8, -0.2, 0.4]}>
      {/* 머리 */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#f4c078" roughness={0.8} />
      </mesh>
      {/* 머리카락 */}
      <mesh position={[0, 1.7, -0.02]}>
        <sphereGeometry args={[0.19, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#2d1b00" roughness={0.9} />
      </mesh>
      {/* 눈 */}
      <mesh position={[0.08, 1.57, 0.17]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      {/* 몸통 (유니폼) */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.25]} />
        <meshStandardMaterial color="#dc2626" roughness={0.6} />
      </mesh>
      {/* 등번호 10 */}
      <mesh position={[0, 1.18, 0.131]}>
        <planeGeometry args={[0.15, 0.15]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* 왼팔 (뒤쪽, 고정) */}
      <group position={[-0.25, 1.3, 0]} rotation={[0.15, 0, 0.2]}>
        <mesh position={[0, -0.15, 0]}>
          <boxGeometry args={[0.1, 0.3, 0.1]} />
          <meshStandardMaterial color="#dc2626" roughness={0.6} />
        </mesh>
      </group>

      {/* 오른팔 (균형 잡는 팔) */}
      <group ref={supportArmRef} position={[0.25, 1.3, 0]} rotation={[0.15, 0, -0.2]}>
        <mesh position={[0, -0.15, 0]}>
          <boxGeometry args={[0.1, 0.3, 0.1]} />
          <meshStandardMaterial color="#dc2626" roughness={0.6} />
        </mesh>
      </group>

      {/* 반바지 */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[0.38, 0.2, 0.24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>

      {/* 왼다리 (지지 다리) */}
      <group position={[-0.1, 0.65, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <boxGeometry args={[0.12, 0.4, 0.12]} />
          <meshStandardMaterial color="#f4c078" roughness={0.8} />
        </mesh>
        {/* 왼발 (축구화) */}
        <mesh position={[0, -0.45, 0.06]} castShadow>
          <boxGeometry args={[0.13, 0.08, 0.22]} />
          <meshStandardMaterial color="#111" roughness={0.3} />
        </mesh>
      </group>

      {/* 오른다리 (차는 다리) */}
      <group ref={kickLegRef} position={[0.1, 0.65, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <boxGeometry args={[0.12, 0.4, 0.12]} />
          <meshStandardMaterial color="#f4c078" roughness={0.8} />
        </mesh>
        {/* 오른발 (축구화) */}
        <mesh position={[0, -0.45, 0.06]} castShadow>
          <boxGeometry args={[0.13, 0.08, 0.22]} />
          <meshStandardMaterial color="#111" roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

// ─── 잔디 바닥 ───
function Ground() {
  const groundTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // 기본 잔디색
    ctx.fillStyle = '#2d8a2d';
    ctx.fillRect(0, 0, 512, 512);

    // 잔디 패턴 줄무늬
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#349434' : '#2d8a2d';
      ctx.fillRect(0, i * 64, 512, 64);
    }

    // 잔디 디테일
    ctx.strokeStyle = '#3da53d';
    ctx.lineWidth = 1;
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 4, y - Math.random() * 8);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial map={groundTexture} roughness={0.9} />
    </mesh>
  );
}

// ─── 하늘 배경 + 구름 ───
function Sky() {
  return (
    <>
      {/* 하늘 반구 */}
      <mesh position={[0, 0, -8]}>
        <planeGeometry args={[40, 20]} />
        <meshBasicMaterial color="#87CEEB" />
      </mesh>

      {/* 구름들 */}
      {[
        [-3, 4.5, -6], [2, 5, -7], [5, 4, -5],
        [-5, 5.5, -8], [0, 4.8, -6.5],
      ].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <mesh>
            <sphereGeometry args={[0.6, 8, 8]} />
            <meshBasicMaterial color="#fff" transparent opacity={0.9} />
          </mesh>
          <mesh position={[0.5, 0.1, 0]}>
            <sphereGeometry args={[0.45, 8, 8]} />
            <meshBasicMaterial color="#fff" transparent opacity={0.85} />
          </mesh>
          <mesh position={[-0.4, 0.05, 0]}>
            <sphereGeometry args={[0.4, 8, 8]} />
            <meshBasicMaterial color="#fff" transparent opacity={0.85} />
          </mesh>
        </group>
      ))}

      {/* 골대 (배경) */}
      <group position={[0, 1.2, -4]}>
        {/* 좌측 포스트 */}
        <mesh position={[-1.8, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 2.4, 8]} />
          <meshStandardMaterial color="#fff" metalness={0.3} roughness={0.5} />
        </mesh>
        {/* 우측 포스트 */}
        <mesh position={[1.8, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 2.4, 8]} />
          <meshStandardMaterial color="#fff" metalness={0.3} roughness={0.5} />
        </mesh>
        {/* 크로스바 */}
        <mesh position={[0, 1.2, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 3.6, 8]} />
          <meshStandardMaterial color="#fff" metalness={0.3} roughness={0.5} />
        </mesh>
        {/* 네트 (반투명 면) */}
        <mesh position={[0, 0, -0.5]}>
          <planeGeometry args={[3.6, 2.4]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </>
  );
}

// ─── 3D 씬 ───
function GameScene({
  ballY,
  ballRotation,
  isKicking,
}: {
  ballY: number;
  ballRotation: number;
  isKicking: boolean;
}) {
  // ballY: 0~100 (퍼센트) → 3D Y좌표로 변환 (높으면 위로)
  const y3d = ((100 - ballY) / 100) * 5 - 0.2;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-3, 4, -2]} intensity={0.3} />

      <Sky />
      <Ground />
      <SoccerBall positionY={y3d} rotation={ballRotation} />
      <Player isKicking={isKicking} />
    </>
  );
}

// ─── 메인 게임 컴포넌트 ───
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
  const [comboCount, setComboCount] = useState(0);
  const gameLoopRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const ballVelocityRef = useRef(0);
  const scoreRef = useRef(0);

  const BASE_GRAVITY = 800;
  const KICK_POWER = -420;
  const HIT_ZONE_START = 72;
  const HIT_ZONE_END = 88;
  const PERFECT_ZONE_START = 78;
  const PERFECT_ZONE_END = 84;

  const getDifficulty = useCallback(() => {
    const level = Math.floor(scoreRef.current / 5);
    return {
      gravity: BASE_GRAVITY + level * 80,
      kickPower: KICK_POWER - level * 20,
    };
  }, []);

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

  const gameLoop = useCallback(
    (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const { gravity } = getDifficulty();

      setBallY((prevY) => {
        const newVelocity = ballVelocityRef.current + gravity * deltaTime;
        ballVelocityRef.current = newVelocity;

        setBallRotation((prev) => prev + newVelocity * deltaTime * 0.5);

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
    },
    [gameState, getDifficulty]
  );

  useEffect(() => {
    if (gameState === 'playing') {
      lastTimeRef.current = 0;
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, gameLoop]);

  async function saveHighScore() {
    if (scoreRef.current > myHighScore && user) {
      try {
        await db.saveHighScore(user.id, scoreRef.current);
        setMyHighScore(scoreRef.current);
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
    scoreRef.current = 0;
    setComboCount(0);
    setLastKickSuccess('none');
  }

  function handleKick() {
    if (gameState !== 'playing') return;

    setIsKicking(true);
    setTimeout(() => setIsKicking(false), 150);

    if (ballY >= HIT_ZONE_START && ballY <= HIT_ZONE_END) {
      const isPerfect = ballY >= PERFECT_ZONE_START && ballY <= PERFECT_ZONE_END;
      const newCombo = comboCount + 1;
      setComboCount(newCombo);

      const comboBonus = newCombo >= 10 ? 3 : newCombo >= 5 ? 2 : 1;
      const points = (isPerfect ? 2 : 1) * comboBonus;
      const { kickPower } = getDifficulty();

      setScore((prev) => {
        const newScore = prev + points;
        scoreRef.current = newScore;
        return newScore;
      });
      setLastKickSuccess(isPerfect ? 'perfect' : 'good');
      setTimeout(() => setLastKickSuccess('none'), 500);

      ballVelocityRef.current = kickPower;
    } else {
      setComboCount(0);
      setGameState('gameover');
      saveHighScore();
    }
  }

  const currentLevel = Math.floor(score / 5) + 1;

  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
        ⚽ 리프팅 게임
      </h2>

      {/* 레벨 & 콤보 */}
      <div className="text-center mb-2 flex justify-center gap-4 items-center">
        <div>
          <span className="text-sm text-gray-500">레벨 {currentLevel}</span>
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-red-500 transition-all"
              style={{ width: `${Math.min((score % 5) * 20, 100)}%` }}
            />
          </div>
        </div>
        {comboCount >= 3 && gameState === 'playing' && (
          <span className="text-sm font-bold text-orange-500 animate-pulse">
            {comboCount}x COMBO!
          </span>
        )}
      </div>

      {/* 3D 게임 영역 */}
      <div
        className="relative mx-auto rounded-xl overflow-hidden select-none"
        style={{ width: '100%', maxWidth: '350px', height: '480px' }}
        onClick={handleKick}
        onTouchStart={(e) => {
          e.preventDefault();
          handleKick();
        }}
      >
        <Canvas
          shadows
          camera={{ position: [0, 2, 5.5], fov: 45, near: 0.1, far: 50 }}
          style={{ background: 'linear-gradient(180deg, #87CEEB 0%, #b0d8f0 100%)' }}
        >
          <GameScene
            ballY={ballY}
            ballRotation={ballRotation}
            isKicking={isKicking}
          />
        </Canvas>

        {/* HUD 오버레이 */}
        <div className="absolute top-3 left-3 bg-black/60 text-white px-3 py-1 rounded-full text-xl font-bold">
          {score}
        </div>
        <div className="absolute top-3 right-3 bg-yellow-500/90 text-white px-3 py-1 rounded-full text-sm font-bold">
          최고: {myHighScore}
        </div>

        {/* 피드백 */}
        {lastKickSuccess !== 'none' && (
          <div
            className={`absolute top-14 left-1/2 -translate-x-1/2 font-bold text-2xl animate-bounce drop-shadow-lg ${
              lastKickSuccess === 'perfect'
                ? 'text-yellow-300'
                : 'text-green-300'
            }`}
          >
            {lastKickSuccess === 'perfect' ? 'PERFECT!' : 'GOOD!'}
            {comboCount >= 5 && (
              <span className="block text-sm text-orange-300">
                x{comboCount} COMBO
              </span>
            )}
          </div>
        )}

        {/* 시작 오버레이 */}
        {gameState === 'ready' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm">
            <div className="text-6xl mb-4">⚽</div>
            <p className="text-lg mb-1">공이 발에 닿을 때</p>
            <p className="text-lg mb-2">화면을 터치!</p>
            <p className="text-sm text-yellow-300 mb-1">
              PERFECT 타이밍 = 2배 점수
            </p>
            <p className="text-sm text-orange-300 mb-4">
              콤보 5x = 2배, 10x = 3배!
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                startGame();
              }}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full text-xl font-bold hover:from-green-600 hover:to-emerald-700 transition active:scale-95 shadow-lg"
            >
              시작하기
            </button>
          </div>
        )}

        {/* 게임오버 오버레이 */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm">
            <p className="text-2xl font-bold mb-2">게임 오버!</p>
            <p className="text-5xl font-bold text-yellow-400 mb-1">
              {score}점
            </p>
            <p className="text-gray-300 mb-1">레벨 {currentLevel} 도달</p>
            {comboCount > 0 && (
              <p className="text-orange-300 text-sm mb-2">
                최대 {comboCount}x 콤보
              </p>
            )}
            {score > 0 && score >= myHighScore && (
              <p className="text-green-400 text-lg mb-3 animate-pulse">
                🎉 최고기록 달성!
              </p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                startGame();
              }}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full text-xl font-bold hover:from-green-600 hover:to-emerald-700 transition active:scale-95 shadow-lg"
            >
              다시하기
            </button>
          </div>
        )}
      </div>

      <p className="text-center text-gray-500 text-sm mt-4">
        화면을 터치하여 리프팅! 타이밍이 중요해요
      </p>

      {/* 랭킹 */}
      <div className="mt-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3">🏆 랭킹</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {highScores.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              아직 기록이 없습니다
            </p>
          ) : (
            highScores.slice(0, 10).map((hs, index) => (
              <div
                key={hs.user_id}
                className={`flex justify-between items-center p-3 rounded-lg ${
                  hs.user_id === user?.id
                    ? 'bg-green-100 border border-green-300'
                    : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-lg font-bold ${
                      index === 0
                        ? 'text-yellow-500'
                        : index === 1
                        ? 'text-gray-400'
                        : index === 2
                        ? 'text-orange-400'
                        : 'text-gray-500'
                    }`}
                  >
                    {index === 0
                      ? '🥇'
                      : index === 1
                      ? '🥈'
                      : index === 2
                      ? '🥉'
                      : `${index + 1}위`}
                  </span>
                  <span className="text-gray-800 font-medium">
                    {hs.user_name}
                  </span>
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
