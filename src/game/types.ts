/**
 * Core RPG game types and interfaces.
 * Pure data structures with ZERO dependencies on React, DOM, or CV logic.
 */

import type { ExerciseId } from './data/exercises';

export type MonsterArchetype = 'FAST' | 'ARMORED' | 'TOXIC' | 'BOSS';
export type BattleRank = 'S' | 'A' | 'B' | 'C';
export type ItemRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type ExerciseMatchup = 'WEAK' | 'NEUTRAL' | 'RESISTANT';

export interface EquipmentLoadout {
  mode: 'BODYWEIGHT' | 'DUMBBELLS';
  /** Weight per hand in kg (0 when BODYWEIGHT) */
  weightKg: number;
}

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
  comboWindowBonusMs?: number;
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

  /** Tactical archetype & abilities */
  archetype?: MonsterArchetype;
  weakTo?: ExerciseId;
  resistantTo?: ExerciseId;
  attackIntervalMs?: number;
  shieldHits?: number;
  maxShieldHits?: number;
  coinReward?: number;
}

/**
 * Combat action result.
 */
export interface CombatResult {
  damageDealt: number;
  wasCritical: boolean;
  wasUltimate: boolean;
  targetKilled: boolean;
  playerLeveledUp: boolean;
  xpGained: number;
  matchup: ExerciseMatchup;
  comboMultiplier: number;
  loadoutMultiplier: number;
  shieldHit: boolean;
  shieldBroken: boolean;
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
  rarity: ItemRarity;
  price: number;
  description: string;

  /** For equipment: stat modifiers */
  stats?: Partial<PlayerStats> & {
    comboWindowBonusMs?: number;
  };

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
  maxCombo: number;
  totalTonnageKg: number;
  circuitsCompleted: number;
  totalEstimatedKcal?: number;
  totalDurationSec?: number;
  totalCoinsEarned?: number;
}

export interface ExerciseTotals {
  reps: number;
  holdSeconds: number;
}

export interface DailyActivityEntry {
  date: string; // YYYY-MM-DD
  reps: number;
  holdSeconds: number;
  battlesWon: number;
  coinsEarned: number;
  estimatedKcal: number;
  tonnageKg?: number;
  circuitsCompleted?: number;
  durationSec?: number;
  exercises?: Partial<Record<ExerciseId, ExerciseTotals>>;
}

export interface DailyQuestState {
  date: string; // YYYY-MM-DD
  claimedIds: string[];
  repsToday: number;
  holdSecondsToday: number;
  winsToday: number;
}

export interface StreakState {
  current: number;
  best: number;
  lastActiveDate: string | null; // YYYY-MM-DD
}

export interface BestiaryEntry {
  encounters: number;
  defeats: number;
  fastestVictorySec: number | null;
  weaknessDiscovered: boolean;
}

export interface EndlessArenaStats {
  bestWave: number;
  totalArenaWins: number;
}

export type SeedId = 'PROTEIN_MINT' | 'IRON_BAMBOO' | 'CHILI_PEPPER' | 'GOLDEN_LOTUS';
export type WeedId = 'WEED_DANDELION' | 'WEED_THISTLE' | 'WEED_VINE';
export type WateringCanTier = 1 | 2 | 3 | 4;

export interface GardenPlotState {
  id: number;
  seedId: SeedId | null;
  growth: number;
  weedId: WeedId | null;
}

export interface GardenState {
  unlockedPlots: number;
  plots: GardenPlotState[];
  seedInventory: Record<SeedId, number>;
  wateringCanTier: WateringCanTier;
  waterCharges: number;
  totalHarvested: number;
  weedsDefeated: number;
}

export interface ExerciseCalibrationSettings {
  squatBottomAngle: number;
  pushupBottomAngle: number;
  plankMinBodyAngle: number;
  jumpingJackPeakArmAngle: number;
  armHoldMinShoulderAngle: number;
  wallSitMaxKneeAngle: number;
  overheadPressTopAngle: number;
}

/**
 * Persistent game state (saved/loaded via Zustand).
 */
export interface GameState {
  player: PlayerStats;
  inventory: Inventory;
  coins: number;
  loadout: EquipmentLoadout;
  currentLevel: string | null;
  unlockedLevels: string[];
  completedLevels: string[];
  unlockedAchievements: string[];

  /** Combat state (null when not in battle) */
  currentEnemy: MonsterStats | null;

  /** Aggregate workout statistics */
  workoutStats: WorkoutStats;
  exerciseTotals: Record<ExerciseId, ExerciseTotals>;
  streak: StreakState;
  dailyHistory: Record<string, DailyActivityEntry>;
  dailyQuests: DailyQuestState;
  bestiary: Record<string, BestiaryEntry>;
  endlessStats: EndlessArenaStats;
  garden: GardenState;

  /** Settings and calibration */
  settings: {
    soundEnabled: boolean;
    voiceEnabled: boolean;
    voiceControlEnabled: boolean;
    cameraFacingMode: 'user' | 'environment';
    targetPoseFps: 30 | 60;
    exerciseConfigs: Record<string, unknown>; // exerciseId -> ExerciseConfig
    exerciseCalibration: ExerciseCalibrationSettings;
    language: 'ru' | 'en'; // UI language
  };
}
