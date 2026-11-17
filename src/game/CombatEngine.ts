/**
 * Combat Engine - Pure RPG logic for damage calculation, combos, matchups,
 * equipment loadouts, ultimate overdrive, shields, crits, XP, leveling, battle ranks, and kcal.
 * ZERO dependencies on React, DOM, or CV logic.
 */

import type {
  BattleRank,
  CombatResult,
  EquipmentLoadout,
  ExerciseMatchup,
  ExerciseTotals,
  Item,
  MonsterStats,
  PlayerStats,
  SanctuaryLabTier,
  SanctuaryMixId,
} from './types';
import { EXERCISES, type ExerciseId } from './data/exercises';
import { getAggregatedSanctuaryBuffs } from './data/sanctuary';
import type { AggregatedTalentModifiers } from './data/talents';
import { getAggregatedArtifactEffects, type AggregatedArtifactEffects } from './data/artifacts';
import type { ArtifactId } from './types';

export const COMBO_WINDOW_BASE_MS = 3800;
export const TOXIC_DEBUFF_DURATION_MS = 6000;
export const TOXIC_DEBUFF_DAMAGE_MULTIPLIER = 0.75;
export const ULTIMATE_CHARGE_MAX = 100;
export const ULTIMATE_DAMAGE_MULTIPLIER = 1.8;
export const DUMBBELL_WEIGHT_OPTIONS = [1, 2, 3, 5, 7.5, 10, 12.5, 15] as const;

/**
 * XP curve: exponential growth.
 * Formula: XP_needed = 100 * level^1.5
 */
export function calculateXPForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

/**
 * Calculate balanced damage bonus from optional real-world dumbbell weight per hand.
 * Applies only when dumbbell mode is active and the exercise supports dumbbells.
 * Capped at 1.60x to preserve campaign challenge.
 */
export function getLoadoutDamageMultiplier(
  loadout?: EquipmentLoadout,
  exerciseId?: ExerciseId
): number {
  if (!loadout || loadout.mode !== 'DUMBBELLS' || loadout.weightKg <= 0) {
    return 1.0;
  }
  if (exerciseId && !EXERCISES[exerciseId]?.supportsDumbbellWeight) {
    return 1.0;
  }
  const bonus = Math.min(0.6, loadout.weightKg * 0.04);
  return Math.round((1 + bonus) * 100) / 100;
}

/**
 * Calculate balanced XP bonus from dumbbell loadout (capped at 1.35x).
 */
export function getLoadoutXpMultiplier(
  loadout?: EquipmentLoadout,
  exerciseId?: ExerciseId
): number {
  if (!loadout || loadout.mode !== 'DUMBBELLS' || loadout.weightKg <= 0) {
    return 1.0;
  }
  if (exerciseId && !EXERCISES[exerciseId]?.supportsDumbbellWeight) {
    return 1.0;
  }
  const bonus = Math.min(0.35, loadout.weightKg * 0.025);
  return Math.round((1 + bonus) * 100) / 100;
}

/**
 * Calculate lifted/held tonnage in kg (2 dumbbells = weightKg * 2).
 * Isometric holds contribute at 0.5x weight factor per second.
 */
export function calculateTonnageDelta(
  exerciseId: ExerciseId | undefined,
  reps: number,
  holdSeconds: number,
  loadout?: EquipmentLoadout
): number {
  if (!exerciseId || !loadout || loadout.mode !== 'DUMBBELLS' || loadout.weightKg <= 0) {
    return 0;
  }
  const def = EXERCISES[exerciseId];
  if (!def?.supportsDumbbellWeight) {
    return 0;
  }
  const pairWeightKg = loadout.weightKg * 2;
  const raw =
    def.trackingType === 'hold'
      ? holdSeconds * pairWeightKg * 0.5
      : reps * pairWeightKg;
  return Math.round(raw * 10) / 10;
}

/**
 * Calculate Ultimate Overdrive meter charge delta from an exercise hit/tick.
 */
