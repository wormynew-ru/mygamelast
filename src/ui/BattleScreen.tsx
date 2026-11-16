/**
 * BattleScreen - Main combat arena UI supporting Campaign, Endless Survival, and Circuit Dungeons.
 * Mounts live camera video/canvas and binds a WorkoutSession instance.
 * ZERO direct imports from PoseTracker, CombatEngine, or SoundFX.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2,
  Pause,
  Play,
  LogOut,
  Shield,
  Trophy,
  AlertTriangle,
  Zap,
  Coins,
  Skull,
  Flame,
  Dumbbell,
  Sparkles,
} from 'lucide-react';
import {
  createWorkoutSessionForBattle,
  type BattleMode,
  type WorkoutSession,
  type SessionStatus,
} from '../session/WorkoutSession';
import { useGameStore, selectEffectivePlayerStats } from '../game/store';
import { createEndlessWaveMonster, createMonster, MONSTERS } from '../game/data/monsters';
import { getCircuitById, type CircuitId } from '../game/data/circuits';
import { EXERCISES, type ExerciseId } from '../game/data/exercises';
import { getLevelById } from '../game/data/levels';
import { ITEMS } from '../game/data/items';
import { type AchievementId } from '../game/data/achievements';
import type { BattleRank, WeedId } from '../game/types';
import { useTranslation, type TranslationKey } from '../i18n/useTranslation';
import {
  ACHIEVEMENT_KEYS,
  ARCHETYPE_KEYS,
  CIRCUIT_KEYS,
  EXERCISE_NAME_KEYS,
  ITEM_NAME_KEYS,
  MONSTER_NAME_KEYS,
} from './gameKeys';
import { VoiceToggleButton, useVoiceCommandHandler } from './VoiceControl';

interface BattleScreenProps {
  levelId?: string;
  exerciseId: ExerciseId;
  mode?: BattleMode;
  initialWave?: number;
  circuitId?: CircuitId;
  gardenPlotId?: number;
  weedId?: WeedId;
  onExit: () => void;
  onBackToGarden?: () => void;
  onStartNextLevel?: (nextLevelId: string, exerciseId: ExerciseId) => void;
}

const PHASE_KEYS: Record<string, TranslationKey> = {
  IDLE: 'phase.IDLE',
  DOWN: 'phase.DOWN',
  UP: 'phase.UP',
  TRANSITION: 'phase.TRANSITION',
};

const RANK_COLOR_CLASS: Record<BattleRank, string> = {
  S: 'text-amber-400',
  A: 'text-emerald-400',
  B: 'text-sky-400',
  C: 'text-slate-300',
};

function formatHoldDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const HPBar = memo(function HPBar({
  current,
  max,
  label,
  tone,
}: {
  current: number;
  max: number;
  label: string;
  tone: 'player' | 'enemy';
}) {
  const percentage = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const fillClass = tone === 'player' ? 'bg-emerald-500' : 'bg-red-500';

  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline text-sm font-semibold mb-1.5 gap-2">
        <span className="text-slate-100 truncate">{label}</span>
        <span className="font-numeric text-xs text-slate-300 shrink-0">
          {current} / {max}
        </span>
      </div>
      <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
        <motion.div
          className={`h-full ${fillClass}`}
          initial={false}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
});

export function BattleScreen({
  levelId,
  exerciseId,
  mode = 'CAMPAIGN',
  initialWave = 1,
  circuitId,
  gardenPlotId,
  weedId,
  onExit,
  onBackToGarden,
  onStartNextLevel,
}: BattleScreenProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<WorkoutSession | null>(null);
  const lastCombatEventIdRef = useRef<number>(0);
  const lastAttackEventIdRef = useRef<number>(0);
  const lastCleansedIdRef = useRef<number>(0);
  const damageTimerRef = useRef<number | null>(null);
  const heroHitTimerRef = useRef<number | null>(null);
  const cleanseTimerRef = useRef<number | null>(null);

  const [currentWave, setCurrentWave] = useState<number>(initialWave);
  const [circuitRoomIndex, setCircuitRoomIndex] = useState<number>(0);
  const [activeExerciseId, setActiveExerciseId] = useState<ExerciseId>(exerciseId);
  const [circuitRestSec, setCircuitRestSec] = useState<number | null>(null);
  const [justCleansed, setJustCleansed] = useState<boolean>(false);

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>({
    state: 'STARTING',
    exerciseState: null,
    currentEnemy: useGameStore.getState().currentEnemy,
    autoPauseReason: null,
    isAudioUnlocked: true,
    bossPhase: 0,
    nextAttackProgress: 0,
    monsterAttackIntervalMs: 7000,
    isAttackWarning: false,
    comboCount: 0,
    comboMultiplier: 1,
    comboRemainingRatio: 0,
    ultimateCharge: 0,
    ultimateTriggeredCount: 0,
    matchup: 'NEUTRAL',
    isPlayerDebuffed: false,
    debuffRemainingSec: 0,
    debuffCleansedId: 0,
    lastCombatEvent: null,
    lastMonsterAttackEvent: null,
    victorySummary: null,
    poseDelegate: useGameStore.getState().settings.poseDelegate,
    poseDelegateFallback: false,
  });
  const [isDamaged, setIsDamaged] = useState(false);
  const [isHeroHit, setIsHeroHit] = useState(false);

  const basePlayer = useGameStore((state) => state.player);
  const equippedItems = useGameStore((state) => state.inventory.equippedItems);
  const loadout = useGameStore((state) => state.loadout);
  const enemy = useGameStore((state) => state.currentEnemy);
  const startCombat = useGameStore((state) => state.startCombat);
  const endCombat = useGameStore((state) => state.endCombat);
  const revivePlayer = useGameStore((state) => state.revivePlayer);

  const effectivePlayer = useMemo(
    () => selectEffectivePlayerStats(useGameStore.getState()),
    [basePlayer, equippedItems]
  );

  const circuitDef = circuitId ? getCircuitById(circuitId) : undefined;
  const exerciseDef = EXERCISES[activeExerciseId];
  const levelDef = levelId ? getLevelById(levelId) : undefined;
  const initialEnemyIdRef = useRef<string | undefined>(enemy?.id);
  if (enemy?.id) {
    initialEnemyIdRef.current = enemy.id;
  }
  const initialMonsterId =
    levelDef?.monsterId ?? weedId ?? initialEnemyIdRef.current ?? 'BURGER';

  useEffect(() => {
    setActiveExerciseId(exerciseId);
    setCircuitRoomIndex(0);
    setCircuitRestSec(null);
    setCurrentWave(initialWave);
  }, [exerciseId, levelId, mode, initialWave, circuitId, weedId]);

  useEffect(() => {
    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;
    if (!videoEl || !canvasEl) {
      return undefined;
    }

    let disposed = false;

    const session = createWorkoutSessionForBattle({
      videoElement: videoEl,
      canvasElement: canvasEl,
      exerciseId,
      levelId,
      mode,
      endlessWave: initialWave,
      circuitId,
      circuitRoomIndex: 0,
      gardenPlotId,
    });
    sessionRef.current = session;

    const unsubscribe = session.onStateChange((status) => {
      if (disposed) return;
      setSessionStatus(status);

      if (status.lastCombatEvent && status.lastCombatEvent.id !== lastCombatEventIdRef.current) {
        lastCombatEventIdRef.current = status.lastCombatEvent.id;
        setIsDamaged(true);
        if (damageTimerRef.current !== null) {
          window.clearTimeout(damageTimerRef.current);
        }
        damageTimerRef.current = window.setTimeout(() => {
          setIsDamaged(false);
          damageTimerRef.current = null;
        }, 320);
      }

      if (
        status.lastMonsterAttackEvent &&
        status.lastMonsterAttackEvent.id !== lastAttackEventIdRef.current
      ) {
        lastAttackEventIdRef.current = status.lastMonsterAttackEvent.id;
        setIsHeroHit(true);
        if (heroHitTimerRef.current !== null) {
          window.clearTimeout(heroHitTimerRef.current);
        }
        heroHitTimerRef.current = window.setTimeout(() => {
          setIsHeroHit(false);
          heroHitTimerRef.current = null;
        }, 450);
      }

      if (status.debuffCleansedId > lastCleansedIdRef.current) {
        lastCleansedIdRef.current = status.debuffCleansedId;
        setJustCleansed(true);
        if (cleanseTimerRef.current !== null) {
          window.clearTimeout(cleanseTimerRef.current);
        }
        cleanseTimerRef.current = window.setTimeout(() => {
          setJustCleansed(false);
          cleanseTimerRef.current = null;
        }, 2000);
      }
    });

    void session.start();

    return () => {
      disposed = true;
      if (damageTimerRef.current !== null) {
        window.clearTimeout(damageTimerRef.current);
        damageTimerRef.current = null;
      }
      if (heroHitTimerRef.current !== null) {
        window.clearTimeout(heroHitTimerRef.current);
        heroHitTimerRef.current = null;
      }
      if (cleanseTimerRef.current !== null) {
        window.clearTimeout(cleanseTimerRef.current);
        cleanseTimerRef.current = null;
      }
      unsubscribe();
      session.stop();
      sessionRef.current = null;
    };
  }, [exerciseId, levelId, mode, initialWave, circuitId, gardenPlotId]);

  const handleAdvanceCircuitRoom = useCallback(() => {
    if (!circuitDef) return;
    const nextIndex = circuitRoomIndex + 1;
    const nextRoom = circuitDef.rooms[nextIndex];
    if (!nextRoom) return;

    const template = MONSTERS[nextRoom.monsterId] ?? MONSTERS.BURGER;
    const nextEnemy = createMonster(template);

    setCircuitRestSec(null);
    setCircuitRoomIndex(nextIndex);
    setActiveExerciseId(nextRoom.exerciseId);
    sessionRef.current?.advanceCircuitRoom({
      nextEnemy,
      exerciseId: nextRoom.exerciseId,
      roomIndex: nextIndex,
    });
  }, [circuitDef, circuitRoomIndex]);

  const isBetweenCircuitRooms =
    mode === 'CIRCUIT' &&
    sessionStatus.state === 'VICTORY' &&
    Boolean(sessionStatus.victorySummary && !sessionStatus.victorySummary.circuitCompleted) &&
    Boolean(circuitDef && circuitDef.rooms[circuitRoomIndex + 1]);

  useEffect(() => {
    if (!isBetweenCircuitRooms || !circuitDef) {
      setCircuitRestSec(null);
      return undefined;
    }

    const initialRest = circuitDef.rooms[circuitRoomIndex]?.restAfterSec ?? 5;
    setCircuitRestSec(initialRest);

    const intervalId = window.setInterval(() => {
      setCircuitRestSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isBetweenCircuitRooms, circuitDef, circuitRoomIndex]);

  useEffect(() => {
    if (isBetweenCircuitRooms && circuitRestSec === 0) {
      handleAdvanceCircuitRoom();
    }
  }, [isBetweenCircuitRooms, circuitRestSec, handleAdvanceCircuitRoom]);

  const handlePauseToggle = () => {
    const session = sessionRef.current;
    if (!session) return;

    if (sessionStatus.state === 'ACTIVE') {
      session.pause('USER');
    } else if (sessionStatus.state === 'PAUSED') {
      session.resume();
    }
  };

  const handleSurrender = () => {
    if (useGameStore.getState().player.hp <= 0) {
      revivePlayer();
    }
    sessionRef.current?.stop();
    endCombat();
    if (mode === 'WEED' && onBackToGarden) {
      onBackToGarden();
    } else {
      onExit();
    }
  };

  const handleUnlockAudio = () => {
    void sessionRef.current?.unlockAudio();
  };

  const handleRetry = () => {
    if (useGameStore.getState().player.hp <= 0) {
      revivePlayer();
    }
    if (mode === 'ENDLESS') {
      setCurrentWave(1);
      const freshEnemy = createEndlessWaveMonster(1);
      startCombat(freshEnemy);
      sessionRef.current?.reset(freshEnemy, 1);
      return;
    }
    if (mode === 'CIRCUIT' && circuitDef && circuitDef.rooms[0]) {
      const firstRoom = circuitDef.rooms[0];
      const freshEnemy = createMonster(MONSTERS[firstRoom.monsterId] ?? MONSTERS.BURGER);
      setCircuitRoomIndex(0);
      setActiveExerciseId(firstRoom.exerciseId);
      sessionRef.current?.advanceCircuitRoom({
        nextEnemy: freshEnemy,
        exerciseId: firstRoom.exerciseId,
        roomIndex: 0,
      });
      return;
    }
    const template = MONSTERS[initialMonsterId] ?? MONSTERS.BURGER;
    const freshEnemy = createMonster(template);
    startCombat(freshEnemy);
    sessionRef.current?.reset(freshEnemy);
  };

  const handleNextEndlessWave = () => {
    const nextWave = currentWave + 1;
    setCurrentWave(nextWave);
    const nextEnemy = createEndlessWaveMonster(nextWave);
    startCombat(nextEnemy);
    sessionRef.current?.reset(nextEnemy, nextWave);
  };

  const handleNextFight = () => {
    if (mode === 'ENDLESS') {
      handleNextEndlessWave();
      return;
    }
    if (levelDef?.nextLevelId && onStartNextLevel) {
      const nextLevel = getLevelById(levelDef.nextLevelId);
      if (nextLevel) {
        onStartNextLevel(nextLevel.id, nextLevel.recommendedExercise);
        return;
      }
    }
    handleRetry();
  };

  const displayEnemy = enemy ?? sessionStatus.currentEnemy;
  const enemyId = displayEnemy?.id ?? initialMonsterId;
  const monsterTemplate = MONSTERS[enemyId] ?? MONSTERS.BURGER;
  const monsterName = MONSTER_NAME_KEYS[enemyId]
    ? t(MONSTER_NAME_KEYS[enemyId])
    : monsterTemplate.name;

  const exerciseState = sessionStatus.exerciseState;
  const visibility = exerciseState?.visibility ?? 'VISIBLE';
  const phaseKey = PHASE_KEYS[exerciseState?.phase ?? 'IDLE'] ?? 'phase.IDLE';

  const nextLevel = levelDef?.nextLevelId ? getLevelById(levelDef.nextLevelId) : undefined;
  const canAdvance =
    sessionStatus.state === 'VICTORY' &&
    (mode === 'ENDLESS' || (mode === 'CAMPAIGN' && Boolean(nextLevel && onStartNextLevel)));

  const attackTimerPercent = Math.round(
    Math.max(0, Math.min(1, sessionStatus.nextAttackProgress)) * 100
  );
  const secondsUntilAttack = Math.max(
    0,
    ((1 - sessionStatus.nextAttackProgress) * sessionStatus.monsterAttackIntervalMs) / 1000
  ).toFixed(1);
  const isWarningActive = sessionStatus.state === 'ACTIVE' && sessionStatus.isAttackWarning;
  const comboPercent = Math.round(
    Math.max(0, Math.min(1, sessionStatus.comboRemainingRatio)) * 100
  );
  const ultimatePercent = Math.round(Math.max(0, Math.min(100, sessionStatus.ultimateCharge)));
  const showLoadoutBadge =
    loadout.mode === 'DUMBBELLS' && loadout.weightKg > 0 && exerciseDef.supportsDumbbellWeight;

  const nextCircuitRoom = circuitDef?.rooms[circuitRoomIndex + 1];

  useVoiceCommandHandler((cmd) => {
    switch (cmd.type) {
      case 'PAUSE':
        if (sessionStatus.state === 'ACTIVE') {
          sessionRef.current?.pause('USER');
        }
        return true;
      case 'RESUME':
        if (sessionStatus.state === 'PAUSED') {
          sessionRef.current?.resume();
        }
        return true;
      case 'NEXT':
        if (isBetweenCircuitRooms) {
          handleAdvanceCircuitRoom();
        } else if (mode === 'WEED' && sessionStatus.state === 'VICTORY') {
          handleSurrender();
        } else if (sessionStatus.state === 'VICTORY' && canAdvance) {
          handleNextFight();
        } else if (sessionStatus.state === 'PAUSED') {
          sessionRef.current?.resume();
        }
        return true;
      case 'RETRY':
        if (sessionStatus.state === 'VICTORY' || sessionStatus.state === 'DEFEAT') {
          handleRetry();
        }
        return true;
      case 'EXIT':
        handleSurrender();
        return true;
      case 'SOUND_UNLOCK':
        handleUnlockAudio();
        return true;
      default:
        // Block unintended navigation commands while in an active battle
        return true;
    }
  });

  return (
    <div className="w-full h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Header: HP Bars */}
      <header
        className={`bg-slate-900 border-b transition-colors px-6 py-3.5 shrink-0 ${
          isHeroHit || isWarningActive ? 'border-red-500/80' : 'border-slate-800'
        }`}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          <HPBar
            current={effectivePlayer.hp}
            max={effectivePlayer.maxHp}
            label={`${t('battle.player')} · ${t('stats.level')} ${basePlayer.level}`}
            tone="player"
          />
          <HPBar
            current={displayEnemy?.hp ?? 0}
            max={displayEnemy?.maxHp ?? monsterTemplate.maxHp}
            label={
              mode === 'ENDLESS'
                ? `${t('battle.waveLabel')} ${currentWave} · ${monsterName}`
                : mode === 'CIRCUIT' && circuitDef
                  ? `${t(CIRCUIT_KEYS[circuitDef.id].name)} (${circuitRoomIndex + 1}/${circuitDef.rooms.length}) · ${monsterName}`
                  : mode === 'WEED' && typeof gardenPlotId === 'number'
                    ? `${t('battle.weedModeBadge')} #${gardenPlotId + 1} · ${monsterName}`
                    : monsterName
            }
            tone="enemy"
          />
        </div>
      </header>

      {/* Arena Split */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Camera + Skeleton Canvas */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          <video ref={videoRef} className="hidden" playsInline muted autoPlay />
          <canvas ref={canvasRef} className="w-full h-full object-contain" />

          {/* Top-left Exercise, Loadout, Matchup & FPS Info */}
          <div className="absolute top-4 left-4 bg-slate-950/85 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-200 flex flex-wrap items-center gap-2">
            {mode === 'CIRCUIT' && circuitDef && (
              <>
                <span className="font-numeric font-semibold text-amber-400">
                  {t('battle.roomLabel')} {circuitRoomIndex + 1}/{circuitDef.rooms.length}
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span className="font-semibold">{t(EXERCISE_NAME_KEYS[activeExerciseId])}</span>
            {showLoadoutBadge && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-amber-300 font-numeric font-semibold">
                  <Dumbbell className="w-3.5 h-3.5" />
                  <span>
                    ×{loadout.weightKg} {t('loadout.kgUnit')}
                  </span>
                </span>
              </>
            )}
            {sessionStatus.matchup === 'WEAK' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 font-semibold">{t('battle.matchupWeak')}</span>
              </>
            )}
            {sessionStatus.matchup === 'RESISTANT' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-400">{t('battle.matchupResistant')}</span>
              </>
            )}
            {typeof sessionStatus.fps === 'number' && sessionStatus.fps > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-numeric text-slate-400">
                  {sessionStatus.fps} {t('battle.fps')}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span
              className={`font-numeric font-semibold ${
                sessionStatus.poseDelegateFallback
                  ? 'text-amber-400'
                  : sessionStatus.poseDelegate === 'GPU'
                    ? 'text-emerald-400'
                    : 'text-sky-400'
              }`}
            >
              {sessionStatus.poseDelegateFallback
                ? t('battle.delegateFallback')
                : sessionStatus.poseDelegate}
            </span>
          </div>

          {/* Audio Unlock Banner */}
          {!sessionStatus.isAudioUnlocked && (
            <button
              onClick={handleUnlockAudio}
              className="absolute top-4 right-4 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              <Volume2 className="w-4 h-4" />
              <span>{t('battle.tapToEnableSound')}</span>
            </button>
          )}

          {/* Visibility Warning Scrim */}
          {sessionStatus.state === 'ACTIVE' && visibility !== 'VISIBLE' && (
            <div className="absolute bottom-4 left-4 right-4 max-w-xl mx-auto bg-amber-500/95 text-slate-950 px-4 py-2.5 rounded-lg text-center text-sm font-semibold">
              {visibility === 'NOT_VISIBLE'
                ? t('battle.visibilityNone')
                : t('battle.visibilityLow')}
            </div>
          )}

          {/* Starting / Loading Overlay */}
          {sessionStatus.state === 'STARTING' && (
            <div className="absolute inset-0 bg-slate-950/85 flex items-center justify-center p-6 z-10">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-slate-200 font-medium">{t('battle.starting')}</p>
              </div>
            </div>
          )}

          {/* Paused Overlay */}
          {sessionStatus.state === 'PAUSED' && (
            <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center p-6 z-10">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full text-center space-y-4">
                <h3 className="text-xl font-bold text-white">{t('battle.paused')}</h3>
                {sessionStatus.autoPauseReason === 'LOW_VISIBILITY' && (
                  <p className="text-xs text-amber-400">{t('battle.autoPausedVisibility')}</p>
                )}
                {sessionStatus.autoPauseReason === 'TAB_HIDDEN' && (
                  <p className="text-xs text-amber-400">{t('battle.autoPausedTab')}</p>
                )}
                <button
                  onClick={handlePauseToggle}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
                >
                  {t('battle.resume')}
                </button>
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {sessionStatus.state === 'ERROR' && (
            <div className="absolute inset-0 bg-slate-950/90 flex items-center justify-center p-6 z-20">
              <div className="bg-slate-900 border border-red-800 rounded-xl p-6 max-w-md w-full text-center space-y-3">
                <h3 className="text-lg font-bold text-red-400">{t('battle.error')}</h3>
                <p className="text-sm text-slate-300">
                  {sessionStatus.errorMessage || t('error.unknown')}
                </p>
                <button
                  onClick={handleSurrender}
                  className="mt-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {t(mode === 'WEED' ? 'battle.backToGarden' : 'battle.exit')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Combat HUD Panel */}
        <aside className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-5 flex flex-col justify-between gap-4 shrink-0 overflow-y-auto">
          {/* Monster Sprite + Archetype + Shield + Attack Timer */}
          <div className="flex flex-col items-center text-center pt-1 space-y-2.5">
            {sessionStatus.bossPhase > 0 && (
              <div className="text-xs font-semibold text-red-400">
                {t('battle.bossEnrage')} {sessionStatus.bossPhase}
              </div>
            )}

            <motion.div
              animate={
                isDamaged
                  ? { x: [-8, 8, -6, 6, 0], scale: [1, 0.94, 1] }
                  : isWarningActive
                    ? { scale: [1, 1.12, 1.04], rotate: [0, -5, 5, 0] }
                    : { scale: 1, rotate: 0, x: 0 }
              }
              transition={
                isDamaged
                  ? { duration: 0.25 }
                  : isWarningActive
                    ? { duration: 0.45, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 0.2 }
              }
              className="text-6xl select-none"
            >
              {monsterTemplate.sprite}
            </motion.div>

            <div>
              <h2 className="text-lg font-bold text-white">{monsterName}</h2>
              {displayEnemy?.archetype && (
                <div className="text-xs text-amber-400 font-medium">
                  {t(ARCHETYPE_KEYS[displayEnemy.archetype])}
                </div>
              )}
            </div>

            {/* Enemy Shield Bar */}
            {typeof displayEnemy?.shieldHits === 'number' && displayEnemy.shieldHits > 0 && (
              <div className="w-full bg-sky-950/40 border border-sky-700/60 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs font-semibold text-sky-300">
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>{t('battle.shield')}</span>
                </span>
                <span className="font-numeric">
                  {displayEnemy.shieldHits} / {displayEnemy.maxShieldHits ?? displayEnemy.shieldHits}
                </span>
              </div>
            )}

            {/* Enemy Counter-Attack Bar */}
            <div
              className={`w-full rounded-lg p-3 space-y-1.5 border transition-colors ${
                isWarningActive
                  ? 'bg-red-950/35 border-red-500/80'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="flex justify-between items-center text-xs gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 font-medium truncate ${
                    isWarningActive ? 'text-red-300 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {isWarningActive && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  <span className="truncate">
                    {isWarningActive ? t('battle.attackIncoming') : t('battle.enemyAttackTimer')}
                  </span>
                </span>
                <span
                  className={`font-numeric font-semibold shrink-0 ${
                    isWarningActive ? 'text-red-400' : 'text-amber-400'
                  }`}
                >
                  {secondsUntilAttack}s
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-150 ${
                    isWarningActive ? 'bg-red-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${attackTimerPercent}%` }}
                />
              </div>
              {isWarningActive && exerciseDef.trackingType === 'hold' && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-sky-300 font-medium pt-0.5">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('battle.holdBlockHint')}</span>
                </div>
              )}
            </div>

            {/* Active Toxic Debuff Warning */}
            {sessionStatus.isPlayerDebuffed && (
              <div className="w-full bg-purple-950/40 border border-purple-700/60 rounded-lg px-3 py-1.5 space-y-0.5 text-xs font-semibold text-purple-300">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5">
                    <Skull className="w-3.5 h-3.5" />
                    <span>{t('battle.toxicDebuff')}</span>
                  </span>
                  <span className="font-numeric">{sessionStatus.debuffRemainingSec}s</span>
                </div>
                {exerciseDef.trackingType === 'hold' && (
                  <div className="text-[11px] font-medium text-sky-300">
                    {t('battle.holdCleanseHint')}
                  </div>
                )}
              </div>
            )}

            {/* Damage / Block / Cleanse Popups */}
            <div className="min-h-[24px] flex flex-col items-center gap-1">
              {justCleansed && (
                <div className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('battle.toxicCleansed')}</span>
                </div>
              )}

              <AnimatePresence mode="wait">
                {sessionStatus.lastCombatEvent && (
                  <motion.div
                    key={sessionStatus.lastCombatEvent.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className={`font-numeric text-sm font-bold ${
                      sessionStatus.lastCombatEvent.wasUltimate
                        ? 'text-fuchsia-300'
                        : sessionStatus.lastCombatEvent.wasCritical
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    -{sessionStatus.lastCombatEvent.damage} HP
                    {sessionStatus.lastCombatEvent.wasUltimate
                      ? ` · ${t('battle.ultimateOverdrive')}`
                      : ''}
                    {sessionStatus.lastCombatEvent.wasCritical
                      ? ` · ${t('battle.criticalHit')}`
                      : ''}
                    {sessionStatus.lastCombatEvent.shieldBroken
                      ? ` · ${t('battle.shieldBroken')}`
                      : ''}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {sessionStatus.lastMonsterAttackEvent && (
                  <motion.div
                    key={sessionStatus.lastMonsterAttackEvent.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold font-numeric ${
                      sessionStatus.lastMonsterAttackEvent.wasBlocked
                        ? 'text-sky-400'
                        : 'text-red-400'
                    }`}
                  >
                    {sessionStatus.lastMonsterAttackEvent.wasBlocked && (
                      <Shield className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {sessionStatus.lastMonsterAttackEvent.wasBlocked
                        ? `${t('battle.blocked')} (-${sessionStatus.lastMonsterAttackEvent.damageTaken} HP)`
                        : `${t('battle.incomingDamage')}: -${sessionStatus.lastMonsterAttackEvent.damageTaken} HP`}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Tempo Combo + Ultimate Charge + Exercise Telemetry */}
          <div className="space-y-2.5">
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 space-y-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-numeric">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-amber-400">
                    <Zap className="w-3.5 h-3.5" />
                    <span>
                      {t('battle.combo')}: {sessionStatus.comboCount}
                    </span>
                  </span>
                  <span className="font-bold text-white">
                    ×{sessionStatus.comboMultiplier.toFixed(2).replace(/\.00$/, '')}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-[width] duration-100"
                    style={{ width: `${comboPercent}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1 border-t border-slate-900">
                <div className="flex items-center justify-between text-xs font-numeric">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-fuchsia-400">
                    <Flame className="w-3.5 h-3.5" />
                    <span>{t('battle.ultimate')}</span>
                  </span>
                  <span className="font-bold text-fuchsia-200">{ultimatePercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-fuchsia-500 transition-[width] duration-150"
                    style={{ width: `${ultimatePercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              {exerciseDef.trackingType === 'hold' ? (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-400">{t('battle.holdTime')}</div>
                    <div className="font-numeric text-3xl font-bold text-white mt-0.5">
                      {formatHoldDuration(exerciseState?.holdDurationMs ?? 0)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">{t('battle.phase')}</div>
                    <div
                      className={`text-sm font-semibold mt-1 ${
                        exerciseState?.isHolding ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {exerciseState?.isHolding ? t('battle.holding') : t('battle.notHolding')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-400">{t('battle.reps')}</div>
                    <div className="font-numeric text-4xl font-bold text-white mt-0.5">
                      {exerciseState?.repCount ?? 0}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">{t('battle.phase')}</div>
                    <div className="text-sm font-semibold text-amber-400 mt-1">
                      {t(phaseKey)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Battle Controls */}
          <div className="flex flex-col gap-2">
            <VoiceToggleButton className="w-full" />

            <button
              onClick={handlePauseToggle}
              disabled={sessionStatus.state !== 'ACTIVE' && sessionStatus.state !== 'PAUSED'}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-semibold text-sm rounded-lg transition-colors whitespace-nowrap"
            >
              {sessionStatus.state === 'PAUSED' ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
              <span>
                {sessionStatus.state === 'PAUSED' ? t('battle.resume') : t('battle.pause')}
              </span>
            </button>

            <button
              onClick={handleSurrender}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-lg transition-colors whitespace-nowrap"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('battle.surrender')}</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Victory / Defeat / Circuit Room Transition Modal */}
      <AnimatePresence>
        {(sessionStatus.state === 'VICTORY' || sessionStatus.state === 'DEFEAT') && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {isBetweenCircuitRooms && nextCircuitRoom ? (
              <div className="bg-slate-900 border border-amber-500/50 rounded-xl p-7 max-w-md w-full text-center space-y-5">
                <div className="text-4xl" aria-hidden="true">
                  {EXERCISES[nextCircuitRoom.exerciseId].icon}
                </div>
                <div>
                  <div className="font-numeric text-xs font-semibold text-amber-400 mb-1">
                    {t('battle.roomLabel')} {circuitRoomIndex + 1}/{circuitDef?.rooms.length}
                  </div>
                  <h2 className="font-display text-2xl font-bold text-white">
                    {t('battle.nextRoomReady')}
                  </h2>
                  <p className="text-sm text-slate-300 mt-2">
                    {t('battle.nextRoomExercise')}:{' '}
                    <span className="font-semibold text-emerald-400">
                      {t(EXERCISE_NAME_KEYS[nextCircuitRoom.exerciseId])}
                    </span>
                  </p>
                </div>

                {circuitRestSec !== null && (
                  <div className="bg-slate-950 border border-slate-800 rounded-lg py-3 px-4">
                    <div className="text-xs text-slate-400">{t('battle.nextRoomIn')}</div>
                    <div className="font-numeric text-3xl font-bold text-amber-400 mt-1">
                      {circuitRestSec}s
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleAdvanceCircuitRoom}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-lg transition-colors whitespace-nowrap"
                  >
                    {t('battle.nextRoomNow')}
                  </button>
                  <button
                    onClick={handleSurrender}
                    className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-lg transition-colors whitespace-nowrap"
                  >
                    {t('battle.exit')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-7 max-w-md w-full text-center space-y-5">
                <div className="text-5xl" aria-hidden="true">
                  {sessionStatus.state === 'VICTORY' ? '🏆' : '💀'}
                </div>

                <div>
                  {sessionStatus.victorySummary?.circuitCompleted && (
                    <div className="text-xs font-bold text-amber-400 mb-1">
                      {t('battle.circuitCleared')}
                    </div>
                  )}
                  <h2 className="font-display text-3xl font-bold text-white">
                    {t(sessionStatus.state === 'VICTORY' ? 'battle.victory' : 'battle.defeat')}
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {t(
                      sessionStatus.state === 'VICTORY'
                        ? 'battle.victoryMessage'
                        : 'battle.defeatMessage'
                    )}
                  </p>
                  {sessionStatus.state === 'DEFEAT' && (
                    <p className="text-xs text-amber-400 mt-2">{t('battle.hpRecoveredHint')}</p>
                  )}
                </div>

                {sessionStatus.state === 'VICTORY' && sessionStatus.victorySummary && (
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                      <span className="text-slate-400">{t('battle.rankLabel')}</span>
                      <span
                        className={`font-display text-2xl font-bold ${
                          RANK_COLOR_CLASS[sessionStatus.victorySummary.rank]
                        }`}
                      >
                        {sessionStatus.victorySummary.rank}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">{t('battle.xpGained')}</span>
                      <span className="font-numeric font-semibold text-amber-400">
                        +{sessionStatus.victorySummary.xpGained} XP
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">{t('battle.coinsEarned')}</span>
                      <span className="inline-flex items-center gap-1 font-numeric font-semibold text-amber-400">
                        <Coins className="w-3.5 h-3.5" />
                        <span>+{sessionStatus.victorySummary.coinsEarned}</span>
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">{t('battle.maxComboLabel')}</span>
                      <span className="font-numeric font-semibold text-white">
                        x{sessionStatus.victorySummary.maxCombo}
                      </span>
                    </div>

                    {sessionStatus.victorySummary.tonnageKg > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t('battle.tonnageEarned')}</span>
                        <span className="font-numeric font-semibold text-amber-300">
                          {sessionStatus.victorySummary.tonnageKg} {t('loadout.kgUnit')}
                        </span>
                      </div>
                    )}

                    {sessionStatus.victorySummary.estimatedKcal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t('battle.caloriesEst')}</span>
                        <span className="font-numeric text-slate-200">
                          ~{sessionStatus.victorySummary.estimatedKcal} {t('battle.kcalUnit')}
                        </span>
                      </div>
                    )}

                    {sessionStatus.victorySummary.leveledUp && (
                      <div className="text-emerald-400 font-semibold">
                        {t('battle.levelUp')} ({t('stats.level')} {basePlayer.level})
                      </div>
                    )}

                    {sessionStatus.victorySummary.droppedItemId && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t('battle.itemDropped')}</span>
                        <span className="font-semibold text-white">
                          {ITEM_NAME_KEYS[sessionStatus.victorySummary.droppedItemId]
                            ? t(ITEM_NAME_KEYS[sessionStatus.victorySummary.droppedItemId])
                            : ITEMS[sessionStatus.victorySummary.droppedItemId]?.name}
                        </span>
                      </div>
                    )}

                    {sessionStatus.victorySummary.gardenPlotCleared && (
                      <div className="text-emerald-400 text-xs font-semibold pt-1">
                        {t('battle.weedClearedNote')}
                      </div>
                    )}

                    {sessionStatus.victorySummary.unlockedLevelId && (
                      <div className="text-sky-400 text-xs font-medium pt-1">
                        {t('battle.levelUnlocked')}
                      </div>
                    )}

                    {sessionStatus.victorySummary.newlyUnlockedAchievements.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 text-left space-y-1">
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                          <Trophy className="w-3.5 h-3.5" />
                          <span>{t('battle.achievementsUnlocked')}</span>
                        </div>
                        <ul className="space-y-0.5 text-xs text-slate-200">
                          {sessionStatus.victorySummary.newlyUnlockedAchievements.map((achId) => {
                            const entry = ACHIEVEMENT_KEYS[achId as AchievementId];
                            return <li key={achId}>· {entry ? t(entry.name) : achId}</li>;
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  {mode === 'WEED' && sessionStatus.state === 'VICTORY' ? (
                    <button
                      onClick={handleSurrender}
                      className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-lg transition-colors whitespace-nowrap"
                    >
                      {t('battle.backToGarden')}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={canAdvance ? handleNextFight : handleRetry}
                        className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-lg transition-colors whitespace-nowrap"
                      >
                        {t(
                          mode === 'ENDLESS' && sessionStatus.state === 'VICTORY'
                            ? 'battle.nextWave'
                            : canAdvance
                              ? 'battle.nextFight'
                              : 'battle.tryAgain'
                        )}
                      </button>
                      <button
                        onClick={handleSurrender}
                        className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-lg transition-colors whitespace-nowrap"
                      >
                        {t(
                          mode === 'WEED'
                            ? 'battle.backToGarden'
                            : mode === 'ENDLESS' && sessionStatus.state === 'VICTORY'
                              ? 'battle.bankAndExit'
                              : 'battle.exit'
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
