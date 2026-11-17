/**
 * Sanctuary / Hideout engine: 12 botanical & mutagenic mix recipes,
 * 4 archetype monster trophies, 7 slot-combo synergies, lab tiers,
 * normalization, and aggregated combat buff calculators.
 * ZERO React, DOM, or Vision imports allowed.
 */

import type { ExerciseId } from './exercises';
import type {
  AlchemyOrder,
  ExerciseDiscipline,
  ItemRarity,
  MonsterArchetype,
  MonsterTrophyId,
  SanctuaryLabTier,
  SanctuaryMixCategory,
  SanctuaryMixId,
  SanctuaryPreset,
  SanctuaryState,
  SanctuarySynergyId,
  SeedId,
} from '../types';

export type { SanctuaryMixId, SanctuarySynergyId, MonsterTrophyId };

export interface SanctuaryIngredientRequirement {
  seedId: SeedId;
  qty: number;
}

export interface SanctuaryTrophyRequirement {
  trophyId: MonsterTrophyId;
  qty: number;
}

export interface MonsterTrophyDefinition {
  id: MonsterTrophyId;
  icon: string;
  archetype: MonsterArchetype;
  rarity: ItemRarity;
}

export const MONSTER_TROPHY_ORDER: readonly MonsterTrophyId[] = [
  'TROPHY_FIZZ_CORE',
  'TROPHY_GLAZE_SHELL',
  'TROPHY_CAPSAICIN_DROP',
  'TROPHY_CROWN_SPICE',
];

export const MONSTER_TROPHIES: Record<MonsterTrophyId, MonsterTrophyDefinition> = {
  TROPHY_FIZZ_CORE: {
    id: 'TROPHY_FIZZ_CORE',
    icon: '🫧',
    archetype: 'FAST',
    rarity: 'COMMON',
  },
  TROPHY_GLAZE_SHELL: {
    id: 'TROPHY_GLAZE_SHELL',
    icon: '🥥',
    archetype: 'ARMORED',
    rarity: 'RARE',
  },
  TROPHY_CAPSAICIN_DROP: {
    id: 'TROPHY_CAPSAICIN_DROP',
    icon: '🩸',
    archetype: 'TOXIC',
    rarity: 'EPIC',
  },
  TROPHY_CROWN_SPICE: {
    id: 'TROPHY_CROWN_SPICE',
    icon: '👑',
    archetype: 'BOSS',
    rarity: 'LEGENDARY',
  },
};

export function getTrophyForArchetype(archetype?: MonsterArchetype): MonsterTrophyId {
  switch (archetype) {
    case 'FAST':
      return 'TROPHY_FIZZ_CORE';
    case 'ARMORED':
      return 'TROPHY_GLAZE_SHELL';
    case 'TOXIC':
      return 'TROPHY_CAPSAICIN_DROP';
    case 'BOSS':
      return 'TROPHY_CROWN_SPICE';
    default:
      return 'TROPHY_FIZZ_CORE';
  }
}

export function getExerciseDiscipline(exerciseId?: ExerciseId): ExerciseDiscipline | null {
  switch (exerciseId) {
    case 'SQUAT':
    case 'PUSH_UP':
    case 'OVERHEAD_PRESS':
    case 'LUNGE':
    case 'FRONT_RAISE':
      return 'STRENGTH';
    case 'PLANK':
    case 'ARM_HOLD':
    case 'WALL_SIT':
      return 'STATIC';
    case 'JUMPING_JACK':
    case 'HIGH_KNEES':
      return 'CARDIO';
    default:
      return null;
  }
}

export interface SanctuaryMixEffectSpec {
  healHp: number;
  attackBonus: number;
  defenseBonus: number;
  critChanceBonus: number;
  critMultiplierBonus?: number;
  comboWindowBonusMs: number;
  incomingDamageMultiplier: number;
  ultimateChargeMultiplier: number;
  startingUltimateCharge: number;
  xpMultiplier: number;
  coinMultiplier?: number;
  globalDamageMultiplier?: number;
  strengthDamageMultiplier?: number;
  staticDamageMultiplier?: number;
  cardioDamageMultiplier?: number;
  dumbbellDamageBonus?: number;
  maxHpMultiplier?: number;
  armorPierceRatio?: number;
  shieldBreakBonus?: number;
  blockMitigationOverride?: number;
  toxicCleanseHoldTicksOverride?: number;
  toxicImmunity?: boolean;
  toxicCatalystProcDamageBonus?: number;
  toxicCatalystProcUltCharge?: number;
  healOnUlt?: number;
  selfDamageOnUlt?: number;
}

export interface SanctuaryMixBlueprint {
  id: SanctuaryMixId;
  category: SanctuaryMixCategory;
  icon: string;
  rarity: ItemRarity;
  isRisky?: boolean;
  disciplineFocus?: ExerciseDiscipline;
  ingredients: readonly SanctuaryIngredientRequirement[];
  trophyIngredients?: readonly SanctuaryTrophyRequirement[];
  effect: SanctuaryMixEffectSpec;
}

