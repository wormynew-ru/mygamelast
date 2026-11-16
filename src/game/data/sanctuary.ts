/**
 * Sanctuary / Hideout engine: botanical mix recipes, lab tiers, normalization,
 * and aggregated combat buff calculators.
 * Harvested crops from the Personal Garden feed directly into Sanctuary crafting recipes.
 * ZERO React, DOM, or Vision imports allowed.
 */

import type {
  ItemRarity,
  SanctuaryLabTier,
  SanctuaryMixId,
  SanctuaryState,
  SeedId,
} from '../types';

export type { SanctuaryMixId };

export interface SanctuaryIngredientRequirement {
  seedId: SeedId;
  qty: number;
}

export interface SanctuaryMixEffectSpec {
  healHp: number;
  attackBonus: number;
  defenseBonus: number;
  critChanceBonus: number;
  comboWindowBonusMs: number;
  incomingDamageMultiplier: number;
  ultimateChargeMultiplier: number;
  startingUltimateCharge: number;
  xpMultiplier: number;
}

export interface SanctuaryMixBlueprint {
  id: SanctuaryMixId;
  icon: string;
  rarity: ItemRarity;
  ingredients: readonly SanctuaryIngredientRequirement[];
  effect: SanctuaryMixEffectSpec;
}

export interface SanctuaryLabTierConfig {
  tier: SanctuaryLabTier;
  icon: string;
  maxBuffSlots: number;
  healMultiplier: number;
  startingUltBonus: number;
  upgradeCost: number;
}

export const SANCTUARY_LAB_TIERS: Record<SanctuaryLabTier, SanctuaryLabTierConfig> = {
  1: {
    tier: 1,
    icon: '⚗️',
    maxBuffSlots: 1,
    healMultiplier: 1.0,
    startingUltBonus: 0,
    upgradeCost: 0,
  },
  2: {
    tier: 2,
    icon: '🧪',
    maxBuffSlots: 2,
    healMultiplier: 1.25,
    startingUltBonus: 0,
    upgradeCost: 120,
  },
  3: {
    tier: 3,
    icon: '🔮',
    maxBuffSlots: 3,
    healMultiplier: 1.5,
    startingUltBonus: 15,
    upgradeCost: 260,
  },
};

export const SANCTUARY_MIX_ORDER: readonly SanctuaryMixId[] = [
  'MINT_ISOTONIC',
  'BAMBOO_FORTIFIER',
  'CHILI_OVERDRIVE_SHOT',
  'LOTUS_NECTAR',
];

export const SANCTUARY_MIX_BLUEPRINTS: readonly SanctuaryMixBlueprint[] = [
  {
    id: 'MINT_ISOTONIC',
    icon: '🧪',
    rarity: 'COMMON',
    ingredients: [{ seedId: 'PROTEIN_MINT', qty: 2 }],
    effect: {
      healHp: 35,
      attackBonus: 2,
      defenseBonus: 0,
      critChanceBonus: 0,
      comboWindowBonusMs: 600,
      incomingDamageMultiplier: 1.0,
      ultimateChargeMultiplier: 1.0,
      startingUltimateCharge: 0,
      xpMultiplier: 1.0,
    },
  },
  {
    id: 'BAMBOO_FORTIFIER',
    icon: '🛡️',
    rarity: 'RARE',
    ingredients: [
      { seedId: 'IRON_BAMBOO', qty: 2 },
      { seedId: 'PROTEIN_MINT', qty: 1 },
    ],
    effect: {
      healHp: 15,
      attackBonus: 0,
      defenseBonus: 4,
      critChanceBonus: 0,
      comboWindowBonusMs: 0,
      incomingDamageMultiplier: 0.75,
      ultimateChargeMultiplier: 1.0,
      startingUltimateCharge: 0,
      xpMultiplier: 1.0,
    },
  },
  {
    id: 'CHILI_OVERDRIVE_SHOT',
    icon: '🔥',
    rarity: 'EPIC',
    ingredients: [
      { seedId: 'CHILI_PEPPER', qty: 2 },
      { seedId: 'IRON_BAMBOO', qty: 1 },
    ],
    effect: {
      healHp: 0,
      attackBonus: 4,
      defenseBonus: 0,
      critChanceBonus: 0.05,
      comboWindowBonusMs: 0,
      incomingDamageMultiplier: 1.0,
      ultimateChargeMultiplier: 1.4,
      startingUltimateCharge: 25,
      xpMultiplier: 1.0,
    },
  },
  {
    id: 'LOTUS_NECTAR',
    icon: '✨',
    rarity: 'LEGENDARY',
    ingredients: [
      { seedId: 'GOLDEN_LOTUS', qty: 1 },
      { seedId: 'CHILI_PEPPER', qty: 1 },
      { seedId: 'PROTEIN_MINT', qty: 1 },
    ],
    effect: {
      healHp: 50,
      attackBonus: 3,
      defenseBonus: 3,
      critChanceBonus: 0.1,
      comboWindowBonusMs: 400,
      incomingDamageMultiplier: 1.0,
      ultimateChargeMultiplier: 1.25,
      startingUltimateCharge: 30,
      xpMultiplier: 1.3,
    },
  },
];

