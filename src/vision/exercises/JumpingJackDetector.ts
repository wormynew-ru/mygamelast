/**
 * JumpingJackDetector - Rep-based jumping jack detection (front-facing camera).
 *
 * Detection logic:
 * - Measures bilateral shoulder abduction angle (hip -> shoulder -> wrist)
 * - Measures normalized leg spread ratio (ankleDistance / hipWidth)
 * - FSM: IDLE -> UP -> PEAK -> DOWN -> IDLE (rep++)
 * - Uses hysteresis to prevent double-counting from jitter
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

type JumpingJackPhase = 'IDLE' | 'OPENING' | 'PEAK' | 'CLOSING';

/**
 * Jumping jack detector configuration.
 */
export interface JumpingJackConfig extends ExerciseConfig {
  /** Arm angle (degrees, hip-shoulder-wrist) when arms are down at sides (default: 35) */
  restArmAngle: number;

  /** Arm angle (degrees) when arms are raised overhead (default: 135) */
  peakArmAngle: number;

  /** Minimum ankle-to-hip width ratio for open stance (default: 1.6) */
  peakLegSpreadRatio: number;

  /** Maximum ankle-to-hip width ratio for closed stance (default: 1.3) */
  restLegSpreadRatio: number;

  /** Hysteresis zone (degrees) for arm transitions (default: 12) */
  hysteresis: number;

  /** Smoothing factor for EMA filtering (0-1, default: 0.35) */
  smoothingFactor: number;

  /** Minimum landmark visibility confidence (0-1, default: 0.55) */
  minVisibility: number;
}

const DEFAULT_CONFIG: JumpingJackConfig = {
  restArmAngle: 35,
  peakArmAngle: 135,
  peakLegSpreadRatio: 1.6,
  restLegSpreadRatio: 1.3,
  hysteresis: 12,
  smoothingFactor: 0.35,
  minVisibility: 0.55,
};

/**
 * JumpingJackDetector tracks full-body jumping jacks via arm elevation & leg spread.
 */
export class JumpingJackDetector implements ExerciseDetector<JumpingJackConfig> {
  private config: JumpingJackConfig;
  private phase: JumpingJackPhase = 'IDLE';
  private repCount = 0;
  private smoothedArmAngle = 20;
  private smoothedLegRatio = 1.0;
  private hasInitialized = false;
  private visibility: VisibilityStatus = 'NOT_VISIBLE';
  private reachedPeak = false;

  constructor(config: Partial<JumpingJackConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.phase = 'IDLE';
    this.repCount = 0;
    this.smoothedArmAngle = 20;
    this.smoothedLegRatio = 1.0;
    this.hasInitialized = false;
    this.visibility = 'NOT_VISIBLE';
    this.reachedPeak = false;
  }

  update(landmarks: NormalizedLandmark[], _timestamp: number): ExerciseState {
    const leftShoulder = landmarks[PoseLandmark.LEFT_SHOULDER];
    const rightShoulder = landmarks[PoseLandmark.RIGHT_SHOULDER];
    const leftWrist = landmarks[PoseLandmark.LEFT_WRIST];
    const rightWrist = landmarks[PoseLandmark.RIGHT_WRIST];
    const leftHip = landmarks[PoseLandmark.LEFT_HIP];
    const rightHip = landmarks[PoseLandmark.RIGHT_HIP];
    const leftAnkle = landmarks[PoseLandmark.LEFT_ANKLE];
    const rightAnkle = landmarks[PoseLandmark.RIGHT_ANKLE];

    const minVis = this.config.minVisibility;
    const allJointsVisible =
      isVisible(leftShoulder, minVis) &&
      isVisible(rightShoulder, minVis) &&
      isVisible(leftWrist, minVis) &&
      isVisible(rightWrist, minVis) &&
      isVisible(leftHip, minVis) &&
      isVisible(rightHip, minVis) &&
      isVisible(leftAnkle, minVis) &&
      isVisible(rightAnkle, minVis);

    if (!allJointsVisible) {
      this.visibility = 'LOW_VISIBILITY';
      return this.getState();
    }

    this.visibility = 'VISIBLE';

    // Average left and right shoulder abduction angles (hip -> shoulder -> wrist)
    const leftArmAngle = angle2D(leftHip, leftShoulder, leftWrist);
    const rightArmAngle = angle2D(rightHip, rightShoulder, rightWrist);
    const rawArmAngle = (leftArmAngle + rightArmAngle) / 2;

    // Normalize ankle spread by hip width to handle camera distance changes
    const hipWidth = Math.max(0.02, distance2D(leftHip, rightHip));
    const ankleDistance = distance2D(leftAnkle, rightAnkle);
    const rawLegRatio = ankleDistance / hipWidth;

    if (!this.hasInitialized) {
      this.smoothedArmAngle = rawArmAngle;
      this.smoothedLegRatio = rawLegRatio;
      this.hasInitialized = true;
    } else {
      this.smoothedArmAngle = ema(rawArmAngle, this.smoothedArmAngle, this.config.smoothingFactor);
      this.smoothedLegRatio = ema(rawLegRatio, this.smoothedLegRatio, this.config.smoothingFactor);
    }

    this.updateFSM(this.smoothedArmAngle, this.smoothedLegRatio);

    return this.getState();
  }

