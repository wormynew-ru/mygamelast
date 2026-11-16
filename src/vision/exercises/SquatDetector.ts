/**
 * Squat exercise detector using knee angle FSM with hysteresis.
 *
 * Detection logic:
 * - Measures knee angle (hip-knee-ankle)
 * - FSM: IDLE -> DESCENDING -> BOTTOM -> ASCENDING -> IDLE
 * - Uses hysteresis to prevent double-counting from jitter
 * - Validates full range of motion (must reach bottom threshold)
 *
 * ZERO dependencies on React, Zustand, or game logic.
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
  angle2D,
  distance2D,
  ema,
  isVisible,
  mapRange,
} from '../angleMath';
import {
  PoseLandmark,
  type ExerciseDetector,
  type ExerciseConfig,
  type ExerciseState,
  type VisibilityStatus,
} from '../types';

/**
 * Squat-specific FSM phases.
 */
type SquatPhase = 'IDLE' | 'DESCENDING' | 'BOTTOM' | 'ASCENDING';

/**
 * Squat detector configuration.
 */
export interface SquatConfig extends ExerciseConfig {
  /** Knee angle (degrees) for standing position (default: 160) */
  standingAngle: number;

  /** Knee angle (degrees) for bottom position (default: 90) */
  bottomAngle: number;

  /** Hysteresis zone (degrees) to prevent oscillation (default: 10) */
  hysteresis: number;

  /** Smoothing factor for angle filtering (0-1, default: 0.3) */
  smoothingFactor: number;

  /** Minimum visibility confidence (0-1, default: 0.55) */
  minVisibility: number;

  /** Minimum time (ms) to hold bottom position before counting rep (default: 200) */
  minBottomHoldTime: number;
}

/**
 * Default squat configuration (calibrated for average flexibility).
 */
const DEFAULT_CONFIG: SquatConfig = {
  standingAngle: 160,
  bottomAngle: 90,
  hysteresis: 10,
  smoothingFactor: 0.3,
  minVisibility: 0.55,
  minBottomHoldTime: 200,
};

/**
 * Squat exercise detector.
 * Tracks knee angle through full squat range of motion.
 */
export class SquatDetector implements ExerciseDetector<SquatConfig> {
  private config: SquatConfig;
  private phase: SquatPhase = 'IDLE';
  private repCount = 0;
  private smoothedKneeAngle = 180; // Start at standing
  private hasInitializedAngle = false;
  private visibility: VisibilityStatus = 'NOT_VISIBLE';

  // FSM timing and validation
  private bottomEntryTime: number | null = null;
  private reachedBottom = false; // Must reach bottom for valid rep

  constructor(config: Partial<SquatConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.phase = 'IDLE';
    this.repCount = 0;
    this.smoothedKneeAngle = 180;
    this.hasInitializedAngle = false;
    this.visibility = 'NOT_VISIBLE';
    this.bottomEntryTime = null;
    this.reachedBottom = false;
  }

  update(landmarks: NormalizedLandmark[], timestamp: number): ExerciseState {
    const minVis = this.config.minVisibility;

    const lHip = landmarks[PoseLandmark.LEFT_HIP];
    const lKnee = landmarks[PoseLandmark.LEFT_KNEE];
    const lAnkle = landmarks[PoseLandmark.LEFT_ANKLE];
    const leftVisible =
      isVisible(lHip, minVis) &&
      isVisible(lKnee, minVis) &&
      isVisible(lAnkle, minVis) &&
      distance2D(lHip, lKnee) > 0.01 &&
      distance2D(lKnee, lAnkle) > 0.01;

    const rHip = landmarks[PoseLandmark.RIGHT_HIP];
    const rKnee = landmarks[PoseLandmark.RIGHT_KNEE];
    const rAnkle = landmarks[PoseLandmark.RIGHT_ANKLE];
    const rightVisible =
      isVisible(rHip, minVis) &&
      isVisible(rKnee, minVis) &&
      isVisible(rAnkle, minVis) &&
      distance2D(rHip, rKnee) > 0.01 &&
      distance2D(rKnee, rAnkle) > 0.01;

    if (!leftVisible && !rightVisible) {
      this.visibility = 'LOW_VISIBILITY';
      // Don't update FSM when body not visible, but keep current state
      return this.getState();
    }

    this.visibility = 'VISIBLE';

    // Use bilateral average when both legs are clearly tracked, else whichever leg is visible
    let rawKneeAngle: number;
    if (leftVisible && rightVisible) {
      rawKneeAngle = (angle2D(lHip, lKnee, lAnkle) + angle2D(rHip, rKnee, rAnkle)) * 0.5;
    } else if (leftVisible) {
      rawKneeAngle = angle2D(lHip, lKnee, lAnkle);
    } else {
      rawKneeAngle = angle2D(rHip, rKnee, rAnkle);
    }

    // Initialize immediately on first valid frame to prevent warmup lag
    if (!this.hasInitializedAngle) {
      this.smoothedKneeAngle = rawKneeAngle;
      this.hasInitializedAngle = true;
    } else {
      this.smoothedKneeAngle = ema(
        rawKneeAngle,
        this.smoothedKneeAngle,
        this.config.smoothingFactor
      );
    }

    // FSM update with hysteresis
    this.updateFSM(this.smoothedKneeAngle, timestamp);

    return this.getState();
  }