export function calculateUltimateChargeGain(params: {
  isHoldTick: boolean;
  comboCount: number;
  chargeMultiplier?: number;
}): number {
  const base = params.isHoldTick ? 12 : 18;
  const comboBonus = Math.min(10, Math.floor(Math.max(0, params.comboCount) / 2) * 2);
  const mult = params.chargeMultiplier ?? 1.0;
  return Math.max(1, Math.round((base + comboBonus) * mult));
}

/**
 * Calculate base damage for an attack.
 * Formula: (playerAttack - monsterDefense) * exerciseMultiplier
 * Minimum damage: 1
 */
export function calculateBaseDamage(
  playerAttack: number,
  monsterDefense: number,
  exerciseMultiplier: number
): number {
  const rawDamage = (playerAttack - monsterDefense) * exerciseMultiplier;
  return Math.max(1, Math.floor(rawDamage));
}

/**
 * Combo multiplier tier based on consecutive reps within tempo window.
 */
export function getComboMultiplier(comboCount: number): number {
  if (comboCount >= 10) return 2.0;
  if (comboCount >= 6) return 1.5;
  if (comboCount >= 3) return 1.25;
  return 1.0;
}

/**
 * Evaluate exercise affinity against a monster's weaknesses and resistances.
 */
export function getExerciseMatchup(
  monster: Pick<MonsterStats, 'weakTo' | 'resistantTo'>,
  exerciseId?: ExerciseId
): ExerciseMatchup {
  if (!exerciseId) return 'NEUTRAL';
  if (monster.weakTo === exerciseId) return 'WEAK';
  if (monster.resistantTo === exerciseId) return 'RESISTANT';
  return 'NEUTRAL';
}

export function getMatchupMultiplier(matchup: ExerciseMatchup): number {
  if (matchup === 'WEAK') return 1.5;
  if (matchup === 'RESISTANT') return 0.75;
  return 1.0;
}

/**
 * Roll for critical hit.
 * @returns true if crit lands
 */
export function rollCritical(critChance: number): boolean {
  return Math.random() < critChance;
}

export interface CombatAttackOptions {
  comboCount?: number;
  exerciseId?: ExerciseId;
  isDebuffed?: boolean;
  loadout?: EquipmentLoadout;
  isUltimate?: boolean;
  xpMultiplier?: number;
  sanctuaryDamageMultiplier?: number;
  armorPierceRatio?: number;
  shieldBreakBonus?: number;
  breakAllShieldsOnUlt?: boolean;
  ultimateDamageMultiplier?: number;
  extraCritChance?: number;
  dumbbellDamageBonus?: number;
  executeBonusRatio?: number;
}

/**
 * Apply damage to monster, return updated monster and combat result.
 * Handles base damage, combo multiplier, exercise affinity, equipment loadout,
 * toxic debuff, Ultimate Overdrive strike, active armor/boss shields, critical hits,
 * Sanctuary mix bonuses, monster death, XP gain, and level up.
 */
