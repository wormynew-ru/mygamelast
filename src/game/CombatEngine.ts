/**
 * Combat Engine - Pure RPG logic for damage calculation, crits, XP, leveling.
 * ZERO dependencies on React, DOM, or CV logic.
 */

import type { PlayerStats, MonsterStats, CombatResult, Item } from './types';

/**
 * XP curve: exponential growth.
 * Formula: XP_needed = 100 * level^1.5
 */
export function calculateXPForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
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
 * Roll for critical hit.
 * @returns true if crit lands
 */
export function rollCritical(critChance: number): boolean {
  return Math.random() < critChance;
}

/**
 * Apply damage to monster, return updated monster and combat result.
 * Handles:
 * - Damage calculation
 * - Critical hits
 * - Monster death
 * - XP gain and level up
 */
export function applyDamageToMonster(
  player: PlayerStats,
  monster: MonsterStats,
  exerciseMultiplier: number
): { monster: MonsterStats; player: PlayerStats; result: CombatResult } {
  // Calculate base damage
  let damage = calculateBaseDamage(player.attack, monster.defense, exerciseMultiplier);

  // Roll for crit
  const isCrit = rollCritical(player.critChance);
  if (isCrit) {
    damage = Math.floor(damage * player.critMultiplier);
  }

  // Apply damage to monster
  const newMonsterHp = Math.max(0, monster.hp - damage);
  const isKilled = newMonsterHp === 0;

  // XP and level up logic
  let xpGained = 0;
  let leveledUp = false;
  let updatedPlayer = { ...player };

  if (isKilled) {
    xpGained = monster.xpReward;
    updatedPlayer.xp += xpGained;

    // Check for level up
    while (updatedPlayer.xp >= updatedPlayer.xpToNextLevel) {
      updatedPlayer = levelUp(updatedPlayer);
      leveledUp = true;
    }
  }

  const result: CombatResult = {
    damageDealt: damage,
    wasCritical: isCrit,
    targetKilled: isKilled,
    playerLeveledUp: leveledUp,
    xpGained,
  };

  const updatedMonster: MonsterStats = {
    ...monster,
    hp: newMonsterHp,
  };

  return {
    monster: updatedMonster,
    player: updatedPlayer,
    result,
  };
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
    // Crit stats stay the same (can be modified by equipment)
  };
}

/**
 * Apply damage to player (from monster counter-attack or phase mechanic).
 * For now, monsters don't counter-attack, but this is here for future boss phases.
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

  // Check thresholds in reverse order (lowest HP first)
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
 * Compute effective player stats including all equipped item bonuses.
 */
export function getEffectivePlayerStats(
  player: PlayerStats,
  equippedItemIds: string[],
  itemsCatalog: Record<string, Item>
): PlayerStats {
  let attackBonus = 0;
  let defenseBonus = 0;
  let maxHpBonus = 0;
  let critChanceBonus = 0;

  for (const itemId of equippedItemIds) {
    const item = itemsCatalog[itemId];
    if (!item || item.type !== 'EQUIPMENT' || !item.stats) {
      continue;
    }
    attackBonus += item.stats.attack ?? 0;
    defenseBonus += item.stats.defense ?? 0;
    maxHpBonus += item.stats.maxHp ?? 0;
    critChanceBonus += item.stats.critChance ?? 0;
  }

  return {
    ...player,
    attack: player.attack + attackBonus,
    defense: player.defense + defenseBonus,
    maxHp: player.maxHp + maxHpBonus,
    hp: Math.min(player.hp, player.maxHp + maxHpBonus),
    critChance: Math.min(1, player.critChance + critChanceBonus),
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
 * Returns the first dropped item ID or null if nothing dropped.
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
 * Active plank hold (isBlocking = true) mitigates 70% of monster attack power
 * and allows a full block (0 damage) if defense covers the reduced strike.
 */
export function calculateMonsterCounterAttack(
  player: PlayerStats,
  monsterAttack: number,
  isBlocking: boolean
): { player: PlayerStats; damageTaken: number; wasBlocked: boolean } {
  if (isBlocking) {
    const mitigatedAttack = Math.floor(monsterAttack * 0.3);
    const damageTaken = Math.max(0, mitigatedAttack - player.defense);
    return {
      player: {
        ...player,
        hp: Math.max(0, player.hp - damageTaken),
      },
      damageTaken,
      wasBlocked: true,
    };
  }

  const updated = applyDamageToPlayer(player, monsterAttack);
  return {
    player: updated,
    damageTaken: player.hp - updated.hp,
    wasBlocked: false,
  };
}

/**
 * Get time between monster counter-attacks in ms.
 * Bosses attack faster as they enter enraged phases.
 */
export function getMonsterAttackIntervalMs(monster: MonsterStats): number {
  if (!monster.isBoss) {
    return 7000;
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
