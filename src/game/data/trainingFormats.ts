/**
 * Pure training formats, interval timers (Tabata/HIIT), tempo cadence metronome,
 * pre-battle warm-up rules, and 60-second Fitness Benchmark rating logic.
 * ZERO React, DOM, or CV imports.
 */

import { EXERCISES, type ExerciseId } from './exercises';
import type {
  BenchmarkEntry,
  BenchmarkRating,
  CadenceMode,
  TabataConfig,
  TabataPresetId,
} from '../types';

export interface TabataPresetDefinition {
  id: TabataPresetId;
  workSec: number;
  restSec: number;
  rounds: number;
  xpBonusMultiplier: number;
}

export const TABATA_PRESETS: Record<TabataPresetId, TabataPresetDefinition> = {
  CLASSIC_20_10: {
    id: 'CLASSIC_20_10',
    workSec: 20,
    restSec: 10,
    rounds: 6,
    xpBonusMultiplier: 1.25,
  },
  POWER_30_15: {
    id: 'POWER_30_15',
    workSec: 30,
    restSec: 15,
    rounds: 6,
    xpBonusMultiplier: 1.35,
  },
  ENDURANCE_40_20: {
    id: 'ENDURANCE_40_20',
    workSec: 40,
    restSec: 20,
    rounds: 4,
    xpBonusMultiplier: 1.4,
  },
};

export const TABATA_PRESET_ORDER: readonly TabataPresetId[] = [
  'CLASSIC_20_10',
  'POWER_30_15',
  'ENDURANCE_40_20',
];

export const DEFAULT_TABATA_CONFIG: TabataConfig = {
  presetId: 'CLASSIC_20_10',
  workSec: 20,
  restSec: 10,
  rounds: 6,
};

export type TabataPhase = 'WORK' | 'REST';

export interface TabataTickSnapshot {
  phase: TabataPhase;
  round: number;
  totalRounds: number;
  remainingSec: number;
  phaseDurationSec: number;
  progress: number;
  finished: boolean;
}

/**
 * Pure deterministic Tabata state calculator given elapsed active milliseconds.
 */
export function computeTabataSnapshot(
  elapsedMs: number,
  config: TabataConfig = DEFAULT_TABATA_CONFIG
): TabataTickSnapshot {
  const workSec = Math.max(10, Math.floor(config.workSec));
  const restSec = Math.max(5, Math.floor(config.restSec));
  const totalRounds = Math.max(1, Math.floor(config.rounds));
  const cycleSec = workSec + restSec;
  // Last round omits trailing rest so workout finishes cleanly on final work bell
  const totalSec = Math.max(1, (totalRounds - 1) * cycleSec + workSec);
  const clampedElapsedSec = Math.max(0, elapsedMs / 1000);

  if (clampedElapsedSec >= totalSec) {
    return {
      phase: 'WORK',
      round: totalRounds,
      totalRounds,
      remainingSec: 0,
      phaseDurationSec: workSec,
      progress: 1,
      finished: true,
    };
  }

  const roundIndex = Math.min(totalRounds - 1, Math.floor(clampedElapsedSec / cycleSec));
  const inCycleSec = clampedElapsedSec - roundIndex * cycleSec;

  if (inCycleSec < workSec) {
    const remainingSec = Math.max(1, Math.ceil(workSec - inCycleSec));
    return {
      phase: 'WORK',
      round: roundIndex + 1,
      totalRounds,
      remainingSec,
      phaseDurationSec: workSec,
      progress: Math.min(1, inCycleSec / workSec),
      finished: false,
    };
  }

  const inRestSec = inCycleSec - workSec;
  const remainingSec = Math.max(1, Math.ceil(restSec - inRestSec));
  return {
    phase: 'REST',
    round: roundIndex + 1,
    totalRounds,
    remainingSec,
    phaseDurationSec: restSec,
    progress: Math.min(1, inRestSec / restSec),
    finished: false,
  };
}

export const WARMUP_DURATION_SEC = 20;
export const WARMUP_TARGET_REPS = 8;
export const WARMUP_ULTIMATE_BONUS = 25;

export const FRESH_SWITCH_MIN_REPS_HINT = 15;
export const FRESH_SWITCH_BONUS_DURATION_MS = 8000;
export const FRESH_SWITCH_DAMAGE_MULTIPLIER = 1.25;

export interface CadenceSpec {
  id: CadenceMode;
  bpm: number;
  beatIntervalMs: number;
}

