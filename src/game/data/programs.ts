/**
 * Multi-Day Training Programs (3-7 days), Run Mutators, and Deterministic Weekly Challenge.
 * ZERO React, DOM, or Vision imports allowed.
 */

import type { ExerciseId } from './exercises';
import type {
  BattleRank,
  ExercisePersonalRecord,
  MutatorId,
  ProgramId,
  ProgramProgressState,
  WeeklyChallengeState,
} from '../types';

export interface ProgramDayPlan {
  dayNumber: number;
  levelId: string;
  exerciseId: ExerciseId;
  bonusCoins: number;
  bonusXp: number;
}

export interface TrainingProgramDefinition {
  id: ProgramId;
  icon: string;
  durationDays: number;
  completionCoins: number;
  completionXp: number;
  days: readonly ProgramDayPlan[];
}

export const TRAINING_PROGRAMS: readonly TrainingProgramDefinition[] = [
  {
    id: 'STARTER_3D',
    icon: '📅',
    durationDays: 3,
    completionCoins: 120,
    completionXp: 90,
    days: [
      { dayNumber: 1, levelId: 'LEVEL_1', exerciseId: 'JUMPING_JACK', bonusCoins: 25, bonusXp: 20 },
      { dayNumber: 2, levelId: 'LEVEL_2', exerciseId: 'SQUAT', bonusCoins: 30, bonusXp: 25 },
      { dayNumber: 3, levelId: 'LEVEL_3', exerciseId: 'PUSH_UP', bonusCoins: 40, bonusXp: 35 },
    ],
  },
  {
    id: 'HYPERTROPHY_5D',
    icon: '🏋️',
    durationDays: 5,
    completionCoins: 220,
    completionXp: 160,
    days: [
      { dayNumber: 1, levelId: 'LEVEL_2', exerciseId: 'LUNGE', bonusCoins: 30, bonusXp: 25 },
      { dayNumber: 2, levelId: 'LEVEL_3', exerciseId: 'PUSH_UP', bonusCoins: 35, bonusXp: 30 },
      { dayNumber: 3, levelId: 'LEVEL_4', exerciseId: 'OVERHEAD_PRESS', bonusCoins: 40, bonusXp: 35 },
      { dayNumber: 4, levelId: 'LEVEL_4', exerciseId: 'FRONT_RAISE', bonusCoins: 45, bonusXp: 40 },
      { dayNumber: 5, levelId: 'LEVEL_5', exerciseId: 'SQUAT', bonusCoins: 60, bonusXp: 50 },
    ],
  },
  {
    id: 'ENDURANCE_5D',
    icon: '🔥',
    durationDays: 5,
    completionCoins: 220,
    completionXp: 160,
    days: [
      { dayNumber: 1, levelId: 'LEVEL_1', exerciseId: 'HIGH_KNEES', bonusCoins: 30, bonusXp: 25 },
      { dayNumber: 2, levelId: 'LEVEL_2', exerciseId: 'WALL_SIT', bonusCoins: 35, bonusXp: 30 },
      { dayNumber: 3, levelId: 'LEVEL_3', exerciseId: 'ARM_HOLD', bonusCoins: 40, bonusXp: 35 },
      { dayNumber: 4, levelId: 'LEVEL_4', exerciseId: 'PLANK', bonusCoins: 45, bonusXp: 40 },
      { dayNumber: 5, levelId: 'LEVEL_5', exerciseId: 'JUMPING_JACK', bonusCoins: 60, bonusXp: 50 },
    ],
  },
  {
    id: 'TITAN_WEEK_7D',
    icon: '👑',
    durationDays: 7,
    completionCoins: 380,
    completionXp: 260,
    days: [
      { dayNumber: 1, levelId: 'LEVEL_2', exerciseId: 'LUNGE', bonusCoins: 35, bonusXp: 30 },
      { dayNumber: 2, levelId: 'LEVEL_3', exerciseId: 'HIGH_KNEES', bonusCoins: 35, bonusXp: 30 },
      { dayNumber: 3, levelId: 'LEVEL_3', exerciseId: 'FRONT_RAISE', bonusCoins: 40, bonusXp: 35 },
      { dayNumber: 4, levelId: 'LEVEL_4', exerciseId: 'WALL_SIT', bonusCoins: 45, bonusXp: 40 },
      { dayNumber: 5, levelId: 'LEVEL_4', exerciseId: 'OVERHEAD_PRESS', bonusCoins: 50, bonusXp: 45 },
      { dayNumber: 6, levelId: 'LEVEL_5', exerciseId: 'PLANK', bonusCoins: 65, bonusXp: 55 },
      { dayNumber: 7, levelId: 'LEVEL_5', exerciseId: 'SQUAT', bonusCoins: 80, bonusXp: 70 },
    ],
  },
];

