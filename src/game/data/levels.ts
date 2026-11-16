/**
 * Data-driven campaign level definitions.
 * Connects monsters, recommended exercises, progression unlocks, and item drop tables.
 */

import type { ExerciseId } from './exercises';

export interface ItemDropEntry {
  itemId: string;
  chance: number; // 0.0 - 1.0
}

export interface CampaignLevel {
  id: string;
  order: number;
  monsterId: string;
  recommendedExercise: ExerciseId;
  nextLevelId: string | null;
  dropTable: ItemDropEntry[];
}

export const LEVELS: CampaignLevel[] = [
  {
    id: 'LEVEL_1',
    order: 1,
    monsterId: 'SODA',
    recommendedExercise: 'JUMPING_JACK',
    nextLevelId: 'LEVEL_2',
    dropTable: [
      { itemId: 'ENERGY_BAR', chance: 0.65 },
      { itemId: 'ISOTONIC_FLASK', chance: 0.35 },
      { itemId: 'RUNNING_SHOES', chance: 0.25 },
    ],
  },
  {
    id: 'LEVEL_2',
    order: 2,
    monsterId: 'DONUT',
    recommendedExercise: 'SQUAT',
    nextLevelId: 'LEVEL_3',
    dropTable: [
      { itemId: 'ISOTONIC_FLASK', chance: 0.5 },
      { itemId: 'PROTEIN_SHAKE', chance: 0.35 },
      { itemId: 'RUNNING_SHOES', chance: 0.3 },
    ],
  },
  {
    id: 'LEVEL_3',
    order: 3,
    monsterId: 'BURGER',
    recommendedExercise: 'PUSH_UP',
    nextLevelId: 'LEVEL_4',
    dropTable: [
      { itemId: 'PROTEIN_SHAKE', chance: 0.5 },
      { itemId: 'WEIGHT_BELT', chance: 0.35 },
      { itemId: 'FITNESS_WRISTBANDS', chance: 0.2 },
    ],
  },
  {
    id: 'LEVEL_4',
    order: 4,
    monsterId: 'PIZZA',
    recommendedExercise: 'PLANK',
    nextLevelId: 'LEVEL_5',
    dropTable: [
      { itemId: 'PROTEIN_SHAKE', chance: 0.55 },
      { itemId: 'ARMOR_VEST', chance: 0.4 },
      { itemId: 'TITANIUM_DUMBBELLS', chance: 0.2 },
    ],
  },
  {
    id: 'LEVEL_5',
    order: 5,
    monsterId: 'BOSS_KING_BURGER',
    recommendedExercise: 'SQUAT',
    nextLevelId: null,
    dropTable: [
      { itemId: 'CHAMPION_BELT', chance: 0.35 },
      { itemId: 'MEGA_RECOVERY_SMOOTHIE', chance: 0.6 },
      { itemId: 'ARMOR_VEST', chance: 0.6 },
      { itemId: 'WEIGHT_BELT', chance: 0.6 },
    ],
  },
];

export function getLevelById(levelId: string): CampaignLevel | undefined {
  return LEVELS.find((lvl) => lvl.id === levelId);
}