export interface SanctuaryLabTierConfig {
  tier: SanctuaryLabTier;
  icon: string;
  maxBuffSlots: number;
  healMultiplier: number;
  startingUltBonus: number;
  upgradeCost: number;
}

export const SANCTUARY_LAB_TIERS: Record<SanctuaryLabTier, SanctuaryLabTierConfig> = {
  1: {
    tier: 1,
    icon: '⚗️',
    maxBuffSlots: 1,
    healMultiplier: 1.0,
    startingUltBonus: 0,
    upgradeCost: 0,
  },
  2: {
    tier: 2,
    icon: '🧪',
    maxBuffSlots: 2,
    healMultiplier: 1.25,
    startingUltBonus: 0,
    upgradeCost: 120,
  },
  3: {
    tier: 3,
    icon: '🔮',
    maxBuffSlots: 3,
    healMultiplier: 1.5,
    startingUltBonus: 15,
    upgradeCost: 260,
  },
};

export const SANCTUARY_MIX_ORDER: readonly SanctuaryMixId[] = [
  'MINT_ISOTONIC',
  'BAMBOO_FORTIFIER',
  'CHILI_OVERDRIVE_SHOT',
  'LOTUS_NECTAR',
  'TITAN_BREW',
  'MONOLITH_ELIXIR',
  'PULSE_FIZZ',
  'ARENA_TONIC',
  'BERSERK_CAPSAICIN',
  'GLASS_OVERDRIVE',
  'TOXIC_CATALYST',
  'GREED_EXTRACT',
];

