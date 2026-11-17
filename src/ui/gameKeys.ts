/**
 * Shared typed i18n lookup dictionaries for monsters, exercises, circuits, items, rarities, and achievements.
 */

import type { AchievementId } from '../game/data/achievements';
import type { CircuitId } from '../game/data/circuits';
import type { ExerciseId } from '../game/data/exercises';
import type { SanctuaryMixId, SanctuarySynergyId, MonsterTrophyId } from '../game/data/sanctuary';
import type {
  ArtifactId,
  ExerciseDiscipline,
  ItemRarity,
  MonsterArchetype,
  MutatorId,
  ProgramId,
  SanctuaryLabTier,
  SanctuaryMixCategory,
  SeedId,
  TalentBranch,
  TalentId,
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
  BOSS_DONUT_TITAN: 'monster.BOSS_DONUT_TITAN.name',
  BOSS_SODA_OVERLORD: 'monster.BOSS_SODA_OVERLORD.name',
  BOSS_FRIES_EMPEROR: 'monster.BOSS_FRIES_EMPEROR.name',
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
  BOSS_DONUT_TITAN: 'monster.BOSS_DONUT_TITAN.description',
  BOSS_SODA_OVERLORD: 'monster.BOSS_SODA_OVERLORD.description',
  BOSS_FRIES_EMPEROR: 'monster.BOSS_FRIES_EMPEROR.description',
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
  LUNGE: 'exercise.LUNGE.name',
  HIGH_KNEES: 'exercise.HIGH_KNEES.name',
  FRONT_RAISE: 'exercise.FRONT_RAISE.name',
};

