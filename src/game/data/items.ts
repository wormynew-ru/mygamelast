/**
 * Data-driven item definitions.
 */

import type { Item } from '../types';

/**
 * All items in the game.
 */
export const ITEMS: Record<string, Item> = {
  PROTEIN_SHAKE: {
    id: 'PROTEIN_SHAKE',
    name: 'Protein Shake',
    type: 'CONSUMABLE',
    description: 'Restores 50 HP instantly.',
    effect: {
      hpRestore: 50,
    },
  },

  ENERGY_BAR: {
    id: 'ENERGY_BAR',
    name: 'Energy Bar',
    type: 'CONSUMABLE',
    description: 'Restores 25 HP.',
    effect: {
      hpRestore: 25,
    },
  },

  RUNNING_SHOES: {
    id: 'RUNNING_SHOES',
    name: 'Running Shoes',
    type: 'EQUIPMENT',
    description: 'Increases attack speed. +2 Attack.',
    stats: {
      attack: 2,
    },
  },

  WEIGHT_BELT: {
    id: 'WEIGHT_BELT',
    name: 'Weight Belt',
    type: 'EQUIPMENT',
    description: 'Adds mass to your strikes. +3 Attack.',
    stats: {
      attack: 3,
    },
  },

  ARMOR_VEST: {
    id: 'ARMOR_VEST',
    name: 'Armor Vest',
    type: 'EQUIPMENT',
    description: 'Reduces incoming damage. +5 Defense.',
    stats: {
      defense: 5,
    },
  },
};
