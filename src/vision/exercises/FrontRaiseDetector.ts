/**
 * FrontRaiseDetector - Rep-based shoulder front raise detector.
 *
 * Detection logic:
 * - Measures hip -> shoulder -> wrist arm elevation angle bilaterally (works from side/3-4 view)
 * - Combines with vertical wrist-to-shoulder elevation ratio relative to torso height
 *   so front-facing webcams detect horizontal arm raises reliably too
 * - FSM: IDLE (arms down) -> RAISING -> TOP -> LOWERING -> IDLE (rep++)
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

type RaisePhase = 'IDLE' | 'RAISING' | 'TOP' | 'LOWERING';

export interface FrontRaiseConfig extends ExerciseConfig {
  /** Arm angle (degrees) at resting lowered position (default: 35) */
  restAngle: number;

  /** Arm angle (degrees) at top shoulder-height raise (default: 85) */
  peakAngle: number;

  /** Hysteresis zone in degrees (default: 10) */
  hysteresis: number;

  /** Smoothing factor for EMA filtering (0-1, default: 0.35) */
  smoothingFactor: number;

  /** Minimum landmark visibility confidence (0-1, default: 0.55) */
  minVisibility: number;
}

const DEFAULT_CONFIG: FrontRaiseConfig = {
  restAngle: 35,
  peakAngle: 85,
  hysteresis: 10,
  smoothingFactor: 0.35,
  minVisibility: 0.55,
};

export class FrontRaiseDetector implements ExerciseDetector<FrontRaiseConfig> {
  private config: FrontRaiseConfig;
  private phase: RaisePhase = 'IDLE';
  private repCount = 0;
  private smoothedAngle = 15;
  private hasInitialized = false;
  private visibility: VisibilityStatus = 'NOT_VISIBLE';
  private reachedTop = false;

  constructor(config: Partial<FrontRaiseConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.phase = 'IDLE';
    this.repCount = 0;
    this.smoothedAngle = 15;
    this.hasInitialized = false;
    this.visibility = 'NOT_VISIBLE';
    this.reachedTop = false;
  }

  update(landmarks: NormalizedLandmark[], _timestamp: number): ExerciseState {
    const minVis = this.config.minVisibility;

    const lShoulder = landmarks[PoseLandmark.LEFT_SHOULDER];
    const lHip = landmarks[PoseLandmark.LEFT_HIP];
    const lWrist = landmarks[PoseLandmark.LEFT_WRIST];
    const leftVisible =
      isVisible(lShoulder, minVis) && isVisible(lHip, minVis) && isVisible(lWrist, minVis);

    const rShoulder = landmarks[PoseLandmark.RIGHT_SHOULDER];
    const rHip = landmarks[PoseLandmark.RIGHT_HIP];
    const rWrist = landmarks[PoseLandmark.RIGHT_WRIST];
    const rightVisible =
      isVisible(rShoulder, minVis) && isVisible(rHip, minVis) && isVisible(rWrist, minVis);

    if (!leftVisible && !rightVisible) {
      this.visibility = 'LOW_VISIBILITY';
      return this.getState();
    }

    this.visibility = 'VISIBLE';

    const computeSideAngle = (
      hip: NormalizedLandmark,
      shoulder: NormalizedLandmark,
      wrist: NormalizedLandmark
    ): number => {
      const geoAngle = angle2D(hip, shoulder, wrist);
      const torsoHeight = Math.abs(hip.y - shoulder.y);
      if (torsoHeight > 0.05) {
        // Front-facing helper: when wrist rises to shoulder level (hip.y - wrist.y >= torsoHeight),
        // elevation maps smoothly toward ~95 deg even with foreshortening.
        const elevationRatio = Math.max(0, Math.min(1.2, (hip.y - wrist.y) / torsoHeight));
        return Math.max(geoAngle, elevationRatio * 92);
      }
      return geoAngle;
    };

    let rawAngle: number;
    if (leftVisible && rightVisible) {
      rawAngle =
        (computeSideAngle(lHip, lShoulder, lWrist) +
          computeSideAngle(rHip, rShoulder, rWrist)) *
        0.5;
    } else if (leftVisible) {
      rawAngle = computeSideAngle(lHip, lShoulder, lWrist);
    } else {
      rawAngle = computeSideAngle(rHip, rShoulder, rWrist);
    }

    if (!this.hasInitialized) {
      this.smoothedAngle = rawAngle;
      this.hasInitialized = true;
    } else {
      this.smoothedAngle = ema(rawAngle, this.smoothedAngle, this.config.smoothingFactor);
    }

    this.updateFSM(this.smoothedAngle);
    return this.getState();
  }

  configure(config: Partial<FrontRaiseConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getState(): ExerciseState {
    return {
      phase: this.mapPhaseToGeneric(this.phase),
      repCount: this.repCount,
      progress: mapRange(
        this.smoothedAngle,
        this.config.restAngle,
        this.config.peakAngle,
        0.0,
        1.0,
        true
      ),
      visibility: this.visibility,
      debug: {
        raiseAngle: Math.round(this.smoothedAngle),
        phase: this.phase,
        reachedTop: String(this.reachedTop),
      },
    };
  }

  getConfig(): Readonly<FrontRaiseConfig> {
    return { ...this.config };
  }

  private updateFSM(angle: number): void {
    const { restAngle, peakAngle, hysteresis } = this.config;
    const raiseStartThreshold = restAngle + hysteresis;
    const topEnterThreshold = peakAngle - hysteresis * 0.5;
    const topExitThreshold = peakAngle - hysteresis * 1.2;
    const restReturnThreshold = restAngle + hysteresis;

    switch (this.phase) {
      case 'IDLE':
        if (angle > raiseStartThreshold) {
          this.phase = 'RAISING';
          this.reachedTop = false;
        }
        break;

      case 'RAISING':
        if (angle >= topEnterThreshold) {
          this.phase = 'TOP';
          this.reachedTop = true;
        } else if (angle <= restReturnThreshold) {
          this.phase = 'IDLE';
          this.reachedTop = false;
        }
        break;

      case 'TOP':
        if (angle < topExitThreshold) {
          this.phase = 'LOWERING';
        }
        break;

      case 'LOWERING':
        if (angle <= restReturnThreshold) {
          if (this.reachedTop) {
            this.repCount++;
            this.reachedTop = false;
          }
          this.phase = 'IDLE';
        } else if (angle >= topEnterThreshold) {
          this.phase = 'TOP';
        }
        break;
    }
  }

  private mapPhaseToGeneric(phase: RaisePhase): ExerciseState['phase'] {
    switch (phase) {
      case 'IDLE':
        return 'IDLE';
      case 'RAISING':
        return 'UP';
      case 'TOP':
        return 'TRANSITION';
      case 'LOWERING':
        return 'DOWN';
    }
  }
}
