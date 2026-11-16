/**
 * OverheadPressDetector - Rep-based overhead dumbbell/bodyweight press detector (front-facing).
 *
 * Detection logic:
 * - Measures bilateral elbow extension angle (shoulder -> elbow -> wrist)
 * - Validates wrist elevation above shoulders at lockout (prevents arms-at-sides false positives)
 * - FSM: IDLE (rack position) -> PRESSING -> TOP (lockout) -> LOWERING -> IDLE (rep++)
 * - Uses hysteresis to prevent double-counting from jitter
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

type PressPhase = 'IDLE' | 'PRESSING' | 'TOP' | 'LOWERING';

export interface OverheadPressConfig extends ExerciseConfig {
  /** Elbow angle (degrees) in rack position near shoulders (default: 100) */
  bottomAngle: number;

  /** Elbow angle (degrees) at overhead lockout (default: 155) */
  topAngle: number;

  /** Hysteresis zone (degrees) for phase transitions (default: 10) */
  hysteresis: number;

  /** Smoothing factor for EMA filtering (0-1, default: 0.3) */
  smoothingFactor: number;

  /** Minimum landmark visibility confidence (0-1, default: 0.55) */
  minVisibility: number;

  /** Required vertical offset (shoulder.y - wrist.y) for overhead lockout (default: 0.03) */
  minWristElevation: number;
}

const DEFAULT_CONFIG: OverheadPressConfig = {
  bottomAngle: 100,
  topAngle: 155,
  hysteresis: 10,
  smoothingFactor: 0.3,
  minVisibility: 0.55,
  minWristElevation: 0.03,
};

export class OverheadPressDetector implements ExerciseDetector<OverheadPressConfig> {
  private config: OverheadPressConfig;
  private phase: PressPhase = 'IDLE';
  private repCount = 0;
  private smoothedElbowAngle = 90;
  private hasInitialized = false;
  private visibility: VisibilityStatus = 'NOT_VISIBLE';
  private reachedTop = false;
  private wristsOverhead = false;

  constructor(config: Partial<OverheadPressConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.phase = 'IDLE';
    this.repCount = 0;
    this.smoothedElbowAngle = 90;
    this.hasInitialized = false;
    this.visibility = 'NOT_VISIBLE';
    this.reachedTop = false;
    this.wristsOverhead = false;
  }

  update(landmarks: NormalizedLandmark[], _timestamp: number): ExerciseState {
    const lShoulder = landmarks[PoseLandmark.LEFT_SHOULDER];
    const rShoulder = landmarks[PoseLandmark.RIGHT_SHOULDER];
    const lElbow = landmarks[PoseLandmark.LEFT_ELBOW];
    const rElbow = landmarks[PoseLandmark.RIGHT_ELBOW];
    const lWrist = landmarks[PoseLandmark.LEFT_WRIST];
    const rWrist = landmarks[PoseLandmark.RIGHT_WRIST];

    const minVis = this.config.minVisibility;
    const allVisible =
      isVisible(lShoulder, minVis) &&
      isVisible(rShoulder, minVis) &&
      isVisible(lElbow, minVis) &&
      isVisible(rElbow, minVis) &&
      isVisible(lWrist, minVis) &&
      isVisible(rWrist, minVis);

    if (!allVisible) {
      this.visibility = 'LOW_VISIBILITY';
      return this.getState();
    }

    this.visibility = 'VISIBLE';

    const leftElbowAngle = angle2D(lShoulder, lElbow, lWrist);
    const rightElbowAngle = angle2D(rShoulder, rElbow, rWrist);
    const rawElbowAngle = (leftElbowAngle + rightElbowAngle) * 0.5;

    // Lower y value = higher on screen
    this.wristsOverhead =
      lShoulder.y - lWrist.y >= this.config.minWristElevation &&
      rShoulder.y - rWrist.y >= this.config.minWristElevation;

    if (!this.hasInitialized) {
      this.smoothedElbowAngle = rawElbowAngle;
      this.hasInitialized = true;
    } else {
      this.smoothedElbowAngle = ema(
        rawElbowAngle,
        this.smoothedElbowAngle,
        this.config.smoothingFactor
      );
    }

    this.updateFSM(this.smoothedElbowAngle, this.wristsOverhead);

    return this.getState();
  }

  configure(config: Partial<OverheadPressConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getState(): ExerciseState {
    return {
      phase: this.mapPhaseToGeneric(this.phase),
      repCount: this.repCount,
      progress: this.calculateProgress(),
      visibility: this.visibility,
      debug: {
        elbowAngle: Math.round(this.smoothedElbowAngle),
        wristsOverhead: String(this.wristsOverhead),
        internalPhase: this.phase,
        reachedTop: String(this.reachedTop),
      },
    };
  }

  getConfig(): Readonly<OverheadPressConfig> {
    return { ...this.config };
  }

  private updateFSM(elbowAngle: number, wristsOverhead: boolean): void {
    const { bottomAngle, topAngle, hysteresis } = this.config;
    const pressStartThreshold = bottomAngle + hysteresis;
    const topEnterThreshold = topAngle - hysteresis;
    const topExitThreshold = topAngle - hysteresis * 1.5;
    const rackReturnThreshold = bottomAngle + hysteresis;

    switch (this.phase) {
      case 'IDLE':
        if (elbowAngle > pressStartThreshold && wristsOverhead) {
          this.phase = 'PRESSING';
          this.reachedTop = false;
        }
        break;

      case 'PRESSING':
        if (elbowAngle >= topEnterThreshold && wristsOverhead) {
          this.phase = 'TOP';
          this.reachedTop = true;
        } else if (elbowAngle <= rackReturnThreshold || !wristsOverhead) {
          this.phase = 'IDLE';
          this.reachedTop = false;
        }
        break;

      case 'TOP':
        if (elbowAngle < topExitThreshold || !wristsOverhead) {
          this.phase = 'LOWERING';
        }
        break;

      case 'LOWERING':
        if (elbowAngle <= rackReturnThreshold) {
          if (this.reachedTop) {
            this.repCount++;
            this.reachedTop = false;
          }
          this.phase = 'IDLE';
        } else if (elbowAngle >= topEnterThreshold && wristsOverhead) {
          this.phase = 'TOP';
        }
        break;
    }
  }

  private mapPhaseToGeneric(phase: PressPhase): ExerciseState['phase'] {
    switch (phase) {
      case 'IDLE':
        return 'IDLE';
      case 'PRESSING':
        return 'UP';
      case 'TOP':
        return 'TRANSITION';
      case 'LOWERING':
        return 'DOWN';
    }
  }

  private calculateProgress(): number {
    if (!this.wristsOverhead && this.phase === 'IDLE') {
      return 0.0;
    }
    const { bottomAngle, topAngle } = this.config;
    return mapRange(this.smoothedElbowAngle, bottomAngle, topAngle, 0.0, 1.0, true);
  }
}
