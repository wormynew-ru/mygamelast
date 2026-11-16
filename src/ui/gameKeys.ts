/**
 * Shared typed i18n lookup dictionaries for monsters, exercises, circuits, items, rarities, and achievements.
 */

import type { AchievementId } from '../game/data/achievements';
import type { CircuitId } from '../game/data/circuits';
import type { ExerciseId } from '../game/data/exercises';
import type { SanctuaryMixId } from '../game/data/sanctuary';
import type {
  ItemRarity,
  MonsterArchetype,
  SanctuaryLabTier,
  SeedId,
  WateringCanTier,
} from '../game/types';
import type { TranslationKey } from '../i18n/useTranslation';

export const MONSTER_NAME_KEYS: Record<string, TranslationKey> = {
  SODA: 'monster.SODA.name',
  FRIES: 'monster.FRIES.name',
  MILKSHAKE: 'monster.MILKSHAKE.name',
  DONUT: 'monster.DONUT.name',
  NACHOS: 'monster.NACHOS.name',
  BURGER: 'monster.BURGER.name',
  HOT_SAUCE: 'monster.HOT_SAUCE.name',
  PIZZA: 'monster.PIZZA.name',
  BOSS_KING_BURGER: 'monster.BOSS_KING_BURGER.name',
  BOSS_PIZZA_EMPEROR: 'monster.BOSS_PIZZA_EMPEROR.name',
  WEED_DANDELION: 'monster.WEED_DANDELION.name',
  WEED_THISTLE: 'monster.WEED_THISTLE.name',
  WEED_VINE: 'monster.WEED_VINE.name',
};

export const MONSTER_DESC_KEYS: Record<string, TranslationKey> = {
  SODA: 'monster.SODA.description',
  FRIES: 'monster.FRIES.description',
  MILKSHAKE: 'monster.MILKSHAKE.description',
  DONUT: 'monster.DONUT.description',
  NACHOS: 'monster.NACHOS.description',
  BURGER: 'monster.BURGER.description',
  HOT_SAUCE: 'monster.HOT_SAUCE.description',
  PIZZA: 'monster.PIZZA.description',
  BOSS_KING_BURGER: 'monster.BOSS_KING_BURGER.description',
  BOSS_PIZZA_EMPEROR: 'monster.BOSS_PIZZA_EMPEROR.description',
  WEED_DANDELION: 'monster.WEED_DANDELION.description',
  WEED_THISTLE: 'monster.WEED_THISTLE.description',
  WEED_VINE: 'monster.WEED_VINE.description',
};

export const ARCHETYPE_KEYS: Record<MonsterArchetype, TranslationKey> = {
  FAST: 'archetype.FAST',
  ARMORED: 'archetype.ARMORED',
  TOXIC: 'archetype.TOXIC',
  BOSS: 'archetype.BOSS',
};

export const ARCHETYPE_TRAIT_KEYS: Record<MonsterArchetype, TranslationKey> = {
  FAST: 'bestiary.trait.FAST',
  ARMORED: 'bestiary.trait.ARMORED',
  TOXIC: 'bestiary.trait.TOXIC',
  BOSS: 'bestiary.trait.BOSS',
};

export const EXERCISE_NAME_KEYS: Record<ExerciseId, TranslationKey> = {
  SQUAT: 'exercise.SQUAT.name',
  PUSH_UP: 'exercise.PUSH_UP.name',
  PLANK: 'exercise.PLANK.name',
  JUMPING_JACK: 'exercise.JUMPING_JACK.name',
  ARM_HOLD: 'exercise.ARM_HOLD.name',
  WALL_SIT: 'exercise.WALL_SIT.name',
  OVERHEAD_PRESS: 'exercise.OVERHEAD_PRESS.name',
};

export const EXERCISE_DESC_KEYS: Record<ExerciseId, TranslationKey> = {
  SQUAT: 'exercise.SQUAT.description',
  PUSH_UP: 'exercise.PUSH_UP.description',
  PLANK: 'exercise.PLANK.description',
  JUMPING_JACK: 'exercise.JUMPING_JACK.description',
  ARM_HOLD: 'exercise.ARM_HOLD.description',
  WALL_SIT: 'exercise.WALL_SIT.description',
  OVERHEAD_PRESS: 'exercise.OVERHEAD_PRESS.description',
};

