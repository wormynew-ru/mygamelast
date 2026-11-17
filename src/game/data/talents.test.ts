import { describe, it, expect } from 'vitest';
import {
  TALENTS,
  canUpgradeTalent,
  createInitialTalentState,
  getAggregatedTalentModifiers,
  getAvailableTalentPoints,
  getTotalTalentPointsForLevel,
  normalizeTalentState,
} from './talents';

describe('Talents System', () => {
  it('defines 12 talents across MIGHT, BASTION, and BOTANY branches', () => {
    expect(TALENTS.length).toBe(12);
    expect(TALENTS.filter((t) => t.branch === 'MIGHT').length).toBe(4);
    expect(TALENTS.filter((t) => t.branch === 'BASTION').length).toBe(4);
    expect(TALENTS.filter((t) => t.branch === 'BOTANY').length).toBe(4);
  });

  it('grants 1 point per hero level beyond level 1 and enforces prerequisites', () => {
    expect(getTotalTalentPointsForLevel(1)).toBe(0);
    expect(getTotalTalentPointsForLevel(6)).toBe(5);

    const state = createInitialTalentState();
    expect(getAvailableTalentPoints(6, state)).toBe(5);
    expect(canUpgradeTalent(6, state, 'MIGHT_STRIKE')).toBe(true);
    expect(canUpgradeTalent(6, state, 'MIGHT_CRIT_EDGE')).toBe(false);

    state.ranks.MIGHT_STRIKE = 1;
    state.spentPoints = 1;
    expect(canUpgradeTalent(6, state, 'MIGHT_CRIT_EDGE')).toBe(true);
    expect(canUpgradeTalent(6, state, 'MIGHT_OVERDRIVE')).toBe(false);
  });

  it('aggregates combat, economy, and garden bonuses cleanly', () => {
    const mods = getAggregatedTalentModifiers({
      ranks: {
        MIGHT_STRIKE: 2,
        MIGHT_CRIT_EDGE: 2,
        MIGHT_EXECUTIONER: 1,
        BASTION_VITALITY: 2,
        BOTANY_FORTUNE: 2,
        BOTANY_GREEN_THUMB: 1,
      },
      spentPoints: 10,
    });
    expect(mods.attackBonus).toBe(4);
    expect(mods.critChanceBonus).toBe(0.08);
    expect(mods.executeDamageBonus).toBe(0.18);
    expect(mods.maxHpBonus).toBe(30);
    expect(mods.coinMultiplier).toBe(1.2);
    expect(mods.gardenMutationBonusChance).toBe(0.08);
  });

  it('normalizes legacy or overspent talent budgets safely', () => {
    const normalized = normalizeTalentState(
      { ranks: { MIGHT_STRIKE: 3, MIGHT_OVERDRIVE: 2 }, spentPoints: 99 },
      3
    );
    expect(normalized.spentPoints).toBe(2);
    expect(normalized.ranks.MIGHT_STRIKE).toBe(2);
    expect(normalized.ranks.MIGHT_OVERDRIVE).toBeUndefined();
  });
});
