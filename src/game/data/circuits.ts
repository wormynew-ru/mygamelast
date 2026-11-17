/**
 * Data-driven Circuit Training Dungeon definitions & custom circuit builder helpers.
 * Chains 3-6 consecutive rooms (exercise + monster pairs) with brief rest intervals.
 * ZERO React, DOM, or CV imports.
 */

import { EXERCISES, type ExerciseId } from './exercises';
import { MONSTERS } from './monsters';
import type { CustomCircuitDefinition, CustomCircuitRoom } from '../types';

export type CircuitId =
  | 'UPPER_IRON'
  | 'STATIC_GAUNTLET'
  | 'FULL_BODY_BLITZ'
  | 'LOWER_POWER_SPLIT'
  | 'CARDIO_SHRED'
  | 'DUMBBELL_SCULPT';

export interface CircuitRoom {
  monsterId: string;
  exerciseId: ExerciseId;
  restAfterSec: number;
}

export interface CircuitDefinition {
  id: CircuitId;
  icon: string;
  rooms: CircuitRoom[];
  bonusCoins: number;
  bonusXp: number;
  guaranteedLootPool: string[];
}

export const MAX_CUSTOM_CIRCUITS = 6;
export const MIN_CUSTOM_CIRCUIT_ROOMS = 2;
export const MAX_CUSTOM_CIRCUIT_ROOMS = 6;

export const CIRCUITS: CircuitDefinition[] = [
  {
    id: 'UPPER_IRON',
    icon: '🏋️',
    rooms: [
      { monsterId: 'MILKSHAKE', exerciseId: 'OVERHEAD_PRESS', restAfterSec: 8 },
      { monsterId: 'HOT_SAUCE', exerciseId: 'ARM_HOLD', restAfterSec: 8 },
      { monsterId: 'BURGER', exerciseId: 'PUSH_UP', restAfterSec: 0 },
    ],
    bonusCoins: 75,
    bonusXp: 80,
    guaranteedLootPool: ['WEIGHT_BELT', 'FITNESS_WRISTBANDS', 'TITANIUM_DUMBBELLS'],
  },
  {
    id: 'STATIC_GAUNTLET',
    icon: '🛡️',
    rooms: [
      { monsterId: 'NACHOS', exerciseId: 'WALL_SIT', restAfterSec: 10 },
      { monsterId: 'HOT_SAUCE', exerciseId: 'ARM_HOLD', restAfterSec: 10 },
      { monsterId: 'PIZZA', exerciseId: 'PLANK', restAfterSec: 0 },
    ],
    bonusCoins: 90,
    bonusXp: 100,
    guaranteedLootPool: ['ARMOR_VEST', 'FITNESS_WRISTBANDS', 'MEGA_RECOVERY_SMOOTHIE'],
  },
  {
    id: 'FULL_BODY_BLITZ',
    icon: '🔥',
    rooms: [
      { monsterId: 'SODA', exerciseId: 'JUMPING_JACK', restAfterSec: 8 },
      { monsterId: 'DONUT', exerciseId: 'SQUAT', restAfterSec: 8 },
      { monsterId: 'MILKSHAKE', exerciseId: 'OVERHEAD_PRESS', restAfterSec: 8 },
      { monsterId: 'BOSS_KING_BURGER', exerciseId: 'WALL_SIT', restAfterSec: 0 },
    ],
    bonusCoins: 150,
    bonusXp: 160,
    guaranteedLootPool: ['TITANIUM_DUMBBELLS', 'CHAMPION_BELT', 'FITNESS_WRISTBANDS'],
  },
  {
    id: 'LOWER_POWER_SPLIT',
    icon: '🦵',
    rooms: [
      { monsterId: 'DONUT', exerciseId: 'LUNGE', restAfterSec: 8 },
      { monsterId: 'NACHOS', exerciseId: 'WALL_SIT', restAfterSec: 10 },
      { monsterId: 'BURGER', exerciseId: 'SQUAT', restAfterSec: 0 },
    ],
    bonusCoins: 110,
    bonusXp: 120,
    guaranteedLootPool: ['RUNNING_SHOES', 'WEIGHT_BELT', 'PROTEIN_SHAKE'],
  },
  {
    id: 'CARDIO_SHRED',
    icon: '⚡',
    rooms: [
      { monsterId: 'SODA', exerciseId: 'HIGH_KNEES', restAfterSec: 6 },
      { monsterId: 'FRIES', exerciseId: 'JUMPING_JACK', restAfterSec: 8 },
      { monsterId: 'PIZZA', exerciseId: 'HIGH_KNEES', restAfterSec: 0 },
    ],
    bonusCoins: 100,
    bonusXp: 110,
    guaranteedLootPool: ['RUNNING_SHOES', 'ISOTONIC_FLASK', 'ENERGY_BAR'],
  },
  {
    id: 'DUMBBELL_SCULPT',
    icon: '💪',
    rooms: [
      { monsterId: 'MILKSHAKE', exerciseId: 'FRONT_RAISE', restAfterSec: 8 },
      { monsterId: 'HOT_SAUCE', exerciseId: 'OVERHEAD_PRESS', restAfterSec: 8 },
      { monsterId: 'BOSS_KING_BURGER', exerciseId: 'LUNGE', restAfterSec: 0 },
    ],
    bonusCoins: 140,
    bonusXp: 150,
    guaranteedLootPool: ['TITANIUM_DUMBBELLS', 'FITNESS_WRISTBANDS', 'CHAMPION_BELT'],
  },
];

