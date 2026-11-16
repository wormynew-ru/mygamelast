import { describe, it, expect, beforeEach } from 'vitest';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { PoseLandmark } from '../types';
import { WallSitDetector } from './WallSitDetector';

function createWallSitLandmarks(
  overrides: Partial<Record<number, Partial<NormalizedLandmark>>> = {}
): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.25,
  }));

  Object.entries(overrides).forEach(([index, values]) => {
    landmarks[Number(index)] = { ...landmarks[Number(index)], ...values };
  });

  return landmarks;
}

const POSES = {
  wallSitLeft: createWallSitLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.4, y: 0.25, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.4, y: 0.55, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_KNEE]: { x: 0.65, y: 0.55, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ANKLE]: { x: 0.65, y: 0.85, z: 0, visibility: 0.95 },
  }),

  wallSitRight: createWallSitLandmarks({
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.4, y: 0.25, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.4, y: 0.55, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_KNEE]: { x: 0.65, y: 0.55, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_ANKLE]: { x: 0.65, y: 0.85, z: 0, visibility: 0.95 },
  }),

  standing: createWallSitLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.4, y: 0.2, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.4, y: 0.5, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_KNEE]: { x: 0.4, y: 0.7, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ANKLE]: { x: 0.4, y: 0.9, z: 0, visibility: 0.95 },
  }),

  notVisible: createWallSitLandmarks({
    [PoseLandmark.LEFT_HIP]: { x: 0.4, y: 0.5, z: 0, visibility: 0.1 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.4, y: 0.5, z: 0, visibility: 0.1 },
  }),
};

describe('WallSitDetector', () => {
  let detector: WallSitDetector;

  beforeEach(() => {
    detector = new WallSitDetector({ smoothingFactor: 0.9, gracePeriodMs: 200 });
  });

  it('starts idle and activates hold when sitting at ~90 deg knee angle', () => {
    expect(detector.getState().isHolding).toBe(false);

    detector.update(POSES.wallSitLeft, 0);
    const state = detector.getState();
    expect(state.isHolding).toBe(true);
    expect(state.visibility).toBe('VISIBLE');
    expect(state.debug?.kneeAngle).toBe(90);
    expect(state.debug?.selectedSide).toBe('left');
  });

  it('accumulates duration over time and breaks after grace period when standing up', () => {
    detector.update(POSES.wallSitLeft, 0);
    detector.update(POSES.wallSitLeft, 2000);
    expect(detector.getState().holdDurationMs).toBe(2000);

    detector.update(POSES.standing, 2100);
    expect(detector.getState().isHolding).toBe(true); // Inside 200ms grace period

    detector.update(POSES.standing, 2400);
    expect(detector.getState().isHolding).toBe(false);
    expect(detector.getState().holdDurationMs).toBeGreaterThanOrEqual(2000);
  });

  it('auto-selects right side and supports 3D worldLandmarks override', () => {
    detector.update(POSES.wallSitRight, 0);
    expect(detector.getState().isHolding).toBe(true);
    expect(detector.getState().debug?.selectedSide).toBe('right');

    const worldStanding = POSES.standing.map((lm) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z ?? 0,
      visibility: lm.visibility ?? 1,
    }));
    const strictDetector = new WallSitDetector({ smoothingFactor: 1.0 });
    const overridden = strictDetector.update(POSES.wallSitLeft, 0, worldStanding);
    expect(overridden.isHolding).toBe(false);
  });

  it('pauses on lost visibility and updates maxKneeAngle via configure', () => {
    detector.update(POSES.wallSitLeft, 0);
    detector.update(POSES.wallSitLeft, 1000);
    detector.update(POSES.notVisible, 1500);

    expect(detector.getState().visibility).toBe('NOT_VISIBLE');
    expect(detector.getState().isHolding).toBe(false);

    detector.configure({ maxKneeAngle: 125 });
    expect(detector.getConfig().maxKneeAngle).toBe(125);
  });
});
