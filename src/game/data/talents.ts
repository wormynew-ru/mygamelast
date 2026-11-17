/**
 * 3-Branch Hero Talent Tree: MIGHT, BASTION, BOTANY.
 * Earn 1 talent point per hero level beyond Level 1.
 * ZERO React, DOM, or Vision imports allowed.
 */

import type { PlayerTalentState, TalentBranch, TalentId } from '../types';

export interface TalentDefinition {
  id: TalentId;
  branch: TalentBranch;
  tier: 1 | 2 | 3;
  icon: string;
  maxRank: number;
  prerequisiteId?: TalentId;
  /** Minimum rank required on prerequisite node (default: 1) */
  prerequisiteRank?: number;
}

export const TALENT_RESPEC_COST = 100;

export const TALENT_BRANCH_ORDER: readonly TalentBranch[] = ['MIGHT', 'BASTION', 'BOTANY'];

export const TALENTS: readonly TalentDefinition[] = [
  // === MIGHT BRANCH (Offense & Overdrive) ===
  {
    id: 'MIGHT_STRIKE',
    branch: 'MIGHT',
    tier: 1,
    icon: '⚔️',
    maxRank: 3,
  },
  {
    id: 'MIGHT_CRIT_EDGE',
    branch: 'MIGHT',
    tier: 2,
    icon: '🎯',
    maxRank: 3,
    prerequisiteId: 'MIGHT_STRIKE',
  },
  {
    id: 'MIGHT_EXECUTIONER',
    branch: 'MIGHT',
    tier: 2,
    icon: '💀',
    maxRank: 2,
    prerequisiteId: 'MIGHT_STRIKE',
  },
  {
    id: 'MIGHT_OVERDRIVE',
    branch: 'MIGHT',
    tier: 3,
    icon: '💥',
    maxRank: 2,
    prerequisiteId: 'MIGHT_CRIT_EDGE',
  },

  // === BASTION BRANCH (Defense, Vitality & Tempo) ===
  {
    id: 'BASTION_VITALITY',
    branch: 'BASTION',
    tier: 1,
    icon: '❤️',
    maxRank: 3,
  },
  {
    id: 'BASTION_AEGIS',
    branch: 'BASTION',
    tier: 2,
    icon: '🛡️',
    maxRank: 3,
    prerequisiteId: 'BASTION_VITALITY',
  },
  {
    id: 'BASTION_TEMPO',
    branch: 'BASTION',
    tier: 2,
    icon: '⏱️',
    maxRank: 2,
    prerequisiteId: 'BASTION_VITALITY',
  },
  {
    id: 'BASTION_THORNS',
    branch: 'BASTION',
    tier: 3,
    icon: '🔱',
    maxRank: 2,
    prerequisiteId: 'BASTION_AEGIS',
  },

  // === BOTANY BRANCH (Rewards, Garden & Alchemy) ===
  {
    id: 'BOTANY_SCHOLAR',
    branch: 'BOTANY',
    tier: 1,
    icon: '📘',
    maxRank: 3,
  },
  {
    id: 'BOTANY_FORTUNE',
    branch: 'BOTANY',
    tier: 2,
    icon: '🪙',
    maxRank: 3,
    prerequisiteId: 'BOTANY_SCHOLAR',
  },
  {
    id: 'BOTANY_GREEN_THUMB',
    branch: 'BOTANY',
    tier: 2,
    icon: '🌱',
    maxRank: 2,
    prerequisiteId: 'BOTANY_SCHOLAR',
  },
  {
    id: 'BOTANY_ALCHEMIST',
    branch: 'BOTANY',
    tier: 3,
    icon: '⚗️',
    maxRank: 2,
    prerequisiteId: 'BOTANY_FORTUNE',
  },
];

export const TALENT_MAP: Record<TalentId, TalentDefinition> = TALENTS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<TalentId, TalentDefinition>
);

export function createInitialTalentState(): PlayerTalentState {
  return {
    ranks: {},
    spentPoints: 0,
  };
}

export function getTotalTalentPointsForLevel(level: number): number {
  return Math.max(0, Math.floor(level) - 1);
}

