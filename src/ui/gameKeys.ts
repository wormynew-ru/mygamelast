/**
 * Shared typed i18n lookup dictionaries for monsters, exercises, items, rarities, and achievements.
 */

import type { AchievementId } from '../game/data/achievements';
import type { ExerciseId } from '../game/data/exercises';
import type { ItemRarity, MonsterArchetype } from '../game/types';
import type { TranslationKey } from '../i18n/useTranslation';

export const MONSTER_NAME_KEYS: Record<string, TranslationKey> = {
  SODA: 'monster.SODA.name',
  FRIES: 'monster.FRIES.name',
  DONUT: 'monster.DONUT.name',
  BURGER: 'monster.BURGER.name',
  HOT_SAUCE: 'monster.HOT_SAUCE.name',
  PIZZA: 'monster.PIZZA.name',
  BOSS_KING_BURGER: 'monster.BOSS_KING_BURGER.name',
  BOSS_PIZZA_EMPEROR: 'monster.BOSS_PIZZA_EMPEROR.name',
};

export const MONSTER_DESC_KEYS: Record<string, TranslationKey> = {
  SODA: 'monster.SODA.description',
  FRIES: 'monster.FRIES.description',
  DONUT: 'monster.DONUT.description',
  BURGER: 'monster.BURGER.description',
  HOT_SAUCE: 'monster.HOT_SAUCE.description',
  PIZZA: 'monster.PIZZA.description',
  BOSS_KING_BURGER: 'monster.BOSS_KING_BURGER.description',
  BOSS_PIZZA_EMPEROR: 'monster.BOSS_PIZZA_EMPEROR.description',
};

export const ARCHETYPE_KEYS: Record<MonsterArchetype, TranslationKey> = {
  FAST: 'archetype.FAST',
  ARMORED: 'archetype.ARMORED',
  TOXIC: 'archetype.TOXIC',
  BOSS: 'archetype.BOSS',
};

export const EXERCISE_NAME_KEYS: Record<ExerciseId, TranslationKey> = {
  SQUAT: 'exercise.SQUAT.name',
  PUSH_UP: 'exercise.PUSH_UP.name',
  PLANK: 'exercise.PLANK.name',
  JUMPING_JACK: 'exercise.JUMPING_JACK.name',
};

export const EXERCISE_DESC_KEYS: Record<ExerciseId, TranslationKey> = {
  SQUAT: 'exercise.SQUAT.description',
  PUSH_UP: 'exercise.PUSH_UP.description',
  PLANK: 'exercise.PLANK.description',
  JUMPING_JACK: 'exercise.JUMPING_JACK.description',
};

export const ITEM_NAME_KEYS: Record<string, TranslationKey> = {
  ENERGY_BAR: 'item.ENERGY_BAR.name',
  ISOTONIC_FLASK: 'item.ISOTONIC_FLASK.name',
  PROTEIN_SHAKE: 'item.PROTEIN_SHAKE.name',
  MEGA_RECOVERY_SMOOTHIE: 'item.MEGA_RECOVERY_SMOOTHIE.name',
  RUNNING_SHOES: 'item.RUNNING_SHOES.name',
  WEIGHT_BELT: 'item.WEIGHT_BELT.name',
  ARMOR_VEST: 'item.ARMOR_VEST.name',
  FITNESS_WRISTBANDS: 'item.FITNESS_WRISTBANDS.name',
  TITANIUM_DUMBBELLS: 'item.TITANIUM_DUMBBELLS.name',
  CHAMPION_BELT: 'item.CHAMPION_BELT.name',
};

export const ITEM_DESC_KEYS: Record<string, TranslationKey> = {
  ENERGY_BAR: 'item.ENERGY_BAR.description',
  ISOTONIC_FLASK: 'item.ISOTONIC_FLASK.description',
  PROTEIN_SHAKE: 'item.PROTEIN_SHAKE.description',
  MEGA_RECOVERY_SMOOTHIE: 'item.MEGA_RECOVERY_SMOOTHIE.description',
  RUNNING_SHOES: 'item.RUNNING_SHOES.description',
  WEIGHT_BELT: 'item.WEIGHT_BELT.description',
  ARMOR_VEST: 'item.ARMOR_VEST.description',
  FITNESS_WRISTBANDS: 'item.FITNESS_WRISTBANDS.description',
  TITANIUM_DUMBBELLS: 'item.TITANIUM_DUMBBELLS.description',
  CHAMPION_BELT: 'item.CHAMPION_BELT.description',
};

export const RARITY_KEYS: Record<ItemRarity, TranslationKey> = {
  COMMON: 'rarity.COMMON',
  RARE: 'rarity.RARE',
  EPIC: 'rarity.EPIC',
  LEGENDARY: 'rarity.LEGENDARY',
};

export const RARITY_TEXT_CLASS: Record<ItemRarity, string> = {
  COMMON: 'text-slate-400',
  RARE: 'text-sky-400',
  EPIC: 'text-violet-400',
  LEGENDARY: 'text-amber-400',
};

export const ACHIEVEMENT_KEYS: Record<
  AchievementId,
  { name: TranslationKey; description: TranslationKey }
> = {
  FIRST_REP: {
    name: 'achievement.FIRST_REP.name',
    description: 'achievement.FIRST_REP.description',
  },
  FIFTY_REPS: {
    name: 'achievement.FIFTY_REPS.name',
    description: 'achievement.FIFTY_REPS.description',
  },
  PLANK_SURVIVOR: {
    name: 'achievement.PLANK_SURVIVOR.name',
    description: 'achievement.PLANK_SURVIVOR.description',
  },
  FIRST_VICTORY: {
    name: 'achievement.FIRST_VICTORY.name',
    description: 'achievement.FIRST_VICTORY.description',
  },
  BOSS_SLAYER: {
    name: 'achievement.BOSS_SLAYER.name',
    description: 'achievement.BOSS_SLAYER.description',
  },
  GEAR_COLLECTOR: {
    name: 'achievement.GEAR_COLLECTOR.name',
    description: 'achievement.GEAR_COLLECTOR.description',
  },
  VETERAN_HERO: {
    name: 'achievement.VETERAN_HERO.name',
    description: 'achievement.VETERAN_HERO.description',
  },
  COMBO_MASTER: {
    name: 'achievement.COMBO_MASTER.name',
    description: 'achievement.COMBO_MASTER.description',
  },
  ARENA_SURVIVOR: {
    name: 'achievement.ARENA_SURVIVOR.name',
    description: 'achievement.ARENA_SURVIVOR.description',
  },
  STREAK_WARRIOR: {
    name: 'achievement.STREAK_WARRIOR.name',
    description: 'achievement.STREAK_WARRIOR.description',
  },
  BESTIARY_SCHOLAR: {
    name: 'achievement.BESTIARY_SCHOLAR.name',
    description: 'achievement.BESTIARY_SCHOLAR.description',
  },
};