export function applyDamageToMonster(
  player: PlayerStats,
  monster: MonsterStats,
  exerciseMultiplier: number,
  options: CombatAttackOptions = {}
): { monster: MonsterStats; player: PlayerStats; result: CombatResult } {
  const comboMultiplier = getComboMultiplier(options.comboCount ?? 0);
  const matchup = getExerciseMatchup(monster, options.exerciseId);
  const matchupMultiplier = getMatchupMultiplier(matchup);
  const debuffMultiplier = options.isDebuffed ? TOXIC_DEBUFF_DAMAGE_MULTIPLIER : 1.0;
  const rawLoadoutMultiplier = getLoadoutDamageMultiplier(options.loadout, options.exerciseId);
  const loadoutMultiplier =
    rawLoadoutMultiplier > 1 && (options.dumbbellDamageBonus ?? 0) > 0
      ? Math.round((rawLoadoutMultiplier + (options.dumbbellDamageBonus ?? 0)) * 1000) / 1000
      : rawLoadoutMultiplier;
  const wasUltimate = Boolean(options.isUltimate);
  const ultimateMultiplier = wasUltimate
    ? (options.ultimateDamageMultiplier ?? ULTIMATE_DAMAGE_MULTIPLIER)
    : 1.0;
  const sanctuaryDamageMultiplier = options.sanctuaryDamageMultiplier ?? 1.0;
  const armorPierceRatio = Math.min(0.9, Math.max(0, options.armorPierceRatio ?? 0));
  const effectiveMonsterDefense = Math.floor(monster.defense * (1 - armorPierceRatio));

  const executeMultiplier =
    (options.executeBonusRatio ?? 0) > 0 && monster.maxHp > 0 && monster.hp / monster.maxHp <= 0.3
      ? 1 + (options.executeBonusRatio ?? 0)
      : 1.0;

  // Calculate base + tactical damage
  let damage = calculateBaseDamage(player.attack, effectiveMonsterDefense, exerciseMultiplier);
  damage = Math.max(
    1,
    Math.floor(
      damage *
        comboMultiplier *
        matchupMultiplier *
        debuffMultiplier *
        loadoutMultiplier *
        ultimateMultiplier *
        sanctuaryDamageMultiplier *
        executeMultiplier
    )
  );

  // Roll for crit
  const effectiveCritChance = Math.min(1, Math.max(0, player.critChance + (options.extraCritChance ?? 0)));
  const isCrit = rollCritical(effectiveCritChance);
  if (isCrit) {
    damage = Math.floor(damage * player.critMultiplier);
  }

  // Handle enemy shield hits (armored mobs & boss rage shields)
  let currentShieldHits = monster.shieldHits ?? 0;
  let shieldHit = false;
  let shieldBroken = false;

  if (currentShieldHits > 0) {
    shieldHit = true;
    const isStaticHold = options.exerciseId
      ? EXERCISES[options.exerciseId]?.trackingType === 'hold'
      : false;
    if (wasUltimate && options.breakAllShieldsOnUlt) {
      currentShieldHits = 0;
      shieldBroken = true;
    } else {
      let shieldBreakPower = matchup === 'WEAK' || isCrit ? 2 : 1;
      if (wasUltimate || (isStaticHold && loadoutMultiplier > 1)) {
        shieldBreakPower += 1;
      }
      shieldBreakPower += options.shieldBreakBonus ?? 0;
      currentShieldHits = Math.max(0, currentShieldHits - shieldBreakPower);
      shieldBroken = currentShieldHits === 0;
    }
    damage = Math.max(1, Math.floor(damage * (wasUltimate ? 0.5 : 0.25)));
  }

  // Apply damage to monster
  const newMonsterHp = Math.max(0, monster.hp - damage);
  const isKilled = newMonsterHp === 0;

  // XP and level up logic
  let xpGained = 0;
  let leveledUp = false;
  let updatedPlayer = { ...player };

  if (isKilled) {
    const xpMult =
      getLoadoutXpMultiplier(options.loadout, options.exerciseId) * (options.xpMultiplier ?? 1.0);
    xpGained = Math.round(monster.xpReward * xpMult);
    updatedPlayer.xp += xpGained;

    while (updatedPlayer.xp >= updatedPlayer.xpToNextLevel) {
      updatedPlayer = levelUp(updatedPlayer);
      leveledUp = true;
    }
  }

  const result: CombatResult = {
    damageDealt: damage,
    wasCritical: isCrit,
    wasUltimate,
    targetKilled: isKilled,
    playerLeveledUp: leveledUp,
    xpGained,
    matchup,
    comboMultiplier,
    loadoutMultiplier,
    shieldHit,
    shieldBroken,
  };

  const updatedMonster: MonsterStats = {
    ...monster,
    hp: newMonsterHp,
    shieldHits: currentShieldHits > 0 || monster.maxShieldHits ? currentShieldHits : undefined,
  };

  return {
    monster: updatedMonster,
    player: updatedPlayer,
    result,
  };
}

/**
 * Apply boss phase transition abilities (e.g. Grease Shield at Phase 1).
 */
export function applyBossPhaseTransition(
  monster: MonsterStats,
  previousPhase: number,
  nextPhase: number
): MonsterStats {
  if (!monster.isBoss || nextPhase <= previousPhase) {
    return monster;
  }

  if (nextPhase === 1) {
    return {
      ...monster,
      shieldHits: 2,
      maxShieldHits: 2,
    };
  }

  return monster;
}

