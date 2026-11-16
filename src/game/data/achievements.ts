/**
 * Data-driven achievement definitions and pure evaluation logic.
 * ZERO React, DOM, or CV imports.
 */

import type { GameState } from '../types';
import { getActiveSanctuarySynergies } from './sanctuary';

export type AchievementId =
  | 'FIRST_REP'
  | 'FIFTY_REPS'
  | 'PLANK_SURVIVOR'
  | 'FIRST_VICTORY'
  | 'BOSS_SLAYER'
  | 'GEAR_COLLECTOR'
  | 'VETERAN_HERO'
  | 'COMBO_MASTER'
  | 'ARENA_SURVIVOR'
  | 'STREAK_WARRIOR'
  | 'BESTIARY_SCHOLAR'
  | 'IRON_TONNAGE'
  | 'STATIC_MASTER'
  | 'CIRCUIT_CHAMPION'
  | 'GARDENER'
  | 'WEED_SLAYER'
  | 'BOTANICAL_ALCHEMIST'
  | 'SYNERGY_ARCHITECT'
  | 'MASTER_ALCHEMIST';

export interface AchievementDefinition {
  id: AchievementId;
  icon: string;
  check: (state: GameState) => boolean;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'FIRST_REP',
    icon: '🔥',
    check: (state) => state.workoutStats.totalReps >= 1,
  },
  {
    id: 'FIFTY_REPS',
    icon: '💥',
    check: (state) => state.workoutStats.totalReps >= 50,
  },
  {
    id: 'PLANK_SURVIVOR',
    icon: '🛡️',
    check: (state) => state.workoutStats.totalHoldSeconds >= 30,
  },
  {
    id: 'FIRST_VICTORY',
    icon: '🏆',
    check: (state) => state.workoutStats.monstersDefeated >= 1,
  },
  {
    id: 'BOSS_SLAYER',
    icon: '👑',
    check: (state) => state.completedLevels.includes('LEVEL_5'),
  },
  {
    id: 'GEAR_COLLECTOR',
    icon: '🎒',
    check: (state) => state.inventory.items.size >= 3,
  },
  {
    id: 'VETERAN_HERO',
    icon: '⭐',
    check: (state) => state.player.level >= 5,
  },
  {
    id: 'COMBO_MASTER',
    icon: '⚡',
    check: (state) => (state.workoutStats.maxCombo ?? 0) >= 10,
  },
  {
    id: 'ARENA_SURVIVOR',
    icon: '🏟️',
    check: (state) => (state.endlessStats?.bestWave ?? 0) >= 5,
  },
  {
    id: 'STREAK_WARRIOR',
    icon: '📅',
    check: (state) => (state.streak?.best ?? 0) >= 3,
  },
  {
    id: 'BESTIARY_SCHOLAR',
    icon: '📖',
    check: (state) => Object.keys(state.bestiary ?? {}).length >= 5,
  },
  {
    id: 'IRON_TONNAGE',
    icon: '🏋️',
    check: (state) => (state.workoutStats.totalTonnageKg ?? 0) >= 500,
  },
  {
    id: 'STATIC_MASTER',
    icon: '🧘',
    check: (state) =>
      (state.exerciseTotals.PLANK?.holdSeconds ?? 0) +
        (state.exerciseTotals.ARM_HOLD?.holdSeconds ?? 0) +
        (state.exerciseTotals.WALL_SIT?.holdSeconds ?? 0) >=
      60,
  },
  {
    id: 'CIRCUIT_CHAMPION',
    icon: '🔁',
    check: (state) => (state.workoutStats.circuitsCompleted ?? 0) >= 1,
  },
  {
    id: 'GARDENER',
    icon: '🌻',
    check: (state) => (state.garden?.totalHarvested ?? 0) >= 3,
  },
  {
    id: 'WEED_SLAYER',
    icon: '🌿',
    check: (state) => (state.garden?.weedsDefeated ?? 0) >= 3,
  },
  {
    id: 'BOTANICAL_ALCHEMIST',
    icon: '⚗️',
    check: (state) => (state.sanctuary?.totalCrafted ?? 0) >= 3,
  },
  {
    id: 'SYNERGY_ARCHITECT',
    icon: '🔮',
    check: (state) =>
      (state.sanctuary?.totalSynergiesActivated ?? 0) >= 1 ||
      getActiveSanctuarySynergies(state.sanctuary?.activeBuffs ?? []).length >= 1,
  },
  {
    id: 'MASTER_ALCHEMIST',
    icon: '🧪',
    check: (state) => (state.sanctuary?.totalCrafted ?? 0) >= 10,
  },
];

/**
 * Evaluate which achievements are newly unlocked given the current state.
 */
export function evaluateNewAchievements(state: GameState): AchievementId[] {
  const alreadyUnlocked = new Set(state.unlockedAchievements);
  const newlyUnlocked: AchievementId[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (!alreadyUnlocked.has(achievement.id) && achievement.check(state)) {
      newlyUnlocked.push(achievement.id);
    }
  }

  return newlyUnlocked;
}