export function getCircuitById(id: string): CircuitDefinition | undefined {
  return CIRCUITS.find((c) => c.id === id);
}

export function computeCustomCircuitRewards(roomCount: number): {
  bonusCoins: number;
  bonusXp: number;
} {
  const clamped = Math.max(MIN_CUSTOM_CIRCUIT_ROOMS, Math.min(MAX_CUSTOM_CIRCUIT_ROOMS, roomCount));
  return {
    bonusCoins: 25 * clamped + 20,
    bonusXp: 30 * clamped + 20,
  };
}

export function normalizeCustomCircuits(raw: unknown): CustomCircuitDefinition[] {
  if (!Array.isArray(raw)) return [];
  const valid: CustomCircuitDefinition[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const src = item as Partial<CustomCircuitDefinition>;
    if (!Array.isArray(src.rooms)) continue;

    const cleanRooms: CustomCircuitRoom[] = [];
    for (const r of src.rooms.slice(0, MAX_CUSTOM_CIRCUIT_ROOMS)) {
      if (!r || typeof r !== 'object') continue;
      if (!(r.exerciseId in EXERCISES)) continue;
      const monsterId = r.monsterId in MONSTERS ? r.monsterId : 'BURGER';
      const restAfterSec = Math.max(0, Math.min(45, Math.floor(Number(r.restAfterSec) || 0)));
      cleanRooms.push({
        exerciseId: r.exerciseId,
        monsterId,
        restAfterSec,
      });
    }

    if (cleanRooms.length < MIN_CUSTOM_CIRCUIT_ROOMS) continue;
    cleanRooms[cleanRooms.length - 1] = {
      ...cleanRooms[cleanRooms.length - 1],
      restAfterSec: 0,
    };

    const name =
      typeof src.name === 'string' && src.name.trim()
        ? src.name.trim().slice(0, 40)
        : `Circuit ${valid.length + 1}`;
    const id =
      typeof src.id === 'string' && src.id.trim()
        ? src.id.trim()
        : `custom-circuit-${valid.length + 1}`;

    valid.push({
      id,
      name,
      rooms: cleanRooms,
      createdAtDate: typeof src.createdAtDate === 'string' ? src.createdAtDate : '',
    });

    if (valid.length >= MAX_CUSTOM_CIRCUITS) break;
  }

  return valid;
}
