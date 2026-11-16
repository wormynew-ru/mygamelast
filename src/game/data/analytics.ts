/**
 * Pure workout analytics aggregation across Today, 7 Days, Month, Year, and All Time.
 * Zero React or DOM dependencies.
 */

import type { DailyActivityEntry, ExerciseTotals, WorkoutStats } from '../types';
import { estimateWorkoutKcal } from '../CombatEngine';
import { EXERCISES, type ExerciseId } from './exercises';
import { getLocalDateKey, getRecentDateKeys } from './dailyQuests';

export type AnalyticsPeriod = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL';
export type AnalyticsChartMetric = 'VOLUME' | 'KCAL' | 'TONNAGE';

export interface AnalyticsBucket {
  key: string;
  label: string;
  tooltipLabel: string;
  reps: number;
  holdSeconds: number;
  volume: number;
  estimatedKcal: number;
  tonnageKg: number;
  battlesWon: number;
}

export interface PeriodAnalyticsSummary {
  period: AnalyticsPeriod;
  totalReps: number;
  totalHoldSeconds: number;
  estimatedKcal: number;
  tonnageKg: number;
  battlesWon: number;
  circuitsCompleted: number;
  coinsEarned: number;
  durationSec: number;
  activeDays: number;
  exerciseBreakdown: Record<ExerciseId, ExerciseTotals>;
  buckets: AnalyticsBucket[];
}

function createEmptyExerciseBreakdown(): Record<ExerciseId, ExerciseTotals> {
  return {
    SQUAT: { reps: 0, holdSeconds: 0 },
    PUSH_UP: { reps: 0, holdSeconds: 0 },
    PLANK: { reps: 0, holdSeconds: 0 },
    JUMPING_JACK: { reps: 0, holdSeconds: 0 },
    ARM_HOLD: { reps: 0, holdSeconds: 0 },
    WALL_SIT: { reps: 0, holdSeconds: 0 },
    OVERHEAD_PRESS: { reps: 0, holdSeconds: 0 },
  };
}