export const CIRCUIT_KEYS: Record<
  CircuitId,
  { name: TranslationKey; description: TranslationKey }
> = {
  UPPER_IRON: {
    name: 'circuits.UPPER_IRON.name',
    description: 'circuits.UPPER_IRON.description',
  },
  STATIC_GAUNTLET: {
    name: 'circuits.STATIC_GAUNTLET.name',
    description: 'circuits.STATIC_GAUNTLET.description',
  },
  FULL_BODY_BLITZ: {
    name: 'circuits.FULL_BODY_BLITZ.name',
    description: 'circuits.FULL_BODY_BLITZ.description',
  },
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
  IRON_TONNAGE: {
    name: 'achievement.IRON_TONNAGE.name',
    description: 'achievement.IRON_TONNAGE.description',
  },
  STATIC_MASTER: {
    name: 'achievement.STATIC_MASTER.name',
    description: 'achievement.STATIC_MASTER.description',
  },
  CIRCUIT_CHAMPION: {
    name: 'achievement.CIRCUIT_CHAMPION.name',
    description: 'achievement.CIRCUIT_CHAMPION.description',
  },
  GARDENER: {
    name: 'achievement.GARDENER.name',
    description: 'achievement.GARDENER.description',
  },
  WEED_SLAYER: {
    name: 'achievement.WEED_SLAYER.name',
    description: 'achievement.WEED_SLAYER.description',
  },
  BOTANICAL_ALCHEMIST: {
    name: 'achievement.BOTANICAL_ALCHEMIST.name',
    description: 'achievement.BOTANICAL_ALCHEMIST.description',
  },
};

export const SEED_KEYS: Record<
  SeedId,
  { name: TranslationKey; desc: TranslationKey }
> = {
  PROTEIN_MINT: {
    name: 'garden.seed.PROTEIN_MINT.name',
    desc: 'garden.seed.PROTEIN_MINT.desc',
  },
  IRON_BAMBOO: {
    name: 'garden.seed.IRON_BAMBOO.name',
    desc: 'garden.seed.IRON_BAMBOO.desc',
  },
  CHILI_PEPPER: {
    name: 'garden.seed.CHILI_PEPPER.name',
    desc: 'garden.seed.CHILI_PEPPER.desc',
  },
  GOLDEN_LOTUS: {
    name: 'garden.seed.GOLDEN_LOTUS.name',
    desc: 'garden.seed.GOLDEN_LOTUS.desc',
  },
};

export const WATERING_CAN_KEYS: Record<
  WateringCanTier,
  { name: TranslationKey; perk: TranslationKey }
> = {
  1: { name: 'garden.can.1.name', perk: 'garden.can.1.perk' },
  2: { name: 'garden.can.2.name', perk: 'garden.can.2.perk' },
  3: { name: 'garden.can.3.name', perk: 'garden.can.3.perk' },
  4: { name: 'garden.can.4.name', perk: 'garden.can.4.perk' },
};

export const SANCTUARY_MIX_KEYS: Record<
  SanctuaryMixId,
  { name: TranslationKey; effect: TranslationKey }
> = {
  MINT_ISOTONIC: {
    name: 'garden.mix.MINT_ISOTONIC.name',
    effect: 'garden.mix.MINT_ISOTONIC.effect',
  },
  BAMBOO_FORTIFIER: {
    name: 'garden.mix.BAMBOO_FORTIFIER.name',
    effect: 'garden.mix.BAMBOO_FORTIFIER.effect',
  },
  CHILI_OVERDRIVE_SHOT: {
    name: 'garden.mix.CHILI_OVERDRIVE_SHOT.name',
    effect: 'garden.mix.CHILI_OVERDRIVE_SHOT.effect',
  },
  LOTUS_NECTAR: {
    name: 'garden.mix.LOTUS_NECTAR.name',
    effect: 'garden.mix.LOTUS_NECTAR.effect',
  },
};

export const SANCTUARY_LAB_KEYS: Record<
  SanctuaryLabTier,
  { name: TranslationKey; perk: TranslationKey }
> = {
  1: { name: 'sanctuary.labTier1Name', perk: 'sanctuary.labTier1Perk' },
  2: { name: 'sanctuary.labTier2Name', perk: 'sanctuary.labTier2Perk' },
  3: { name: 'sanctuary.labTier3Name', perk: 'sanctuary.labTier3Perk' },
};
