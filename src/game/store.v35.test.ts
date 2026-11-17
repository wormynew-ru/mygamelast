import { describe, it, expect, beforeEach } from 'vitest';
import { SAVE_SCHEMA_VERSION, migrateGameState, selectEffectivePlayerStats, useGameStore } from './store';

describe('Store v3.5 Meta Progression & Migration v13 -> v14', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  it('migrates v13 saves cleanly and preserves hero level for retroactive talent points', () => {
    const legacyV13 = {
      coins: 240,
      player: {
        level: 5,
        xp: 20,
        xpToNextLevel: 1118,
        hp: 140,
        maxHp: 140,
        attack: 18,
        defense: 9,
        critChance: 0.15,
        critMultiplier: 1.5,
      },
      inventory: {
        items: { __type: 'Map', entries: [['ENERGY_BAR', 3]] },
        equippedItems: [],
      },
    };

    const migrated = migrateGameState(legacyV13, 13);
    expect(migrated.coins).toBe(240);
    expect(migrated.inventory.items.get('ENERGY_BAR')).toBe(3);
    expect(migrated.talents.spentPoints).toBe(0);
    expect(migrated.artifacts.unlockedIds).toEqual([]);
    expect(migrated.settings.exerciseCalibration.lungeBottomAngle).toBe(95);
    expect(migrated.settings.exerciseCalibration.highKneesLiftAngle).toBe(110);
    expect(migrated.settings.exerciseCalibration.frontRaisePeakAngle).toBe(85);
    expect(migrated.settings.scriptedPoseEnabled).toBe(false);
    expect(SAVE_SCHEMA_VERSION).toBe(14);
  });

  it('supports talent upgrades, effective stats boost, and Fit-Coin respec', () => {
    const store = useGameStore.getState();
    store.updatePlayer({ level: 4 });
    store.addCoins(200);

    expect(useGameStore.getState().upgradeTalent('MIGHT_STRIKE')).toBe(true);
    expect(useGameStore.getState().upgradeTalent('MIGHT_CRIT_EDGE')).toBe(true);
    expect(useGameStore.getState().talents.spentPoints).toBe(2);

    const eff = selectEffectivePlayerStats(useGameStore.getState());
    expect(eff.attack).toBe(12);
    expect(eff.critChance).toBeGreaterThan(0.15);

    expect(useGameStore.getState().respecTalents()).toBe(true);
    expect(useGameStore.getState().talents.spentPoints).toBe(0);
    expect(useGameStore.getState().coins).toBe(100);
  });

  it('enforces 2-slot cap for Endgame Artifacts', () => {
    const store = useGameStore.getState();
    expect(store.unlockArtifact('PHOENIX_BAND')).toBe(true);
    expect(store.unlockArtifact('TITAN_CORE')).toBe(true);
    expect(store.unlockArtifact('BERSERKER_SIGIL')).toBe(true);

    expect(useGameStore.getState().equipArtifact('PHOENIX_BAND')).toBe(true);
    expect(useGameStore.getState().equipArtifact('TITAN_CORE')).toBe(true);
    expect(useGameStore.getState().equipArtifact('BERSERKER_SIGIL')).toBe(false);

    expect(useGameStore.getState().unequipArtifact('PHOENIX_BAND')).toBe(true);
    expect(useGameStore.getState().equipArtifact('BERSERKER_SIGIL')).toBe(true);
  });

  it('advances Training Programs through completion and grants bonus rewards', () => {
    useGameStore.getState().startProgram('STARTER_3D', '2026-04-08');
    expect(useGameStore.getState().programs.active?.programId).toBe('STARTER_3D');

    const d1 = useGameStore.getState().advanceProgramDay(0);
    expect(d1?.completedProgram).toBe(false);
    const d2 = useGameStore.getState().advanceProgramDay(1);
    expect(d2?.completedProgram).toBe(false);
    const d3 = useGameStore.getState().advanceProgramDay(2);
    expect(d3?.completedProgram).toBe(true);

    expect(useGameStore.getState().programs.active).toBeNull();
    expect(useGameStore.getState().programs.totalProgramsFinished).toBe(1);
    expect(useGameStore.getState().programs.completedProgramIds).toContain('STARTER_3D');
  });

  it('tracks Mutators (max 3), Weekly Challenge, Personal Records, Presets, and Alchemy Orders', () => {
    const store = useGameStore.getState();
    store.toggleMutator('GLASS_CANNON');
    store.toggleMutator('IRON_FOES');
    store.toggleMutator('BLITZ_CLOCK');
    store.toggleMutator('TOXIC_MIST'); // Exceeds max 3
    expect(useGameStore.getState().activeMutators.length).toBe(3);

    const weekly = useGameStore.getState().completeWeeklyChallenge('2026-W15', 'S');
    expect(weekly.firstCompletion).toBe(true);
    expect(weekly.unlockedArtifactId).toBe('VAMPIRIC_FANG');

    const broken = useGameStore.getState().recordPersonalRecords({
      exerciseId: 'LUNGE',
      battleReps: 18,
      holdSec: 0,
      maxCombo: 9,
      weightKg: 5,
      bestHitDamage: 64,
    });
    expect(broken).toContain('REPS');
    expect(broken).toContain('HIT');
    expect(useGameStore.getState().personalRecords.LUNGE.bestBattleReps).toBe(18);
  });

  it('saves/applies Sanctuary presets and fulfills Daily Alchemy Orders', () => {
    useGameStore.setState((s) => ({
      garden: {
        ...s.garden,
        cropInventory: {
          ...s.garden.cropInventory,
          PROTEIN_MINT: 10,
          IRON_BAMBOO: 10,
          CHILI_PEPPER: 10,
        },
      },
      sanctuary: {
        ...s.sanctuary,
        labTier: 2,
        mixInventory: {
          ...s.sanctuary.mixInventory,
          MINT_ISOTONIC: 3,
          BAMBOO_FORTIFIER: 2,
        },
        trophyInventory: {
          ...s.sanctuary.trophyInventory,
          TROPHY_FIZZ_CORE: 5,
          TROPHY_GLAZE_SHELL: 5,
          TROPHY_CAPSAICIN_DROP: 5,
        },
      },
    }));

    expect(useGameStore.getState().activateMixBuff('MINT_ISOTONIC')).not.toBeNull();
    expect(useGameStore.getState().saveSanctuaryPreset(0, 'Cardio Pack')).toBe(true);
    expect(useGameStore.getState().deactivateMixBuff('MINT_ISOTONIC')).toBe(true);
    expect(useGameStore.getState().applySanctuaryPreset(0)).toBe(true);
    expect(useGameStore.getState().sanctuary.activeBuffs).toEqual(['MINT_ISOTONIC']);

    const orderResult = useGameStore.getState().completeAlchemyOrder('2026-04-08');
    expect(orderResult).not.toBeNull();
    expect(useGameStore.getState().sanctuary.completedOrdersCount).toBe(1);
  });
});