function getRecentMonthKeys(months: number, anchorDate: Date): string[] {
  const keys: string[] = [];
  const baseYear = anchorDate.getFullYear();
  const baseMonth = anchorDate.getMonth();
  for (let offset = months - 1; offset >= 0; offset--) {
    const d = new Date(baseYear, baseMonth - offset, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    keys.push(`${y}-${m}`);
  }
  return keys;
}

function isEntryActive(entry: DailyActivityEntry | undefined): boolean {
  if (!entry) return false;
  return (
    entry.reps > 0 ||
    entry.holdSeconds > 0 ||
    entry.battlesWon > 0 ||
    entry.estimatedKcal > 0 ||
    (entry.tonnageKg ?? 0) > 0
  );
}

function addEntryToBreakdown(
  target: Record<ExerciseId, ExerciseTotals>,
  entry: DailyActivityEntry
): void {
  if (!entry.exercises) return;
  for (const id of Object.keys(EXERCISES) as ExerciseId[]) {
    const delta = entry.exercises[id];
    if (!delta) continue;
    target[id].reps += delta.reps ?? 0;
    target[id].holdSeconds += delta.holdSeconds ?? 0;
  }
}

export function buildPeriodAnalytics(params: {
  period: AnalyticsPeriod;
  dailyHistory: Record<string, DailyActivityEntry>;
  workoutStats: WorkoutStats;
  exerciseTotals: Record<ExerciseId, ExerciseTotals>;
  anchorDate?: Date;
}): PeriodAnalyticsSummary {
  const { period, dailyHistory, workoutStats, exerciseTotals, anchorDate = new Date() } = params;
  const todayKey = getLocalDateKey(anchorDate);
  const exerciseBreakdown = createEmptyExerciseBreakdown();

  let totalReps = 0;
  let totalHoldSeconds = 0;
  let estimatedKcal = 0;
  let tonnageKg = 0;
  let battlesWon = 0;
  let circuitsCompleted = 0;
  let coinsEarned = 0;
  let durationSec = 0;
  let activeDays = 0;
  const buckets: AnalyticsBucket[] = [];

  if (period === 'TODAY' || period === 'WEEK' || period === 'MONTH') {
    const daysCount = period === 'TODAY' ? 1 : period === 'WEEK' ? 7 : 30;
    const dateKeys = period === 'TODAY' ? [todayKey] : getRecentDateKeys(daysCount, anchorDate);

    for (const dateKey of dateKeys) {
      const entry = dailyHistory[dateKey];
      const reps = entry?.reps ?? 0;
      const holdSeconds = entry?.holdSeconds ?? 0;
      const kcal = entry?.estimatedKcal ?? 0;
      const tonnage = entry?.tonnageKg ?? 0;
      const wins = entry?.battlesWon ?? 0;

      if (entry && isEntryActive(entry)) {
        activeDays++;
        totalReps += reps;
        totalHoldSeconds += holdSeconds;
        estimatedKcal += kcal;
        tonnageKg += tonnage;
        battlesWon += wins;
        circuitsCompleted += entry.circuitsCompleted ?? 0;
        coinsEarned += entry.coinsEarned ?? 0;
        durationSec += entry.durationSec ?? 0;
        addEntryToBreakdown(exerciseBreakdown, entry);
      }

      buckets.push({
        key: dateKey,
        label: dateKey.slice(5),
        tooltipLabel: dateKey,
        reps,
        holdSeconds,
        volume: reps + holdSeconds,
        estimatedKcal: Math.round(kcal * 10) / 10,
        tonnageKg: Math.round(tonnage * 10) / 10,
        battlesWon: wins,
      });
    }
  } else if (period === 'YEAR') {
    const monthKeys = getRecentMonthKeys(12, anchorDate);
    const startCutoff = `${monthKeys[0]}-01`;
    const monthAgg = new Map<
      string,
      {
        reps: number;
        holdSeconds: number;
        kcal: number;
        tonnage: number;
        wins: number;
      }
    >();
    for (const mk of monthKeys) {
      monthAgg.set(mk, { reps: 0, holdSeconds: 0, kcal: 0, tonnage: 0, wins: 0 });
    }

    for (const [dateKey, entry] of Object.entries(dailyHistory)) {
      if (dateKey < startCutoff || dateKey > todayKey) continue;
      if (!isEntryActive(entry)) continue;

      activeDays++;
      totalReps += entry.reps;
      totalHoldSeconds += entry.holdSeconds;
      estimatedKcal += entry.estimatedKcal;
      tonnageKg += entry.tonnageKg ?? 0;
      battlesWon += entry.battlesWon;
      circuitsCompleted += entry.circuitsCompleted ?? 0;
      coinsEarned += entry.coinsEarned;
      durationSec += entry.durationSec ?? 0;
      addEntryToBreakdown(exerciseBreakdown, entry);

      const mk = dateKey.slice(0, 7);
      const bucket = monthAgg.get(mk);
      if (bucket) {
        bucket.reps += entry.reps;
        bucket.holdSeconds += entry.holdSeconds;
        bucket.kcal += entry.estimatedKcal;
        bucket.tonnage += entry.tonnageKg ?? 0;
        bucket.wins += entry.battlesWon;
      }
    }

    for (const mk of monthKeys) {
      const b = monthAgg.get(mk)!;
      buckets.push({
        key: mk,
        label: `${mk.slice(5)}.${mk.slice(2, 4)}`,
        tooltipLabel: mk,
        reps: b.reps,
        holdSeconds: b.holdSeconds,
        volume: b.reps + b.holdSeconds,
        estimatedKcal: Math.round(b.kcal * 10) / 10,
        tonnageKg: Math.round(b.tonnage * 10) / 10,
        battlesWon: b.wins,
      });
    }
  } else {
    // ALL TIME: combine exact lifetime totals from workoutStats + exerciseTotals with monthly timeline from dailyHistory
    for (const id of Object.keys(EXERCISES) as ExerciseId[]) {
      const totals = exerciseTotals[id];
      if (totals) {
        exerciseBreakdown[id] = {
          reps: totals.reps ?? 0,
          holdSeconds: totals.holdSeconds ?? 0,
        };
      }
    }

    let historyKcalSum = 0;
    let historyCoinsSum = 0;
    let historyDurationSum = 0;
    const recent12 = getRecentMonthKeys(12, anchorDate);
    const monthSet = new Set<string>(recent12);
    const monthAgg = new Map<
      string,
      {
        reps: number;
        holdSeconds: number;
        kcal: number;
        tonnage: number;
        wins: number;
      }
    >();
    for (const mk of recent12) {
      monthAgg.set(mk, { reps: 0, holdSeconds: 0, kcal: 0, tonnage: 0, wins: 0 });
    }

    for (const [dateKey, entry] of Object.entries(dailyHistory)) {
      if (!isEntryActive(entry)) continue;
      activeDays++;
      historyKcalSum += entry.estimatedKcal ?? 0;
      historyCoinsSum += entry.coinsEarned ?? 0;
      historyDurationSum += entry.durationSec ?? 0;

      const mk = dateKey.slice(0, 7);
      monthSet.add(mk);
      const current = monthAgg.get(mk) ?? {
        reps: 0,
        holdSeconds: 0,
        kcal: 0,
        tonnage: 0,
        wins: 0,
      };
      current.reps += entry.reps;
      current.holdSeconds += entry.holdSeconds;
      current.kcal += entry.estimatedKcal;
      current.tonnage += entry.tonnageKg ?? 0;
      current.wins += entry.battlesWon;
      monthAgg.set(mk, current);
    }

    const fallbackLifetimeKcal = estimateWorkoutKcal(exerciseTotals);
    totalReps = workoutStats.totalReps;
    totalHoldSeconds = workoutStats.totalHoldSeconds;
    estimatedKcal = Math.max(
      workoutStats.totalEstimatedKcal ?? 0,
      historyKcalSum,
      historyKcalSum === 0 ? fallbackLifetimeKcal : 0
    );
    tonnageKg = workoutStats.totalTonnageKg ?? 0;
    battlesWon = workoutStats.monstersDefeated;
    circuitsCompleted = workoutStats.circuitsCompleted ?? 0;
    coinsEarned = Math.max(workoutStats.totalCoinsEarned ?? 0, historyCoinsSum);
    durationSec = Math.max(workoutStats.totalDurationSec ?? 0, historyDurationSum);

    const sortedMonths = Array.from(monthSet).sort();
    for (const mk of sortedMonths) {
      const b = monthAgg.get(mk) ?? {
        reps: 0,
        holdSeconds: 0,
        kcal: 0,
        tonnage: 0,
        wins: 0,
      };
      buckets.push({
        key: mk,
        label: `${mk.slice(5)}.${mk.slice(2, 4)}`,
        tooltipLabel: mk,
        reps: b.reps,
        holdSeconds: b.holdSeconds,
        volume: b.reps + b.holdSeconds,
        estimatedKcal: Math.round(b.kcal * 10) / 10,
        tonnageKg: Math.round(b.tonnage * 10) / 10,
        battlesWon: b.wins,
      });
    }
  }

  return {
    period,
    totalReps,
    totalHoldSeconds,
    estimatedKcal: Math.round(estimatedKcal * 10) / 10,
    tonnageKg: Math.round(tonnageKg * 10) / 10,
    battlesWon,
    circuitsCompleted,
    coinsEarned,
    durationSec,
    activeDays,
    exerciseBreakdown,
    buckets,
  };
}
