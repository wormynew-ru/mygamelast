/**
 * Pure data definitions & simulation helpers for the Personal Fitness Garden.
 * ZERO React, DOM, or Vision imports allowed.
 */

import type {
  GardenPlotState,
  GardenState,
  ItemRarity,
  SeedId,
  WateringCanTier,
  WeedId,
} from '../types';

export const MAX_GARDEN_PLOTS = 6;
export const INITIAL_UNLOCKED_PLOTS = 2;
export const PLOT_UNLOCK_COSTS: readonly number[] = [0, 0, 140, 280, 480, 800];
export const WATER_REFILL_COST = 25;
export const QUICK_WEED_CLEAR_COST = 45;
export const WATER_CHARGES_PER_VICTORY = 2;

export interface SeedDefinition {
  id: SeedId;
  icon: string;
  rarity: ItemRarity;
  price: number;
  growthRequired: number;
  harvestCoins: number;
  harvestXp: number;
  healHp: number;
  dropPool: readonly string[];
  dropChance: number;
}

export const SEEDS: Record<SeedId, SeedDefinition> = {
  PROTEIN_MINT: {
    id: 'PROTEIN_MINT',
    icon: '🌿',
    rarity: 'COMMON',
    price: 30,
    growthRequired: 3,
    harvestCoins: 55,
    harvestXp: 25,
    healHp: 20,
    dropPool: ['ENERGY_BAR'],
    dropChance: 0.35,
  },
  IRON_BAMBOO: {
    id: 'IRON_BAMBOO',
    icon: '🎍',
    rarity: 'RARE',
    price: 85,
    growthRequired: 5,
    harvestCoins: 155,
    harvestXp: 55,
    healHp: 0,
    dropPool: ['ENERGY_BAR', 'ISOTONIC_FLASK', 'RUNNING_SHOES'],
    dropChance: 0.55,
  },
  CHILI_PEPPER: {
    id: 'CHILI_PEPPER',
    icon: '🌶️',
    rarity: 'EPIC',
    price: 160,
    growthRequired: 7,
    harvestCoins: 290,
    harvestXp: 100,
    healHp: 0,
    dropPool: ['PROTEIN_SHAKE', 'WEIGHT_BELT', 'ARMOR_VEST'],
    dropChance: 0.65,
  },
  GOLDEN_LOTUS: {
    id: 'GOLDEN_LOTUS',
    icon: '🪷',
    rarity: 'LEGENDARY',
    price: 320,
    growthRequired: 10,
    harvestCoins: 580,
    harvestXp: 190,
    healHp: 40,
    dropPool: ['MEGA_RECOVERY_SMOOTHIE', 'FITNESS_WRISTBANDS', 'TITANIUM_DUMBBELLS', 'CHAMPION_BELT'],
    dropChance: 1.0,
  },
};

export const SEED_ORDER: readonly SeedId[] = [
  'PROTEIN_MINT',
  'IRON_BAMBOO',
  'CHILI_PEPPER',
  'GOLDEN_LOTUS',
];

export interface WateringCanDefinition {
  tier: WateringCanTier;
  icon: string;
  maxCharges: number;
  growthPerWater: number;
  watersAll: boolean;
  autoWaterOnWorkout: boolean;
  upgradeCost: number;
}

export const WATERING_CANS: Record<WateringCanTier, WateringCanDefinition> = {
  1: {
    tier: 1,
    icon: '🚿',
    maxCharges: 3,
    growthPerWater: 1,
    watersAll: false,
    autoWaterOnWorkout: false,
    upgradeCost: 0,
  },
  2: {
    tier: 2,
    icon: '🪣',
    maxCharges: 5,
    growthPerWater: 2,
    watersAll: false,
    autoWaterOnWorkout: false,
    upgradeCost: 180,
  },
  3: {
    tier: 3,
    icon: '⛲',
    maxCharges: 8,
    growthPerWater: 2,
    watersAll: true,
    autoWaterOnWorkout: false,
    upgradeCost: 450,
  },
  4: {
    tier: 4,
    icon: '🌧️',
    maxCharges: 12,
    growthPerWater: 3,
    watersAll: true,
    autoWaterOnWorkout: true,
    upgradeCost: 950,
  },
};

export const GARDEN_WEEDS: readonly WeedId[] = ['WEED_DANDELION', 'WEED_THISTLE', 'WEED_VINE'];

export type PlantStage = 'EMPTY' | 'SEEDLING' | 'SPROUT' | 'BUDDING' | 'MATURE';

export function createInitialGardenState(): GardenState {
  const plots: GardenPlotState[] = Array.from({ length: MAX_GARDEN_PLOTS }, (_, idx) => ({
    id: idx,
    seedId: null,
    growth: 0,
    weedId: null,
  }));

  return {
    unlockedPlots: INITIAL_UNLOCKED_PLOTS,
    plots,
    seedInventory: {
      PROTEIN_MINT: 1,
      IRON_BAMBOO: 0,
      CHILI_PEPPER: 0,
      GOLDEN_LOTUS: 0,
    },
    wateringCanTier: 1,
    waterCharges: WATERING_CANS[1].maxCharges,
    totalHarvested: 0,
    weedsDefeated: 0,
  };
}

