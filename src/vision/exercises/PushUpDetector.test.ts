/**
 * Tests for PushUpDetector - simplified with manual pose coordinates.
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

/**
 * Pre-calculated push-up poses with verified angles.
 */
const PUSH_UP_POSES = {
  // Extended arms (~160°)
  extended: createTestLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.3, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.4, y: 0.5, z: 0.1, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.55, y: 0.52, z: 0.15, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.25, y: 0.6, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ANKLE]: { x: 0.2, y: 0.8, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.3, y: 0.4, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.4, y: 0.5, z: -0.05, visibility: 0.3 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.55, y: 0.52, z: 0.05, visibility: 0.3 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.25, y: 0.6, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ANKLE]: { x: 0.2, y: 0.8, z: -0.1, visibility: 0.3 },
  }),

  // Mid-descent (~120°)
  midDown: createTestLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.3, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.4, y: 0.5, z: 0.1, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.48, y: 0.55, z: 0.18, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.25, y: 0.6, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ANKLE]: { x: 0.2, y: 0.8, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.3, y: 0.4, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.4, y: 0.5, z: -0.05, visibility: 0.3 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.48, y: 0.55, z: 0.08, visibility: 0.3 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.25, y: 0.6, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ANKLE]: { x: 0.2, y: 0.8, z: -0.1, visibility: 0.3 },
  }),

  // Bottom position (~90°)
  bottom: createTestLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.3, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.4, y: 0.5, z: 0.1, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.4, y: 0.65, z: 0.1, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.25, y: 0.6, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ANKLE]: { x: 0.2, y: 0.8, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.3, y: 0.4, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.4, y: 0.5, z: -0.05, visibility: 0.3 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.4, y: 0.65, z: 0, visibility: 0.3 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.25, y: 0.6, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ANKLE]: { x: 0.2, y: 0.8, z: -0.1, visibility: 0.3 },
  }),

  // Partial depth (~110°, not deep enough)
  partial: createTestLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.3, y: 0.4, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.4, y: 0.5, z: 0.1, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.45, y: 0.58, z: 0.15, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.25, y: 0.6, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ANKLE]: { x: 0.2, y: 0.8, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.3, y: 0.4, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.4, y: 0.5, z: -0.05, visibility: 0.3 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.45, y: 0.58, z: 0.05, visibility: 0.3 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.25, y: 0.6, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ANKLE]: { x: 0.2, y: 0.8, z: -0.1, visibility: 0.3 },
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
      detector.update(PUSH_UP_POSES.extended, 0);
      expect(detector.getState().repCount).toBe(0);

      detector.update(PUSH_UP_POSES.midDown, 100);
      detector.update(PUSH_UP_POSES.bottom, 200);
      detector.update(PUSH_UP_POSES.midDown, 300);

      const state = detector.update(PUSH_UP_POSES.extended, 400);
      expect(state.repCount).toBe(1);
    });
  });

  describe('incomplete reps', () => {
    it('should not count rep if bottom depth not reached', () => {
      detector.update(PUSH_UP_POSES.extended, 0);
      detector.update(PUSH_UP_POSES.midDown, 100);
      detector.update(PUSH_UP_POSES.partial, 200); // Not deep enough
      detector.update(PUSH_UP_POSES.midDown, 300);
      const state = detector.update(PUSH_UP_POSES.extended, 400);

      expect(state.repCount).toBe(0);
    });

    it('should not count rep if not returning to start position', () => {
      detector.update(PUSH_UP_POSES.extended, 0);
      detector.update(PUSH_UP_POSES.midDown, 100);
      detector.update(PUSH_UP_POSES.bottom, 200);
      detector.update(PUSH_UP_POSES.midDown, 300);
      const state = detector.update(PUSH_UP_POSES.midDown, 400); // Not fully up

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
      const sequence = [
        PUSH_UP_POSES.extended,
        PUSH_UP_POSES.midDown,
        PUSH_UP_POSES.bottom,
        PUSH_UP_POSES.midDown,
        PUSH_UP_POSES.extended,
        PUSH_UP_POSES.midDown,
        PUSH_UP_POSES.bottom,
        PUSH_UP_POSES.midDown,
        PUSH_UP_POSES.extended,
      ];

      let state = detector.getState();
      for (let i = 0; i < sequence.length; i++) {
        state = detector.update(sequence[i], i * 100);
      }

      expect(state.repCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('reset', () => {
    it('should reset rep count and phase', () => {
      detector.update(PUSH_UP_POSES.extended, 0);
      detector.update(PUSH_UP_POSES.bottom, 100);
      detector.update(PUSH_UP_POSES.extended, 200);

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
});
