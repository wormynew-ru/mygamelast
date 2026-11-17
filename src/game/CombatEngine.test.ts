/**
 * Tests for CombatEngine - damage, crits, XP, leveling.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  calculateXPForLevel,
  calculateBaseDamage,
  rollCritical,
  applyDamageToMonster,
  applyBossPhaseTransition,
  levelUp,
  applyDamageToPlayer,
  isPlayerDead,
  isMonsterDead,
  getBossPhase,
  getComboMultiplier,
  getExerciseMatchup,
  calculateBattleRank,
  estimateWorkoutKcal,
  getLoadoutDamageMultiplier,
  getLoadoutXpMultiplier,
  calculateTonnageDelta,
  calculateUltimateChargeGain,
  ULTIMATE_DAMAGE_MULTIPLIER,
  createPlayer,
  getEffectivePlayerStats,
  useConsumableItem,
  rollItemDrop,
  calculateMonsterCounterAttack,
  getMonsterAttackIntervalMs,
  ATTACK_WARNING_WINDOW_MS,
  isMonsterAttackWarningActive,
} from './CombatEngine';
import { getCircuitById } from './data/circuits';
import { ITEMS } from './data/items';
import { createEndlessWaveMonster } from './data/monsters';
import {
  getDailyQuestsForDate,
  getQuestProgress,
  updateStreakForDate,
} from './data/dailyQuests';
import { evaluateNewAchievements } from './data/achievements';
import { createInitialGardenState } from './data/garden';
import { createInitialSanctuaryState } from './data/sanctuary';
import { createInitialTalentState } from './data/talents';
import { createInitialArtifactState } from './data/artifacts';
import {
  createInitialPersonalRecords,
  createInitialProgramState,
  createInitialWeeklyChallengeState,
} from './data/programs';
import type { PlayerStats, MonsterStats, GameState } from './types';

describe('CombatEngine', () => {
  describe('calculateXPForLevel', () => {
    it('should calculate XP thresholds with exponential curve', () => {
      expect(calculateXPForLevel(1)).toBe(100);
      expect(calculateXPForLevel(2)).toBe(282);
      expect(calculateXPForLevel(3)).toBe(519);
      expect(calculateXPForLevel(5)).toBe(1118);
    });
  });

  describe('calculateBaseDamage', () => {
    it('should calculate damage with attack - defense formula', () => {
      expect(calculateBaseDamage(10, 2, 1.0)).toBe(8);
      expect(calculateBaseDamage(15, 5, 1.5)).toBe(15);
    });

    it('should enforce minimum damage of 1', () => {
      expect(calculateBaseDamage(5, 10, 1.0)).toBe(1);
      expect(calculateBaseDamage(0, 0, 0.5)).toBe(1);
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
      expect(rollCritical(0.15)).toBe(true);

      vi.spyOn(Math, 'random').mockReturnValue(0.2);
      expect(rollCritical(0.15)).toBe(false);

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
      critChance: 0.0,
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

      expect(result.damageDealt).toBe(8);
      expect(result.wasCritical).toBe(false);
      expect(monster.hp).toBe(42);
      expect(result.targetKilled).toBe(false);
    });

    it('should kill monster when HP reaches 0', () => {
      const weakMonster: MonsterStats = { ...mockMonster, hp: 5 };
      const { monster, result } = applyDamageToMonster(mockPlayer, weakMonster, 1.0);

      expect(monster.hp).toBe(0);
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
      expect(player.xp).toBe(40);
      expect(player.attack).toBe(12);
      expect(player.defense).toBe(6);
      expect(player.maxHp).toBe(110);
      expect(player.hp).toBe(110);
    });

    it('should apply critical hit multiplier', () => {
      const critPlayer: PlayerStats = { ...mockPlayer, critChance: 1.0 };
      const { result } = applyDamageToMonster(critPlayer, mockMonster, 1.0);

      expect(result.wasCritical).toBe(true);
      expect(result.damageDealt).toBe(12);
    });

    it('should apply exercise multiplier', () => {
      const { result } = applyDamageToMonster(mockPlayer, mockMonster, 2.0);

      expect(result.damageDealt).toBe(16);
    });

    it('applies combo multiplier, weakness affinity, and shield mitigation', () => {
      expect(getComboMultiplier(0)).toBe(1.0);
      expect(getComboMultiplier(3)).toBe(1.25);
      expect(getComboMultiplier(6)).toBe(1.5);
      expect(getComboMultiplier(10)).toBe(2.0);

      const shieldedMonster: MonsterStats = {
        ...mockMonster,
        weakTo: 'SQUAT',
        resistantTo: 'PLANK',
        shieldHits: 2,
        maxShieldHits: 2,
      };

      expect(getExerciseMatchup(shieldedMonster, 'SQUAT')).toBe('WEAK');
      expect(getExerciseMatchup(shieldedMonster, 'PLANK')).toBe('RESISTANT');

      // Base damage 8 * combo(1.5) * weak(1.5) = 18 -> shielded 25% = 4, and weak strips 2 shield hits!
      const { monster: afterHit, result } = applyDamageToMonster(mockPlayer, shieldedMonster, 1.0, {
        comboCount: 6,
        exerciseId: 'SQUAT',
      });

      expect(result.matchup).toBe('WEAK');
      expect(result.shieldHit).toBe(true);
      expect(result.shieldBroken).toBe(true);
      expect(afterHit.shieldHits).toBe(0);
      expect(result.damageDealt).toBe(4);
    });

    it('reduces damage when player suffers toxic debuff', () => {
      const { result } = applyDamageToMonster(mockPlayer, mockMonster, 1.0, {
        isDebuffed: true,
      });
      expect(result.damageDealt).toBe(6); // 8 * 0.75 = 6
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
      expect(leveledPlayer.xp).toBe(50);
      expect(leveledPlayer.xpToNextLevel).toBe(282);
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

      player = levelUp(player);
      player = levelUp(player);

      expect(player.level).toBe(3);
      expect(player.attack).toBe(14);
      expect(player.defense).toBe(7);
      expect(player.maxHp).toBe(120);
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
      expect(damaged.hp).toBe(95);
    });

    it('should enforce minimum damage of 1', () => {
      const damaged = applyDamageToPlayer(mockPlayer, 3);
      expect(damaged.hp).toBe(99);
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

  describe('getBossPhase & phase transitions', () => {
    const bossMonster: MonsterStats = {
      id: 'BOSS',
      name: 'Boss',
      hp: 200,
      maxHp: 200,
      attack: 15,
      defense: 5,
      xpReward: 100,
      isBoss: true,
      phaseThresholds: [0.7, 0.4],
    };

    it('should return phase 0 at full HP', () => {
      expect(getBossPhase(bossMonster)).toBe(0);
    });

    it('should return phase 1 at 70% HP', () => {
      const boss = { ...bossMonster, hp: 140 };
      expect(getBossPhase(boss)).toBe(1);
    });

    it('should return phase 2 at 40% HP', () => {
      const boss = { ...bossMonster, hp: 80 };
      expect(getBossPhase(boss)).toBe(2);
    });

    it('should return phase 2 at 10% HP (lowest phase)', () => {
      const boss = { ...bossMonster, hp: 20 };
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

    it('grants Boss Grease Shield when transitioning into Phase 1', () => {
      const shifted = applyBossPhaseTransition(bossMonster, 0, 1);
      expect(shifted.shieldHits).toBe(2);
      expect(shifted.maxShieldHits).toBe(2);
    });
  });

  describe('createPlayer & getEffectivePlayerStats', () => {
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

    it('adds equipment stat bonuses including comboWindowBonusMs without mutating base player', () => {
      const base = createPlayer();
      const effective = getEffectivePlayerStats(
        base,
        ['RUNNING_SHOES', 'WEIGHT_BELT', 'ARMOR_VEST', 'CHAMPION_BELT'],
        ITEMS
      );

      expect(effective.attack).toBe(base.attack + 2 + 3 + 8);
      expect(effective.defense).toBe(base.defense + 5 + 6);
      expect(effective.maxHp).toBe(base.maxHp + 25);
      expect(effective.comboWindowBonusMs).toBe(1000);
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

  describe('useConsumableItem & rollItemDrop', () => {
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
      const player = createPlayer();
      const unblocked = calculateMonsterCounterAttack(player, 15, false);
      expect(unblocked.wasBlocked).toBe(false);
      expect(unblocked.damageTaken).toBe(10);

      const blocked = calculateMonsterCounterAttack(player, 15, true);
      expect(blocked.wasBlocked).toBe(true);
      expect(blocked.damageTaken).toBe(0);
    });

    it('speeds up attack interval in boss phases and respects fast archetype intervals', () => {
      const fastMob: MonsterStats = {
        id: 'SODA',
        name: 'Soda',
        hp: 30,
        maxHp: 30,
        attack: 5,
        defense: 1,
        xpReward: 15,
        isBoss: false,
        attackIntervalMs: 5200,
      };
      expect(getMonsterAttackIntervalMs(fastMob)).toBe(5200);

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
      expect(isMonsterAttackWarningActive(2499, 4000)).toBe(false);
      expect(isMonsterAttackWarningActive(2500, 4000)).toBe(true);
      expect(isMonsterAttackWarningActive(0, 0)).toBe(false);
      expect(isMonsterAttackWarningActive(100, 1000, 1500)).toBe(true);
    });
  });

  describe('Battle Ranks, Kcal, Endless Waves & Daily Quests', () => {
    it('computes battle rank S/A/B/C and reward multipliers accurately', () => {
      expect(
        calculateBattleRank({ damageTaken: 0, playerMaxHp: 100, maxCombo: 10, durationSec: 25 })
      ).toEqual({ rank: 'S', rewardMultiplier: 1.3 });

      expect(
        calculateBattleRank({ damageTaken: 20, playerMaxHp: 100, maxCombo: 5, durationSec: 50 })
      ).toEqual({ rank: 'A', rewardMultiplier: 1.15 });

      expect(
        calculateBattleRank({ damageTaken: 80, playerMaxHp: 100, maxCombo: 1, durationSec: 90 })
      ).toEqual({ rank: 'C', rewardMultiplier: 1.0 });
    });

    it('estimates workout kcal and scales endless arena waves with bosses every 5th wave', () => {
      expect(
        estimateWorkoutKcal({
          SQUAT: { reps: 10 },
          PLANK: { holdSeconds: 50 },
        })
      ).toBe(7.5);

      const wave1 = createEndlessWaveMonster(1);
      const wave4 = createEndlessWaveMonster(4);
      const wave5 = createEndlessWaveMonster(5);

      expect(wave1.isBoss).toBe(false);
      expect(wave4.maxHp).toBeGreaterThan(wave1.maxHp);
      expect(wave5.isBoss).toBe(true);
      expect(wave5.coinReward).toBeGreaterThan(wave1.coinReward ?? 0);
    });

    it('generates deterministic daily quests and updates day streaks safely', () => {
      const questsA = getDailyQuestsForDate('2026-11-15');
      const questsB = getDailyQuestsForDate('2026-11-15');
      expect(questsA).toEqual(questsB);
      expect(questsA).toHaveLength(3);

      expect(
        getQuestProgress(questsA[0], {
          date: '2026-11-15',
          claimedIds: [],
          repsToday: 12,
          holdSecondsToday: 5,
          winsToday: 1,
        })
      ).toBe(12);

      const s1 = updateStreakForDate({ current: 0, best: 0, lastActiveDate: null }, '2026-11-14');
      expect(s1).toEqual({ current: 1, best: 1, lastActiveDate: '2026-11-14' });

      const s2 = updateStreakForDate(s1, '2026-11-15');
      expect(s2).toEqual({ current: 2, best: 2, lastActiveDate: '2026-11-15' });

      const sReset = updateStreakForDate(s2, '2026-11-18');
      expect(sReset).toEqual({ current: 1, best: 2, lastActiveDate: '2026-11-18' });
    });
  });

  describe('evaluateNewAchievements', () => {
    it('unlocks achievements matching workout, combo, endless, streak, bestiary, tonnage, static & circuit milestones without duplicates', () => {
      const state: GameState = {
        player: { ...createPlayer(), level: 5 },
        inventory: { items: new Map(), equippedItems: [] },
        coins: 120,
        loadout: { mode: 'DUMBBELLS', weightKg: 5 },
        currentLevel: null,
        unlockedLevels: ['LEVEL_1'],
        completedLevels: ['LEVEL_5'],
        unlockedAchievements: ['FIRST_REP'],
        currentEnemy: null,
        workoutStats: {
          totalReps: 55,
          totalHoldSeconds: 65,
          monstersDefeated: 2,
          maxCombo: 12,
          totalTonnageKg: 600,
          circuitsCompleted: 1,
        },
        exerciseTotals: {
          SQUAT: { reps: 30, holdSeconds: 0 },
          PUSH_UP: { reps: 15, holdSeconds: 0 },
          PLANK: { reps: 0, holdSeconds: 35 },
          JUMPING_JACK: { reps: 10, holdSeconds: 0 },
          ARM_HOLD: { reps: 0, holdSeconds: 20 },
          WALL_SIT: { reps: 0, holdSeconds: 10 },
          OVERHEAD_PRESS: { reps: 0, holdSeconds: 0 },
          LUNGE: { reps: 0, holdSeconds: 0 },
          HIGH_KNEES: { reps: 0, holdSeconds: 0 },
          FRONT_RAISE: { reps: 0, holdSeconds: 0 },
        },
        streak: { current: 3, best: 3, lastActiveDate: '2026-11-15' },
        dailyHistory: {},
        dailyQuests: {
          date: '2026-11-15',
          claimedIds: [],
          repsToday: 0,
          holdSecondsToday: 0,
          winsToday: 0,
        },
        bestiary: {
          SODA: { encounters: 1, defeats: 1, fastestVictorySec: 12, weaknessDiscovered: true },
          DONUT: { encounters: 1, defeats: 1, fastestVictorySec: 15, weaknessDiscovered: true },
          BURGER: { encounters: 1, defeats: 1, fastestVictorySec: 20, weaknessDiscovered: true },
          PIZZA: { encounters: 1, defeats: 1, fastestVictorySec: 22, weaknessDiscovered: true },
          FRIES: { encounters: 1, defeats: 0, fastestVictorySec: null, weaknessDiscovered: false },
        },
        endlessStats: { bestWave: 5, totalArenaWins: 5 },
        garden: createInitialGardenState(),
        sanctuary: createInitialSanctuaryState(),
        talents: createInitialTalentState(),
        artifacts: createInitialArtifactState(),
        programs: createInitialProgramState(),
        personalRecords: createInitialPersonalRecords(),
        bestSingleHitDamage: 0,
        activeMutators: [],
        weeklyChallenge: createInitialWeeklyChallengeState(),
        settings: {
          soundEnabled: true,
          voiceEnabled: false,
          voiceControlEnabled: false,
          cameraFacingMode: 'user',
          targetPoseFps: 60,
          poseDelegate: 'GPU',
          scriptedPoseEnabled: false,
          exerciseConfigs: {},
          exerciseCalibration: {
            squatBottomAngle: 90,
            pushupBottomAngle: 90,
            plankMinBodyAngle: 160,
            jumpingJackPeakArmAngle: 135,
            armHoldMinShoulderAngle: 65,
            wallSitMaxKneeAngle: 115,
            overheadPressTopAngle: 155,
            lungeBottomAngle: 95,
            highKneesLiftAngle: 110,
            frontRaisePeakAngle: 80,
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
      expect(unlocked).toContain('COMBO_MASTER');
      expect(unlocked).toContain('ARENA_SURVIVOR');
      expect(unlocked).toContain('STREAK_WARRIOR');
      expect(unlocked).toContain('BESTIARY_SCHOLAR');
      expect(unlocked).toContain('IRON_TONNAGE');
      expect(unlocked).toContain('STATIC_MASTER');
      expect(unlocked).toContain('CIRCUIT_CHAMPION');
    });
  });

  describe('Loadouts, Tonnage, Ultimate Overdrive & Circuits', () => {
    it('calculates capped dumbbell damage/XP multipliers and ignores unsupported exercises', () => {
      expect(getLoadoutDamageMultiplier({ mode: 'BODYWEIGHT', weightKg: 0 }, 'OVERHEAD_PRESS')).toBe(1.0);
      expect(getLoadoutDamageMultiplier({ mode: 'DUMBBELLS', weightKg: 5 }, 'OVERHEAD_PRESS')).toBe(1.2);
      expect(getLoadoutDamageMultiplier({ mode: 'DUMBBELLS', weightKg: 50 }, 'OVERHEAD_PRESS')).toBe(1.6);
      expect(getLoadoutDamageMultiplier({ mode: 'DUMBBELLS', weightKg: 5 }, 'PUSH_UP')).toBe(1.0);
      expect(getLoadoutXpMultiplier({ mode: 'DUMBBELLS', weightKg: 10 }, 'SQUAT')).toBe(1.25);
    });

    it('tracks tonnage in kg for both dumbbell reps and isometric dumbbell holds', () => {
      const loadout5kg = { mode: 'DUMBBELLS' as const, weightKg: 5 };
      expect(calculateTonnageDelta('OVERHEAD_PRESS', 10, 0, loadout5kg)).toBe(100);
      expect(calculateTonnageDelta('ARM_HOLD', 0, 10, loadout5kg)).toBe(50);
      expect(calculateTonnageDelta('PUSH_UP', 10, 0, loadout5kg)).toBe(0);
      expect(calculateTonnageDelta('OVERHEAD_PRESS', 10, 0, { mode: 'BODYWEIGHT', weightKg: 0 })).toBe(0);
    });

    it('scales ultimate charge & delivers heavy overdrive damage with shield break bonus', () => {
      expect(calculateUltimateChargeGain({ isHoldTick: false, comboCount: 4 })).toBe(22);
      expect(calculateUltimateChargeGain({ isHoldTick: true, comboCount: 0 })).toBe(12);

      const player = { ...createPlayer(), critChance: 0 };
      const enemy: MonsterStats = {
        id: 'NACHOS',
        name: 'Nachos',
        hp: 60,
        maxHp: 60,
        attack: 8,
        defense: 2,
        xpReward: 30,
        isBoss: false,
        shieldHits: 2,
        maxShieldHits: 2,
      };

      const { monster, result } = applyDamageToMonster(player, enemy, 1.0, {
        isUltimate: true,
      });
      expect(result.wasUltimate).toBe(true);
      expect(result.shieldBroken).toBe(true);
      expect(monster.shieldHits).toBe(0);
      expect(result.damageDealt).toBe(Math.floor(Math.floor(8 * ULTIMATE_DAMAGE_MULTIPLIER) * 0.5));
    });

    it('scales workout kcal with dumbbell weight and exposes circuit presets', () => {
      const baseKcal = estimateWorkoutKcal({ OVERHEAD_PRESS: { reps: 10 } }, 0);
      const weightedKcal = estimateWorkoutKcal({ OVERHEAD_PRESS: { reps: 10 } }, 10);
      expect(baseKcal).toBe(4);
      expect(weightedKcal).toBeGreaterThan(baseKcal);

      const blitz = getCircuitById('FULL_BODY_BLITZ');
      expect(blitz?.rooms.length).toBeGreaterThanOrEqual(3);
    });

    it('applies Sanctuary botanical buffs to stats, Ult charge, XP gain, and incoming damage mitigation', () => {
      const base = createPlayer();
      const effective = getEffectivePlayerStats(
        base,
        [],
        ITEMS,
        ['MINT_ISOTONIC', 'BAMBOO_FORTIFIER', 'LOTUS_NECTAR'],
        3
      );

      expect(effective.attack).toBe(base.attack + 5);
      expect(effective.defense).toBe(base.defense + 7);
      expect(effective.critChance).toBeCloseTo(base.critChance + 0.1, 4);
      expect(effective.comboWindowBonusMs).toBe(1000);

      expect(
        calculateUltimateChargeGain({ isHoldTick: false, comboCount: 0, chargeMultiplier: 1.4 })
      ).toBe(25);

      const enemy: MonsterStats = {
        id: 'SODA',
        name: 'Soda',
        hp: 10,
        maxHp: 30,
        attack: 5,
        defense: 0,
        xpReward: 100,
        isBoss: false,
      };
      const { result } = applyDamageToMonster(base, enemy, 1.0, { xpMultiplier: 1.3 });
      expect(result.xpGained).toBe(130);

      const mitigated = calculateMonsterCounterAttack(base, 25, false, 0.75);
      // raw = 25 - 5 = 20 -> 20 * 0.75 = 15
      expect(mitigated.damageTaken).toBe(15);
    });

    it('supports armor pierce, shield break bonuses, instant ult shield shatter, risky stat scaling, and 90% block mitigation', () => {
      const base = createPlayer();
      const armoredEnemy: MonsterStats = {
        id: 'DONUT',
        name: 'Donut',
        hp: 100,
        maxHp: 100,
        attack: 30,
        defense: 6,
        xpReward: 40,
        isBoss: false,
        shieldHits: 3,
        maxShieldHits: 3,
      };

      // Armor pierce 50% cuts 6 DEF -> 3 DEF (unshielded comparison: 10 - 3 = 7 dmg)
      const pierced = applyDamageToMonster(
        { ...base, critChance: 0 },
        { ...armoredEnemy, shieldHits: 0, maxShieldHits: 0 },
        1.0,
        { armorPierceRatio: 0.5 }
      );
      expect(pierced.result.damageDealt).toBe(7);

      // shieldBreakBonus +1 breaks 2 shield charges on a regular non-crit hit
      const shieldedHit = applyDamageToMonster({ ...base, critChance: 0 }, armoredEnemy, 1.0, {
        shieldBreakBonus: 1,
      });
      expect(shieldedHit.monster.shieldHits).toBe(1);
      expect(shieldedHit.result.shieldBroken).toBe(false);

      // breakAllShieldsOnUlt shatters all remaining shields & uses 2.1x ult override
      const ultShatter = applyDamageToMonster({ ...base, critChance: 0 }, armoredEnemy, 1.0, {
        isUltimate: true,
        breakAllShieldsOnUlt: true,
        ultimateDamageMultiplier: 2.1,
      });
      expect(ultShatter.monster.shieldHits).toBe(0);
      expect(ultShatter.result.shieldBroken).toBe(true);

      // extraCritChance + dumbbellDamageBonus
      const weightedCrit = applyDamageToMonster(
        { ...base, critChance: 0 },
        { ...armoredEnemy, defense: 0, shieldHits: 0, maxShieldHits: 0 },
        1.0,
        {
          exerciseId: 'OVERHEAD_PRESS',
          loadout: { mode: 'DUMBBELLS', weightKg: 5 },
          dumbbellDamageBonus: 0.15,
          extraCritChance: 1.0,
        }
      );
      expect(weightedCrit.result.wasCritical).toBe(true);
      expect(weightedCrit.result.loadoutMultiplier).toBe(1.35);

      // Risky mutagens: GLASS_OVERDRIVE scales maxHp by 0.8 (clamps hp) & +0.5 critMultiplier; BERSERK_CAPSAICIN clamps defense >= 0
      const glassStats = getEffectivePlayerStats(base, [], ITEMS, ['GLASS_OVERDRIVE'], 2);
      expect(glassStats.maxHp).toBe(80);
      expect(glassStats.hp).toBe(80);
      expect(glassStats.critMultiplier).toBe(2.0);

      const fragileStats = getEffectivePlayerStats(
        { ...base, defense: 2 },
        [],
        ITEMS,
        ['BERSERK_CAPSAICIN'],
        1
      );
      expect(fragileStats.defense).toBe(0);

      // 90% block mitigation override reduces 30 ATK down to 3 before player DEF
      const zeroDefPlayer = { ...base, defense: 0 };
      const heavyBlock = calculateMonsterCounterAttack(zeroDefPlayer, 30, true, 1.0, 0.9);
      expect(heavyBlock.wasBlocked).toBe(true);
      expect(heavyBlock.damageTaken).toBe(3);
    });
  });
});
