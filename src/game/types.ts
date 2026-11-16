/**
 * Core RPG game types and interfaces.
 * Pure data structures with ZERO dependencies on React, DOM, or CV logic.
 */

/**
 * Player character stats.
 */
export interface PlayerStats {
  level: number;
  xp: number;
  xpToNextLevel: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  critChance: number; // 0.0-1.0
  critMultiplier: number;
}

/**
 * Monster/enemy stats.
 */
export interface MonsterStats {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  xpReward: number;
  isBoss: boolean;

  /** Boss-specific: phase thresholds (e.g., [0.7, 0.4] for 70% and 40% HP) */
  phaseThresholds?: number[];
}

/**
 * Combat action result.
 */
export interface CombatResult {
  damageDealt: number;
  wasCritical: boolean;
  targetKilled: boolean;
  playerLeveledUp: boolean;
  xpGained: number;
}

/**
 * Item types in the game.
 */
export type ItemType = 'CONSUMABLE' | 'EQUIPMENT' | 'QUEST';

/**
 * Game item definition.
 */
export interface Item {
  id: string;
  name: string;
  type: ItemType;
  description: string;

  /** For equipment: stat modifiers */
  stats?: Partial<PlayerStats>;

  /** For consumables: effect on use */
  effect?: {
    hpRestore?: number;
    buffDuration?: number; // seconds
  };
}

/**
 * Player inventory.
 */
export interface Inventory {
  items: Map<string, number>; // itemId -> quantity
  equippedItems: string[]; // equipped item IDs
}

/**
 * Exercise requirement for a level/quest.
 */
export interface ExerciseRequirement {
  exerciseId: string;
  requiredReps: number;
  completedReps: number;
}

/**
 * Game level/stage definition.
 */
export interface Level {
  id: string;
  name: string;
  description: string;
  monsterIds: string[];
  bossId?: string;
  requiredExercises: ExerciseRequirement[];
  rewards: {
    xp: number;
    items?: string[];
  };
}

export interface WorkoutStats {
  totalReps: number;
  totalHoldSeconds: number;
  monstersDefeated: number;
}

export interface ExerciseCalibrationSettings {
  squatBottomAngle: number;
  pushupBottomAngle: number;
  plankMinBodyAngle: number;
  jumpingJackPeakArmAngle: number;
}

/**
 * Persistent game state (saved/loaded via Zustand).
 */
export interface GameState {
  player: PlayerStats;
  inventory: Inventory;
  currentLevel: string | null;
  unlockedLevels: string[];
  completedLevels: string[];
  unlockedAchievements: string[];

  /** Combat state (null when not in battle) */
  currentEnemy: MonsterStats | null;

  /** Aggregate workout statistics */
  workoutStats: WorkoutStats;

  /** Settings and calibration */
  settings: {
    soundEnabled: boolean;
    voiceEnabled: boolean;
    cameraFacingMode: 'user' | 'environment';
    exerciseConfigs: Record<string, unknown>; // exerciseId -> ExerciseConfig
    exerciseCalibration: ExerciseCalibrationSettings;
    language: 'ru' | 'en'; // UI language
  };
}
