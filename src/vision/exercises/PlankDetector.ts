/**
 * PlankDetector - Hold-based plank detection with side-view auto-selection.
 *
 * Unlike rep-based exercises, plank tracks continuous correct pose holding.
 * Timer increments only while pose is held correctly. Invalid form pauses timer.
 *
 * Key features:
 * - Auto-selects visible body side (left/right) based on landmark visibility
 * - Uses 3D world coordinates to reduce perspective distortion
 * - Returns WRONG_ANGLE status if user faces camera frontally
 * - Tracks hold duration in milliseconds
 * - Emits isHolding boolean + holdDurationMs for combat integration
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { ExerciseDetector, ExerciseState, ExerciseConfig, VisibilityStatus, Point3D } from '../types';
import { PoseLandmark } from '../types';
import {
  angle3D,
  ema,
  isVisible
} from '../angleMath';

/**
 * Plank specific configuration.
 */
export interface PlankConfig extends ExerciseConfig {
  /** Min body angle (shoulder-hip-ankle) for straight plank - lower = sag */
  minBodyAngle: number;

  /** Max body angle for straight plank - higher = hips too high */
  maxBodyAngle: number;

  /** Min elbow angle (shoulder-elbow-wrist) - bent arm tolerance */
  minElbowAngle: number;

  /** Minimum landmark visibility confidence */
  minVisibility: number;

  /** Smoothing factor for angle filtering */
  smoothingFactor: number;

  /** Grace period in ms before breaking form resets timer (allows micro-adjustments) */
  gracePeriodMs: number;
}

const DEFAULT_CONFIG: PlankConfig = {
  minBodyAngle: 160,         // Below 160° = sagging hips
  maxBodyAngle: 190,         // Above 190° = pike position (hips too high)
  minElbowAngle: 70,         // Bent elbows tolerance (90° = perpendicular)
  minVisibility: 0.55,
  smoothingFactor: 0.3,
  gracePeriodMs: 500,        // 500ms grace before form break stops timer
};

type BodySide = 'left' | 'right';

export class PlankDetector implements ExerciseDetector<PlankConfig> {
  private config: PlankConfig;
  private isHolding = false;
  private holdDurationMs = 0;
  private holdStartTime: number | null = null;
  private lastValidHoldTime: number | null = null;
  private smoothedBodyAngle = 0;
  private smoothedElbowAngle = 0;
  private selectedSide: BodySide | null = null;
  private lastBodyAngle = 0;
  private lastElbowAngle = 0;
  private lastVisibility: VisibilityStatus = 'NOT_VISIBLE';

  constructor(config: Partial<PlankConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.isHolding = false;
    this.holdDurationMs = 0;
    this.holdStartTime = null;
    this.lastValidHoldTime = null;
    this.smoothedBodyAngle = 0;
    this.smoothedElbowAngle = 0;
    this.selectedSide = null;
    this.lastBodyAngle = 0;
    this.lastElbowAngle = 0;
    this.lastVisibility = 'NOT_VISIBLE';
  }

