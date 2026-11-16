import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateNewAchievements } from './achievements';
import { createInitialGardenState } from './garden';
import {
  SANCTUARY_LAB_TIERS,
  SANCTUARY_MIX_BLUEPRINTS,
  SANCTUARY_MIX_MAP,
  createInitialSanctuaryState,
  getAggregatedSanctuaryBuffs,
  getMixEffectiveHeal,
  getTotalCropCount,
  getTotalMixCount,
  isMixReadyToCraft,
  normalizeSanctuaryState,
} from './sanctuary';
import { useGameStore } from '../store';

describe('Sanctuary botanical mix lab & store integration', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().resetGame();
  });

  it('computes total harvested crop and mix counts accurately', () => {
    expect(
      getTotalCropCount({
        PROTEIN_MINT: 2,
        IRON_BAMBOO: 1,
        CHILI_PEPPER: 3,
        GOLDEN_LOTUS: 0,
      })
    ).toBe(6);

    expect(
      getTotalMixCount({
        MINT_ISOTONIC: 1,
        BAMBOO_FORTIFIER: 2,
        CHILI_OVERDRIVE_SHOT: 0,
        LOTUS_NECTAR: 1,
      })
    ).toBe(4);
  });

  it('checks ingredient readiness accurately for planned Sanctuary mixes', () => {
    const mintIsotonic = SANCTUARY_MIX_BLUEPRINTS.find((b) => b.id === 'MINT_ISOTONIC')!;
    const lotusNectar = SANCTUARY_MIX_BLUEPRINTS.find((b) => b.id === 'LOTUS_NECTAR')!;

    const partial = {
      PROTEIN_MINT: 1,
      IRON_BAMBOO: 0,
      CHILI_PEPPER: 0,
      GOLDEN_LOTUS: 1,
    };
    expect(isMixReadyToCraft(partial, mintIsotonic)).toBe(false);
    expect(isMixReadyToCraft(partial, lotusNectar)).toBe(false);

    const ready = {
      PROTEIN_MINT: 2,
      IRON_BAMBOO: 2,
      CHILI_PEPPER: 1,
      GOLDEN_LOTUS: 1,
    };
    expect(isMixReadyToCraft(ready, mintIsotonic)).toBe(true);
    expect(isMixReadyToCraft(ready, lotusNectar)).toBe(true);
  });

  it('scales mix healing by lab tier and aggregates multi-buff stats with Tier 3 Ultimate bonus', () => {
    const mint = SANCTUARY_MIX_MAP.MINT_ISOTONIC;
    expect(getMixEffectiveHeal(mint, 1)).toBe(35);
    expect(getMixEffectiveHeal(mint, 2)).toBe(44);
    expect(getMixEffectiveHeal(mint, 3)).toBe(53);

    const tier3Empty = getAggregatedSanctuaryBuffs([], 3);
    expect(tier3Empty.startingUltimateCharge).toBe(0);
    expect(tier3Empty.xpMultiplier).toBe(1.0);

    const stacked = getAggregatedSanctuaryBuffs(
      ['MINT_ISOTONIC', 'BAMBOO_FORTIFIER', 'LOTUS_NECTAR'],
      3
    );
    expect(stacked.attackBonus).toBe(5);
    expect(stacked.defenseBonus).toBe(7);
    expect(stacked.critChanceBonus).toBe(0.1);
    expect(stacked.comboWindowBonusMs).toBe(1000);
    expect(stacked.incomingDamageMultiplier).toBe(0.75);
    expect(stacked.ultimateChargeMultiplier).toBe(1.25);
    // 30 (Lotus) + 15 (Lab Tier 3 bonus)
    expect(stacked.startingUltimateCharge).toBe(45);
    expect(stacked.xpMultiplier).toBe(1.3);
  });

  it('normalizes legacy or corrupted sanctuary state safely without exceeding tier buff slot limits', () => {
    const normalized = normalizeSanctuaryState({
      labTier: 1,
      mixInventory: {
        MINT_ISOTONIC: 2.8,
        BAMBOO_FORTIFIER: -3,
        CHILI_OVERDRIVE_SHOT: 1,
        LOTUS_NECTAR: 0,
      },
      activeBuffs: ['MINT_ISOTONIC', 'MINT_ISOTONIC', 'BAMBOO_FORTIFIER'],
      totalCrafted: 5.4,
    });

    expect(normalized.labTier).toBe(1);
    expect(normalized.mixInventory).toEqual({
      MINT_ISOTONIC: 2,
      BAMBOO_FORTIFIER: 0,
      CHILI_OVERDRIVE_SHOT: 1,
      LOTUS_NECTAR: 0,
    });
    expect(normalized.activeBuffs).toEqual(['MINT_ISOTONIC']);
    expect(normalized.totalCrafted).toBe(5);
    expect(createInitialSanctuaryState().activeBuffs).toEqual([]);
  });

  it('crafts mixes from crops, upgrades lab tiers, arms buffs up to slot cap, heals HP, unlocks BOTANICAL_ALCHEMIST, and consumes active buffs', () => {
    useGameStore.setState((state) => ({
      coins: 500,
      player: { ...state.player, hp: 50, maxHp: 100 },
      garden: {
        ...createInitialGardenState(),
        cropInventory: {
          PROTEIN_MINT: 6,
          IRON_BAMBOO: 3,
          CHILI_PEPPER: 2,
          GOLDEN_LOTUS: 1,
        },
      },
    }));

    // Craft 3 mixes -> deducts crops and unlocks BOTANICAL_ALCHEMIST
    expect(useGameStore.getState().craftMix('MINT_ISOTONIC')).toBe(true);
    expect(useGameStore.getState().craftMix('BAMBOO_FORTIFIER')).toBe(true);
    expect(useGameStore.getState().craftMix('CHILI_OVERDRIVE_SHOT')).toBe(true);

    const afterCraft = useGameStore.getState();
    expect(afterCraft.garden.cropInventory).toEqual({
      PROTEIN_MINT: 3, // 6 - 2 (Mint) - 1 (Bamboo)
      IRON_BAMBOO: 0, // 3 - 2 (Bamboo) - 1 (Chili)
      CHILI_PEPPER: 0, // 2 - 2 (Chili)
      GOLDEN_LOTUS: 1,
    });
    expect(afterCraft.sanctuary.totalCrafted).toBe(3);
    expect(afterCraft.unlockedAchievements).toContain('BOTANICAL_ALCHEMIST');
    expect(
      evaluateNewAchievements({ ...afterCraft, unlockedAchievements: [] })
    ).toContain('BOTANICAL_ALCHEMIST');

    // Tier 1 allows only 1 active buff slot
    const firstArm = useGameStore.getState().activateMixBuff('MINT_ISOTONIC');
    expect(firstArm).toEqual({ healedHp: 35 });
    expect(useGameStore.getState().player.hp).toBe(85);
    expect(useGameStore.getState().activateMixBuff('BAMBOO_FORTIFIER')).toBeNull();

    // Upgrade to Tier 2 (cost 120 coins) -> unlocks 2nd buff slot
    expect(useGameStore.getState().upgradeSanctuaryLab()).toBe(true);
    expect(useGameStore.getState().sanctuary.labTier).toBe(2);
    expect(useGameStore.getState().coins).toBe(500 - SANCTUARY_LAB_TIERS[2].upgradeCost);

    const secondArm = useGameStore.getState().activateMixBuff('BAMBOO_FORTIFIER');
    // Tier 2 heals 15 * 1.25 = 19 -> clamped to maxHp 100 (from 85 -> 100, +15 actual HP)
    expect(secondArm).toEqual({ healedHp: 15 });
    expect(useGameStore.getState().player.hp).toBe(100);
    expect(useGameStore.getState().sanctuary.activeBuffs).toEqual([
      'MINT_ISOTONIC',
      'BAMBOO_FORTIFIER',
    ]);

    // Consuming buffs after battle clears activeBuffs cleanly
    useGameStore.getState().consumeActiveSanctuaryBuffs();
    expect(useGameStore.getState().sanctuary.activeBuffs).toEqual([]);
  });
});