export const SANCTUARY_MIX_MAP: Record<SanctuaryMixId, SanctuaryMixBlueprint> = {
  MINT_ISOTONIC: SANCTUARY_MIX_BLUEPRINTS[0],
  BAMBOO_FORTIFIER: SANCTUARY_MIX_BLUEPRINTS[1],
  CHILI_OVERDRIVE_SHOT: SANCTUARY_MIX_BLUEPRINTS[2],
  LOTUS_NECTAR: SANCTUARY_MIX_BLUEPRINTS[3],
};

export interface AggregatedSanctuaryBuffs {
  attackBonus: number;
  defenseBonus: number;
  critChanceBonus: number;
  comboWindowBonusMs: number;
  incomingDamageMultiplier: number;
  ultimateChargeMultiplier: number;
  startingUltimateCharge: number;
  xpMultiplier: number;
}

export function createInitialSanctuaryState(): SanctuaryState {
  return {
    labTier: 1,
    mixInventory: {
      MINT_ISOTONIC: 0,
      BAMBOO_FORTIFIER: 0,
      CHILI_OVERDRIVE_SHOT: 0,
      LOTUS_NECTAR: 0,
    },
    activeBuffs: [],
    totalCrafted: 0,
  };
}

function isValidMixId(value: unknown): value is SanctuaryMixId {
  return (
    value === 'MINT_ISOTONIC' ||
    value === 'BAMBOO_FORTIFIER' ||
    value === 'CHILI_OVERDRIVE_SHOT' ||
    value === 'LOTUS_NECTAR'
  );
}

export function normalizeSanctuaryState(raw?: Partial<SanctuaryState> | null): SanctuaryState {
  const base = createInitialSanctuaryState();
  if (!raw || typeof raw !== 'object') {
    return base;
  }

  const labTier: SanctuaryLabTier =
    raw.labTier === 2 || raw.labTier === 3 ? raw.labTier : 1;
  const maxSlots = SANCTUARY_LAB_TIERS[labTier].maxBuffSlots;

  const mixInventory: Record<SanctuaryMixId, number> = {
    MINT_ISOTONIC: Math.max(0, Math.floor(raw.mixInventory?.MINT_ISOTONIC ?? 0)),
    BAMBOO_FORTIFIER: Math.max(0, Math.floor(raw.mixInventory?.BAMBOO_FORTIFIER ?? 0)),
    CHILI_OVERDRIVE_SHOT: Math.max(0, Math.floor(raw.mixInventory?.CHILI_OVERDRIVE_SHOT ?? 0)),
    LOTUS_NECTAR: Math.max(0, Math.floor(raw.mixInventory?.LOTUS_NECTAR ?? 0)),
  };

  const uniqueBuffs: SanctuaryMixId[] = [];
  if (Array.isArray(raw.activeBuffs)) {
    for (const id of raw.activeBuffs) {
      if (isValidMixId(id) && !uniqueBuffs.includes(id) && uniqueBuffs.length < maxSlots) {
        uniqueBuffs.push(id);
      }
    }
  }

  return {
    labTier,
    mixInventory,
    activeBuffs: uniqueBuffs,
    totalCrafted: Math.max(0, Math.floor(raw.totalCrafted ?? 0)),
  };
}

