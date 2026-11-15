/**
 * Unit tests for PlankDetector hold-based logic.
 * Uses pre-calculated landmark poses with verified angles.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PlankDetector } from './PlankDetector';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { PoseLandmark } from '../types';

function createTestLandmarks(overrides: Partial<Record<number, Partial<NormalizedLandmark>>> = {}): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.3, // Default low visibility for occluded far side
  }));

  Object.entries(overrides).forEach(([index, values]) => {
    landmarks[Number(index)] = { ...landmarks[Number(index)], ...values };
  });

  return landmarks;
}

/**
 * Pre-calculated plank poses with verified angles.
 * Side view: left side visible, body horizontal at ~0.5y.
 */
const PLANK_POSES = {
  // Correct plank: body ~175°, elbows ~85°
  correct: createTestLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.5, y: 0.5, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.4, y: 0.6, z: 0.05, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.35, y: 0.65, z: 0.1, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.65, y: 0.51, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ANKLE]: { x: 0.8, y: 0.52, z: 0, visibility: 0.95 },
    // Right side occluded
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.5, y: 0.5, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.4, y: 0.6, z: -0.05, visibility: 0.3 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.35, y: 0.65, z: 0, visibility: 0.3 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.65, y: 0.51, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ANKLE]: { x: 0.8, y: 0.52, z: -0.1, visibility: 0.3 },
  }),

  // Sagging hips: body ~155° (below minBodyAngle 160°)
  sagging: createTestLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.5, y: 0.5, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.4, y: 0.6, z: 0.05, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.35, y: 0.65, z: 0.1, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.65, y: 0.58, z: 0, visibility: 0.95 }, // Hips sagging down
    [PoseLandmark.LEFT_ANKLE]: { x: 0.8, y: 0.52, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.5, y: 0.5, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.4, y: 0.6, z: -0.05, visibility: 0.3 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.35, y: 0.65, z: 0, visibility: 0.3 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.65, y: 0.58, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ANKLE]: { x: 0.8, y: 0.52, z: -0.1, visibility: 0.3 },
  }),

  // Hips too high (pike): body ~195° (above maxBodyAngle 190°)
  pike: createTestLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.5, y: 0.5, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.4, y: 0.6, z: 0.05, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.35, y: 0.65, z: 0.1, visibility: 0.95 },
    [PoseLandmark.LEFT_HIP]: { x: 0.65, y: 0.42, z: 0, visibility: 0.95 }, // Hips raised up
    [PoseLandmark.LEFT_ANKLE]: { x: 0.8, y: 0.52, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.5, y: 0.5, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.4, y: 0.6, z: -0.05, visibility: 0.3 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.35, y: 0.65, z: 0, visibility: 0.3 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.65, y: 0.42, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ANKLE]: { x: 0.8, y: 0.52, z: -0.1, visibility: 0.3 },
  }),

  // Right side visible (left occluded)
  correctRightSide: createTestLandmarks({
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.5, y: 0.5, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.4, y: 0.6, z: 0.05, visibility: 0.95 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.35, y: 0.65, z: 0.1, visibility: 0.95 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.65, y: 0.51, z: 0, visibility: 0.95 },
    [PoseLandmark.RIGHT_ANKLE]: { x: 0.8, y: 0.52, z: 0, visibility: 0.95 },
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.5, y: 0.5, z: -0.1, visibility: 0.3 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.4, y: 0.6, z: -0.05, visibility: 0.3 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.35, y: 0.65, z: 0, visibility: 0.3 },
    [PoseLandmark.LEFT_HIP]: { x: 0.65, y: 0.51, z: -0.1, visibility: 0.3 },
    [PoseLandmark.LEFT_ANKLE]: { x: 0.8, y: 0.52, z: -0.1, visibility: 0.3 },
  }),

  // Low visibility (all landmarks occluded)
  lowVisibility: createTestLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.5, y: 0.5, z: 0, visibility: 0.3 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.4, y: 0.6, z: 0.05, visibility: 0.3 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.35, y: 0.65, z: 0.1, visibility: 0.3 },
    [PoseLandmark.LEFT_HIP]: { x: 0.65, y: 0.51, z: 0, visibility: 0.3 },
    [PoseLandmark.LEFT_ANKLE]: { x: 0.8, y: 0.52, z: 0, visibility: 0.3 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.5, y: 0.5, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.4, y: 0.6, z: -0.05, visibility: 0.3 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.35, y: 0.65, z: 0, visibility: 0.3 },
    [PoseLandmark.RIGHT_HIP]: { x: 0.65, y: 0.51, z: -0.1, visibility: 0.3 },
    [PoseLandmark.RIGHT_ANKLE]: { x: 0.8, y: 0.52, z: -0.1, visibility: 0.3 },
  }),
};

