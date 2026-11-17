/**
 * Unit tests for FrontRaiseDetector FSM and hysteresis logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { PoseLandmark } from '../types';
import { FrontRaiseDetector } from './FrontRaiseDetector';

function createFrontRaisePose(angleDeg: number): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array(33)
    .fill(null)
    .map(() => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));

  const setArm = (
    shoulderIdx: PoseLandmark,
    hipIdx: PoseLandmark,
    wristIdx: PoseLandmark,
    xSign: number,
    baseX: number
  ) => {
    const shoulder = { x: baseX, y: 0.3, z: 0, visibility: 0.95 };
    const hip = { x: baseX, y: 0.55, z: 0, visibility: 0.95 };
    const rad = (angleDeg * Math.PI) / 180;
    const armLen = 0.25;
    const wrist = {
      x: shoulder.x + xSign * armLen * Math.sin(rad),
      y: shoulder.y + armLen * Math.cos(rad),
      z: 0,
      visibility: 0.95,
    };
    landmarks[shoulderIdx] = shoulder;
    landmarks[hipIdx] = hip;
    landmarks[wristIdx] = wrist;
  };

  setArm(PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_HIP, PoseLandmark.LEFT_WRIST, -1, 0.42);
  setArm(PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_HIP, PoseLandmark.RIGHT_WRIST, 1, 0.58);

  return landmarks;
}

describe('FrontRaiseDetector', () => {
  let detector: FrontRaiseDetector;

  beforeEach(() => {
    detector = new FrontRaiseDetector({
      restAngle: 35,
      peakAngle: 85,
      hysteresis: 10,
      smoothingFactor: 0.9,
      minVisibility: 0.55,
    });
  });

  it('starts in IDLE with 0 reps', () => {
    expect(detector.getState().phase).toBe('IDLE');
    expect(detector.getState().repCount).toBe(0);
  });

  it('counts a full front raise rep when arms lift to shoulder height and lower back down', () => {
    let t = 0;
    detector.update(createFrontRaisePose(15), t);
    t += 50;
    detector.update(createFrontRaisePose(55), t);
    expect(detector.getState().phase).toBe('UP');

    t += 50;
    detector.update(createFrontRaisePose(90), t);
    expect(detector.getState().phase).toBe('TRANSITION');

    t += 50;
    detector.update(createFrontRaisePose(55), t);
    t += 50;
    detector.update(createFrontRaisePose(15), t);

    expect(detector.getState().repCount).toBe(1);
    expect(detector.getState().phase).toBe('IDLE');
  });

  it('ignores partial raises below peak threshold', () => {
    let t = 0;
    detector.update(createFrontRaisePose(15), t);
    t += 50;
    detector.update(createFrontRaisePose(60), t);
    t += 50;
    detector.update(createFrontRaisePose(15), t);

    expect(detector.getState().repCount).toBe(0);
  });

  it('handles low visibility gracefully', () => {
    const lm = createFrontRaisePose(15);
    lm[PoseLandmark.LEFT_WRIST].visibility = 0.2;
    lm[PoseLandmark.RIGHT_WRIST].visibility = 0.2;
    expect(detector.update(lm, 0).visibility).toBe('LOW_VISIBILITY');
  });
});
