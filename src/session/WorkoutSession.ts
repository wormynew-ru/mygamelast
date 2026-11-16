/**
 * WorkoutSession - Coordinator layer that orchestrates CV, Combat, Audio, and Store.
 * ZERO React imports allowed. Pure business logic.
 *
 * Architecture:
 * PoseTracker -> ExerciseDetector -> CombatEngine -> store -> SoundFX
 */

import type { Landmark, NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { ExerciseDetector, ExerciseState } from '../vision/types';
import type {
  BattleRank,
  EquipmentLoadout,
  ExerciseCalibrationSettings,
  ExerciseMatchup,
  MonsterStats,
} from '../game/types';
import { PoseTracker, type TrackerError } from '../vision/PoseTracker';
import {
  SquatDetector,
  PushUpDetector,
  PlankDetector,
  JumpingJackDetector,
  ArmHoldDetector,
  WallSitDetector,
  OverheadPressDetector,
} from '../vision/exercises';
import {
  COMBO_WINDOW_BASE_MS,
  TOXIC_DEBUFF_DURATION_MS,
  ULTIMATE_CHARGE_MAX,
  applyBossPhaseTransition,
  applyDamageToMonster,
  calculateBattleRank,
  calculateMonsterCounterAttack,
  calculateTonnageDelta,
  calculateUltimateChargeGain,
  estimateWorkoutKcal,
  getBossPhase,
  getComboMultiplier,
  getEffectivePlayerStats,
  getExerciseMatchup,
  getMonsterAttackIntervalMs,
  isMonsterAttackWarningActive,
  isMonsterDead,
  isPlayerDead,
  levelUp,
  rollItemDrop,
} from '../game/CombatEngine';
import { getCircuitById } from '../game/data/circuits';
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
export type BattleMode = 'CAMPAIGN' | 'ENDLESS' | 'CIRCUIT';

export interface CombatEvent {
  id: number;
  damage: number;
  wasCritical: boolean;
  wasUltimate: boolean;
  bossPhase: number;
  bossPhaseChanged: boolean;
  matchup: ExerciseMatchup;
  comboCount: number;
  comboMultiplier: number;
  shieldHit: boolean;
  shieldBroken: boolean;
  timestamp: number;
}

export interface MonsterAttackEvent {
  id: number;
  damageTaken: number;
  wasBlocked: boolean;
  appliedToxicDebuff: boolean;
  timestamp: number;
}

export interface VictorySummary {
  xpGained: number;
  coinsEarned: number;
  rank: BattleRank;
  maxCombo: number;
  durationSec: number;
  estimatedKcal: number;
  tonnageKg: number;
  ultimateCount: number;
  leveledUp: boolean;
  droppedItemId: string | null;
  unlockedLevelId: string | null;
  newlyUnlockedAchievements: string[];
  mode: BattleMode;
  wave?: number;
  circuitId?: string;
  circuitRoomNumber?: number;
  circuitTotalRooms?: number;
  circuitCompleted?: boolean;
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
  comboCount: number;
  comboMultiplier: number;
  comboRemainingRatio: number;
  ultimateCharge: number;
  ultimateTriggeredCount: number;
  matchup: ExerciseMatchup;
  isPlayerDebuffed: boolean;
  debuffRemainingSec: number;
  debuffCleansedId: number;
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
  exerciseId?: ExerciseId;
  levelId?: string;
  mode?: BattleMode;
  endlessWave?: number;
  circuitId?: string;
  circuitRoomIndex?: number;
  loadout?: EquipmentLoadout;
  enableSound?: boolean;
  enableVoice?: boolean;
  cameraFacingMode?: 'user' | 'environment';
  targetPoseFps?: 30 | 60;
  /** Optional dependency injection for testing */
  poseTracker?: PoseTrackerLike;
  soundFX?: SoundFXLike;
}

const LOW_VISIBILITY_TIMEOUT_MS = 5000;
const HOLD_TICK_MS = 1000;
const HUD_UPDATE_INTERVAL_MS = 100;
const TOXIC_CLEANSE_HOLD_TICKS = 3;

const ENDLESS_DROP_TABLE = [
  { itemId: 'MEGA_RECOVERY_SMOOTHIE', chance: 0.25 },
  { itemId: 'PROTEIN_SHAKE', chance: 0.45 },
  { itemId: 'FITNESS_WRISTBANDS', chance: 0.15 },
  { itemId: 'ENERGY_BAR', chance: 0.6 },
];

export class WorkoutSession {
  private poseTracker: PoseTrackerLike;
  private soundFX: SoundFXLike;
  private exerciseDetector: ExerciseDetector;
  private exerciseDamageMultiplier: number;
  private exerciseId?: ExerciseId;
  private levelId?: string;
  private mode: BattleMode;
  private endlessWave: number;
  private circuitId?: string;
  private circuitRoomIndex: number;
  private loadoutOverride?: EquipmentLoadout;

  private videoElement: HTMLVideoElement;
  private canvasElement: HTMLCanvasElement;

  private state: SessionState = 'IDLE';
  private autoPauseReason: AutoPauseReason = null;
  private lastExerciseState: ExerciseState | null = null;
  private lastRepCount = 0;
  private lastHoldTickSeconds = 0;
  private consecutiveHoldTicks = 0;
  private lastBossPhase = 0;
  private lastPhaseForAudio: string = 'IDLE';
  private lowVisibilityStartTime: number | null = null;

  private lastMonsterAttackTime: number | null = null;
  private nextAttackProgress = 0;
  private isAttackWarning = false;
  private attackWarningTriggered = false;
  private lastMonsterAttackEvent: MonsterAttackEvent | null = null;
  private monsterAttackCounter = 0;

  private comboCount = 0;
  private maxComboInBattle = 0;
  private lastComboTimestamp: number | null = null;
  private comboRemainingRatio = 0;
  private ultimateCharge = 0;
  private ultimateTriggeredCount = 0;
  private debuffExpiresAt: number | null = null;
  private debuffRemainingSec = 0;
  private debuffCleansedId = 0;
  private battleActiveStartTs: number | null = null;
  private battleAccumulatedMs = 0;
  private totalDamageTakenInBattle = 0;
  private battleReps = 0;
  private battleHoldSeconds = 0;
  private battleTonnageKg = 0;
  private lastRecordedTimestamp = 0;

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
  private lastNotifiedCombo = 0;
  private lastNotifiedUltimate = 0;
  private lastNotifiedDebuffed = false;

  private wakeLock: WakeLockSentinel | null = null;
  private boundVisibilityHandler: (() => void) | null = null;
  private startToken = 0;

  constructor(config: WorkoutSessionConfig) {
    this.exerciseDetector = config.exerciseDetector;
    this.exerciseDamageMultiplier = config.exerciseDamageMultiplier;
    this.exerciseId = config.exerciseId;
    this.levelId = config.levelId;
    this.mode = config.mode ?? 'CAMPAIGN';
    this.endlessWave = config.endlessWave ?? 1;
    this.circuitId = config.circuitId;
    this.circuitRoomIndex = config.circuitRoomIndex ?? 0;
    this.loadoutOverride = config.loadout;
    this.enableSound = config.enableSound ?? true;
    this.enableVoice = config.enableVoice ?? false;
    this.videoElement = config.videoElement;
    this.canvasElement = config.canvasElement;

    const targetPoseFps = config.targetPoseFps ?? 60;
    this.poseTracker =
      config.poseTracker ??
      new PoseTracker(
        {
          facingMode: config.cameraFacingMode ?? 'user',
          frameRate: targetPoseFps,
        },
        {
          targetInferenceFPS: targetPoseFps,
        }
      );

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

    const token = ++this.startToken;
    this.setState('STARTING');

    try {
      if (this.enableSound) {
        await this.soundFX.init();
        if (token !== this.startToken) return;
      }

      await this.poseTracker.loadModel();
      if (token !== this.startToken) return;

      await this.poseTracker.startCamera(this.videoElement);
      if (token !== this.startToken) return;

      this.resetTrackingCounters();

      const store = useGameStore.getState();
      if (store.currentEnemy) {
        store.recordMonsterBestiary({
          monsterId: store.currentEnemy.id,
          defeated: false,
          weaknessDiscovered:
            Boolean(this.exerciseId && store.currentEnemy.weakTo === this.exerciseId),
        });
      }

      this.poseTracker.start(this.canvasElement);

      this.attachLifecycleListeners();
      await this.requestWakeLock();
      if (token !== this.startToken) {
        void this.releaseWakeLock();
        return;
      }

      this.setState('ACTIVE');

      if (this.enableSound) {
        this.soundFX.play('REP_COMPLETE');
      }
    } catch (error) {
      if (token !== this.startToken) {
        return;
      }
      const trackerErr = this.poseTracker.getError?.();
      const errName = error instanceof Error ? error.name : '';
      let message: string;
      if (
        trackerErr === 'CAMERA_NOT_FOUND' ||
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError'
      ) {
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

    if (this.battleActiveStartTs !== null && this.lastRecordedTimestamp >= this.battleActiveStartTs) {
      this.battleAccumulatedMs += this.lastRecordedTimestamp - this.battleActiveStartTs;
      this.battleActiveStartTs = null;
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
    this.battleActiveStartTs = null;
    void this.requestWakeLock();
    this.setState('ACTIVE');
  }

  stop(): void {
    this.startToken++;
    this.detachLifecycleListeners();
    void this.releaseWakeLock();
    this.poseTracker.dispose();
    this.soundFX.dispose();
    this.autoPauseReason = null;
    this.setState('IDLE');
  }

  reset(newEnemy?: MonsterStats, nextWave?: number): void {
    this.resetTrackingCounters();

    if (typeof nextWave === 'number') {
      this.endlessWave = nextWave;
    }

    const store = useGameStore.getState();
    if (newEnemy) {
      store.startCombat(newEnemy);
      store.recordMonsterBestiary({
        monsterId: newEnemy.id,
        defeated: false,
        weaknessDiscovered: Boolean(this.exerciseId && newEnemy.weakTo === this.exerciseId),
      });
    }

    if (this.state === 'VICTORY' || this.state === 'DEFEAT' || this.state === 'PAUSED') {
      void this.requestWakeLock();
      this.setState('ACTIVE');
    } else {
      this.setState('IDLE');
    }
  }

  /**
   * Switch enemy and exercise detector mid-run for Circuit Training Dungeons
   * without tearing down the active camera/MediaPipe stream.
   */
  advanceCircuitRoom(params: {
    nextEnemy: MonsterStats;
    exerciseId: ExerciseId;
    roomIndex: number;
    detector?: ExerciseDetector;
  }): void {
    const store = useGameStore.getState();
    const savedUlt = this.ultimateCharge;

    this.exerciseId = params.exerciseId;
    this.exerciseDamageMultiplier = EXERCISES[params.exerciseId].damageMultiplier;
    this.exerciseDetector =
      params.detector ??
      createExerciseDetector(params.exerciseId, store.settings.exerciseCalibration);
    this.circuitRoomIndex = params.roomIndex;

    this.resetTrackingCounters();
    this.ultimateCharge = savedUlt;

    store.startCombat(params.nextEnemy);
    store.recordMonsterBestiary({
      monsterId: params.nextEnemy.id,
      defeated: false,
      weaknessDiscovered: params.nextEnemy.weakTo === params.exerciseId,
    });

    if (this.state === 'VICTORY' || this.state === 'DEFEAT' || this.state === 'PAUSED') {
      void this.requestWakeLock();
      this.setState('ACTIVE');
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
    const matchup: ExerciseMatchup = enemy
      ? getExerciseMatchup(enemy, this.exerciseId)
      : 'NEUTRAL';

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
      comboCount: this.comboCount,
      comboMultiplier: getComboMultiplier(this.comboCount),
      comboRemainingRatio: this.comboRemainingRatio,
      ultimateCharge: this.ultimateCharge,
      ultimateTriggeredCount: this.ultimateTriggeredCount,
      matchup,
      isPlayerDebuffed: this.debuffExpiresAt !== null && this.debuffRemainingSec > 0,
      debuffRemainingSec: this.debuffRemainingSec,
      debuffCleansedId: this.debuffCleansedId,
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

  private getActiveLoadout(): EquipmentLoadout {
    return this.loadoutOverride ?? useGameStore.getState().loadout;
  }

  private resetTrackingCounters(): void {
    this.exerciseDetector.reset();
    this.lastRepCount = 0;
    this.lastHoldTickSeconds = 0;
    this.consecutiveHoldTicks = 0;
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

    this.comboCount = 0;
    this.maxComboInBattle = 0;
    this.lastComboTimestamp = null;
    this.comboRemainingRatio = 0;
    this.ultimateCharge = 0;
    this.ultimateTriggeredCount = 0;
    this.debuffExpiresAt = null;
    this.debuffRemainingSec = 0;
    this.debuffCleansedId = 0;
    this.battleActiveStartTs = null;
    this.battleAccumulatedMs = 0;
    this.totalDamageTakenInBattle = 0;
    this.battleReps = 0;
    this.battleHoldSeconds = 0;
    this.battleTonnageKg = 0;
    this.lastRecordedTimestamp = 0;

    this.lastHudNotifyTime = -Infinity;
    this.lastNotifiedRepCount = -1;
    this.lastNotifiedPhase = null;
    this.lastNotifiedVisibility = null;
    this.lastNotifiedHolding = undefined;
    this.lastNotifiedWarning = false;
    this.lastNotifiedFps = -1;
    this.lastNotifiedCombatId = 0;
    this.lastNotifiedAttackId = 0;
    this.lastNotifiedCombo = 0;
    this.lastNotifiedUltimate = 0;
    this.lastNotifiedDebuffed = false;
  }

  private handlePoseDetected(
    landmarks: NormalizedLandmark[],
    timestamp: number,
    worldLandmarks?: Landmark[]
  ): void {
    if (this.state !== 'ACTIVE') {
      return;
    }

    if (this.battleActiveStartTs === null) {
      this.battleActiveStartTs = timestamp;
    }
    this.lastRecordedTimestamp = timestamp;

    this.updateFps(timestamp);
    this.updateComboAndDebuffTimers(timestamp);

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

    if (!exerciseState.isHolding) {
      this.consecutiveHoldTicks = 0;
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

    const activeLoadout = this.getActiveLoadout();
    const loadoutWeightKg = activeLoadout.mode === 'DUMBBELLS' ? activeLoadout.weightKg : 0;

    // Rep-based damage
    const newReps = exerciseState.repCount - this.lastRepCount;
    if (newReps > 0) {
      this.lastRepCount = exerciseState.repCount;
      this.battleReps += newReps;

      const store = useGameStore.getState();
      const repKcal = this.exerciseId
        ? estimateWorkoutKcal({ [this.exerciseId]: { reps: newReps } }, loadoutWeightKg)
        : 0;
      const repTonnage = calculateTonnageDelta(this.exerciseId, newReps, 0, activeLoadout);
      this.battleTonnageKg = Math.round((this.battleTonnageKg + repTonnage) * 10) / 10;

      store.recordWorkoutProgress({
        reps: newReps,
        exerciseId: this.exerciseId,
        estimatedKcal: repKcal,
        tonnageKg: repTonnage,
      });

      this.applyCombatHits(newReps, timestamp, false);
      if (this.state !== 'ACTIVE') {
        return;
      }

      const unlocked = store.syncAchievements();
      if (unlocked.length > 0) {
        this.sessionAchievements.push(...unlocked);
      }
    }

    // Hold-based damage (ticks every 1000ms of valid form hold)
    if (typeof exerciseState.holdDurationMs === 'number') {
      const totalHoldSeconds = Math.floor(exerciseState.holdDurationMs / HOLD_TICK_MS);
      const newHoldTicks = totalHoldSeconds - this.lastHoldTickSeconds;
      if (newHoldTicks > 0) {
        this.lastHoldTickSeconds = totalHoldSeconds;
        this.battleHoldSeconds += newHoldTicks;
        this.consecutiveHoldTicks += newHoldTicks;

        // 3 consecutive static hold seconds cleanse active Toxic debuff
        if (this.debuffExpiresAt !== null && this.consecutiveHoldTicks >= TOXIC_CLEANSE_HOLD_TICKS) {
          this.debuffExpiresAt = null;
          this.debuffRemainingSec = 0;
          this.debuffCleansedId++;
          if (this.enableSound) {
            this.soundFX.play('POWER_UP');
          }
        }

        const store = useGameStore.getState();
        const holdKcal = this.exerciseId
          ? estimateWorkoutKcal(
              { [this.exerciseId]: { holdSeconds: newHoldTicks } },
              loadoutWeightKg
            )
          : 0;
        const holdTonnage = calculateTonnageDelta(this.exerciseId, 0, newHoldTicks, activeLoadout);
        this.battleTonnageKg = Math.round((this.battleTonnageKg + holdTonnage) * 10) / 10;

        store.recordWorkoutProgress({
          holdSeconds: newHoldTicks,
          exerciseId: this.exerciseId,
          estimatedKcal: holdKcal,
          tonnageKg: holdTonnage,
        });

        this.applyCombatHits(newHoldTicks, timestamp, true);
        if (this.state !== 'ACTIVE') {
          return;
        }

        const unlocked = store.syncAchievements();
        if (unlocked.length > 0) {
          this.sessionAchievements.push(...unlocked);
        }
      }
    }

    // Monster counter-attack timer (Static holds act as a defensive block)
    this.processMonsterCounterAttack(timestamp, Boolean(exerciseState.isHolding));
    if (this.state !== 'ACTIVE') {
      return;
    }

    const isDebuffedNow = this.debuffExpiresAt !== null && this.debuffRemainingSec > 0;
    const discreteChanged =
      exerciseState.repCount !== this.lastNotifiedRepCount ||
      exerciseState.phase !== this.lastNotifiedPhase ||
      exerciseState.visibility !== this.lastNotifiedVisibility ||
      exerciseState.isHolding !== this.lastNotifiedHolding ||
      this.isAttackWarning !== this.lastNotifiedWarning ||
      this.currentFps !== this.lastNotifiedFps ||
      this.combatEventCounter !== this.lastNotifiedCombatId ||
      this.monsterAttackCounter !== this.lastNotifiedAttackId ||
      this.comboCount !== this.lastNotifiedCombo ||
      this.ultimateCharge !== this.lastNotifiedUltimate ||
      isDebuffedNow !== this.lastNotifiedDebuffed;

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
      this.lastNotifiedCombo = this.comboCount;
      this.lastNotifiedUltimate = this.ultimateCharge;
      this.lastNotifiedDebuffed = isDebuffedNow;
      this.notifyStateChange();
    }
  }

  private updateComboAndDebuffTimers(timestamp: number): void {
    const store = useGameStore.getState();
    const effective = getEffectivePlayerStats(
      store.player,
      store.inventory.equippedItems,
      ITEMS
    );
    const windowMs = COMBO_WINDOW_BASE_MS + (effective.comboWindowBonusMs ?? 0);

    if (this.comboCount > 0 && this.lastComboTimestamp !== null) {
      const elapsedSinceHit = Math.max(0, timestamp - this.lastComboTimestamp);
      if (elapsedSinceHit > windowMs) {
        this.comboCount = 0;
        this.lastComboTimestamp = null;
        this.comboRemainingRatio = 0;
      } else {
        this.comboRemainingRatio = Math.max(0, 1 - elapsedSinceHit / windowMs);
      }
    } else {
      this.comboRemainingRatio = 0;
    }

    if (this.debuffExpiresAt !== null) {
      const remainingMs = this.debuffExpiresAt - timestamp;
      if (remainingMs <= 0) {
        this.debuffExpiresAt = null;
        this.debuffRemainingSec = 0;
      } else {
        this.debuffRemainingSec = Math.ceil(remainingMs / 1000);
      }
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

    let appliedToxicDebuff = false;
    if (wasBlocked) {
      this.debuffExpiresAt = null;
      this.debuffRemainingSec = 0;
    } else {
      // Unblocked counter-attack breaks hero combo streak
      this.comboCount = 0;
      this.lastComboTimestamp = null;
      this.comboRemainingRatio = 0;

      if (enemy.archetype === 'TOXIC') {
        this.debuffExpiresAt = timestamp + TOXIC_DEBUFF_DURATION_MS;
        this.debuffRemainingSec = Math.ceil(TOXIC_DEBUFF_DURATION_MS / 1000);
        appliedToxicDebuff = true;
      }
    }

    this.totalDamageTakenInBattle += damageTaken;

    const updatedBaseHp = Math.max(0, basePlayer.hp - damageTaken);
    store.updatePlayer({ hp: updatedBaseHp });

    this.monsterAttackCounter++;
    this.lastMonsterAttackEvent = {
      id: this.monsterAttackCounter,
      damageTaken,
      wasBlocked,
      appliedToxicDebuff,
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

  private applyCombatHits(hits: number, timestamp: number, isHoldTick: boolean): void {
    const store = useGameStore.getState();
    let enemy = store.currentEnemy;

    if (!enemy) {
      if (this.enableSound) {
        this.soundFX.play('REP_COMPLETE');
      }
      return;
    }

    const activeLoadout = this.getActiveLoadout();

    for (let i = 0; i < hits; i++) {
      this.comboCount += 1;
      this.lastComboTimestamp = timestamp;
      this.comboRemainingRatio = 1;
      if (this.comboCount > this.maxComboInBattle) {
        this.maxComboInBattle = this.comboCount;
      }

      const chargeGain = calculateUltimateChargeGain({
        isHoldTick,
        comboCount: this.comboCount,
      });
      this.ultimateCharge = Math.min(ULTIMATE_CHARGE_MAX, this.ultimateCharge + chargeGain);
      const isUltimate = this.ultimateCharge >= ULTIMATE_CHARGE_MAX;
      if (isUltimate) {
        this.ultimateCharge = 0;
        this.ultimateTriggeredCount += 1;
        // Overdrive strike stuns monster: reset counter-attack windup
        this.lastMonsterAttackTime = timestamp;
        this.nextAttackProgress = 0;
        this.isAttackWarning = false;
        this.attackWarningTriggered = false;
      }

      const latestStore = useGameStore.getState();
      const basePlayer = latestStore.player;
      const effectivePlayer = getEffectivePlayerStats(
        basePlayer,
        latestStore.inventory.equippedItems,
        ITEMS
      );

      const isDebuffed = this.debuffExpiresAt !== null && timestamp < this.debuffExpiresAt;

      const { monster: hitMonster, player: updatedEffective, result } = applyDamageToMonster(
        effectivePlayer,
        enemy,
        this.exerciseDamageMultiplier,
        {
          comboCount: this.comboCount,
          exerciseId: this.exerciseId,
          isDebuffed,
          loadout: activeLoadout,
          isUltimate,
        }
      );

      const currentBossPhase = hitMonster.isBoss ? getBossPhase(hitMonster) : 0;
      const bossPhaseChanged = currentBossPhase !== this.lastBossPhase;
      const monster =
        bossPhaseChanged && !isMonsterDead(hitMonster)
          ? applyBossPhaseTransition(hitMonster, this.lastBossPhase, currentBossPhase)
          : hitMonster;

      if (bossPhaseChanged) {
        this.lastBossPhase = currentBossPhase;
      }

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

      this.combatEventCounter++;
      this.lastCombatEvent = {
        id: this.combatEventCounter,
        damage: result.damageDealt,
        wasCritical: result.wasCritical,
        wasUltimate: result.wasUltimate,
        bossPhase: currentBossPhase,
        bossPhaseChanged,
        matchup: result.matchup,
        comboCount: this.comboCount,
        comboMultiplier: result.comboMultiplier,
        shieldHit: result.shieldHit,
        shieldBroken: result.shieldBroken,
        timestamp: Date.now(),
      };

      if (this.enableSound) {
        if (result.wasUltimate || result.playerLeveledUp) {
          this.soundFX.play('POWER_UP');
        } else if (result.shieldBroken || result.wasCritical) {
          this.soundFX.play('COMBO');
        } else {
          this.soundFX.play('REP_COMPLETE');
        }
        if (bossPhaseChanged) {
          this.soundFX.play('DAMAGE');
        }
      }

      if (isMonsterDead(monster)) {
        this.onVictory(monster, result.xpGained, result.playerLeveledUp, timestamp);
        return;
      }
    }
  }

  private onVictory(
    defeatedEnemy: MonsterStats,
    xpGained: number,
    leveledUp: boolean,
    timestamp: number
  ): void {
    const store = useGameStore.getState();
    const activeLoadout = this.getActiveLoadout();
    const loadoutWeightKg = activeLoadout.mode === 'DUMBBELLS' ? activeLoadout.weightKg : 0;

    const activeElapsedMs =
      this.battleAccumulatedMs +
      (this.battleActiveStartTs !== null ? Math.max(0, timestamp - this.battleActiveStartTs) : 0);
    const durationSec = Math.max(1, Math.round(activeElapsedMs / 1000));

    const effectivePlayer = getEffectivePlayerStats(
      store.player,
      store.inventory.equippedItems,
      ITEMS
    );

    const { rank, rewardMultiplier } = calculateBattleRank({
      damageTaken: this.totalDamageTakenInBattle,
      playerMaxHp: effectivePlayer.maxHp,
      maxCombo: this.maxComboInBattle,
      durationSec,
    });

    const baseCoins = defeatedEnemy.coinReward ?? 20;
    let coinsEarned = Math.round(baseCoins * rewardMultiplier);
    let totalXpGained = xpGained;
    let finalLeveledUp = leveledUp;

    const estimatedKcal = this.exerciseId
      ? estimateWorkoutKcal(
          {
            [this.exerciseId]: {
              reps: this.battleReps,
              holdSeconds: this.battleHoldSeconds,
            },
          },
          loadoutWeightKg
        )
      : 0;

    let droppedItemId: string | null = null;
    let unlockedLevelId: string | null = null;
    let circuitRoomNumber: number | undefined;
    let circuitTotalRooms: number | undefined;
    let circuitCompleted = false;
    let circuitsDelta = 0;

    if (this.mode === 'CAMPAIGN' && this.levelId) {
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
    } else if (this.mode === 'ENDLESS') {
      store.updateEndlessProgress(this.endlessWave, true);
      droppedItemId = rollItemDrop(ENDLESS_DROP_TABLE);
      if (droppedItemId) {
        store.addItem(droppedItemId, 1);
      }
    } else if (this.mode === 'CIRCUIT' && this.circuitId) {
      const circuit = getCircuitById(this.circuitId);
      if (circuit) {
        circuitTotalRooms = circuit.rooms.length;
        circuitRoomNumber = this.circuitRoomIndex + 1;
        if (this.circuitRoomIndex >= circuit.rooms.length - 1) {
          circuitCompleted = true;
          circuitsDelta = 1;
          coinsEarned += circuit.bonusCoins;
          totalXpGained += circuit.bonusXp;

          let updatedPlayer = { ...store.player, xp: store.player.xp + circuit.bonusXp };
          while (updatedPlayer.xp >= updatedPlayer.xpToNextLevel) {
            updatedPlayer = levelUp(updatedPlayer);
            finalLeveledUp = true;
          }
          store.updatePlayer(updatedPlayer);

          if (circuit.guaranteedLootPool.length > 0) {
            const idx = Math.floor(Math.random() * circuit.guaranteedLootPool.length);
            droppedItemId = circuit.guaranteedLootPool[idx];
            if (droppedItemId) {
              store.addItem(droppedItemId, 1);
            }
          }
        }
      }
    }

    store.recordMonsterBestiary({
      monsterId: defeatedEnemy.id,
      defeated: true,
      victorySec: durationSec,
      weaknessDiscovered: true,
    });

    store.recordWorkoutProgress({
      monstersDefeated: 1,
      maxCombo: this.maxComboInBattle,
      coinsEarned,
      circuitsCompleted: circuitsDelta,
      durationSec,
    });

    const unlockedOnVictory = store.syncAchievements();
    if (unlockedOnVictory.length > 0) {
      this.sessionAchievements.push(...unlockedOnVictory);
    }

    const uniqueAchievements = Array.from(new Set(this.sessionAchievements));

    this.victorySummary = {
      xpGained: totalXpGained,
      coinsEarned,
      rank,
      maxCombo: this.maxComboInBattle,
      durationSec,
      estimatedKcal,
      tonnageKg: this.battleTonnageKg,
      ultimateCount: this.ultimateTriggeredCount,
      leveledUp: finalLeveledUp,
      droppedItemId,
      unlockedLevelId,
      newlyUnlockedAchievements: uniqueAchievements,
      mode: this.mode,
      wave: this.mode === 'ENDLESS' ? this.endlessWave : undefined,
      circuitId: this.mode === 'CIRCUIT' ? this.circuitId : undefined,
      circuitRoomNumber,
      circuitTotalRooms,
      circuitCompleted,
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

    const activeElapsedMs =
      this.battleAccumulatedMs +
      (this.battleActiveStartTs !== null && this.lastRecordedTimestamp >= this.battleActiveStartTs
        ? this.lastRecordedTimestamp - this.battleActiveStartTs
        : 0);
    const durationSec = Math.max(0, Math.round(activeElapsedMs / 1000));
    if (durationSec > 0) {
      store.recordWorkoutProgress({ durationSec });
    }

    if (this.mode === 'ENDLESS') {
      store.updateEndlessProgress(Math.max(1, this.endlessWave - 1), false);
    }

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
    case 'ARM_HOLD':
      return new ArmHoldDetector({ minShoulderAngle: calibration.armHoldMinShoulderAngle });
    case 'WALL_SIT':
      return new WallSitDetector({ maxKneeAngle: calibration.wallSitMaxKneeAngle });
    case 'OVERHEAD_PRESS':
      return new OverheadPressDetector({ topAngle: calibration.overheadPressTopAngle });
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
    case 'ARM_HOLD':
      if (detector instanceof ArmHoldDetector) {
        detector.configure({ minShoulderAngle: calibration.armHoldMinShoulderAngle });
      }
      break;
    case 'WALL_SIT':
      if (detector instanceof WallSitDetector) {
        detector.configure({ maxKneeAngle: calibration.wallSitMaxKneeAngle });
      }
      break;
    case 'OVERHEAD_PRESS':
      if (detector instanceof OverheadPressDetector) {
        detector.configure({ topAngle: calibration.overheadPressTopAngle });
      }
      break;
  }
}

export function createWorkoutSessionForBattle(params: {
  videoElement: HTMLVideoElement;
  canvasElement: HTMLCanvasElement;
  exerciseId: ExerciseId;
  levelId?: string;
  mode?: BattleMode;
  endlessWave?: number;
  circuitId?: string;
  circuitRoomIndex?: number;
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
    exerciseId: params.exerciseId,
    levelId: params.levelId,
    mode: params.mode ?? 'CAMPAIGN',
    endlessWave: params.endlessWave ?? 1,
    circuitId: params.circuitId,
    circuitRoomIndex: params.circuitRoomIndex,
    loadout: store.loadout,
    enableSound: store.settings.soundEnabled,
    enableVoice: store.settings.voiceEnabled,
    cameraFacingMode: store.settings.cameraFacingMode,
    targetPoseFps: store.settings.targetPoseFps,
  });
}
