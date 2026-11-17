/**
 * Unit tests for WorkoutSession coordinator layer.
 * Uses mocked PoseTrackerLike and SoundFXLike to verify rep/hold combat,
 * counter-attacks, Plank blocking, defeat, achievements, calibration, and auto-pause behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { ExerciseDetector, ExerciseState } from '../vision/types';
import {
  WorkoutSession,
  createExerciseDetector,
  type PoseTrackerLike,
  type SoundFXLike,
} from './WorkoutSession';
import { DEFAULT_EXERCISE_CALIBRATION, useGameStore } from '../game/store';
import { createMonster, MONSTERS } from '../game/data/monsters';

function createMockTracker(): PoseTrackerLike & {
  triggerPose: (ts: number) => void;
} {
  let poseCb: ((landmarks: NormalizedLandmark[], timestamp: number) => void) | null = null;
  return {
    onPose(cb) {
      poseCb = cb;
    },
    loadModel: vi.fn().mockResolvedValue(undefined),
    startCamera: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
    triggerPose(ts: number) {
      poseCb?.([], ts);
    },
  };
}

function createMockSoundFX(): SoundFXLike {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    isUnlocked: vi.fn().mockReturnValue(true),
    play: vi.fn(),
    speak: vi.fn(),
    configure: vi.fn(),
    dispose: vi.fn(),
  };
}

function createStubDetector(states: ExerciseState[]): ExerciseDetector {
  let idx = 0;
  let current: ExerciseState = {
    phase: 'IDLE',
    repCount: 0,
    progress: 0,
    visibility: 'VISIBLE',
  };

  return {
    reset: () => {
      idx = 0;
      current = {
        phase: 'IDLE',
        repCount: 0,
        progress: 0,
        visibility: 'VISIBLE',
      };
    },
    update: () => {
      if (idx < states.length) {
        current = states[idx++];
      }
      return current;
    },
    configure: () => {},
    getState: () => current,
    getConfig: () => ({}),
  };
}

describe('WorkoutSession', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  it('applies rep-based damage with equipped item bonuses and unlocks FIRST_REP', async () => {
    const store = useGameStore.getState();
    store.addItem('WEIGHT_BELT', 1); // +3 attack
    store.equipItem('WEIGHT_BELT');
    store.startCombat(createMonster(MONSTERS.BURGER)); // 50 HP, 2 def

    const detector = createStubDetector([
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 1, progress: 0, visibility: 'VISIBLE' },
    ]);

    const tracker = createMockTracker();
    const sound = createMockSoundFX();

    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 1.0,
      poseTracker: tracker,
      soundFX: sound,
    });

    await session.start();
    tracker.triggerPose(100);
    tracker.triggerPose(200);

    const updated = useGameStore.getState();
    expect(updated.currentEnemy?.hp).toBeLessThanOrEqual(39);
    expect(updated.player.attack).toBe(10);
    expect(updated.workoutStats.totalReps).toBe(1);
    expect(updated.unlockedAchievements).toContain('FIRST_REP');
    expect(sound.play).toHaveBeenCalled();

    session.stop();
  });

  it('applies hold-based damage ticks every 1000ms and defeats monster with achievement unlocks', async () => {
    const store = useGameStore.getState();
    const weakSoda = { ...createMonster(MONSTERS.SODA), hp: 10 };
    store.startCombat(weakSoda);

    const detector = createStubDetector([
      {
        phase: 'DOWN',
        repCount: 0,
        progress: 1,
        visibility: 'VISIBLE',
        isHolding: true,
        holdDurationMs: 500,
      },
      {
        phase: 'DOWN',
        repCount: 0,
        progress: 1,
        visibility: 'VISIBLE',
        isHolding: true,
        holdDurationMs: 1100,
      },
      {
        phase: 'DOWN',
        repCount: 0,
        progress: 1,
        visibility: 'VISIBLE',
        isHolding: true,
        holdDurationMs: 2100,
      },
    ]);

    const tracker = createMockTracker();
    const sound = createMockSoundFX();

    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 1.0,
      levelId: 'LEVEL_1',
      poseTracker: tracker,
      soundFX: sound,
    });

    await session.start();
    tracker.triggerPose(500);
    expect(session.getStatus().state).toBe('ACTIVE');

    tracker.triggerPose(1100);
    tracker.triggerPose(2100);

    const status = session.getStatus();
    expect(status.state).toBe('VICTORY');
    expect(status.victorySummary?.xpGained).toBe(MONSTERS.SODA.xpReward);
    expect(status.victorySummary?.newlyUnlockedAchievements).toContain('FIRST_VICTORY');
    expect(useGameStore.getState().completedLevels).toContain('LEVEL_1');
    expect(useGameStore.getState().unlockedLevels).toContain('LEVEL_2');

    session.stop();
  });

  it('auto-pauses when LOW_VISIBILITY persists for over 5 seconds', async () => {
    const detector = createStubDetector([
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'LOW_VISIBILITY' },
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'LOW_VISIBILITY' },
    ]);

    const tracker = createMockTracker();
    const sound = createMockSoundFX();

    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 1.0,
      poseTracker: tracker,
      soundFX: sound,
    });

    await session.start();
    tracker.triggerPose(1000);
    expect(session.getStatus().state).toBe('ACTIVE');

    tracker.triggerPose(6200);
    expect(session.getStatus().state).toBe('PAUSED');
    expect(session.getStatus().autoPauseReason).toBe('LOW_VISIBILITY');

    session.stop();
  });

  it('triggers monster counter-attack after attack interval and updates player HP', async () => {
    const store = useGameStore.getState();
    store.startCombat({ ...createMonster(MONSTERS.PIZZA), attack: 15 });

    const detector = createStubDetector([
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
    ]);

    const tracker = createMockTracker();
    const sound = createMockSoundFX();

    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 1.0,
      poseTracker: tracker,
      soundFX: sound,
    });

    await session.start();
    tracker.triggerPose(1000);
    expect(useGameStore.getState().player.hp).toBe(100);

    // Mid-interval progress
    tracker.triggerPose(4500);
    expect(session.getStatus().nextAttackProgress).toBeCloseTo(0.5, 1);

    // Interval elapsed (7000ms for normal monsters)
    tracker.triggerPose(8000);
    expect(useGameStore.getState().player.hp).toBe(90); // 15 atk - 5 def = 10 damage
    expect(session.getStatus().lastMonsterAttackEvent?.wasBlocked).toBe(false);
    expect(session.getStatus().lastMonsterAttackEvent?.damageTaken).toBe(10);
    expect(sound.play).toHaveBeenCalledWith('DAMAGE');

    session.stop();
  });

  it('blocks monster counter-attack while holding Plank pose', async () => {
    const store = useGameStore.getState();
    store.startCombat({ ...createMonster(MONSTERS.PIZZA), attack: 15 });

    const detector = createStubDetector([
      {
        phase: 'DOWN',
        repCount: 0,
        progress: 1,
        visibility: 'VISIBLE',
        isHolding: true,
        holdDurationMs: 100,
      },
      {
        phase: 'DOWN',
        repCount: 0,
        progress: 1,
        visibility: 'VISIBLE',
        isHolding: true,
        holdDurationMs: 500,
      },
    ]);

    const tracker = createMockTracker();
    const sound = createMockSoundFX();

    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 1.0,
      poseTracker: tracker,
      soundFX: sound,
    });

    await session.start();
    tracker.triggerPose(1000);
    tracker.triggerPose(8100);

    expect(useGameStore.getState().player.hp).toBe(100);
    expect(session.getStatus().lastMonsterAttackEvent?.wasBlocked).toBe(true);
    expect(session.getStatus().lastMonsterAttackEvent?.damageTaken).toBe(0);
    expect(sound.play).toHaveBeenCalledWith('POWER_UP');

    session.stop();
  });

  it('transitions session to DEFEAT when counter-attack reduces player HP to 0', async () => {
    const store = useGameStore.getState();
    store.updatePlayer({ hp: 5 });
    store.startCombat({ ...createMonster(MONSTERS.BOSS_KING_BURGER), attack: 20 });

    const detector = createStubDetector([
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
    ]);

    const tracker = createMockTracker();
    const sound = createMockSoundFX();

    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 1.0,
      poseTracker: tracker,
      soundFX: sound,
    });

    await session.start();
    tracker.triggerPose(1000);
    tracker.triggerPose(7100); // Boss phase 0 interval = 6000ms

    expect(useGameStore.getState().player.hp).toBe(0);
    expect(session.getStatus().state).toBe('DEFEAT');
    expect(sound.play).toHaveBeenCalledWith('ERROR');

    session.stop();
  });

  it('forwards custom exercise calibration thresholds via createExerciseDetector', () => {
    const custom = {
      ...DEFAULT_EXERCISE_CALIBRATION,
      squatBottomAngle: 105,
      pushupBottomAngle: 100,
      plankMinBodyAngle: 150,
      jumpingJackPeakArmAngle: 125,
    };

    const squat = createExerciseDetector('SQUAT', custom);
    const pushup = createExerciseDetector('PUSH_UP', custom);
    const plank = createExerciseDetector('PLANK', custom);
    const jack = createExerciseDetector('JUMPING_JACK', custom);

    expect((squat.getConfig() as { bottomAngle: number }).bottomAngle).toBe(105);
    expect((pushup.getConfig() as { bottomAngleThreshold: number }).bottomAngleThreshold).toBe(100);
    expect((plank.getConfig() as { minBodyAngle: number }).minBodyAngle).toBe(150);
    expect((jack.getConfig() as { peakArmAngle: number }).peakArmAngle).toBe(125);
  });

  it('triggers WARNING sound and optional voice alert once per attack cycle during wind-up window', async () => {
    const store = useGameStore.getState();
    store.startCombat({ ...createMonster(MONSTERS.BOSS_KING_BURGER), attack: 10 });

    const detector = createStubDetector([
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
    ]);

    const tracker = createMockTracker();
    const sound = createMockSoundFX();

    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 1.0,
      enableSound: true,
      enableVoice: true,
      poseTracker: tracker,
      soundFX: sound,
    });

    await session.start();
    tracker.triggerPose(1000); // Baseline
    expect(session.getStatus().isAttackWarning).toBe(false);

    tracker.triggerPose(5000); // 4000ms elapsed (< 4500ms threshold for 6000ms boss cycle)
    expect(session.getStatus().isAttackWarning).toBe(false);
    expect(sound.play).not.toHaveBeenCalledWith('WARNING');

    tracker.triggerPose(5600); // 4600ms elapsed (inside 1500ms warning window)
    expect(session.getStatus().isAttackWarning).toBe(true);
    expect(sound.play).toHaveBeenCalledWith('WARNING');
    expect(sound.speak).toHaveBeenCalledTimes(1);

    tracker.triggerPose(6500); // Still inside warning window — must NOT re-trigger sound
    expect(session.getStatus().isAttackWarning).toBe(true);
    const warningCalls = (sound.play as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === 'WARNING'
    );
    expect(warningCalls).toHaveLength(1);

    tracker.triggerPose(7000); // Strike fires at 6000ms -> resets warning
    expect(session.getStatus().isAttackWarning).toBe(false);

    // Next cycle enters warning window at 7000 + 4600 = 11600ms -> warns again
    tracker.triggerPose(11600);
    expect(session.getStatus().isAttackWarning).toBe(true);
    const warningCallsNextCycle = (sound.play as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === 'WARNING'
    );
    expect(warningCallsNextCycle).toHaveLength(2);

    session.stop();
  });

  it('throttles steady-state HUD updates to ~10 FPS while emitting discrete changes immediately', async () => {
    const store = useGameStore.getState();
    store.startCombat(createMonster(MONSTERS.BURGER));

    const detector = createStubDetector([
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'DOWN', repCount: 0, progress: 0.4, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 1, progress: 0, visibility: 'VISIBLE' },
    ]);

    const tracker = createMockTracker();
    const sound = createMockSoundFX();

    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 1.0,
      poseTracker: tracker,
      soundFX: sound,
    });

    await session.start();
    const onChange = vi.fn();
    session.onStateChange(onChange);

    tracker.triggerPose(1000); // Discrete initial frame -> emits
    tracker.triggerPose(1033); // +33ms steady IDLE -> throttled
    tracker.triggerPose(1066); // +66ms steady IDLE -> throttled
    expect(onChange).toHaveBeenCalledTimes(1);

    tracker.triggerPose(1075); // Discrete phase change to DOWN -> emits immediately despite < 100ms
    expect(onChange).toHaveBeenCalledTimes(2);

    tracker.triggerPose(1090); // Discrete repCount 0 -> 1 -> emits immediately
    expect(onChange).toHaveBeenCalledTimes(3);

    session.stop();
  });

  it('maps CAMERA_NOT_FOUND errors to localized error message', async () => {
    const detector = createStubDetector([]);
    const tracker: PoseTrackerLike = {
      ...createMockTracker(),
      startCamera: vi.fn().mockRejectedValue(new Error('Requested device not found')),
      getError: () => 'CAMERA_NOT_FOUND',
    };
    const sound = createMockSoundFX();

    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 1.0,
      poseTracker: tracker,
      soundFX: sound,
    });

    let errorStatusMessage: string | undefined;
    session.onStateChange((status) => {
      if (status.state === 'ERROR') {
        errorStatusMessage = status.errorMessage;
      }
    });

    await session.start();
    expect(session.getStatus().state).toBe('ERROR');
    expect(errorStatusMessage).toBe('Камера не найдена.');
  });

  it('builds combo streaks across rapid reps, records coins/rank/bestiary on victory, and resets combo on unblocked hit', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const store = useGameStore.getState();
      store.startCombat({ ...createMonster(MONSTERS.BURGER), hp: 55 }); // TOXIC monster

      const detector = createStubDetector([
        { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 1, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 2, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 3, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 3, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 4, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 5, progress: 0, visibility: 'VISIBLE' },
      ]);

      const tracker = createMockTracker();
      const sound = createMockSoundFX();

      const session = new WorkoutSession({
        videoElement: document.createElement('video'),
        canvasElement: document.createElement('canvas'),
        exerciseDetector: detector,
        exerciseDamageMultiplier: 1.0,
        exerciseId: 'PUSH_UP',
        levelId: 'LEVEL_3',
        poseTracker: tracker,
        soundFX: sound,
      });

      await session.start();
      tracker.triggerPose(1000);
      tracker.triggerPose(1500);
      tracker.triggerPose(2000);
      tracker.triggerPose(2500); // 3rd combo hit -> multiplier 1.25x
      expect(session.getStatus().comboCount).toBe(3);
      expect(session.getStatus().comboMultiplier).toBe(1.25);

      // Unblocked TOXIC strike at 8100ms (> 7000ms) resets combo and applies toxic debuff
      tracker.triggerPose(8100);
      expect(session.getStatus().comboCount).toBe(0);
      expect(session.getStatus().isPlayerDebuffed).toBe(true);

      // Finish monster (16 HP remaining; debuffed PUSH_UP weak hits deal 9 damage each)
      tracker.triggerPose(8500);
      tracker.triggerPose(9000);

      const status = session.getStatus();
      expect(status.state).toBe('VICTORY');
      expect(status.victorySummary?.coinsEarned).toBeGreaterThan(0);
      expect(['S', 'A', 'B', 'C']).toContain(status.victorySummary?.rank);

      const finalState = useGameStore.getState();
      expect(finalState.coins).toBe(status.victorySummary?.coinsEarned);
      expect(finalState.bestiary.BURGER?.defeats).toBe(1);
      expect(finalState.streak.current).toBe(1);

      // Verify shop purchasing spends coins and adds item
      const bought = finalState.buyItem('ENERGY_BAR');
      expect(bought).toBe(true);
      expect(useGameStore.getState().inventory.items.get('ENERGY_BAR')).toBeGreaterThanOrEqual(1);

      session.stop();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('tracks Endless Arena waves cleanly in store on wave victory', async () => {
    const store = useGameStore.getState();
    store.startCombat({ ...createMonster(MONSTERS.SODA), hp: 5 });

    const detector = createStubDetector([
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 1, progress: 0, visibility: 'VISIBLE' },
    ]);

    const tracker = createMockTracker();
    const sound = createMockSoundFX();

    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 1.0,
      exerciseId: 'JUMPING_JACK',
      mode: 'ENDLESS',
      endlessWave: 3,
      poseTracker: tracker,
      soundFX: sound,
    });

    await session.start();
    tracker.triggerPose(500);
    tracker.triggerPose(1000);

    expect(session.getStatus().state).toBe('VICTORY');
    expect(session.getStatus().victorySummary?.mode).toBe('ENDLESS');
    expect(session.getStatus().victorySummary?.wave).toBe(3);
    expect(useGameStore.getState().endlessStats.bestWave).toBe(3);
    expect(useGameStore.getState().endlessStats.totalArenaWins).toBe(1);

    session.stop();
  });

  it('aborts pending async start cleanly when stopped mid-initialization (StrictMode safety)', async () => {
    let resolveLoad!: () => void;
    const tracker = createMockTracker();
    tracker.loadModel = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        })
    );
    const sound = createMockSoundFX();

    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: createStubDetector([]),
      exerciseDamageMultiplier: 1.0,
      poseTracker: tracker,
      soundFX: sound,
    });

    const startPromise = session.start();
    await vi.waitFor(() => {
      expect(tracker.loadModel).toHaveBeenCalledTimes(1);
    });
    session.stop();
    resolveLoad();
    await startPromise;

    expect(tracker.startCamera).not.toHaveBeenCalled();
    expect(tracker.start).not.toHaveBeenCalled();
    expect(session.getStatus().state).toBe('IDLE');
  });

  it('tracks dumbbell tonnage, charges Ultimate Overdrive to 100%, and stuns the enemy', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const store = useGameStore.getState();
      store.setLoadout({ mode: 'DUMBBELLS', weightKg: 5 });
      store.startCombat({ ...createMonster(MONSTERS.MILKSHAKE), hp: 200 });

      const detector = createStubDetector([
        { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 1, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 2, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 3, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 4, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 5, progress: 0, visibility: 'VISIBLE' },
      ]);

      const tracker = createMockTracker();
      const sound = createMockSoundFX();

      const session = new WorkoutSession({
        videoElement: document.createElement('video'),
        canvasElement: document.createElement('canvas'),
        exerciseDetector: detector,
        exerciseDamageMultiplier: 1.25,
        exerciseId: 'OVERHEAD_PRESS',
        poseTracker: tracker,
        soundFX: sound,
      });

      await session.start();
      tracker.triggerPose(1000);
      tracker.triggerPose(1500);
      tracker.triggerPose(2000);
      tracker.triggerPose(2500);
      tracker.triggerPose(3000);
      // 4 reps charged meter below 100, enemy attack progress should have built up
      expect(session.getStatus().ultimateCharge).toBeGreaterThan(0);
      expect(session.getStatus().nextAttackProgress).toBeGreaterThan(0);

      // 5th rep crosses 100 -> Ultimate Overdrive triggers and resets attack progress (stun)
      tracker.triggerPose(3500);
      const status = session.getStatus();
      expect(status.ultimateCharge).toBe(0);
      expect(status.ultimateTriggeredCount).toBe(1);
      expect(status.lastCombatEvent?.wasUltimate).toBe(true);
      expect(status.nextAttackProgress).toBe(0);

      // 5 reps * (2 * 5kg) = 50 kg total tonnage
      expect(useGameStore.getState().workoutStats.totalTonnageKg).toBe(50);

      session.stop();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('cleanses Toxic debuff after 3 consecutive static hold seconds and advances Circuit rooms cleanly', async () => {
    const store = useGameStore.getState();
    store.startCombat({ ...createMonster(MONSTERS.HOT_SAUCE), hp: 200 });

    const detector = createStubDetector([
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE', isHolding: false, holdDurationMs: 0 },
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE', isHolding: false, holdDurationMs: 0 },
      { phase: 'DOWN', repCount: 0, progress: 1, visibility: 'VISIBLE', isHolding: true, holdDurationMs: 1100 },
      { phase: 'DOWN', repCount: 0, progress: 1, visibility: 'VISIBLE', isHolding: true, holdDurationMs: 2100 },
      { phase: 'DOWN', repCount: 0, progress: 1, visibility: 'VISIBLE', isHolding: true, holdDurationMs: 3100 },
    ]);

    const tracker = createMockTracker();
    const sound = createMockSoundFX();

    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 0.9,
      exerciseId: 'ARM_HOLD',
      mode: 'CIRCUIT',
      circuitId: 'UPPER_IRON',
      circuitRoomIndex: 0,
      poseTracker: tracker,
      soundFX: sound,
    });

    await session.start();
    tracker.triggerPose(1000);
    // Unblocked hit from TOXIC monster applies debuff
    tracker.triggerPose(8100);
    expect(session.getStatus().isPlayerDebuffed).toBe(true);

    // Hold 1s, 2s, 3s -> 3rd consecutive hold second cleanses Toxic debuff
    tracker.triggerPose(9100);
    expect(session.getStatus().isPlayerDebuffed).toBe(true);
    tracker.triggerPose(10100);
    expect(session.getStatus().isPlayerDebuffed).toBe(true);
    tracker.triggerPose(11100);
    expect(session.getStatus().isPlayerDebuffed).toBe(false);
    expect(session.getStatus().debuffCleansedId).toBe(1);

    // Advance circuit directly to final room & finish boss for circuit completion reward
    const finalEnemy = { ...createMonster(MONSTERS.BURGER), hp: 5 };
    const finalDetector = createStubDetector([
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 1, progress: 0, visibility: 'VISIBLE' },
    ]);
    session.advanceCircuitRoom({
      nextEnemy: finalEnemy,
      exerciseId: 'PUSH_UP',
      roomIndex: 2,
      detector: finalDetector,
    });

    tracker.triggerPose(12000);
    tracker.triggerPose(12500);
    expect(session.getStatus().state).toBe('VICTORY');
    expect(session.getStatus().victorySummary?.circuitCompleted).toBe(true);
    expect(useGameStore.getState().workoutStats.circuitsCompleted).toBe(1);
    expect(useGameStore.getState().unlockedAchievements).toContain('CIRCUIT_CHAMPION');

    session.stop();
  });

  it('constructs detectors for ARM_HOLD, WALL_SIT, and OVERHEAD_PRESS with custom calibration', () => {
    const custom = {
      ...DEFAULT_EXERCISE_CALIBRATION,
      armHoldMinShoulderAngle: 75,
      wallSitMaxKneeAngle: 120,
      overheadPressTopAngle: 165,
    };

    const armHold = createExerciseDetector('ARM_HOLD', custom);
    const wallSit = createExerciseDetector('WALL_SIT', custom);
    const press = createExerciseDetector('OVERHEAD_PRESS', custom);

    expect((armHold.getConfig() as { minShoulderAngle: number }).minShoulderAngle).toBe(75);
    expect((wallSit.getConfig() as { maxKneeAngle: number }).maxKneeAngle).toBe(120);
    expect((press.getConfig() as { topAngle: number }).topAngle).toBe(165);
  });

  it('clears garden weed, increments weedsDefeated, and boosts crop growth on WEED battle victory', async () => {
    const store = useGameStore.getState();
    store.plantSeed(0, 'PROTEIN_MINT');
    store.triggerGardenWeed(0);
    expect(useGameStore.getState().garden.plots[0].weedId).not.toBeNull();

    const weakWeed = { ...createMonster(MONSTERS.WEED_DANDELION), hp: 5 };
    store.startCombat(weakWeed);

    const detector = createStubDetector([
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 1, progress: 0, visibility: 'VISIBLE' },
    ]);
    const tracker = createMockTracker();
    const sound = createMockSoundFX();

    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 1.0,
      exerciseId: 'SQUAT',
      mode: 'WEED',
      gardenPlotId: 0,
      poseTracker: tracker,
      soundFX: sound,
    });

    await session.start();
    tracker.triggerPose(100);
    tracker.triggerPose(300);

    const status = session.getStatus();
    expect(status.state).toBe('VICTORY');
    expect(status.victorySummary?.gardenPlotCleared).toBe(true);
    expect(status.victorySummary?.gardenPlotId).toBe(0);

    const updatedGarden = useGameStore.getState().garden;
    expect(updatedGarden.plots[0].weedId).toBeNull();
    expect(updatedGarden.weedsDefeated).toBe(1);
    // +1 from defeatPlotWeed + 1 from applyWorkoutVictoryToGarden = 2 growth
    expect(updatedGarden.plots[0].growth).toBeGreaterThanOrEqual(2);

    session.stop();
  });

  it('defaults poseDelegate to GPU in store, supports 15/30/60 FPS, and reports active delegate in SessionStatus', () => {
    expect(useGameStore.getState().settings.poseDelegate).toBe('GPU');

    useGameStore.getState().updateSettings({ poseDelegate: 'CPU', targetPoseFps: 15 });
    expect(useGameStore.getState().settings.poseDelegate).toBe('CPU');
    expect(useGameStore.getState().settings.targetPoseFps).toBe(15);

    const detector = createStubDetector([]);
    const tracker = createMockTracker();
    tracker.getActiveDelegate = () => 'CPU';
    tracker.didFallbackToCpu = () => false;

    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 1.0,
      targetPoseFps: 15,
      poseDelegate: 'CPU',
      poseTracker: tracker,
      soundFX: createMockSoundFX(),
    });

    const status = session.getStatus();
    expect(status.poseDelegate).toBe('CPU');
    expect(status.poseDelegateFallback).toBe(false);

    session.stop();
  });

  it('applies Sanctuary pre-battle buffs (Ult start, Ult charge boost, damage mitigation, XP boost) and consumes them on victory', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      useGameStore.setState((state) => ({
        coins: 500,
        garden: {
          ...state.garden,
          cropInventory: {
            PROTEIN_MINT: 2,
            IRON_BAMBOO: 3,
            CHILI_PEPPER: 3,
            GOLDEN_LOTUS: 1,
          },
        },
      }));

      const store = useGameStore.getState();
      expect(store.upgradeSanctuaryLab()).toBe(true); // Tier 2 -> 2 slots
      expect(store.upgradeSanctuaryLab()).toBe(true); // Tier 3 -> 3 slots + 15 start Ult
      expect(store.craftMix('BAMBOO_FORTIFIER')).toBe(true);
      expect(store.craftMix('LOTUS_NECTAR')).toBe(true);
      expect(store.activateMixBuff('BAMBOO_FORTIFIER')).not.toBeNull();
      expect(store.activateMixBuff('LOTUS_NECTAR')).not.toBeNull();

      // Lotus (30) + Tier 3 bonus (15) = 45% starting Ult charge; 2 Squat reps vs resistant Burger (8 dmg each = 16) defeat 15 HP
      useGameStore.getState().startCombat({ ...createMonster(MONSTERS.BURGER), hp: 15, xpReward: 50 });

      const detector = createStubDetector([
        { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 1, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 2, progress: 0, visibility: 'VISIBLE' },
      ]);

      const tracker = createMockTracker();
      const session = new WorkoutSession({
        videoElement: document.createElement('video'),
        canvasElement: document.createElement('canvas'),
        exerciseDetector: detector,
        exerciseDamageMultiplier: 1.0,
        exerciseId: 'SQUAT',
        levelId: 'LEVEL_1',
        poseTracker: tracker,
        soundFX: createMockSoundFX(),
      });

      await session.start();
      const startStatus = session.getStatus();
      expect(startStatus.activeSanctuaryBuffs).toEqual(['BAMBOO_FORTIFIER', 'LOTUS_NECTAR']);
      expect(startStatus.ultimateCharge).toBe(45);

      const xpBefore = useGameStore.getState().player.xp;
      tracker.triggerPose(500);
      tracker.triggerPose(1000);
      expect(session.getStatus().ultimateCharge).toBeGreaterThan(45);

      tracker.triggerPose(1500); // Finishes 15 HP Burger -> victory
      expect(session.getStatus().state).toBe('VICTORY');
      // 50 base XP * 1.3 Lotus Nectar = 65 XP
      expect(useGameStore.getState().player.xp - xpBefore).toBe(65);
      // Pre-battle buffs are consumed after finishing the battle
      expect(useGameStore.getState().sanctuary.activeBuffs).toEqual([]);

      session.stop();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('applies discipline damage multiplier (TITAN_BREW), ISOTONIC_RHYTHM starting combo, IRON_BASTION thorns & 1s cleanse, and TOXIC_CATALYST surge', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      useGameStore.setState((state) => ({
        coins: 500,
        garden: {
          ...state.garden,
          cropInventory: {
            PROTEIN_MINT: 10,
            IRON_BAMBOO: 10,
            CHILI_PEPPER: 10,
            GOLDEN_LOTUS: 5,
          },
        },
      }));

      const store = useGameStore.getState();
      expect(store.upgradeSanctuaryLab()).toBe(true);
      expect(store.upgradeSanctuaryLab()).toBe(true);
      store.addMonsterTrophy('TROPHY_GLAZE_SHELL', 2);
      store.addMonsterTrophy('TROPHY_FIZZ_CORE', 2);
      store.addMonsterTrophy('TROPHY_CAPSAICIN_DROP', 2);

      // 1) ISOTONIC_RHYTHM + TITAN_BREW -> startingCombo 3, Strength x1.35 on SQUAT
      expect(store.craftMix('MINT_ISOTONIC')).toBe(true);
      expect(store.craftMix('PULSE_FIZZ')).toBe(true);
      expect(store.craftMix('TITAN_BREW')).toBe(true);
      expect(store.activateMixBuff('MINT_ISOTONIC')).not.toBeNull();
      expect(store.activateMixBuff('PULSE_FIZZ')).not.toBeNull();
      expect(store.activateMixBuff('TITAN_BREW')).not.toBeNull();

      useGameStore.getState().startCombat({ ...createMonster(MONSTERS.BURGER), hp: 100 });
      const squatDetector = createStubDetector([
        { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 1, progress: 0, visibility: 'VISIBLE' },
      ]);
      const tracker1 = createMockTracker();
      const session1 = new WorkoutSession({
        videoElement: document.createElement('video'),
        canvasElement: document.createElement('canvas'),
        exerciseDetector: squatDetector,
        exerciseDamageMultiplier: 1.0,
        exerciseId: 'SQUAT',
        poseTracker: tracker1,
        soundFX: createMockSoundFX(),
      });
      await session1.start();
      expect(session1.getStatus().comboCount).toBe(3);
      expect(session1.getStatus().activeSynergies).toEqual(['ISOTONIC_RHYTHM']);

      tracker1.triggerPose(1000);
      tracker1.triggerPose(1500);
      // Attack: 10 + 2 (Mint) + 2 (Pulse) + 3 (Titan) = 17 - 2 (DEF) = 15 * 1.25 (combo 4) * 0.75 (SQUAT resistant vs BURGER) * 1.35 (Strength) = 18.98 -> 18
      expect(session1.getStatus().lastCombatEvent?.damage).toBe(18);
      session1.stop();
      useGameStore.getState().consumeActiveSanctuaryBuffs();

      // 2) IRON_BASTION -> 90% block, 8 thorns damage on 0-dmg block, +10 Ult charge, 1s static cleanse
      expect(store.craftMix('BAMBOO_FORTIFIER')).toBe(true);
      expect(store.craftMix('MONOLITH_ELIXIR')).toBe(true);
      expect(store.activateMixBuff('BAMBOO_FORTIFIER')).not.toBeNull();
      expect(store.activateMixBuff('MONOLITH_ELIXIR')).not.toBeNull();

      useGameStore.getState().startCombat({ ...createMonster(MONSTERS.HOT_SAUCE), hp: 80, attack: 12 });
      const plankDetector = createStubDetector([
        { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE', isHolding: false, holdDurationMs: 0 },
        { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE', isHolding: true, holdDurationMs: 500 },
        { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE', isHolding: true, holdDurationMs: 1200 },
      ]);
      const tracker2 = createMockTracker();
      const session2 = new WorkoutSession({
        videoElement: document.createElement('video'),
        canvasElement: document.createElement('canvas'),
        exerciseDetector: plankDetector,
        exerciseDamageMultiplier: 0.85,
        exerciseId: 'PLANK',
        poseTracker: tracker2,
        soundFX: createMockSoundFX(),
      });
      await session2.start();
      tracker2.triggerPose(1000); // Baseline monster attack timer
      tracker2.triggerPose(8100); // Blocked strike -> 0 dmg taken, 8 thorns damage, +10 Ult
      const afterThorns = session2.getStatus();
      expect(afterThorns.activeSynergies).toEqual(['IRON_BASTION']);
      expect(afterThorns.lastMonsterAttackEvent?.wasBlocked).toBe(true);
      expect(afterThorns.lastMonsterAttackEvent?.damageTaken).toBe(0);
      expect(afterThorns.lastMonsterAttackEvent?.thornsDamage).toBe(8);
      expect(afterThorns.currentEnemy?.hp).toBe(72);
      expect(afterThorns.ultimateCharge).toBe(25); // 15 (Tier 3 start) + 10 (Iron Bastion)
      session2.stop();
      useGameStore.getState().consumeActiveSanctuaryBuffs();

      // 3) TOXIC_CATALYST -> converts TOXIC counter-attack into Surge stack + Ult charge & selfDamageOnUlt
      expect(store.craftMix('TOXIC_CATALYST')).toBe(true);
      expect(store.activateMixBuff('TOXIC_CATALYST')).not.toBeNull();
      useGameStore.getState().updatePlayer({ hp: 2 });
      useGameStore.getState().startCombat({ ...createMonster(MONSTERS.BURGER), hp: 200, attack: 5 });

      const toxicDetector = createStubDetector([
        { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 1, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 2, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 3, progress: 0, visibility: 'VISIBLE' },
        { phase: 'IDLE', repCount: 4, progress: 0, visibility: 'VISIBLE' },
      ]);
      const tracker3 = createMockTracker();
      const session3 = new WorkoutSession({
        videoElement: document.createElement('video'),
        canvasElement: document.createElement('canvas'),
        exerciseDetector: toxicDetector,
        exerciseDamageMultiplier: 1.0,
        exerciseId: 'SQUAT',
        poseTracker: tracker3,
        soundFX: createMockSoundFX(),
      });
      await session3.start();
      tracker3.triggerPose(1000);
      tracker3.triggerPose(8100); // Unblocked TOXIC strike -> immune + 1 Toxic Surge stack
      expect(session3.getStatus().isPlayerDebuffed).toBe(false);
      expect(session3.getStatus().toxicSurgeStacks).toBe(1);
      expect(session3.getStatus().hasRiskyMutagen).toBe(true);

      // Push Ult to trigger (selfDamageOnUlt = 3, floors HP safely at 1)
      tracker3.triggerPose(8500);
      tracker3.triggerPose(9000);
      tracker3.triggerPose(9500);
      tracker3.triggerPose(10000);
      expect(session3.getStatus().ultimateTriggeredCount).toBe(1);
      expect(useGameStore.getState().player.hp).toBe(1);
      session3.stop();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('persists Sanctuary buffs and ENDLESS_ENDURANCE healing across Endless Arena waves, drops trophies, and consumes buffs on defeat', async () => {
    useGameStore.setState((state) => ({
      coins: 500,
      player: { ...state.player, hp: 50, maxHp: 100 },
      garden: {
        ...state.garden,
        cropInventory: {
          PROTEIN_MINT: 5,
          IRON_BAMBOO: 0,
          CHILI_PEPPER: 2,
          GOLDEN_LOTUS: 3,
        },
      },
    }));

    const store = useGameStore.getState();
    expect(store.upgradeSanctuaryLab()).toBe(true);
    store.addMonsterTrophy('TROPHY_FIZZ_CORE', 2);
    expect(store.craftMix('ARENA_TONIC')).toBe(true);
    expect(store.craftMix('LOTUS_NECTAR')).toBe(true);
    expect(store.activateMixBuff('ARENA_TONIC')).not.toBeNull();
    expect(store.activateMixBuff('LOTUS_NECTAR')).not.toBeNull();

    // Set HP to 60 before Endless wave 1 victory
    useGameStore.getState().updatePlayer({ hp: 60 });
    useGameStore.getState().startCombat({ ...createMonster(MONSTERS.SODA), hp: 5 });

    const detector = createStubDetector([
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 1, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 1, progress: 0, visibility: 'VISIBLE' },
    ]);
    const tracker = createMockTracker();
    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 1.0,
      exerciseId: 'JUMPING_JACK',
      mode: 'ENDLESS',
      endlessWave: 1,
      poseTracker: tracker,
      soundFX: createMockSoundFX(),
    });

    await session.start();
    tracker.triggerPose(500);
    tracker.triggerPose(1000);

    const victoryStatus = session.getStatus();
    expect(victoryStatus.state).toBe('VICTORY');
    expect(victoryStatus.victorySummary?.droppedTrophy).toEqual({
      id: 'TROPHY_FIZZ_CORE',
      qty: 1,
    });
    // Endless wave victory heals +10 HP from ENDLESS_ENDURANCE and does NOT consume activeBuffs
    expect(useGameStore.getState().player.hp).toBe(70);
    expect(useGameStore.getState().sanctuary.activeBuffs).toEqual([
      'ARENA_TONIC',
      'LOTUS_NECTAR',
    ]);
    expect(useGameStore.getState().sanctuary.trophyInventory.TROPHY_FIZZ_CORE).toBe(1);

    // Advance to wave 2 with lethal incoming attack -> defeat consumes Endless buffs
    useGameStore.getState().updatePlayer({ hp: 1 });
    session.reset({ ...createMonster(MONSTERS.SODA), hp: 200, attack: 50 }, 2);
    tracker.triggerPose(2000);
    tracker.triggerPose(10000);
    expect(session.getStatus().state).toBe('DEFEAT');
    expect(useGameStore.getState().sanctuary.activeBuffs).toEqual([]);

    session.stop();
  });

  it('constructs v3.5 detectors (LUNGE, HIGH_KNEES, FRONT_RAISE) with custom calibration', () => {
    const custom = {
      ...DEFAULT_EXERCISE_CALIBRATION,
      lungeBottomAngle: 112,
      highKneesLiftAngle: 120,
      frontRaisePeakAngle: 78,
    };

    const lunge = createExerciseDetector('LUNGE', custom);
    const highKnees = createExerciseDetector('HIGH_KNEES', custom);
    const frontRaise = createExerciseDetector('FRONT_RAISE', custom);

    expect((lunge.getConfig() as { bottomAngle: number }).bottomAngle).toBe(112);
    expect((highKnees.getConfig() as { liftAngle: number }).liftAngle).toBe(120);
    expect((frontRaise.getConfig() as { peakAngle: number }).peakAngle).toBe(78);
  });

  it('applies talents, equipped artifacts, and run mutators (TOXIC_MIST, BLITZ_CLOCK) in combat', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      useGameStore.setState((state) => ({
        player: { ...state.player, level: 4 },
      }));
      const store = useGameStore.getState();
      expect(store.upgradeTalent('MIGHT_STRIKE')).toBe(true); // +2 ATK
      expect(store.upgradeTalent('BASTION_VITALITY')).toBe(true); // +15 maxHP
      expect(store.upgradeTalent('BASTION_AEGIS')).toBe(true); // +2 DEF
      expect(store.unlockArtifact('TITAN_CORE')).toBe(true); // +1 ATK, +4 DEF, +10 thorns
      expect(store.equipArtifact('TITAN_CORE')).toBe(true);

      store.startCombat({ ...createMonster(MONSTERS.BURGER), hp: 100, attack: 10 });
      const detector = createStubDetector([
        { phase: 'DOWN', repCount: 0, progress: 1, visibility: 'VISIBLE', isHolding: true, holdDurationMs: 200 },
        { phase: 'IDLE', repCount: 1, progress: 0, visibility: 'VISIBLE', isHolding: true, holdDurationMs: 500 },
      ]);
      const tracker = createMockTracker();
      const session = new WorkoutSession({
        videoElement: document.createElement('video'),
        canvasElement: document.createElement('canvas'),
        exerciseDetector: detector,
        exerciseDamageMultiplier: 1.25,
        exerciseId: 'LUNGE',
        activeMutators: ['TOXIC_MIST', 'BLITZ_CLOCK'],
        poseTracker: tracker,
        soundFX: createMockSoundFX(),
      });

      await session.start();
      const statusBefore = session.getStatus();
      expect(statusBefore.activeMutators).toEqual(['TOXIC_MIST', 'BLITZ_CLOCK']);
      // 7000ms * 0.78 = 5460ms
      expect(statusBefore.monsterAttackIntervalMs).toBe(5460);

      // First frame triggers TOXIC_MIST debuff
      tracker.triggerPose(1000);
      expect(session.getStatus().isPlayerDebuffed).toBe(true);

      // 6500ms >= 1000 + 5460ms -> counter-attack fires (blocked with 10 thorns from TITAN_CORE!)
      tracker.triggerPose(6500);
      expect(session.getStatus().lastMonsterAttackEvent?.wasBlocked).toBe(true);
      expect(session.getStatus().lastMonsterAttackEvent?.thornsDamage).toBe(10);

      session.stop();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('completes Weekly Challenge, advances Program Day, unlocks VAMPIRIC_FANG, and records PRs', async () => {
    const store = useGameStore.getState();
    store.startProgram('STARTER_3D', '2026-11-17');
    store.startCombat({
      ...createMonster(MONSTERS.BOSS_KING_BURGER),
      maxHp: 12,
      hp: 12,
      defense: 0,
      shieldHits: 0,
      maxShieldHits: 0,
      phaseThresholds: [],
    });

    const detector = createStubDetector([
      { phase: 'IDLE', repCount: 0, progress: 0, visibility: 'VISIBLE' },
      { phase: 'IDLE', repCount: 1, progress: 0, visibility: 'VISIBLE' },
    ]);
    const tracker = createMockTracker();
    const session = new WorkoutSession({
      videoElement: document.createElement('video'),
      canvasElement: document.createElement('canvas'),
      exerciseDetector: detector,
      exerciseDamageMultiplier: 1.25,
      exerciseId: 'SQUAT',
      mode: 'WEEKLY',
      weeklyWeekKey: '2026-W47',
      programDayIndex: 0,
      poseTracker: tracker,
      soundFX: createMockSoundFX(),
    });

    await session.start();
    tracker.triggerPose(500);
    tracker.triggerPose(1000);

    const status = session.getStatus();
    expect(status.state).toBe('VICTORY');
    expect(status.victorySummary?.weeklyBonus?.firstCompletion).toBe(true);
    expect(status.victorySummary?.programBonus?.completedProgram).toBe(false);
    expect(status.victorySummary?.unlockedArtifactId).toBe('VAMPIRIC_FANG');
    expect(status.victorySummary?.brokenRecords).toContain('REPS');
    expect(status.victorySummary?.brokenRecords).toContain('HIT');

    const finalState = useGameStore.getState();
    expect(finalState.weeklyChallenge.completedWeekKeys).toContain('2026-W47');
    expect(finalState.artifacts.unlockedIds).toContain('VAMPIRIC_FANG');
    expect(finalState.programs.active?.completedDays).toEqual([0]);
    expect(finalState.personalRecords.SQUAT.bestBattleReps).toBe(1);

    session.stop();
  });
});
