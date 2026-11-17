/**
 * Zustand store for game state with persistence (v11).
 * Handles player stats, loadout weight, inventory, coins, shop, daily quests, streaks,
 * 7/30-day activity history, monster bestiary, endless arena, garden & harvested crops, calibration, and settings.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AlchemyOrder,
  ArtifactId,
  BattleRank,
  BenchmarkEntry,
  BestiaryEntry,
  CustomCircuitDefinition,
  CustomCircuitRoom,
  DailyActivityEntry,
  DailyQuestState,
  EndlessArenaStats,
  EquipmentLoadout,
  ExerciseCalibrationSettings,
  ExercisePersonalRecord,
  ExerciseTotals,
  GameState,
  Inventory,
  MonsterStats,
  MonsterTrophyId,
  MutatorId,
  PlayerStats,
  ProgramId,
  SanctuaryMixId,
  SeedId,
  StageMasteryBadge,
  StageMasteryRecord,
  StreakState,
  TalentId,
  WorkoutStats,
} from './types';
import { createPlayer, getEffectivePlayerStats, levelUp, useConsumableItem } from './CombatEngine';
import { ITEMS } from './data/items';
import { evaluateNewAchievements } from './data/achievements';
import { EXERCISES, type ExerciseId } from './data/exercises';
import {
  MAX_CUSTOM_CIRCUITS,
  MIN_CUSTOM_CIRCUIT_ROOMS,
  normalizeCustomCircuits,
} from './data/circuits';
import {
  CADENCE_MODES,
  computeBenchmarkRating,
  normalizeBenchmarks,
} from './data/trainingFormats';
import {
  QUICK_WEED_CLEAR_COST,
  SEEDS,
  WATERING_CANS,
  WATER_REFILL_COST,
  applyWorkoutVictoryToGarden,
  computeHarvestReward,
  createInitialGardenState,
  getNextPlotUnlockCost,
  getNextWateringCanTier,
  isPlotReadyToHarvest,
  normalizeGardenState,
  spawnWeedInGarden,
  waterAllPlotsInGarden,
  waterSinglePlotInGarden,
  type HarvestReward,
} from './data/garden';
import {
  MAX_SANCTUARY_PRESETS,
  SANCTUARY_LAB_TIERS,
  SANCTUARY_MIX_MAP,
  createInitialSanctuaryState,
  generateDailyAlchemyOrder,
  getActiveSanctuarySynergies,
  getMixEffectiveHeal,
  getNextSanctuaryLabTier,
  isMixReadyToCraft,
  normalizeSanctuaryState,
} from './data/sanctuary';
import {
  getDailyQuestsForDate,
  getLocalDateKey,
  getQuestProgress,
  updateStreakForDate,
} from './data/dailyQuests';
import {
  TALENT_RESPEC_COST,
  canUpgradeTalent,
  createInitialTalentState,
  getAggregatedTalentModifiers,
  normalizeTalentState,
} from './data/talents';
import {
  MAX_EQUIPPED_ARTIFACTS,
  createInitialArtifactState,
  normalizeArtifactState,
} from './data/artifacts';
import {
  MAX_ACTIVE_MUTATORS,
  MUTATORS,
  PROGRAM_MAP,
  createEmptyExercisePR,
  createInitialPersonalRecords,
  createInitialProgramState,
  createInitialWeeklyChallengeState,
  getISOWeekKey,
  getWeeklyChallengeForWeek,
  normalizeProgramState,
  normalizeWeeklyChallengeState,
  pickBetterRank,
} from './data/programs';
import { isSerializedMap, type SerializedMap } from './portability';
import { setCurrentLanguage, type Language } from '../i18n';

export const SAVE_SCHEMA_VERSION = 16;

export const DEFAULT_EXERCISE_CALIBRATION: ExerciseCalibrationSettings = {
  squatBottomAngle: 90,
  pushupBottomAngle: 90,
  plankMinBodyAngle: 160,
  jumpingJackPeakArmAngle: 135,
  armHoldMinShoulderAngle: 65,
  wallSitMaxKneeAngle: 115,
  overheadPressTopAngle: 155,
  lungeBottomAngle: 95,
  highKneesLiftAngle: 110,
  frontRaisePeakAngle: 85,
};

function createInitialInventory(): Inventory {
  return {
    items: new Map(),
    equippedItems: [],
  };
}

function createInitialLoadout(): EquipmentLoadout {
  return {
    mode: 'BODYWEIGHT',
    weightKg: 0,
  };
}

function createInitialWorkoutStats(): WorkoutStats {
  return {
    totalReps: 0,
    totalHoldSeconds: 0,
    monstersDefeated: 0,
    maxCombo: 0,
    totalTonnageKg: 0,
    circuitsCompleted: 0,
    tabataCompleted: 0,
    totalEstimatedKcal: 0,
    totalDurationSec: 0,
    totalCoinsEarned: 0,
    totalParries: 0,
  };
}

function createInitialExerciseTotals(): Record<ExerciseId, ExerciseTotals> {
  return {
    SQUAT: { reps: 0, holdSeconds: 0 },
    PUSH_UP: { reps: 0, holdSeconds: 0 },
    PLANK: { reps: 0, holdSeconds: 0 },
    JUMPING_JACK: { reps: 0, holdSeconds: 0 },
    ARM_HOLD: { reps: 0, holdSeconds: 0 },
    WALL_SIT: { reps: 0, holdSeconds: 0 },
    OVERHEAD_PRESS: { reps: 0, holdSeconds: 0 },
    LUNGE: { reps: 0, holdSeconds: 0 },
    HIGH_KNEES: { reps: 0, holdSeconds: 0 },
    FRONT_RAISE: { reps: 0, holdSeconds: 0 },
  };
}

function createInitialStreak(): StreakState {
  return {
    current: 0,
    best: 0,
    lastActiveDate: null,
  };
}

function createInitialDailyQuests(dateKey: string = getLocalDateKey()): DailyQuestState {
  return {
    date: dateKey,
    claimedIds: [],
    repsToday: 0,
    holdSecondsToday: 0,
    winsToday: 0,
  };
}

function createInitialEndlessStats(): EndlessArenaStats {
  return {
    bestWave: 0,
    totalArenaWins: 0,
  };
}

function createInitialState(): GameState {
  return {
    player: createPlayer(),
    inventory: createInitialInventory(),
    coins: 0,
    loadout: createInitialLoadout(),
    currentLevel: null,
    unlockedLevels: ['LEVEL_1'],
    completedLevels: [],
    unlockedAchievements: [],
    currentEnemy: null,
    workoutStats: createInitialWorkoutStats(),
    exerciseTotals: createInitialExerciseTotals(),
    streak: createInitialStreak(),
    dailyHistory: {},
    dailyQuests: createInitialDailyQuests(),
    bestiary: {},
    endlessStats: createInitialEndlessStats(),
    garden: createInitialGardenState(),
    sanctuary: createInitialSanctuaryState(),
    talents: createInitialTalentState(),
    artifacts: createInitialArtifactState(),
    programs: createInitialProgramState(),
    personalRecords: createInitialPersonalRecords(),
    bestSingleHitDamage: 0,
    activeMutators: [],
    weeklyChallenge: createInitialWeeklyChallengeState(),
    customCircuits: [],
    benchmarks: [],
    bestBenchmarkByExercise: {},
    stageMastery: {},
    settings: {
      soundEnabled: true,
      voiceEnabled: false,
      voiceControlEnabled: false,
      cameraFacingMode: 'user',
      targetPoseFps: 60,
      poseDelegate: 'GPU',
      exerciseConfigs: {},
      exerciseCalibration: { ...DEFAULT_EXERCISE_CALIBRATION },
      language: 'ru',
      scriptedPoseEnabled: false,
      cadenceMode: 'OFF',
      warmUpEnabled: false,
    },
  };
}

function normalizeDailyQuests(quests: DailyQuestState, todayKey: string): DailyQuestState {
  if (quests.date === todayKey) {
    return quests;
  }
  return createInitialDailyQuests(todayKey);
}

function pruneDailyHistory(
  history: Record<string, DailyActivityEntry>,
  maxDays: number = 400
): Record<string, DailyActivityEntry> {
  const keys = Object.keys(history).sort();
  if (keys.length <= maxDays) {
    return history;
  }
  const keepKeys = new Set(keys.slice(keys.length - maxDays));
  const trimmed: Record<string, DailyActivityEntry> = {};
  for (const key of keepKeys) {
    trimmed[key] = history[key];
  }
  return trimmed;
}

interface GameStore extends GameState {
  updatePlayer: (player: Partial<PlayerStats>) => void;
  revivePlayer: () => void;
  resetPlayer: () => void;

  startCombat: (enemy: MonsterStats) => void;
  updateEnemy: (enemy: MonsterStats) => void;
  endCombat: () => void;

  addItem: (itemId: string, quantity?: number) => void;
  removeItem: (itemId: string, quantity?: number) => void;
  equipItem: (itemId: string) => void;
  unequipItem: (itemId: string) => void;
  useConsumable: (itemId: string) => boolean;

  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  buyItem: (itemId: string) => boolean;
  setLoadout: (loadout: Partial<EquipmentLoadout>) => void;

  unlockLevel: (levelId: string) => void;
  completeLevel: (levelId: string) => void;
  setCurrentLevel: (levelId: string | null) => void;

  recordWorkoutProgress: (delta: {
    reps?: number;
    holdSeconds?: number;
    monstersDefeated?: number;
    maxCombo?: number;
    exerciseId?: ExerciseId;
    estimatedKcal?: number;
    coinsEarned?: number;
    tonnageKg?: number;
    circuitsCompleted?: number;
    tabataCompleted?: number;
    durationSec?: number;
    parries?: number;
    dateKey?: string;
    suppressWeedSpawn?: boolean;
  }) => void;
  recordMonsterBestiary: (params: {
    monsterId: string;
    defeated?: boolean;
    victorySec?: number;
    weaknessDiscovered?: boolean;
  }) => void;
  claimDailyQuest: (questId: string, dateKey?: string) => { coins: number; xp: number; leveledUp: boolean } | null;
  updateEndlessProgress: (waveReached: number, wonWave: boolean) => void;
  syncAchievements: () => string[];

  buySeed: (seedId: SeedId) => boolean;
  plantSeed: (plotId: number, seedId: SeedId) => boolean;
  waterPlot: (plotId: number) => boolean;
  waterAllPlots: () => boolean;
  upgradeWateringCan: () => boolean;
  refillWateringCan: () => boolean;
  unlockGardenPlot: () => boolean;
  harvestPlot: (plotId: number) => (HarvestReward & { leveledUp: boolean }) | null;
  clearPlotWeedWithCoins: (plotId: number) => boolean;
  defeatPlotWeed: (plotId: number) => boolean;
  triggerGardenWeed: (plotId?: number) => number | null;

  craftMix: (mixId: SanctuaryMixId) => boolean;
  activateMixBuff: (mixId: SanctuaryMixId) => { healedHp: number } | null;
  deactivateMixBuff: (mixId: SanctuaryMixId) => boolean;
  addMonsterTrophy: (trophyId: MonsterTrophyId, qty?: number) => void;
  upgradeSanctuaryLab: () => boolean;
  consumeActiveSanctuaryBuffs: () => void;

  upgradeTalent: (talentId: TalentId) => boolean;
  respecTalents: () => boolean;
  unlockArtifact: (artifactId: ArtifactId) => boolean;
  equipArtifact: (artifactId: ArtifactId) => boolean;
  unequipArtifact: (artifactId: ArtifactId) => boolean;

  startProgram: (programId: ProgramId, dateKey?: string) => void;
  advanceProgramDay: (dayIndex?: number) => {
    completedProgram: boolean;
    bonusCoins: number;
    bonusXp: number;
    leveledUp: boolean;
  } | null;
  abandonProgram: () => void;

  toggleMutator: (mutatorId: MutatorId) => void;
  clearMutators: () => void;
  completeWeeklyChallenge: (
    weekKey?: string,
    rank?: BattleRank
  ) => {
    firstCompletion: boolean;
    bonusCoins: number;
    bonusXp: number;
    unlockedArtifactId: ArtifactId | null;
    leveledUp: boolean;
  };
  recordPersonalRecords: (params: {
    exerciseId: ExerciseId;
    battleReps: number;
    holdSec: number;
    maxCombo: number;
    weightKg: number;
    bestHitDamage: number;
  }) => string[];

  saveSanctuaryPreset: (slotIndex: number, name?: string) => boolean;
  applySanctuaryPreset: (slotIndex: number) => boolean;
  ensureDailyAlchemyOrder: (dateKey?: string) => AlchemyOrder;
  completeAlchemyOrder: (dateKey?: string) => {
    rewardCoins: number;
    rewardXp: number;
    leveledUp: boolean;
  } | null;

  saveCustomCircuit: (name: string, rooms: CustomCircuitRoom[], dateKey?: string) => CustomCircuitDefinition | null;
  deleteCustomCircuit: (circuitId: string) => void;
  recordBenchmarkResult: (params: {
    exerciseId: ExerciseId;
    score: number;
    avgCadenceRpm: number;
    dateKey?: string;
  }) => { entry: BenchmarkEntry; isNewBest: boolean };
  recordStageMastery: (
    levelId: string,
    earned: Partial<StageMasteryRecord>
  ) => {
    newlyEarnedBadges: StageMasteryBadge[];
    bonusCoins: number;
    bonusXp: number;
    leveledUp: boolean;
  };

  updateSettings: (settings: Partial<GameState['settings']>) => void;
  updateExerciseCalibration: (calibration: Partial<ExerciseCalibrationSettings>) => void;
  resetExerciseCalibration: () => void;
  setLanguage: (language: Language) => void;
  importGameState: (nextState: GameState) => void;

  resetGame: () => void;
}

function normalizePersonalRecords(
  raw?: Partial<Record<ExerciseId, Partial<ExercisePersonalRecord>>>
): Record<ExerciseId, ExercisePersonalRecord> {
  const base = createInitialPersonalRecords();
  if (!raw || typeof raw !== 'object') return base;
  for (const key of Object.keys(base) as ExerciseId[]) {
    const src = raw[key];
    if (!src) continue;
    base[key] = {
      ...createEmptyExercisePR(),
      bestBattleReps: Math.max(0, Math.floor(src.bestBattleReps ?? 0)),
      bestHoldSec: Math.max(0, Math.floor(src.bestHoldSec ?? 0)),
      bestCombo: Math.max(0, Math.floor(src.bestCombo ?? 0)),
      maxWeightKg: Math.max(0, Number(src.maxWeightKg ?? 0) || 0),
      bestHitDamage: Math.max(0, Math.floor(src.bestHitDamage ?? 0)),
    };
  }
  return base;
}

function normalizeStageMastery(
  raw?: Partial<Record<string, Partial<StageMasteryRecord>>>
): Record<string, StageMasteryRecord> {
  const clean: Record<string, StageMasteryRecord> = {};
  if (!raw || typeof raw !== 'object') return clean;
  for (const [levelId, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== 'object') continue;
    clean[levelId] = {
      rankS: Boolean(entry.rankS),
      parryAce: Boolean(entry.parryAce),
      tactician: Boolean(entry.tactician),
    };
  }
  return clean;
}

export function migrateGameState(persistedState: unknown, version: number): GameState {
  if (version >= 0 && version <= SAVE_SCHEMA_VERSION) {
    const state = (persistedState ?? {}) as Partial<GameState>;

    let itemsMap = new Map<string, number>();
    if (state.inventory?.items) {
      const items = state.inventory.items as unknown;
      if (items instanceof Map) {
        itemsMap = items;
      } else if (isSerializedMap(items)) {
        itemsMap = new Map(items.entries as [string, number][]);
      } else if (typeof items === 'object' && items !== null) {
        itemsMap = new Map(
          Object.entries(items as Record<string, number>).filter(
            ([, qty]) => typeof qty === 'number'
          )
        );
      }
    }

    const base = createInitialState();
    const migratedLoadout: EquipmentLoadout =
      state.loadout?.mode === 'DUMBBELLS'
        ? { mode: 'DUMBBELLS', weightKg: Math.max(1, state.loadout.weightKg ?? 2) }
        : { mode: 'BODYWEIGHT', weightKg: 0 };

    const migratedPlayer: PlayerStats = {
      ...base.player,
      ...(state.player ?? {}),
    };

    const migratedMutators: MutatorId[] = Array.isArray(state.activeMutators)
      ? Array.from(new Set(state.activeMutators.filter((id): id is MutatorId => id in MUTATORS))).slice(
          0,
          MAX_ACTIVE_MUTATORS
        )
      : [];

    return {
      ...base,
      ...state,
      coins: typeof state.coins === 'number' ? state.coins : 0,
      loadout: migratedLoadout,
      player: migratedPlayer,
      inventory: {
        items: itemsMap,
        equippedItems: state.inventory?.equippedItems || [],
      },
      unlockedAchievements: state.unlockedAchievements || [],
      workoutStats: {
        ...base.workoutStats,
        ...(state.workoutStats ?? {}),
        totalParries: Math.max(0, Math.floor(state.workoutStats?.totalParries ?? 0)),
      },
      exerciseTotals: {
        ...base.exerciseTotals,
        ...(state.exerciseTotals ?? {}),
      },
      streak: {
        ...base.streak,
        ...(state.streak ?? {}),
      },
      dailyHistory: state.dailyHistory ?? {},
      dailyQuests: state.dailyQuests
        ? normalizeDailyQuests(
            { ...base.dailyQuests, ...state.dailyQuests },
            getLocalDateKey()
          )
        : base.dailyQuests,
      bestiary: state.bestiary ?? {},
      endlessStats: {
        ...base.endlessStats,
        ...(state.endlessStats ?? {}),
      },
      garden: normalizeGardenState(state.garden),
      sanctuary: normalizeSanctuaryState(state.sanctuary),
      talents: normalizeTalentState(state.talents, migratedPlayer.level),
      artifacts: normalizeArtifactState(state.artifacts),
      programs: normalizeProgramState(state.programs),
      personalRecords: normalizePersonalRecords(state.personalRecords),
      bestSingleHitDamage: Math.max(0, Math.floor(state.bestSingleHitDamage ?? 0)),
      activeMutators: migratedMutators,
      weeklyChallenge: normalizeWeeklyChallengeState(state.weeklyChallenge),
      customCircuits: normalizeCustomCircuits(state.customCircuits),
      benchmarks: normalizeBenchmarks(state.benchmarks),
      bestBenchmarkByExercise: (() => {
        const clean: Partial<Record<ExerciseId, number>> = {};
        if (state.bestBenchmarkByExercise && typeof state.bestBenchmarkByExercise === 'object') {
          for (const exId of Object.keys(EXERCISES) as ExerciseId[]) {
            const val = Number(state.bestBenchmarkByExercise[exId] ?? 0);
            if (val > 0) {
              clean[exId] = Math.floor(val);
            }
          }
        }
        return clean;
      })(),
      stageMastery: normalizeStageMastery(state.stageMastery),
      settings: {
        ...base.settings,
        ...(state.settings ?? {}),
        voiceControlEnabled: Boolean(state.settings?.voiceControlEnabled),
        scriptedPoseEnabled: Boolean(state.settings?.scriptedPoseEnabled),
        warmUpEnabled: Boolean(state.settings?.warmUpEnabled),
        cadenceMode:
          state.settings?.cadenceMode && state.settings.cadenceMode in CADENCE_MODES
            ? state.settings.cadenceMode
            : 'OFF',
        targetPoseFps:
          state.settings?.targetPoseFps === 15 || state.settings?.targetPoseFps === 30
            ? state.settings.targetPoseFps
            : 60,
        poseDelegate: state.settings?.poseDelegate === 'CPU' ? 'CPU' : 'GPU',
        exerciseCalibration: {
          ...base.settings.exerciseCalibration,
          ...(state.settings?.exerciseCalibration ?? {}),
        },
      },
    };
  }

  console.warn(`Unknown save version ${version}, resetting game state`);
  return createInitialState();
}

const customStorage = createJSONStorage(() => localStorage, {
  replacer: (_key, value) => {
    if (value instanceof Map) {
      return {
        __type: 'Map',
        entries: Array.from(value.entries()),
      } satisfies SerializedMap<unknown, unknown>;
    }
    return value;
  },
  reviver: (_key, value) => {
    if (isSerializedMap(value)) {
      return new Map(value.entries);
    }
    return value;
  },
});

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(),

      updatePlayer: (playerUpdate) =>
        set((state) => ({
          player: { ...state.player, ...playerUpdate },
        })),

      revivePlayer: () =>
        set((state) => ({
          player: {
            ...state.player,
            hp: Math.max(state.player.hp, Math.ceil(state.player.maxHp * 0.5)),
          },
        })),

      resetPlayer: () =>
        set(() => ({
          player: createPlayer(),
          inventory: createInitialInventory(),
        })),

      startCombat: (enemy) =>
        set({
          currentEnemy: enemy,
        }),

      updateEnemy: (enemy) =>
        set({
          currentEnemy: enemy,
        }),

      endCombat: () =>
        set({
          currentEnemy: null,
        }),

      addItem: (itemId, quantity = 1) =>
        set((state) => {
          const newItems = new Map(state.inventory.items);
          const currentQty = newItems.get(itemId) || 0;
          newItems.set(itemId, currentQty + quantity);
          return {
            inventory: {
              ...state.inventory,
              items: newItems,
            },
          };
        }),

      removeItem: (itemId, quantity = 1) =>
        set((state) => {
          const newItems = new Map(state.inventory.items);
          const currentQty = newItems.get(itemId) || 0;
          const newQty = Math.max(0, currentQty - quantity);
          if (newQty === 0) {
            newItems.delete(itemId);
          } else {
            newItems.set(itemId, newQty);
          }
          return {
            inventory: {
              ...state.inventory,
              items: newItems,
            },
          };
        }),

      equipItem: (itemId) =>
        set((state) => {
          const qty = state.inventory.items.get(itemId) ?? 0;
          if (qty <= 0 || state.inventory.equippedItems.includes(itemId)) {
            return state;
          }
          return {
            inventory: {
              ...state.inventory,
              equippedItems: [...state.inventory.equippedItems, itemId],
            },
          };
        }),

      unequipItem: (itemId) =>
        set((state) => ({
          inventory: {
            ...state.inventory,
            equippedItems: state.inventory.equippedItems.filter((id) => id !== itemId),
          },
        })),

      useConsumable: (itemId) => {
        const state = get();
        const item = ITEMS[itemId];
        const qty = state.inventory.items.get(itemId) ?? 0;
        const effective = selectEffectivePlayerStats(state);
        if (!item || item.type !== 'CONSUMABLE' || qty <= 0) {
          return false;
        }
        if (effective.hp >= effective.maxHp) {
          return false;
        }

        const healedEffective = useConsumableItem(effective, item);
        const hpGained = healedEffective.hp - effective.hp;
        const nextBaseHp = Math.min(effective.maxHp, state.player.hp + hpGained);

        const newItems = new Map(state.inventory.items);
        if (qty - 1 <= 0) {
          newItems.delete(itemId);
        } else {
          newItems.set(itemId, qty - 1);
        }

        set({
          player: {
            ...state.player,
            hp: nextBaseHp,
          },
          inventory: {
            ...state.inventory,
            items: newItems,
          },
        });
        return true;
      },

      addCoins: (amount) =>
        set((state) => ({
          coins: Math.max(0, state.coins + Math.round(amount)),
        })),

      spendCoins: (amount) => {
        const current = get().coins;
        if (amount <= 0 || current < amount) {
          return false;
        }
        set({ coins: current - amount });
        return true;
      },

      buyItem: (itemId) => {
        const item = ITEMS[itemId];
        if (!item) return false;
        const state = get();
        if (state.coins < item.price) return false;

        const newItems = new Map(state.inventory.items);
        newItems.set(itemId, (newItems.get(itemId) ?? 0) + 1);

        set({
          coins: state.coins - item.price,
          inventory: {
            ...state.inventory,
            items: newItems,
          },
        });
        return true;
      },

      setLoadout: (loadoutUpdate) =>
        set((state) => {
          const nextMode = loadoutUpdate.mode ?? state.loadout.mode;
          if (nextMode === 'BODYWEIGHT') {
            return {
              loadout: { mode: 'BODYWEIGHT', weightKg: 0 },
            };
          }
          const rawWeight = loadoutUpdate.weightKg ?? state.loadout.weightKg;
          const nextWeight = rawWeight > 0 ? rawWeight : 2;
          return {
            loadout: { mode: 'DUMBBELLS', weightKg: nextWeight },
          };
        }),

      unlockLevel: (levelId) =>
        set((state) => {
          if (state.unlockedLevels.includes(levelId)) {
            return state;
          }
          return {
            unlockedLevels: [...state.unlockedLevels, levelId],
          };
        }),

      completeLevel: (levelId) =>
        set((state) => {
          if (state.completedLevels.includes(levelId)) {
            return state;
          }
          return {
            completedLevels: [...state.completedLevels, levelId],
          };
        }),

      setCurrentLevel: (levelId) =>
        set({
          currentLevel: levelId,
        }),

      recordWorkoutProgress: (delta) =>
        set((state) => {
          const todayKey = delta.dateKey ?? getLocalDateKey();
          const repsDelta = delta.reps ?? 0;
          const holdDelta = delta.holdSeconds ?? 0;
          const winsDelta = delta.monstersDefeated ?? 0;
          const coinsDelta = delta.coinsEarned ?? 0;
          const kcalDelta = delta.estimatedKcal ?? 0;
          const tonnageDelta = delta.tonnageKg ?? 0;
          const circuitsDelta = delta.circuitsCompleted ?? 0;
          const tabataDelta = delta.tabataCompleted ?? 0;
          const durationDelta = delta.durationSec ?? 0;
          const parriesDelta = delta.parries ?? 0;

          const nextQuests = normalizeDailyQuests(state.dailyQuests, todayKey);
          const updatedDailyQuests: DailyQuestState = {
            ...nextQuests,
            repsToday: nextQuests.repsToday + repsDelta,
            holdSecondsToday: nextQuests.holdSecondsToday + holdDelta,
            winsToday: nextQuests.winsToday + winsDelta,
          };

          const existingDay = state.dailyHistory[todayKey] ?? {
            date: todayKey,
            reps: 0,
            holdSeconds: 0,
            battlesWon: 0,
            coinsEarned: 0,
            estimatedKcal: 0,
            tonnageKg: 0,
            circuitsCompleted: 0,
            durationSec: 0,
            exercises: {},
          };

          const nextDayExercises = { ...(existingDay.exercises ?? {}) };
          if (delta.exerciseId && (repsDelta > 0 || holdDelta > 0)) {
            const prevDayEx = nextDayExercises[delta.exerciseId] ?? { reps: 0, holdSeconds: 0 };
            nextDayExercises[delta.exerciseId] = {
              reps: prevDayEx.reps + repsDelta,
              holdSeconds: prevDayEx.holdSeconds + holdDelta,
            };
          }

          const updatedDay: DailyActivityEntry = {
            date: todayKey,
            reps: existingDay.reps + repsDelta,
            holdSeconds: existingDay.holdSeconds + holdDelta,
            battlesWon: existingDay.battlesWon + winsDelta,
            coinsEarned: existingDay.coinsEarned + coinsDelta,
            estimatedKcal: Math.round((existingDay.estimatedKcal + kcalDelta) * 10) / 10,
            tonnageKg: Math.round(((existingDay.tonnageKg ?? 0) + tonnageDelta) * 10) / 10,
            circuitsCompleted: (existingDay.circuitsCompleted ?? 0) + circuitsDelta,
            durationSec: (existingDay.durationSec ?? 0) + durationDelta,
            exercises: nextDayExercises,
          };

          const nextExerciseTotals = { ...state.exerciseTotals };
          if (delta.exerciseId && (repsDelta > 0 || holdDelta > 0)) {
            const currentEx = nextExerciseTotals[delta.exerciseId] ?? { reps: 0, holdSeconds: 0 };
            nextExerciseTotals[delta.exerciseId] = {
              reps: currentEx.reps + repsDelta,
              holdSeconds: currentEx.holdSeconds + holdDelta,
            };
          }

          const nextStreak =
            winsDelta > 0 || repsDelta > 0 || holdDelta > 0
              ? updateStreakForDate(state.streak, todayKey)
              : state.streak;

          const talentMods = getAggregatedTalentModifiers(state.talents);
          const nextGarden =
            winsDelta > 0
              ? applyWorkoutVictoryToGarden(state.garden, {
                  suppressWeedSpawn: delta.suppressWeedSpawn,
                  mutationBonusChance: talentMods.gardenMutationBonusChance,
                })
              : state.garden;

          return {
            coins: state.coins + coinsDelta,
            workoutStats: {
              totalReps: state.workoutStats.totalReps + repsDelta,
              totalHoldSeconds: state.workoutStats.totalHoldSeconds + holdDelta,
              monstersDefeated: state.workoutStats.monstersDefeated + winsDelta,
              maxCombo: Math.max(state.workoutStats.maxCombo ?? 0, delta.maxCombo ?? 0),
              totalTonnageKg:
                Math.round(((state.workoutStats.totalTonnageKg ?? 0) + tonnageDelta) * 10) / 10,
              circuitsCompleted: (state.workoutStats.circuitsCompleted ?? 0) + circuitsDelta,
              tabataCompleted: (state.workoutStats.tabataCompleted ?? 0) + tabataDelta,
              totalEstimatedKcal:
                Math.round(((state.workoutStats.totalEstimatedKcal ?? 0) + kcalDelta) * 10) / 10,
              totalDurationSec: (state.workoutStats.totalDurationSec ?? 0) + durationDelta,
              totalCoinsEarned: (state.workoutStats.totalCoinsEarned ?? 0) + coinsDelta,
              totalParries: (state.workoutStats.totalParries ?? 0) + parriesDelta,
            },
            exerciseTotals: nextExerciseTotals,
            dailyQuests: updatedDailyQuests,
            dailyHistory: pruneDailyHistory({
              ...state.dailyHistory,
              [todayKey]: updatedDay,
            }),
            streak: nextStreak,
            garden: nextGarden,
          };
        }),

      recordMonsterBestiary: ({ monsterId, defeated = false, victorySec, weaknessDiscovered = false }) =>
        set((state) => {
          const prev: BestiaryEntry = state.bestiary[monsterId] ?? {
            encounters: 0,
            defeats: 0,
            fastestVictorySec: null,
            weaknessDiscovered: false,
          };

          const nextBestTime =
            defeated && typeof victorySec === 'number'
              ? prev.fastestVictorySec === null
                ? victorySec
                : Math.min(prev.fastestVictorySec, victorySec)
              : prev.fastestVictorySec;

          return {
            bestiary: {
              ...state.bestiary,
              [monsterId]: {
                encounters: prev.encounters + (defeated ? 0 : 1),
                defeats: prev.defeats + (defeated ? 1 : 0),
                fastestVictorySec: nextBestTime,
                weaknessDiscovered: prev.weaknessDiscovered || weaknessDiscovered || defeated,
              },
            },
          };
        }),

      claimDailyQuest: (questId, dateKey = getLocalDateKey()) => {
        const state = get();
        const normalized = normalizeDailyQuests(state.dailyQuests, dateKey);
        if (normalized.claimedIds.includes(questId)) {
          return null;
        }
        const quest = getDailyQuestsForDate(dateKey).find((q) => q.id === questId);
        if (!quest) {
          return null;
        }
        if (getQuestProgress(quest, normalized) < quest.target) {
          return null;
        }

        let updatedPlayer = { ...state.player, xp: state.player.xp + quest.rewardXp };
        let leveledUp = false;
        while (updatedPlayer.xp >= updatedPlayer.xpToNextLevel) {
          updatedPlayer = levelUp(updatedPlayer);
          leveledUp = true;
        }

        set({
          coins: state.coins + quest.rewardCoins,
          player: updatedPlayer,
          dailyQuests: {
            ...normalized,
            claimedIds: [...normalized.claimedIds, questId],
          },
        });

        return {
          coins: quest.rewardCoins,
          xp: quest.rewardXp,
          leveledUp,
        };
      },

      updateEndlessProgress: (waveReached, wonWave) =>
        set((state) => ({
          endlessStats: {
            bestWave: Math.max(state.endlessStats.bestWave, waveReached),
            totalArenaWins: state.endlessStats.totalArenaWins + (wonWave ? 1 : 0),
          },
        })),

      syncAchievements: () => {
        const current = get();
        const newlyUnlocked = evaluateNewAchievements(current);
        if (newlyUnlocked.length > 0) {
          set({
            unlockedAchievements: [...current.unlockedAchievements, ...newlyUnlocked],
          });
        }
        return newlyUnlocked;
      },

      buySeed: (seedId) => {
        const seed = SEEDS[seedId];
        if (!seed) return false;
        const state = get();
        if (state.coins < seed.price) return false;

        set({
          coins: state.coins - seed.price,
          garden: {
            ...state.garden,
            seedInventory: {
              ...state.garden.seedInventory,
              [seedId]: (state.garden.seedInventory[seedId] ?? 0) + 1,
            },
          },
        });
        return true;
      },

      plantSeed: (plotId, seedId) => {
        const state = get();
        if (plotId < 0 || plotId >= state.garden.unlockedPlots) return false;
        const plot = state.garden.plots[plotId];
        const qty = state.garden.seedInventory[seedId] ?? 0;
        if (!plot || plot.seedId !== null || plot.weedId !== null || qty <= 0) {
          return false;
        }

        set({
          garden: {
            ...state.garden,
            seedInventory: {
              ...state.garden.seedInventory,
              [seedId]: qty - 1,
            },
            plots: state.garden.plots.map((p) =>
              p.id === plotId ? { ...p, seedId, growth: 0 } : p
            ),
          },
        });
        return true;
      },

      waterPlot: (plotId) => {
        const state = get();
        const nextGarden = waterSinglePlotInGarden(state.garden, plotId);
        if (!nextGarden) return false;
        set({ garden: nextGarden });
        return true;
      },

      waterAllPlots: () => {
        const state = get();
        const nextGarden = waterAllPlotsInGarden(state.garden);
        if (!nextGarden) return false;
        set({ garden: nextGarden });
        return true;
      },

      upgradeWateringCan: () => {
        const state = get();
        const nextTier = getNextWateringCanTier(state.garden.wateringCanTier);
        if (!nextTier) return false;
        const nextCan = WATERING_CANS[nextTier];
        if (state.coins < nextCan.upgradeCost) return false;

        set({
          coins: state.coins - nextCan.upgradeCost,
          garden: {
            ...state.garden,
            wateringCanTier: nextTier,
            waterCharges: nextCan.maxCharges,
          },
        });
        return true;
      },

      refillWateringCan: () => {
        const state = get();
        const maxCharges = WATERING_CANS[state.garden.wateringCanTier].maxCharges;
        if (state.garden.waterCharges >= maxCharges || state.coins < WATER_REFILL_COST) {
          return false;
        }
        set({
          coins: state.coins - WATER_REFILL_COST,
          garden: {
            ...state.garden,
            waterCharges: maxCharges,
          },
        });
        return true;
      },

      unlockGardenPlot: () => {
        const state = get();
        const cost = getNextPlotUnlockCost(state.garden.unlockedPlots);
        if (cost === null || state.coins < cost) return false;

        set({
          coins: state.coins - cost,
          garden: {
            ...state.garden,
            unlockedPlots: state.garden.unlockedPlots + 1,
          },
        });
        return true;
      },

      harvestPlot: (plotId) => {
        const state = get();
        if (plotId < 0 || plotId >= state.garden.unlockedPlots) return null;
        const plot = state.garden.plots[plotId];
        if (!plot || !plot.seedId || !isPlotReadyToHarvest(plot)) return null;

        const reward = computeHarvestReward(plot.seedId, Math.random, Boolean(plot.isMutant));

        let updatedPlayer = { ...state.player, xp: state.player.xp + reward.xp };
        let leveledUp = false;
        while (updatedPlayer.xp >= updatedPlayer.xpToNextLevel) {
          updatedPlayer = levelUp(updatedPlayer);
          leveledUp = true;
        }

        if (reward.healHp > 0) {
          const eff = selectEffectivePlayerStats({ ...state, player: updatedPlayer });
          const maxGain = Math.max(0, eff.maxHp - eff.hp);
          const actualHeal = Math.min(reward.healHp, maxGain);
          updatedPlayer = {
            ...updatedPlayer,
            hp: Math.min(updatedPlayer.maxHp, updatedPlayer.hp + actualHeal),
          };
        }

        const nextItems = new Map(state.inventory.items);
        if (reward.droppedItemId) {
          nextItems.set(
            reward.droppedItemId,
            (nextItems.get(reward.droppedItemId) ?? 0) + 1
          );
        }

        const prevCropQty = state.garden.cropInventory?.[reward.cropId] ?? 0;

        set({
          player: updatedPlayer,
          inventory: {
            ...state.inventory,
            items: nextItems,
          },
          garden: {
            ...state.garden,
            cropInventory: {
              ...state.garden.cropInventory,
              [reward.cropId]: prevCropQty + reward.cropQty,
            },
            totalHarvested: state.garden.totalHarvested + 1,
            plots: state.garden.plots.map((p) =>
              p.id === plotId ? { ...p, seedId: null, growth: 0, isMutant: false } : p
            ),
          },
        });

        get().syncAchievements();
        return {
          ...reward,
          leveledUp,
        };
      },

      clearPlotWeedWithCoins: (plotId) => {
        const state = get();
        if (plotId < 0 || plotId >= state.garden.unlockedPlots) return false;
        const plot = state.garden.plots[plotId];
        if (!plot || !plot.weedId || state.coins < QUICK_WEED_CLEAR_COST) return false;

        set({
          coins: state.coins - QUICK_WEED_CLEAR_COST,
          garden: {
            ...state.garden,
            weedsDefeated: state.garden.weedsDefeated + 1,
            plots: state.garden.plots.map((p) =>
              p.id === plotId ? { ...p, weedId: null } : p
            ),
          },
        });
        get().syncAchievements();
        return true;
      },

      defeatPlotWeed: (plotId) => {
        const state = get();
        if (plotId < 0 || plotId >= state.garden.unlockedPlots) return false;
        const plot = state.garden.plots[plotId];
        if (!plot || !plot.weedId) return false;

        const maxGrowth = plot.seedId ? SEEDS[plot.seedId].growthRequired : 0;

        set({
          garden: {
            ...state.garden,
            weedsDefeated: state.garden.weedsDefeated + 1,
            plots: state.garden.plots.map((p) =>
              p.id === plotId
                ? {
                    ...p,
                    weedId: null,
                    growth: p.seedId ? Math.min(maxGrowth, p.growth + 1) : 0,
                  }
                : p
            ),
          },
        });
        get().syncAchievements();
        return true;
      },

      triggerGardenWeed: (plotId) => {
        const state = get();
        const { garden, spawnedPlotId } = spawnWeedInGarden(state.garden, Math.random, plotId);
        if (spawnedPlotId === null) return null;
        set({ garden });
        return spawnedPlotId;
      },

      craftMix: (mixId) => {
        const blueprint = SANCTUARY_MIX_MAP[mixId];
        if (!blueprint) return false;
        const state = get();
        if (
          !isMixReadyToCraft(
            state.garden.cropInventory,
            blueprint,
            state.sanctuary.trophyInventory
          )
        ) {
          return false;
        }

        const nextCropInventory = { ...state.garden.cropInventory };
        for (const req of blueprint.ingredients) {
          nextCropInventory[req.seedId] = Math.max(
            0,
            (nextCropInventory[req.seedId] ?? 0) - req.qty
          );
        }

        const nextTrophyInventory = { ...state.sanctuary.trophyInventory };
        if (blueprint.trophyIngredients) {
          for (const req of blueprint.trophyIngredients) {
            nextTrophyInventory[req.trophyId] = Math.max(
              0,
              (nextTrophyInventory[req.trophyId] ?? 0) - req.qty
            );
          }
        }

        const talentMods = getAggregatedTalentModifiers(state.talents);
        const bonusQty =
          talentMods.sanctuaryCraftBonusChance > 0 && Math.random() < talentMods.sanctuaryCraftBonusChance
            ? 1
            : 0;

        set({
          garden: {
            ...state.garden,
            cropInventory: nextCropInventory,
          },
          sanctuary: {
            ...state.sanctuary,
            trophyInventory: nextTrophyInventory,
            mixInventory: {
              ...state.sanctuary.mixInventory,
              [mixId]: (state.sanctuary.mixInventory[mixId] ?? 0) + 1 + bonusQty,
            },
            totalCrafted: state.sanctuary.totalCrafted + 1,
          },
        });
        get().syncAchievements();
        return true;
      },

      activateMixBuff: (mixId) => {
        const blueprint = SANCTUARY_MIX_MAP[mixId];
        if (!blueprint) return null;
        const state = get();
        const qty = state.sanctuary.mixInventory[mixId] ?? 0;
        const maxSlots = SANCTUARY_LAB_TIERS[state.sanctuary.labTier].maxBuffSlots;
        if (
          qty <= 0 ||
          state.sanctuary.activeBuffs.includes(mixId) ||
          state.sanctuary.activeBuffs.length >= maxSlots
        ) {
          return null;
        }

        const healPotential = getMixEffectiveHeal(blueprint, state.sanctuary.labTier);
        const alreadyHealed = state.sanctuary.healedBuffIds?.includes(mixId) ?? false;
        let nextBasePlayer = state.player;
        let healedHp = 0;

        if (healPotential > 0 && !alreadyHealed) {
          const effBefore = getEffectivePlayerStats(
            state.player,
            state.inventory.equippedItems,
            ITEMS,
            state.sanctuary.activeBuffs,
            state.sanctuary.labTier
          );
          const missing = Math.max(0, effBefore.maxHp - effBefore.hp);
          healedHp = Math.min(healPotential, missing);
          if (healedHp > 0) {
            nextBasePlayer = {
              ...state.player,
              hp: Math.min(state.player.maxHp, state.player.hp + healedHp),
            };
          }
        }

        const prevSynergies = getActiveSanctuarySynergies(state.sanctuary.activeBuffs);
        const nextActiveBuffs = [...state.sanctuary.activeBuffs, mixId];
        const nextSynergies = getActiveSanctuarySynergies(nextActiveBuffs);
        const newSynergiesCount = nextSynergies.filter((id) => !prevSynergies.includes(id)).length;
        const nextHealedBuffIds =
          healPotential > 0 && !alreadyHealed
            ? [...(state.sanctuary.healedBuffIds ?? []), mixId]
            : [...(state.sanctuary.healedBuffIds ?? [])];

        set({
          player: nextBasePlayer,
          sanctuary: {
            ...state.sanctuary,
            mixInventory: {
              ...state.sanctuary.mixInventory,
              [mixId]: qty - 1,
            },
            activeBuffs: nextActiveBuffs,
            healedBuffIds: nextHealedBuffIds,
            totalSynergiesActivated:
              (state.sanctuary.totalSynergiesActivated ?? 0) + newSynergiesCount,
          },
        });

        get().syncAchievements();
        return { healedHp };
      },

      deactivateMixBuff: (mixId) => {
        const state = get();
        if (!state.sanctuary.activeBuffs.includes(mixId)) {
          return false;
        }

        set({
          sanctuary: {
            ...state.sanctuary,
            mixInventory: {
              ...state.sanctuary.mixInventory,
              [mixId]: (state.sanctuary.mixInventory[mixId] ?? 0) + 1,
            },
            activeBuffs: state.sanctuary.activeBuffs.filter((id) => id !== mixId),
          },
        });

        return true;
      },

      addMonsterTrophy: (trophyId, qty = 1) => {
        if (qty <= 0) return;
        set((state) => ({
          sanctuary: {
            ...state.sanctuary,
            trophyInventory: {
              ...state.sanctuary.trophyInventory,
              [trophyId]: (state.sanctuary.trophyInventory?.[trophyId] ?? 0) + Math.floor(qty),
            },
          },
        }));
      },

      upgradeSanctuaryLab: () => {
        const state = get();
        const nextTier = getNextSanctuaryLabTier(state.sanctuary.labTier);
        if (!nextTier) return false;
        const cost = SANCTUARY_LAB_TIERS[nextTier].upgradeCost;
        if (state.coins < cost) return false;

        set({
          coins: state.coins - cost,
          sanctuary: {
            ...state.sanctuary,
            labTier: nextTier,
          },
        });
        return true;
      },

      consumeActiveSanctuaryBuffs: () =>
        set((state) => {
          if (
            state.sanctuary.activeBuffs.length === 0 &&
            (state.sanctuary.healedBuffIds?.length ?? 0) === 0
          ) {
            return state;
          }
          return {
            sanctuary: {
              ...state.sanctuary,
              activeBuffs: [],
              healedBuffIds: [],
            },
          };
        }),

      upgradeTalent: (talentId) => {
        const state = get();
        if (!canUpgradeTalent(state.player.level, state.talents, talentId)) {
          return false;
        }
        const nextRank = (state.talents.ranks[talentId] ?? 0) + 1;
        set({
          talents: {
            ranks: {
              ...state.talents.ranks,
              [talentId]: nextRank,
            },
            spentPoints: state.talents.spentPoints + 1,
          },
        });
        get().syncAchievements();
        return true;
      },

      respecTalents: () => {
        const state = get();
        if (state.talents.spentPoints <= 0 || state.coins < TALENT_RESPEC_COST) {
          return false;
        }
        set({
          coins: state.coins - TALENT_RESPEC_COST,
          talents: createInitialTalentState(),
        });
        return true;
      },

      unlockArtifact: (artifactId) => {
        const state = get();
        if (state.artifacts.unlockedIds.includes(artifactId)) {
          return false;
        }
        set({
          artifacts: {
            ...state.artifacts,
            unlockedIds: [...state.artifacts.unlockedIds, artifactId],
          },
        });
        get().syncAchievements();
        return true;
      },

      equipArtifact: (artifactId) => {
        const state = get();
        if (
          !state.artifacts.unlockedIds.includes(artifactId) ||
          state.artifacts.equippedIds.includes(artifactId) ||
          state.artifacts.equippedIds.length >= MAX_EQUIPPED_ARTIFACTS
        ) {
          return false;
        }
        set({
          artifacts: {
            ...state.artifacts,
            equippedIds: [...state.artifacts.equippedIds, artifactId],
          },
        });
        return true;
      },

      unequipArtifact: (artifactId) => {
        const state = get();
        if (!state.artifacts.equippedIds.includes(artifactId)) {
          return false;
        }
        set({
          artifacts: {
            ...state.artifacts,
            equippedIds: state.artifacts.equippedIds.filter((id) => id !== artifactId),
          },
        });
        return true;
      },

      startProgram: (programId, dateKey = getLocalDateKey()) => {
        if (!(programId in PROGRAM_MAP)) return;
        set((state) => ({
          programs: {
            ...state.programs,
            active: {
              programId,
              currentDayIndex: 0,
              completedDays: [],
              startedAtDate: dateKey,
            },
          },
        }));
      },

      advanceProgramDay: (dayIndex) => {
        const state = get();
        const active = state.programs.active;
        if (!active) return null;
        const def = PROGRAM_MAP[active.programId];
        if (!def) return null;

        const targetIndex =
          typeof dayIndex === 'number' ? dayIndex : active.currentDayIndex;
        if (targetIndex < 0 || targetIndex >= def.durationDays) return null;
        if (active.completedDays.includes(targetIndex)) return null;

        const dayPlan = def.days[targetIndex];
        const nextCompletedDays = [...active.completedDays, targetIndex];
        const completedProgram = nextCompletedDays.length >= def.durationDays;

        const bonusCoins = dayPlan.bonusCoins + (completedProgram ? def.completionCoins : 0);
        const bonusXp = dayPlan.bonusXp + (completedProgram ? def.completionXp : 0);

        let updatedPlayer = { ...state.player, xp: state.player.xp + bonusXp };
        let leveledUp = false;
        while (updatedPlayer.xp >= updatedPlayer.xpToNextLevel) {
          updatedPlayer = levelUp(updatedPlayer);
          leveledUp = true;
        }

        const nextCompletedPrograms =
          completedProgram && !state.programs.completedProgramIds.includes(active.programId)
            ? [...state.programs.completedProgramIds, active.programId]
            : state.programs.completedProgramIds;

        set({
          coins: state.coins + bonusCoins,
          player: updatedPlayer,
          programs: {
            active: completedProgram
              ? null
              : {
                  ...active,
                  currentDayIndex: Math.min(def.durationDays - 1, targetIndex + 1),
                  completedDays: nextCompletedDays,
                },
            completedProgramIds: nextCompletedPrograms,
            totalProgramsFinished:
              state.programs.totalProgramsFinished + (completedProgram ? 1 : 0),
          },
        });

        get().syncAchievements();
        return {
          completedProgram,
          bonusCoins,
          bonusXp,
          leveledUp,
        };
      },

      abandonProgram: () =>
        set((state) => ({
          programs: {
            ...state.programs,
            active: null,
          },
        })),

      toggleMutator: (mutatorId) =>
        set((state) => {
          if (!(mutatorId in MUTATORS)) return state;
          const exists = state.activeMutators.includes(mutatorId);
          if (exists) {
            return {
              activeMutators: state.activeMutators.filter((id) => id !== mutatorId),
            };
          }
          if (state.activeMutators.length >= MAX_ACTIVE_MUTATORS) {
            return state;
          }
          return {
            activeMutators: [...state.activeMutators, mutatorId],
          };
        }),

      clearMutators: () => set({ activeMutators: [] }),

      completeWeeklyChallenge: (weekKey = getISOWeekKey(), rank = 'B') => {
        const state = get();
        const spec = getWeeklyChallengeForWeek(weekKey);
        const alreadyDone = state.weeklyChallenge.completedWeekKeys.includes(weekKey);
        const bonusCoins = alreadyDone ? 40 : spec.bonusCoins;
        const bonusXp = alreadyDone ? 35 : spec.bonusXp;

        let updatedPlayer = { ...state.player, xp: state.player.xp + bonusXp };
        let leveledUp = false;
        while (updatedPlayer.xp >= updatedPlayer.xpToNextLevel) {
          updatedPlayer = levelUp(updatedPlayer);
          leveledUp = true;
        }

        const nextWeekKeys = alreadyDone
          ? state.weeklyChallenge.completedWeekKeys
          : [...state.weeklyChallenge.completedWeekKeys, weekKey];

        set({
          coins: state.coins + bonusCoins,
          player: updatedPlayer,
          weeklyChallenge: {
            completedWeekKeys: nextWeekKeys,
            bestRankByWeek: {
              ...state.weeklyChallenge.bestRankByWeek,
              [weekKey]: pickBetterRank(state.weeklyChallenge.bestRankByWeek[weekKey], rank),
            },
            totalCompleted: alreadyDone
              ? state.weeklyChallenge.totalCompleted
              : state.weeklyChallenge.totalCompleted + 1,
          },
        });

        let unlockedArtifactId: ArtifactId | null = null;
        if (!alreadyDone && get().unlockArtifact('VAMPIRIC_FANG')) {
          unlockedArtifactId = 'VAMPIRIC_FANG';
        }
        get().syncAchievements();

        return {
          firstCompletion: !alreadyDone,
          bonusCoins,
          bonusXp,
          unlockedArtifactId,
          leveledUp,
        };
      },

      recordPersonalRecords: ({
        exerciseId,
        battleReps,
        holdSec,
        maxCombo,
        weightKg,
        bestHitDamage,
      }) => {
        const state = get();
        const prev = state.personalRecords[exerciseId] ?? createEmptyExercisePR();
        const broken: string[] = [];

        const nextReps = Math.max(prev.bestBattleReps, Math.floor(battleReps));
        if (battleReps > prev.bestBattleReps && battleReps > 0) broken.push('REPS');

        const nextHold = Math.max(prev.bestHoldSec, Math.floor(holdSec));
        if (holdSec > prev.bestHoldSec && holdSec > 0) broken.push('HOLD');

        const nextCombo = Math.max(prev.bestCombo, Math.floor(maxCombo));
        if (maxCombo > prev.bestCombo && maxCombo > 0) broken.push('COMBO');

        const nextWeight = Math.max(prev.maxWeightKg, weightKg);
        if (weightKg > prev.maxWeightKg && weightKg > 0) broken.push('WEIGHT');

        const nextHit = Math.max(prev.bestHitDamage, Math.floor(bestHitDamage));
        if (bestHitDamage > prev.bestHitDamage && bestHitDamage > 0) broken.push('HIT');

        set({
          bestSingleHitDamage: Math.max(state.bestSingleHitDamage, Math.floor(bestHitDamage)),
          personalRecords: {
            ...state.personalRecords,
            [exerciseId]: {
              bestBattleReps: nextReps,
              bestHoldSec: nextHold,
              bestCombo: nextCombo,
              maxWeightKg: nextWeight,
              bestHitDamage: nextHit,
            },
          },
        });

        return broken;
      },

      saveSanctuaryPreset: (slotIndex, name) => {
        if (slotIndex < 0 || slotIndex >= MAX_SANCTUARY_PRESETS) return false;
        const state = get();
        const currentPresets = [...(state.sanctuary.presets ?? [])];
        while (currentPresets.length <= slotIndex) {
          currentPresets.push({
            id: `preset-${currentPresets.length + 1}`,
            name: `Loadout ${currentPresets.length + 1}`,
            buffs: [],
          });
        }
        currentPresets[slotIndex] = {
          id: `preset-${slotIndex + 1}`,
          name: name?.trim() || currentPresets[slotIndex].name || `Loadout ${slotIndex + 1}`,
          buffs: [...state.sanctuary.activeBuffs],
        };
        set({
          sanctuary: {
            ...state.sanctuary,
            presets: currentPresets,
          },
        });
        return true;
      },

      applySanctuaryPreset: (slotIndex) => {
        const state = get();
        const preset = state.sanctuary.presets?.[slotIndex];
        if (!preset || preset.buffs.length === 0) return false;

        // First deactivate current buffs cleanly back to mixInventory
        const activeCopy = [...state.sanctuary.activeBuffs];
        for (const id of activeCopy) {
          get().deactivateMixBuff(id);
        }

        let appliedAny = false;
        const maxSlots = SANCTUARY_LAB_TIERS[get().sanctuary.labTier].maxBuffSlots;
        for (const mixId of preset.buffs.slice(0, maxSlots)) {
          if (get().activateMixBuff(mixId)) {
            appliedAny = true;
          }
        }
        return appliedAny;
      },

      ensureDailyAlchemyOrder: (dateKey = getLocalDateKey()) => {
        const state = get();
        const existing = state.sanctuary.alchemyOrder;
        if (existing && existing.dateKey === dateKey) {
          return existing;
        }
        const generated = generateDailyAlchemyOrder(
          dateKey,
          state.sanctuary.completedOrdersCount ?? 0
        );
        set({
          sanctuary: {
            ...state.sanctuary,
            alchemyOrder: generated,
          },
        });
        return generated;
      },

      completeAlchemyOrder: (dateKey = getLocalDateKey()) => {
        const order = get().ensureDailyAlchemyOrder(dateKey);
        if (order.completed) return null;

        const state = get();
        // Verify ingredients
        for (const req of order.requirements) {
          if (req.seedId && (state.garden.cropInventory[req.seedId] ?? 0) < req.qty) {
            return null;
          }
          if (req.trophyId && (state.sanctuary.trophyInventory[req.trophyId] ?? 0) < req.qty) {
            return null;
          }
          if (req.mixId && (state.sanctuary.mixInventory[req.mixId] ?? 0) < req.qty) {
            return null;
          }
        }

        const nextCrops = { ...state.garden.cropInventory };
        const nextTrophies = { ...state.sanctuary.trophyInventory };
        const nextMixes = { ...state.sanctuary.mixInventory };

        for (const req of order.requirements) {
          if (req.seedId) {
            nextCrops[req.seedId] = Math.max(0, (nextCrops[req.seedId] ?? 0) - req.qty);
          }
          if (req.trophyId) {
            nextTrophies[req.trophyId] = Math.max(0, (nextTrophies[req.trophyId] ?? 0) - req.qty);
          }
          if (req.mixId) {
            nextMixes[req.mixId] = Math.max(0, (nextMixes[req.mixId] ?? 0) - req.qty);
          }
        }

        let updatedPlayer = { ...state.player, xp: state.player.xp + order.rewardXp };
        let leveledUp = false;
        while (updatedPlayer.xp >= updatedPlayer.xpToNextLevel) {
          updatedPlayer = levelUp(updatedPlayer);
          leveledUp = true;
        }

        set({
          coins: state.coins + order.rewardCoins,
          player: updatedPlayer,
          garden: {
            ...state.garden,
            cropInventory: nextCrops,
          },
          sanctuary: {
            ...state.sanctuary,
            trophyInventory: nextTrophies,
            mixInventory: nextMixes,
            alchemyOrder: { ...order, completed: true },
            completedOrdersCount: (state.sanctuary.completedOrdersCount ?? 0) + 1,
          },
        });

        get().syncAchievements();
        return {
          rewardCoins: order.rewardCoins,
          rewardXp: order.rewardXp,
          leveledUp,
        };
      },

      saveCustomCircuit: (name, rooms, dateKey = getLocalDateKey()) => {
        if (rooms.length < MIN_CUSTOM_CIRCUIT_ROOMS) return null;
        const state = get();
        if (state.customCircuits.length >= MAX_CUSTOM_CIRCUITS) return null;
        const id = `custom-${Date.now()}-${state.customCircuits.length + 1}`;
        const normalized = normalizeCustomCircuits([
          ...state.customCircuits,
          {
            id,
            name: name.trim() || `Custom #${state.customCircuits.length + 1}`,
            rooms,
            createdAtDate: dateKey,
          },
        ]);
        const created = normalized[normalized.length - 1] ?? null;
        if (!created) return null;
        set({ customCircuits: normalized });
        get().syncAchievements();
        return created;
      },

      deleteCustomCircuit: (circuitId) =>
        set((state) => ({
          customCircuits: state.customCircuits.filter((c) => c.id !== circuitId),
        })),

      recordBenchmarkResult: ({
        exerciseId,
        score,
        avgCadenceRpm,
        dateKey = getLocalDateKey(),
      }) => {
        const state = get();
        const cleanScore = Math.max(0, Math.floor(score));
        const rating = computeBenchmarkRating(exerciseId, cleanScore);
        const entry: BenchmarkEntry = {
          id: `bm-${dateKey}-${state.benchmarks.length + 1}`,
          dateKey,
          exerciseId,
          score: cleanScore,
          avgCadenceRpm: Math.round(avgCadenceRpm * 10) / 10,
          rating,
        };
        const prevBest = state.bestBenchmarkByExercise[exerciseId] ?? 0;
        const isNewBest = cleanScore > prevBest && cleanScore > 0;
        const nextBestMap = isNewBest
          ? { ...state.bestBenchmarkByExercise, [exerciseId]: cleanScore }
          : state.bestBenchmarkByExercise;

        set({
          benchmarks: [...state.benchmarks, entry].slice(-100),
          bestBenchmarkByExercise: nextBestMap,
        });
        get().syncAchievements();
        return { entry, isNewBest };
      },

      recordStageMastery: (levelId, earned) => {
        const state = get();
        const prev = state.stageMastery[levelId] ?? {};
        const badges: StageMasteryBadge[] = ['rankS', 'parryAce', 'tactician'];
        const newlyEarnedBadges: StageMasteryBadge[] = [];

        for (const badge of badges) {
          if (earned[badge] && !prev[badge]) {
            newlyEarnedBadges.push(badge);
          }
        }

        const nextRecord: StageMasteryRecord = {
          rankS: Boolean(prev.rankS || earned.rankS),
          parryAce: Boolean(prev.parryAce || earned.parryAce),
          tactician: Boolean(prev.tactician || earned.tactician),
        };

        const bonusCoins = newlyEarnedBadges.length * 35;
        const bonusXp = 0;

        set({
          coins: state.coins + bonusCoins,
          stageMastery: {
            ...state.stageMastery,
            [levelId]: nextRecord,
          },
        });
        get().syncAchievements();

        return {
          newlyEarnedBadges,
          bonusCoins,
          bonusXp,
          leveledUp: false,
        };
      },

      updateSettings: (settingsUpdate) =>
        set((state) => ({
          settings: { ...state.settings, ...settingsUpdate },
        })),

      updateExerciseCalibration: (calibrationUpdate) =>
        set((state) => ({
          settings: {
            ...state.settings,
            exerciseCalibration: {
              ...state.settings.exerciseCalibration,
              ...calibrationUpdate,
            },
          },
        })),

      resetExerciseCalibration: () =>
        set((state) => ({
          settings: {
            ...state.settings,
            exerciseCalibration: { ...DEFAULT_EXERCISE_CALIBRATION },
          },
        })),

      setLanguage: (language) =>
        set((state) => {
          setCurrentLanguage(language);
          return {
            settings: { ...state.settings, language },
          };
        }),

      importGameState: (nextState) => {
        const normalized = migrateGameState(nextState, SAVE_SCHEMA_VERSION);
        setCurrentLanguage(normalized.settings.language);
        set(normalized);
      },

      resetGame: () => {
        const fresh = createInitialState();
        setCurrentLanguage(fresh.settings.language);
        set(fresh);
      },
    }),
    {
      name: 'junk-slayer-game-state',
      version: SAVE_SCHEMA_VERSION,
      migrate: migrateGameState,
      storage: customStorage,
      onRehydrateStorage: () => (state) => {
        if (state?.settings?.language) {
          setCurrentLanguage(state.settings.language);
        }
      },
    }
  )
);

export function selectEffectivePlayerStats(state: GameState): PlayerStats {
  return getEffectivePlayerStats(
    state.player,
    state.inventory.equippedItems,
    ITEMS,
    state.sanctuary?.activeBuffs ?? [],
    state.sanctuary?.labTier ?? 1,
    getAggregatedTalentModifiers(state.talents),
    state.artifacts?.equippedIds ?? []
  );
}
