import { beforeEach, describe, expect, it } from 'vitest';
import {
  INITIAL_UNLOCKED_PLOTS,
  MAX_GARDEN_PLOTS,
  PLOT_UNLOCK_COSTS,
  QUICK_WEED_CLEAR_COST,
  SEEDS,
  WATERING_CANS,
  WATER_CHARGES_PER_VICTORY,
  WATER_REFILL_COST,
  applyWorkoutVictoryToGarden,
  computeHarvestReward,
  createInitialGardenState,
  getPlantStage,
  isPlotReadyToHarvest,
  normalizeGardenState,
  spawnWeedInGarden,
  waterAllPlotsInGarden,
  waterSinglePlotInGarden,
} from './garden';
import { useGameStore } from '../store';

describe('Personal Garden domain engine', () => {
  it('initializes with 2 unlocked plots, 1 starter mint seed, and Tier 1 watering can', () => {
    const garden = createInitialGardenState();
    expect(garden.unlockedPlots).toBe(2);
    expect(garden.plots).toHaveLength(MAX_GARDEN_PLOTS);
    expect(garden.seedInventory.PROTEIN_MINT).toBe(1);
    expect(garden.cropInventory.PROTEIN_MINT).toBe(0);
    expect(garden.wateringCanTier).toBe(1);
    expect(garden.waterCharges).toBe(WATERING_CANS[1].maxCharges);
  });

  it('normalizes missing, partial, or out-of-range persisted garden states safely', () => {
    const fromUndefined = normalizeGardenState(undefined);
    expect(fromUndefined.unlockedPlots).toBe(INITIAL_UNLOCKED_PLOTS);
    expect(fromUndefined.plots).toHaveLength(MAX_GARDEN_PLOTS);
    expect(fromUndefined.cropInventory.GOLDEN_LOTUS).toBe(0);

    const sanitized = normalizeGardenState({
      unlockedPlots: 99,
      wateringCanTier: 99 as unknown as 1,
      waterCharges: 999,
      totalHarvested: -5,
      weedsDefeated: -2,
      seedInventory: {
        PROTEIN_MINT: -1,
        IRON_BAMBOO: 3,
        CHILI_PEPPER: 0,
        GOLDEN_LOTUS: 1,
      },
      cropInventory: {
        PROTEIN_MINT: 4,
        IRON_BAMBOO: -3,
        CHILI_PEPPER: 2,
        GOLDEN_LOTUS: 0,
      },
      plots: [
        { id: 0, seedId: 'PROTEIN_MINT', growth: 50, weedId: 'UNKNOWN_WEED' as unknown as null },
        { id: 1, seedId: 'UNKNOWN_SEED' as unknown as null, growth: 4, weedId: 'WEED_VINE' },
      ],
    });

    expect(sanitized.unlockedPlots).toBe(MAX_GARDEN_PLOTS);
    expect(sanitized.wateringCanTier).toBe(1);
    expect(sanitized.waterCharges).toBe(WATERING_CANS[1].maxCharges);
    expect(sanitized.totalHarvested).toBe(0);
    expect(sanitized.weedsDefeated).toBe(0);
    expect(sanitized.seedInventory.PROTEIN_MINT).toBe(0);
    expect(sanitized.seedInventory.IRON_BAMBOO).toBe(3);
    expect(sanitized.cropInventory.PROTEIN_MINT).toBe(4);
    expect(sanitized.cropInventory.IRON_BAMBOO).toBe(0);
    expect(sanitized.cropInventory.CHILI_PEPPER).toBe(2);
    expect(sanitized.plots[0].growth).toBe(SEEDS.PROTEIN_MINT.growthRequired);
    expect(sanitized.plots[0].weedId).toBeNull();
    expect(sanitized.plots[1].seedId).toBeNull();
    expect(sanitized.plots[1].growth).toBe(0);
    expect(sanitized.plots[1].weedId).toBe('WEED_VINE');
  });

  it('tracks plant stages and blocks watering when weed is present', () => {
    const garden = createInitialGardenState();
    garden.plots[0] = { id: 0, seedId: 'PROTEIN_MINT', growth: 0, weedId: null };
    expect(getPlantStage(garden.plots[0])).toBe('SEEDLING');
    expect(isPlotReadyToHarvest(garden.plots[0])).toBe(false);

    const watered1 = waterSinglePlotInGarden(garden, 0);
    expect(watered1?.plots[0].growth).toBe(1);
    expect(getPlantStage(watered1!.plots[0])).toBe('SPROUT');
    expect(watered1?.waterCharges).toBe(2);

    // Weed blocks watering until cleared
    const infested = {
      ...watered1!,
      plots: watered1!.plots.map((p) => (p.id === 0 ? { ...p, weedId: 'WEED_DANDELION' as const } : p)),
    };
    expect(waterSinglePlotInGarden(infested, 0)).toBeNull();
    expect(waterAllPlotsInGarden(infested)).toBeNull();
  });

  it('applies workout victory +1 growth, caps water charges, blocks infested plot growth, and respects suppressWeedSpawn', () => {
    const garden = createInitialGardenState();
    garden.waterCharges = 2; // max for Tier 1 is 3
    garden.plots[0] = { id: 0, seedId: 'IRON_BAMBOO', growth: 1, weedId: null };
    garden.plots[1] = { id: 1, seedId: 'PROTEIN_MINT', growth: 1, weedId: 'WEED_THISTLE' };

    const afterVictory = applyWorkoutVictoryToGarden(garden, { rng: () => 0.05 });
    expect(afterVictory.waterCharges).toBe(Math.min(WATERING_CANS[1].maxCharges, 2 + WATER_CHARGES_PER_VICTORY));
    expect(afterVictory.plots[0].growth).toBe(2);
    // Plot 1 had a weed -> no growth and since activeWeeds === 1, no duplicate weed spawns
    expect(afterVictory.plots[1].growth).toBe(1);

    // Clean garden with low rng spawns a weed unless suppressed
    const cleanGarden = createInitialGardenState();
    cleanGarden.plots[0] = { id: 0, seedId: 'PROTEIN_MINT', growth: 0, weedId: null };
    const withSpawn = applyWorkoutVictoryToGarden(cleanGarden, { rng: () => 0.1 });
    expect(withSpawn.plots[0].weedId).not.toBeNull();

    const suppressed = applyWorkoutVictoryToGarden(cleanGarden, {
      suppressWeedSpawn: true,
      rng: () => 0.1,
    });
    expect(suppressed.plots[0].weedId).toBeNull();
  });

  it('supports Tier 3 Sprinkler watering all plots on one charge and Tier 4 auto-growth on workouts', () => {
    const garden = createInitialGardenState();
    garden.wateringCanTier = 3;
    garden.waterCharges = 5;
    garden.plots[0] = { id: 0, seedId: 'IRON_BAMBOO', growth: 0, weedId: null };
    garden.plots[1] = { id: 1, seedId: 'CHILI_PEPPER', growth: 1, weedId: null };

    const afterSprinkle = waterAllPlotsInGarden(garden);
    expect(afterSprinkle).not.toBeNull();
    expect(afterSprinkle?.waterCharges).toBe(4);
    expect(afterSprinkle?.plots[0].growth).toBe(2);
    expect(afterSprinkle?.plots[1].growth).toBe(3);

    // Tier 4 grants +2 growth per workout victory and refills water
    const tier4 = { ...afterSprinkle!, wateringCanTier: 4 as const, waterCharges: 2 };
    const afterWin = applyWorkoutVictoryToGarden(tier4, { suppressWeedSpawn: true });
    expect(afterWin.waterCharges).toBe(4);
    expect(afterWin.plots[0].growth).toBe(4);
    expect(afterWin.plots[1].growth).toBe(5);
  });

  it('spawns weeds on growing plots when triggered and computes deterministic harvest loot', () => {
    const garden = createInitialGardenState();
    garden.plots[0] = { id: 0, seedId: 'GOLDEN_LOTUS', growth: 2, weedId: null };

    const { garden: withWeed, spawnedPlotId } = spawnWeedInGarden(garden, () => 0.1);
    expect(spawnedPlotId).toBe(0);
    expect(withWeed.plots[0].weedId).toBe('WEED_DANDELION');

    const reward = computeHarvestReward('GOLDEN_LOTUS', () => 0.99);
    expect(reward.cropId).toBe('GOLDEN_LOTUS');
    expect(reward.cropQty).toBe(SEEDS.GOLDEN_LOTUS.harvestCropYield);
    expect(reward.xp).toBe(SEEDS.GOLDEN_LOTUS.harvestXp);
    expect(reward.droppedItemId).toBe('CHAMPION_BELT');
  });
});

