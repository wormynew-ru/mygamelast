/**
 * BattleScreen - Main combat UI.
 * Subscribes to WorkoutSession state and displays:
 * - Video feed with skeleton overlay
 * - Player/Monster HP bars
 * - Rep counter and exercise state
 * - Monster sprite with damage animation
 * - Combat controls (pause, surrender)
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkoutSession, SessionStatus } from '../session/WorkoutSession';
import { useGameStore } from '../game/store';
import { MONSTERS } from '../game/data/monsters';
import { useTranslation } from '../i18n/useTranslation';
import { t as translate } from '../i18n';

interface BattleScreenProps {
  session: WorkoutSession;
  onExit: () => void;
}

/**
 * HP Bar component with gradient and animation.
 */
function HPBar({
  current,
  max,
  label,
  color = 'green'
}: {
  current: number;
  max: number;
  label: string;
  color?: 'green' | 'red';
}) {
  const percentage = Math.max(0, (current / max) * 100);
  const barColor = color === 'green'
    ? 'from-green-500 to-green-600'
    : 'from-red-500 to-red-600';

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm font-semibold mb-1">
        <span>{label}</span>
        <span>{current} / {max}</span>
      </div>
      <div className="w-full h-6 bg-gray-700 rounded-full overflow-hidden border-2 border-gray-600">
        <motion.div
          className={`h-full bg-gradient-to-r ${barColor}`}
          initial={{ width: '100%' }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

/**
 * Monster sprite with damage shake animation.
 */
function MonsterSprite({
  sprite,
  name,
  isDamaged
}: {
  sprite: string;
  name: string;
  isDamaged: boolean;
}) {
  return (
    <motion.div
      className="flex flex-col items-center"
      animate={isDamaged ? { x: [-10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      <div className="text-8xl mb-4">{sprite}</div>
      <h2 className="text-2xl font-bold text-white">{name}</h2>
    </motion.div>
  );
}

/**
 * Exercise state indicator with phase colors.
 */
function ExerciseStateIndicator({
  phase,
  repCount
}: {
  phase: string;
  repCount: number;
}) {
  const phaseColors: Record<string, string> = {
    IDLE: 'bg-gray-500',
    DOWN: 'bg-yellow-500',
    UP: 'bg-blue-500',
    TRANSITION: 'bg-green-500',
  };

  const bgColor = phaseColors[phase] || 'bg-gray-500';
  const phaseKey = `phase.${phase}` as const;

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center">
        <div className="text-5xl font-bold text-white mb-2">{repCount}</div>
        <div className="text-sm text-gray-400">{translate('battle.reps')}</div>
      </div>
      <div className="flex flex-col items-center">
        <div className={`w-16 h-16 rounded-full ${bgColor} flex items-center justify-center text-white font-bold text-xs`}>
          {translate(phaseKey)}
        </div>
        <div className="text-xs text-gray-400 mt-1">{translate('battle.phase')}</div>
      </div>
    </div>
  );
}

/**
 * Victory/Defeat overlay.
 */
function BattleEndOverlay({
  result,
  onContinue,
  onRetry
}: {
  result: 'victory' | 'defeat';
  onContinue: () => void;
  onRetry: () => void;
}) {
  const isVictory = result === 'victory';

  return (
    <motion.div
      className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="bg-gray-800 rounded-lg p-8 text-center max-w-md">
        <div className="text-6xl mb-4">{isVictory ? '🎉' : '💀'}</div>
        <h2 className="text-3xl font-bold text-white mb-2">
          {translate(isVictory ? 'battle.victory' : 'battle.defeat')}
        </h2>
        <p className="text-gray-400 mb-6">
          {translate(isVictory ? 'battle.victoryMessage' : 'battle.defeatMessage')}
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
          >
            {translate(isVictory ? 'battle.nextFight' : 'battle.tryAgain')}
          </button>
          <button
            onClick={onContinue}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition"
          >
            {translate('battle.exit')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Main BattleScreen component.
 */
export function BattleScreen({ session, onExit }: BattleScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(session.getStatus());
  const [isDamaged, setIsDamaged] = useState(false);

  const player = useGameStore((state) => state.player);
  const enemy = useGameStore((state) => state.currentEnemy);

  // Subscribe to session state changes
  useEffect(() => {
    const unsubscribe = session.onStateChange((status) => {
      setSessionStatus(status);

      // Trigger damage animation when enemy HP changes
      if (status.currentEnemy && enemy && status.currentEnemy.hp < enemy.hp) {
        setIsDamaged(true);
        setTimeout(() => setIsDamaged(false), 400);
      }
    });

    return unsubscribe;
  }, [session, enemy]);

  const handlePause = () => {
    if (sessionStatus.state === 'ACTIVE') {
      session.pause();
    } else if (sessionStatus.state === 'PAUSED') {
      session.resume();
    }
  };

  const handleSurrender = () => {
    session.stop();
    onExit();
  };

  const handleRetry = () => {
    session.reset();
    // TODO: Start new fight with next monster
  };

  const handleContinue = () => {
    session.stop();
    onExit();
  };

  if (!enemy) {
    return (
      <div className="w-full h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-xl">{translate('battle.noEnemy')}</p>
      </div>
    );
  }

  const monsterTemplate = MONSTERS[enemy.id];
  const monsterNameKey = `monster.${enemy.id}.name` as any;

  return (
    <div className="w-full h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header: HP Bars */}
      <div className="bg-gray-800 p-4 border-b-2 border-gray-700">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          <HPBar
            current={player.hp}
            max={player.maxHp}
            label={`${translate('battle.player')} (${translate('stats.level')} ${player.level})`}
            color="green"
          />
          <HPBar
            current={enemy.hp}
            max={enemy.maxHp}
            label={translate(monsterNameKey)}
            color="red"
          />
        </div>
      </div>

      {/* Main Content: Video + Monster */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Video Feed (2/3 width on desktop) */}
        <div className="flex-1 relative bg-black">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />

          {/* FPS Counter */}
          {sessionStatus.fps && (
            <div className="absolute top-4 left-4 bg-black bg-opacity-60 px-3 py-1 rounded text-white text-sm">
              {sessionStatus.fps} FPS
            </div>
          )}

          {/* Error Message */}
          {sessionStatus.state === 'ERROR' && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-6 py-4 rounded-lg">
              <p className="font-bold">{translate('battle.error')}</p>
              <p className="text-sm">{sessionStatus.errorMessage}</p>
            </div>
          )}
        </div>

        {/* Right Panel: Monster + Stats (1/3 width on desktop) */}
        <div className="w-full md:w-80 bg-gray-800 p-6 flex flex-col items-center justify-center gap-6">
          <MonsterSprite
            sprite={monsterTemplate.sprite}
            name={translate(monsterNameKey)}
            isDamaged={isDamaged}
          />

          {sessionStatus.exerciseState && (
            <ExerciseStateIndicator
              phase={sessionStatus.exerciseState.phase}
              repCount={sessionStatus.exerciseState.repCount}
            />
          )}

          {/* Controls */}
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={handlePause}
              className="w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition"
            >
              {translate(sessionStatus.state === 'PAUSED' ? 'battle.resume' : 'battle.pause')}
            </button>
            <button
              onClick={handleSurrender}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition"
            >
              {translate('battle.surrender')}
            </button>
          </div>
        </div>
      </div>

      {/* Battle End Overlay */}
      <AnimatePresence>
        {(sessionStatus.state === 'VICTORY' || sessionStatus.state === 'DEFEAT') && (
          <BattleEndOverlay
            result={sessionStatus.state === 'VICTORY' ? 'victory' : 'defeat'}
            onContinue={handleContinue}
            onRetry={handleRetry}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
