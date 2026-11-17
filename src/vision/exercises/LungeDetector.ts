/**
 * LungeDetector - Rep-based lunge detector (bilateral / lead-leg knee flexion).
 *
 * Detection logic:
 * - Evaluates visible hip -> knee -> ankle angles on left and right legs
 * - Uses minimum (most flexed) knee angle across visible legs so front, side,
 *   and 3/4 views all trigger smoothly on the lead knee
 * - FSM: IDLE -> DESCENDING -> BOTTOM (minBottomHoldTime) -> ASCENDING -> IDLE (rep++)
 * - Uses EMA smoothing and hysteresis to prevent double-counting from jitter
 *
 * ZERO dependencies on React, Zustand, or game logic.
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { angle2D, ema, isVisible, mapRange } from '../angleMath';
import {
  PoseLandmark,
  type ExerciseConfig,
  type ExerciseDetector,
  type ExerciseState,
  type VisibilityStatus,
} from '../types';

type LungePhase = 'IDLE' | 'DESCENDING' | 'BOTTOM' | 'ASCENDING';

export interface LungeConfig extends ExerciseConfig {
  /** Standing knee angle threshold in degrees (default: 158) */
  standingAngle: number;

  /** Bottom lunge knee angle threshold in degrees (default: 95) */
  bottomAngle: number;

  /** Hysteresis zone in degrees for state transitions (default: 10) */
  hysteresis: number;

  /** Smoothing factor for EMA filtering (0-1, default: 0.35) */
  smoothingFactor: number;

  /** Minimum landmark visibility confidence (0-1, default: 0.55) */
  minVisibility: number;

  /** Minimum time in BOTTOM phase in ms (default: 80) */
  minBottomHoldTime: number;
}

const DEFAULT_CONFIG: LungeConfig = {
  standingAngle: 158,
  bottomAngle: 95,
  hysteresis: 10,
  smoothingFactor: 0.35,
  minVisibility: 0.55,
  minBottomHoldTime: 80,
};

export class LungeDetector implements ExerciseDetector<LungeConfig> {
  private config: LungeConfig;
  private phase: LungePhase = 'IDLE';
  private repCount = 0;
  private smoothedKneeAngle = 175;
  private hasInitialized = false;
  private visibility: VisibilityStatus = 'NOT_VISIBLE';
  private bottomEnterTime = 0;
  private reachedBottom = false;

  constructor(config: Partial<LungeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.phase = 'IDLE';
    this.repCount = 0;
    this.smoothedKneeAngle = 175;
    this.hasInitialized = false;
    this.visibility = 'NOT_VISIBLE';
    this.bottomEnterTime = 0;
    this.reachedBottom = false;
  }

  update(landmarks: NormalizedLandmark[], timestamp: number): ExerciseState {
    const minVis = this.config.minVisibility;

    const lHip = landmarks[PoseLandmark.LEFT_HIP];
    const lKnee = landmarks[PoseLandmark.LEFT_KNEE];
    const lAnkle = landmarks[PoseLandmark.LEFT_ANKLE];
    const leftVisible =
      isVisible(lHip, minVis) && isVisible(lKnee, minVis) && isVisible(lAnkle, minVis);

    const rHip = landmarks[PoseLandmark.RIGHT_HIP];
    const rKnee = landmarks[PoseLandmark.RIGHT_KNEE];
    const rAnkle = landmarks[PoseLandmark.RIGHT_ANKLE];
    const rightVisible =
      isVisible(rHip, minVis) && isVisible(rKnee, minVis) && isVisible(rAnkle, minVis);

    if (!leftVisible && !rightVisible) {
      this.visibility = 'LOW_VISIBILITY';
      return this.getState();
    }

    this.visibility = 'VISIBLE';

    let rawKneeAngle: number;
    if (leftVisible && rightVisible) {
      rawKneeAngle = Math.min(
        angle2D(lHip, lKnee, lAnkle),
        angle2D(rHip, rKnee, rAnkle)
      );
    } else if (leftVisible) {
      rawKneeAngle = angle2D(lHip, lKnee, lAnkle);
    } else {
      rawKneeAngle = angle2D(rHip, rKnee, rAnkle);
    }

    if (!this.hasInitialized) {
      this.smoothedKneeAngle = rawKneeAngle;
      this.hasInitialized = true;
    } else {
      this.smoothedKneeAngle = ema(
        rawKneeAngle,
        this.smoothedKneeAngle,
        this.config.smoothingFactor
      );
    }

    this.updateFSM(this.smoothedKneeAngle, timestamp);
    return this.getState();
  }

  configure(config: Partial<LungeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getState(): ExerciseState {
    return {
      phase: this.mapPhaseToGeneric(this.phase),
      repCount: this.repCount,
      progress: this.calculateProgress(),
      visibility: this.visibility,
      debug: {
        kneeAngle: Math.round(this.smoothedKneeAngle),
        phase: this.phase,
        reachedBottom: String(this.reachedBottom),
      },
    };
  }

  getConfig(): Readonly<LungeConfig> {
    return { ...this.config };
  }

  private updateFSM(angle: number, timestamp: number): void {
    const { standingAngle, bottomAngle, hysteresis, minBottomHoldTime } = this.config;

    const descentStartThreshold = standingAngle - hysteresis;
    const bottomEnterThreshold = bottomAngle + hysteresis;
    const bottomExitThreshold = bottomAngle + hysteresis * 1.5;
    const standingReturnThreshold = standingAngle - hysteresis * 0.5;

    switch (this.phase) {
      case 'IDLE':
        if (angle < descentStartThreshold) {
          this.phase = 'DESCENDING';
          this.reachedBottom = false;
        }
        break;

      case 'DESCENDING':
        if (angle <= bottomEnterThreshold) {
          this.phase = 'BOTTOM';
          this.bottomEnterTime = timestamp;
          this.reachedBottom = minBottomHoldTime <= 0;
        } else if (angle >= standingReturnThreshold) {
          this.phase = 'IDLE';
          this.reachedBottom = false;
        }
        break;

      case 'BOTTOM':
        if (timestamp - this.bottomEnterTime >= minBottomHoldTime) {
          this.reachedBottom = true;
        }
        if (angle > bottomExitThreshold) {
          this.phase = 'ASCENDING';
        }
        break;

      case 'ASCENDING':
        if (angle >= standingReturnThreshold) {
          if (this.reachedBottom) {
            this.repCount++;
            this.reachedBottom = false;
          }
          this.phase = 'IDLE';
        } else if (angle <= bottomEnterThreshold) {
          this.phase = 'BOTTOM';
          this.bottomEnterTime = timestamp;
        }
        break;
    }
  }

  private mapPhaseToGeneric(phase: LungePhase): ExerciseState['phase'] {
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

  private calculateProgress(): number {
    const { standingAngle, bottomAngle } = this.config;
    return mapRange(this.smoothedKneeAngle, standingAngle, bottomAngle, 0.0, 1.0, true);
  }
}