export function getNextSanctuaryLabTier(current: SanctuaryLabTier): SanctuaryLabTier | null {
  if (current === 1) return 2;
  if (current === 2) return 3;
  return null;
}

export function getTotalCropCount(cropInventory: Record<SeedId, number>): number {
  return (
    (cropInventory.PROTEIN_MINT ?? 0) +
    (cropInventory.IRON_BAMBOO ?? 0) +
    (cropInventory.CHILI_PEPPER ?? 0) +
    (cropInventory.GOLDEN_LOTUS ?? 0)
  );
}

export function getTotalMixCount(mixInventory: Record<SanctuaryMixId, number>): number {
  return (
    (mixInventory.MINT_ISOTONIC ?? 0) +
    (mixInventory.BAMBOO_FORTIFIER ?? 0) +
    (mixInventory.CHILI_OVERDRIVE_SHOT ?? 0) +
    (mixInventory.LOTUS_NECTAR ?? 0)
  );
}

export function isMixReadyToCraft(
  cropInventory: Record<SeedId, number>,
  blueprint: SanctuaryMixBlueprint
): boolean {
  return blueprint.ingredients.every(
    (req) => (cropInventory[req.seedId] ?? 0) >= req.qty
  );
}

export function getMixEffectiveHeal(
  blueprint: SanctuaryMixBlueprint,
  labTier: SanctuaryLabTier
): number {
  if (blueprint.effect.healHp <= 0) return 0;
  const mult = SANCTUARY_LAB_TIERS[labTier]?.healMultiplier ?? 1.0;
  return Math.round(blueprint.effect.healHp * mult);
}

export function getAggregatedSanctuaryBuffs(
  activeBuffs: readonly SanctuaryMixId[],
  labTier: SanctuaryLabTier = 1
): AggregatedSanctuaryBuffs {
  let attackBonus = 0;
  let defenseBonus = 0;
  let critChanceBonus = 0;
  let comboWindowBonusMs = 0;
  let incomingDamageMultiplier = 1.0;
  let ultimateChargeMultiplier = 1.0;
  let startingUltimateCharge = 0;
  let xpMultiplier = 1.0;

  for (const mixId of activeBuffs) {
    const bp = SANCTUARY_MIX_MAP[mixId];
    if (!bp) continue;
    attackBonus += bp.effect.attackBonus;
    defenseBonus += bp.effect.defenseBonus;
    critChanceBonus += bp.effect.critChanceBonus;
    comboWindowBonusMs += bp.effect.comboWindowBonusMs;
    incomingDamageMultiplier *= bp.effect.incomingDamageMultiplier;
    ultimateChargeMultiplier *= bp.effect.ultimateChargeMultiplier;
    startingUltimateCharge += bp.effect.startingUltimateCharge;
    xpMultiplier *= bp.effect.xpMultiplier;
  }

  if (activeBuffs.length > 0) {
    startingUltimateCharge += SANCTUARY_LAB_TIERS[labTier]?.startingUltBonus ?? 0;
  }

  return {
    attackBonus,
    defenseBonus,
    critChanceBonus: Math.round(critChanceBonus * 1000) / 1000,
    comboWindowBonusMs,
    incomingDamageMultiplier: Math.round(incomingDamageMultiplier * 1000) / 1000,
    ultimateChargeMultiplier: Math.round(ultimateChargeMultiplier * 1000) / 1000,
    startingUltimateCharge: Math.min(100, startingUltimateCharge),
    xpMultiplier: Math.round(xpMultiplier * 1000) / 1000,
  };
}
