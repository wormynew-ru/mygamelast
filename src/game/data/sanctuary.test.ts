import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateNewAchievements } from './achievements';
import { createInitialGardenState } from './garden';
import {
  SANCTUARY_LAB_TIERS,
  SANCTUARY_MIX_BLUEPRINTS,
  SANCTUARY_MIX_MAP,
  createInitialMixInventory,
  createInitialSanctuaryState,
  createInitialTrophyInventory,
  getActiveSanctuarySynergies,
  getAggregatedSanctuaryBuffs,
  getMixEffectiveHeal,
  getSanctuaryDamageMultiplierForExercise,
  getTotalCropCount,
  getTotalMixCount,
  getTotalTrophyCount,
  getTrophyForArchetype,
  isMixReadyToCraft,
  normalizeSanctuaryState,
} from './sanctuary';
import { useGameStore } from '../store';

describe('Sanctuary botanical mix lab & store integration', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().resetGame();
  });

  it('computes total harvested crop, trophy, and mix counts accurately', () => {
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
        TITAN_BREW: 3,
      })
    ).toBe(7);

    expect(
      getTotalTrophyCount({
        TROPHY_FIZZ_CORE: 2,
        TROPHY_GLAZE_SHELL: 1,
        TROPHY_CAPSAICIN_DROP: 0,
        TROPHY_CROWN_SPICE: 1,
      })
    ).toBe(4);

    expect(getTrophyForArchetype('FAST')).toBe('TROPHY_FIZZ_CORE');
    expect(getTrophyForArchetype('ARMORED')).toBe('TROPHY_GLAZE_SHELL');
    expect(getTrophyForArchetype('TOXIC')).toBe('TROPHY_CAPSAICIN_DROP');
    expect(getTrophyForArchetype('BOSS')).toBe('TROPHY_CROWN_SPICE');
  });

  it('checks crop and monster trophy readiness accurately for all Sanctuary mixes', () => {
    const mintIsotonic = SANCTUARY_MIX_BLUEPRINTS.find((b) => b.id === 'MINT_ISOTONIC')!;
    const lotusNectar = SANCTUARY_MIX_BLUEPRINTS.find((b) => b.id === 'LOTUS_NECTAR')!;
    const titanBrew = SANCTUARY_MIX_MAP.TITAN_BREW;
    const glassOverdrive = SANCTUARY_MIX_MAP.GLASS_OVERDRIVE;

    const partialCrops = {
      PROTEIN_MINT: 1,
      IRON_BAMBOO: 0,
      CHILI_PEPPER: 0,
      GOLDEN_LOTUS: 1,
    };
    expect(isMixReadyToCraft(partialCrops, mintIsotonic)).toBe(false);
    expect(isMixReadyToCraft(partialCrops, lotusNectar)).toBe(false);

    const readyCrops = {
      PROTEIN_MINT: 2,
      IRON_BAMBOO: 2,
      CHILI_PEPPER: 2,
      GOLDEN_LOTUS: 1,
    };
    expect(isMixReadyToCraft(readyCrops, mintIsotonic)).toBe(true);
    expect(isMixReadyToCraft(readyCrops, lotusNectar)).toBe(true);

    // Trophy-gated mixes require both crops and matching archetype trophies
    expect(isMixReadyToCraft(readyCrops, titanBrew, {})).toBe(false);
    expect(isMixReadyToCraft(readyCrops, titanBrew, { TROPHY_GLAZE_SHELL: 1 })).toBe(true);

    expect(
      isMixReadyToCraft(readyCrops, glassOverdrive, { TROPHY_FIZZ_CORE: 1 })
    ).toBe(false);
    expect(
      isMixReadyToCraft(readyCrops, glassOverdrive, {
        TROPHY_FIZZ_CORE: 1,
        TROPHY_CROWN_SPICE: 1,
      })
    ).toBe(true);
  });

  it('scales mix healing by lab tier and aggregates multi-buff stats with Tier 3 Ultimate bonus', () => {
    const mint = SANCTUARY_MIX_MAP.MINT_ISOTONIC;
    expect(getMixEffectiveHeal(mint, 1)).toBe(35);
    expect(getMixEffectiveHeal(mint, 2)).toBe(44);
    expect(getMixEffectiveHeal(mint, 3)).toBe(53);

    const tier3Empty = getAggregatedSanctuaryBuffs([], 3);
    expect(tier3Empty.startingUltimateCharge).toBe(0);
    expect(tier3Empty.xpMultiplier).toBe(1.0);
    expect(tier3Empty.activeSynergies).toEqual([]);

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

  it('activates all 7 slot synergies, discipline multipliers, and risky mutagen trade-offs', () => {
    expect(getActiveSanctuarySynergies(['MINT_ISOTONIC'])).toEqual([]);

    const isoRhythm = getAggregatedSanctuaryBuffs(['MINT_ISOTONIC', 'PULSE_FIZZ'], 2);
    expect(isoRhythm.activeSynergies).toEqual(['ISOTONIC_RHYTHM']);
    expect(isoRhythm.startingCombo).toBe(3);
    expect(isoRhythm.comboWindowBonusMs).toBe(2300);
    expect(getSanctuaryDamageMultiplierForExercise(isoRhythm, 'JUMPING_JACK')).toBe(1.45);
    expect(getSanctuaryDamageMultiplierForExercise(isoRhythm, 'SQUAT')).toBe(1.0);

    const ironBastion = getAggregatedSanctuaryBuffs(['BAMBOO_FORTIFIER', 'MONOLITH_ELIXIR'], 2);
    expect(ironBastion.activeSynergies).toEqual(['IRON_BASTION']);
    expect(ironBastion.thornsReflectDamage).toBe(8);
    expect(ironBastion.thornsUltChargeGain).toBe(10);
    expect(ironBastion.blockMitigationOverride).toBe(0.9);
    expect(ironBastion.toxicCleanseHoldTicksOverride).toBe(1);
    expect(getSanctuaryDamageMultiplierForExercise(ironBastion, 'PLANK')).toBe(1.4);

    const powerSurge = getAggregatedSanctuaryBuffs(['TITAN_BREW', 'CHILI_OVERDRIVE_SHOT'], 2);
    expect(powerSurge.activeSynergies).toEqual(['POWER_SURGE']);
    expect(powerSurge.ultimateDamageMultiplierOverride).toBe(2.1);
    expect(powerSurge.breakAllShieldsOnUlt).toBe(true);
    expect(powerSurge.shieldBreakBonus).toBe(1);
    expect(powerSurge.dumbbellDamageBonus).toBe(0.15);
    expect(getSanctuaryDamageMultiplierForExercise(powerSurge, 'OVERHEAD_PRESS')).toBe(1.35);

    const adrenaline = getAggregatedSanctuaryBuffs(['BAMBOO_FORTIFIER', 'BERSERK_CAPSAICIN'], 2);
    expect(adrenaline.activeSynergies).toEqual(['ADRENALINE_GUARD']);
    expect(adrenaline.hasRiskyMutagen).toBe(true);
    // 0.75 (Bamboo) * 1.25 (Berserk) * 0.85 (Synergy) = 0.796875 -> 0.797
    expect(adrenaline.incomingDamageMultiplier).toBe(0.797);

    const pureFury = getAggregatedSanctuaryBuffs(['BERSERK_CAPSAICIN', 'GLASS_OVERDRIVE'], 2);
    expect(pureFury.activeSynergies).toEqual(['PURE_FURY']);
    expect(pureFury.highComboCritBonus).toBe(0.2);
    expect(pureFury.critMultiplierBonus).toBe(0.5);
    expect(pureFury.maxHpMultiplier).toBe(0.8);

    const endless = getAggregatedSanctuaryBuffs(['ARENA_TONIC', 'LOTUS_NECTAR'], 2);
    expect(endless.activeSynergies).toEqual(['ENDLESS_ENDURANCE']);
    expect(endless.healOnWaveClear).toBe(10);
    expect(endless.healOnUlt).toBe(4);
    expect(endless.coinMultiplier).toBe(1.25);

    const triumvirate = getAggregatedSanctuaryBuffs(
      ['MINT_ISOTONIC', 'TITAN_BREW', 'GREED_EXTRACT'],
      3
    );
    expect(triumvirate.activeSynergies).toEqual(['ALCHEMIST_TRIUMVIRATE']);
    expect(triumvirate.globalDamageMultiplier).toBe(1.12);
    expect(triumvirate.xpMultiplier).toBe(1.667);
    expect(triumvirate.coinMultiplier).toBe(1.725);
    expect(triumvirate.armorPierceRatio).toBe(0.5);
    // 1.12 * 1.35 (Strength) * 1.4 (2 Toxic Surge stacks) = 2.117
    expect(getSanctuaryDamageMultiplierForExercise(triumvirate, 'SQUAT', 0.4)).toBe(2.117);
  });

  it('normalizes legacy or corrupted sanctuary state safely across all 12 mixes and trophies', () => {
    const normalized = normalizeSanctuaryState({
      labTier: 1,
      mixInventory: {
        MINT_ISOTONIC: 2.8,
        BAMBOO_FORTIFIER: -3,
        CHILI_OVERDRIVE_SHOT: 1,
        LOTUS_NECTAR: 0,
      } as Partial<Record<keyof typeof SANCTUARY_MIX_MAP, number>> as Record<
        keyof typeof SANCTUARY_MIX_MAP,
        number
      >,
      trophyInventory: {
        TROPHY_FIZZ_CORE: 3.9,
        TROPHY_GLAZE_SHELL: -1,
        TROPHY_CAPSAICIN_DROP: 2,
        TROPHY_CROWN_SPICE: 0,
      },
      activeBuffs: ['MINT_ISOTONIC', 'MINT_ISOTONIC', 'BAMBOO_FORTIFIER'],
      healedBuffIds: ['MINT_ISOTONIC', 'BAMBOO_FORTIFIER'],
      totalCrafted: 5.4,
      totalSynergiesActivated: 2.7,
    });

    expect(normalized.labTier).toBe(1);
    expect(normalized.mixInventory).toEqual({
      ...createInitialMixInventory(),
      MINT_ISOTONIC: 2,
      CHILI_OVERDRIVE_SHOT: 1,
    });
    expect(normalized.trophyInventory).toEqual({
      ...createInitialTrophyInventory(),
      TROPHY_FIZZ_CORE: 3,
      TROPHY_CAPSAICIN_DROP: 2,
    });
    expect(normalized.activeBuffs).toEqual(['MINT_ISOTONIC']);
    expect(normalized.healedBuffIds).toEqual(['MINT_ISOTONIC']);
    expect(normalized.totalCrafted).toBe(5);
    expect(normalized.totalSynergiesActivated).toBe(2);

    const fresh = createInitialSanctuaryState();
    expect(fresh.activeBuffs).toEqual([]);
    expect(fresh.healedBuffIds).toEqual([]);
    expect(fresh.trophyInventory).toEqual(createInitialTrophyInventory());
    expect(fresh.totalSynergiesActivated).toBe(0);
  });

  it('crafts trophy mixes, unarms without double-heal exploit, tracks synergies, and unlocks achievements', () => {
    useGameStore.setState((state) => ({
      coins: 500,
      player: { ...state.player, hp: 50, maxHp: 100 },
      garden: {
        ...createInitialGardenState(),
        cropInventory: {
          PROTEIN_MINT: 8,
          IRON_BAMBOO: 6,
          CHILI_PEPPER: 4,
          GOLDEN_LOTUS: 2,
        },
      },
    }));

    // Add monster trophies and craft a trophy-gated Discipline mix
    useGameStore.getState().addMonsterTrophy('TROPHY_FIZZ_CORE', 2);
    useGameStore.getState().addMonsterTrophy('TROPHY_GLAZE_SHELL', 1);
    expect(useGameStore.getState().craftMix('TITAN_BREW')).toBe(true);
    expect(useGameStore.getState().sanctuary.trophyInventory.TROPHY_GLAZE_SHELL).toBe(0);

    // Craft 2 more mixes -> unlocks BOTANICAL_ALCHEMIST
    expect(useGameStore.getState().craftMix('MINT_ISOTONIC')).toBe(true);
    expect(useGameStore.getState().craftMix('PULSE_FIZZ')).toBe(true);

    const afterCraft = useGameStore.getState();
    expect(afterCraft.sanctuary.totalCrafted).toBe(3);
    expect(afterCraft.unlockedAchievements).toContain('BOTANICAL_ALCHEMIST');

    // Tier 1 allows 1 slot: arm MINT_ISOTONIC (+35 HP -> 85)
    const firstArm = useGameStore.getState().activateMixBuff('MINT_ISOTONIC');
    expect(firstArm).toEqual({ healedHp: 35 });
    expect(useGameStore.getState().player.hp).toBe(85);
    expect(useGameStore.getState().activateMixBuff('PULSE_FIZZ')).toBeNull();

    // Deactivating returns the vial to inventory, then damaging HP & re-arming must NOT re-heal
    expect(useGameStore.getState().deactivateMixBuff('MINT_ISOTONIC')).toBe(true);
    expect(useGameStore.getState().sanctuary.mixInventory.MINT_ISOTONIC).toBe(1);
    expect(useGameStore.getState().sanctuary.healedBuffIds).toEqual(['MINT_ISOTONIC']);
    useGameStore.getState().updatePlayer({ hp: 40 });
    expect(useGameStore.getState().activateMixBuff('MINT_ISOTONIC')).toEqual({ healedHp: 0 });
    expect(useGameStore.getState().player.hp).toBe(40);

    // Upgrade to Tier 2 -> arm PULSE_FIZZ -> activates ISOTONIC_RHYTHM synergy + SYNERGY_ARCHITECT
    expect(useGameStore.getState().upgradeSanctuaryLab()).toBe(true);
    expect(useGameStore.getState().sanctuary.labTier).toBe(2);
    expect(useGameStore.getState().coins).toBe(500 - SANCTUARY_LAB_TIERS[2].upgradeCost);

    const secondArm = useGameStore.getState().activateMixBuff('PULSE_FIZZ');
    expect(secondArm).toEqual({ healedHp: 19 });
    expect(useGameStore.getState().player.hp).toBe(59);
    expect(useGameStore.getState().sanctuary.activeBuffs).toEqual(['MINT_ISOTONIC', 'PULSE_FIZZ']);
    expect(useGameStore.getState().sanctuary.totalSynergiesActivated).toBe(1);
    expect(useGameStore.getState().unlockedAchievements).toContain('SYNERGY_ARCHITECT');

    // Crafting 7 more cheap mixes hits 10 totalCrafted -> unlocks MASTER_ALCHEMIST
    useGameStore.setState((state) => ({
      garden: {
        ...state.garden,
        cropInventory: {
          ...state.garden.cropInventory,
          PROTEIN_MINT: 20,
        },
      },
    }));
    for (let i = 0; i < 7; i++) {
      expect(useGameStore.getState().craftMix('MINT_ISOTONIC')).toBe(true);
    }
    const masterState = useGameStore.getState();
    expect(masterState.sanctuary.totalCrafted).toBe(10);
    expect(masterState.unlockedAchievements).toContain('MASTER_ALCHEMIST');
    expect(
      evaluateNewAchievements({ ...masterState, unlockedAchievements: [] })
    ).toContain('MASTER_ALCHEMIST');

    // Consuming buffs clears both activeBuffs and healedBuffIds
    useGameStore.getState().consumeActiveSanctuaryBuffs();
    expect(useGameStore.getState().sanctuary.activeBuffs).toEqual([]);
    expect(useGameStore.getState().sanctuary.healedBuffIds).toEqual([]);
  });
});
