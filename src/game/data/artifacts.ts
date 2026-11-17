/**
 * Dedicated 2-Slot Endgame Artifact System (isolated from shop/bag equipment ITEMS).
 * Artifacts unlock through Endless Arena milestones, Weekly Challenges, and Circuits.
 * ZERO React, DOM, or Vision imports allowed.
 */

import type { ArtifactId, ArtifactState, ItemRarity } from '../types';

export const MAX_EQUIPPED_ARTIFACTS = 2;

export interface ArtifactDefinition {
  id: ArtifactId;
  icon: string;
  rarity: ItemRarity;
  unlockWave?: number;
  unlockViaWeekly?: boolean;
  unlockViaCircuit?: boolean;
  attackBonus: number;
  defenseBonus: number;
  maxHpBonus: number;
  critChanceBonus: number;
  critMultiplierBonus: number;
  executeBonusRatio: number; // extra damage ratio when target < 30% HP
  healOnOverdrive: number;
  shieldBreakBonus: number;
  thornsReflectDamage: number;
  ultimateChargeMultiplier: number;
  comboWindowBonusMs: number;
}

export const ARTIFACT_ORDER: readonly ArtifactId[] = [
  'PHOENIX_BAND',
  'TITAN_CORE',
  'BERSERKER_SIGIL',
  'VAMPIRIC_FANG',
  'SHIELD_BREAKER_PRISM',
  'CHRONO_HOURGLASS',
];

export const ARTIFACTS: Record<ArtifactId, ArtifactDefinition> = {
  PHOENIX_BAND: {
    id: 'PHOENIX_BAND',
    icon: '🔥',
    rarity: 'RARE',
    unlockWave: 5,
    attackBonus: 2,
    defenseBonus: 1,
    maxHpBonus: 20,
    critChanceBonus: 0,
    critMultiplierBonus: 0,
    executeBonusRatio: 0,
    healOnOverdrive: 12,
    shieldBreakBonus: 0,
    thornsReflectDamage: 0,
    ultimateChargeMultiplier: 1.0,
    comboWindowBonusMs: 0,
  },
  TITAN_CORE: {
    id: 'TITAN_CORE',
    icon: '🛡️',
    rarity: 'EPIC',
    unlockWave: 10,
    attackBonus: 1,
    defenseBonus: 4,
    maxHpBonus: 35,
    critChanceBonus: 0,
    critMultiplierBonus: 0,
    executeBonusRatio: 0,
    healOnOverdrive: 0,
    shieldBreakBonus: 0,
    thornsReflectDamage: 10,
    ultimateChargeMultiplier: 1.0,
    comboWindowBonusMs: 0,
  },
  BERSERKER_SIGIL: {
    id: 'BERSERKER_SIGIL',
    icon: '⚔️',
    rarity: 'EPIC',
    unlockWave: 15,
    attackBonus: 5,
    defenseBonus: 0,
    maxHpBonus: 0,
    critChanceBonus: 0.08,
    critMultiplierBonus: 0.25,
    executeBonusRatio: 0.25,
    healOnOverdrive: 0,
    shieldBreakBonus: 0,
    thornsReflectDamage: 0,
    ultimateChargeMultiplier: 1.0,
    comboWindowBonusMs: 0,
  },
  SHIELD_BREAKER_PRISM: {
    id: 'SHIELD_BREAKER_PRISM',
    icon: '💎',
    rarity: 'LEGENDARY',
    unlockWave: 20,
    attackBonus: 4,
    defenseBonus: 2,
    maxHpBonus: 15,
    critChanceBonus: 0.05,
    critMultiplierBonus: 0,
    executeBonusRatio: 0.15,
    healOnOverdrive: 0,
    shieldBreakBonus: 1,
    thornsReflectDamage: 0,
    ultimateChargeMultiplier: 1.1,
    comboWindowBonusMs: 0,
  },
  CHRONO_HOURGLASS: {
    id: 'CHRONO_HOURGLASS',
    icon: '⏳',
    rarity: 'RARE',
    unlockViaCircuit: true,
    attackBonus: 2,
    defenseBonus: 1,
    maxHpBonus: 10,
    critChanceBonus: 0.04,
    critMultiplierBonus: 0,
    executeBonusRatio: 0,
    healOnOverdrive: 0,
    shieldBreakBonus: 0,
    thornsReflectDamage: 0,
    ultimateChargeMultiplier: 1.2,
    comboWindowBonusMs: 700,
  },
  VAMPIRIC_FANG: {
    id: 'VAMPIRIC_FANG',
    icon: '🦇',
    rarity: 'LEGENDARY',
    unlockViaWeekly: true,
    attackBonus: 4,
    defenseBonus: 1,
    maxHpBonus: 20,
    critChanceBonus: 0.06,
    critMultiplierBonus: 0.2,
    executeBonusRatio: 0.2,
    healOnOverdrive: 8,
    shieldBreakBonus: 0,
    thornsReflectDamage: 0,
    ultimateChargeMultiplier: 1.1,
    comboWindowBonusMs: 0,
  },
};

