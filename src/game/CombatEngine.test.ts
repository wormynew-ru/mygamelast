/**
 * Tests for CombatEngine - damage, crits, XP, leveling.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  calculateXPForLevel,
  calculateBaseDamage,
  rollCritical,
  applyDamageToMonster,
  levelUp,
  applyDamageToPlayer,
  isPlayerDead,
  isMonsterDead,
  getBossPhase,
  createPlayer,
  getEffectivePlayerStats,
  useConsumableItem,
  rollItemDrop,
  calculateMonsterCounterAttack,
  getMonsterAttackIntervalMs,
  ATTACK_WARNING_WINDOW_MS,
  isMonsterAttackWarningActive,
} from './CombatEngine';
import { ITEMS } from './data/items';
import { evaluateNewAchievements } from './data/achievements';
import type { PlayerStats, MonsterStats, GameState } from './types';

describe('CombatEngine', () => {
  describe('calculateXPForLevel', () => {
    it('should calculate XP thresholds with exponential curve', () => {
      expect(calculateXPForLevel(1)).toBe(100); // 100 * 1^1.5 = 100
      expect(calculateXPForLevel(2)).toBe(282); // 100 * 2^1.5 ≈ 282
      expect(calculateXPForLevel(3)).toBe(519); // 100 * 3^1.5 ≈ 519
      expect(calculateXPForLevel(5)).toBe(1118); // 100 * 5^1.5 ≈ 1118
    });
  });

  describe('calculateBaseDamage', () => {
    it('should calculate damage with attack - defense formula', () => {
      expect(calculateBaseDamage(10, 2, 1.0)).toBe(8); // (10 - 2) * 1.0 = 8
      expect(calculateBaseDamage(15, 5, 1.5)).toBe(15); // (15 - 5) * 1.5 = 15
    });

    it('should enforce minimum damage of 1', () => {
      expect(calculateBaseDamage(5, 10, 1.0)).toBe(1); // (5 - 10) * 1.0 = -5 → 1
      expect(calculateBaseDamage(0, 0, 0.5)).toBe(1); // 0 * 0.5 = 0 → 1
    });
  });

  describe('rollCritical', () => {
    it('should always crit at 100% chance', () => {
      expect(rollCritical(1.0)).toBe(true);
    });

    it('should never crit at 0% chance', () => {
      expect(rollCritical(0.0)).toBe(false);
    });

    it('should crit probabilistically', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      expect(rollCritical(0.15)).toBe(true); // 0.1 < 0.15

      vi.spyOn(Math, 'random').mockReturnValue(0.2);
      expect(rollCritical(0.15)).toBe(false); // 0.2 >= 0.15

      vi.restoreAllMocks();
    });
  });

  describe('applyDamageToMonster', () => {
    const mockPlayer: PlayerStats = {
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      hp: 100,
      maxHp: 100,
      attack: 10,
      defense: 5,
      critChance: 0.0, // No crits for deterministic tests
      critMultiplier: 1.5,
    };

    const mockMonster: MonsterStats = {
      id: 'TEST_MONSTER',
      name: 'Test Monster',
      hp: 50,
      maxHp: 50,
      attack: 8,
      defense: 2,
      xpReward: 25,
      isBoss: false,
    };

    it('should deal damage to monster', () => {
      const { monster, result } = applyDamageToMonster(mockPlayer, mockMonster, 1.0);

      expect(result.damageDealt).toBe(8); // (10 - 2) * 1.0 = 8
      expect(result.wasCritical).toBe(false);
      expect(monster.hp).toBe(42); // 50 - 8 = 42
      expect(result.targetKilled).toBe(false);
    });

    it('should kill monster when HP reaches 0', () => {
      const weakMonster: MonsterStats = { ...mockMonster, hp: 5 };
      const { monster, result } = applyDamageToMonster(mockPlayer, weakMonster, 1.0);

      expect(monster.hp).toBe(0); // 5 - 8 → clamped to 0
      expect(result.targetKilled).toBe(true);
      expect(result.xpGained).toBe(25);
    });

    it('should award XP on kill', () => {
      const weakMonster: MonsterStats = { ...mockMonster, hp: 1 };
      const { player, result } = applyDamageToMonster(mockPlayer, weakMonster, 1.0);

      expect(result.xpGained).toBe(25);
      expect(player.xp).toBe(25);
      expect(result.playerLeveledUp).toBe(false);
    });

    it('should level up player when XP threshold reached', () => {
      const playerNearLevelUp: PlayerStats = { ...mockPlayer, xp: 90, xpToNextLevel: 100 };
      const weakMonster: MonsterStats = { ...mockMonster, hp: 1, xpReward: 50 };

      const { player, result } = applyDamageToMonster(playerNearLevelUp, weakMonster, 1.0);

      expect(result.playerLeveledUp).toBe(true);
      expect(player.level).toBe(2);
      expect(player.xp).toBe(40); // 90 + 50 - 100 = 40 (excess XP carried over)
      expect(player.attack).toBe(12); // +2
      expect(player.defense).toBe(6); // +1
      expect(player.maxHp).toBe(110); // +10
      expect(player.hp).toBe(110); // +10 restored
    });

    it('should apply critical hit multiplier', () => {
      const critPlayer: PlayerStats = { ...mockPlayer, critChance: 1.0 }; // Always crit
      const { result } = applyDamageToMonster(critPlayer, mockMonster, 1.0);

      expect(result.wasCritical).toBe(true);
      expect(result.damageDealt).toBe(12); // (10 - 2) * 1.0 * 1.5 = 12
    });

    it('should apply exercise multiplier', () => {
      const { result } = applyDamageToMonster(mockPlayer, mockMonster, 2.0);

      expect(result.damageDealt).toBe(16); // (10 - 2) * 2.0 = 16
    });
  });

  describe('levelUp', () => {
    it('should increase stats and recalculate XP threshold', () => {
      const player: PlayerStats = {
        level: 1,
        xp: 150,
        xpToNextLevel: 100,
        hp: 100,
        maxHp: 100,
        attack: 10,
        defense: 5,
        critChance: 0.15,
        critMultiplier: 1.5,
      };

      const leveledPlayer = levelUp(player);

      expect(leveledPlayer.level).toBe(2);
      expect(leveledPlayer.xp).toBe(50); // 150 - 100 = 50 excess XP
      expect(leveledPlayer.xpToNextLevel).toBe(282); // Level 2 threshold
      expect(leveledPlayer.maxHp).toBe(110);
      expect(leveledPlayer.hp).toBe(110);
      expect(leveledPlayer.attack).toBe(12);
      expect(leveledPlayer.defense).toBe(6);
    });

    it('should handle multiple level ups in one go', () => {
      let player: PlayerStats = {
        level: 1,
        xp: 500,
        xpToNextLevel: 100,
        hp: 100,
        maxHp: 100,
        attack: 10,
        defense: 5,
        critChance: 0.15,
        critMultiplier: 1.5,
      };

      // Level up twice
      player = levelUp(player); // 1→2
      player = levelUp(player); // 2→3

      expect(player.level).toBe(3);
      expect(player.attack).toBe(14); // +2 per level
      expect(player.defense).toBe(7); // +1 per level
      expect(player.maxHp).toBe(120); // +10 per level
    });
  });

  describe('applyDamageToPlayer', () => {
    const mockPlayer: PlayerStats = {
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      hp: 100,
      maxHp: 100,
      attack: 10,
      defense: 5,
      critChance: 0.15,
      critMultiplier: 1.5,
    };

    it('should reduce player HP by (monsterAttack - playerDefense)', () => {
      const damaged = applyDamageToPlayer(mockPlayer, 10);

      expect(damaged.hp).toBe(95); // 100 - (10 - 5) = 95
    });

    it('should enforce minimum damage of 1', () => {
      const damaged = applyDamageToPlayer(mockPlayer, 3);

      expect(damaged.hp).toBe(99); // 100 - 1 = 99 (3 - 5 = -2 → 1)
    });

    it('should clamp HP at 0', () => {
      const lowHpPlayer: PlayerStats = { ...mockPlayer, hp: 2 };
      const damaged = applyDamageToPlayer(lowHpPlayer, 20);

      expect(damaged.hp).toBe(0);
    });
  });

  describe('isPlayerDead / isMonsterDead', () => {
    it('should detect dead player', () => {
      const alivePlayer: PlayerStats = createPlayer();
      const deadPlayer: PlayerStats = { ...alivePlayer, hp: 0 };

      expect(isPlayerDead(alivePlayer)).toBe(false);
      expect(isPlayerDead(deadPlayer)).toBe(true);
    });

    it('should detect dead monster', () => {
      const aliveMonster: MonsterStats = {
        id: 'TEST',
        name: 'Test',
        hp: 10,
        maxHp: 50,
        attack: 5,
        defense: 2,
        xpReward: 10,
        isBoss: false,
      };
      const deadMonster: MonsterStats = { ...aliveMonster, hp: 0 };

      expect(isMonsterDead(aliveMonster)).toBe(false);
      expect(isMonsterDead(deadMonster)).toBe(true);
    });
  });

  describe('getBossPhase', () => {
    const bossMonster: MonsterStats = {
      id: 'BOSS',
      name: 'Boss',
      hp: 200,
      maxHp: 200,
      attack: 15,
      defense: 5,
      xpReward: 100,
      isBoss: true,
      phaseThresholds: [0.7, 0.4], // 70% and 40%
    };

    it('should return phase 0 at full HP', () => {
      expect(getBossPhase(bossMonster)).toBe(0);
    });

    it('should return phase 1 at 70% HP', () => {
      const boss = { ...bossMonster, hp: 140 }; // 70%
      expect(getBossPhase(boss)).toBe(1);
    });

    it('should return phase 2 at 40% HP', () => {
      const boss = { ...bossMonster, hp: 80 }; // 40%
      expect(getBossPhase(boss)).toBe(2);
    });

    it('should return phase 2 at 10% HP (lowest phase)', () => {
      const boss = { ...bossMonster, hp: 20 }; // 10%
      expect(getBossPhase(boss)).toBe(2);
    });

    it('should return phase 0 for non-boss monsters', () => {
      const normalMonster: MonsterStats = {
        id: 'NORMAL',
        name: 'Normal',
        hp: 50,
        maxHp: 50,
        attack: 5,
        defense: 2,
        xpReward: 10,
        isBoss: false,
      };
      expect(getBossPhase(normalMonster)).toBe(0);
    });
  });

  describe('createPlayer', () => {
    it('should create a fresh player with starting stats', () => {
      const player = createPlayer();

      expect(player.level).toBe(1);
      expect(player.xp).toBe(0);
      expect(player.xpToNextLevel).toBe(100);
      expect(player.hp).toBe(100);
      expect(player.maxHp).toBe(100);
      expect(player.attack).toBe(10);
      expect(player.defense).toBe(5);
      expect(player.critChance).toBe(0.15);
      expect(player.critMultiplier).toBe(1.5);
    });
  });

  describe('getEffectivePlayerStats', () => {
    it('adds equipment stat bonuses without mutating base player', () => {
      const base = createPlayer();
      const effective = getEffectivePlayerStats(
        base,
        ['RUNNING_SHOES', 'WEIGHT_BELT', 'ARMOR_VEST'],
        ITEMS
      );

      expect(effective.attack).toBe(base.attack + 2 + 3);
      expect(effective.defense).toBe(base.defense + 5);
      expect(base.attack).toBe(10);
    });

    it('ignores consumables and unknown item IDs', () => {
      const base = createPlayer();
      const effective = getEffectivePlayerStats(
        base,
        ['PROTEIN_SHAKE', 'NON_EXISTENT'],
        ITEMS
      );

      expect(effective.attack).toBe(base.attack);
      expect(effective.defense).toBe(base.defense);
    });
  });

  describe('useConsumableItem', () => {
    it('restores HP capped at maxHp', () => {
      const wounded: PlayerStats = { ...createPlayer(), hp: 60, maxHp: 100 };
      const healed = useConsumableItem(wounded, ITEMS.PROTEIN_SHAKE);
      expect(healed.hp).toBe(100);

      const slightlyWounded: PlayerStats = { ...createPlayer(), hp: 40, maxHp: 100 };
      const healedPartial = useConsumableItem(slightlyWounded, ITEMS.ENERGY_BAR);
      expect(healedPartial.hp).toBe(65);
    });

    it('leaves stats unchanged for non-consumable items', () => {
      const wounded: PlayerStats = { ...createPlayer(), hp: 50, maxHp: 100 };
      const result = useConsumableItem(wounded, ITEMS.RUNNING_SHOES);
      expect(result.hp).toBe(50);
    });
  });

  describe('rollItemDrop', () => {
    it('returns matching item when rng falls below drop chance', () => {
      const table = [
        { itemId: 'ENERGY_BAR', chance: 0.3 },
        { itemId: 'PROTEIN_SHAKE', chance: 0.5 },
      ];
      const rng = vi.fn().mockReturnValueOnce(0.8).mockReturnValueOnce(0.2);

      expect(rollItemDrop(table, rng)).toBe('PROTEIN_SHAKE');
    });

    it('returns null when no drop succeeds', () => {
      const table = [{ itemId: 'ARMOR_VEST', chance: 0.25 }];
      expect(rollItemDrop(table, () => 0.99)).toBeNull();
    });
  });

  describe('calculateMonsterCounterAttack & intervals', () => {
    it('reduces damage and allows full block during plank hold', () => {
      const player = createPlayer(); // defense 5
      const unblocked = calculateMonsterCounterAttack(player, 15, false);
      expect(unblocked.wasBlocked).toBe(false);
      expect(unblocked.damageTaken).toBe(10); // 15 - 5

      const blocked = calculateMonsterCounterAttack(player, 15, true);
      expect(blocked.wasBlocked).toBe(true);
      expect(blocked.damageTaken).toBe(0); // floor(15*0.3)=4 <= 5 defense
    });

    it('speeds up attack interval in boss phases', () => {
      const boss: MonsterStats = {
        id: 'BOSS_KING_BURGER',
        name: 'King Burger',
        hp: 200,
        maxHp: 200,
        attack: 15,
        defense: 5,
        xpReward: 150,
        isBoss: true,
        phaseThresholds: [0.7, 0.4],
      };

      expect(getMonsterAttackIntervalMs(boss)).toBe(6000);
      expect(getMonsterAttackIntervalMs({ ...boss, hp: 130 })).toBe(5000);
      expect(getMonsterAttackIntervalMs({ ...boss, hp: 60 })).toBe(4000);
    });

    it('activates attack warning strictly within the final warning window before strike', () => {
      expect(ATTACK_WARNING_WINDOW_MS).toBe(1500);

      expect(isMonsterAttackWarningActive(5499, 7000)).toBe(false);
      expect(isMonsterAttackWarningActive(5500, 7000)).toBe(true);
      expect(isMonsterAttackWarningActive(6999, 7000)).toBe(true);
      expect(isMonsterAttackWarningActive(7000, 7000)).toBe(false);

      // Boss enraged shorter intervals (4000ms -> warns at 2500ms..3999ms)
      expect(isMonsterAttackWarningActive(2499, 4000)).toBe(false);
      expect(isMonsterAttackWarningActive(2500, 4000)).toBe(true);

      // Edge cases: invalid interval or warning window larger than interval
      expect(isMonsterAttackWarningActive(0, 0)).toBe(false);
      expect(isMonsterAttackWarningActive(100, 1000, 1500)).toBe(true);
    });
  });

  describe('evaluateNewAchievements', () => {
    it('unlocks achievements matching workout & progression milestones without duplicates', () => {
      const state: GameState = {
        player: { ...createPlayer(), level: 5 },
        inventory: { items: new Map(), equippedItems: [] },
        currentLevel: null,
        unlockedLevels: ['LEVEL_1'],
        completedLevels: ['LEVEL_5'],
        unlockedAchievements: ['FIRST_REP'],
        currentEnemy: null,
        workoutStats: { totalReps: 55, totalHoldSeconds: 35, monstersDefeated: 2 },
        settings: {
          soundEnabled: true,
          voiceEnabled: false,
          cameraFacingMode: 'user',
          exerciseConfigs: {},
          exerciseCalibration: {
            squatBottomAngle: 90,
            pushupBottomAngle: 90,
            plankMinBodyAngle: 160,
            jumpingJackPeakArmAngle: 135,
          },
          language: 'ru',
        },
      };

      const unlocked = evaluateNewAchievements(state);
      expect(unlocked).not.toContain('FIRST_REP');
      expect(unlocked).toContain('FIFTY_REPS');
      expect(unlocked).toContain('PLANK_SURVIVOR');
      expect(unlocked).toContain('FIRST_VICTORY');
      expect(unlocked).toContain('BOSS_SLAYER');
      expect(unlocked).toContain('VETERAN_HERO');
    });
  });
});
