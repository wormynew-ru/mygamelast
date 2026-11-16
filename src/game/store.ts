/**
 * Zustand store for game state with persistence (v4).
 * Handles player stats, inventory, coins, shop, daily quests, streaks,
 * 7/30-day activity history, monster bestiary, endless arena, calibration, and settings.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  BestiaryEntry,
  DailyActivityEntry,
  DailyQuestState,
  EndlessArenaStats,
  ExerciseCalibrationSettings,
  ExerciseTotals,
  GameState,
  Inventory,
  MonsterStats,
  PlayerStats,
  StreakState,
  WorkoutStats,
} from './types';
import { createPlayer, getEffectivePlayerStats, levelUp, useConsumableItem } from './CombatEngine';
import { ITEMS } from './data/items';
import { evaluateNewAchievements } from './data/achievements';
import { type ExerciseId } from './data/exercises';
import {
  getDailyQuestsForDate,
  getLocalDateKey,
  getQuestProgress,
  updateStreakForDate,
} from './data/dailyQuests';
import { setCurrentLanguage, type Language } from '../i18n';

export const DEFAULT_EXERCISE_CALIBRATION: ExerciseCalibrationSettings = {
  squatBottomAngle: 90,
  pushupBottomAngle: 90,
  plankMinBodyAngle: 160,
  jumpingJackPeakArmAngle: 135,
};

function createInitialInventory(): Inventory {
  return {
    items: new Map(),
    equippedItems: [],
  };
}

function createInitialWorkoutStats(): WorkoutStats {
  return {
    totalReps: 0,
    totalHoldSeconds: 0,
    monstersDefeated: 0,
    maxCombo: 0,
  };
}

function createInitialExerciseTotals(): Record<ExerciseId, ExerciseTotals> {
  return {
    SQUAT: { reps: 0, holdSeconds: 0 },
    PUSH_UP: { reps: 0, holdSeconds: 0 },
    PLANK: { reps: 0, holdSeconds: 0 },
    JUMPING_JACK: { reps: 0, holdSeconds: 0 },
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
    settings: {
      soundEnabled: true,
      voiceEnabled: false,
      cameraFacingMode: 'user',
      targetPoseFps: 60,
      exerciseConfigs: {},
      exerciseCalibration: { ...DEFAULT_EXERCISE_CALIBRATION },
      language: 'ru',
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
  maxDays: number = 30
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
    dateKey?: string;
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

  updateSettings: (settings: Partial<GameState['settings']>) => void;
  updateExerciseCalibration: (calibration: Partial<ExerciseCalibrationSettings>) => void;
  resetExerciseCalibration: () => void;
  setLanguage: (language: Language) => void;

  resetGame: () => void;
}

interface SerializedMap {
  __type: 'Map';
  entries: [string, number][];
}

function isSerializedMap(value: unknown): value is SerializedMap {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<SerializedMap>).__type === 'Map' &&
    Array.isArray((value as Partial<SerializedMap>).entries)
  );
}

function migrateGameState(persistedState: unknown, version: number): GameState {
  if (version >= 0 && version <= 5) {
    const state = (persistedState ?? {}) as Partial<GameState>;

    let itemsMap = new Map<string, number>();
    if (state.inventory?.items) {
      const items = state.inventory.items as unknown;
      if (items instanceof Map) {
        itemsMap = items;
      } else if (isSerializedMap(items)) {
        itemsMap = new Map(items.entries);
      } else if (typeof items === 'object' && items !== null) {
        itemsMap = new Map(
          Object.entries(items as Record<string, number>).filter(
            ([, qty]) => typeof qty === 'number'
          )
        );
      }
    }

    const base = createInitialState();

    return {
      ...base,
      ...state,
      coins: typeof state.coins === 'number' ? state.coins : 0,
      player: {
        ...base.player,
        ...(state.player ?? {}),
      },
      inventory: {
        items: itemsMap,
        equippedItems: state.inventory?.equippedItems || [],
      },
      unlockedAchievements: state.unlockedAchievements || [],
      workoutStats: {
        ...base.workoutStats,
        ...(state.workoutStats ?? {}),
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
      settings: {
        ...base.settings,
        ...(state.settings ?? {}),
        targetPoseFps: state.settings?.targetPoseFps === 30 ? 30 : 60,
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
      } satisfies SerializedMap;
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
        const effective = getEffectivePlayerStats(
          state.player,
          state.inventory.equippedItems,
          ITEMS
        );
        if (!item || item.type !== 'CONSUMABLE' || qty <= 0) {
          return false;
        }
        if (effective.hp >= effective.maxHp) {
          return false;
        }

        const healedEffective = useConsumableItem(effective, item);
        const hpGained = healedEffective.hp - effective.hp;
        const nextBaseHp = Math.min(state.player.maxHp, state.player.hp + hpGained);

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
          };

          const updatedDay: DailyActivityEntry = {
            date: todayKey,
            reps: existingDay.reps + repsDelta,
            holdSeconds: existingDay.holdSeconds + holdDelta,
            battlesWon: existingDay.battlesWon + winsDelta,
            coinsEarned: existingDay.coinsEarned + coinsDelta,
            estimatedKcal: Math.round((existingDay.estimatedKcal + kcalDelta) * 10) / 10,
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

          return {
            coins: state.coins + coinsDelta,
            workoutStats: {
              totalReps: state.workoutStats.totalReps + repsDelta,
              totalHoldSeconds: state.workoutStats.totalHoldSeconds + holdDelta,
              monstersDefeated: state.workoutStats.monstersDefeated + winsDelta,
              maxCombo: Math.max(state.workoutStats.maxCombo ?? 0, delta.maxCombo ?? 0),
            },
            exerciseTotals: nextExerciseTotals,
            dailyQuests: updatedDailyQuests,
            dailyHistory: pruneDailyHistory({
              ...state.dailyHistory,
              [todayKey]: updatedDay,
            }),
            streak: nextStreak,
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

      resetGame: () => {
        const fresh = createInitialState();
        setCurrentLanguage(fresh.settings.language);
        set(fresh);
      },
    }),
    {
      name: 'junk-slayer-game-state',
      version: 5,
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
  return getEffectivePlayerStats(state.player, state.inventory.equippedItems, ITEMS);
}