  private updateFSM(kneeAngle: number, timestamp: number): void {
    const { standingAngle, bottomAngle, hysteresis, minBottomHoldTime } = this.config;

    // Define thresholds with hysteresis zones
    const descendThreshold = standingAngle - hysteresis;
    const bottomEnterThreshold = bottomAngle + hysteresis;
    const bottomExitThreshold = bottomAngle + hysteresis * 1.5; // Reduced for easier exit after hold
    const standingThreshold = standingAngle - hysteresis;

    switch (this.phase) {
      case 'IDLE':
        // Start descending when knee angle drops below standing
        if (kneeAngle < descendThreshold) {
          this.phase = 'DESCENDING';
          this.reachedBottom = false; // Reset validation flag
        }
        break;

      case 'DESCENDING':
        // Reached bottom position
        if (kneeAngle <= bottomEnterThreshold) {
          this.phase = 'BOTTOM';
          this.bottomEntryTime = timestamp;
          this.reachedBottom = true; // Mark as valid deep squat
        }
        // Returned to standing without reaching bottom (incomplete rep)
        else if (kneeAngle > standingThreshold) {
          this.phase = 'IDLE';
          this.reachedBottom = false;
        }
        break;

      case 'BOTTOM':
        // Hold bottom briefly to confirm position (prevents bouncing)
        if (this.bottomEntryTime !== null) {
          const holdDuration = timestamp - this.bottomEntryTime;

          // Start ascending after minimum hold time
          if (holdDuration >= minBottomHoldTime && kneeAngle > bottomExitThreshold) {
            this.phase = 'ASCENDING';
            this.bottomEntryTime = null;
          }
        }
        break;

      case 'ASCENDING':
        // Returned to standing - count rep if bottom was reached
        if (kneeAngle >= standingThreshold) {
          if (this.reachedBottom) {
            this.repCount++;
            this.reachedBottom = false;
          }
          this.phase = 'IDLE';
        }
        // Started descending again before reaching standing (only if going back below bottom zone)
        else if (kneeAngle < bottomEnterThreshold) {
          this.phase = 'DESCENDING';
          this.reachedBottom = false;
        }
        break;
    }
  }

  configure(config: Partial<SquatConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getState(): ExerciseState {
    // Calculate progress within current rep (0 = standing, 1 = bottom)
    const progress = this.calculateProgress();

    return {
      phase: this.mapPhaseToGeneric(this.phase),
      repCount: this.repCount,
      progress,
      visibility: this.visibility,
      debug: {
        kneeAngle: Math.round(this.smoothedKneeAngle),
        phase: this.phase,
        reachedBottom: String(this.reachedBottom),
        standingThreshold: this.config.standingAngle,
        bottomThreshold: this.config.bottomAngle,
      },
    };
  }

  getConfig(): Readonly<SquatConfig> {
    return { ...this.config };
  }

  /**
   * Map squat-specific phase to generic ExercisePhase.
   */
  private mapPhaseToGeneric(phase: SquatPhase): ExerciseState['phase'] {
    switch (phase) {
      case 'IDLE':
        return 'IDLE';
      case 'DESCENDING':
        return 'DOWN';
      case 'BOTTOM':
        return 'TRANSITION';
      case 'ASCENDING':
        return 'UP';
    }
  }

  /**
   * Calculate movement progress (0 = standing, 1 = bottom).
   */
  private calculateProgress(): number {
    const { standingAngle, bottomAngle } = this.config;

    // Map knee angle to progress (inverted: smaller angle = more progress)
    return mapRange(
      this.smoothedKneeAngle,
      standingAngle,
      bottomAngle,
      0.0,
      1.0,
      true
    );
  }
}