/**
 * Level up the player: increase stats and recalculate XP threshold.
 */
export function levelUp(player: PlayerStats): PlayerStats {
  const newLevel = player.level + 1;
  const xpToNextLevel = calculateXPForLevel(newLevel);

  return {
    ...player,
    level: newLevel,
    xp: player.xp - player.xpToNextLevel, // Carry over excess XP
    xpToNextLevel,
    maxHp: player.maxHp + 10, // +10 HP per level
    hp: player.hp + 10, // Restore +10 HP on level up
    attack: player.attack + 2, // +2 attack per level
    defense: player.defense + 1, // +1 defense per level
  };
}

/**
 * Apply damage to player (from monster counter-attack or phase mechanic).
 */
export function applyDamageToPlayer(
  player: PlayerStats,
  monsterAttack: number
): PlayerStats {
  const damage = Math.max(1, monsterAttack - player.defense);
  const newHp = Math.max(0, player.hp - damage);

  return {
    ...player,
    hp: newHp,
  };
}

/**
 * Check if player is dead.
 */
export function isPlayerDead(player: PlayerStats): boolean {
  return player.hp <= 0;
}

/**
 * Check if monster is dead.
 */
export function isMonsterDead(monster: MonsterStats): boolean {
  return monster.hp <= 0;
}

/**
 * Get current boss phase based on HP percentage.
 * Returns phase index (0 = normal, 1 = first threshold, etc.)
 */
export function getBossPhase(monster: MonsterStats): number {
  if (!monster.isBoss || !monster.phaseThresholds) {
    return 0;
  }

  const hpPercent = monster.hp / monster.maxHp;

  for (let i = monster.phaseThresholds.length - 1; i >= 0; i--) {
    if (hpPercent <= monster.phaseThresholds[i]) {
      return i + 1;
    }
  }

  return 0;
}

/**
 * Create a fresh player character with starting stats.
 */
export function createPlayer(): PlayerStats {
  return {
    level: 1,
    xp: 0,
    xpToNextLevel: calculateXPForLevel(1), // 100
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 5,
    critChance: 0.15, // 15%
    critMultiplier: 1.5, // 1.5x damage on crit
  };
}

/**
 * Compute effective player stats including equipped item bonuses and active Sanctuary mixes.
 */
