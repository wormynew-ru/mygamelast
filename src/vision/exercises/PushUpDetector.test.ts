/**
 * Tests for PushUpDetector - verified 3D push-up pose coordinates.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PushUpDetector } from './PushUpDetector';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { PoseLandmark } from '../types';

function createTestLandmarks(overrides: Partial<Record<number, Partial<NormalizedLandmark>>> = {}): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));

  Object.entries(overrides).forEach(([index, values]) => {
    landmarks[Number(index)] = { ...landmarks[Number(index)], ...values };
  });

  return landmarks;
}

function feedFrames(
  detector: PushUpDetector,
  pose: NormalizedLandmark[],
  count: number,
  startTimestamp: number,
  stepMs = 33
): { state: ReturnType<PushUpDetector['getState']>; nextTimestamp: number } {
  let state = detector.getState();
  let ts = startTimestamp;
  for (let i = 0; i < count; i++) {
    state = detector.update(pose, ts);
    ts += stepMs;
  }
  return { state, nextTimestamp: ts };
}

/**
 * Pre-calculated push-up poses with verified 3D angles:
 * - Shoulder at (0.3, 0.4, 0), Hip at (0.5, 0.4, 0), Ankle at (0.7, 0.4, 0) => 180° straight body
 * - Elbow below shoulder at (0.3, 0.55, 0)
 * - Wrist positioned to produce exact elbow angles:
 *   - extended: ~180°
 *   - midDown: ~127°
 *   - partial: ~110°
 *   - bottom: ~79°
 */
const PUSH_UP_POSES = {
  extended: createTestLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.3, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.3, y: 0.55, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.3, y: 0.70, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.5, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ANKLE]: { x: 0.7, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.3, y: 0.4, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.3, y: 0.55, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.3, y: 0.70, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.5, y: 0.4, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ANKLE]: { x: 0.7, y: 0.4, z: -0.1, visibility: 0.3 },
  }),

  midDown: createTestLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.3, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.3, y: 0.55, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.42, y: 0.64, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.5, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ANKLE]: { x: 0.7, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.3, y: 0.4, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.3, y: 0.55, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.42, y: 0.64, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.5, y: 0.4, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ANKLE]: { x: 0.7, y: 0.4, z: -0.1, visibility: 0.3 },
  }),

  bottom: createTestLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.3, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.3, y: 0.55, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.45, y: 0.52, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.5, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ANKLE]: { x: 0.7, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.3, y: 0.4, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.3, y: 0.55, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.45, y: 0.52, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.5, y: 0.4, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ANKLE]: { x: 0.7, y: 0.4, z: -0.1, visibility: 0.3 },
  }),

  partial: createTestLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.3, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.3, y: 0.55, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.44, y: 0.60, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.5, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ANKLE]: { x: 0.7, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.3, y: 0.4, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.3, y: 0.55, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.44, y: 0.60, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.5, y: 0.4, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ANKLE]: { x: 0.7, y: 0.4, z: -0.1, visibility: 0.3 },
  }),
};