export const EXERCISE_DESC_KEYS: Record<ExerciseId, TranslationKey> = {
  SQUAT: 'exercise.SQUAT.description',
  PUSH_UP: 'exercise.PUSH_UP.description',
  PLANK: 'exercise.PLANK.description',
  JUMPING_JACK: 'exercise.JUMPING_JACK.description',
  ARM_HOLD: 'exercise.ARM_HOLD.description',
  WALL_SIT: 'exercise.WALL_SIT.description',
  OVERHEAD_PRESS: 'exercise.OVERHEAD_PRESS.description',
  LUNGE: 'exercise.LUNGE.description',
  HIGH_KNEES: 'exercise.HIGH_KNEES.description',
  FRONT_RAISE: 'exercise.FRONT_RAISE.description',
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
  SYNERGY_ARCHITECT: {
    name: 'achievement.SYNERGY_ARCHITECT.name',
    description: 'achievement.SYNERGY_ARCHITECT.description',
  },
  MASTER_ALCHEMIST: {
    name: 'achievement.MASTER_ALCHEMIST.name',
    description: 'achievement.MASTER_ALCHEMIST.description',
  },
  TALENT_AWAKENED: {
    name: 'achievement.TALENT_AWAKENED.name',
    description: 'achievement.TALENT_AWAKENED.description',
  },
  APEX_CHALLENGER: {
    name: 'achievement.APEX_CHALLENGER.name',
    description: 'achievement.APEX_CHALLENGER.description',
  },
  ARTIFACT_KEEPER: {
    name: 'achievement.ARTIFACT_KEEPER.name',
    description: 'achievement.ARTIFACT_KEEPER.description',
  },
  WEEKLY_CONQUEROR: {
    name: 'achievement.WEEKLY_CONQUEROR.name',
    description: 'achievement.WEEKLY_CONQUEROR.description',
  },
  PROGRAM_FINISHER: {
    name: 'achievement.PROGRAM_FINISHER.name',
    description: 'achievement.PROGRAM_FINISHER.description',
  },
  MUTANT_BOTANIST: {
    name: 'achievement.MUTANT_BOTANIST.name',
    description: 'achievement.MUTANT_BOTANIST.description',
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
  TITAN_BREW: {
    name: 'garden.mix.TITAN_BREW.name',
    effect: 'garden.mix.TITAN_BREW.effect',
  },
  MONOLITH_ELIXIR: {
    name: 'garden.mix.MONOLITH_ELIXIR.name',
    effect: 'garden.mix.MONOLITH_ELIXIR.effect',
  },
  PULSE_FIZZ: {
    name: 'garden.mix.PULSE_FIZZ.name',
    effect: 'garden.mix.PULSE_FIZZ.effect',
  },
  ARENA_TONIC: {
    name: 'garden.mix.ARENA_TONIC.name',
    effect: 'garden.mix.ARENA_TONIC.effect',
  },
  BERSERK_CAPSAICIN: {
    name: 'garden.mix.BERSERK_CAPSAICIN.name',
    effect: 'garden.mix.BERSERK_CAPSAICIN.effect',
  },
  GLASS_OVERDRIVE: {
    name: 'garden.mix.GLASS_OVERDRIVE.name',
    effect: 'garden.mix.GLASS_OVERDRIVE.effect',
  },
  TOXIC_CATALYST: {
    name: 'garden.mix.TOXIC_CATALYST.name',
    effect: 'garden.mix.TOXIC_CATALYST.effect',
  },
  GREED_EXTRACT: {
    name: 'garden.mix.GREED_EXTRACT.name',
    effect: 'garden.mix.GREED_EXTRACT.effect',
  },
};

export const MONSTER_TROPHY_KEYS: Record<
  MonsterTrophyId,
  { name: TranslationKey; source: TranslationKey }
> = {
  TROPHY_FIZZ_CORE: {
    name: 'trophy.TROPHY_FIZZ_CORE.name',
    source: 'trophy.TROPHY_FIZZ_CORE.source',
  },
  TROPHY_GLAZE_SHELL: {
    name: 'trophy.TROPHY_GLAZE_SHELL.name',
    source: 'trophy.TROPHY_GLAZE_SHELL.source',
  },
  TROPHY_CAPSAICIN_DROP: {
    name: 'trophy.TROPHY_CAPSAICIN_DROP.name',
    source: 'trophy.TROPHY_CAPSAICIN_DROP.source',
  },
  TROPHY_CROWN_SPICE: {
    name: 'trophy.TROPHY_CROWN_SPICE.name',
    source: 'trophy.TROPHY_CROWN_SPICE.source',
  },
};

export const SANCTUARY_SYNERGY_KEYS: Record<
  SanctuarySynergyId,
  { name: TranslationKey; effect: TranslationKey }
> = {
  ISOTONIC_RHYTHM: {
    name: 'sanctuary.synergy.ISOTONIC_RHYTHM.name',
    effect: 'sanctuary.synergy.ISOTONIC_RHYTHM.effect',
  },
  IRON_BASTION: {
    name: 'sanctuary.synergy.IRON_BASTION.name',
    effect: 'sanctuary.synergy.IRON_BASTION.effect',
  },
  POWER_SURGE: {
    name: 'sanctuary.synergy.POWER_SURGE.name',
    effect: 'sanctuary.synergy.POWER_SURGE.effect',
  },
  ADRENALINE_GUARD: {
    name: 'sanctuary.synergy.ADRENALINE_GUARD.name',
    effect: 'sanctuary.synergy.ADRENALINE_GUARD.effect',
  },
  PURE_FURY: {
    name: 'sanctuary.synergy.PURE_FURY.name',
    effect: 'sanctuary.synergy.PURE_FURY.effect',
  },
  ENDLESS_ENDURANCE: {
    name: 'sanctuary.synergy.ENDLESS_ENDURANCE.name',
    effect: 'sanctuary.synergy.ENDLESS_ENDURANCE.effect',
  },
  ALCHEMIST_TRIUMVIRATE: {
    name: 'sanctuary.synergy.ALCHEMIST_TRIUMVIRATE.name',
    effect: 'sanctuary.synergy.ALCHEMIST_TRIUMVIRATE.effect',
  },
};

export const SANCTUARY_CATEGORY_KEYS: Record<SanctuaryMixCategory, TranslationKey> = {
  BASE: 'sanctuary.category.BASE',
  DISCIPLINE: 'sanctuary.category.DISCIPLINE',
  MUTAGEN: 'sanctuary.category.MUTAGEN',
};

export const EXERCISE_DISCIPLINE_KEYS: Record<ExerciseDiscipline, TranslationKey> = {
  STRENGTH: 'sanctuary.discipline.STRENGTH',
  STATIC: 'sanctuary.discipline.STATIC',
  CARDIO: 'sanctuary.discipline.CARDIO',
};

export const SANCTUARY_LAB_KEYS: Record<
  SanctuaryLabTier,
  { name: TranslationKey; perk: TranslationKey }
> = {
  1: { name: 'sanctuary.labTier1Name', perk: 'sanctuary.labTier1Perk' },
  2: { name: 'sanctuary.labTier2Name', perk: 'sanctuary.labTier2Perk' },
  3: { name: 'sanctuary.labTier3Name', perk: 'sanctuary.labTier3Perk' },
};

export const TALENT_BRANCH_KEYS: Record<TalentBranch, TranslationKey> = {
  MIGHT: 'talents.branch.MIGHT',
  BASTION: 'talents.branch.BASTION',
  BOTANY: 'talents.branch.BOTANY',
};

export const TALENT_KEYS: Record<
  TalentId,
  { name: TranslationKey; desc: TranslationKey }
> = {
  MIGHT_STRIKE: { name: 'talents.MIGHT_STRIKE.name', desc: 'talents.MIGHT_STRIKE.desc' },
  MIGHT_CRIT_EDGE: { name: 'talents.MIGHT_CRIT_EDGE.name', desc: 'talents.MIGHT_CRIT_EDGE.desc' },
  MIGHT_EXECUTIONER: { name: 'talents.MIGHT_EXECUTIONER.name', desc: 'talents.MIGHT_EXECUTIONER.desc' },
  MIGHT_OVERDRIVE: { name: 'talents.MIGHT_OVERDRIVE.name', desc: 'talents.MIGHT_OVERDRIVE.desc' },
  BASTION_VITALITY: { name: 'talents.BASTION_VITALITY.name', desc: 'talents.BASTION_VITALITY.desc' },
  BASTION_AEGIS: { name: 'talents.BASTION_AEGIS.name', desc: 'talents.BASTION_AEGIS.desc' },
  BASTION_TEMPO: { name: 'talents.BASTION_TEMPO.name', desc: 'talents.BASTION_TEMPO.desc' },
  BASTION_THORNS: { name: 'talents.BASTION_THORNS.name', desc: 'talents.BASTION_THORNS.desc' },
  BOTANY_SCHOLAR: { name: 'talents.BOTANY_SCHOLAR.name', desc: 'talents.BOTANY_SCHOLAR.desc' },
  BOTANY_FORTUNE: { name: 'talents.BOTANY_FORTUNE.name', desc: 'talents.BOTANY_FORTUNE.desc' },
  BOTANY_GREEN_THUMB: { name: 'talents.BOTANY_GREEN_THUMB.name', desc: 'talents.BOTANY_GREEN_THUMB.desc' },
  BOTANY_ALCHEMIST: { name: 'talents.BOTANY_ALCHEMIST.name', desc: 'talents.BOTANY_ALCHEMIST.desc' },
};

export const ARTIFACT_KEYS: Record<
  ArtifactId,
  { name: TranslationKey; desc: TranslationKey }
> = {
  PHOENIX_BAND: { name: 'artifacts.PHOENIX_BAND.name', desc: 'artifacts.PHOENIX_BAND.desc' },
  TITAN_CORE: { name: 'artifacts.TITAN_CORE.name', desc: 'artifacts.TITAN_CORE.desc' },
  BERSERKER_SIGIL: { name: 'artifacts.BERSERKER_SIGIL.name', desc: 'artifacts.BERSERKER_SIGIL.desc' },
  VAMPIRIC_FANG: { name: 'artifacts.VAMPIRIC_FANG.name', desc: 'artifacts.VAMPIRIC_FANG.desc' },
  SHIELD_BREAKER_PRISM: {
    name: 'artifacts.SHIELD_BREAKER_PRISM.name',
    desc: 'artifacts.SHIELD_BREAKER_PRISM.desc',
  },
  CHRONO_HOURGLASS: {
    name: 'artifacts.CHRONO_HOURGLASS.name',
    desc: 'artifacts.CHRONO_HOURGLASS.desc',
  },
};

export const PROGRAM_KEYS: Record<
  ProgramId,
  { name: TranslationKey; desc: TranslationKey }
> = {
  STARTER_3D: { name: 'programs.STARTER_3D.name', desc: 'programs.STARTER_3D.desc' },
  HYPERTROPHY_5D: { name: 'programs.HYPERTROPHY_5D.name', desc: 'programs.HYPERTROPHY_5D.desc' },
  ENDURANCE_5D: { name: 'programs.ENDURANCE_5D.name', desc: 'programs.ENDURANCE_5D.desc' },
  TITAN_WEEK_7D: { name: 'programs.TITAN_WEEK_7D.name', desc: 'programs.TITAN_WEEK_7D.desc' },
};

export const MUTATOR_KEYS: Record<
  MutatorId,
  { name: TranslationKey; desc: TranslationKey }
> = {
  GLASS_CANNON: { name: 'mutators.GLASS_CANNON.name', desc: 'mutators.GLASS_CANNON.desc' },
  IRON_FOES: { name: 'mutators.IRON_FOES.name', desc: 'mutators.IRON_FOES.desc' },
  BLITZ_CLOCK: { name: 'mutators.BLITZ_CLOCK.name', desc: 'mutators.BLITZ_CLOCK.desc' },
  TOXIC_MIST: { name: 'mutators.TOXIC_MIST.name', desc: 'mutators.TOXIC_MIST.desc' },
  NO_ITEMS: { name: 'mutators.NO_ITEMS.name', desc: 'mutators.NO_ITEMS.desc' },
};
