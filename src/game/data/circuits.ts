/**
 * Data-driven Circuit Training Dungeon definitions.
 * Chains 3-4 consecutive rooms (exercise + monster pairs) with brief rest intervals.
 * ZERO React, DOM, or CV imports.
 */

import type { ExerciseId } from './exercises';

export type CircuitId = 'UPPER_IRON' | 'STATIC_GAUNTLET' | 'FULL_BODY_BLITZ';

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
];

export function getCircuitById(id: string): CircuitDefinition | undefined {
  return CIRCUITS.find((c) => c.id === id);
}
