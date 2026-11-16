/**
 * WallSitDetector - Isometric wall sit / static squat hold detector.
 *
 * Key features:
 * - Auto-selects visible body side (left/right) with visibility hysteresis
 * - Uses 3D worldLandmarks when available to reduce perspective distortion
 * - Validates both knee bend (wall sit depth) and upright torso hip flexion
 * - Emits isHolding + holdDurationMs with configurable gracePeriodMs
 *
 * ZERO dependencies on React, Zustand, or game logic.
 */

import type { Landmark, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { angle3D, ema, isVisible } from '../angleMath';
import {
  PoseLandmark,
  type ExerciseConfig,
  type ExerciseDetector,
  type ExerciseState,
  type VisibilityStatus,
} from '../types';

export interface WallSitConfig extends ExerciseConfig {
  /** Minimum knee angle (hip-knee-ankle) in degrees (too deep/collapsed below this, default: 65) */
  minKneeAngle: number;

  /** Maximum knee angle in degrees to count as active wall sit (default: 115) */
  maxKneeAngle: number;

  /** Minimum hip flexion angle (shoulder-hip-knee) in degrees (default: 65) */
  minHipAngle: number;

  /** Maximum hip flexion angle in degrees (prevents standing/lying false positives, default: 135) */
  maxHipAngle: number;

  /** Minimum landmark visibility confidence (default: 0.55) */
  minVisibility: number;

  /** Smoothing factor for EMA angle filtering (0-1, default: 0.3) */
  smoothingFactor: number;

  /** Grace period in ms before form break stops timer (default: 500) */
  gracePeriodMs: number;
}

const DEFAULT_CONFIG: WallSitConfig = {
  minKneeAngle: 65,
  maxKneeAngle: 115,
  minHipAngle: 65,
  maxHipAngle: 135,
  minVisibility: 0.55,
  smoothingFactor: 0.3,
  gracePeriodMs: 500,
};

type BodySide = 'left' | 'right';

export class WallSitDetector implements ExerciseDetector<WallSitConfig> {
  private config: WallSitConfig;
  private isHolding = false;
  private holdDurationMs = 0;
  private holdStartTime: number | null = null;
  private lastValidHoldTime: number | null = null;
  private smoothedKneeAngle = 180;
  private smoothedHipAngle = 180;
  private hasInitialized = false;
  private selectedSide: BodySide | null = null;
  private visibility: VisibilityStatus = 'NOT_VISIBLE';

  constructor(config: Partial<WallSitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.isHolding = false;
    this.holdDurationMs = 0;
    this.holdStartTime = null;
    this.lastValidHoldTime = null;
    this.smoothedKneeAngle = 180;
    this.smoothedHipAngle = 180;
    this.hasInitialized = false;
    this.selectedSide = null;
    this.visibility = 'NOT_VISIBLE';
  }

  update(
    landmarks: NormalizedLandmark[],
    timestamp: number,
    worldLandmarks?: Landmark[]
  ): ExerciseState {
    this.selectedSide = this.selectBodySide(landmarks);
    const visStatus = this.checkVisibility(landmarks);
    this.visibility = visStatus;

    if (visStatus === 'NOT_VISIBLE') {
      this.pauseHold(timestamp);
      return this.getState();
    }

    const angleSource =
      worldLandmarks && worldLandmarks.length >= 33 ? worldLandmarks : landmarks;
    const isLeft = this.selectedSide === 'left';

    const shoulder = angleSource[isLeft ? PoseLandmark.LEFT_SHOULDER : PoseLandmark.RIGHT_SHOULDER];
    const hip = angleSource[isLeft ? PoseLandmark.LEFT_HIP : PoseLandmark.RIGHT_HIP];
    const knee = angleSource[isLeft ? PoseLandmark.LEFT_KNEE : PoseLandmark.RIGHT_KNEE];
    const ankle = angleSource[isLeft ? PoseLandmark.LEFT_ANKLE : PoseLandmark.RIGHT_ANKLE];

    const kneeAngle = angle3D(hip, knee, ankle);
    const hipAngle = angle3D(shoulder, hip, knee);

    if (!this.hasInitialized) {
      this.smoothedKneeAngle = kneeAngle;
      this.smoothedHipAngle = hipAngle;
      this.hasInitialized = true;
    } else {
      this.smoothedKneeAngle = ema(kneeAngle, this.smoothedKneeAngle, this.config.smoothingFactor);
      this.smoothedHipAngle = ema(hipAngle, this.smoothedHipAngle, this.config.smoothingFactor);
    }

    const isKneeHeld =
      this.smoothedKneeAngle >= this.config.minKneeAngle &&
      this.smoothedKneeAngle <= this.config.maxKneeAngle;
    const isHipHeld =
      this.smoothedHipAngle >= this.config.minHipAngle &&
      this.smoothedHipAngle <= this.config.maxHipAngle;

    const isCorrectPose = isKneeHeld && isHipHeld && visStatus === 'VISIBLE';

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

  configure(config: Partial<WallSitConfig>): void {
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
        kneeAngle: Math.round(this.smoothedKneeAngle),
        hipAngle: Math.round(this.smoothedHipAngle),
        selectedSide: this.selectedSide ?? 'none',
        maxKneeAngle: this.config.maxKneeAngle,
        holdDurationSec: Math.floor(this.holdDurationMs / 1000),
      },
    };
  }

  getConfig(): Readonly<WallSitConfig> {
    return { ...this.config };
  }

  private selectBodySide(landmarks: NormalizedLandmark[]): BodySide {
    const leftVisibility =
      (landmarks[PoseLandmark.LEFT_SHOULDER].visibility ?? 0) +
      (landmarks[PoseLandmark.LEFT_HIP].visibility ?? 0) +
      (landmarks[PoseLandmark.LEFT_KNEE].visibility ?? 0) +
      (landmarks[PoseLandmark.LEFT_ANKLE].visibility ?? 0);

    const rightVisibility =
      (landmarks[PoseLandmark.RIGHT_SHOULDER].visibility ?? 0) +
      (landmarks[PoseLandmark.RIGHT_HIP].visibility ?? 0) +
      (landmarks[PoseLandmark.RIGHT_KNEE].visibility ?? 0) +
      (landmarks[PoseLandmark.RIGHT_ANKLE].visibility ?? 0);

    if (!this.selectedSide) {
      return leftVisibility >= rightVisibility ? 'left' : 'right';
    }
    if (this.selectedSide === 'left') {
      return rightVisibility > leftVisibility + 0.25 ? 'right' : 'left';
    }
    return leftVisibility > rightVisibility + 0.25 ? 'left' : 'right';
  }

  private checkVisibility(landmarks: NormalizedLandmark[]): VisibilityStatus {
    if (!this.selectedSide) {
      return 'NOT_VISIBLE';
    }

    const minVis = this.config.minVisibility;
    const isLeft = this.selectedSide === 'left';
    const allVisible =
      isVisible(landmarks[isLeft ? PoseLandmark.LEFT_SHOULDER : PoseLandmark.RIGHT_SHOULDER], minVis) &&
      isVisible(landmarks[isLeft ? PoseLandmark.LEFT_HIP : PoseLandmark.RIGHT_HIP], minVis) &&
      isVisible(landmarks[isLeft ? PoseLandmark.LEFT_KNEE : PoseLandmark.RIGHT_KNEE], minVis) &&
      isVisible(landmarks[isLeft ? PoseLandmark.LEFT_ANKLE : PoseLandmark.RIGHT_ANKLE], minVis);

    if (allVisible) {
      return 'VISIBLE';
    }

    const leftHipVis = landmarks[PoseLandmark.LEFT_HIP].visibility ?? 0;
    const rightHipVis = landmarks[PoseLandmark.RIGHT_HIP].visibility ?? 0;
    if (leftHipVis < minVis && rightHipVis < minVis) {
      return 'NOT_VISIBLE';
    }

    return 'LOW_VISIBILITY';
  }

  private pauseHold(timestamp: number): void {
    if (this.isHolding && this.holdStartTime !== null) {
      this.holdDurationMs += timestamp - this.holdStartTime;
    }
    this.isHolding = false;
    this.holdStartTime = null;
  }
}
