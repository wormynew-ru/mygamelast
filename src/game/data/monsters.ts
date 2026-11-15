/**
 * Data-driven monster definitions.
 * Add new enemies by adding entries to this config.
 */

import type { MonsterStats } from '../types';

/**
 * Monster template (without runtime state like current HP).
 */
export interface MonsterTemplate {
  id: string;
  name: string;
  maxHp: number;
  attack: number;
  defense: number;
  xpReward: number;
  isBoss: boolean;

  /** Boss-specific: phase thresholds */
  phaseThresholds?: number[];

  /** Visual representation */
  sprite: string; // emoji or sprite identifier
  description: string;
}

/**
 * Convert a template to a live MonsterStats instance.
 */
export function createMonster(template: MonsterTemplate): MonsterStats {
  return {
    ...template,
    hp: template.maxHp,
  };
}

/**
 * All monster definitions.
 */
export const MONSTERS: Record<string, MonsterTemplate> = {
  BURGER: {
    id: 'BURGER',
    name: 'Greasy Burger',
    maxHp: 50,
    attack: 8,
    defense: 2,
    xpReward: 25,
    isBoss: false,
    sprite: '🍔',
    description: 'A sentient burger dripping with grease.',
  },

  PIZZA: {
    id: 'PIZZA',
    name: 'Cheesy Pizza',
    maxHp: 70,
    attack: 10,
    defense: 3,
    xpReward: 35,
    isBoss: false,
    sprite: '🍕',
    description: 'A molten cheese pizza with attitude.',
  },

  SODA: {
    id: 'SODA',
    name: 'Fizzy Soda',
    maxHp: 30,
    attack: 5,
    defense: 1,
    xpReward: 15,
    isBoss: false,
    sprite: '🥤',
    description: 'A bubbly soda can ready to explode.',
  },

  DONUT: {
    id: 'DONUT',
    name: 'Sugary Donut',
    maxHp: 40,
    attack: 6,
    defense: 2,
    xpReward: 20,
    isBoss: false,
    sprite: '🍩',
    description: 'A sticky donut covered in sprinkles.',
  },

  BOSS_KING_BURGER: {
    id: 'BOSS_KING_BURGER',
    name: 'King Burger',
    maxHp: 200,
    attack: 15,
    defense: 5,
    xpReward: 150,
    isBoss: true,
    phaseThresholds: [0.7, 0.4], // Enrages at 70% and 40% HP
    sprite: '👑🍔',
    description: 'The ruler of all junk food. Beware his rage!',
  },
};
