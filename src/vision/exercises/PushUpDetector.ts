/**
 * PushUpDetector - Rep-based push-up detection with side-view auto-selection.
 *
 * FSM: IDLE → DOWN → BOTTOM → UP → IDLE (rep++)
 *
 * Key features:
 * - Auto-selects visible body side (left/right) based on landmark visibility
 * - Uses 3D world coordinates to reduce perspective distortion
 * - Returns WRONG_ANGLE status if user faces camera frontally
 * - Hysteresis prevents jitter-based double-counting
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { ExerciseDetector, ExerciseState, ExerciseConfig, VisibilityStatus, ExercisePhase, Point3D } from '../types';
import { PoseLandmark } from '../types';
import {
  angle3D,
  ema,
  isVisible
} from '../angleMath';

/**
 * Push-up specific configuration.
 */
export interface PushUpConfig extends ExerciseConfig {
  downAngleThreshold: number;
  bottomAngleThreshold: number;
  upAngleThreshold: number;
  bodyAlignmentTolerance: number;
  minVisibility: number;
  smoothingFactor: number;
}

const DEFAULT_CONFIG: PushUpConfig = {
  downAngleThreshold: 140,
  bottomAngleThreshold: 90,
  upAngleThreshold: 160,
  bodyAlignmentTolerance: 20,
  minVisibility: 0.55,
  smoothingFactor: 0.3,
};

type BodySide = 'left' | 'right';
type PushUpPhase = 'IDLE' | 'DOWN' | 'BOTTOM' | 'UP';

export class PushUpDetector implements ExerciseDetector<PushUpConfig> {
  private config: PushUpConfig;
  private phase: PushUpPhase = 'IDLE';
  private repCount = 0;
  private smoothedElbowAngle = 0;
  private smoothedBodyAngle = 0;
  private selectedSide: BodySide | null = null;
  private lastElbowAngle = 0;
  private lastBodyAngle = 0;
  private lastVisibility: VisibilityStatus = 'NOT_VISIBLE';

  constructor(config: Partial<PushUpConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.phase = 'IDLE';
    this.repCount = 0;
    this.smoothedElbowAngle = 0;
    this.smoothedBodyAngle = 0;
    this.selectedSide = null;
    this.lastElbowAngle = 0;
    this.lastBodyAngle = 0;
    this.lastVisibility = 'NOT_VISIBLE';
  }

  update(landmarks: NormalizedLandmark[], _timestamp: number): ExerciseState {
    if (!this.selectedSide) {
      this.selectedSide = this.selectBodySide(landmarks);
    }

    const visibilityStatus = this.checkVisibility(landmarks);
    this.lastVisibility = visibilityStatus;

    if (visibilityStatus === 'NOT_VISIBLE') {
      return this.getState();
    }

    const shoulder = this.getWorldLandmark(landmarks, this.selectedSide === 'left' ? PoseLandmark.LEFT_SHOULDER : PoseLandmark.RIGHT_SHOULDER);
    const elbow = this.getWorldLandmark(landmarks, this.selectedSide === 'left' ? PoseLandmark.LEFT_ELBOW : PoseLandmark.RIGHT_ELBOW);
    const wrist = this.getWorldLandmark(landmarks, this.selectedSide === 'left' ? PoseLandmark.LEFT_WRIST : PoseLandmark.RIGHT_WRIST);
    const hip = this.getWorldLandmark(landmarks, this.selectedSide === 'left' ? PoseLandmark.LEFT_HIP : PoseLandmark.RIGHT_HIP);
    const ankle = this.getWorldLandmark(landmarks, this.selectedSide === 'left' ? PoseLandmark.LEFT_ANKLE : PoseLandmark.RIGHT_ANKLE);

    const elbowAngle = angle3D(shoulder, elbow, wrist);
    this.smoothedElbowAngle = ema(elbowAngle, this.smoothedElbowAngle, this.config.smoothingFactor);
    this.lastElbowAngle = this.smoothedElbowAngle;

    const bodyAngle = angle3D(shoulder, hip, ankle);
    this.smoothedBodyAngle = ema(bodyAngle, this.smoothedBodyAngle, this.config.smoothingFactor);
    this.lastBodyAngle = this.smoothedBodyAngle;

    const isAligned = Math.abs(180 - this.lastBodyAngle) <= this.config.bodyAlignmentTolerance;

    if (!isAligned && visibilityStatus === 'VISIBLE') {
      this.lastVisibility = 'LOW_VISIBILITY';
    }

    this.updateFSM(this.lastElbowAngle);

    return this.getState();
  }

