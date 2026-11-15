/**
 * Zustand store for game state with persistence.
 * Handles player stats, inventory, combat state, settings.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GameState, PlayerStats, MonsterStats, Inventory } from './types';
import { createPlayer } from './CombatEngine';
import { setCurrentLanguage, type Language } from '../i18n';

/**
 * Initial inventory state.
 */
function createInitialInventory(): Inventory {
  return {
    items: new Map(),
    equippedItems: [],
  };
}

/**
 * Initial game state.
 */
function createInitialState(): GameState {
  return {
    player: createPlayer(),
    inventory: createInitialInventory(),
    currentLevel: null,
    unlockedLevels: ['LEVEL_1'], // First level unlocked by default
    completedLevels: [],
    currentEnemy: null,
    settings: {
      soundEnabled: true,
      voiceEnabled: false,
      cameraFacingMode: 'user',
      exerciseConfigs: {},
      language: 'ru', // Default: Russian
    },
  };
}

/**
 * Game store interface with actions.
 */
interface GameStore extends GameState {
  // Player actions
  updatePlayer: (player: Partial<PlayerStats>) => void;
  resetPlayer: () => void;

  // Combat actions
  startCombat: (enemy: MonsterStats) => void;
  updateEnemy: (enemy: MonsterStats) => void;
  endCombat: () => void;

  // Inventory actions
  addItem: (itemId: string, quantity?: number) => void;
  removeItem: (itemId: string, quantity?: number) => void;
  equipItem: (itemId: string) => void;
  unequipItem: (itemId: string) => void;

  // Level progression actions
  unlockLevel: (levelId: string) => void;
  completeLevel: (levelId: string) => void;
  setCurrentLevel: (levelId: string | null) => void;

  // Settings actions
  updateSettings: (settings: Partial<GameState['settings']>) => void;
  setLanguage: (language: Language) => void;

  // Reset everything
  resetGame: () => void;
}

/**
 * Migration function for save format upgrades.
 * Called when persisted version doesn't match current version.
 */
function migrateGameState(persistedState: unknown, version: number): GameState {
  // Version 1: initial version, no migration needed
  if (version === 0 || version === 1) {
    // Ensure all required fields exist
    const state = persistedState as Partial<GameState>;

    // Convert items from object/array to Map if needed
    let itemsMap = new Map<string, number>();
    if (state.inventory?.items) {
      const items = state.inventory.items as unknown;
      if (items instanceof Map) {
        itemsMap = items;
      } else if (typeof items === 'object' && items !== null) {
        itemsMap = new Map(Object.entries(items as Record<string, number>));
      }
    }

    return {
      ...createInitialState(),
      ...state,
      inventory: {
        items: itemsMap,
        equippedItems: state.inventory?.equippedItems || [],
      },
    };
  }

  // Future versions: add migration logic here
  // Example:
  // if (version === 2) {
  //   return migrateV2toV3(persistedState);
  // }

  // Fallback: reset to default if version is unknown
  console.warn(`Unknown save version ${version}, resetting game state`);
  return createInitialState();
}

/**
 * Custom storage to handle Map serialization.
 */
const customStorage = {
  getItem: (name: string): string | null => {
    const str = localStorage.getItem(name);
    if (!str) return null;
    return str;
  },
  setItem: (name: string, value: string): void => {
    localStorage.setItem(name, value);
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  },
};

/**
 * Zustand store with persistence middleware.
 */
export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      // Initial state
      ...createInitialState(),

      // Player actions
      updatePlayer: (playerUpdate) =>
        set((state) => ({
          player: { ...state.player, ...playerUpdate },
        })),

      resetPlayer: () =>
        set(() => ({
          player: createPlayer(),
          inventory: createInitialInventory(),
        })),

      // Combat actions
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

      // Inventory actions
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
          if (state.inventory.equippedItems.includes(itemId)) {
            return state; // Already equipped
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

      // Level progression actions
      unlockLevel: (levelId) =>
        set((state) => {
          if (state.unlockedLevels.includes(levelId)) {
            return state; // Already unlocked
          }
          return {
            unlockedLevels: [...state.unlockedLevels, levelId],
          };
        }),

      completeLevel: (levelId) =>
        set((state) => {
          if (state.completedLevels.includes(levelId)) {
            return state; // Already completed
          }
          return {
            completedLevels: [...state.completedLevels, levelId],
          };
        }),

      setCurrentLevel: (levelId) =>
        set({
          currentLevel: levelId,
        }),

      // Settings actions
      updateSettings: (settingsUpdate) =>
        set((state) => ({
          settings: { ...state.settings, ...settingsUpdate },
        })),

      setLanguage: (language) =>
        set((state) => {
          // Update i18n system immediately
          setCurrentLanguage(language);
          return {
            settings: { ...state.settings, language },
          };
        }),

      // Reset everything
      resetGame: () =>
        set(createInitialState()),
    }),
    {
      name: 'junk-slayer-game-state', // localStorage key
      version: 1, // Current save version
      migrate: migrateGameState,
      storage: createJSONStorage(() => customStorage),
    }
  )
);