  configure(config: Partial<JumpingJackConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getState(): ExerciseState {
    return {
      phase: this.mapPhaseToGeneric(this.phase),
      repCount: this.repCount,
      progress: this.calculateProgress(),
      visibility: this.visibility,
      debug: {
        armAngle: Math.round(this.smoothedArmAngle),
        legRatio: Number(this.smoothedLegRatio.toFixed(2)),
        internalPhase: this.phase,
        reachedPeak: String(this.reachedPeak),
      },
    };
  }

  getConfig(): Readonly<JumpingJackConfig> {
    return { ...this.config };
  }

  private updateFSM(armAngle: number, legRatio: number): void {
    const {
      restArmAngle,
      peakArmAngle,
      peakLegSpreadRatio,
      restLegSpreadRatio,
      hysteresis,
    } = this.config;

    const openStartThreshold = restArmAngle + hysteresis;
    const peakEnterArmThreshold = peakArmAngle - hysteresis;
    const peakExitArmThreshold = peakArmAngle - hysteresis * 1.5;
    const restReturnThreshold = restArmAngle + hysteresis;

    switch (this.phase) {
      case 'IDLE':
        if (armAngle >= openStartThreshold) {
          this.phase = 'OPENING';
          this.reachedPeak = false;
        }
        break;

      case 'OPENING':
        if (armAngle >= peakEnterArmThreshold && legRatio >= peakLegSpreadRatio) {
          this.phase = 'PEAK';
          this.reachedPeak = true;
        } else if (armAngle <= restReturnThreshold && legRatio <= restLegSpreadRatio) {
          // Aborted without reaching full open position
          this.phase = 'IDLE';
          this.reachedPeak = false;
        }
        break;

      case 'PEAK':
        if (armAngle < peakExitArmThreshold) {
          this.phase = 'CLOSING';
        }
        break;

      case 'CLOSING':
        if (armAngle <= restReturnThreshold && legRatio <= restLegSpreadRatio) {
          if (this.reachedPeak) {
            this.repCount++;
            this.reachedPeak = false;
          }
          this.phase = 'IDLE';
        } else if (armAngle >= peakEnterArmThreshold && legRatio >= peakLegSpreadRatio) {
          this.phase = 'PEAK';
        }
        break;
    }
  }

  private mapPhaseToGeneric(phase: JumpingJackPhase): ExerciseState['phase'] {
    switch (phase) {
      case 'IDLE':
        return 'IDLE';
      case 'OPENING':
        return 'UP';
      case 'PEAK':
        return 'TRANSITION';
      case 'CLOSING':
        return 'DOWN';
    }
  }

  private calculateProgress(): number {
    const { restArmAngle, peakArmAngle } = this.config;
    return mapRange(this.smoothedArmAngle, restArmAngle, peakArmAngle, 0.0, 1.0, true);
  }
}