describe('PushUpDetector', () => {
  let detector: PushUpDetector;

  beforeEach(() => {
    detector = new PushUpDetector();
  });

  describe('initialization', () => {
    it('should start with 0 reps', () => {
      expect(detector.getState().repCount).toBe(0);
    });

    it('should accept custom config', () => {
      const customDetector = new PushUpDetector({
        bottomAngleThreshold: 80,
        smoothingFactor: 0.5,
      });

      const config = customDetector.getConfig();
      expect(config.bottomAngleThreshold).toBe(80);
      expect(config.smoothingFactor).toBe(0.5);
    });
  });

  describe('side selection', () => {
    it('should auto-select left side when left is more visible', () => {
      detector.update(PUSH_UP_POSES.extended, 0);
      expect(detector.getState().debug?.selectedSide).toBe('left');
    });

    it('should auto-select right side when right is more visible', () => {
      const landmarks = createTestLandmarks({
        [PoseLandmark.RIGHT_SHOULDER]: { visibility: 0.95 },
        [PoseLandmark.RIGHT_ELBOW]: { visibility: 0.95 },
        [PoseLandmark.RIGHT_WRIST]: { visibility: 0.95 },
        [PoseLandmark.RIGHT_HIP]: { visibility: 0.95 },
        [PoseLandmark.RIGHT_ANKLE]: { visibility: 0.95 },
        [PoseLandmark.LEFT_SHOULDER]: { visibility: 0.3 },
        [PoseLandmark.LEFT_ELBOW]: { visibility: 0.3 },
        [PoseLandmark.LEFT_WRIST]: { visibility: 0.3 },
        [PoseLandmark.LEFT_HIP]: { visibility: 0.3 },
        [PoseLandmark.LEFT_ANKLE]: { visibility: 0.3 },
      });

      detector.update(landmarks, 0);
      expect(detector.getState().debug?.selectedSide).toBe('right');
    });
  });

  describe('full push-up rep', () => {
    it('should count rep after full cycle', () => {
      let ts = 0;
      ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.extended, 3, ts));
      expect(detector.getState().repCount).toBe(0);

      ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.midDown, 5, ts));
      ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.bottom, 8, ts));
      ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.midDown, 5, ts));
      const { state } = feedFrames(detector, PUSH_UP_POSES.extended, 8, ts);

      expect(state.repCount).toBe(1);
    });
  });

  describe('incomplete reps', () => {
    it('should not count rep if bottom depth not reached', () => {
      let ts = 0;
      ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.extended, 3, ts));
      ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.midDown, 5, ts));
      ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.partial, 8, ts));
      ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.midDown, 5, ts));
      const { state } = feedFrames(detector, PUSH_UP_POSES.extended, 8, ts);

      expect(state.repCount).toBe(0);
    });

    it('should not count rep if not returning to start position', () => {
      let ts = 0;
      ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.extended, 3, ts));
      ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.midDown, 5, ts));
      ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.bottom, 8, ts));
      const { state } = feedFrames(detector, PUSH_UP_POSES.midDown, 5, ts);

      expect(state.repCount).toBe(0);
    });
  });

  describe('visibility handling', () => {
    it('should pause detection when landmarks not visible', () => {
      detector.update(PUSH_UP_POSES.extended, 0);
      detector.update(PUSH_UP_POSES.midDown, 100);

      const lowVisLandmarks = createTestLandmarks({
        [PoseLandmark.LEFT_SHOULDER]: { visibility: 0.2 },
        [PoseLandmark.LEFT_ELBOW]: { visibility: 0.2 },
        [PoseLandmark.LEFT_WRIST]: { visibility: 0.2 },
        [PoseLandmark.LEFT_HIP]: { visibility: 0.2 },
        [PoseLandmark.LEFT_ANKLE]: { visibility: 0.2 },
      });

      const state = detector.update(lowVisLandmarks, 200);
      expect(state.visibility).not.toBe('VISIBLE');
    });
  });

  describe('rapid consecutive reps', () => {
    it('should count multiple reps', () => {
      let ts = 0;
      for (let rep = 0; rep < 2; rep++) {
        ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.extended, 8, ts));
        ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.midDown, 4, ts));
        ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.bottom, 8, ts));
        ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.midDown, 4, ts));
      }
      const { state } = feedFrames(detector, PUSH_UP_POSES.extended, 8, ts);

      expect(state.repCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('reset', () => {
    it('should reset rep count and phase', () => {
      let ts = 0;
      ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.extended, 3, ts));
      ({ nextTimestamp: ts } = feedFrames(detector, PUSH_UP_POSES.bottom, 8, ts));
      feedFrames(detector, PUSH_UP_POSES.extended, 8, ts);

      detector.reset();
      const state = detector.getState();

      expect(state.repCount).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should allow runtime config changes', () => {
      detector.configure({ bottomAngleThreshold: 85 });

      const config = detector.getConfig();
      expect(config.bottomAngleThreshold).toBe(85);
    });
  });

  describe('worldLandmarks & dynamic side switching', () => {
    it('switches selected side when the opposite side becomes clearly more visible', () => {
      detector.update(PUSH_UP_POSES.extended, 0);
      expect(detector.getState().debug?.selectedSide).toBe('left');

      const rightDominant = createTestLandmarks({
        [PoseLandmark.RIGHT_SHOULDER]: { x: 0.3, y: 0.4, z: 0, visibility: 0.95 },
        [PoseLandmark.RIGHT_ELBOW]: { x: 0.3, y: 0.55, z: 0, visibility: 0.95 },
        [PoseLandmark.RIGHT_WRIST]: { x: 0.3, y: 0.70, z: 0, visibility: 0.95 },
        [PoseLandmark.RIGHT_HIP]: { x: 0.5, y: 0.4, z: 0, visibility: 0.95 },
        [PoseLandmark.RIGHT_ANKLE]: { x: 0.7, y: 0.4, z: 0, visibility: 0.95 },
        [PoseLandmark.LEFT_SHOULDER]: { x: 0.3, y: 0.4, z: -0.1, visibility: 0.25 },
        [PoseLandmark.LEFT_ELBOW]: { x: 0.3, y: 0.55, z: -0.1, visibility: 0.25 },
        [PoseLandmark.LEFT_WRIST]: { x: 0.3, y: 0.70, z: -0.1, visibility: 0.25 },
        [PoseLandmark.LEFT_HIP]: { x: 0.5, y: 0.4, z: -0.1, visibility: 0.25 },
        [PoseLandmark.LEFT_ANKLE]: { x: 0.7, y: 0.4, z: -0.1, visibility: 0.25 },
      });

      detector.update(rightDominant, 33);
      expect(detector.getState().debug?.selectedSide).toBe('right');
    });

    it('prefers optional 3D worldLandmarks for angle computation when supplied', () => {
      // Visibility stays on 2D landmarks (extended pose), while 3D worldLandmarks encode bottom pose (~79 deg)
      const worldBottom = PUSH_UP_POSES.bottom.map((lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z ?? 0,
        visibility: lm.visibility ?? 1,
      }));
      const state = detector.update(PUSH_UP_POSES.extended, 0, worldBottom);
      expect(state.debug?.elbowAngle).toBeLessThan(95);
    });
  });
});