export function normalizeGardenState(raw: Partial<GardenState> | undefined): GardenState {
  const base = createInitialGardenState();
  if (!raw) return base;

  const unlockedPlots = Math.max(
    INITIAL_UNLOCKED_PLOTS,
    Math.min(MAX_GARDEN_PLOTS, raw.unlockedPlots ?? INITIAL_UNLOCKED_PLOTS)
  );
  const rawTier = raw.wateringCanTier ?? 1;
  const wateringCanTier: WateringCanTier =
    rawTier === 1 || rawTier === 2 || rawTier === 3 || rawTier === 4 ? rawTier : 1;
  const maxCharges = WATERING_CANS[wateringCanTier].maxCharges;

  const plots: GardenPlotState[] = Array.from({ length: MAX_GARDEN_PLOTS }, (_, idx) => {
    const src = raw.plots?.[idx];
    if (!src) return base.plots[idx];
    const validSeed = src.seedId && src.seedId in SEEDS ? src.seedId : null;
    const validWeed = src.weedId && GARDEN_WEEDS.includes(src.weedId) ? src.weedId : null;
    const maxGrowth = validSeed ? SEEDS[validSeed].growthRequired : 0;
    return {
      id: idx,
      seedId: validSeed,
      growth: validSeed ? Math.max(0, Math.min(maxGrowth, src.growth ?? 0)) : 0,
      weedId: validWeed,
    };
  });

  return {
    unlockedPlots,
    plots,
    seedInventory: {
      PROTEIN_MINT: Math.max(0, raw.seedInventory?.PROTEIN_MINT ?? base.seedInventory.PROTEIN_MINT),
      IRON_BAMBOO: Math.max(0, raw.seedInventory?.IRON_BAMBOO ?? 0),
      CHILI_PEPPER: Math.max(0, raw.seedInventory?.CHILI_PEPPER ?? 0),
      GOLDEN_LOTUS: Math.max(0, raw.seedInventory?.GOLDEN_LOTUS ?? 0),
    },
    wateringCanTier,
    waterCharges: Math.max(0, Math.min(maxCharges, raw.waterCharges ?? maxCharges)),
    totalHarvested: Math.max(0, raw.totalHarvested ?? 0),
    weedsDefeated: Math.max(0, raw.weedsDefeated ?? 0),
  };
}

export function getNextPlotUnlockCost(unlockedPlots: number): number | null {
  if (unlockedPlots >= MAX_GARDEN_PLOTS) return null;
  return PLOT_UNLOCK_COSTS[unlockedPlots] ?? null;
}

export function getNextWateringCanTier(tier: WateringCanTier): WateringCanTier | null {
  if (tier >= 4) return null;
  return (tier + 1) as WateringCanTier;
}

export function getPlantStage(plot: GardenPlotState): PlantStage {
  if (!plot.seedId) return 'EMPTY';
  const def = SEEDS[plot.seedId];
  const ratio = def.growthRequired > 0 ? plot.growth / def.growthRequired : 1;
  if (ratio >= 1) return 'MATURE';
  if (ratio >= 0.65) return 'BUDDING';
  if (ratio >= 0.3) return 'SPROUT';
  return 'SEEDLING';
}

export function isPlotReadyToHarvest(plot: GardenPlotState): boolean {
  if (!plot.seedId || plot.weedId !== null) return false;
  return plot.growth >= SEEDS[plot.seedId].growthRequired;
}

export function getPlantVisualEmoji(plot: GardenPlotState): string {
  if (!plot.seedId) return '🟫';
  const stage = getPlantStage(plot);
  switch (stage) {
    case 'SEEDLING':
      return '🌱';
    case 'SPROUT':
      return '🌿';
    case 'BUDDING':
      return '🪴';
    case 'MATURE':
      return SEEDS[plot.seedId].icon;
    default:
      return '🟫';
  }
}

export interface HarvestReward {
  coins: number;
  xp: number;
  healHp: number;
  droppedItemId: string | null;
}

export function computeHarvestReward(
  seedId: SeedId,
  rng: () => number = Math.random
): HarvestReward {
  const def = SEEDS[seedId];
  let droppedItemId: string | null = null;
  if (def.dropPool.length > 0 && rng() <= def.dropChance) {
    const idx = Math.min(def.dropPool.length - 1, Math.floor(rng() * def.dropPool.length));
    droppedItemId = def.dropPool[idx] ?? null;
  }

  return {
    coins: def.harvestCoins,
    xp: def.harvestXp,
    healHp: def.healHp,
    droppedItemId,
  };
}

