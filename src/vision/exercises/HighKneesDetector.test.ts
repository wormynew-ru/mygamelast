/**
 * Unit tests for HighKneesDetector FSM and alternating leg tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { PoseLandmark } from '../types';
import { HighKneesDetector } from './HighKneesDetector';

function createHighKneesPose(leftHipAngleDeg: number, rightHipAngleDeg: number): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array(33)
    .fill(null)
    .map(() => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));

  const buildSide = (
    shoulderIdx: PoseLandmark,
    hipIdx: PoseLandmark,
    kneeIdx: PoseLandmark,
    angleDeg: number,
    baseX: number
  ) => {
    const hipX = baseX;
    const hipY = 0.5;
    const shoulderX = baseX;
    const shoulderY = 0.3;
    const thighLen = 0.2;
    const rad = ((180 - angleDeg) * Math.PI) / 180;
    landmarks[shoulderIdx] = { x: shoulderX, y: shoulderY, z: 0, visibility: 0.95 };
    landmarks[hipIdx] = { x: hipX, y: hipY, z: 0, visibility: 0.95 };
    landmarks[kneeIdx] = {
      x: hipX + thighLen * Math.sin(rad),
      y: hipY + thighLen * Math.cos(rad),
      z: 0,
      visibility: 0.95,
    };
  };

  buildSide(PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_HIP, PoseLandmark.LEFT_KNEE, leftHipAngleDeg, 0.45);
  buildSide(PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_HIP, PoseLandmark.RIGHT_KNEE, rightHipAngleDeg, 0.55);

  return landmarks;
}

describe('HighKneesDetector', () => {
  let detector: HighKneesDetector;

  beforeEach(() => {
    detector = new HighKneesDetector({
      liftAngle: 110,
      standingAngle: 145,
      hysteresis: 8,
      smoothingFactor: 0.9,
      minVisibility: 0.55,
    });
  });

  it('starts in IDLE with 0 reps', () => {
    const state = detector.getState();
    expect(state.phase).toBe('IDLE');
    expect(state.repCount).toBe(0);
  });

  it('counts alternating left and right high-knee reps even during overlapping transitions', () => {
    let t = 0;
    detector.update(createHighKneesPose(170, 170), t);
    t += 40;
    detector.update(createHighKneesPose(95, 170), t); // Left knee up
    expect(detector.getState().phase).toBe('UP');

    t += 40;
    detector.update(createHighKneesPose(165, 95), t); // Left down + Right up simultaneously
    expect(detector.getState().repCount).toBe(1);

    t += 40;
    detector.update(createHighKneesPose(168, 168), t); // Right down
    expect(detector.getState().repCount).toBe(2);
    expect(detector.getState().phase).toBe('IDLE');
  });

  it('ignores shallow knee lifts that do not pass liftAngle', () => {
    let t = 0;
    detector.update(createHighKneesPose(170, 170), t);
    t += 40;
    detector.update(createHighKneesPose(130, 170), t);
    t += 40;
    detector.update(createHighKneesPose(170, 170), t);

    expect(detector.getState().repCount).toBe(0);
  });

  it('reports LOW_VISIBILITY when hips/knees are occluded', () => {
    const lm = createHighKneesPose(170, 170);
    lm[PoseLandmark.LEFT_KNEE].visibility = 0.2;
    lm[PoseLandmark.RIGHT_KNEE].visibility = 0.2;
    expect(detector.update(lm, 0).visibility).toBe('LOW_VISIBILITY');
  });
});