export const PROGRAM_MAP: Record<ProgramId, TrainingProgramDefinition> = {
  STARTER_3D: TRAINING_PROGRAMS[0],
  HYPERTROPHY_5D: TRAINING_PROGRAMS[1],
  ENDURANCE_5D: TRAINING_PROGRAMS[2],
  TITAN_WEEK_7D: TRAINING_PROGRAMS[3],
};

export function createInitialProgramState(): ProgramProgressState {
  return {
    active: null,
    completedProgramIds: [],
    totalProgramsFinished: 0,
  };
}

export function normalizeProgramState(raw?: Partial<ProgramProgressState>): ProgramProgressState {
  if (!raw || typeof raw !== 'object') {
    return createInitialProgramState();
  }
  const completedIds = Array.isArray(raw.completedProgramIds)
    ? raw.completedProgramIds.filter((id): id is ProgramId => id in PROGRAM_MAP)
    : [];

  let active = raw.active ?? null;
  if (active && !(active.programId in PROGRAM_MAP)) {
    active = null;
  } else if (active) {
    const def = PROGRAM_MAP[active.programId];
    active = {
      programId: active.programId,
      currentDayIndex: Math.max(0, Math.min(def.durationDays - 1, Math.floor(active.currentDayIndex ?? 0))),
      completedDays: Array.isArray(active.completedDays)
        ? active.completedDays.filter((d) => typeof d === 'number' && d >= 0 && d < def.durationDays)
        : [],
      startedAtDate: typeof active.startedAtDate === 'string' ? active.startedAtDate : '',
    };
  }

  return {
    active,
    completedProgramIds: Array.from(new Set(completedIds)),
    totalProgramsFinished: Math.max(0, Math.floor(raw.totalProgramsFinished ?? 0)),
  };
}

// === PERSONAL RECORDS ===

export function createEmptyExercisePR(): ExercisePersonalRecord {
  return {
    bestBattleReps: 0,
    bestHoldSec: 0,
    bestCombo: 0,
    maxWeightKg: 0,
    bestHitDamage: 0,
  };
}

export function createInitialPersonalRecords(): Record<ExerciseId, ExercisePersonalRecord> {
  return {
    SQUAT: createEmptyExercisePR(),
    PUSH_UP: createEmptyExercisePR(),
    PLANK: createEmptyExercisePR(),
    JUMPING_JACK: createEmptyExercisePR(),
    ARM_HOLD: createEmptyExercisePR(),
    WALL_SIT: createEmptyExercisePR(),
    OVERHEAD_PRESS: createEmptyExercisePR(),
    LUNGE: createEmptyExercisePR(),
    HIGH_KNEES: createEmptyExercisePR(),
    FRONT_RAISE: createEmptyExercisePR(),
  };
}

// === RUN MUTATORS ===

export const MAX_ACTIVE_MUTATORS = 3;

export interface MutatorDefinition {
  id: MutatorId;
  icon: string;
  xpMultiplier: number;
  coinMultiplier: number;
  enemyHpMultiplier: number;
  enemyAttackMultiplier: number;
  enemyIntervalMultiplier: number;
  playerDefenseDelta: number;
  startsToxic: boolean;
  blocksConsumables: boolean;
}

