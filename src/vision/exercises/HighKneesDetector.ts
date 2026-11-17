/**
 * HighKneesDetector - Rep-based cardio high-knees detector.
 *
 * Detection logic:
 * - Tracks shoulder -> hip -> knee flexion angle independently on left & right legs
 * - When standing, shoulder-hip-knee is ~170-180 deg; lifting knee toward torso drops angle <= liftAngle
 * - Each leg has its own fast lift/lower FSM so rapid alternating knees never miss a rep
 * - Supports single-leg visibility fallback (e.g. angled camera)
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

type LegPhase = 'DOWN' | 'LIFTED';

export interface HighKneesConfig extends ExerciseConfig {
  /** Shoulder-hip-knee angle (degrees) considered lifted high enough (default: 110) */
  liftAngle: number;

  /** Shoulder-hip-knee angle (degrees) considered lowered to standing (default: 145) */
  standingAngle: number;

  /** Hysteresis zone in degrees (default: 8) */
  hysteresis: number;

  /** Smoothing factor for EMA filtering (0-1, default: 0.45) */
  smoothingFactor: number;

  /** Minimum landmark visibility confidence (0-1, default: 0.55) */
  minVisibility: number;
}

const DEFAULT_CONFIG: HighKneesConfig = {
  liftAngle: 110,
  standingAngle: 145,
  hysteresis: 8,
  smoothingFactor: 0.45,
  minVisibility: 0.55,
};

interface SideTracker {
  phase: LegPhase;
  smoothedAngle: number;
  initialized: boolean;
}

export class HighKneesDetector implements ExerciseDetector<HighKneesConfig> {
  private config: HighKneesConfig;
  private repCount = 0;
  private visibility: VisibilityStatus = 'NOT_VISIBLE';
  private left: SideTracker = { phase: 'DOWN', smoothedAngle: 172, initialized: false };
  private right: SideTracker = { phase: 'DOWN', smoothedAngle: 172, initialized: false };
  private lastSide: 'LEFT' | 'RIGHT' | 'NONE' = 'NONE';

  constructor(config: Partial<HighKneesConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.repCount = 0;
    this.visibility = 'NOT_VISIBLE';
    this.left = { phase: 'DOWN', smoothedAngle: 172, initialized: false };
    this.right = { phase: 'DOWN', smoothedAngle: 172, initialized: false };
    this.lastSide = 'NONE';
  }

  update(landmarks: NormalizedLandmark[], _timestamp: number): ExerciseState {
    const minVis = this.config.minVisibility;

    const lShoulder = landmarks[PoseLandmark.LEFT_SHOULDER];
    const lHip = landmarks[PoseLandmark.LEFT_HIP];
    const lKnee = landmarks[PoseLandmark.LEFT_KNEE];
    const leftVisible =
      isVisible(lShoulder, minVis) && isVisible(lHip, minVis) && isVisible(lKnee, minVis);

    const rShoulder = landmarks[PoseLandmark.RIGHT_SHOULDER];
    const rHip = landmarks[PoseLandmark.RIGHT_HIP];
    const rKnee = landmarks[PoseLandmark.RIGHT_KNEE];
    const rightVisible =
      isVisible(rShoulder, minVis) && isVisible(rHip, minVis) && isVisible(rKnee, minVis);

    if (!leftVisible && !rightVisible) {
      this.visibility = 'LOW_VISIBILITY';
      return this.getState();
    }

    this.visibility = 'VISIBLE';

    if (leftVisible) {
      const rawLeft = angle2D(lShoulder, lHip, lKnee);
      this.left.smoothedAngle = this.left.initialized
        ? ema(rawLeft, this.left.smoothedAngle, this.config.smoothingFactor)
        : rawLeft;
      this.left.initialized = true;
      this.stepLegFSM(this.left, 'LEFT');
    }

    if (rightVisible) {
      const rawRight = angle2D(rShoulder, rHip, rKnee);
      this.right.smoothedAngle = this.right.initialized
        ? ema(rawRight, this.right.smoothedAngle, this.config.smoothingFactor)
        : rawRight;
      this.right.initialized = true;
      this.stepLegFSM(this.right, 'RIGHT');
    }

    return this.getState();
  }

  configure(config: Partial<HighKneesConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getState(): ExerciseState {
    const activeAngle = Math.min(this.left.smoothedAngle, this.right.smoothedAngle);
    const anyLifted = this.left.phase === 'LIFTED' || this.right.phase === 'LIFTED';
    const phase: ExerciseState['phase'] = anyLifted
      ? 'UP'
      : activeAngle < this.config.standingAngle - this.config.hysteresis
        ? 'TRANSITION'
        : 'IDLE';

    return {
      phase,
      repCount: this.repCount,
      progress: mapRange(
        activeAngle,
        this.config.standingAngle,
        this.config.liftAngle,
        0.0,
        1.0,
        true
      ),
      visibility: this.visibility,
      debug: {
        leftHipAngle: Math.round(this.left.smoothedAngle),
        rightHipAngle: Math.round(this.right.smoothedAngle),
        lastSide: this.lastSide,
      },
    };
  }

  getConfig(): Readonly<HighKneesConfig> {
    return { ...this.config };
  }

  private stepLegFSM(side: SideTracker, label: 'LEFT' | 'RIGHT'): void {
    const { liftAngle, standingAngle, hysteresis } = this.config;
    const enterLiftThreshold = liftAngle + hysteresis * 0.25;
    const returnStandThreshold = standingAngle - hysteresis;

    if (side.phase === 'DOWN') {
      if (side.smoothedAngle <= enterLiftThreshold) {
        side.phase = 'LIFTED';
      }
    } else if (side.smoothedAngle >= returnStandThreshold) {
      side.phase = 'DOWN';
      this.repCount++;
      this.lastSide = label;
    }
  }
}