export const SANCTUARY_MIX_BLUEPRINTS: readonly SanctuaryMixBlueprint[] = [
  // === 4 BASE BOTANICAL MIXES ===
  {
    id: 'MINT_ISOTONIC',
    category: 'BASE',
    icon: '🧪',
    rarity: 'COMMON',
    ingredients: [{ seedId: 'PROTEIN_MINT', qty: 2 }],
    effect: {
      healHp: 35,
      attackBonus: 2,
      defenseBonus: 0,
      critChanceBonus: 0,
      comboWindowBonusMs: 600,
      incomingDamageMultiplier: 1.0,
      ultimateChargeMultiplier: 1.0,
      startingUltimateCharge: 0,
      xpMultiplier: 1.0,
    },
  },
  {
    id: 'BAMBOO_FORTIFIER',
    category: 'BASE',
    icon: '🛡️',
    rarity: 'RARE',
    ingredients: [
      { seedId: 'IRON_BAMBOO', qty: 2 },
      { seedId: 'PROTEIN_MINT', qty: 1 },
    ],
    effect: {
      healHp: 15,
      attackBonus: 0,
      defenseBonus: 4,
      critChanceBonus: 0,
      comboWindowBonusMs: 0,
      incomingDamageMultiplier: 0.75,
      ultimateChargeMultiplier: 1.0,
      startingUltimateCharge: 0,
      xpMultiplier: 1.0,
    },
  },
  {
    id: 'CHILI_OVERDRIVE_SHOT',
    category: 'BASE',
    icon: '🔥',
    rarity: 'EPIC',
    ingredients: [
      { seedId: 'CHILI_PEPPER', qty: 2 },
      { seedId: 'IRON_BAMBOO', qty: 1 },
    ],
    effect: {
      healHp: 0,
      attackBonus: 4,
      defenseBonus: 0,
      critChanceBonus: 0.05,
      comboWindowBonusMs: 0,
      incomingDamageMultiplier: 1.0,
      ultimateChargeMultiplier: 1.4,
      startingUltimateCharge: 25,
      xpMultiplier: 1.0,
    },
  },
  {
    id: 'LOTUS_NECTAR',
    category: 'BASE',
    icon: '✨',
    rarity: 'LEGENDARY',
    ingredients: [
      { seedId: 'GOLDEN_LOTUS', qty: 1 },
      { seedId: 'CHILI_PEPPER', qty: 1 },
      { seedId: 'PROTEIN_MINT', qty: 1 },
    ],
    effect: {
      healHp: 50,
      attackBonus: 3,
      defenseBonus: 3,
      critChanceBonus: 0.1,
      comboWindowBonusMs: 400,
      incomingDamageMultiplier: 1.0,
      ultimateChargeMultiplier: 1.25,
      startingUltimateCharge: 30,
      xpMultiplier: 1.3,
    },
  },

  // === 4 DISCIPLINE MIXES (STRENGTH / STATIC / CARDIO / ENDURANCE) ===
  {
    id: 'TITAN_BREW',
    category: 'DISCIPLINE',
    disciplineFocus: 'STRENGTH',
    icon: '🏋️',
    rarity: 'RARE',
    ingredients: [
      { seedId: 'IRON_BAMBOO', qty: 1 },
      { seedId: 'CHILI_PEPPER', qty: 1 },
    ],
    trophyIngredients: [{ trophyId: 'TROPHY_GLAZE_SHELL', qty: 1 }],
    effect: {
      healHp: 10,
      attackBonus: 3,
      defenseBonus: 0,
      critChanceBonus: 0.05,
      comboWindowBonusMs: 0,
      incomingDamageMultiplier: 1.0,
      ultimateChargeMultiplier: 1.0,
      startingUltimateCharge: 0,
      xpMultiplier: 1.0,
      strengthDamageMultiplier: 1.35,
      dumbbellDamageBonus: 0.15,
      shieldBreakBonus: 1,
    },
  },
  {
    id: 'MONOLITH_ELIXIR',
    category: 'DISCIPLINE',
    disciplineFocus: 'STATIC',
    icon: '🗿',
    rarity: 'RARE',
    ingredients: [
      { seedId: 'PROTEIN_MINT', qty: 1 },
      { seedId: 'IRON_BAMBOO', qty: 2 },
    ],
    trophyIngredients: [{ trophyId: 'TROPHY_GLAZE_SHELL', qty: 1 }],
    effect: {
      healHp: 20,
      attackBonus: 0,
      defenseBonus: 3,
      critChanceBonus: 0,
      comboWindowBonusMs: 0,
      incomingDamageMultiplier: 1.0,
      ultimateChargeMultiplier: 1.0,
      startingUltimateCharge: 0,
      xpMultiplier: 1.0,
      staticDamageMultiplier: 1.4,
      blockMitigationOverride: 0.9,
      toxicCleanseHoldTicksOverride: 1,
    },
  },
  {
    id: 'PULSE_FIZZ',
    category: 'DISCIPLINE',
    disciplineFocus: 'CARDIO',
    icon: '⚡',
    rarity: 'COMMON',
    ingredients: [
      { seedId: 'PROTEIN_MINT', qty: 2 },
      { seedId: 'CHILI_PEPPER', qty: 1 },
    ],
    trophyIngredients: [{ trophyId: 'TROPHY_FIZZ_CORE', qty: 1 }],
    effect: {
      healHp: 15,
      attackBonus: 2,
      defenseBonus: 0,
      critChanceBonus: 0.05,
      comboWindowBonusMs: 1200,
      incomingDamageMultiplier: 1.0,
      ultimateChargeMultiplier: 1.2,
      startingUltimateCharge: 0,
      xpMultiplier: 1.0,
      cardioDamageMultiplier: 1.45,
    },
  },
  {
    id: 'ARENA_TONIC',
    category: 'DISCIPLINE',
    icon: '🏟️',
    rarity: 'EPIC',
    ingredients: [
      { seedId: 'GOLDEN_LOTUS', qty: 1 },
      { seedId: 'PROTEIN_MINT', qty: 1 },
    ],
    trophyIngredients: [{ trophyId: 'TROPHY_FIZZ_CORE', qty: 2 }],
    effect: {
      healHp: 25,
      attackBonus: 2,
      defenseBonus: 2,
      critChanceBonus: 0,
      comboWindowBonusMs: 300,
      incomingDamageMultiplier: 1.0,
      ultimateChargeMultiplier: 1.15,
      startingUltimateCharge: 0,
      xpMultiplier: 1.2,
      coinMultiplier: 1.25,
      healOnUlt: 4,
    },
  },

  // === 4 RISKY MUTAGEN MIXES (GLASS CANNON / HIGH RISK - HIGH REWARD) ===
  {
    id: 'BERSERK_CAPSAICIN',
    category: 'MUTAGEN',
    isRisky: true,
    icon: '💢',
    rarity: 'EPIC',
    ingredients: [{ seedId: 'CHILI_PEPPER', qty: 2 }],
    trophyIngredients: [{ trophyId: 'TROPHY_CAPSAICIN_DROP', qty: 1 }],
    effect: {
      healHp: 0,
      attackBonus: 5,
      defenseBonus: -4,
      critChanceBonus: 0.15,
      comboWindowBonusMs: 0,
      incomingDamageMultiplier: 1.25,
      ultimateChargeMultiplier: 1.0,
      startingUltimateCharge: 0,
      xpMultiplier: 1.0,
      globalDamageMultiplier: 1.55,
    },
  },
  {
    id: 'GLASS_OVERDRIVE',
    category: 'MUTAGEN',
    isRisky: true,
    icon: '💎',
    rarity: 'LEGENDARY',
    ingredients: [{ seedId: 'CHILI_PEPPER', qty: 2 }],
    trophyIngredients: [
      { trophyId: 'TROPHY_FIZZ_CORE', qty: 1 },
      { trophyId: 'TROPHY_CROWN_SPICE', qty: 1 },
    ],
    effect: {
      healHp: 0,
      attackBonus: 4,
      defenseBonus: 0,
      critChanceBonus: 0.1,
      critMultiplierBonus: 0.5,
      comboWindowBonusMs: 0,
      incomingDamageMultiplier: 1.35,
      ultimateChargeMultiplier: 1.6,
      startingUltimateCharge: 50,
      xpMultiplier: 1.0,
      globalDamageMultiplier: 1.4,
      maxHpMultiplier: 0.8,
    },
  },
  {
    id: 'TOXIC_CATALYST',
    category: 'MUTAGEN',
    isRisky: true,
    icon: '☣️',
    rarity: 'EPIC',
    ingredients: [{ seedId: 'PROTEIN_MINT', qty: 2 }],
    trophyIngredients: [{ trophyId: 'TROPHY_CAPSAICIN_DROP', qty: 2 }],
    effect: {
      healHp: 0,
      attackBonus: 3,
      defenseBonus: 0,
      critChanceBonus: 0.05,
      comboWindowBonusMs: 0,
      incomingDamageMultiplier: 1.0,
      ultimateChargeMultiplier: 1.15,
      startingUltimateCharge: 0,
      xpMultiplier: 1.0,
      toxicImmunity: true,
      toxicCatalystProcDamageBonus: 0.2,
      toxicCatalystProcUltCharge: 15,
      selfDamageOnUlt: 3,
    },
  },
  {
    id: 'GREED_EXTRACT',
    category: 'MUTAGEN',
    isRisky: true,
    icon: '🪙',
    rarity: 'LEGENDARY',
    ingredients: [{ seedId: 'GOLDEN_LOTUS', qty: 1 }],
    trophyIngredients: [{ trophyId: 'TROPHY_CROWN_SPICE', qty: 1 }],
    effect: {
      healHp: 0,
      attackBonus: 3,
      defenseBonus: -3,
      critChanceBonus: 0,
      comboWindowBonusMs: -600,
      incomingDamageMultiplier: 1.0,
      ultimateChargeMultiplier: 1.0,
      startingUltimateCharge: 0,
      xpMultiplier: 1.45,
      coinMultiplier: 1.5,
      armorPierceRatio: 0.5,
    },
  },
];

