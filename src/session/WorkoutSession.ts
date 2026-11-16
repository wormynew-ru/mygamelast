/**
 * WorkoutSession - Coordinator layer that orchestrates CV, Combat, Audio, and Store.
 * ZERO React imports allowed. Pure business logic.
 *
 * Architecture:
 * PoseTracker -> ExerciseDetector -> CombatEngine -> store -> SoundFX
 */

import type { Landmark, NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { ExerciseDetector, ExerciseState } from '../vision/types';
import type { ExerciseCalibrationSettings, MonsterStats } from '../game/types';
import { PoseTracker, type TrackerError } from '../vision/PoseTracker';
import {
  SquatDetector,
  PushUpDetector,
  PlankDetector,
  JumpingJackDetector,
} from '../vision/exercises';
import {
  applyDamageToMonster,
  calculateMonsterCounterAttack,
  getBossPhase,
  getEffectivePlayerStats,
  getMonsterAttackIntervalMs,
  isMonsterAttackWarningActive,
  isMonsterDead,
  isPlayerDead,
  rollItemDrop,
} from '../game/CombatEngine';
import { EXERCISES, type ExerciseId } from '../game/data/exercises';
import { ITEMS } from '../game/data/items';
import { getLevelById } from '../game/data/levels';
import { SoundFX } from '../audio/SoundFX';
import { DEFAULT_EXERCISE_CALIBRATION, useGameStore } from '../game/store';
import { t } from '../i18n';

export type SessionState =
  | 'IDLE'
  | 'STARTING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'VICTORY'
  | 'DEFEAT'
  | 'ERROR';

export type AutoPauseReason = 'USER' | 'LOW_VISIBILITY' | 'TAB_HIDDEN' | null;

export interface CombatEvent {
  id: number;
  damage: number;
  wasCritical: boolean;
  bossPhase: number;
  bossPhaseChanged: boolean;
  timestamp: number;
}

export interface MonsterAttackEvent {
  id: number;
  damageTaken: number;
  wasBlocked: boolean;
  timestamp: number;
}

export interface VictorySummary {
  xpGained: number;
  leveledUp: boolean;
  droppedItemId: string | null;
  unlockedLevelId: string | null;
  newlyUnlockedAchievements: string[];
}

export interface SessionStatus {
  state: SessionState;
  exerciseState: ExerciseState | null;
  currentEnemy: MonsterStats | null;
  errorMessage?: string;
  autoPauseReason: AutoPauseReason;
  isAudioUnlocked: boolean;
  bossPhase: number;
  nextAttackProgress: number;
  monsterAttackIntervalMs: number;
  isAttackWarning: boolean;
  lastCombatEvent: CombatEvent | null;
  lastMonsterAttackEvent: MonsterAttackEvent | null;
  victorySummary: VictorySummary | null;
  fps?: number;
  lastFrameTime?: number;
}

export type SessionStateChangeCallback = (status: SessionStatus) => void;

export interface PoseTrackerLike {
  onPose(
    cb: (landmarks: NormalizedLandmark[], timestamp: number, worldLandmarks?: Landmark[]) => void
  ): void;
  loadModel(): Promise<void>;
  startCamera(video: HTMLVideoElement): Promise<void>;
  start(canvas?: HTMLCanvasElement): void;
  stop(): void;
  dispose(): void;
  getError?(): TrackerError | null;
}

export interface SoundFXLike {
  init(): Promise<void>;
  isUnlocked(): boolean;
  play(
    type:
      | 'BOTTOM_HIT'
      | 'REP_COMPLETE'
      | 'ERROR'
      | 'POWER_UP'
      | 'COMBO'
      | 'DAMAGE'
      | 'WARNING'
      | 'VICTORY'
  ): void;
  speak?(text: string, options?: { rate?: number; pitch?: number }): void;
  configure(config: { enabled?: boolean; voiceEnabled?: boolean }): void;
  dispose(): void;
}

export interface WorkoutSessionConfig {
  videoElement: HTMLVideoElement;
  canvasElement: HTMLCanvasElement;
  exerciseDetector: ExerciseDetector;
  exerciseDamageMultiplier: number;
  levelId?: string;
  enableSound?: boolean;
  enableVoice?: boolean;
  cameraFacingMode?: 'user' | 'environment';
  /** Optional dependency injection for testing */
  poseTracker?: PoseTrackerLike;
  soundFX?: SoundFXLike;
}

const LOW_VISIBILITY_TIMEOUT_MS = 5000;
const HOLD_TICK_MS = 1000;
const HUD_UPDATE_INTERVAL_MS = 100;

export class WorkoutSession {
  private poseTracker: PoseTrackerLike;
  private soundFX: SoundFXLike;
  private exerciseDetector: ExerciseDetector;
  private exerciseDamageMultiplier: number;
  private levelId?: string;

  private videoElement: HTMLVideoElement;
  private canvasElement: HTMLCanvasElement;

  private state: SessionState = 'IDLE';
  private autoPauseReason: AutoPauseReason = null;
  private lastExerciseState: ExerciseState | null = null;
  private lastRepCount = 0;
  private lastHoldTickSeconds = 0;
  private lastBossPhase = 0;
  private lastPhaseForAudio: string = 'IDLE';
  private lowVisibilityStartTime: number | null = null;

  private lastMonsterAttackTime: number | null = null;
  private nextAttackProgress = 0;
  private isAttackWarning = false;
  private attackWarningTriggered = false;
  private lastMonsterAttackEvent: MonsterAttackEvent | null = null;
  private monsterAttackCounter = 0;

  private lastCombatEvent: CombatEvent | null = null;
  private combatEventCounter = 0;
  private sessionAchievements: string[] = [];
  private victorySummary: VictorySummary | null = null;

  private stateChangeCallbacks: SessionStateChangeCallback[] = [];
  private enableSound: boolean;
  private enableVoice: boolean;

  private frameCount = 0;
  private lastFpsUpdate = 0;
  private currentFps = 0;
  private lastHudNotifyTime = -Infinity;
  private lastNotifiedRepCount = -1;
  private lastNotifiedPhase: string | null = null;
  private lastNotifiedVisibility: string | null = null;
  private lastNotifiedHolding: boolean | undefined = undefined;
  private lastNotifiedWarning = false;
  private lastNotifiedFps = -1;
  private lastNotifiedCombatId = 0;
  private lastNotifiedAttackId = 0;

  private wakeLock: WakeLockSentinel | null = null;
  private boundVisibilityHandler: (() => void) | null = null;

  constructor(config: WorkoutSessionConfig) {
    this.exerciseDetector = config.exerciseDetector;
    this.exerciseDamageMultiplier = config.exerciseDamageMultiplier;
    this.levelId = config.levelId;
    this.enableSound = config.enableSound ?? true;
    this.enableVoice = config.enableVoice ?? false;
    this.videoElement = config.videoElement;
    this.canvasElement = config.canvasElement;

    this.poseTracker =
      config.poseTracker ??
      new PoseTracker({
        facingMode: config.cameraFacingMode ?? 'user',
      });

    this.poseTracker.onPose(this.handlePoseDetected.bind(this));

    this.soundFX =
      config.soundFX ??
      new SoundFX({
        enabled: this.enableSound,
        voiceEnabled: this.enableVoice,
      });
  }

  async start(): Promise<void> {
    if (this.state !== 'IDLE' && this.state !== 'ERROR') {
      return;
    }

    this.setState('STARTING');

    try {
      if (this.enableSound) {
        await this.soundFX.init();
      }

      await this.poseTracker.loadModel();
      await this.poseTracker.startCamera(this.videoElement);

      this.resetTrackingCounters();

      this.poseTracker.start(this.canvasElement);

      this.attachLifecycleListeners();
      await this.requestWakeLock();

      this.setState('ACTIVE');

      if (this.enableSound) {
        this.soundFX.play('REP_COMPLETE');
      }
    } catch (error) {
      const trackerErr = this.poseTracker.getError?.();
      const errName = error instanceof Error ? error.name : '';
      let message: string;
      if (trackerErr === 'CAMERA_NOT_FOUND' || errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        message = t('error.cameraNotFound');
      } else if (
        trackerErr === 'CAMERA_PERMISSION_DENIED' ||
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError'
      ) {
        message = t('error.cameraPermission');
      } else if (trackerErr === 'MODEL_LOAD_FAILED') {
        message = t('error.mediapipeLoad');
      } else {
        message = error instanceof Error ? error.message : t('error.unknown');
      }
      this.setState('ERROR', message);
    }
  }

  pause(reason: AutoPauseReason = 'USER'): void {
    if (this.state !== 'ACTIVE') {
      return;
    }

    this.autoPauseReason = reason;
    this.isAttackWarning = false;
    void this.releaseWakeLock();
    this.setState('PAUSED');
  }

  resume(): void {
    if (this.state !== 'PAUSED') {
      return;
    }

    this.autoPauseReason = null;
    this.lowVisibilityStartTime = null;
    this.lastMonsterAttackTime = null;
    this.nextAttackProgress = 0;
    this.isAttackWarning = false;
    this.attackWarningTriggered = false;
    void this.requestWakeLock();
    this.setState('ACTIVE');
  }

  stop(): void {
    this.detachLifecycleListeners();
    void this.releaseWakeLock();
    this.poseTracker.dispose();
    this.soundFX.dispose();
    this.autoPauseReason = null;
    this.setState('IDLE');
  }

  reset(newEnemy?: MonsterStats): void {
    this.resetTrackingCounters();

    const store = useGameStore.getState();
    if (newEnemy) {
      store.startCombat(newEnemy);
    }

    if (this.state === 'VICTORY' || this.state === 'DEFEAT' || this.state === 'PAUSED') {
      void this.requestWakeLock();
      this.setState('ACTIVE');
    } else {
      this.setState('IDLE');
    }
  }

  async unlockAudio(): Promise<boolean> {
    await this.soundFX.init();
    const unlocked = this.soundFX.isUnlocked();
    this.notifyStateChange();
    return unlocked;
  }

  onStateChange(callback: SessionStateChangeCallback): () => void {
    this.stateChangeCallbacks.push(callback);
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index !== -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  getStatus(): SessionStatus {
    const store = useGameStore.getState();
    const enemy = store.currentEnemy;
    const attackIntervalMs = enemy ? getMonsterAttackIntervalMs(enemy) : 7000;

    return {
      state: this.state,
      exerciseState: this.lastExerciseState,
      currentEnemy: enemy,
      autoPauseReason: this.autoPauseReason,
      isAudioUnlocked: this.soundFX.isUnlocked(),
      bossPhase: this.lastBossPhase,
      nextAttackProgress: this.nextAttackProgress,
      monsterAttackIntervalMs: attackIntervalMs,
      isAttackWarning: this.isAttackWarning,
      lastCombatEvent: this.lastCombatEvent,
      lastMonsterAttackEvent: this.lastMonsterAttackEvent,
      victorySummary: this.victorySummary,
      fps: this.currentFps,
    };
  }

  /**
   * Public test/driver hook for processing pose frames deterministically.
   */
  processPoseFrame(
    landmarks: NormalizedLandmark[],
    timestamp: number,
    worldLandmarks?: Landmark[]
  ): void {
    this.handlePoseDetected(landmarks, timestamp, worldLandmarks);
  }

  private resetTrackingCounters(): void {
    this.exerciseDetector.reset();
    this.lastRepCount = 0;
    this.lastHoldTickSeconds = 0;
    this.lastBossPhase = 0;
    this.lastPhaseForAudio = 'IDLE';
    this.lowVisibilityStartTime = null;
    this.lastMonsterAttackTime = null;
    this.nextAttackProgress = 0;
    this.isAttackWarning = false;
    this.attackWarningTriggered = false;
    this.lastCombatEvent = null;
    this.lastMonsterAttackEvent = null;
    this.sessionAchievements = [];
    this.victorySummary = null;
    this.autoPauseReason = null;
    this.lastHudNotifyTime = -Infinity;
    this.lastNotifiedRepCount = -1;
    this.lastNotifiedPhase = null;
    this.lastNotifiedVisibility = null;
    this.lastNotifiedHolding = undefined;
    this.lastNotifiedWarning = false;
    this.lastNotifiedFps = -1;
    this.lastNotifiedCombatId = 0;
    this.lastNotifiedAttackId = 0;
  }

  private handlePoseDetected(
    landmarks: NormalizedLandmark[],
    timestamp: number,
    worldLandmarks?: Landmark[]
  ): void {
    if (this.state !== 'ACTIVE') {
      return;
    }

    this.updateFps(timestamp);

    const exerciseState = this.exerciseDetector.update(landmarks, timestamp, worldLandmarks);
    this.lastExerciseState = exerciseState;

    // Auto-pause if body stays invisible / poorly visible for > 5s
    if (exerciseState.visibility !== 'VISIBLE') {
      if (this.lowVisibilityStartTime === null) {
        this.lowVisibilityStartTime = timestamp;
      } else if (timestamp - this.lowVisibilityStartTime >= LOW_VISIBILITY_TIMEOUT_MS) {
        this.pause('LOW_VISIBILITY');
        return;
      }
    } else {
      this.lowVisibilityStartTime = null;
    }

    // Play subtle audio cue when hitting bottom/peak phase on rep exercises
    if (
      this.enableSound &&
      exerciseState.phase === 'TRANSITION' &&
      this.lastPhaseForAudio !== 'TRANSITION'
    ) {
      this.soundFX.play('BOTTOM_HIT');
    }
    this.lastPhaseForAudio = exerciseState.phase;

    // Rep-based damage
    const newReps = exerciseState.repCount - this.lastRepCount;
    if (newReps > 0) {
      this.lastRepCount = exerciseState.repCount;
      const store = useGameStore.getState();
      store.recordWorkoutProgress({ reps: newReps });
      const unlocked = store.syncAchievements();
      if (unlocked.length > 0) {
        this.sessionAchievements.push(...unlocked);
      }
      this.applyCombatHits(newReps);
      if (this.state !== 'ACTIVE') {
        return;
      }
    }

    // Hold-based damage (ticks every 1000ms of valid form hold)
    if (typeof exerciseState.holdDurationMs === 'number') {
      const totalHoldSeconds = Math.floor(exerciseState.holdDurationMs / HOLD_TICK_MS);
      const newHoldTicks = totalHoldSeconds - this.lastHoldTickSeconds;
      if (newHoldTicks > 0) {
        this.lastHoldTickSeconds = totalHoldSeconds;
        const store = useGameStore.getState();
        store.recordWorkoutProgress({ holdSeconds: newHoldTicks });
        const unlocked = store.syncAchievements();
        if (unlocked.length > 0) {
          this.sessionAchievements.push(...unlocked);
        }
        this.applyCombatHits(newHoldTicks);
        if (this.state !== 'ACTIVE') {
          return;
        }
      }
    }

    // Monster counter-attack timer (Plank holds act as a defensive block)
    this.processMonsterCounterAttack(timestamp, Boolean(exerciseState.isHolding));
    if (this.state !== 'ACTIVE') {
      return;
    }

    const discreteChanged =
      exerciseState.repCount !== this.lastNotifiedRepCount ||
      exerciseState.phase !== this.lastNotifiedPhase ||
      exerciseState.visibility !== this.lastNotifiedVisibility ||
      exerciseState.isHolding !== this.lastNotifiedHolding ||
      this.isAttackWarning !== this.lastNotifiedWarning ||
      this.currentFps !== this.lastNotifiedFps ||
      this.combatEventCounter !== this.lastNotifiedCombatId ||
      this.monsterAttackCounter !== this.lastNotifiedAttackId;

    if (discreteChanged || timestamp - this.lastHudNotifyTime >= HUD_UPDATE_INTERVAL_MS) {
      this.lastHudNotifyTime = timestamp;
      this.lastNotifiedRepCount = exerciseState.repCount;
      this.lastNotifiedPhase = exerciseState.phase;
      this.lastNotifiedVisibility = exerciseState.visibility;
      this.lastNotifiedHolding = exerciseState.isHolding;
      this.lastNotifiedWarning = this.isAttackWarning;
      this.lastNotifiedFps = this.currentFps;
      this.lastNotifiedCombatId = this.combatEventCounter;
      this.lastNotifiedAttackId = this.monsterAttackCounter;
      this.notifyStateChange();
    }
  }

  private processMonsterCounterAttack(timestamp: number, isBlocking: boolean): void {
    const store = useGameStore.getState();
    const enemy = store.currentEnemy;

    if (!enemy || isMonsterDead(enemy)) {
      this.nextAttackProgress = 0;
      this.isAttackWarning = false;
      this.attackWarningTriggered = false;
      return;
    }

    if (this.lastMonsterAttackTime === null) {
      this.lastMonsterAttackTime = timestamp;
      this.nextAttackProgress = 0;
      this.isAttackWarning = false;
      this.attackWarningTriggered = false;
      return;
    }

    const intervalMs = getMonsterAttackIntervalMs(enemy);
    const elapsed = Math.max(0, timestamp - this.lastMonsterAttackTime);
    this.nextAttackProgress = Math.min(1, elapsed / intervalMs);

    const warningNow = isMonsterAttackWarningActive(elapsed, intervalMs);
    this.isAttackWarning = warningNow;

    if (warningNow && !this.attackWarningTriggered) {
      this.attackWarningTriggered = true;
      if (this.enableSound) {
        this.soundFX.play('WARNING');
      }
      if (this.enableVoice) {
        this.soundFX.speak?.(t('battle.voiceWarning'), { rate: 1.05, pitch: 1.1 });
      }
    }

    if (elapsed < intervalMs) {
      return;
    }

    this.lastMonsterAttackTime = timestamp;
    this.nextAttackProgress = 0;
    this.isAttackWarning = false;
    this.attackWarningTriggered = false;

    const basePlayer = store.player;
    const effectivePlayer = getEffectivePlayerStats(
      basePlayer,
      store.inventory.equippedItems,
      ITEMS
    );

    const { damageTaken, wasBlocked } = calculateMonsterCounterAttack(
      effectivePlayer,
      enemy.attack,
      isBlocking
    );

    const updatedBaseHp = Math.max(0, basePlayer.hp - damageTaken);
    store.updatePlayer({ hp: updatedBaseHp });

    this.monsterAttackCounter++;
    this.lastMonsterAttackEvent = {
      id: this.monsterAttackCounter,
      damageTaken,
      wasBlocked,
      timestamp: Date.now(),
    };

    if (this.enableSound) {
      if (wasBlocked && damageTaken === 0) {
        this.soundFX.play('POWER_UP');
      } else if (wasBlocked) {
        this.soundFX.play('BOTTOM_HIT');
      } else {
        this.soundFX.play('DAMAGE');
      }
    }

    if (isPlayerDead({ ...basePlayer, hp: updatedBaseHp })) {
      this.onDefeat();
    }
  }

  private applyCombatHits(hits: number): void {
    const store = useGameStore.getState();
    let enemy = store.currentEnemy;

    if (!enemy) {
      if (this.enableSound) {
        this.soundFX.play('REP_COMPLETE');
      }
      return;
    }

    for (let i = 0; i < hits; i++) {
      const latestStore = useGameStore.getState();
      const basePlayer = latestStore.player;
      const effectivePlayer = getEffectivePlayerStats(
        basePlayer,
        latestStore.inventory.equippedItems,
        ITEMS
      );

      const { monster, player: updatedEffective, result } = applyDamageToMonster(
        effectivePlayer,
        enemy,
        this.exerciseDamageMultiplier
      );

      // Persist XP and permanent level-up stat deltas onto basePlayer (never bake gear bonuses)
      const levelDelta = updatedEffective.level - effectivePlayer.level;
      const newBasePlayer = {
        ...basePlayer,
        level: updatedEffective.level,
        xp: updatedEffective.xp,
        xpToNextLevel: updatedEffective.xpToNextLevel,
        maxHp: basePlayer.maxHp + levelDelta * 10,
        hp: Math.min(basePlayer.maxHp + levelDelta * 10, basePlayer.hp + levelDelta * 10),
        attack: basePlayer.attack + levelDelta * 2,
        defense: basePlayer.defense + levelDelta * 1,
      };

      latestStore.updatePlayer(newBasePlayer);
      latestStore.updateEnemy(monster);
      enemy = monster;

      const currentBossPhase = monster.isBoss ? getBossPhase(monster) : 0;
      const bossPhaseChanged = currentBossPhase !== this.lastBossPhase;
      if (bossPhaseChanged) {
        this.lastBossPhase = currentBossPhase;
      }

      this.combatEventCounter++;
      this.lastCombatEvent = {
        id: this.combatEventCounter,
        damage: result.damageDealt,
        wasCritical: result.wasCritical,
        bossPhase: currentBossPhase,
        bossPhaseChanged,
        timestamp: Date.now(),
      };

      if (this.enableSound) {
        if (result.wasCritical) {
          this.soundFX.play('COMBO');
        } else {
          this.soundFX.play('REP_COMPLETE');
        }
        if (bossPhaseChanged) {
          this.soundFX.play('DAMAGE');
        }
        if (result.playerLeveledUp) {
          this.soundFX.play('POWER_UP');
        }
      }

      if (isMonsterDead(monster)) {
        this.onVictory(result.xpGained, result.playerLeveledUp);
        return;
      }
    }
  }

  private onVictory(xpGained: number, leveledUp: boolean): void {
    const store = useGameStore.getState();

    let droppedItemId: string | null = null;
    let unlockedLevelId: string | null = null;

    if (this.levelId) {
      const level = getLevelById(this.levelId);
      if (level) {
        store.completeLevel(level.id);
        if (level.nextLevelId) {
          const alreadyUnlocked = store.unlockedLevels.includes(level.nextLevelId);
          store.unlockLevel(level.nextLevelId);
          if (!alreadyUnlocked) {
            unlockedLevelId = level.nextLevelId;
          }
        }
        droppedItemId = rollItemDrop(level.dropTable);
        if (droppedItemId) {
          store.addItem(droppedItemId, 1);
        }
      }
    }

    store.recordWorkoutProgress({ monstersDefeated: 1 });
    const unlockedOnVictory = store.syncAchievements();
    if (unlockedOnVictory.length > 0) {
      this.sessionAchievements.push(...unlockedOnVictory);
    }

    const uniqueAchievements = Array.from(new Set(this.sessionAchievements));

    this.victorySummary = {
      xpGained,
      leveledUp,
      droppedItemId,
      unlockedLevelId,
      newlyUnlockedAchievements: uniqueAchievements,
    };

    if (this.enableSound) {
      this.soundFX.play('VICTORY');
    }

    void this.releaseWakeLock();
    store.endCombat();
    this.setState('VICTORY');
  }

  private onDefeat(): void {
    const store = useGameStore.getState();

    if (this.enableSound) {
      this.soundFX.play('ERROR');
    }

    void this.releaseWakeLock();
    store.endCombat();
    this.setState('DEFEAT');
  }

  private updateFps(timestamp: number): void {
    this.frameCount++;

    if (timestamp - this.lastFpsUpdate >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = timestamp;
    }
  }

  private attachLifecycleListeners(): void {
    if (typeof document === 'undefined' || this.boundVisibilityHandler) {
      return;
    }

    this.boundVisibilityHandler = () => {
      if (document.hidden && this.state === 'ACTIVE') {
        this.pause('TAB_HIDDEN');
      }
    };
    document.addEventListener('visibilitychange', this.boundVisibilityHandler);
  }

  private detachLifecycleListeners(): void {
    if (typeof document !== 'undefined' && this.boundVisibilityHandler) {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      this.boundVisibilityHandler = null;
    }
  }

  private async requestWakeLock(): Promise<void> {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      // Wake Lock may be denied by browser power-saver or permission policy
      this.wakeLock = null;
    }
  }

  private async releaseWakeLock(): Promise<void> {
    if (!this.wakeLock) {
      return;
    }

    try {
      await this.wakeLock.release();
    } catch {
      // Ignore already released sentinel
    } finally {
      this.wakeLock = null;
    }
  }

  private setState(newState: SessionState, errorMessage?: string): void {
    this.state = newState;
    this.notifyStateChange(errorMessage);
  }

  private notifyStateChange(errorMessage?: string): void {
    const status: SessionStatus = {
      ...this.getStatus(),
      errorMessage,
    };

    this.stateChangeCallbacks.forEach((callback) => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in state change callback:', error);
      }
    });
  }
}

