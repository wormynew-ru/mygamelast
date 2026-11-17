import { describe, it, expect } from 'vitest';
import {
  MUTATOR_ORDER,
  TRAINING_PROGRAMS,
  getAggregatedMutatorEffects,
  getISOWeekKey,
  getWeeklyChallengeForWeek,
  pickBetterRank,
} from './programs';

describe('Programs, Mutators & Weekly Challenge', () => {
  it('defines 3-to-7 day training programs covering new exercises', () => {
    expect(TRAINING_PROGRAMS.length).toBe(4);
    expect(TRAINING_PROGRAMS[0].durationDays).toBe(3);
    expect(TRAINING_PROGRAMS[3].durationDays).toBe(7);
    const exercisesUsed = TRAINING_PROGRAMS.flatMap((p) => p.days.map((d) => d.exerciseId));
    expect(exercisesUsed).toContain('LUNGE');
    expect(exercisesUsed).toContain('HIGH_KNEES');
    expect(exercisesUsed).toContain('FRONT_RAISE');
  });

  it('aggregates mutator risk and reward multipliers multiplicatively', () => {
    expect(MUTATOR_ORDER.length).toBe(5);
    const eff = getAggregatedMutatorEffects(['GLASS_CANNON', 'IRON_FOES']);
    expect(eff.xpMultiplier).toBe(1.5);
    expect(eff.coinMultiplier).toBe(1.5);
    expect(eff.playerDefenseDelta).toBe(-2);
    expect(eff.enemyAttackMultiplier).toBeGreaterThan(1.4);
  });

  it('produces deterministic ISO week keys and seeded weekly challenges', () => {
    const key1 = getISOWeekKey(new Date('2026-04-08T12:00:00Z'));
    const key2 = getISOWeekKey(new Date('2026-04-10T12:00:00Z'));
    expect(key1).toBe(key2);

    const specA = getWeeklyChallengeForWeek('2026-W15');
    const specB = getWeeklyChallengeForWeek('2026-W15');
    expect(specA).toEqual(specB);
    expect(specA.mutators.length).toBeGreaterThanOrEqual(1);

    expect(pickBetterRank('B', 'S')).toBe('S');
    expect(pickBetterRank('S', 'A')).toBe('S');
  });
});
