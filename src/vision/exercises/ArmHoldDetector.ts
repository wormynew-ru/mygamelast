/**
 * ArmHoldDetector - Hold-based lateral arm hold (T-pose / isometric shoulder hold).
 * Front-facing camera exercise usable with empty hands or light dumbbells.
 *
 * Detection logic:
 * - Measures bilateral shoulder abduction angle (hip -> shoulder -> wrist)
 * - Measures bilateral elbow straightness (shoulder -> elbow -> wrist)
 * - Enforces gracePeriodMs before micro-adjustments break the hold
 * - Emits isHolding boolean + holdDurationMs for combat ticks, block, & toxic cleanse
 *
 * ZERO dependencies on React, Zustand, or game logic.
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { angle2D, ema, isVisible } from '../angleMath';
import {
  PoseLandmark,
  type ExerciseConfig,
  type ExerciseDetector,
  type ExerciseState,
  type VisibilityStatus,
} from '../types';

export interface ArmHoldConfig extends ExerciseConfig {
  /** Minimum shoulder abduction angle (hip-shoulder-wrist) in degrees (default: 65) */
  minShoulderAngle: number;

  /** Maximum shoulder abduction angle in degrees (default: 125) */
  maxShoulderAngle: number;

  /** Minimum elbow straightness angle (shoulder-elbow-wrist) in degrees (default: 145) */
  minElbowAngle: number;

  /** Minimum landmark visibility confidence (default: 0.55) */
  minVisibility: number;

  /** Smoothing factor for EMA angle filtering (0-1, default: 0.3) */
  smoothingFactor: number;

  /** Grace period in ms before breaking form stops timer (default: 500) */
  gracePeriodMs: number;
}

const DEFAULT_CONFIG: ArmHoldConfig = {
  minShoulderAngle: 65,
  maxShoulderAngle: 125,
  minElbowAngle: 145,
  minVisibility: 0.55,
  smoothingFactor: 0.3,
  gracePeriodMs: 500,
};

export class ArmHoldDetector implements ExerciseDetector<ArmHoldConfig> {
  private config: ArmHoldConfig;
  private isHolding = false;
  private holdDurationMs = 0;
  private holdStartTime: number | null = null;
  private lastValidHoldTime: number | null = null;
  private smoothedArmAngle = 0;
  private smoothedElbowAngle = 180;
  private hasInitialized = false;
  private visibility: VisibilityStatus = 'NOT_VISIBLE';

  constructor(config: Partial<ArmHoldConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.isHolding = false;
    this.holdDurationMs = 0;
    this.holdStartTime = null;
    this.lastValidHoldTime = null;
    this.smoothedArmAngle = 0;
    this.smoothedElbowAngle = 180;
    this.hasInitialized = false;
    this.visibility = 'NOT_VISIBLE';
  }

  update(landmarks: NormalizedLandmark[], timestamp: number): ExerciseState {
    const lShoulder = landmarks[PoseLandmark.LEFT_SHOULDER];
    const rShoulder = landmarks[PoseLandmark.RIGHT_SHOULDER];
    const lElbow = landmarks[PoseLandmark.LEFT_ELBOW];
    const rElbow = landmarks[PoseLandmark.RIGHT_ELBOW];
    const lWrist = landmarks[PoseLandmark.LEFT_WRIST];
    const rWrist = landmarks[PoseLandmark.RIGHT_WRIST];
    const lHip = landmarks[PoseLandmark.LEFT_HIP];
    const rHip = landmarks[PoseLandmark.RIGHT_HIP];

    const minVis = this.config.minVisibility;
    const allVisible =
      isVisible(lShoulder, minVis) &&
      isVisible(rShoulder, minVis) &&
      isVisible(lElbow, minVis) &&
      isVisible(rElbow, minVis) &&
      isVisible(lWrist, minVis) &&
      isVisible(rWrist, minVis) &&
      isVisible(lHip, minVis) &&
      isVisible(rHip, minVis);

    if (!allVisible) {
      this.visibility =
        !isVisible(lShoulder, minVis) && !isVisible(rShoulder, minVis)
          ? 'NOT_VISIBLE'
          : 'LOW_VISIBILITY';
      this.pauseHold(timestamp);
      return this.getState();
    }

    this.visibility = 'VISIBLE';

    const leftArmAngle = angle2D(lHip, lShoulder, lWrist);
    const rightArmAngle = angle2D(rHip, rShoulder, rWrist);
    const rawArmAngle = (leftArmAngle + rightArmAngle) * 0.5;

    const leftElbowAngle = angle2D(lShoulder, lElbow, lWrist);
    const rightElbowAngle = angle2D(rShoulder, rElbow, rWrist);
    const rawElbowAngle = Math.min(leftElbowAngle, rightElbowAngle);

    if (!this.hasInitialized) {
      this.smoothedArmAngle = rawArmAngle;
      this.smoothedElbowAngle = rawElbowAngle;
      this.hasInitialized = true;
    } else {
      this.smoothedArmAngle = ema(rawArmAngle, this.smoothedArmAngle, this.config.smoothingFactor);
      this.smoothedElbowAngle = ema(
        rawElbowAngle,
        this.smoothedElbowAngle,
        this.config.smoothingFactor
      );
    }

    const armsRaised =
      this.smoothedArmAngle >= this.config.minShoulderAngle &&
      this.smoothedArmAngle <= this.config.maxShoulderAngle;
    const elbowsStraight = this.smoothedElbowAngle >= this.config.minElbowAngle;
    const isCorrectPose = armsRaised && elbowsStraight;

    if (isCorrectPose) {
      if (!this.isHolding) {
        this.isHolding = true;
        this.holdStartTime = timestamp;
        this.lastValidHoldTime = timestamp;
      } else {
        this.lastValidHoldTime = timestamp;
        this.holdDurationMs += timestamp - (this.holdStartTime ?? timestamp);
        this.holdStartTime = timestamp;
      }
    } else if (this.isHolding) {
      const timeSinceLastValid = timestamp - (this.lastValidHoldTime ?? timestamp);
      if (timeSinceLastValid > this.config.gracePeriodMs) {
        this.pauseHold(timestamp);
      }
    }

    return this.getState();
  }

  configure(config: Partial<ArmHoldConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getState(): ExerciseState {
    return {
      phase: this.isHolding ? 'DOWN' : 'IDLE',
      repCount: 0,
      progress: this.isHolding ? 1.0 : 0.0,
      visibility: this.visibility,
      isHolding: this.isHolding,
      holdDurationMs: this.holdDurationMs,
      debug: {
        armAngle: Math.round(this.smoothedArmAngle),
        elbowAngle: Math.round(this.smoothedElbowAngle),
        minShoulderAngle: this.config.minShoulderAngle,
        maxShoulderAngle: this.config.maxShoulderAngle,
        holdDurationSec: Math.floor(this.holdDurationMs / 1000),
      },
    };
  }

  getConfig(): Readonly<ArmHoldConfig> {
    return { ...this.config };
  }

  private pauseHold(timestamp: number): void {
    if (this.isHolding && this.holdStartTime !== null) {
      this.holdDurationMs += timestamp - this.holdStartTime;
    }
    this.isHolding = false;
    this.holdStartTime = null;
  }
}
