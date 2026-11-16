/**
 * Sanctuary / Hideout foundation: botanical mix blueprints & ingredient readiness helpers.
 * Harvested crops from the Personal Garden feed directly into Sanctuary crafting recipes.
 * ZERO React, DOM, or Vision imports allowed.
 */

import type { ItemRarity, SeedId } from '../types';

export type SanctuaryMixId =
  | 'MINT_ISOTONIC'
  | 'BAMBOO_FORTIFIER'
  | 'CHILI_OVERDRIVE_SHOT'
  | 'LOTUS_NECTAR';

export interface SanctuaryIngredientRequirement {
  seedId: SeedId;
  qty: number;
}

export interface SanctuaryMixBlueprint {
  id: SanctuaryMixId;
  icon: string;
  rarity: ItemRarity;
  ingredients: readonly SanctuaryIngredientRequirement[];
}

export const SANCTUARY_MIX_BLUEPRINTS: readonly SanctuaryMixBlueprint[] = [
  {
    id: 'MINT_ISOTONIC',
    icon: '🧪',
    rarity: 'COMMON',
    ingredients: [{ seedId: 'PROTEIN_MINT', qty: 2 }],
  },
  {
    id: 'BAMBOO_FORTIFIER',
    icon: '🛡️',
    rarity: 'RARE',
    ingredients: [
      { seedId: 'IRON_BAMBOO', qty: 2 },
      { seedId: 'PROTEIN_MINT', qty: 1 },
    ],
  },
  {
    id: 'CHILI_OVERDRIVE_SHOT',
    icon: '🔥',
    rarity: 'EPIC',
    ingredients: [
      { seedId: 'CHILI_PEPPER', qty: 2 },
      { seedId: 'IRON_BAMBOO', qty: 1 },
    ],
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
  },
];

export function getTotalCropCount(cropInventory: Record<SeedId, number>): number {
  return (
    (cropInventory.PROTEIN_MINT ?? 0) +
    (cropInventory.IRON_BAMBOO ?? 0) +
    (cropInventory.CHILI_PEPPER ?? 0) +
    (cropInventory.GOLDEN_LOTUS ?? 0)
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