export const SANCTUARY_MIX_MAP: Record<SanctuaryMixId, SanctuaryMixBlueprint> = {
  MINT_ISOTONIC: SANCTUARY_MIX_BLUEPRINTS[0],
  BAMBOO_FORTIFIER: SANCTUARY_MIX_BLUEPRINTS[1],
  CHILI_OVERDRIVE_SHOT: SANCTUARY_MIX_BLUEPRINTS[2],
  LOTUS_NECTAR: SANCTUARY_MIX_BLUEPRINTS[3],
  TITAN_BREW: SANCTUARY_MIX_BLUEPRINTS[4],
  MONOLITH_ELIXIR: SANCTUARY_MIX_BLUEPRINTS[5],
  PULSE_FIZZ: SANCTUARY_MIX_BLUEPRINTS[6],
  ARENA_TONIC: SANCTUARY_MIX_BLUEPRINTS[7],
  BERSERK_CAPSAICIN: SANCTUARY_MIX_BLUEPRINTS[8],
  GLASS_OVERDRIVE: SANCTUARY_MIX_BLUEPRINTS[9],
  TOXIC_CATALYST: SANCTUARY_MIX_BLUEPRINTS[10],
  GREED_EXTRACT: SANCTUARY_MIX_BLUEPRINTS[11],
};

export interface SanctuarySynergyDefinition {
  id: SanctuarySynergyId;
  icon: string;
  requiredMixes?: readonly SanctuaryMixId[];
  check: (activeBuffs: readonly SanctuaryMixId[]) => boolean;
}

export const SANCTUARY_SYNERGY_ORDER: readonly SanctuarySynergyId[] = [
  'ISOTONIC_RHYTHM',
  'IRON_BASTION',
  'POWER_SURGE',
  'ADRENALINE_GUARD',
  'PURE_FURY',
  'ENDLESS_ENDURANCE',
  'ALCHEMIST_TRIUMVIRATE',
];

export const SANCTUARY_SYNERGIES: readonly SanctuarySynergyDefinition[] = [
  {
    id: 'ISOTONIC_RHYTHM',
    icon: '⚡',
    requiredMixes: ['MINT_ISOTONIC', 'PULSE_FIZZ'],
    check: (buffs) => buffs.includes('MINT_ISOTONIC') && buffs.includes('PULSE_FIZZ'),
  },
  {
    id: 'IRON_BASTION',
    icon: '🛡️',
    requiredMixes: ['BAMBOO_FORTIFIER', 'MONOLITH_ELIXIR'],
    check: (buffs) => buffs.includes('BAMBOO_FORTIFIER') && buffs.includes('MONOLITH_ELIXIR'),
  },
  {
    id: 'POWER_SURGE',
    icon: '💥',
    requiredMixes: ['TITAN_BREW', 'CHILI_OVERDRIVE_SHOT'],
    check: (buffs) => buffs.includes('TITAN_BREW') && buffs.includes('CHILI_OVERDRIVE_SHOT'),
  },
  {
    id: 'ADRENALINE_GUARD',
    icon: '⚖️',
    requiredMixes: ['BAMBOO_FORTIFIER'],
    check: (buffs) =>
      buffs.includes('BAMBOO_FORTIFIER') &&
      buffs.some((id) => SANCTUARY_MIX_MAP[id]?.category === 'MUTAGEN'),
  },
  {
    id: 'PURE_FURY',
    icon: '🔥',
    requiredMixes: ['BERSERK_CAPSAICIN', 'GLASS_OVERDRIVE'],
    check: (buffs) =>
      buffs.includes('BERSERK_CAPSAICIN') && buffs.includes('GLASS_OVERDRIVE'),
  },
  {
    id: 'ENDLESS_ENDURANCE',
    icon: '🌿',
    requiredMixes: ['ARENA_TONIC', 'LOTUS_NECTAR'],
    check: (buffs) => buffs.includes('ARENA_TONIC') && buffs.includes('LOTUS_NECTAR'),
  },
  {
    id: 'ALCHEMIST_TRIUMVIRATE',
    icon: '🔮',
    check: (buffs) => {
      const cats = new Set(buffs.map((id) => SANCTUARY_MIX_MAP[id]?.category).filter(Boolean));
      return cats.has('BASE') && cats.has('DISCIPLINE') && cats.has('MUTAGEN');
    },
  },
];