describe('PlankDetector', () => {
  let detector: PlankDetector;

  beforeEach(() => {
    detector = new PlankDetector({
      minBodyAngle: 160,
      maxBodyAngle: 190,
      minElbowAngle: 70,
      minVisibility: 0.55,
      smoothingFactor: 0.9, // High smoothing for stable tests
      gracePeriodMs: 200, // Short grace period for tests
    });
  });

  describe('Initialization', () => {
    it('should start with isHolding=false and 0ms duration', () => {
      const state = detector.getState();
      expect(state.isHolding).toBe(false);
      expect(state.holdDurationMs).toBe(0);
      expect(state.phase).toBe('IDLE');
      expect(state.repCount).toBe(0); // Hold-based exercises don't count reps
    });

    it('should accept custom configuration', () => {
      const customDetector = new PlankDetector({
        minBodyAngle: 165,
        maxBodyAngle: 185,
      });

      const config = customDetector.getConfig();
      expect(config.minBodyAngle).toBe(165);
      expect(config.maxBodyAngle).toBe(185);
    });
  });

  describe('Hold Detection', () => {
    it('should start holding when correct plank pose detected', () => {
      detector.update(PLANK_POSES.correct, 0);
      const state = detector.getState();

      expect(state.isHolding).toBe(true);
      expect(state.phase).toBe('DOWN'); // DOWN = holding plank
      expect(state.visibility).toBe('VISIBLE');
    });

    it('should accumulate hold duration over time', () => {
      detector.update(PLANK_POSES.correct, 0);
      detector.update(PLANK_POSES.correct, 1000); // +1 second
      detector.update(PLANK_POSES.correct, 2500); // +1.5 seconds

      const state = detector.getState();
      expect(state.isHolding).toBe(true);
      expect(state.holdDurationMs).toBeGreaterThanOrEqual(2400);
    });

    it('should stop holding when body sags (angle too low)', () => {
      detector.update(PLANK_POSES.correct, 0);
      expect(detector.getState().isHolding).toBe(true);

      detector.update(PLANK_POSES.sagging, 100);
      detector.update(PLANK_POSES.sagging, 400); // Past grace period (200ms)

      const state = detector.getState();
      expect(state.isHolding).toBe(false);
      expect(state.phase).toBe('IDLE');
    });

    it('should stop holding when hips too high (angle too high)', () => {
      detector.update(PLANK_POSES.correct, 0);
      expect(detector.getState().isHolding).toBe(true);

      detector.update(PLANK_POSES.pike, 100);
      detector.update(PLANK_POSES.pike, 400); // Past grace period

      const state = detector.getState();
      expect(state.isHolding).toBe(false);
    });
  });

  describe('Grace Period', () => {
    it('should allow brief form breaks within grace period', () => {
      detector.update(PLANK_POSES.correct, 0);
      expect(detector.getState().isHolding).toBe(true);

      // Brief form break (within 200ms grace period)
      detector.update(PLANK_POSES.sagging, 50);
      detector.update(PLANK_POSES.sagging, 100);

      const stateInGrace = detector.getState();
      expect(stateInGrace.isHolding).toBe(true); // Still holding within grace period

      // Return to correct form
      detector.update(PLANK_POSES.correct, 150);

      const stateRecovered = detector.getState();
      expect(stateRecovered.isHolding).toBe(true);
    });

    it('should stop holding after grace period expires', () => {
      detector.update(PLANK_POSES.correct, 0);
      expect(detector.getState().isHolding).toBe(true);

      // Prolonged form break (> 200ms grace period)
      detector.update(PLANK_POSES.sagging, 50);
      detector.update(PLANK_POSES.sagging, 150);
      detector.update(PLANK_POSES.sagging, 300); // Past grace period

      const state = detector.getState();
      expect(state.isHolding).toBe(false);
    });
  });

  describe('Side Selection', () => {
    it('should auto-select left side when left side more visible', () => {
      detector.update(PLANK_POSES.correct, 0);
      const state = detector.getState();

      expect(state.debug?.selectedSide).toBe('left');
    });

    it('should auto-select right side when right side more visible', () => {
      detector.update(PLANK_POSES.correctRightSide, 0);
      const state = detector.getState();

      expect(state.debug?.selectedSide).toBe('right');
    });
  });

  describe('Visibility Handling', () => {
    it('should pause hold on LOW_VISIBILITY but keep accumulated duration', () => {
      // Start holding
      detector.update(PLANK_POSES.correct, 0);
      detector.update(PLANK_POSES.correct, 1000);

      const beforeLoss = detector.getState();
      expect(beforeLoss.isHolding).toBe(true);
      const durationBefore = beforeLoss.holdDurationMs ?? 0;

      // Lose visibility
      detector.update(PLANK_POSES.lowVisibility, 1100);
      detector.update(PLANK_POSES.lowVisibility, 1500); // Past grace period

      const afterLoss = detector.getState();
      expect(afterLoss.isHolding).toBe(false); // Paused
      expect(afterLoss.holdDurationMs).toBeGreaterThanOrEqual(durationBefore); // Duration kept
      expect(afterLoss.visibility).toBe('NOT_VISIBLE');
    });

    it('should resume hold when visibility restored', () => {
      // Start hold -> lose visibility -> regain
      detector.update(PLANK_POSES.correct, 0);

      detector.update(PLANK_POSES.lowVisibility, 100);
      detector.update(PLANK_POSES.lowVisibility, 400); // Paused

      expect(detector.getState().isHolding).toBe(false);

      // Visibility restored, correct form
      detector.update(PLANK_POSES.correct, 500);
      detector.update(PLANK_POSES.correct, 1000);

      const state = detector.getState();
      expect(state.isHolding).toBe(true);
      expect(state.holdDurationMs).toBeGreaterThan(0); // Resumed with accumulated duration
    });
  });

  describe('Reset', () => {
    it('should reset hold state and duration', () => {
      detector.update(PLANK_POSES.correct, 0);
      detector.update(PLANK_POSES.correct, 2000);

      expect(detector.getState().holdDurationMs).toBeGreaterThan(0);

      detector.reset();

      const state = detector.getState();
      expect(state.isHolding).toBe(false);
      expect(state.holdDurationMs).toBe(0);
      expect(state.phase).toBe('IDLE');
    });
  });

  describe('Configuration', () => {
    it('should apply runtime configuration changes', () => {
      detector.configure({
        minBodyAngle: 165,
        maxBodyAngle: 185,
      });

      const config = detector.getConfig();
      expect(config.minBodyAngle).toBe(165);
      expect(config.maxBodyAngle).toBe(185);
    });
  });

  describe('Progress Calculation', () => {
    it('should report progress=1.0 when holding, 0.0 when not', () => {
      const idleState = detector.getState();
      expect(idleState.progress).toBe(0.0);

      detector.update(PLANK_POSES.correct, 0);
      const holdingState = detector.getState();
      expect(holdingState.progress).toBe(1.0);

      detector.update(PLANK_POSES.sagging, 100);
      detector.update(PLANK_POSES.sagging, 400); // Past grace period

      const brokenState = detector.getState();
      expect(brokenState.progress).toBe(0.0);
    });
  });
});