export function getEffectivePlayerStats(
  player: PlayerStats,
  equippedItemIds: string[],
  itemsCatalog: Record<string, Item>,
  activeSanctuaryBuffs: readonly SanctuaryMixId[] = [],
  labTier: SanctuaryLabTier = 1,
  talentModifiers?: Partial<AggregatedTalentModifiers>,
  equippedArtifactIds: readonly ArtifactId[] = [],
  mutatorDefenseDelta: number = 0
): PlayerStats {
  const sanctuaryBonuses = getAggregatedSanctuaryBuffs(activeSanctuaryBuffs, labTier);
  const artifactBonuses: AggregatedArtifactEffects =
    equippedArtifactIds.length > 0
      ? getAggregatedArtifactEffects(equippedArtifactIds)
      : {
          attackBonus: 0,
          defenseBonus: 0,
          maxHpBonus: 0,
          critChanceBonus: 0,
          critMultiplierBonus: 0,
          executeBonusRatio: 0,
          healOnOverdrive: 0,
          shieldBreakBonus: 0,
          thornsReflectDamage: 0,
          ultimateChargeMultiplier: 1.0,
          comboWindowBonusMs: 0,
        };

  let attackBonus =
    sanctuaryBonuses.attackBonus +
    (talentModifiers?.attackBonus ?? 0) +
    artifactBonuses.attackBonus;
  let defenseBonus =
    sanctuaryBonuses.defenseBonus +
    (talentModifiers?.defenseBonus ?? 0) +
    artifactBonuses.defenseBonus +
    mutatorDefenseDelta;
  let maxHpBonus = (talentModifiers?.maxHpBonus ?? 0) + artifactBonuses.maxHpBonus;
  let critChanceBonus =
    sanctuaryBonuses.critChanceBonus +
    (talentModifiers?.critChanceBonus ?? 0) +
    artifactBonuses.critChanceBonus;
  let comboWindowBonusMs =
    (player.comboWindowBonusMs ?? 0) +
    sanctuaryBonuses.comboWindowBonusMs +
    (talentModifiers?.comboWindowBonusMs ?? 0) +
    artifactBonuses.comboWindowBonusMs;

  for (const itemId of equippedItemIds) {
    const item = itemsCatalog[itemId];
    if (!item || item.type !== 'EQUIPMENT' || !item.stats) {
      continue;
    }
    attackBonus += item.stats.attack ?? 0;
    defenseBonus += item.stats.defense ?? 0;
    maxHpBonus += item.stats.maxHp ?? 0;
    critChanceBonus += item.stats.critChance ?? 0;
    comboWindowBonusMs += item.stats.comboWindowBonusMs ?? 0;
  }

  const baseMaxHp = player.maxHp + maxHpBonus;
  const scaledMaxHp = Math.max(10, Math.round(baseMaxHp * sanctuaryBonuses.maxHpMultiplier));
  const critMultiplierBonus =
    sanctuaryBonuses.critMultiplierBonus +
    (talentModifiers?.critMultiplierBonus ?? 0) +
    artifactBonuses.critMultiplierBonus;

  return {
    ...player,
    attack: Math.max(1, player.attack + attackBonus),
    defense: Math.max(0, player.defense + defenseBonus),
    maxHp: scaledMaxHp,
    hp: Math.min(player.hp, scaledMaxHp),
    critChance: Math.min(1, Math.max(0, player.critChance + critChanceBonus)),
    critMultiplier: Math.round((player.critMultiplier + critMultiplierBonus) * 100) / 100,
    comboWindowBonusMs,
  };
}

/**
 * Apply a consumable item's healing effect to the player.
 */
export function useConsumableItem(player: PlayerStats, item: Item): PlayerStats {
  if (item.type !== 'CONSUMABLE' || !item.effect?.hpRestore) {
    return player;
  }

  return {
    ...player,
    hp: Math.min(player.maxHp, player.hp + item.effect.hpRestore),
  };
}

/**
 * Roll for an item drop from a level's drop table.
 */
export function rollItemDrop(
  dropTable: ReadonlyArray<{ itemId: string; chance: number }>,
  rng: () => number = Math.random
): string | null {
  for (const entry of dropTable) {
    if (rng() < entry.chance) {
      return entry.itemId;
    }
  }
  return null;
}

/**
 * Calculate incoming damage from a monster counter-attack.
 * Active static hold (isBlocking = true) mitigates 70% of monster attack power.
 * Optional incomingDamageMultiplier (e.g. from Sanctuary Bamboo Fortifier) further reduces damage.
 */
export function calculateMonsterCounterAttack(
  player: PlayerStats,
  monsterAttack: number,
  isBlocking: boolean,
  incomingDamageMultiplier: number = 1.0,
  blockMitigation: number = 0.7
): { player: PlayerStats; damageTaken: number; wasBlocked: boolean } {
  const mult = Math.max(0, incomingDamageMultiplier);

  if (isBlocking) {
    const clampedMitigation = Math.min(0.95, Math.max(0, blockMitigation));
    const mitigatedAttack = Math.floor(
      Math.round(monsterAttack * (1 - clampedMitigation) * 1000) / 1000
    );
    const rawBlocked = Math.max(0, mitigatedAttack - player.defense);
    const damageTaken = Math.max(0, Math.floor(rawBlocked * mult));
    return {
      player: {
        ...player,
        hp: Math.max(0, player.hp - damageTaken),
      },
      damageTaken,
      wasBlocked: true,
    };
  }

  const baseDamage = Math.max(1, monsterAttack - player.defense);
  const damageTaken = Math.max(1, Math.floor(baseDamage * mult));
  const newHp = Math.max(0, player.hp - damageTaken);
  return {
    player: {
      ...player,
      hp: newHp,
    },
    damageTaken: player.hp - newHp,
    wasBlocked: false,
  };
}