export const SANCTUARY_SYNERGY_MAP: Record<SanctuarySynergyId, SanctuarySynergyDefinition> = {
  ISOTONIC_RHYTHM: SANCTUARY_SYNERGIES[0],
  IRON_BASTION: SANCTUARY_SYNERGIES[1],
  POWER_SURGE: SANCTUARY_SYNERGIES[2],
  ADRENALINE_GUARD: SANCTUARY_SYNERGIES[3],
  PURE_FURY: SANCTUARY_SYNERGIES[4],
  ENDLESS_ENDURANCE: SANCTUARY_SYNERGIES[5],
  ALCHEMIST_TRIUMVIRATE: SANCTUARY_SYNERGIES[6],
};

export function getActiveSanctuarySynergies(
  activeBuffs: readonly SanctuaryMixId[]
): SanctuarySynergyId[] {
  if (activeBuffs.length < 2) return [];
  return SANCTUARY_SYNERGIES.filter((s) => s.check(activeBuffs)).map((s) => s.id);
}

export interface AggregatedSanctuaryBuffs {
  attackBonus: number;
  defenseBonus: number;
  critChanceBonus: number;
  critMultiplierBonus: number;
  comboWindowBonusMs: number;
  incomingDamageMultiplier: number;
  ultimateChargeMultiplier: number;
  startingUltimateCharge: number;
  xpMultiplier: number;
  coinMultiplier: number;
  globalDamageMultiplier: number;
  strengthDamageMultiplier: number;
  staticDamageMultiplier: number;
  cardioDamageMultiplier: number;
  dumbbellDamageBonus: number;
  maxHpMultiplier: number;
  armorPierceRatio: number;
  shieldBreakBonus: number;
  blockMitigationOverride: number | null;
  toxicCleanseHoldTicksOverride: number | null;
  toxicImmunity: boolean;
  toxicCatalystProcDamageBonus: number;
  toxicCatalystProcUltCharge: number;
  healOnUlt: number;
  selfDamageOnUlt: number;
  // Synergy-driven modifiers
  activeSynergies: SanctuarySynergyId[];
  startingCombo: number;
  thornsReflectDamage: number;
  thornsUltChargeGain: number;
  ultimateDamageMultiplierOverride: number | null;
  breakAllShieldsOnUlt: boolean;
  highComboCritBonus: number;
  healOnWaveClear: number;
  hasRiskyMutagen: boolean;
}

export function createInitialTrophyInventory(): Record<MonsterTrophyId, number> {
  return {
    TROPHY_FIZZ_CORE: 0,
    TROPHY_GLAZE_SHELL: 0,
    TROPHY_CAPSAICIN_DROP: 0,
    TROPHY_CROWN_SPICE: 0,
  };
}

export function createInitialMixInventory(): Record<SanctuaryMixId, number> {
  return {
    MINT_ISOTONIC: 0,
    BAMBOO_FORTIFIER: 0,
    CHILI_OVERDRIVE_SHOT: 0,
    LOTUS_NECTAR: 0,
    TITAN_BREW: 0,
    MONOLITH_ELIXIR: 0,
    PULSE_FIZZ: 0,
    ARENA_TONIC: 0,
    BERSERK_CAPSAICIN: 0,
    GLASS_OVERDRIVE: 0,
    TOXIC_CATALYST: 0,
    GREED_EXTRACT: 0,
  };
}

export const MAX_SANCTUARY_PRESETS = 3;

const ALCHEMY_ORDER_TEMPLATES: readonly Omit<AlchemyOrder, 'dateKey' | 'completed'>[] = [
  {
    orderIndex: 0,
    requirements: [{ seedId: 'PROTEIN_MINT', qty: 3 }, { trophyId: 'TROPHY_FIZZ_CORE', qty: 1 }],
    rewardCoins: 95,
    rewardXp: 70,
  },
  {
    orderIndex: 1,
    requirements: [{ seedId: 'IRON_BAMBOO', qty: 2 }, { mixId: 'MINT_ISOTONIC', qty: 1 }],
    rewardCoins: 110,
    rewardXp: 85,
  },
  {
    orderIndex: 2,
    requirements: [{ seedId: 'CHILI_PEPPER', qty: 2 }, { trophyId: 'TROPHY_GLAZE_SHELL', qty: 1 }],
    rewardCoins: 135,
    rewardXp: 100,
  },
  {
    orderIndex: 3,
    requirements: [{ mixId: 'BAMBOO_FORTIFIER', qty: 1 }, { trophyId: 'TROPHY_CAPSAICIN_DROP', qty: 1 }],
    rewardCoins: 155,
    rewardXp: 120,
  },
];