describe('Personal Garden store actions & achievements', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  it('allows buying seeds, planting, watering, harvesting crops + XP without coins, upgrading cans, unlocking plots, and fighting weeds', () => {
    const store = useGameStore.getState();
    store.addCoins(1000);

    // Unlock plot 3
    expect(store.unlockGardenPlot()).toBe(true);
    expect(useGameStore.getState().garden.unlockedPlots).toBe(3);
    expect(useGameStore.getState().coins).toBe(1000 - PLOT_UNLOCK_COSTS[2]);

    // Plant starter mint in plot 0
    expect(store.plantSeed(0, 'PROTEIN_MINT')).toBe(true);

    // Water plot 0 to maturity (3 growth)
    expect(store.waterPlot(0)).toBe(true);
    expect(store.waterPlot(0)).toBe(true);
    expect(store.waterPlot(0)).toBe(true);
    expect(isPlotReadyToHarvest(useGameStore.getState().garden.plots[0])).toBe(true);

    // Harvest mature mint while slightly damaged: yields plant + XP + HP heal, NO Fit-Coins
    const playerMaxHp = useGameStore.getState().player.maxHp;
    useGameStore.getState().updatePlayer({ hp: playerMaxHp - 10 });
    const coinsBeforeHarvest = useGameStore.getState().coins;
    const harvest = store.harvestPlot(0);
    expect(harvest?.cropId).toBe('PROTEIN_MINT');
    expect(harvest?.cropQty).toBe(SEEDS.PROTEIN_MINT.harvestCropYield);
    expect(harvest?.xp).toBe(SEEDS.PROTEIN_MINT.harvestXp);
    expect(useGameStore.getState().coins).toBe(coinsBeforeHarvest);
    expect(useGameStore.getState().garden.cropInventory.PROTEIN_MINT).toBe(
      SEEDS.PROTEIN_MINT.harvestCropYield
    );
    expect(useGameStore.getState().player.hp).toBe(playerMaxHp);
    expect(useGameStore.getState().garden.totalHarvested).toBe(1);

    // Refill empty water can and upgrade to Tier 2
    expect(useGameStore.getState().garden.waterCharges).toBe(0);
    expect(store.refillWateringCan()).toBe(true);
    expect(useGameStore.getState().garden.waterCharges).toBe(WATERING_CANS[1].maxCharges);

    expect(store.upgradeWateringCan()).toBe(true);
    expect(useGameStore.getState().garden.wateringCanTier).toBe(2);

    // Spawn weed and defeat via battle + via coin herbicide fallback
    const weedPlot = store.triggerGardenWeed(1);
    expect(weedPlot).toBe(1);
    expect(store.defeatPlotWeed(1)).toBe(true);
    expect(useGameStore.getState().garden.weedsDefeated).toBe(1);

    // Clear with herbicide coins
    store.buySeed('PROTEIN_MINT');
    store.plantSeed(2, 'PROTEIN_MINT');
    store.triggerGardenWeed(2);
    const coinsBeforeHerbicide = useGameStore.getState().coins;
    expect(store.clearPlotWeedWithCoins(2)).toBe(true);
    expect(useGameStore.getState().coins).toBe(coinsBeforeHerbicide - QUICK_WEED_CLEAR_COST);
    expect(useGameStore.getState().garden.weedsDefeated).toBe(2);

    // 3rd weed unlocks WEED_SLAYER achievement; check refill fails when full
    store.triggerGardenWeed(0);
    store.defeatPlotWeed(0);
    expect(useGameStore.getState().unlockedAchievements).toContain('WEED_SLAYER');

    useGameStore.getState().upgradeWateringCan(); // upgrade to Tier 3 -> water refills full
    expect(useGameStore.getState().refillWateringCan()).toBe(false);
    expect(WATER_REFILL_COST).toBe(25);

    // Complete 2 more harvests to reach 3 total and unlock GARDENER + verify level-up on GOLDEN_LOTUS
    store.addCoins(2000);
    store.buySeed('GOLDEN_LOTUS');
    store.buySeed('GOLDEN_LOTUS');
    store.plantSeed(0, 'GOLDEN_LOTUS');
    store.plantSeed(1, 'GOLDEN_LOTUS');
    // Tier 3 sprinkler gives +2 growth per water across all plots (10 growth = 5 waters)
    for (let i = 0; i < 5; i++) {
      store.waterAllPlots();
    }
    const harvest2 = store.harvestPlot(0);
    const harvest3 = store.harvestPlot(1);
    expect(harvest2?.leveledUp || harvest3?.leveledUp).toBe(true);
    expect(useGameStore.getState().garden.cropInventory.GOLDEN_LOTUS).toBe(2);
    expect(useGameStore.getState().garden.totalHarvested).toBe(3);
    expect(useGameStore.getState().unlockedAchievements).toContain('GARDENER');
  });
});