/**
 * Get time between monster counter-attacks in ms.
 * Fast enemies use custom intervals; bosses attack faster as they enter enraged phases.
 */
export function getMonsterAttackIntervalMs(monster: MonsterStats): number {
  if (!monster.isBoss) {
    return monster.attackIntervalMs ?? 7000;
  }
  const phase = getBossPhase(monster);
  if (phase >= 2) return 4000;
  if (phase === 1) return 5000;
  return 6000;
}

/**
 * Duration (in ms) before a monster strike when warning telegraph activates.
 */
export const ATTACK_WARNING_WINDOW_MS = 1500;

/**
 * Check whether the enemy counter-attack warning telegraph is active for the current cycle.
 */
export function isMonsterAttackWarningActive(
  elapsedMs: number,
  intervalMs: number,
  warningWindowMs: number = ATTACK_WARNING_WINDOW_MS
): boolean {
  if (intervalMs <= 0 || warningWindowMs <= 0) {
    return false;
  }
  const warningThreshold = Math.max(0, intervalMs - warningWindowMs);
  return elapsedMs >= warningThreshold && elapsedMs < intervalMs;
}

/**
 * Calculate end-of-battle grade (S / A / B / C) from damage taken, combo peak, and duration.
 */
export function calculateBattleRank(params: {
  damageTaken: number;
  playerMaxHp: number;
  maxCombo: number;
  durationSec: number;
}): { rank: BattleRank; rewardMultiplier: number } {
  const safeMaxHp = Math.max(1, params.playerMaxHp);
  const hpLossRatio = params.damageTaken / safeMaxHp;

  let score = 0;
  if (hpLossRatio <= 0.1) score += 45;
  else if (hpLossRatio <= 0.3) score += 30;
  else if (hpLossRatio <= 0.6) score += 15;

  if (params.maxCombo >= 8) score += 35;
  else if (params.maxCombo >= 4) score += 22;
  else if (params.maxCombo >= 2) score += 10;

  if (params.durationSec <= 40) score += 20;
  else if (params.durationSec <= 75) score += 12;
  else score += 5;

  if (score >= 80) return { rank: 'S', rewardMultiplier: 1.3 };
  if (score >= 55) return { rank: 'A', rewardMultiplier: 1.15 };
  if (score >= 30) return { rank: 'B', rewardMultiplier: 1.0 };
  return { rank: 'C', rewardMultiplier: 1.0 };
}

/**
 * Approximate kcal expenditure from tracked reps, hold seconds, and optional dumbbell weight.
 */
export function estimateWorkoutKcal(
  totals: Partial<Record<ExerciseId, Partial<ExerciseTotals>>>,
  loadoutWeightKg: number = 0
): number {
  const weightFactor = loadoutWeightKg > 0 ? 1 + Math.min(0.45, loadoutWeightKg * 0.03) : 1.0;

  const squats = (totals.SQUAT?.reps ?? 0) * 0.35 * weightFactor;
  const pushups = (totals.PUSH_UP?.reps ?? 0) * 0.45;
  const jacks = (totals.JUMPING_JACK?.reps ?? 0) * 0.25;
  const overhead = (totals.OVERHEAD_PRESS?.reps ?? 0) * 0.4 * weightFactor;
  const lunges = (totals.LUNGE?.reps ?? 0) * 0.42 * weightFactor;
  const highKnees = (totals.HIGH_KNEES?.reps ?? 0) * 0.28;
  const frontRaises = (totals.FRONT_RAISE?.reps ?? 0) * 0.34 * weightFactor;
  const plank = (totals.PLANK?.holdSeconds ?? 0) * 0.08;
  const armHold = (totals.ARM_HOLD?.holdSeconds ?? 0) * 0.09 * weightFactor;
  const wallSit = (totals.WALL_SIT?.holdSeconds ?? 0) * 0.11;

  return (
    Math.round(
      (squats + pushups + jacks + overhead + lunges + highKnees + frontRaises + plank + armHold + wallSit) * 10
    ) / 10
  );
}