export function generateDailyAlchemyOrder(dateKey: string, seedOffset = 0): AlchemyOrder {
  let hash = seedOffset;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  const tpl = ALCHEMY_ORDER_TEMPLATES[hash % ALCHEMY_ORDER_TEMPLATES.length];
  return {
    dateKey,
    orderIndex: tpl.orderIndex,
    requirements: tpl.requirements.map((r) => ({ ...r })),
    rewardCoins: tpl.rewardCoins,
    rewardXp: tpl.rewardXp,
    completed: false,
  };
}

export function createInitialSanctuaryState(): SanctuaryState {
  return {
    labTier: 1,
    mixInventory: createInitialMixInventory(),
    trophyInventory: createInitialTrophyInventory(),
    activeBuffs: [],
    healedBuffIds: [],
    totalCrafted: 0,
    totalSynergiesActivated: 0,
    presets: [],
    alchemyOrder: null,
    completedOrdersCount: 0,
  };
}

function isValidMixId(value: unknown): value is SanctuaryMixId {
  return typeof value === 'string' && value in SANCTUARY_MIX_MAP;
}

export function normalizeSanctuaryState(raw?: Partial<SanctuaryState> | null): SanctuaryState {
  const base = createInitialSanctuaryState();
  if (!raw || typeof raw !== 'object') {
    return base;
  }

  const labTier: SanctuaryLabTier =
    raw.labTier === 2 || raw.labTier === 3 ? raw.labTier : 1;
  const maxSlots = SANCTUARY_LAB_TIERS[labTier].maxBuffSlots;

  const mixInventory = createInitialMixInventory();
  for (const mixId of SANCTUARY_MIX_ORDER) {
    mixInventory[mixId] = Math.max(0, Math.floor(raw.mixInventory?.[mixId] ?? 0));
  }

  const trophyInventory = createInitialTrophyInventory();
  for (const trophyId of MONSTER_TROPHY_ORDER) {
    trophyInventory[trophyId] = Math.max(0, Math.floor(raw.trophyInventory?.[trophyId] ?? 0));
  }

  const uniqueBuffs: SanctuaryMixId[] = [];
  if (Array.isArray(raw.activeBuffs)) {
    for (const id of raw.activeBuffs) {
      if (isValidMixId(id) && !uniqueBuffs.includes(id) && uniqueBuffs.length < maxSlots) {
        uniqueBuffs.push(id);
      }
    }
  }

  const healedBuffIds: SanctuaryMixId[] = [];
  if (Array.isArray(raw.healedBuffIds)) {
    for (const id of raw.healedBuffIds) {
      if (isValidMixId(id) && uniqueBuffs.includes(id) && !healedBuffIds.includes(id)) {
        healedBuffIds.push(id);
      }
    }
  }

  const presets: SanctuaryPreset[] = [];
  if (Array.isArray(raw.presets)) {
    for (const p of raw.presets.slice(0, MAX_SANCTUARY_PRESETS)) {
      if (!p || typeof p !== 'object') continue;
      const validBuffs = Array.isArray(p.buffs)
        ? Array.from(new Set(p.buffs.filter(isValidMixId))).slice(0, maxSlots)
        : [];
      presets.push({
        id: typeof p.id === 'string' ? p.id : `preset-${presets.length + 1}`,
        name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : `Loadout ${presets.length + 1}`,
        buffs: validBuffs,
      });
    }
  }

  const alchemyOrder: AlchemyOrder | null =
    raw.alchemyOrder &&
    typeof raw.alchemyOrder === 'object' &&
    typeof raw.alchemyOrder.dateKey === 'string' &&
    Array.isArray(raw.alchemyOrder.requirements)
      ? {
          dateKey: raw.alchemyOrder.dateKey,
          orderIndex: Math.max(0, Math.floor(raw.alchemyOrder.orderIndex ?? 0)),
          requirements: raw.alchemyOrder.requirements,
          rewardCoins: Math.max(10, Math.floor(raw.alchemyOrder.rewardCoins ?? 95)),
          rewardXp: Math.max(10, Math.floor(raw.alchemyOrder.rewardXp ?? 70)),
          completed: Boolean(raw.alchemyOrder.completed),
        }
      : null;

  return {
    labTier,
    mixInventory,
    trophyInventory,
    activeBuffs: uniqueBuffs,
    healedBuffIds,
    totalCrafted: Math.max(0, Math.floor(raw.totalCrafted ?? 0)),
    totalSynergiesActivated: Math.max(0, Math.floor(raw.totalSynergiesActivated ?? 0)),
    presets,
    alchemyOrder,
    completedOrdersCount: Math.max(0, Math.floor(raw.completedOrdersCount ?? 0)),
  };
}

