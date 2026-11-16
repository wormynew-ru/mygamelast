/**
 * Data-driven achievement definitions and pure evaluation logic.
 * ZERO React, DOM, or CV imports.
 */

import type { GameState } from '../types';

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
  | 'BESTIARY_SCHOLAR';

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