export function normalizeTalentState(
  raw: Partial<PlayerTalentState> | undefined,
  heroLevel: number
): PlayerTalentState {
  const maxAllowed = getTotalTalentPointsForLevel(heroLevel);
  if (!raw || typeof raw !== 'object' || !raw.ranks || typeof raw.ranks !== 'object') {
    return createInitialTalentState();
  }

  const ranks: Partial<Record<TalentId, number>> = {};
  let totalSpent = 0;

  // Iterate in definition order so prerequisites validate cleanly
  for (const def of TALENTS) {
    const rawRank = Math.max(0, Math.floor(raw.ranks[def.id] ?? 0));
    const capped = Math.min(def.maxRank, rawRank);
    if (capped <= 0) continue;
    if (def.prerequisiteId && (ranks[def.prerequisiteId] ?? 0) < (def.prerequisiteRank ?? 1)) {
      continue;
    }
    const remainingBudget = Math.max(0, maxAllowed - totalSpent);
    const finalRank = Math.min(capped, remainingBudget);
    if (finalRank > 0) {
      ranks[def.id] = finalRank;
      totalSpent += finalRank;
    }
  }

  return {
    ranks,
    spentPoints: totalSpent,
  };
}

export function getAvailableTalentPoints(heroLevel: number, state: PlayerTalentState): number {
  return Math.max(0, getTotalTalentPointsForLevel(heroLevel) - state.spentPoints);
}

export function canUpgradeTalent(
  heroLevel: number,
  state: PlayerTalentState,
  talentId: TalentId
): boolean {
  const def = TALENT_MAP[talentId];
  if (!def) return false;
  if (getAvailableTalentPoints(heroLevel, state) <= 0) return false;

  const currentRank = state.ranks[talentId] ?? 0;
  if (currentRank >= def.maxRank) return false;

  if (def.prerequisiteId) {
    const prereqRank = state.ranks[def.prerequisiteId] ?? 0;
    if (prereqRank < (def.prerequisiteRank ?? 1)) {
      return false;
    }
  }

  return true;
}

export interface AggregatedTalentModifiers {
  attackBonus: number;
  defenseBonus: number;
  maxHpBonus: number;
  critChanceBonus: number;
  critMultiplierBonus: number;
  executeDamageBonus: number; // Bonus multiplier when enemy HP <= 30%
  ultimateChargeMultiplier: number;
  comboWindowBonusMs: number;
  thornsDamageOnBlock: number;
  xpMultiplier: number;
  coinMultiplier: number;
  gardenMutationBonusChance: number;
  sanctuaryCraftBonusChance: number;
}

export function getAggregatedTalentModifiers(state?: PlayerTalentState): AggregatedTalentModifiers {
  const ranks = state?.ranks ?? {};
  const r = (id: TalentId) => Math.max(0, ranks[id] ?? 0);

  return {
    attackBonus: r('MIGHT_STRIKE') * 2,
    defenseBonus: r('BASTION_AEGIS') * 2,
    maxHpBonus: r('BASTION_VITALITY') * 15,
    critChanceBonus: Math.round(r('MIGHT_CRIT_EDGE') * 0.04 * 1000) / 1000,
    critMultiplierBonus: Math.round(r('MIGHT_OVERDRIVE') * 0.15 * 100) / 100,
    executeDamageBonus: Math.round(r('MIGHT_EXECUTIONER') * 0.18 * 100) / 100,
    ultimateChargeMultiplier: Math.round((1 + r('MIGHT_OVERDRIVE') * 0.12) * 1000) / 1000,
    comboWindowBonusMs: r('BASTION_TEMPO') * 450,
    thornsDamageOnBlock: r('BASTION_THORNS') * 6,
    xpMultiplier: Math.round((1 + r('BOTANY_SCHOLAR') * 0.08) * 1000) / 1000,
    coinMultiplier: Math.round((1 + r('BOTANY_FORTUNE') * 0.1) * 1000) / 1000,
    gardenMutationBonusChance: Math.round(r('BOTANY_GREEN_THUMB') * 0.08 * 1000) / 1000,
    sanctuaryCraftBonusChance: Math.round(r('BOTANY_ALCHEMIST') * 0.15 * 1000) / 1000,
  };
}