export const MUTATOR_ORDER: readonly MutatorId[] = [
  'GLASS_CANNON',
  'IRON_FOES',
  'BLITZ_CLOCK',
  'TOXIC_MIST',
  'NO_ITEMS',
];

export const MUTATORS: Record<MutatorId, MutatorDefinition> = {
  GLASS_CANNON: {
    id: 'GLASS_CANNON',
    icon: '💥',
    xpMultiplier: 1.2,
    coinMultiplier: 1.25,
    enemyHpMultiplier: 0.9,
    enemyAttackMultiplier: 1.35,
    enemyIntervalMultiplier: 1.0,
    playerDefenseDelta: -2,
    startsToxic: false,
    blocksConsumables: false,
  },
  IRON_FOES: {
    id: 'IRON_FOES',
    icon: '🪨',
    xpMultiplier: 1.25,
    coinMultiplier: 1.2,
    enemyHpMultiplier: 1.35,
    enemyAttackMultiplier: 1.05,
    enemyIntervalMultiplier: 1.0,
    playerDefenseDelta: 0,
    startsToxic: false,
    blocksConsumables: false,
  },
  BLITZ_CLOCK: {
    id: 'BLITZ_CLOCK',
    icon: '⚡',
    xpMultiplier: 1.2,
    coinMultiplier: 1.2,
    enemyHpMultiplier: 1.0,
    enemyAttackMultiplier: 1.0,
    enemyIntervalMultiplier: 0.78,
    playerDefenseDelta: 0,
    startsToxic: false,
    blocksConsumables: false,
  },
  TOXIC_MIST: {
    id: 'TOXIC_MIST',
    icon: '☣️',
    xpMultiplier: 1.25,
    coinMultiplier: 1.25,
    enemyHpMultiplier: 1.05,
    enemyAttackMultiplier: 1.0,
    enemyIntervalMultiplier: 1.0,
    playerDefenseDelta: 0,
    startsToxic: true,
    blocksConsumables: false,
  },
  NO_ITEMS: {
    id: 'NO_ITEMS',
    icon: '🚫',
    xpMultiplier: 1.15,
    coinMultiplier: 1.2,
    enemyHpMultiplier: 1.0,
    enemyAttackMultiplier: 1.1,
    enemyIntervalMultiplier: 1.0,
    playerDefenseDelta: 0,
    startsToxic: false,
    blocksConsumables: true,
  },
};

export interface AggregatedMutatorEffects {
  xpMultiplier: number;
  coinMultiplier: number;
  enemyHpMultiplier: number;
  enemyAttackMultiplier: number;
  enemyIntervalMultiplier: number;
  playerDefenseDelta: number;
  startsToxic: boolean;
  blocksConsumables: boolean;
}

export function getAggregatedMutatorEffects(
  activeMutators: readonly MutatorId[] = []
): AggregatedMutatorEffects {
  let xpMultiplier = 1.0;
  let coinMultiplier = 1.0;
  let enemyHpMultiplier = 1.0;
  let enemyAttackMultiplier = 1.0;
  let enemyIntervalMultiplier = 1.0;
  let playerDefenseDelta = 0;
  let startsToxic = false;
  let blocksConsumables = false;

  for (const id of activeMutators) {
    const m = MUTATORS[id];
    if (!m) continue;
    xpMultiplier *= m.xpMultiplier;
    coinMultiplier *= m.coinMultiplier;
    enemyHpMultiplier *= m.enemyHpMultiplier;
    enemyAttackMultiplier *= m.enemyAttackMultiplier;
    enemyIntervalMultiplier *= m.enemyIntervalMultiplier;
    playerDefenseDelta += m.playerDefenseDelta;
    if (m.startsToxic) startsToxic = true;
    if (m.blocksConsumables) blocksConsumables = true;
  }

  const r = (v: number) => Math.round(v * 1000) / 1000;
  return {
    xpMultiplier: r(xpMultiplier),
    coinMultiplier: r(coinMultiplier),
    enemyHpMultiplier: r(enemyHpMultiplier),
    enemyAttackMultiplier: r(enemyAttackMultiplier),
    enemyIntervalMultiplier: r(enemyIntervalMultiplier),
    playerDefenseDelta,
    startsToxic,
    blocksConsumables,
  };
}

