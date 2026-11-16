/**
 * Deterministic daily quests and workout streak helpers.
 * Uses local calendar dates (YYYY-MM-DD) without requiring a backend server.
 */

import type { DailyQuestState, StreakState } from '../types';

export type DailyQuestMetric = 'reps' | 'holdSeconds' | 'wins';

export interface DailyQuestDefinition {
  id: string;
  metric: DailyQuestMetric;
  target: number;
  rewardCoins: number;
  rewardXp: number;
}

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPreviousDateKey(dateKey: string): string {
  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  const date = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
  date.setDate(date.getDate() - 1);
  return getLocalDateKey(date);
}

export function getRecentDateKeys(days: number = 7, anchorDate: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - offset);
    keys.push(getLocalDateKey(d));
  }
  return keys;
}

function hashDateKey(dateKey: string): number {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const REP_TARGETS = [15, 25, 35];
const HOLD_TARGETS = [15, 25, 40];
const WIN_TARGETS = [2, 3, 4];

/**
 * Generates 3 deterministic daily quests for a given calendar date key.
 */
export function getDailyQuestsForDate(dateKey: string): DailyQuestDefinition[] {
  const seed = hashDateKey(dateKey);

  const repTarget = REP_TARGETS[seed % REP_TARGETS.length];
  const holdTarget = HOLD_TARGETS[(seed >> 3) % HOLD_TARGETS.length];
  const winTarget = WIN_TARGETS[(seed >> 6) % WIN_TARGETS.length];

  return [
    {
      id: `DAILY_REPS_${repTarget}`,
      metric: 'reps',
      target: repTarget,
      rewardCoins: 20 + repTarget,
      rewardXp: 25 + repTarget,
    },
    {
      id: `DAILY_PLANK_${holdTarget}`,
      metric: 'holdSeconds',
      target: holdTarget,
      rewardCoins: 25 + holdTarget,
      rewardXp: 30 + holdTarget,
    },
    {
      id: `DAILY_WINS_${winTarget}`,
      metric: 'wins',
      target: winTarget,
      rewardCoins: 30 + winTarget * 15,
      rewardXp: 35 + winTarget * 20,
    },
  ];
}

export function getQuestProgress(quest: DailyQuestDefinition, dailyQuests: DailyQuestState): number {
  switch (quest.metric) {
    case 'reps':
      return dailyQuests.repsToday;
    case 'holdSeconds':
      return dailyQuests.holdSecondsToday;
    case 'wins':
      return dailyQuests.winsToday;
  }
}

export function updateStreakForDate(streak: StreakState, todayKey: string): StreakState {
  if (streak.lastActiveDate === todayKey) {
    return streak;
  }

  const yesterdayKey = getPreviousDateKey(todayKey);
  const nextCurrent = streak.lastActiveDate === yesterdayKey ? streak.current + 1 : 1;

  return {
    current: nextCurrent,
    best: Math.max(streak.best, nextCurrent),
    lastActiveDate: todayKey,
  };
}
