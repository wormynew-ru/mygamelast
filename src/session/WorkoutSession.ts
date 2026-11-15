/**
 * WorkoutSession - Coordinator layer that orchestrates CV, Combat, Audio, and Store.
 * ZERO React imports allowed. Pure business logic.
 *
 * Architecture:
 * PoseTracker → ExerciseDetector → CombatEngine → store → SoundFX
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { ExerciseDetector, ExerciseState } from '../vision/types';
import type { MonsterStats } from '../game/types';
import { PoseTracker } from '../vision/PoseTracker';
import { applyDamageToMonster, isMonsterDead, getBossPhase } from '../game/CombatEngine';
import { SoundFX } from '../audio/SoundFX';
import { useGameStore } from '../game/store';

/**
 * Workout session state.
 */
export type SessionState =
  | 'IDLE'          // Not started
  | 'STARTING'      // Initializing camera/MediaPipe
  | 'ACTIVE'        // Workout in progress
  | 'PAUSED'        // Paused by user
  | 'VICTORY'       // Monster defeated
  | 'DEFEAT'        // Player died
  | 'ERROR';        // Fatal error (camera permission denied, etc.)

/**
 * Session status for UI consumption.
 */
export interface SessionStatus {
  state: SessionState;
  exerciseState: ExerciseState | null;
  currentEnemy: MonsterStats | null;
  errorMessage?: string;

  // Performance metrics
  fps?: number;
  lastFrameTime?: number;
}

/**
 * Callback fired when session state changes.
 */
export type SessionStateChangeCallback = (status: SessionStatus) => void;

/**
 * WorkoutSession configuration.
 */
export interface WorkoutSessionConfig {
  /** Video element to render camera feed */
  videoElement: HTMLVideoElement;

  /** Canvas element for skeleton overlay */
  canvasElement: HTMLCanvasElement;

  /** Exercise detector instance */
  exerciseDetector: ExerciseDetector;

  /** Exercise damage multiplier (from exercise config) */
  exerciseDamageMultiplier: number;

  /** Optional: enable sound effects */
  enableSound?: boolean;
}

/**
 * WorkoutSession class.
 * Orchestrates the entire workout flow from camera to combat to audio.
 */
export class WorkoutSession {
  private poseTracker: PoseTracker;
  private soundFX: SoundFX;
  private exerciseDetector: ExerciseDetector;
  private exerciseDamageMultiplier: number;

  private videoElement: HTMLVideoElement;
  private canvasElement: HTMLCanvasElement;

  private state: SessionState = 'IDLE';
  private lastExerciseState: ExerciseState | null = null;
  private lastRepCount = 0;
  private lastBossPhase = 0;

  private stateChangeCallbacks: SessionStateChangeCallback[] = [];

  private enableSound: boolean;

  // Performance tracking
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private currentFps = 0;

  constructor(config: WorkoutSessionConfig) {
    this.exerciseDetector = config.exerciseDetector;
    this.exerciseDamageMultiplier = config.exerciseDamageMultiplier;
    this.enableSound = config.enableSound ?? true;
    this.videoElement = config.videoElement;
    this.canvasElement = config.canvasElement;

    // Initialize PoseTracker
    this.poseTracker = new PoseTracker();

    // Subscribe to pose detection events
    this.poseTracker.onPose(this.handlePoseDetected.bind(this));

    // Initialize SoundFX
    this.soundFX = new SoundFX({ enabled: this.enableSound });
  }

  /**
   * Start the workout session.
   * Initializes camera, MediaPipe, and starts combat.
   */
  async start(): Promise<void> {
    if (this.state !== 'IDLE' && this.state !== 'ERROR') {
      console.warn('Session already started');
      return;
    }

    this.setState('STARTING');

    try {
      // Initialize sound (requires user gesture)
      if (this.enableSound) {
        await this.soundFX.init();
      }

      // Load MediaPipe model
      await this.poseTracker.loadModel();

      // Start camera
      await this.poseTracker.startCamera(this.videoElement);

      // Reset exercise detector
      this.exerciseDetector.reset();
      this.lastRepCount = 0;
      this.lastBossPhase = 0;

      // Start pose detection loop
      this.poseTracker.start(this.canvasElement);

      this.setState('ACTIVE');

      // Play start sound
      if (this.enableSound) {
        this.soundFX.play('REP_COMPLETE');
      }

    } catch (error) {
      console.error('Failed to start workout session:', error);
      this.setState('ERROR', (error as Error).message);
    }
  }

  /**
   * Pause the workout session.
   * Camera keeps running, but combat and rep counting pause.
   */
  pause(): void {
    if (this.state !== 'ACTIVE') {
      return;
    }

    this.setState('PAUSED');
  }