export function createExerciseDetector(
  exerciseId: ExerciseId,
  calibration: ExerciseCalibrationSettings = DEFAULT_EXERCISE_CALIBRATION
): ExerciseDetector {
  switch (exerciseId) {
    case 'SQUAT':
      return new SquatDetector({ bottomAngle: calibration.squatBottomAngle });
    case 'PUSH_UP':
      return new PushUpDetector({ bottomAngleThreshold: calibration.pushupBottomAngle });
    case 'PLANK':
      return new PlankDetector({ minBodyAngle: calibration.plankMinBodyAngle });
    case 'JUMPING_JACK':
      return new JumpingJackDetector({ peakArmAngle: calibration.jumpingJackPeakArmAngle });
  }
}

export function applyExerciseCalibration(
  detector: ExerciseDetector,
  exerciseId: ExerciseId,
  calibration: ExerciseCalibrationSettings
): void {
  switch (exerciseId) {
    case 'SQUAT':
      if (detector instanceof SquatDetector) {
        detector.configure({ bottomAngle: calibration.squatBottomAngle });
      }
      break;
    case 'PUSH_UP':
      if (detector instanceof PushUpDetector) {
        detector.configure({ bottomAngleThreshold: calibration.pushupBottomAngle });
      }
      break;
    case 'PLANK':
      if (detector instanceof PlankDetector) {
        detector.configure({ minBodyAngle: calibration.plankMinBodyAngle });
      }
      break;
    case 'JUMPING_JACK':
      if (detector instanceof JumpingJackDetector) {
        detector.configure({ peakArmAngle: calibration.jumpingJackPeakArmAngle });
      }
      break;
  }
}

export function createWorkoutSessionForBattle(params: {
  videoElement: HTMLVideoElement;
  canvasElement: HTMLCanvasElement;
  exerciseId: ExerciseId;
  levelId?: string;
}): WorkoutSession {
  const store = useGameStore.getState();
  const exerciseDef = EXERCISES[params.exerciseId];

  return new WorkoutSession({
    videoElement: params.videoElement,
    canvasElement: params.canvasElement,
    exerciseDetector: createExerciseDetector(
      params.exerciseId,
      store.settings.exerciseCalibration
    ),
    exerciseDamageMultiplier: exerciseDef.damageMultiplier,
    levelId: params.levelId,
    enableSound: store.settings.soundEnabled,
    enableVoice: store.settings.voiceEnabled,
    cameraFacingMode: store.settings.cameraFacingMode,
  });
}