export function getNextSanctuaryLabTier(current: SanctuaryLabTier): SanctuaryLabTier | null {
  if (current === 1) return 2;
  if (current === 2) return 3;
  return null;
}

export function getTotalCropCount(cropInventory: Record<SeedId, number>): number {
  return (
    (cropInventory.PROTEIN_MINT ?? 0) +
    (cropInventory.IRON_BAMBOO ?? 0) +
    (cropInventory.CHILI_PEPPER ?? 0) +
    (cropInventory.GOLDEN_LOTUS ?? 0)
  );
}

export function getTotalTrophyCount(trophyInventory?: Partial<Record<MonsterTrophyId, number>>): number {
  if (!trophyInventory) return 0;
  return MONSTER_TROPHY_ORDER.reduce((sum, id) => sum + (trophyInventory[id] ?? 0), 0);
}

export function getTotalMixCount(mixInventory: Partial<Record<SanctuaryMixId, number>>): number {
  return SANCTUARY_MIX_ORDER.reduce((sum, id) => sum + (mixInventory[id] ?? 0), 0);
}

export function isMixReadyToCraft(
  cropInventory: Record<SeedId, number>,
  blueprint: SanctuaryMixBlueprint,
  trophyInventory: Partial<Record<MonsterTrophyId, number>> = {}
): boolean {
  const cropsOk = blueprint.ingredients.every(
    (req) => (cropInventory[req.seedId] ?? 0) >= req.qty
  );
  if (!cropsOk) return false;

  if (!blueprint.trophyIngredients || blueprint.trophyIngredients.length === 0) {
    return true;
  }

  return blueprint.trophyIngredients.every(
    (req) => (trophyInventory[req.trophyId] ?? 0) >= req.qty
  );
}

export function getMixEffectiveHeal(
  blueprint: SanctuaryMixBlueprint,
  labTier: SanctuaryLabTier
): number {
  if (blueprint.effect.healHp <= 0) return 0;
  const mult = SANCTUARY_LAB_TIERS[labTier]?.healMultiplier ?? 1.0;
  return Math.round(blueprint.effect.healHp * mult);
}