export function createInitialArtifactState(): ArtifactState {
  return {
    unlockedIds: [],
    equippedIds: [],
  };
}

function isValidArtifactId(val: unknown): val is ArtifactId {
  return typeof val === 'string' && val in ARTIFACTS;
}

export function normalizeArtifactState(raw?: Partial<ArtifactState>): ArtifactState {
  if (!raw || typeof raw !== 'object') {
    return createInitialArtifactState();
  }
  const unlockedSet = new Set<ArtifactId>();
  if (Array.isArray(raw.unlockedIds)) {
    for (const id of raw.unlockedIds) {
      if (isValidArtifactId(id)) unlockedSet.add(id);
    }
  }
  const equippedIds: ArtifactId[] = [];
  if (Array.isArray(raw.equippedIds)) {
    for (const id of raw.equippedIds) {
      if (
        isValidArtifactId(id) &&
        unlockedSet.has(id) &&
        !equippedIds.includes(id) &&
        equippedIds.length < MAX_EQUIPPED_ARTIFACTS
      ) {
        equippedIds.push(id);
      }
    }
  }
  return {
    unlockedIds: Array.from(unlockedSet),
    equippedIds,
  };
}

export interface AggregatedArtifactEffects {
  attackBonus: number;
  defenseBonus: number;
  maxHpBonus: number;
  critChanceBonus: number;
  critMultiplierBonus: number;
  executeBonusRatio: number;
  healOnOverdrive: number;
  shieldBreakBonus: number;
  thornsReflectDamage: number;
  ultimateChargeMultiplier: number;
  comboWindowBonusMs: number;
}

export function getAggregatedArtifactEffects(
  equippedIds: readonly ArtifactId[] = []
): AggregatedArtifactEffects {
  let attackBonus = 0;
  let defenseBonus = 0;
  let maxHpBonus = 0;
  let critChanceBonus = 0;
  let critMultiplierBonus = 0;
  let executeBonusRatio = 0;
  let healOnOverdrive = 0;
  let shieldBreakBonus = 0;
  let thornsReflectDamage = 0;
  let ultimateChargeMultiplier = 1.0;
  let comboWindowBonusMs = 0;

  for (const id of equippedIds) {
    const def = ARTIFACTS[id];
    if (!def) continue;
    attackBonus += def.attackBonus;
    defenseBonus += def.defenseBonus;
    maxHpBonus += def.maxHpBonus;
    critChanceBonus += def.critChanceBonus;
    critMultiplierBonus += def.critMultiplierBonus;
    executeBonusRatio += def.executeBonusRatio;
    healOnOverdrive += def.healOnOverdrive;
    shieldBreakBonus += def.shieldBreakBonus;
    thornsReflectDamage += def.thornsReflectDamage;
    ultimateChargeMultiplier *= def.ultimateChargeMultiplier;
    comboWindowBonusMs += def.comboWindowBonusMs;
  }

  return {
    attackBonus,
    defenseBonus,
    maxHpBonus,
    critChanceBonus: Math.round(critChanceBonus * 1000) / 1000,
    critMultiplierBonus: Math.round(critMultiplierBonus * 100) / 100,
    executeBonusRatio: Math.round(executeBonusRatio * 100) / 100,
    healOnOverdrive,
    shieldBreakBonus,
    thornsReflectDamage,
    ultimateChargeMultiplier: Math.round(ultimateChargeMultiplier * 1000) / 1000,
    comboWindowBonusMs,
  };
}

export function getArtifactUnlockForWave(wave: number): ArtifactId | null {
  if (wave >= 20) return 'SHIELD_BREAKER_PRISM';
  if (wave >= 15) return 'BERSERKER_SIGIL';
  if (wave >= 10) return 'TITAN_CORE';
  if (wave >= 5) return 'PHOENIX_BAND';
  return null;
}
