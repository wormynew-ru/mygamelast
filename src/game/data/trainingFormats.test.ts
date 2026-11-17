import { describe, it, expect } from 'vitest';
import {
  BENCHMARK_DURATION_SEC,
  CADENCE_MODES,
  DEFAULT_TABATA_CONFIG,
  TABATA_PRESETS,
  calculateSlidingCadenceRpm,
  computeBenchmarkRating,
  computeFitnessConditioningIndex,
  computeTabataSnapshot,
  normalizeBenchmarks,
} from './trainingFormats';
import {
  CIRCUITS,
  MAX_CUSTOM_CIRCUITS,
  MAX_CUSTOM_CIRCUIT_ROOMS,
  MIN_CUSTOM_CIRCUIT_ROOMS,
  computeCustomCircuitRewards,
  normalizeCustomCircuits,
} from './circuits';

describe('trainingFormats & circuits domain logic', () => {
  it('computes deterministic Tabata snapshots across presets and omits trailing rest', () => {
    // CLASSIC_20_10: 20s work, 10s rest, 6 rounds => total = 5*30 + 20 = 170s
    const startSnap = computeTabataSnapshot(0, DEFAULT_TABATA_CONFIG);
    expect(startSnap.phase).toBe('WORK');
    expect(startSnap.round).toBe(1);
    expect(startSnap.totalRounds).toBe(6);
    expect(startSnap.remainingSec).toBe(20);
    expect(startSnap.finished).toBe(false);

    const restSnap = computeTabataSnapshot(21_000, DEFAULT_TABATA_CONFIG);
    expect(restSnap.phase).toBe('REST');
    expect(restSnap.round).toBe(1);
    expect(restSnap.remainingSec).toBe(9);
    expect(restSnap.finished).toBe(false);

    const powerWork2 = computeTabataSnapshot(46_000, {
      presetId: 'POWER_30_15',
      ...TABATA_PRESETS.POWER_30_15,
    });
    expect(powerWork2.phase).toBe('WORK');
    expect(powerWork2.round).toBe(2);

    const enduranceDone = computeTabataSnapshot(220_000, {
      presetId: 'ENDURANCE_40_20',
      ...TABATA_PRESETS.ENDURANCE_40_20,
    });
    expect(enduranceDone.finished).toBe(true);
    expect(enduranceDone.round).toBe(4);
    expect(enduranceDone.remainingSec).toBe(0);

    // Classic finishes cleanly at 170s (right after round 6 work bell)
    const classicDone = computeTabataSnapshot(170_000, DEFAULT_TABATA_CONFIG);
    expect(classicDone.finished).toBe(true);
  });

  it('computes sliding-window live RPM ignoring stale repetitions', () => {
    expect(calculateSlidingCadenceRpm([], 10_000)).toBe(0);

    // 10 reps spaced by 1s between 20_000 and 29_000, evaluated at 30_000 (window 20s -> all 10 inside, span 10s)
    const reps = Array.from({ length: 10 }, (_, idx) => 20_000 + idx * 1000);
    const rpm = calculateSlidingCadenceRpm(reps, 30_000);
    expect(rpm).toBe(60);

    // At 60_000 all reps are outside 20s window
    expect(calculateSlidingCadenceRpm(reps, 60_000)).toBe(0);
    expect(CADENCE_MODES.STEADY_60.beatIntervalMs).toBe(1000);
    expect(BENCHMARK_DURATION_SEC).toBe(60);
  });

  it('evaluates benchmark ratings and 0-100 Fitness Conditioning Index', () => {
    expect(computeBenchmarkRating('SQUAT', 15)).toBe('BRONZE');
    expect(computeBenchmarkRating('SQUAT', 22)).toBe('SILVER');
    expect(computeBenchmarkRating('SQUAT', 34)).toBe('GOLD');
    expect(computeBenchmarkRating('SQUAT', 45)).toBe('ELITE');
    expect(computeBenchmarkRating('PLANK', 58)).toBe('ELITE');

    expect(computeFitnessConditioningIndex({})).toBe(0);
    const singleElite = computeFitnessConditioningIndex({ SQUAT: 45 });
    expect(singleElite).toBe(75); // 100 * (0.7 + 1*0.05)

    const fullElite = computeFitnessConditioningIndex({
      SQUAT: 45,
      PUSH_UP: 42,
      PLANK: 58,
      JUMPING_JACK: 65,
      LUNGE: 38,
      HIGH_KNEES: 85,
    });
    expect(fullElite).toBe(100);
  });

  it('normalizes benchmark logs and recomputes rating safely', () => {
    const normalized = normalizeBenchmarks([
      { id: '1', dateKey: '2026-11-17', exerciseId: 'SQUAT', score: 36, avgCadenceRpm: 36 },
      { id: '2', dateKey: '2026-11-17', exerciseId: 'INVALID', score: 40, avgCadenceRpm: 40 },
      { id: '3', dateKey: '2026-11-17', exerciseId: 'PUSH_UP', score: 0, avgCadenceRpm: 0 },
    ]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].rating).toBe('GOLD');
  });

  it('preserves all 6 built-in circuits and enforces custom circuit bounds', () => {
    expect(CIRCUITS.map((c) => c.id)).toEqual([
      'UPPER_IRON',
      'STATIC_GAUNTLET',
      'FULL_BODY_BLITZ',
      'LOWER_POWER_SPLIT',
      'CARDIO_SHRED',
      'DUMBBELL_SCULPT',
    ]);

    expect(MIN_CUSTOM_CIRCUIT_ROOMS).toBe(2);
    expect(MAX_CUSTOM_CIRCUIT_ROOMS).toBe(6);
    expect(MAX_CUSTOM_CIRCUITS).toBe(6);

    const rewards3 = computeCustomCircuitRewards(3);
    expect(rewards3.bonusCoins).toBe(95);
    expect(rewards3.bonusXp).toBe(110);

    const rawCircuits = Array.from({ length: 8 }, (_, idx) => ({
      id: `c-${idx}`,
      name: `  My Circuit ${idx}  `,
      rooms: [
        { exerciseId: 'SQUAT', monsterId: 'BURGER', restAfterSec: 12 },
        { exerciseId: 'PLANK', monsterId: 'PIZZA', restAfterSec: 15 },
      ],
      createdAtDate: '2026-11-17',
    }));
    // Also inject an invalid 1-room circuit that should be dropped
    rawCircuits.unshift({
      id: 'too-short',
      name: 'Too Short',
      rooms: [{ exerciseId: 'SQUAT', monsterId: 'BURGER', restAfterSec: 10 }],
      createdAtDate: '2026-11-17',
    });

    const normalized = normalizeCustomCircuits(rawCircuits);
    expect(normalized).toHaveLength(MAX_CUSTOM_CIRCUITS);
    expect(normalized[0].name).toBe('My Circuit 0');
    expect(normalized[0].rooms[1].restAfterSec).toBe(0);
  });
});
