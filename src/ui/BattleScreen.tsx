/**
 * BattleScreen - Main combat arena UI.
 * Mounts the live camera video/canvas and binds a WorkoutSession instance.
 * ZERO direct imports from PoseTracker, CombatEngine, or SoundFX.
 */

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Pause, Play, LogOut, Shield, Trophy, AlertTriangle } from 'lucide-react';
import {
  createWorkoutSessionForBattle,
  type WorkoutSession,
  type SessionStatus,
} from '../session/WorkoutSession';
import { useGameStore, selectEffectivePlayerStats } from '../game/store';
import { createMonster, MONSTERS } from '../game/data/monsters';
import { EXERCISES, type ExerciseId } from '../game/data/exercises';
import { getLevelById } from '../game/data/levels';
import { ITEMS } from '../game/data/items';
import { type AchievementId } from '../game/data/achievements';
import { useTranslation, type TranslationKey } from '../i18n/useTranslation';

interface BattleScreenProps {
  levelId?: string;
  exerciseId: ExerciseId;
  onExit: () => void;
  onStartNextLevel?: (nextLevelId: string, exerciseId: ExerciseId) => void;
}

const MONSTER_NAME_KEYS: Record<string, TranslationKey> = {
  BURGER: 'monster.BURGER.name',
  PIZZA: 'monster.PIZZA.name',
  SODA: 'monster.SODA.name',
  DONUT: 'monster.DONUT.name',
  BOSS_KING_BURGER: 'monster.BOSS_KING_BURGER.name',
};

const EXERCISE_NAME_KEYS: Record<ExerciseId, TranslationKey> = {
  SQUAT: 'exercise.SQUAT.name',
  PUSH_UP: 'exercise.PUSH_UP.name',
  PLANK: 'exercise.PLANK.name',
  JUMPING_JACK: 'exercise.JUMPING_JACK.name',
};

const ITEM_NAME_KEYS: Record<string, TranslationKey> = {
  PROTEIN_SHAKE: 'item.PROTEIN_SHAKE.name',
  ENERGY_BAR: 'item.ENERGY_BAR.name',
  RUNNING_SHOES: 'item.RUNNING_SHOES.name',
  WEIGHT_BELT: 'item.WEIGHT_BELT.name',
  ARMOR_VEST: 'item.ARMOR_VEST.name',
};

const ACHIEVEMENT_NAME_KEYS: Record<AchievementId, TranslationKey> = {
  FIRST_REP: 'achievement.FIRST_REP.name',
  FIFTY_REPS: 'achievement.FIFTY_REPS.name',
  PLANK_SURVIVOR: 'achievement.PLANK_SURVIVOR.name',
  FIRST_VICTORY: 'achievement.FIRST_VICTORY.name',
  BOSS_SLAYER: 'achievement.BOSS_SLAYER.name',
  GEAR_COLLECTOR: 'achievement.GEAR_COLLECTOR.name',
  VETERAN_HERO: 'achievement.VETERAN_HERO.name',
};