  update(landmarks: NormalizedLandmark[], timestamp: number): ExerciseState {
    // Auto-select body side on first frame
    if (!this.selectedSide) {
      this.selectedSide = this.selectBodySide(landmarks);
    }

    const visibilityStatus = this.checkVisibility(landmarks);
    this.lastVisibility = visibilityStatus;

    // If not visible, pause timer but keep accumulated duration
    if (visibilityStatus === 'NOT_VISIBLE') {
      this.pauseHold(timestamp);
      return this.getState();
    }

    // Get 3D world landmarks for selected side
    const shoulder = this.getWorldLandmark(landmarks, this.selectedSide === 'left' ? PoseLandmark.LEFT_SHOULDER : PoseLandmark.RIGHT_SHOULDER);
    const elbow = this.getWorldLandmark(landmarks, this.selectedSide === 'left' ? PoseLandmark.LEFT_ELBOW : PoseLandmark.RIGHT_ELBOW);
    const wrist = this.getWorldLandmark(landmarks, this.selectedSide === 'left' ? PoseLandmark.LEFT_WRIST : PoseLandmark.RIGHT_WRIST);
    const hip = this.getWorldLandmark(landmarks, this.selectedSide === 'left' ? PoseLandmark.LEFT_HIP : PoseLandmark.RIGHT_HIP);
    const ankle = this.getWorldLandmark(landmarks, this.selectedSide === 'left' ? PoseLandmark.LEFT_ANKLE : PoseLandmark.RIGHT_ANKLE);

    // Calculate body alignment (shoulder-hip-ankle)
    const bodyAngle = angle3D(shoulder, hip, ankle);
    this.smoothedBodyAngle = ema(bodyAngle, this.smoothedBodyAngle, this.config.smoothingFactor);
    this.lastBodyAngle = this.smoothedBodyAngle;

    // Calculate elbow angle (shoulder-elbow-wrist)
    const elbowAngle = angle3D(shoulder, elbow, wrist);
    this.smoothedElbowAngle = ema(elbowAngle, this.smoothedElbowAngle, this.config.smoothingFactor);
    this.lastElbowAngle = this.smoothedElbowAngle;

    // Check if pose is correct (body straight, elbows bent ~90°)
    const isBodyAligned =
      this.lastBodyAngle >= this.config.minBodyAngle &&
      this.lastBodyAngle <= this.config.maxBodyAngle;

    const areElbowsCorrect = this.lastElbowAngle >= this.config.minElbowAngle;

    const isCorrectPose = isBodyAligned && areElbowsCorrect && visibilityStatus === 'VISIBLE';

    // Update hold state with grace period
    if (isCorrectPose) {
      if (!this.isHolding) {
        // Start new hold
        this.isHolding = true;
        this.holdStartTime = timestamp;
        this.lastValidHoldTime = timestamp;
      } else {
        // Continue hold - update duration
        this.lastValidHoldTime = timestamp;
        this.holdDurationMs += timestamp - (this.holdStartTime ?? timestamp);
        this.holdStartTime = timestamp;
      }
    } else {
      // Pose broken - check grace period
      if (this.isHolding) {
        const timeSinceLastValid = timestamp - (this.lastValidHoldTime ?? timestamp);
        if (timeSinceLastValid > this.config.gracePeriodMs) {
          // Grace period expired - stop holding (but keep accumulated duration)
          this.pauseHold(timestamp);
        }
        // Within grace period - keep isHolding = true
      }
    }

    // Mark as LOW_VISIBILITY if body not aligned (wrong camera angle)
    if (!isBodyAligned && visibilityStatus === 'VISIBLE') {
      this.lastVisibility = 'LOW_VISIBILITY';
    }

    return this.getState();
  }

  configure(config: Partial<PlankConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getState(): ExerciseState {
    return {
      phase: this.isHolding ? 'DOWN' : 'IDLE', // DOWN = holding plank, IDLE = not holding
      repCount: 0, // Hold-based exercises don't count reps
      progress: this.isHolding ? 1.0 : 0.0, // Binary: holding or not
      visibility: this.lastVisibility,
      isHolding: this.isHolding,
      holdDurationMs: this.holdDurationMs,
      debug: {
        bodyAngle: Math.round(this.lastBodyAngle),
        elbowAngle: Math.round(this.lastElbowAngle),
        selectedSide: this.selectedSide || 'none',
        minBodyAngle: this.config.minBodyAngle,
        maxBodyAngle: this.config.maxBodyAngle,
        minElbowAngle: this.config.minElbowAngle,
        holdDurationSec: Math.floor(this.holdDurationMs / 1000),
      },
    };
  }

  getConfig(): Readonly<PlankConfig> {
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

    // Check if both shoulders lost (user facing camera frontally)
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

  private pauseHold(timestamp: number): void {
    if (this.isHolding && this.holdStartTime !== null) {
      // Add partial hold time before pausing
      this.holdDurationMs += timestamp - this.holdStartTime;
    }
    this.isHolding = false;
    this.holdStartTime = null;
  }
}