  /**
   * Resume the workout session from pause.
   */
  resume(): void {
    if (this.state !== 'PAUSED') {
      return;
    }

    this.setState('ACTIVE');
  }

  /**
   * Stop and cleanup the workout session.
   * Releases camera and MediaPipe resources.
   */
  stop(): void {
    this.poseTracker.stop();
    this.setState('IDLE');
  }

  /**
   * Reset the workout session without stopping camera.
   * Useful for "Try Again" after defeat/victory.
   */
  reset(): void {
    this.exerciseDetector.reset();
    this.lastRepCount = 0;
    this.lastBossPhase = 0;

    const store = useGameStore.getState();
    store.endCombat();

    this.setState('IDLE');
  }

  /**
   * Subscribe to session state changes.
   */
  onStateChange(callback: SessionStateChangeCallback): () => void {
    this.stateChangeCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index !== -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get current session status.
   */
  getStatus(): SessionStatus {
    const store = useGameStore.getState();

    return {
      state: this.state,
      exerciseState: this.lastExerciseState,
      currentEnemy: store.currentEnemy,
      fps: this.currentFps,
    };
  }

  /**
   * Handle pose landmarks from PoseTracker.
   * Core loop: CV → Exercise → Combat → Audio → Store
   */
  private handlePoseDetected(landmarks: NormalizedLandmark[], timestamp: number): void {
    // Skip if not in active state
    if (this.state !== 'ACTIVE') {
      return;
    }

    // Update FPS counter
    this.updateFps(timestamp);

    // 1. Update exercise detector
    const exerciseState = this.exerciseDetector.update(landmarks, timestamp);
    this.lastExerciseState = exerciseState;

    // 2. Check for new rep
    const newReps = exerciseState.repCount - this.lastRepCount;
    if (newReps > 0) {
      this.onRepCompleted(newReps);
    }

    // 3. Check for boss phase change
    const store = useGameStore.getState();
    if (store.currentEnemy?.isBoss) {
      const currentPhase = getBossPhase(store.currentEnemy);
      if (currentPhase !== this.lastBossPhase) {
        this.onBossPhaseChange(currentPhase);
        this.lastBossPhase = currentPhase;
      }
    }

    // 4. Notify state change listeners
    this.notifyStateChange();
  }

  /**
   * Handle rep completion: apply damage, check victory/defeat, play sounds.
   */
  private onRepCompleted(repsCompleted: number): void {
    const store = useGameStore.getState();
    const enemy = store.currentEnemy;

    if (!enemy) {
      // No combat active, just count reps and play sound
      this.lastRepCount += repsCompleted;
      if (this.enableSound) {
        this.soundFX.play('REP_COMPLETE');
      }
      return;
    }

    // Apply damage for each rep
    for (let i = 0; i < repsCompleted; i++) {
      const player = store.player;

      const { monster, player: updatedPlayer, result } = applyDamageToMonster(
        player,
        enemy,
        this.exerciseDamageMultiplier
      );

      // Update store
      store.updatePlayer(updatedPlayer);
      store.updateEnemy(monster);

      // Play sounds
      if (this.enableSound) {
        if (result.wasCritical) {
          this.soundFX.play('COMBO'); // Crit sound
        } else {
          this.soundFX.play('REP_COMPLETE');
        }

        if (result.playerLeveledUp) {
          this.soundFX.play('POWER_UP');
        }
      }

      // Check victory
      if (isMonsterDead(monster)) {
        this.onVictory();
        return;
      }
    }

    this.lastRepCount += repsCompleted;
  }

  /**
   * Handle boss phase change.
   */
  private onBossPhaseChange(newPhase: number): void {
    console.log(`Boss entered phase ${newPhase}`);

    // Play phase transition sound
    if (this.enableSound) {
      this.soundFX.play('DAMAGE'); // Boss roar/warning sound
    }

    // TODO: Show phase transition UI animation
  }

  /**
   * Handle victory (monster defeated).
   */
  private onVictory(): void {
    const store = useGameStore.getState();

    // Play victory sound
    if (this.enableSound) {
      this.soundFX.play('VICTORY');
    }

    // End combat
    store.endCombat();

    this.setState('VICTORY');
  }

  /**
   * Update FPS counter.
   */
  private updateFps(timestamp: number): void {
    this.frameCount++;

    if (timestamp - this.lastFpsUpdate >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = timestamp;
    }
  }

  /**
   * Set session state and notify listeners.
   */
  private setState(newState: SessionState, errorMessage?: string): void {
    this.state = newState;

    this.notifyStateChange(errorMessage);
  }

  /**
   * Notify all state change listeners.
   */
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
