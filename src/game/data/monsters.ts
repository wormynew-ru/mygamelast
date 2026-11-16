/**
 * Data-driven monster definitions & Endless Arena wave generator.
 * Add new enemies by adding entries to this config.
 */

import type { MonsterArchetype, MonsterStats } from '../types';
import type { ExerciseId } from './exercises';

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
  coinReward: number;
  isBoss: boolean;
  archetype: MonsterArchetype;
  weakTo: ExerciseId;
  resistantTo: ExerciseId;
  attackIntervalMs?: number;
  shieldHits?: number;
  maxShieldHits?: number;

  /** Boss-specific: phase thresholds */
  phaseThresholds?: number[];

  /** Visual representation */
  sprite: string;
  description: string;
}

/**
 * Convert a template to a live MonsterStats instance.
 */
export function createMonster(template: MonsterTemplate): MonsterStats {
  return {
    id: template.id,
    name: template.name,
    hp: template.maxHp,
    maxHp: template.maxHp,
    attack: template.attack,
    defense: template.defense,
    xpReward: template.xpReward,
    coinReward: template.coinReward,
    isBoss: template.isBoss,
    archetype: template.archetype,
    weakTo: template.weakTo,
    resistantTo: template.resistantTo,
    attackIntervalMs: template.attackIntervalMs,
    shieldHits: template.shieldHits,
    maxShieldHits: template.maxShieldHits,
    phaseThresholds: template.phaseThresholds,
  };
}

/**
 * All monster definitions.
 */
export const MONSTERS: Record<string, MonsterTemplate> = {
  SODA: {
    id: 'SODA',
    name: 'Fizzy Soda',
    maxHp: 30,
    attack: 5,
    defense: 1,
    xpReward: 15,
    coinReward: 15,
    isBoss: false,
    archetype: 'FAST',
    weakTo: 'JUMPING_JACK',
    resistantTo: 'PLANK',
    attackIntervalMs: 5200,
    sprite: '🥤',
    description: 'A bubbly soda can ready to explode.',
  },

  FRIES: {
    id: 'FRIES',
    name: 'Ninja Fries',
    maxHp: 45,
    attack: 8,
    defense: 1,
    xpReward: 24,
    coinReward: 20,
    isBoss: false,
    archetype: 'FAST',
    weakTo: 'JUMPING_JACK',
    resistantTo: 'PUSH_UP',
    attackIntervalMs: 4800,
    sprite: '🍟',
    description: 'Crispy ambush fries striking at double speed.',
  },

  MILKSHAKE: {
    id: 'MILKSHAKE',
    name: 'Sugar Shake',
    maxHp: 52,
    attack: 9,
    defense: 2,
    xpReward: 28,
    coinReward: 25,
    isBoss: false,
    archetype: 'FAST',
    weakTo: 'OVERHEAD_PRESS',
    resistantTo: 'PLANK',
    attackIntervalMs: 5000,
    sprite: '🍨',
    description: 'Whipped dessert tornado vulnerable to overhead presses.',
  },

  DONUT: {
    id: 'DONUT',
    name: 'Sugary Donut',
    maxHp: 40,
    attack: 6,
    defense: 2,
    xpReward: 20,
    coinReward: 20,
    isBoss: false,
    archetype: 'ARMORED',
    weakTo: 'SQUAT',
    resistantTo: 'JUMPING_JACK',
    shieldHits: 2,
    maxShieldHits: 2,
    sprite: '🍩',
    description: 'A sticky donut protected by thick sugar glaze.',
  },

  NACHOS: {
    id: 'NACHOS',
    name: 'Crunchy Nachos',
    maxHp: 58,
    attack: 9,
    defense: 3,
    xpReward: 32,
    coinReward: 30,
    isBoss: false,
    archetype: 'ARMORED',
    weakTo: 'WALL_SIT',
    resistantTo: 'JUMPING_JACK',
    shieldHits: 2,
    maxShieldHits: 2,
    sprite: '🌮',
    description: 'Spiky tortilla fortress cracked by isometric leg endurance.',
  },

  BURGER: {
    id: 'BURGER',
    name: 'Greasy Burger',
    maxHp: 50,
    attack: 8,
    defense: 2,
    xpReward: 25,
    coinReward: 26,
    isBoss: false,
    archetype: 'TOXIC',
    weakTo: 'PUSH_UP',
    resistantTo: 'SQUAT',
    sprite: '🍔',
    description: 'A sentient burger dripping with slowing grease.',
  },

  HOT_SAUCE: {
    id: 'HOT_SAUCE',
    name: 'Fiery Sauce',
    maxHp: 65,
    attack: 11,
    defense: 2,
    xpReward: 34,
    coinReward: 32,
    isBoss: false,
    archetype: 'TOXIC',
    weakTo: 'ARM_HOLD',
    resistantTo: 'JUMPING_JACK',
    sprite: '🌶️',
    description: 'A scorching pepper spirit best tamed by steady arm holds.',
  },

  PIZZA: {
    id: 'PIZZA',
    name: 'Cheesy Pizza',
    maxHp: 70,
    attack: 10,
    defense: 3,
    xpReward: 35,
    coinReward: 35,
    isBoss: false,
    archetype: 'ARMORED',
    weakTo: 'PLANK',
    resistantTo: 'PUSH_UP',
    shieldHits: 3,
    maxShieldHits: 3,
    sprite: '🍕',
    description: 'A molten cheese pizza armored in a crispy crust.',
  },

  BOSS_KING_BURGER: {
    id: 'BOSS_KING_BURGER',
    name: 'King Burger',
    maxHp: 200,
    attack: 15,
    defense: 5,
    xpReward: 150,
    coinReward: 100,
    isBoss: true,
    archetype: 'BOSS',
    weakTo: 'SQUAT',
    resistantTo: 'JUMPING_JACK',
    phaseThresholds: [0.7, 0.4],
    sprite: '👑🍔',
    description: 'The ruler of all junk food. Beware his rage!',
  },

  BOSS_PIZZA_EMPEROR: {
    id: 'BOSS_PIZZA_EMPEROR',
    name: 'Pizza Emperor',
    maxHp: 240,
    attack: 17,
    defense: 6,
    xpReward: 185,
    coinReward: 130,
    isBoss: true,
    archetype: 'BOSS',
    weakTo: 'PLANK',
    resistantTo: 'SQUAT',
    phaseThresholds: [0.7, 0.35],
    sprite: '👑🍕',
    description: 'A supreme deep-dish overlord commanding endless waves.',
  },
};

