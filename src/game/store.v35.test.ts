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
    expect(migrated.settings.cadenceMode).toBe('OFF');
    expect(migrated.settings.warmUpEnabled).toBe(false);
    expect(migrated.customCircuits).toEqual([]);
    expect(migrated.benchmarks).toEqual([]);
    expect(migrated.bestBenchmarkByExercise).toEqual({});
    expect(migrated.workoutStats.tabataCompleted).toBe(0);
    expect(SAVE_SCHEMA_VERSION).toBe(16);
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

  it('migrates v14 -> v15 and manages custom circuits and 60s Fitness Benchmarks', () => {
    const migratedV15 = migrateGameState(
      {
        coins: 500,
        settings: { soundEnabled: true, cadenceMode: 'STEADY_60', warmUpEnabled: true },
      },
      14
    );
    expect(migratedV15.coins).toBe(500);
    expect(migratedV15.settings.cadenceMode).toBe('STEADY_60');
    expect(migratedV15.settings.warmUpEnabled).toBe(true);
    expect(migratedV15.customCircuits).toEqual([]);
    expect(migratedV15.benchmarks).toEqual([]);

    const store = useGameStore.getState();
    // Rejects < 2 rooms
    expect(
      store.saveCustomCircuit('Too short', [
        { exerciseId: 'SQUAT', monsterId: 'BURGER', restAfterSec: 0 },
      ])
    ).toBeNull();

    // Saves up to 6 circuits and unlocks CUSTOM_ARCHITECT
    for (let i = 0; i < 6; i++) {
      const created = useGameStore.getState().saveCustomCircuit(`Split ${i + 1}`, [
        { exerciseId: 'LUNGE', monsterId: 'DONUT', restAfterSec: 10 },
        { exerciseId: 'HIGH_KNEES', monsterId: 'SODA', restAfterSec: 0 },
      ]);
      expect(created).not.toBeNull();
    }
    expect(useGameStore.getState().customCircuits).toHaveLength(6);
    expect(useGameStore.getState().unlockedAchievements).toContain('CUSTOM_ARCHITECT');

    // 7th fails until one is deleted
    expect(
      useGameStore.getState().saveCustomCircuit('Extra', [
        { exerciseId: 'SQUAT', monsterId: 'BURGER', restAfterSec: 10 },
        { exerciseId: 'PLANK', monsterId: 'PIZZA', restAfterSec: 0 },
      ])
    ).toBeNull();
    const firstId = useGameStore.getState().customCircuits[0].id;
    useGameStore.getState().deleteCustomCircuit(firstId);
    expect(useGameStore.getState().customCircuits).toHaveLength(5);

    // Records 60s Fitness Benchmark and tracks personal bests + BENCHMARK_TESTED achievement
    const bm1 = useGameStore.getState().recordBenchmarkResult({
      exerciseId: 'SQUAT',
      score: 26,
      avgCadenceRpm: 26,
      dateKey: '2026-11-17',
    });
    expect(bm1.isNewBest).toBe(true);
    expect(bm1.entry.rating).toBe('SILVER');
    expect(useGameStore.getState().bestBenchmarkByExercise.SQUAT).toBe(26);
    expect(useGameStore.getState().unlockedAchievements).toContain('BENCHMARK_TESTED');

    const bm2 = useGameStore.getState().recordBenchmarkResult({
      exerciseId: 'SQUAT',
      score: 24,
      avgCadenceRpm: 24,
      dateKey: '2026-11-17',
    });
    expect(bm2.isNewBest).toBe(false);
    expect(useGameStore.getState().bestBenchmarkByExercise.SQUAT).toBe(26);
  });

  it('migrates v15 -> v16, clamps consumables to effective maxHp, and pays Stage Mastery bonuses once', () => {
    const migratedV16 = migrateGameState(
      {
        coins: 300,
        workoutStats: { totalParries: 4 },
      },
      15
    );
    expect(migratedV16.coins).toBe(300);
    expect(migratedV16.workoutStats.totalParries).toBe(4);
    expect(migratedV16.stageMastery).toEqual({});

    // Effective maxHp via Artifact (+40 maxHp from TITAN_CORE -> 140 maxHp)
    const store = useGameStore.getState();
    store.unlockArtifact('TITAN_CORE');
    store.equipArtifact('TITAN_CORE');
    store.updatePlayer({ hp: 100 });
    store.addItem('ENERGY_BAR', 1); // +25 HP -> 125 HP (> base 100, <= effective 140)
    expect(useGameStore.getState().useConsumable('ENERGY_BAR')).toBe(true);
    expect(useGameStore.getState().player.hp).toBe(125);

    // One-time Stage Mastery reward (first earn grants +70 coins for 2 stars, replay grants 0)
    const coinsBefore = useGameStore.getState().coins;
    const firstMastery = useGameStore.getState().recordStageMastery('LEVEL_1', {
      rankS: true,
      tactician: true,
    });
    expect(firstMastery.newlyEarnedBadges).toEqual(['rankS', 'tactician']);
    expect(firstMastery.bonusCoins).toBe(70);
    expect(firstMastery.bonusXp).toBe(0);
    expect(useGameStore.getState().coins).toBe(coinsBefore + 70);

    const replayMastery = useGameStore.getState().recordStageMastery('LEVEL_1', {
      rankS: true,
      tactician: true,
    });
    expect(replayMastery.newlyEarnedBadges).toEqual([]);
    expect(replayMastery.bonusCoins).toBe(0);
    expect(useGameStore.getState().coins).toBe(coinsBefore + 70);

    // Completing 3rd star unlocks STAGE_MASTER; recording 3 parries unlocks PARRY_MASTER
    useGameStore.getState().recordStageMastery('LEVEL_1', { parryAce: true });
    useGameStore.getState().recordWorkoutProgress({ parries: 3 });
    useGameStore.getState().syncAchievements();
    expect(useGameStore.getState().unlockedAchievements).toContain('STAGE_MASTER');
    expect(useGameStore.getState().unlockedAchievements).toContain('PARRY_MASTER');
  });
});
