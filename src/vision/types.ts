/**
 * Core types for computer vision and exercise detection.
 * Pure data structures with ZERO dependencies on React, Zustand, or game logic.
 */

import type { Landmark, NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Exercise detection state machine phases.
 */
export type ExercisePhase = 'IDLE' | 'UP' | 'DOWN' | 'TRANSITION';

/**
 * Body visibility status for exercise detection.
 */
export type VisibilityStatus =
  | 'VISIBLE'       // All required landmarks visible with good confidence
  | 'LOW_VISIBILITY' // Some landmarks occluded or low confidence
  | 'NOT_VISIBLE';   // Critical landmarks missing

/**
 * Current state of an exercise detector.
 */
export interface ExerciseState {
  /** Current phase in the movement cycle */
  phase: ExercisePhase;

  /** Total completed repetitions (rep-based exercises only) */
  repCount: number;

  /** Movement progress within current rep (0.0 = start, 1.0 = peak) */
  progress: number;

  /** Body visibility status */
  visibility: VisibilityStatus;

  /** Whether user is currently holding correct pose (hold-based exercises only) */
  isHolding?: boolean;

  /** Total time holding correct pose in milliseconds (hold-based exercises only) */
  holdDurationMs?: number;

  /** Optional debugging info (e.g., current angles, thresholds) */
  debug?: Record<string, number | string>;
}

/**
 * Configurable thresholds for exercise detection.
 * Each detector exposes its own specific config extending this base.
 */
export interface ExerciseConfig {
  /** Minimum landmark visibility confidence (0.0-1.0) */
  minVisibility?: number;

  /** Smoothing factor for angle/position filtering (0.0-1.0, higher = more smoothing) */
  smoothingFactor?: number;
}

/**
 * Unified interface that ALL exercise detectors MUST implement.
 * Enables plugin-based architecture: add new exercises by implementing this interface.
 */
export interface ExerciseDetector<TConfig extends ExerciseConfig = ExerciseConfig> {
  /**
   * Reset detector state (rep count, phase, internal FSM).
   * Call when starting a new workout session or switching exercises.
   */
  reset(): void;

  /**
   * Process a single video frame with pose landmarks.
   * Updates internal FSM and rep counter based on body position.
   *
   * @param landmarks - MediaPipe pose landmarks (33 points)
   * @param timestamp - Frame timestamp in ms (for smoothing/velocity)
   * @param worldLandmarks - Optional MediaPipe 3D metric world landmarks
   * @returns Current exercise state
   */
  update(
    landmarks: NormalizedLandmark[],
    timestamp: number,
    worldLandmarks?: Landmark[]
  ): ExerciseState;

  /**
   * Update detector configuration (thresholds, smoothing params).
   * Allows runtime calibration without recreating detector instance.
   *
   * @param config - Partial config object (merges with current config)
   */
  configure(config: Partial<TConfig>): void;

  /**
   * Get current exercise state without processing a new frame.
   * Useful for reading state after update() or during pauses.
   */
  getState(): ExerciseState;

  /**
   * Get current configuration.
   */
  getConfig(): Readonly<TConfig>;
}

/**
 * MediaPipe PoseLandmarker indices for common body points.
 * Reference: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
export enum PoseLandmark {
  NOSE = 0,
  LEFT_EYE_INNER = 1,
  LEFT_EYE = 2,
  LEFT_EYE_OUTER = 3,
  RIGHT_EYE_INNER = 4,
  RIGHT_EYE = 5,
  RIGHT_EYE_OUTER = 6,
  LEFT_EAR = 7,
  RIGHT_EAR = 8,
  MOUTH_LEFT = 9,
  MOUTH_RIGHT = 10,
  LEFT_SHOULDER = 11,
  RIGHT_SHOULDER = 12,
  LEFT_ELBOW = 13,
  RIGHT_ELBOW = 14,
  LEFT_WRIST = 15,
  RIGHT_WRIST = 16,
  LEFT_PINKY = 17,
  RIGHT_PINKY = 18,
  LEFT_INDEX = 19,
  RIGHT_INDEX = 20,
  LEFT_THUMB = 21,
  RIGHT_THUMB = 22,
  LEFT_HIP = 23,
  RIGHT_HIP = 24,
  LEFT_KNEE = 25,
  RIGHT_KNEE = 26,
  LEFT_ANKLE = 27,
  RIGHT_ANKLE = 28,
  LEFT_HEEL = 29,
  RIGHT_HEEL = 30,
  LEFT_FOOT_INDEX = 31,
  RIGHT_FOOT_INDEX = 32,
}

/**
 * 2D point with visibility confidence.
 */
export interface Point2D {
  x: number;
  y: number;
  visibility?: number;
}

/**
 * 3D point with visibility confidence.
 */
export interface Point3D extends Point2D {
  z: number;
}
