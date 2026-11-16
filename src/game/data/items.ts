/**
 * Data-driven item definitions with rarities and shop pricing.
 */

import type { Item } from '../types';

/**
 * All items in the game.
 */
export const ITEMS: Record<string, Item> = {
  ENERGY_BAR: {
    id: 'ENERGY_BAR',
    name: 'Energy Bar',
    type: 'CONSUMABLE',
    rarity: 'COMMON',
    price: 20,
    description: 'Restores 25 HP.',
    effect: {
      hpRestore: 25,
    },
  },

  ISOTONIC_FLASK: {
    id: 'ISOTONIC_FLASK',
    name: 'Isotonic Flask',
    type: 'CONSUMABLE',
    rarity: 'COMMON',
    price: 35,
    description: 'Restores 40 HP between fights.',
    effect: {
      hpRestore: 40,
    },
  },

  PROTEIN_SHAKE: {
    id: 'PROTEIN_SHAKE',
    name: 'Protein Shake',
    type: 'CONSUMABLE',
    rarity: 'RARE',
    price: 50,
    description: 'Restores 50 HP instantly.',
    effect: {
      hpRestore: 50,
    },
  },

  MEGA_RECOVERY_SMOOTHIE: {
    id: 'MEGA_RECOVERY_SMOOTHIE',
    name: 'Recovery Smoothie',
    type: 'CONSUMABLE',
    rarity: 'EPIC',
    price: 85,
    description: 'Restores 100 HP instantly.',
    effect: {
      hpRestore: 100,
    },
  },

  RUNNING_SHOES: {
    id: 'RUNNING_SHOES',
    name: 'Running Shoes',
    type: 'EQUIPMENT',
    rarity: 'COMMON',
    price: 60,
    description: 'Increases attack speed. +2 Attack.',
    stats: {
      attack: 2,
    },
  },

  WEIGHT_BELT: {
    id: 'WEIGHT_BELT',
    name: 'Weight Belt',
    type: 'EQUIPMENT',
    rarity: 'RARE',
    price: 110,
    description: 'Adds mass to your strikes. +3 Attack, +5% Crit.',
    stats: {
      attack: 3,
      critChance: 0.05,
    },
  },

  ARMOR_VEST: {
    id: 'ARMOR_VEST',
    name: 'Armor Vest',
    type: 'EQUIPMENT',
    rarity: 'RARE',
    price: 120,
    description: 'Reduces incoming damage. +5 Defense.',
    stats: {
      defense: 5,
    },
  },

  FITNESS_WRISTBANDS: {
    id: 'FITNESS_WRISTBANDS',
    name: 'Pro Wristbands',
    type: 'EQUIPMENT',
    rarity: 'EPIC',
    price: 210,
    description: '+4 Attack, +15 Max HP, +600ms combo window.',
    stats: {
      attack: 4,
      maxHp: 15,
      comboWindowBonusMs: 600,
    },
  },

  TITANIUM_DUMBBELLS: {
    id: 'TITANIUM_DUMBBELLS',
    name: 'Titanium Dumbbells',
    type: 'EQUIPMENT',
    rarity: 'EPIC',
    price: 260,
    description: 'Heavy power gear. +7 Attack, +8% Crit.',
    stats: {
      attack: 7,
      critChance: 0.08,
    },
  },

  CHAMPION_BELT: {
    id: 'CHAMPION_BELT',
    name: 'Champion Belt',
    type: 'EQUIPMENT',
    rarity: 'LEGENDARY',
    price: 450,
    description: '+8 Attack, +6 Defense, +25 Max HP, +10% Crit, +1s combo.',
    stats: {
      attack: 8,
      defense: 6,
      maxHp: 25,
      critChance: 0.1,
      comboWindowBonusMs: 1000,
    },
  },
};

export const SHOP_ITEM_IDS: string[] = [
  'ENERGY_BAR',
  'ISOTONIC_FLASK',
  'PROTEIN_SHAKE',
  'MEGA_RECOVERY_SMOOTHIE',
  'RUNNING_SHOES',
  'WEIGHT_BELT',
  'ARMOR_VEST',
  'FITNESS_WRISTBANDS',
  'TITANIUM_DUMBBELLS',
  'CHAMPION_BELT',
];
