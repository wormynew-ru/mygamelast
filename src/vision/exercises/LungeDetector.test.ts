/**
 * Unit tests for LungeDetector FSM and hysteresis logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { PoseLandmark } from '../types';
import { LungeDetector } from './LungeDetector';

function createLungePose(leadKneeAngleDeg: number, trailingKneeAngleDeg = 165): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array(33)
    .fill(null)
    .map(() => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));

  const buildLeg = (
    hipIdx: PoseLandmark,
    kneeIdx: PoseLandmark,
    ankleIdx: PoseLandmark,
    angleDeg: number,
    hipX: number
  ) => {
    const kneeX = hipX;
    const kneeY = 0.55;
    const hipY = 0.35;
    const rad = ((180 - angleDeg) * Math.PI) / 180;
    const ankleDist = 0.2;
    landmarks[hipIdx] = { x: hipX, y: hipY, z: 0, visibility: 0.95 };
    landmarks[kneeIdx] = { x: kneeX, y: kneeY, z: 0, visibility: 0.95 };
    landmarks[ankleIdx] = {
      x: kneeX + ankleDist * Math.sin(rad),
      y: kneeY + ankleDist * Math.cos(rad),
      z: 0,
      visibility: 0.95,
    };
  };

  buildLeg(PoseLandmark.LEFT_HIP, PoseLandmark.LEFT_KNEE, PoseLandmark.LEFT_ANKLE, leadKneeAngleDeg, 0.45);
  buildLeg(PoseLandmark.RIGHT_HIP, PoseLandmark.RIGHT_KNEE, PoseLandmark.RIGHT_ANKLE, trailingKneeAngleDeg, 0.55);

  return landmarks;
}

describe('LungeDetector', () => {
  let detector: LungeDetector;

  beforeEach(() => {
    detector = new LungeDetector({
      standingAngle: 158,
      bottomAngle: 95,
      hysteresis: 10,
      smoothingFactor: 0.9,
      minVisibility: 0.55,
      minBottomHoldTime: 50,
    });
  });

  it('starts in IDLE with 0 reps', () => {
    const state = detector.getState();
    expect(state.phase).toBe('IDLE');
    expect(state.repCount).toBe(0);
    expect(state.progress).toBe(0);
  });

  it('counts a complete lunge rep when lead knee reaches bottom angle and returns', () => {
    let t = 0;
    detector.update(createLungePose(170), t);
    t += 50;
    detector.update(createLungePose(140), t);
    expect(detector.getState().phase).toBe('DOWN');

    t += 50;
    detector.update(createLungePose(92), t);
    expect(detector.getState().phase).toBe('TRANSITION');

    t += 60;
    detector.update(createLungePose(92), t);
    t += 50;
    detector.update(createLungePose(125), t);
    t += 50;
    detector.update(createLungePose(165), t);

    expect(detector.getState().repCount).toBe(1);
    expect(detector.getState().phase).toBe('IDLE');
  });

  it('does not count shallow lunges above bottom threshold', () => {
    let t = 0;
    detector.update(createLungePose(170), t);
    t += 50;
    detector.update(createLungePose(130), t);
    t += 50;
    detector.update(createLungePose(118), t);
    t += 50;
    detector.update(createLungePose(168), t);

    expect(detector.getState().repCount).toBe(0);
  });

  it('prevents double counting from bottom jitter', () => {
    let t = 0;
    detector.update(createLungePose(170), t);
    t += 50;
    detector.update(createLungePose(135), t);
    t += 50;
    detector.update(createLungePose(95), t);
    t += 60;
    detector.update(createLungePose(95), t);
    t += 40;
    detector.update(createLungePose(102), t);
    t += 40;
    detector.update(createLungePose(92), t);
    t += 50;
    detector.update(createLungePose(130), t);
    t += 50;
    detector.update(createLungePose(168), t);

    expect(detector.getState().repCount).toBe(1);
  });

  it('supports single-leg visibility fallback when one leg is occluded', () => {
    const makeRightOnly = (angle: number) => {
      const lm = createLungePose(170, angle);
      lm[PoseLandmark.LEFT_HIP].visibility = 0.1;
      lm[PoseLandmark.LEFT_KNEE].visibility = 0.1;
      lm[PoseLandmark.LEFT_ANKLE].visibility = 0.1;
      return lm;
    };

    let t = 0;
    detector.update(makeRightOnly(170), t);
    t += 50;
    detector.update(makeRightOnly(130), t);
    t += 50;
    detector.update(makeRightOnly(90), t);
    t += 60;
    detector.update(makeRightOnly(90), t);
    t += 50;
    detector.update(makeRightOnly(128), t);
    t += 50;
    detector.update(makeRightOnly(168), t);

    expect(detector.getState().visibility).toBe('VISIBLE');
    expect(detector.getState().repCount).toBe(1);
  });

  it('reports LOW_VISIBILITY when both legs are occluded and resets cleanly', () => {
    const lm = createLungePose(170);
    lm[PoseLandmark.LEFT_KNEE].visibility = 0.2;
    lm[PoseLandmark.RIGHT_KNEE].visibility = 0.2;
    expect(detector.update(lm, 0).visibility).toBe('LOW_VISIBILITY');

    detector.reset();
    expect(detector.getState().repCount).toBe(0);
    expect(detector.getState().phase).toBe('IDLE');
  });
});