export function getAggregatedSanctuaryBuffs(
  activeBuffs: readonly SanctuaryMixId[],
  labTier: SanctuaryLabTier = 1
): AggregatedSanctuaryBuffs {
  let attackBonus = 0;
  let defenseBonus = 0;
  let critChanceBonus = 0;
  let critMultiplierBonus = 0;
  let comboWindowBonusMs = 0;
  let incomingDamageMultiplier = 1.0;
  let ultimateChargeMultiplier = 1.0;
  let startingUltimateCharge = 0;
  let xpMultiplier = 1.0;
  let coinMultiplier = 1.0;
  let globalDamageMultiplier = 1.0;
  let strengthDamageMultiplier = 1.0;
  let staticDamageMultiplier = 1.0;
  let cardioDamageMultiplier = 1.0;
  let dumbbellDamageBonus = 0;
  let maxHpMultiplier = 1.0;
  let armorPierceRatio = 0;
  let shieldBreakBonus = 0;
  let blockMitigationOverride: number | null = null;
  let toxicCleanseHoldTicksOverride: number | null = null;
  let toxicImmunity = false;
  let toxicCatalystProcDamageBonus = 0;
  let toxicCatalystProcUltCharge = 0;
  let healOnUlt = 0;
  let selfDamageOnUlt = 0;
  let hasRiskyMutagen = false;

  for (const mixId of activeBuffs) {
    const bp = SANCTUARY_MIX_MAP[mixId];
    if (!bp) continue;
    const eff = bp.effect;
    if (bp.isRisky) {
      hasRiskyMutagen = true;
    }

    attackBonus += eff.attackBonus;
    defenseBonus += eff.defenseBonus;
    critChanceBonus += eff.critChanceBonus;
    critMultiplierBonus += eff.critMultiplierBonus ?? 0;
    comboWindowBonusMs += eff.comboWindowBonusMs;
    incomingDamageMultiplier *= eff.incomingDamageMultiplier;
    ultimateChargeMultiplier *= eff.ultimateChargeMultiplier;
    startingUltimateCharge += eff.startingUltimateCharge;
    xpMultiplier *= eff.xpMultiplier;
    coinMultiplier *= eff.coinMultiplier ?? 1.0;
    globalDamageMultiplier *= eff.globalDamageMultiplier ?? 1.0;
    strengthDamageMultiplier *= eff.strengthDamageMultiplier ?? 1.0;
    staticDamageMultiplier *= eff.staticDamageMultiplier ?? 1.0;
    cardioDamageMultiplier *= eff.cardioDamageMultiplier ?? 1.0;
    dumbbellDamageBonus += eff.dumbbellDamageBonus ?? 0;
    maxHpMultiplier *= eff.maxHpMultiplier ?? 1.0;
    armorPierceRatio = Math.min(0.9, armorPierceRatio + (eff.armorPierceRatio ?? 0));
    shieldBreakBonus += eff.shieldBreakBonus ?? 0;

    if (typeof eff.blockMitigationOverride === 'number') {
      blockMitigationOverride =
        blockMitigationOverride === null
          ? eff.blockMitigationOverride
          : Math.max(blockMitigationOverride, eff.blockMitigationOverride);
    }
    if (typeof eff.toxicCleanseHoldTicksOverride === 'number') {
      toxicCleanseHoldTicksOverride =
        toxicCleanseHoldTicksOverride === null
          ? eff.toxicCleanseHoldTicksOverride
          : Math.min(toxicCleanseHoldTicksOverride, eff.toxicCleanseHoldTicksOverride);
    }
    if (eff.toxicImmunity) {
      toxicImmunity = true;
    }
    toxicCatalystProcDamageBonus += eff.toxicCatalystProcDamageBonus ?? 0;
    toxicCatalystProcUltCharge += eff.toxicCatalystProcUltCharge ?? 0;
    healOnUlt += eff.healOnUlt ?? 0;
    selfDamageOnUlt += eff.selfDamageOnUlt ?? 0;
  }

  if (activeBuffs.length > 0) {
    startingUltimateCharge += SANCTUARY_LAB_TIERS[labTier]?.startingUltBonus ?? 0;
  }

  // Apply active slot synergies
  const activeSynergies = getActiveSanctuarySynergies(activeBuffs);
  let startingCombo = 0;
  let thornsReflectDamage = 0;
  let thornsUltChargeGain = 0;
  let ultimateDamageMultiplierOverride: number | null = null;
  let breakAllShieldsOnUlt = false;
  let highComboCritBonus = 0;
  let healOnWaveClear = 0;

  for (const synId of activeSynergies) {
    switch (synId) {
      case 'ISOTONIC_RHYTHM':
        startingCombo = Math.max(startingCombo, 3);
        comboWindowBonusMs += 500;
        break;
      case 'IRON_BASTION':
        thornsReflectDamage += 8;
        thornsUltChargeGain += 10;
        break;
      case 'POWER_SURGE':
        ultimateDamageMultiplierOverride = Math.max(ultimateDamageMultiplierOverride ?? 0, 2.1);
        break;
      case 'ADRENALINE_GUARD':
        incomingDamageMultiplier *= 0.85;
        break;
      case 'PURE_FURY':
        highComboCritBonus += 0.2;
        break;
      case 'ENDLESS_ENDURANCE':
        healOnWaveClear += 10;
        break;
      case 'ALCHEMIST_TRIUMVIRATE':
        globalDamageMultiplier *= 1.12;
        xpMultiplier *= 1.15;
        coinMultiplier *= 1.15;
        break;
    }
  }
  if (activeSynergies.includes('POWER_SURGE')) {
    breakAllShieldsOnUlt = true;
  }

  const round3 = (v: number) => Math.round(v * 1000) / 1000;

  return {
    attackBonus,
    defenseBonus,
    critChanceBonus: round3(critChanceBonus),
    critMultiplierBonus: round3(critMultiplierBonus),
    comboWindowBonusMs,
    incomingDamageMultiplier: round3(incomingDamageMultiplier),
    ultimateChargeMultiplier: round3(ultimateChargeMultiplier),
    startingUltimateCharge: Math.min(100, startingUltimateCharge),
    xpMultiplier: round3(xpMultiplier),
    coinMultiplier: round3(coinMultiplier),
    globalDamageMultiplier: round3(globalDamageMultiplier),
    strengthDamageMultiplier: round3(strengthDamageMultiplier),
    staticDamageMultiplier: round3(staticDamageMultiplier),
    cardioDamageMultiplier: round3(cardioDamageMultiplier),
    dumbbellDamageBonus: round3(dumbbellDamageBonus),
    maxHpMultiplier: round3(maxHpMultiplier),
    armorPierceRatio: round3(armorPierceRatio),
    shieldBreakBonus,
    blockMitigationOverride,
    toxicCleanseHoldTicksOverride,
    toxicImmunity,
    toxicCatalystProcDamageBonus: round3(toxicCatalystProcDamageBonus),
    toxicCatalystProcUltCharge,
    healOnUlt,
    selfDamageOnUlt,
    activeSynergies,
    startingCombo,
    thornsReflectDamage,
    thornsUltChargeGain,
    ultimateDamageMultiplierOverride,
    breakAllShieldsOnUlt,
    highComboCritBonus: round3(highComboCritBonus),
    healOnWaveClear,
    hasRiskyMutagen,
  };
}

export function getSanctuaryDamageMultiplierForExercise(
  buffs: AggregatedSanctuaryBuffs,
  exerciseId?: ExerciseId,
  toxicSurgeBonus: number = 0
): number {
  const discipline = getExerciseDiscipline(exerciseId);
  let mult = buffs.globalDamageMultiplier * (1 + Math.max(0, toxicSurgeBonus));
  if (discipline === 'STRENGTH') {
    mult *= buffs.strengthDamageMultiplier;
  } else if (discipline === 'STATIC') {
    mult *= buffs.staticDamageMultiplier;
  } else if (discipline === 'CARDIO') {
    mult *= buffs.cardioDamageMultiplier;
  }
  return Math.round(mult * 1000) / 1000;
}