const PHASE_KEYS: Record<string, TranslationKey> = {
  IDLE: 'phase.IDLE',
  DOWN: 'phase.DOWN',
  UP: 'phase.UP',
  TRANSITION: 'phase.TRANSITION',
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
  onExit,
  onStartNextLevel,
}: BattleScreenProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<WorkoutSession | null>(null);
  const lastCombatEventIdRef = useRef<number>(0);
  const lastAttackEventIdRef = useRef<number>(0);
  const damageTimerRef = useRef<number | null>(null);
  const heroHitTimerRef = useRef<number | null>(null);

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
    lastCombatEvent: null,
    lastMonsterAttackEvent: null,
    victorySummary: null,
  });
  const [isDamaged, setIsDamaged] = useState(false);
  const [isHeroHit, setIsHeroHit] = useState(false);

  const basePlayer = useGameStore((state) => state.player);
  const equippedItems = useGameStore((state) => state.inventory.equippedItems);
  const enemy = useGameStore((state) => state.currentEnemy);
  const startCombat = useGameStore((state) => state.startCombat);
  const endCombat = useGameStore((state) => state.endCombat);
  const revivePlayer = useGameStore((state) => state.revivePlayer);

  const effectivePlayer = useMemo(
    () => selectEffectivePlayerStats(useGameStore.getState()),
    [basePlayer, equippedItems]
  );

  const exerciseDef = EXERCISES[exerciseId];
  const levelDef = levelId ? getLevelById(levelId) : undefined;
  const initialMonsterId = levelDef?.monsterId ?? enemy?.id ?? 'BURGER';

  useEffect(() => {
    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;
    if (!videoEl || !canvasEl) {
      return undefined;
    }

    const session = createWorkoutSessionForBattle({
      videoElement: videoEl,
      canvasElement: canvasEl,
      exerciseId,
      levelId,
    });
    sessionRef.current = session;

    const unsubscribe = session.onStateChange((status) => {
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
    });

    void session.start();

    return () => {
      if (damageTimerRef.current !== null) {
        window.clearTimeout(damageTimerRef.current);
        damageTimerRef.current = null;
      }
      if (heroHitTimerRef.current !== null) {
        window.clearTimeout(heroHitTimerRef.current);
        heroHitTimerRef.current = null;
      }
      unsubscribe();
      session.stop();
      sessionRef.current = null;
    };
  }, [exerciseId, levelId]);

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
    onExit();
  };

  const handleUnlockAudio = () => {
    void sessionRef.current?.unlockAudio();
  };

  const handleRetry = () => {
    if (useGameStore.getState().player.hp <= 0) {
      revivePlayer();
    }
    const template = MONSTERS[initialMonsterId] ?? MONSTERS.BURGER;
    const freshEnemy = createMonster(template);
    startCombat(freshEnemy);
    sessionRef.current?.reset(freshEnemy);
  };

  const handleNextFight = () => {
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
  const canAdvance = sessionStatus.state === 'VICTORY' && Boolean(nextLevel && onStartNextLevel);

  const attackTimerPercent = Math.round(
    Math.max(0, Math.min(1, sessionStatus.nextAttackProgress)) * 100
  );
  const secondsUntilAttack = Math.max(
    0,
    ((1 - sessionStatus.nextAttackProgress) * sessionStatus.monsterAttackIntervalMs) / 1000
  ).toFixed(1);
  const isWarningActive = sessionStatus.state === 'ACTIVE' && sessionStatus.isAttackWarning;

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
            label={monsterName}
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

          {/* Top-left Exercise & FPS Info */}
          <div className="absolute top-4 left-4 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-200 flex items-center gap-2">
            <span className="font-semibold">{t(EXERCISE_NAME_KEYS[exerciseId])}</span>
            {typeof sessionStatus.fps === 'number' && sessionStatus.fps > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-numeric text-slate-400">
                  {sessionStatus.fps} {t('battle.fps')}
                </span>
              </>
            )}
          </div>

          {/* Audio Unlock Banner (iOS / Safari autoplay policy) */}
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
            <div className="absolute inset-0 bg-slate-950/85 flex items-center justify-center p-6">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-slate-200 font-medium">{t('battle.starting')}</p>
              </div>
            </div>
          )}

          {/* Paused Overlay */}
          {sessionStatus.state === 'PAUSED' && (
            <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center p-6">
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
            <div className="absolute inset-0 bg-slate-950/90 flex items-center justify-center p-6">
              <div className="bg-slate-900 border border-red-800 rounded-xl p-6 max-w-md w-full text-center space-y-3">
                <h3 className="text-lg font-bold text-red-400">{t('battle.error')}</h3>
                <p className="text-sm text-slate-300">
                  {sessionStatus.errorMessage || t('error.unknown')}
                </p>
                <button
                  onClick={handleSurrender}
                  className="mt-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {t('battle.exit')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Combat HUD Panel */}
        <aside className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-6 flex flex-col justify-between gap-5 shrink-0">
          {/* Monster Sprite + Counter-attack Timer */}
          <div className="flex flex-col items-center text-center pt-1 space-y-3">
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
              className="text-7xl select-none"
            >
              {monsterTemplate.sprite}
            </motion.div>

            <h2 className="text-xl font-bold text-white">{monsterName}</h2>

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
              {isWarningActive && exerciseId === 'PLANK' && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-sky-300 font-medium pt-0.5">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('battle.plankBlockHint')}</span>
                </div>
              )}
            </div>

            {/* Damage / Block Popups */}
            <div className="min-h-[24px] flex flex-col items-center gap-1">
              <AnimatePresence mode="wait">
                {sessionStatus.lastCombatEvent && (
                  <motion.div
                    key={sessionStatus.lastCombatEvent.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className={`font-numeric text-sm font-bold ${
                      sessionStatus.lastCombatEvent.wasCritical
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    -{sessionStatus.lastCombatEvent.damage} HP
                    {sessionStatus.lastCombatEvent.wasCritical
                      ? ` · ${t('battle.criticalHit')}`
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

          {/* Exercise Telemetry */}
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

          {/* Battle Controls */}
          <div className="flex flex-col gap-2.5">
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

      {/* Victory / Defeat Modal */}
      <AnimatePresence>
        {(sessionStatus.state === 'VICTORY' || sessionStatus.state === 'DEFEAT') && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-7 max-w-md w-full text-center space-y-5">
              <div className="text-5xl" aria-hidden="true">
                {sessionStatus.state === 'VICTORY' ? '🏆' : '💀'}
              </div>

              <div>
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
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('battle.xpGained')}</span>
                    <span className="font-numeric font-semibold text-amber-400">
                      +{sessionStatus.victorySummary.xpGained} XP
                    </span>
                  </div>

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
                          const key = ACHIEVEMENT_NAME_KEYS[achId as AchievementId];
                          return <li key={achId}>· {key ? t(key) : achId}</li>;
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={canAdvance ? handleNextFight : handleRetry}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-lg transition-colors whitespace-nowrap"
                >
                  {t(canAdvance ? 'battle.nextFight' : 'battle.tryAgain')}
                </button>
                <button
                  onClick={handleSurrender}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-lg transition-colors whitespace-nowrap"
                >
                  {t('battle.exit')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
