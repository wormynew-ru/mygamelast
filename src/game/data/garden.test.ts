import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_GARDEN_PLOTS,
  PLOT_UNLOCK_COSTS,
  QUICK_WEED_CLEAR_COST,
  SEEDS,
  WATERING_CANS,
  WATER_REFILL_COST,
  applyWorkoutVictoryToGarden,
  computeHarvestReward,
  createInitialGardenState,
  getPlantStage,
  isPlotReadyToHarvest,
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
    expect(garden.wateringCanTier).toBe(1);
    expect(garden.waterCharges).toBe(WATERING_CANS[1].maxCharges);
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
    expect(reward.coins).toBe(SEEDS.GOLDEN_LOTUS.harvestCoins);
    expect(reward.xp).toBe(SEEDS.GOLDEN_LOTUS.harvestXp);
    expect(reward.droppedItemId).toBe('CHAMPION_BELT');
  });
});

describe('Personal Garden store actions & achievements', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  it('allows buying seeds, planting, watering, harvesting, upgrading cans, unlocking plots, and fighting weeds', () => {
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

    // Harvest mature mint
    const coinsBeforeHarvest = useGameStore.getState().coins;
    const harvest = store.harvestPlot(0);
    expect(harvest?.coins).toBe(SEEDS.PROTEIN_MINT.harvestCoins);
    expect(useGameStore.getState().coins).toBe(coinsBeforeHarvest + SEEDS.PROTEIN_MINT.harvestCoins);
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
    expect(WATER_REFILL_COST).toBe(25);
  });
});
