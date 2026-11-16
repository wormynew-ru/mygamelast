/**
 * Data-driven exercise definitions.
 * Maps exercise IDs to their type, damage multipliers, dumbbell support, and metadata.
 */

export type ExerciseId =
  | 'SQUAT'
  | 'PUSH_UP'
  | 'PLANK'
  | 'JUMPING_JACK'
  | 'ARM_HOLD'
  | 'WALL_SIT'
  | 'OVERHEAD_PRESS';

export type ExerciseTrackingType = 'rep' | 'hold';

export interface ExerciseDefinition {
  id: ExerciseId;
  name: string;
  description: string;

  /** Rep-based or hold-based (damage per second) */
  trackingType: ExerciseTrackingType;

  /** Base damage per rep or per second of hold */
  baseDamage: number;

  /** Multiplier passed to CombatEngine */
  damageMultiplier: number;

  /** Whether optional dumbbell weight loadout amplifies damage, tonnage, and kcal */
  supportsDumbbellWeight: boolean;

  /** Difficulty tier (affects XP rewards) */
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';

  /** Icon/sprite identifier (for UI) */
  icon: string;
}

/**
 * All available exercises in the game.
 */
export const EXERCISES: Record<ExerciseId, ExerciseDefinition> = {
  SQUAT: {
    id: 'SQUAT',
    name: 'Squat',
    description: 'Lower body powerhouse. Works bodyweight or with dumbbells.',
    trackingType: 'rep',
    baseDamage: 20,
    damageMultiplier: 1.2,
    supportsDumbbellWeight: true,
    difficulty: 'MEDIUM',
    icon: '🦵',
  },

  PUSH_UP: {
    id: 'PUSH_UP',
    name: 'Push-up',
    description: 'Classic upper body exercise. Defeats burger enemies.',
    trackingType: 'rep',
    baseDamage: 15,
    damageMultiplier: 1.3,
    supportsDumbbellWeight: false,
    difficulty: 'MEDIUM',
    icon: '💪',
  },

  PLANK: {
    id: 'PLANK',
    name: 'Plank Hold',
    description: 'Core endurance test. Deals steady damage and blocks counter-attacks.',
    trackingType: 'hold',
    baseDamage: 8,
    damageMultiplier: 0.9,
    supportsDumbbellWeight: false,
    difficulty: 'HARD',
    icon: '🛡️',
  },

  JUMPING_JACK: {
    id: 'JUMPING_JACK',
    name: 'Jumping Jack',
    description: 'Cardio blast. Quick damage against soda cans.',
    trackingType: 'rep',
    baseDamage: 10,
    damageMultiplier: 0.85,
    supportsDumbbellWeight: false,
    difficulty: 'EASY',
    icon: '⚡',
  },

  ARM_HOLD: {
    id: 'ARM_HOLD',
    name: 'Arm Hold',
    description: 'Isometric lateral arm hold (empty hands or dumbbells). Blocks & cleanses.',
    trackingType: 'hold',
    baseDamage: 7,
    damageMultiplier: 0.9,
    supportsDumbbellWeight: true,
    difficulty: 'MEDIUM',
    icon: '🙆',
  },

  WALL_SIT: {
    id: 'WALL_SIT',
    name: 'Wall Sit',
    description: 'Isometric static squat hold. Shatters armor and blocks counter-attacks.',
    trackingType: 'hold',
    baseDamage: 9,
    damageMultiplier: 1.0,
    supportsDumbbellWeight: false,
    difficulty: 'HARD',
    icon: '🪑',
  },

  OVERHEAD_PRESS: {
    id: 'OVERHEAD_PRESS',
    name: 'Overhead Press',
    description: 'Front-facing shoulder press. Built for dumbbells or empty hands.',
    trackingType: 'rep',
    baseDamage: 16,
    damageMultiplier: 1.25,
    supportsDumbbellWeight: true,
    difficulty: 'MEDIUM',
    icon: '🏋️',
  },
};
