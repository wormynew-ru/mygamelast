import { describe, it, expect, beforeEach } from 'vitest';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { PoseLandmark } from '../types';
import { ArmHoldDetector } from './ArmHoldDetector';

function createArmLandmarks(
  overrides: Partial<Record<number, Partial<NormalizedLandmark>>> = {}
): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.95,
  }));

  Object.entries(overrides).forEach(([index, values]) => {
    landmarks[Number(index)] = { ...landmarks[Number(index)], ...values };
  });

  return landmarks;
}

const POSES = {
  tPoseHold: createArmLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.6, y: 0.3, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.75, y: 0.3, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.9, y: 0.3, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.6, y: 0.6, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.4, y: 0.3, visibility: 0.95 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.25, y: 0.3, visibility: 0.95 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.1, y: 0.3, visibility: 0.95 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.4, y: 0.6, visibility: 0.95 },
  }),

  armsDown: createArmLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.6, y: 0.3, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.61, y: 0.45, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.62, y: 0.6, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.6, y: 0.6, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.4, y: 0.3, visibility: 0.95 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.39, y: 0.45, visibility: 0.95 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.38, y: 0.6, visibility: 0.95 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.4, y: 0.6, visibility: 0.95 },
  }),

  bentElbows: createArmLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.6, y: 0.3, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.75, y: 0.3, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.75, y: 0.15, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.6, y: 0.6, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.4, y: 0.3, visibility: 0.95 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.25, y: 0.3, visibility: 0.95 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.25, y: 0.15, visibility: 0.95 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.4, y: 0.6, visibility: 0.95 },
  }),

  notVisible: createArmLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.6, y: 0.3, visibility: 0.1 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.4, y: 0.3, visibility: 0.1 },
  }),
};

describe('ArmHoldDetector', () => {
  let detector: ArmHoldDetector;

  beforeEach(() => {
    detector = new ArmHoldDetector({ smoothingFactor: 0.9, gracePeriodMs: 200 });
  });

  it('starts idle with 0ms hold duration and 0 reps', () => {
    const state = detector.getState();
    expect(state.isHolding).toBe(false);
    expect(state.holdDurationMs).toBe(0);
    expect(state.repCount).toBe(0);
    expect(state.phase).toBe('IDLE');
  });

  it('tracks T-pose arm hold and accumulates duration', () => {
    detector.update(POSES.tPoseHold, 0);
    expect(detector.getState().isHolding).toBe(true);
    expect(detector.getState().phase).toBe('DOWN');
    expect(detector.getState().progress).toBe(1.0);

    detector.update(POSES.tPoseHold, 1500);
    expect(detector.getState().holdDurationMs).toBe(1500);
    expect(detector.getState().debug?.armAngle).toBe(90);
  });

  it('rejects arms hanging down or bent elbows once grace period expires', () => {
    detector.update(POSES.tPoseHold, 0);
    expect(detector.getState().isHolding).toBe(true);

    // Within grace period still holds
    detector.update(POSES.armsDown, 100);
    expect(detector.getState().isHolding).toBe(true);

    // After grace period expires
    detector.update(POSES.armsDown, 400);
    expect(detector.getState().isHolding).toBe(false);

    // Bent elbows must not start a hold
    detector.reset();
    detector.update(POSES.bentElbows, 0);
    expect(detector.getState().isHolding).toBe(false);
  });

  it('pauses hold on lost visibility while preserving duration and resets cleanly', () => {
    detector.update(POSES.tPoseHold, 0);
    detector.update(POSES.tPoseHold, 1200);
    detector.update(POSES.notVisible, 1600);

    const paused = detector.getState();
    expect(paused.isHolding).toBe(false);
    expect(paused.holdDurationMs).toBeGreaterThanOrEqual(1200);
    expect(paused.visibility).toBe('NOT_VISIBLE');

    detector.reset();
    expect(detector.getState().holdDurationMs).toBe(0);
    expect(detector.getState().isHolding).toBe(false);
  });
});