// === DETERMINISTIC WEEKLY CHALLENGE ===

export function getISOWeekKey(date: Date = new Date()): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface WeeklyChallengeSpec {
  weekKey: string;
  monsterId: string;
  recommendedExerciseId: ExerciseId;
  mutators: MutatorId[];
  bonusCoins: number;
  bonusXp: number;
}

const WEEKLY_MONSTER_POOL = [
  'BOSS_KING_BURGER',
  'BOSS_DONUT_TITAN',
  'BOSS_SODA_OVERLORD',
  'BOSS_FRIES_EMPEROR',
  'BOSS_PIZZA_EMPEROR',
] as const;

const WEEKLY_EXERCISE_POOL: readonly ExerciseId[] = [
  'LUNGE',
  'HIGH_KNEES',
  'FRONT_RAISE',
  'SQUAT',
  'PUSH_UP',
  'PLANK',
  'OVERHEAD_PRESS',
];

export function getWeeklyChallengeForWeek(weekKey: string): WeeklyChallengeSpec {
  const h = hashSeed(weekKey);
  const monsterId = WEEKLY_MONSTER_POOL[h % WEEKLY_MONSTER_POOL.length];
  const recommendedExerciseId = WEEKLY_EXERCISE_POOL[(h >>> 4) % WEEKLY_EXERCISE_POOL.length];

  const firstMutator = MUTATOR_ORDER[(h >>> 8) % MUTATOR_ORDER.length];
  const secondCandidate = MUTATOR_ORDER[(h >>> 12) % MUTATOR_ORDER.length];
  const mutators =
    secondCandidate === firstMutator ? [firstMutator] : [firstMutator, secondCandidate];

  return {
    weekKey,
    monsterId,
    recommendedExerciseId,
    mutators,
    bonusCoins: 180,
    bonusXp: 140,
  };
}

export function createInitialWeeklyChallengeState(): WeeklyChallengeState {
  return {
    completedWeekKeys: [],
    bestRankByWeek: {},
    totalCompleted: 0,
  };
}

const RANK_ORDER: Record<BattleRank, number> = { S: 4, A: 3, B: 2, C: 1 };

export function pickBetterRank(existing: BattleRank | undefined, incoming: BattleRank): BattleRank {
  if (!existing) return incoming;
  return RANK_ORDER[incoming] >= RANK_ORDER[existing] ? incoming : existing;
}

export function normalizeWeeklyChallengeState(
  raw?: Partial<WeeklyChallengeState>
): WeeklyChallengeState {
  if (!raw || typeof raw !== 'object') {
    return createInitialWeeklyChallengeState();
  }
  const completedWeekKeys = Array.isArray(raw.completedWeekKeys)
    ? Array.from(new Set(raw.completedWeekKeys.filter((k): k is string => typeof k === 'string')))
    : [];
  const bestRankByWeek: Record<string, BattleRank> = {};
  if (raw.bestRankByWeek && typeof raw.bestRankByWeek === 'object') {
    for (const [k, v] of Object.entries(raw.bestRankByWeek)) {
      if (v === 'S' || v === 'A' || v === 'B' || v === 'C') {
        bestRankByWeek[k] = v;
      }
    }
  }
  return {
    completedWeekKeys,
    bestRankByWeek,
    totalCompleted: Math.max(completedWeekKeys.length, Math.floor(raw.totalCompleted ?? 0)),
  };
}
