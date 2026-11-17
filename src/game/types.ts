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
  wasParry?: boolean;
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
  tabataCompleted?: number;
  totalEstimatedKcal?: number;
  totalDurationSec?: number;
  totalCoinsEarned?: number;
  totalParries?: number;
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

export type MonsterTrophyId =
  | 'TROPHY_FIZZ_CORE'
  | 'TROPHY_GLAZE_SHELL'
  | 'TROPHY_CAPSAICIN_DROP'
  | 'TROPHY_CROWN_SPICE';

export type ExerciseDiscipline = 'STRENGTH' | 'STATIC' | 'CARDIO';

export type SanctuaryMixCategory = 'BASE' | 'DISCIPLINE' | 'MUTAGEN';

export type SanctuaryMixId =
  | 'MINT_ISOTONIC'
  | 'BAMBOO_FORTIFIER'
  | 'CHILI_OVERDRIVE_SHOT'
  | 'LOTUS_NECTAR'
  | 'TITAN_BREW'
  | 'MONOLITH_ELIXIR'
  | 'PULSE_FIZZ'
  | 'ARENA_TONIC'
  | 'BERSERK_CAPSAICIN'
  | 'GLASS_OVERDRIVE'
  | 'TOXIC_CATALYST'
  | 'GREED_EXTRACT';

export type SanctuarySynergyId =
  | 'ISOTONIC_RHYTHM'
  | 'IRON_BASTION'
  | 'POWER_SURGE'
  | 'ADRENALINE_GUARD'
  | 'PURE_FURY'
  | 'ENDLESS_ENDURANCE'
  | 'ALCHEMIST_TRIUMVIRATE';

export type SanctuaryLabTier = 1 | 2 | 3;

export interface GardenPlotState {
  id: number;
  seedId: SeedId | null;
  growth: number;
  weedId: WeedId | null;
  isMutant?: boolean;
}

export interface GardenState {
  unlockedPlots: number;
  plots: GardenPlotState[];
  seedInventory: Record<SeedId, number>;
  cropInventory: Record<SeedId, number>;
  wateringCanTier: WateringCanTier;
  waterCharges: number;
  totalHarvested: number;
  weedsDefeated: number;
}

export interface SanctuaryPreset {
  id: string;
  name: string;
  buffs: SanctuaryMixId[];
}

export interface AlchemyOrderRequirement {
  seedId?: SeedId;
  trophyId?: MonsterTrophyId;
  mixId?: SanctuaryMixId;
  qty: number;
}

export interface AlchemyOrder {
  dateKey: string;
  orderIndex: number;
  requirements: AlchemyOrderRequirement[];
  rewardCoins: number;
  rewardXp: number;
  completed: boolean;
}

export interface SanctuaryState {
  labTier: SanctuaryLabTier;
  mixInventory: Record<SanctuaryMixId, number>;
  trophyInventory: Record<MonsterTrophyId, number>;
  activeBuffs: SanctuaryMixId[];
  healedBuffIds: SanctuaryMixId[];
  totalCrafted: number;
  totalSynergiesActivated: number;
  presets?: SanctuaryPreset[];
  alchemyOrder?: AlchemyOrder | null;
  completedOrdersCount?: number;
}

export type TalentBranch = 'MIGHT' | 'BASTION' | 'BOTANY';

export type TalentId =
  | 'MIGHT_STRIKE'
  | 'MIGHT_CRIT_EDGE'
  | 'MIGHT_EXECUTIONER'
  | 'MIGHT_OVERDRIVE'
  | 'BASTION_VITALITY'
  | 'BASTION_AEGIS'
  | 'BASTION_TEMPO'
  | 'BASTION_THORNS'
  | 'BOTANY_SCHOLAR'
  | 'BOTANY_FORTUNE'
  | 'BOTANY_GREEN_THUMB'
  | 'BOTANY_ALCHEMIST';

export interface PlayerTalentState {
  ranks: Partial<Record<TalentId, number>>;
  spentPoints: number;
}

export type ArtifactId =
  | 'PHOENIX_BAND'
  | 'TITAN_CORE'
  | 'BERSERKER_SIGIL'
  | 'VAMPIRIC_FANG'
  | 'SHIELD_BREAKER_PRISM'
  | 'CHRONO_HOURGLASS';

