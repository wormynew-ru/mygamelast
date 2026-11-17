import { describe, it, expect, beforeEach } from 'vitest';
import { buildPeriodAnalytics } from './analytics';
import { useGameStore } from '../store';
import type { DailyActivityEntry, ExerciseTotals, WorkoutStats } from '../types';
import type { ExerciseId } from './exercises';

function createExerciseTotals(): Record<ExerciseId, ExerciseTotals> {
  return {
    SQUAT: { reps: 0, holdSeconds: 0 },
    PUSH_UP: { reps: 0, holdSeconds: 0 },
    PLANK: { reps: 0, holdSeconds: 0 },
    JUMPING_JACK: { reps: 0, holdSeconds: 0 },
    ARM_HOLD: { reps: 0, holdSeconds: 0 },
    WALL_SIT: { reps: 0, holdSeconds: 0 },
    OVERHEAD_PRESS: { reps: 0, holdSeconds: 0 },
    LUNGE: { reps: 0, holdSeconds: 0 },
    HIGH_KNEES: { reps: 0, holdSeconds: 0 },
    FRONT_RAISE: { reps: 0, holdSeconds: 0 },
  };
}

describe('Workout Time-Range Analytics & Store Recording', () => {
  const anchor = new Date(2026, 10, 16, 12, 0, 0); // 2026-11-16

  const sampleHistory: Record<string, DailyActivityEntry> = {
    '2025-10-01': {
      date: '2025-10-01',
      reps: 50,
      holdSeconds: 20,
      battlesWon: 2,
      coinsEarned: 60,
      estimatedKcal: 25,
      tonnageKg: 300,
      circuitsCompleted: 1,
      durationSec: 180,
      exercises: {
        SQUAT: { reps: 50, holdSeconds: 0 },
        PLANK: { reps: 0, holdSeconds: 20 },
      },
    },
    '2026-10-20': {
      date: '2026-10-20',
      reps: 30,
      holdSeconds: 15,
      battlesWon: 1,
      coinsEarned: 40,
      estimatedKcal: 18,
      tonnageKg: 120,
      circuitsCompleted: 0,
      durationSec: 95,
      exercises: {
        OVERHEAD_PRESS: { reps: 30, holdSeconds: 0 },
        WALL_SIT: { reps: 0, holdSeconds: 15 },
      },
    },
    '2026-11-12': {
      date: '2026-11-12',
      reps: 20,
      holdSeconds: 10,
      battlesWon: 1,
      coinsEarned: 35,
      estimatedKcal: 12,
      tonnageKg: 80,
      circuitsCompleted: 0,
      durationSec: 60,
      exercises: {
        PUSH_UP: { reps: 20, holdSeconds: 0 },
        ARM_HOLD: { reps: 0, holdSeconds: 10 },
      },
    },
    '2026-11-16': {
      date: '2026-11-16',
      reps: 15,
      holdSeconds: 25,
      battlesWon: 2,
      coinsEarned: 55,
      estimatedKcal: 14.5,
      tonnageKg: 150,
      circuitsCompleted: 1,
      durationSec: 110,
      exercises: {
        SQUAT: { reps: 15, holdSeconds: 0 },
        ARM_HOLD: { reps: 0, holdSeconds: 25 },
      },
    },
  };

  const sampleWorkoutStats: WorkoutStats = {
    totalReps: 115,
    totalHoldSeconds: 70,
    monstersDefeated: 6,
    maxCombo: 9,
    totalTonnageKg: 650,
    circuitsCompleted: 2,
    totalEstimatedKcal: 69.5,
    totalDurationSec: 445,
    totalCoinsEarned: 190,
  };

  const sampleExerciseTotals: Record<ExerciseId, ExerciseTotals> = {
    ...createExerciseTotals(),
    SQUAT: { reps: 65, holdSeconds: 0 },
    PUSH_UP: { reps: 20, holdSeconds: 0 },
    PLANK: { reps: 0, holdSeconds: 20 },
    OVERHEAD_PRESS: { reps: 30, holdSeconds: 0 },
    ARM_HOLD: { reps: 0, holdSeconds: 35 },
    WALL_SIT: { reps: 0, holdSeconds: 15 },
  };

  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  it('aggregates TODAY, WEEK, MONTH, YEAR, and ALL TIME accurately', () => {
    const today = buildPeriodAnalytics({
      period: 'TODAY',
      dailyHistory: sampleHistory,
      workoutStats: sampleWorkoutStats,
      exerciseTotals: sampleExerciseTotals,
      anchorDate: anchor,
    });
    expect(today.totalReps).toBe(15);
    expect(today.totalHoldSeconds).toBe(25);
    expect(today.estimatedKcal).toBe(14.5);
    expect(today.tonnageKg).toBe(150);
    expect(today.battlesWon).toBe(2);
    expect(today.circuitsCompleted).toBe(1);
    expect(today.durationSec).toBe(110);
    expect(today.activeDays).toBe(1);
    expect(today.exerciseBreakdown.SQUAT.reps).toBe(15);
    expect(today.exerciseBreakdown.ARM_HOLD.holdSeconds).toBe(25);

    const week = buildPeriodAnalytics({
      period: 'WEEK',
      dailyHistory: sampleHistory,
      workoutStats: sampleWorkoutStats,
      exerciseTotals: sampleExerciseTotals,
      anchorDate: anchor,
    });
    expect(week.buckets).toHaveLength(7);
    expect(week.totalReps).toBe(35);
    expect(week.totalHoldSeconds).toBe(35);
    expect(week.estimatedKcal).toBe(26.5);
    expect(week.tonnageKg).toBe(230);
    expect(week.activeDays).toBe(2);
    expect(week.exerciseBreakdown.PUSH_UP.reps).toBe(20);
    expect(week.exerciseBreakdown.ARM_HOLD.holdSeconds).toBe(35);

    const month = buildPeriodAnalytics({
      period: 'MONTH',
      dailyHistory: sampleHistory,
      workoutStats: sampleWorkoutStats,
      exerciseTotals: sampleExerciseTotals,
      anchorDate: anchor,
    });
    expect(month.buckets).toHaveLength(30);
    expect(month.totalReps).toBe(65);
    expect(month.totalHoldSeconds).toBe(50);
    expect(month.estimatedKcal).toBe(44.5);
    expect(month.tonnageKg).toBe(350);
    expect(month.activeDays).toBe(3);

    const year = buildPeriodAnalytics({
      period: 'YEAR',
      dailyHistory: sampleHistory,
      workoutStats: sampleWorkoutStats,
      exerciseTotals: sampleExerciseTotals,
      anchorDate: anchor,
    });
    expect(year.buckets).toHaveLength(12);
    expect(year.totalReps).toBe(65); // 2025-10-01 is > 12 months before 2026-11-16
    expect(year.activeDays).toBe(3);

    const all = buildPeriodAnalytics({
      period: 'ALL',
      dailyHistory: sampleHistory,
      workoutStats: sampleWorkoutStats,
      exerciseTotals: sampleExerciseTotals,
      anchorDate: anchor,
    });
    expect(all.totalReps).toBe(115);
    expect(all.totalHoldSeconds).toBe(70);
    expect(all.estimatedKcal).toBe(69.5);
    expect(all.tonnageKg).toBe(650);
    expect(all.battlesWon).toBe(6);
    expect(all.circuitsCompleted).toBe(2);
    expect(all.coinsEarned).toBe(190);
    expect(all.durationSec).toBe(445);
    expect(all.activeDays).toBe(4);
    expect(all.buckets.length).toBeGreaterThanOrEqual(13); // includes 2025-10 + 12 months
  });

  it('persists per-exercise breakdown, durationSec, and circuits into dailyHistory via store', () => {
    const store = useGameStore.getState();
    store.recordWorkoutProgress({
      dateKey: '2026-11-16',
      exerciseId: 'OVERHEAD_PRESS',
      reps: 12,
      estimatedKcal: 6.4,
      tonnageKg: 120,
    });
    store.recordWorkoutProgress({
      dateKey: '2026-11-16',
      monstersDefeated: 1,
      coinsEarned: 50,
      circuitsCompleted: 1,
      durationSec: 75,
    });

    const updated = useGameStore.getState();
    const day = updated.dailyHistory['2026-11-16'];
    expect(day.reps).toBe(12);
    expect(day.estimatedKcal).toBe(6.4);
    expect(day.tonnageKg).toBe(120);
    expect(day.battlesWon).toBe(1);
    expect(day.coinsEarned).toBe(50);
    expect(day.circuitsCompleted).toBe(1);
    expect(day.durationSec).toBe(75);
    expect(day.exercises?.OVERHEAD_PRESS?.reps).toBe(12);
    expect(updated.workoutStats.totalEstimatedKcal).toBe(6.4);
    expect(updated.workoutStats.totalDurationSec).toBe(75);
    expect(updated.workoutStats.totalCoinsEarned).toBe(50);
  });
});
