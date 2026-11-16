/**
 * Data-driven exercise definitions.
 * Maps exercise IDs to their type, damage multipliers, and metadata.
 */

export type ExerciseId = 'SQUAT' | 'PUSH_UP' | 'PLANK' | 'JUMPING_JACK';
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

  /** Difficulty tier (affects XP rewards) */
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';

  /** Icon/sprite identifier (for UI) */
  icon: string;
}

/**
 * All available exercises in the game.
 * Add new entries here to unlock them in gameplay.
 */
export const EXERCISES: Record<ExerciseId, ExerciseDefinition> = {
  SQUAT: {
    id: 'SQUAT',
    name: 'Squat',
    description: 'Lower body powerhouse. Crushes pizza monsters.',
    trackingType: 'rep',
    baseDamage: 20,
    damageMultiplier: 1.2,
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
    difficulty: 'MEDIUM',
    icon: '💪',
  },

  PLANK: {
    id: 'PLANK',
    name: 'Plank Hold',
    description: 'Core endurance test. Deals steady damage every second.',
    trackingType: 'hold',
    baseDamage: 8,
    damageMultiplier: 0.9,
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
    difficulty: 'EASY',
    icon: '⚡',
  },
};