export interface ArtifactState {
  unlockedIds: ArtifactId[];
  equippedIds: ArtifactId[];
}

export type ProgramId =
  | 'STARTER_3D'
  | 'HYPERTROPHY_5D'
  | 'ENDURANCE_5D'
  | 'TITAN_WEEK_7D';

export interface ActiveProgramState {
  programId: ProgramId;
  currentDayIndex: number;
  completedDays: number[];
  startedAtDate: string;
}

export interface ProgramProgressState {
  active: ActiveProgramState | null;
  completedProgramIds: ProgramId[];
  totalProgramsFinished: number;
}

export interface ExercisePersonalRecord {
  bestBattleReps: number;
  bestHoldSec: number;
  bestCombo: number;
  maxWeightKg: number;
  bestHitDamage: number;
}

export type MutatorId =
  | 'GLASS_CANNON'
  | 'IRON_FOES'
  | 'BLITZ_CLOCK'
  | 'TOXIC_MIST'
  | 'NO_ITEMS';

export interface WeeklyChallengeState {
  completedWeekKeys: string[];
  bestRankByWeek: Record<string, BattleRank>;
  totalCompleted: number;
}

export interface ExerciseCalibrationSettings {
  squatBottomAngle: number;
  pushupBottomAngle: number;
  plankMinBodyAngle: number;
  jumpingJackPeakArmAngle: number;
  armHoldMinShoulderAngle: number;
  wallSitMaxKneeAngle: number;
  overheadPressTopAngle: number;
  lungeBottomAngle: number;
  highKneesLiftAngle: number;
  frontRaisePeakAngle: number;
}

export type PoseComputeDelegate = 'GPU' | 'CPU';

export type CadenceMode = 'OFF' | 'STRENGTH_2_1_2' | 'STEADY_60' | 'CARDIO_90';

export type TabataPresetId = 'CLASSIC_20_10' | 'POWER_30_15' | 'ENDURANCE_40_20';

export interface TabataConfig {
  presetId?: TabataPresetId;
  workSec: number;
  restSec: number;
  rounds: number;
}

export interface CustomCircuitRoom {
  monsterId: string;
  exerciseId: ExerciseId;
  restAfterSec: number;
}

export interface CustomCircuitDefinition {
  id: string;
  name: string;
  rooms: CustomCircuitRoom[];
  createdAtDate: string;
}

export type BenchmarkRating = 'BRONZE' | 'SILVER' | 'GOLD' | 'ELITE';

export interface BenchmarkEntry {
  id: string;
  dateKey: string;
  exerciseId: ExerciseId;
  score: number;
  avgCadenceRpm: number;
  rating: BenchmarkRating;
}

export interface StageMasteryRecord {
  rankS?: boolean;
  parryAce?: boolean;
  tactician?: boolean;
}

export type StageMasteryBadge = keyof StageMasteryRecord;

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
  sanctuary: SanctuaryState;

  /** v3.5 Meta Progression & Challenges */
  talents: PlayerTalentState;
  artifacts: ArtifactState;
  programs: ProgramProgressState;
  personalRecords: Record<ExerciseId, ExercisePersonalRecord>;
  bestSingleHitDamage: number;
  activeMutators: MutatorId[];
  weeklyChallenge: WeeklyChallengeState;

  /** Training Formats, Custom Circuits & Benchmarks */
  customCircuits: CustomCircuitDefinition[];
  benchmarks: BenchmarkEntry[];
  bestBenchmarkByExercise: Partial<Record<ExerciseId, number>>;

  /** Tactical Campaign Stage Mastery (non-grind 3-star objectives) */
  stageMastery: Record<string, StageMasteryRecord>;

  /** Settings and calibration */
  settings: {
    soundEnabled: boolean;
    voiceEnabled: boolean;
    voiceControlEnabled: boolean;
    cameraFacingMode: 'user' | 'environment';
    targetPoseFps: 15 | 30 | 60;
    poseDelegate: PoseComputeDelegate;
    exerciseConfigs: Record<string, unknown>; // exerciseId -> ExerciseConfig
    exerciseCalibration: ExerciseCalibrationSettings;
    language: 'ru' | 'en'; // UI language
    scriptedPoseEnabled: boolean;
    cadenceMode: CadenceMode;
    warmUpEnabled: boolean;
  };
}
