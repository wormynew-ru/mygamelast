/**
 * Data-driven exercise definitions.
 * Maps exercise IDs to their display names, descriptions, and damage formulas.
 */

export interface ExerciseDefinition {
  id: string;
  name: string;
  description: string;

  /** Base damage per rep (modified by player stats in CombatEngine) */
  baseDamage: number;

  /** Difficulty tier (affects XP rewards) */
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';

  /** Icon/sprite identifier (for UI) */
  icon: string;
}

/**
 * All available exercises in the game.
 * Add new entries here to unlock them in gameplay.
 */
export const EXERCISES: Record<string, ExerciseDefinition> = {
  PUSH_UP: {
    id: 'PUSH_UP',
    name: 'Push-up',
    description: 'Classic upper body exercise. Defeats burger enemies.',
    baseDamage: 15,
    difficulty: 'MEDIUM',
    icon: '💪',
  },

  SQUAT: {
    id: 'SQUAT',
    name: 'Squat',
    description: 'Lower body powerhouse. Crushes pizza monsters.',
    baseDamage: 20,
    difficulty: 'MEDIUM',
    icon: '🦵',
  },

  PLANK: {
    id: 'PLANK',
    name: 'Plank Hold',
    description: 'Core endurance test. Blocks enemy attacks.',
    baseDamage: 5, // Low damage, high defense bonus
    difficulty: 'HARD',
    icon: '🛡️',
  },

  JUMPING_JACK: {
    id: 'JUMPING_JACK',
    name: 'Jumping Jack',
    description: 'Cardio blast. Quick damage against soda cans.',
    baseDamage: 10,
    difficulty: 'EASY',
    icon: '⚡',
  },
};