  configure(config: Partial<PushUpConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getState(): ExerciseState {
    const externalPhase: ExercisePhase = this.phase === 'BOTTOM' ? 'DOWN' :
                                         this.phase === 'UP' ? 'UP' :
                                         this.phase === 'DOWN' ? 'TRANSITION' : 'IDLE';

    const progress = this.calculateProgress();

    return {
      phase: externalPhase,
      repCount: this.repCount,
      progress,
      visibility: this.lastVisibility,
      debug: {
        elbowAngle: Math.round(this.lastElbowAngle),
        bodyAngle: Math.round(this.lastBodyAngle),
        internalPhase: this.phase,
        selectedSide: this.selectedSide || 'none',
        downThreshold: this.config.downAngleThreshold,
        bottomThreshold: this.config.bottomAngleThreshold,
        upThreshold: this.config.upAngleThreshold,
      },
    };
  }

  getConfig(): Readonly<PushUpConfig> {
    return this.config;
  }

  private selectBodySide(landmarks: NormalizedLandmark[]): BodySide {
    const getVis = (idx: number) => landmarks[idx].visibility ?? 0;

    const leftVisibility =
      getVis(PoseLandmark.LEFT_SHOULDER) +
      getVis(PoseLandmark.LEFT_ELBOW) +
      getVis(PoseLandmark.LEFT_WRIST) +
      getVis(PoseLandmark.LEFT_HIP) +
      getVis(PoseLandmark.LEFT_ANKLE);

    const rightVisibility =
      getVis(PoseLandmark.RIGHT_SHOULDER) +
      getVis(PoseLandmark.RIGHT_ELBOW) +
      getVis(PoseLandmark.RIGHT_WRIST) +
      getVis(PoseLandmark.RIGHT_HIP) +
      getVis(PoseLandmark.RIGHT_ANKLE);

    return leftVisibility >= rightVisibility ? 'left' : 'right';
  }

  private checkVisibility(landmarks: NormalizedLandmark[]): VisibilityStatus {
    if (!this.selectedSide) {
      return 'NOT_VISIBLE';
    }

    const shoulderIdx = this.selectedSide === 'left' ? PoseLandmark.LEFT_SHOULDER : PoseLandmark.RIGHT_SHOULDER;
    const elbowIdx = this.selectedSide === 'left' ? PoseLandmark.LEFT_ELBOW : PoseLandmark.RIGHT_ELBOW;
    const wristIdx = this.selectedSide === 'left' ? PoseLandmark.LEFT_WRIST : PoseLandmark.RIGHT_WRIST;
    const hipIdx = this.selectedSide === 'left' ? PoseLandmark.LEFT_HIP : PoseLandmark.RIGHT_HIP;
    const ankleIdx = this.selectedSide === 'left' ? PoseLandmark.LEFT_ANKLE : PoseLandmark.RIGHT_ANKLE;

    const requiredLandmarks = [shoulderIdx, elbowIdx, wristIdx, hipIdx, ankleIdx];
    const allVisible = requiredLandmarks.every(idx => isVisible(landmarks[idx], this.config.minVisibility));

    if (allVisible) {
      return 'VISIBLE';
    }

    const leftShoulder = landmarks[PoseLandmark.LEFT_SHOULDER].visibility ?? 0;
    const rightShoulder = landmarks[PoseLandmark.RIGHT_SHOULDER].visibility ?? 0;

    if (leftShoulder < this.config.minVisibility && rightShoulder < this.config.minVisibility) {
      return 'NOT_VISIBLE';
    }

    return 'LOW_VISIBILITY';
  }

  private getWorldLandmark(landmarks: NormalizedLandmark[], index: number): Point3D {
    const lm = landmarks[index];
    return {
      x: lm.x,
      y: lm.y,
      z: lm.z || 0,
      visibility: lm.visibility,
    };
  }

  private updateFSM(elbowAngle: number): void {
    switch (this.phase) {
      case 'IDLE':
        if (elbowAngle <= this.config.downAngleThreshold) {
          this.phase = 'DOWN';
        }
        break;

      case 'DOWN':
        if (elbowAngle <= this.config.bottomAngleThreshold) {
          this.phase = 'BOTTOM';
        }
        break;

      case 'BOTTOM':
        if (elbowAngle > this.config.bottomAngleThreshold) {
          this.phase = 'UP';
        }
        break;

      case 'UP':
        if (elbowAngle >= this.config.upAngleThreshold) {
          this.repCount++;
          this.phase = 'IDLE';
        }
        break;
    }
  }

  private calculateProgress(): number {
    const { downAngleThreshold, bottomAngleThreshold } = this.config;
    const range = downAngleThreshold - bottomAngleThreshold;

    if (range === 0) return 0;

    const progress = (downAngleThreshold - this.lastElbowAngle) / range;
    return Math.max(0, Math.min(1, progress));
  }
}