export const CADENCE_MODES: Record<CadenceMode, CadenceSpec> = {
  OFF: { id: 'OFF', bpm: 0, beatIntervalMs: 0 },
  STRENGTH_2_1_2: { id: 'STRENGTH_2_1_2', bpm: 36, beatIntervalMs: 1667 },
  STEADY_60: { id: 'STEADY_60', bpm: 60, beatIntervalMs: 1000 },
  CARDIO_90: { id: 'CARDIO_90', bpm: 90, beatIntervalMs: 667 },
};

export const CADENCE_ORDER: readonly CadenceMode[] = [
  'OFF',
  'STRENGTH_2_1_2',
  'STEADY_60',
  'CARDIO_90',
];

/**
 * Compute sliding-window repetitions per minute (RPM) over the last 20 seconds.
 */
export function calculateSlidingCadenceRpm(
  repTimestampsMs: readonly number[],
  nowMs: number,
  windowMs: number = 20_000
): number {
  if (repTimestampsMs.length === 0) return 0;
  const cutoff = nowMs - windowMs;
  const recent = repTimestampsMs.filter((ts) => ts >= cutoff && ts <= nowMs);
  if (recent.length === 0) return 0;
  const spanMs = Math.max(4000, nowMs - Math.min(...recent));
  const effectiveWindowMs = Math.min(windowMs, Math.max(spanMs, 6000));
  return Math.round((recent.length / (effectiveWindowMs / 60_000)) * 10) / 10;
}

export const BENCHMARK_DURATION_SEC = 60;

interface BenchmarkThreshold {
  silver: number;
  gold: number;
  elite: number;
}

const BENCHMARK_THRESHOLDS: Record<ExerciseId, BenchmarkThreshold> = {
  SQUAT: { silver: 22, gold: 34, elite: 45 },
  PUSH_UP: { silver: 18, gold: 30, elite: 42 },
  PLANK: { silver: 35, gold: 50, elite: 58 },
  JUMPING_JACK: { silver: 35, gold: 50, elite: 65 },
  ARM_HOLD: { silver: 35, gold: 50, elite: 58 },
  WALL_SIT: { silver: 35, gold: 50, elite: 58 },
  OVERHEAD_PRESS: { silver: 20, gold: 32, elite: 42 },
  LUNGE: { silver: 18, gold: 28, elite: 38 },
  HIGH_KNEES: { silver: 45, gold: 65, elite: 85 },
  FRONT_RAISE: { silver: 20, gold: 30, elite: 40 },
};

export function computeBenchmarkRating(
  exerciseId: ExerciseId,
  score: number
): BenchmarkRating {
  const th = BENCHMARK_THRESHOLDS[exerciseId] ?? { silver: 20, gold: 35, elite: 50 };
  if (score >= th.elite) return 'ELITE';
  if (score >= th.gold) return 'GOLD';
  if (score >= th.silver) return 'SILVER';
  return 'BRONZE';
}

/**
 * Compute overall 0-100 physical conditioning index from best 60s benchmark scores.
 */
export function computeFitnessConditioningIndex(
  bestByExercise: Partial<Record<ExerciseId, number>>
): number {
  const ids = Object.keys(EXERCISES) as ExerciseId[];
  const scores: number[] = [];

  for (const id of ids) {
    const raw = bestByExercise[id];
    if (typeof raw === 'number' && raw > 0) {
      const th = BENCHMARK_THRESHOLDS[id];
      const normalized = Math.min(100, Math.round((raw / th.elite) * 100));
      scores.push(normalized);
    }
  }

  if (scores.length === 0) return 0;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  // Reward covering diverse exercises slightly while keeping score grounded
  const coverageFactor = Math.min(1, 0.7 + scores.length * 0.05);
  return Math.round(avg * coverageFactor);
}

export function normalizeBenchmarks(raw: unknown): BenchmarkEntry[] {
  if (!Array.isArray(raw)) return [];
  const valid: BenchmarkEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const src = item as Partial<BenchmarkEntry>;
    if (!src.exerciseId || !(src.exerciseId in EXERCISES)) continue;
    const score = Math.max(0, Math.floor(Number(src.score) || 0));
    if (score <= 0) continue;
    valid.push({
      id: typeof src.id === 'string' ? src.id : `bm-${valid.length + 1}`,
      dateKey: typeof src.dateKey === 'string' ? src.dateKey : '',
      exerciseId: src.exerciseId,
      score,
      avgCadenceRpm: Math.max(0, Number(src.avgCadenceRpm) || 0),
      rating: computeBenchmarkRating(src.exerciseId, score),
    });
  }
  return valid.slice(-100);
}
