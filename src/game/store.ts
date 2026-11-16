/**
 * Zustand store for game state with persistence.
 * Handles player stats, inventory, achievements, calibration, workout stats, settings.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  GameState,
  PlayerStats,
  MonsterStats,
  Inventory,
  WorkoutStats,
  ExerciseCalibrationSettings,
} from './types';
import { createPlayer, getEffectivePlayerStats, useConsumableItem } from './CombatEngine';
import { ITEMS } from './data/items';
import { evaluateNewAchievements } from './data/achievements';
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
  };
}

function createInitialState(): GameState {
  return {
    player: createPlayer(),
    inventory: createInitialInventory(),
    currentLevel: null,
    unlockedLevels: ['LEVEL_1'],
    completedLevels: [],
    unlockedAchievements: [],
    currentEnemy: null,
    workoutStats: createInitialWorkoutStats(),
    settings: {
      soundEnabled: true,
      voiceEnabled: false,
      cameraFacingMode: 'user',
      exerciseConfigs: {},
      exerciseCalibration: { ...DEFAULT_EXERCISE_CALIBRATION },
      language: 'ru',
    },
  };
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

  unlockLevel: (levelId: string) => void;
  completeLevel: (levelId: string) => void;
  setCurrentLevel: (levelId: string | null) => void;

  recordWorkoutProgress: (delta: {
    reps?: number;
    holdSeconds?: number;
    monstersDefeated?: number;
  }) => void;
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
  if (version === 0 || version === 1 || version === 2 || version === 3) {
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
      settings: {
        ...base.settings,
        ...(state.settings ?? {}),
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
        if (!item || item.type !== 'CONSUMABLE' || qty <= 0) {
          return false;
        }
        if (state.player.hp >= state.player.maxHp) {
          return false;
        }

        const updatedPlayer = useConsumableItem(state.player, item);
        const newItems = new Map(state.inventory.items);
        if (qty - 1 <= 0) {
          newItems.delete(itemId);
        } else {
          newItems.set(itemId, qty - 1);
        }

        set({
          player: updatedPlayer,
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
        set((state) => ({
          workoutStats: {
            totalReps: state.workoutStats.totalReps + (delta.reps ?? 0),
            totalHoldSeconds: state.workoutStats.totalHoldSeconds + (delta.holdSeconds ?? 0),
            monstersDefeated: state.workoutStats.monstersDefeated + (delta.monstersDefeated ?? 0),
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
      version: 3,
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