export function waterSinglePlotInGarden(garden: GardenState, plotId: number): GardenState | null {
  if (plotId < 0 || plotId >= garden.unlockedPlots || garden.waterCharges <= 0) {
    return null;
  }
  const plot = garden.plots[plotId];
  if (!plot || !plot.seedId || plot.weedId !== null) {
    return null;
  }
  const seed = SEEDS[plot.seedId];
  if (plot.growth >= seed.growthRequired) {
    return null;
  }

  const can = WATERING_CANS[garden.wateringCanTier];
  if (can.watersAll) {
    return waterAllPlotsInGarden(garden);
  }

  const nextPlots = garden.plots.map((p) =>
    p.id === plotId
      ? { ...p, growth: Math.min(seed.growthRequired, p.growth + can.growthPerWater) }
      : p
  );

  return {
    ...garden,
    waterCharges: garden.waterCharges - 1,
    plots: nextPlots,
  };
}

export function waterAllPlotsInGarden(garden: GardenState): GardenState | null {
  if (garden.waterCharges <= 0) return null;
  const can = WATERING_CANS[garden.wateringCanTier];

  let wateredAny = false;
  let remainingCharges = garden.waterCharges;

  if (can.watersAll) {
    const nextPlots = garden.plots.map((p, idx) => {
      if (idx >= garden.unlockedPlots || !p.seedId || p.weedId !== null) {
        return p;
      }
      const maxG = SEEDS[p.seedId].growthRequired;
      if (p.growth >= maxG) return p;
      wateredAny = true;
      return {
        ...p,
        growth: Math.min(maxG, p.growth + can.growthPerWater),
      };
    });

    if (!wateredAny) return null;
    return {
      ...garden,
      waterCharges: Math.max(0, remainingCharges - 1),
      plots: nextPlots,
    };
  }

  const nextPlots = garden.plots.map((p, idx) => {
    if (remainingCharges <= 0 || idx >= garden.unlockedPlots || !p.seedId || p.weedId !== null) {
      return p;
    }
    const maxG = SEEDS[p.seedId].growthRequired;
    if (p.growth >= maxG) return p;
    wateredAny = true;
    remainingCharges -= 1;
    return {
      ...p,
      growth: Math.min(maxG, p.growth + can.growthPerWater),
    };
  });

  if (!wateredAny) return null;

  return {
    ...garden,
    waterCharges: remainingCharges,
    plots: nextPlots,
  };
}

export function pickWeedSpawnPlotId(
  garden: GardenState,
  targetPlotId?: number
): number | null {
  if (typeof targetPlotId === 'number') {
    const specific = garden.plots[targetPlotId];
    if (specific && targetPlotId < garden.unlockedPlots && specific.weedId === null) {
      return targetPlotId;
    }
    return null;
  }

  const unlocked = garden.plots.slice(0, garden.unlockedPlots);
  const growingClean = unlocked.find(
    (p) => p.seedId !== null && p.weedId === null && p.growth < SEEDS[p.seedId].growthRequired
  );
  if (growingClean) return growingClean.id;

  const anyClean = unlocked.find((p) => p.weedId === null);
  return anyClean ? anyClean.id : null;
}

export function spawnWeedInGarden(
  garden: GardenState,
  rng: () => number = Math.random,
  targetPlotId?: number
): { garden: GardenState; spawnedPlotId: number | null } {
  const plotId = pickWeedSpawnPlotId(garden, targetPlotId);
  if (plotId === null) {
    return { garden, spawnedPlotId: null };
  }

  const weedIdx = Math.min(GARDEN_WEEDS.length - 1, Math.floor(rng() * GARDEN_WEEDS.length));
  const weedId = GARDEN_WEEDS[weedIdx] ?? 'WEED_DANDELION';

  return {
    spawnedPlotId: plotId,
    garden: {
      ...garden,
      plots: garden.plots.map((p) => (p.id === plotId ? { ...p, weedId } : p)),
    },
  };
}

export function applyWorkoutVictoryToGarden(
  garden: GardenState,
  options: {
    suppressWeedSpawn?: boolean;
    rng?: () => number;
  } = {}
): GardenState {
  const rng = options.rng ?? Math.random;
  const can = WATERING_CANS[garden.wateringCanTier];
  const workoutGrowthStep = can.autoWaterOnWorkout ? 2 : 1;

  const nextPlots = garden.plots.map((p, idx) => {
    if (idx >= garden.unlockedPlots || !p.seedId || p.weedId !== null) {
      return p;
    }
    const maxG = SEEDS[p.seedId].growthRequired;
    if (p.growth >= maxG) return p;
    return {
      ...p,
      growth: Math.min(maxG, p.growth + workoutGrowthStep),
    };
  });

  let updated: GardenState = {
    ...garden,
    waterCharges: Math.min(can.maxCharges, garden.waterCharges + WATER_CHARGES_PER_VICTORY),
    plots: nextPlots,
  };

  if (!options.suppressWeedSpawn) {
    const activeWeeds = updated.plots.slice(0, updated.unlockedPlots).filter((p) => p.weedId !== null)
      .length;
    if (activeWeeds === 0 && rng() < 0.35) {
      updated = spawnWeedInGarden(updated, rng).garden;
    }
  }

  return updated;
}