const ENDLESS_REGULAR_POOL: MonsterTemplate[] = [
  MONSTERS.SODA,
  MONSTERS.FRIES,
  MONSTERS.MILKSHAKE,
  MONSTERS.DONUT,
  MONSTERS.NACHOS,
  MONSTERS.BURGER,
  MONSTERS.HOT_SAUCE,
  MONSTERS.PIZZA,
];

const ENDLESS_BOSS_POOL: MonsterTemplate[] = [
  MONSTERS.BOSS_KING_BURGER,
  MONSTERS.BOSS_PIZZA_EMPEROR,
];

/**
 * Generate a scaled enemy for Endless Arena wave N (1-indexed).
 * Every 5th wave spawns an Elite Boss.
 */
export function createEndlessWaveMonster(wave: number): MonsterStats {
  const safeWave = Math.max(1, Math.floor(wave));
  const isBossWave = safeWave % 5 === 0;

  const template = isBossWave
    ? ENDLESS_BOSS_POOL[(Math.floor(safeWave / 5) - 1) % ENDLESS_BOSS_POOL.length]
    : ENDLESS_REGULAR_POOL[(safeWave - 1) % ENDLESS_REGULAR_POOL.length];

  const scale = 1 + (safeWave - 1) * 0.16;
  const base = createMonster(template);

  const scaledHp = Math.round(base.maxHp * scale);
  const scaledAttack = Math.round(base.attack * (1 + (safeWave - 1) * 0.12));
  const scaledDefense = Math.round(base.defense * (1 + (safeWave - 1) * 0.1));
  const scaledXp = Math.round(base.xpReward * (1 + (safeWave - 1) * 0.2));
  const scaledCoins = Math.round((base.coinReward ?? 20) * (1 + (safeWave - 1) * 0.22));

  return {
    ...base,
    hp: scaledHp,
    maxHp: scaledHp,
    attack: scaledAttack,
    defense: scaledDefense,
    xpReward: scaledXp,
    coinReward: scaledCoins,
  };
}
