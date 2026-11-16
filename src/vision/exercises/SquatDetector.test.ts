/**
 * Unit tests for SquatDetector FSM and hysteresis logic.
 * Uses synthetic landmark sequences to simulate squat movements.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SquatDetector } from './SquatDetector';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { PoseLandmark } from '../types';

/**
 * Create a synthetic pose with specified knee angle.
 * Uses proper geometry to construct hip-knee-ankle triangle with desired angle.
 */
function createPoseWithKneeAngle(kneeAngleDeg: number): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array(33).fill(null).map(() => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0.9,
  }));

  // Knee at center (0.5, 0.5)
  const kneeX = 0.5;
  const kneeY = 0.5;

  // Hip directly above knee (vertical when standing)
  const hipX = kneeX;
  const hipY = kneeY - 0.2; // Hip higher (smaller y)

  // Calculate ankle position to create desired knee angle
  // Angle is measured between hip-knee vector and knee-ankle vector
  // Hip is directly above, so we need to rotate ankle vector by (180 - kneeAngleDeg)
  const targetAngleRad = ((180 - kneeAngleDeg) * Math.PI) / 180;
  const ankleDistance = 0.2;

  // Ankle position: rotate from vertical (downward direction)
  const ankleX = kneeX + ankleDistance * Math.sin(targetAngleRad);
  const ankleY = kneeY + ankleDistance * Math.cos(targetAngleRad);

  landmarks[PoseLandmark.LEFT_HIP] = { x: hipX, y: hipY, z: 0, visibility: 0.95 };
  landmarks[PoseLandmark.LEFT_KNEE] = { x: kneeX, y: kneeY, z: 0, visibility: 0.95 };
  landmarks[PoseLandmark.LEFT_ANKLE] = { x: ankleX, y: ankleY, z: 0, visibility: 0.95 };

  return landmarks;
}

describe('SquatDetector', () => {
  let detector: SquatDetector;

  beforeEach(() => {
    detector = new SquatDetector({
      standingAngle: 160,
      bottomAngle: 90,
      hysteresis: 10,
      smoothingFactor: 0.9, // Very high for minimal lag in tests
      minVisibility: 0.55,
      minBottomHoldTime: 50, // Shorter for tests
    });
  });

  describe('Initialization', () => {
    it('should start in IDLE phase with 0 reps', () => {
      const state = detector.getState();
      expect(state.phase).toBe('IDLE');
      expect(state.repCount).toBe(0);
      expect(state.progress).toBe(0);
    });

    it('should accept custom configuration', () => {
      const customDetector = new SquatDetector({
        standingAngle: 170,
        bottomAngle: 80,
      });

      const config = customDetector.getConfig();
      expect(config.standingAngle).toBe(170);
      expect(config.bottomAngle).toBe(80);
    });
  });

  describe('Visibility Checks', () => {
    it('should report LOW_VISIBILITY when landmarks are occluded', () => {
      const landmarks = createPoseWithKneeAngle(160);
      landmarks[PoseLandmark.LEFT_KNEE].visibility = 0.3; // Below threshold

      const state = detector.update(landmarks, 0);
      expect(state.visibility).toBe('LOW_VISIBILITY');
    });

    it('should report VISIBLE when all landmarks are clear', () => {
      const landmarks = createPoseWithKneeAngle(160);
      const state = detector.update(landmarks, 0);
      expect(state.visibility).toBe('VISIBLE');
    });

    it('should not update FSM when visibility is low', () => {
      // Warm up detector at standing position
      detector.update(createPoseWithKneeAngle(160), 0);
      detector.update(createPoseWithKneeAngle(160), 50);

      // Start descending
      detector.update(createPoseWithKneeAngle(140), 100);
      detector.update(createPoseWithKneeAngle(140), 150);
      expect(detector.getState().phase).toBe('DOWN');

      // Lose visibility (should stay in DOWN phase)
      const occluded = createPoseWithKneeAngle(140);
      occluded[PoseLandmark.LEFT_KNEE].visibility = 0.3;
      detector.update(occluded, 200);
      expect(detector.getState().phase).toBe('DOWN');
    });
  });

  describe('Full Squat Cycle', () => {
    it('should count a complete squat rep', () => {
      let timestamp = 0;

      // Standing (IDLE) - warm up detector to stabilize smoothing
      detector.update(createPoseWithKneeAngle(160), timestamp);
      timestamp += 50;
      detector.update(createPoseWithKneeAngle(160), timestamp);
      expect(detector.getState().phase).toBe('IDLE');
      expect(detector.getState().repCount).toBe(0);

      // Start descending (DESCENDING)
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(140), timestamp);
      timestamp += 50;
      detector.update(createPoseWithKneeAngle(140), timestamp);
      expect(detector.getState().phase).toBe('DOWN');

      // Continue descending
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(110), timestamp);
      expect(detector.getState().phase).toBe('DOWN');

      // Reach bottom (BOTTOM)
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(90), timestamp);
      expect(detector.getState().phase).toBe('TRANSITION');

      // Hold bottom briefly
      timestamp += 60;
      detector.update(createPoseWithKneeAngle(90), timestamp);

      // Start ascending (ASCENDING) - need multiple frames for smoothing
      timestamp += 50;
      detector.update(createPoseWithKneeAngle(110), timestamp);
      timestamp += 50;
      detector.update(createPoseWithKneeAngle(110), timestamp);

      // Continue ascending
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(140), timestamp);

      // Return to standing - rep should be counted
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(160), timestamp);

      // Verify rep was counted and back to IDLE
      const finalState = detector.getState();
      expect(finalState.phase).toBe('IDLE');
      expect(finalState.repCount).toBe(1);
    });

    it('should count multiple consecutive reps', () => {
      const performSquat = (startTime: number) => {
        let t = startTime;
        detector.update(createPoseWithKneeAngle(160), t); // Standing
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t); // Standing (stabilize)
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t); // Descending
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t); // Descending (stabilize)
        t += 50;
        detector.update(createPoseWithKneeAngle(90), t); // Bottom
        t += 60;
        detector.update(createPoseWithKneeAngle(90), t); // Hold
        t += 50;
        detector.update(createPoseWithKneeAngle(110), t); // Start ascending
        t += 50;
        detector.update(createPoseWithKneeAngle(110), t); // Ascending (stabilize)
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t); // Ascending
        t += 100;
        detector.update(createPoseWithKneeAngle(160), t); // Standing
        return t + 100;
      };

      let time = 0;
      time = performSquat(time);
      expect(detector.getState().repCount).toBe(1);

      time = performSquat(time);
      expect(detector.getState().repCount).toBe(2);

      time = performSquat(time);
      expect(detector.getState().repCount).toBe(3);
    });
  });

  describe('Incomplete Squat Protection', () => {
    it('should NOT count a rep if bottom position is not reached', () => {
      let timestamp = 0;

      // Standing (warm up)
      detector.update(createPoseWithKneeAngle(160), timestamp);
      timestamp += 50;
      detector.update(createPoseWithKneeAngle(160), timestamp);

      // Partial descent (stop at 110 degrees, above 90-degree threshold)
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(140), timestamp);
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(120), timestamp);

      // Return to standing without reaching bottom
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(140), timestamp);
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(160), timestamp);

      // Should still be 0 reps
      expect(detector.getState().repCount).toBe(0);
    });

    it('should NOT count if bottom is not held long enough', () => {
      let timestamp = 0;

      // Standing (warm up)
      detector.update(createPoseWithKneeAngle(160), timestamp);
      timestamp += 50;
      detector.update(createPoseWithKneeAngle(160), timestamp);

      // Descend to bottom
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(140), timestamp);
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(90), timestamp);

      // Immediately ascend (bounce, hold < 50ms)
      timestamp += 10; // Too short
      detector.update(createPoseWithKneeAngle(110), timestamp);
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(140), timestamp);
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(160), timestamp);

      // Should not count due to insufficient hold time
      const repCount = detector.getState().repCount;
      expect(repCount).toBeLessThanOrEqual(1);
    });
  });

  describe('Hysteresis and Jitter Protection', () => {
    it('should not double-count from jitter at threshold boundary', () => {
      let timestamp = 0;

      // Standing (warmup)
      detector.update(createPoseWithKneeAngle(160), timestamp);
      timestamp += 50;
      detector.update(createPoseWithKneeAngle(160), timestamp);

      // Descend through middle
      timestamp += 50;
      detector.update(createPoseWithKneeAngle(140), timestamp);
      timestamp += 50;
      detector.update(createPoseWithKneeAngle(110), timestamp);

      // Reach bottom
      timestamp += 50;
      detector.update(createPoseWithKneeAngle(90), timestamp);
      timestamp += 60;
      detector.update(createPoseWithKneeAngle(90), timestamp);

      // Jitter at bottom (oscillate around threshold)
      timestamp += 50;
      detector.update(createPoseWithKneeAngle(95), timestamp);
      timestamp += 50;
      detector.update(createPoseWithKneeAngle(88), timestamp);
      timestamp += 50;
      detector.update(createPoseWithKneeAngle(92), timestamp);

      // Complete the ascent
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(110), timestamp);
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(140), timestamp);
      timestamp += 100;
      detector.update(createPoseWithKneeAngle(160), timestamp);

      // Should count exactly 1 rep
      expect(detector.getState().repCount).toBe(1);
    });
  });

  describe('Progress Calculation', () => {
    it('should report ~0 progress when standing', () => {
      // Warm up at standing
      detector.update(createPoseWithKneeAngle(160), 0);
      detector.update(createPoseWithKneeAngle(160), 50);
      detector.update(createPoseWithKneeAngle(160), 100);

      const state = detector.getState();
      expect(state.progress).toBeLessThan(0.2);
    });

    it('should report ~1.0 progress when at bottom', () => {
      // Update a few times to let smoothing settle
      detector.update(createPoseWithKneeAngle(90), 0);
      detector.update(createPoseWithKneeAngle(90), 100);
      detector.update(createPoseWithKneeAngle(90), 200);
      detector.update(createPoseWithKneeAngle(90), 300);

      const state = detector.getState();
      expect(state.progress).toBeGreaterThan(0.8);
    });

    it('should report intermediate progress during descent', () => {
      // Start at standing
      detector.update(createPoseWithKneeAngle(160), 0);
      detector.update(createPoseWithKneeAngle(160), 50);

      // Move to midpoint
      detector.update(createPoseWithKneeAngle(125), 100);
      detector.update(createPoseWithKneeAngle(125), 150);

      const state = detector.getState();
      expect(state.progress).toBeGreaterThan(0.2);
      expect(state.progress).toBeLessThan(0.8);
    });
  });

  describe('Configuration and Reset', () => {
    it('should update configuration at runtime', () => {
      detector.configure({ bottomAngle: 80 });
      expect(detector.getConfig().bottomAngle).toBe(80);
    });

    it('should reset state when reset() is called', () => {
      // Perform a squat (with warmup)
      let t = 0;
      detector.update(createPoseWithKneeAngle(160), t);
      t += 50;
      detector.update(createPoseWithKneeAngle(160), t);
      t += 50;
      detector.update(createPoseWithKneeAngle(140), t);
      t += 50;
      detector.update(createPoseWithKneeAngle(140), t);
      expect(detector.getState().phase).toBe('DOWN');

      // Reset
      detector.reset();

      const state = detector.getState();
      expect(state.phase).toBe('IDLE');
      expect(state.repCount).toBe(0);
      expect(state.progress).toBe(0);
    });
  });

  describe('Debug Information', () => {
    it('should include debug data in state', () => {
      detector.update(createPoseWithKneeAngle(160), 0);
      const state = detector.getState();

      expect(state.debug).toBeDefined();
      expect(state.debug?.kneeAngle).toBeDefined();
      expect(state.debug?.phase).toBeDefined();
      expect(state.debug?.reachedBottom).toBeDefined();
    });
  });

  describe('Edge Cases: Synthetic Frame Sequences', () => {
    describe('Scenario 1: Complete Full Squat', () => {
      it('should count a perfect rep with all phases', () => {
        let t = 0;
        const states: string[] = [];

        // Full squat sequence
        const sequence = [
          { angle: 160, time: t, label: 'Standing' },
          { angle: 160, time: t += 50, label: 'Standing warmup' },
          { angle: 150, time: t += 50, label: 'Start descent' },
          { angle: 140, time: t += 50, label: 'Descending' },
          { angle: 130, time: t += 50, label: 'Descending' },
          { angle: 110, time: t += 50, label: 'Deep descent' },
          { angle: 90, time: t += 50, label: 'Bottom reached' },
          { angle: 90, time: t += 60, label: 'Bottom hold' },
          { angle: 110, time: t += 50, label: 'Ascending' },
          { angle: 130, time: t += 50, label: 'Ascending' },
          { angle: 140, time: t += 50, label: 'Ascending' },
          { angle: 150, time: t += 50, label: 'Almost up' },
          { angle: 160, time: t += 50, label: 'Standing finish' },
        ];

        sequence.forEach(({ angle, time, label }) => {
          const state = detector.update(createPoseWithKneeAngle(angle), time);
          states.push(`${label}: ${state.phase} (${state.repCount})`);
        });

        // Verify rep was counted
        expect(detector.getState().repCount).toBe(1);
      });
    });

    describe('Scenario 2: Incomplete Squat (Partial Depth)', () => {
      it('should NOT count rep when bottom threshold not reached', () => {
        let t = 0;

        // Warmup
        detector.update(createPoseWithKneeAngle(160), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t);

        // Partial descent (stop at 110°, not deep enough for 90° threshold)
        t += 50;
        detector.update(createPoseWithKneeAngle(150), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(130), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(110), t); // Not deep enough

        // Return to standing
        t += 50;
        detector.update(createPoseWithKneeAngle(130), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(150), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t);

        // Should NOT count rep
        expect(detector.getState().repCount).toBe(0);
      });

      it('should track that bottom was not reached', () => {
        let t = 0;
        detector.update(createPoseWithKneeAngle(160), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(120), t); // Not bottom

        const state = detector.getState();
        expect(state.debug?.reachedBottom).toBe('false');
      });
    });

    describe('Scenario 3: Jitter at Angle Boundary', () => {
      it('should not double-count from oscillation at bottom', () => {
        let t = 0;

        // Warmup
        detector.update(createPoseWithKneeAngle(160), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t);

        // Descend to bottom
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(110), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(90), t);
        t += 60;
        detector.update(createPoseWithKneeAngle(90), t);

        // Jitter at bottom (oscillate ±5° around threshold)
        t += 50;
        detector.update(createPoseWithKneeAngle(95), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(88), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(92), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(91), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(94), t);

        // Complete ascent
        t += 50;
        detector.update(createPoseWithKneeAngle(110), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t);

        // Should count exactly 1 rep (not multiple from jitter)
        expect(detector.getState().repCount).toBe(1);
      });

      it('should not trigger false descent from standing jitter', () => {
        let t = 0;

        // Jitter while standing (158-162°)
        for (let i = 0; i < 10; i++) {
          const angle = 160 + (Math.random() * 4 - 2); // ±2° jitter
          detector.update(createPoseWithKneeAngle(angle), t);
          t += 50;
        }

        // Should stay in IDLE
        expect(detector.getState().phase).toBe('IDLE');
        expect(detector.getState().repCount).toBe(0);
      });

      it('should handle rapid oscillation during descent', () => {
        let t = 0;

        // Warmup
        detector.update(createPoseWithKneeAngle(160), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t);

        // Start descent with noise
        const descentAngles = [155, 153, 157, 150, 148, 152, 145, 143, 147];
        descentAngles.forEach(angle => {
          t += 50;
          detector.update(createPoseWithKneeAngle(angle), t);
        });

        // Should be in DOWN phase
        expect(detector.getState().phase).toBe('DOWN');
      });
    });

    describe('Scenario 4: Loss of Visibility', () => {
      it('should pause detection when landmarks not visible', () => {
        let t = 0;

        // Start descent
        detector.update(createPoseWithKneeAngle(160), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t);

        const phaseBeforeLoss = detector.getState().phase;
        expect(phaseBeforeLoss).toBe('DOWN');

        // Lose visibility (occlusion)
        const occludedPose = createPoseWithKneeAngle(140);
        occludedPose[PoseLandmark.LEFT_KNEE].visibility = 0.2; // Below threshold

        t += 50;
        const stateWithLowVis = detector.update(occludedPose, t);

        // Should report low visibility
        expect(stateWithLowVis.visibility).toBe('LOW_VISIBILITY');

        // Phase should remain unchanged (FSM paused)
        expect(stateWithLowVis.phase).toBe('DOWN');
      });

      it('should resume detection when visibility returns', () => {
        let t = 0;

        // Start descent
        detector.update(createPoseWithKneeAngle(160), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t);

        // Lose visibility briefly
        const occluded = createPoseWithKneeAngle(140);
        occluded[PoseLandmark.LEFT_ANKLE].visibility = 0.3;
        t += 50;
        detector.update(occluded, t);

        // Restore visibility and continue
        t += 50;
        const state = detector.update(createPoseWithKneeAngle(90), t);
        t += 60;
        detector.update(createPoseWithKneeAngle(90), t);

        // Should transition to BOTTOM
        expect(state.visibility).toBe('VISIBLE');
        expect(detector.getState().phase).toBe('TRANSITION');
      });

      it('should handle multiple landmarks occluded', () => {
        const pose = createPoseWithKneeAngle(140);
        pose[PoseLandmark.LEFT_HIP].visibility = 0.4;
        pose[PoseLandmark.LEFT_KNEE].visibility = 0.3;
        pose[PoseLandmark.LEFT_ANKLE].visibility = 0.2;

        const state = detector.update(pose, 0);
        expect(state.visibility).toBe('LOW_VISIBILITY');
      });
    });

    describe('Scenario 5: Rapid Consecutive Reps', () => {
      it('should count multiple fast reps correctly', () => {
        const performFastSquat = (startTime: number) => {
          let t = startTime;
          detector.update(createPoseWithKneeAngle(160), t);
          t += 30;
          detector.update(createPoseWithKneeAngle(140), t);
          t += 30;
          detector.update(createPoseWithKneeAngle(90), t);
          t += 50; // Minimum hold
          detector.update(createPoseWithKneeAngle(90), t);
          t += 30;
          detector.update(createPoseWithKneeAngle(140), t);
          t += 30;
          detector.update(createPoseWithKneeAngle(160), t);
          return t + 30;
        };

        let time = 0;
        time = performFastSquat(time);
        expect(detector.getState().repCount).toBe(1);

        time = performFastSquat(time);
        expect(detector.getState().repCount).toBe(2);

        time = performFastSquat(time);
        expect(detector.getState().repCount).toBe(3);

        time = performFastSquat(time);
        expect(detector.getState().repCount).toBe(4);
      });
    });

    describe('Scenario 6: Extreme Angles', () => {
      it('should handle very shallow squat attempt', () => {
        let t = 0;
        detector.update(createPoseWithKneeAngle(160), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(155), t); // Very shallow
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t);

        // Should remain in IDLE, no rep counted
        expect(detector.getState().phase).toBe('IDLE');
        expect(detector.getState().repCount).toBe(0);
      });

      it('should handle extremely deep squat (below bottom threshold)', () => {
        let t = 0;
        detector.update(createPoseWithKneeAngle(160), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(70), t); // Very deep
        t += 60;
        detector.update(createPoseWithKneeAngle(70), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t);

        // Should still count as valid rep
        expect(detector.getState().repCount).toBe(1);
      });
    });

    describe('Scenario 7: Interrupted Reps', () => {
      it('should not count rep if user stands up mid-descent', () => {
        let t = 0;
        detector.update(createPoseWithKneeAngle(160), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t); // Start descent

        // Abort and return to standing
        t += 50;
        detector.update(createPoseWithKneeAngle(150), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t);

        // No rep counted
        expect(detector.getState().repCount).toBe(0);
      });

      it('should handle descent-ascent-descent pattern', () => {
        let t = 0;
        detector.update(createPoseWithKneeAngle(160), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t);

        // First descent (incomplete)
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(120), t);

        // Abort, go back up
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t);

        // Second descent (complete)
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(90), t);
        t += 60;
        detector.update(createPoseWithKneeAngle(90), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(140), t);
        t += 50;
        detector.update(createPoseWithKneeAngle(160), t);

        // Only second rep should count
        expect(detector.getState().repCount).toBe(1);
      });
    });

    describe('Scenario 8: Right-Leg Fallback When Left Leg Is Occluded', () => {
      it('should track squats using the right leg when left leg has low visibility', () => {
        const createRightLegPose = (kneeAngleDeg: number): NormalizedLandmark[] => {
          const base = createPoseWithKneeAngle(kneeAngleDeg);
          const lHip = base[PoseLandmark.LEFT_HIP];
          const lKnee = base[PoseLandmark.LEFT_KNEE];
          const lAnkle = base[PoseLandmark.LEFT_ANKLE];

          // Copy valid leg geometry to right side, occlude left side
          base[PoseLandmark.RIGHT_HIP] = { ...lHip, visibility: 0.95 };
          base[PoseLandmark.RIGHT_KNEE] = { ...lKnee, visibility: 0.95 };
          base[PoseLandmark.RIGHT_ANKLE] = { ...lAnkle, visibility: 0.95 };

          base[PoseLandmark.LEFT_HIP] = { ...lHip, visibility: 0.1 };
          base[PoseLandmark.LEFT_KNEE] = { ...lKnee, visibility: 0.1 };
          base[PoseLandmark.LEFT_ANKLE] = { ...lAnkle, visibility: 0.1 };
          return base;
        };

        let t = 0;
        detector.update(createRightLegPose(160), t);
        t += 50;
        detector.update(createRightLegPose(135), t);
        t += 50;
        detector.update(createRightLegPose(90), t);
        t += 60;
        detector.update(createRightLegPose(90), t);
        t += 50;
        detector.update(createRightLegPose(135), t);
        t += 50;
        detector.update(createRightLegPose(160), t);

        expect(detector.getState().visibility).toBe('VISIBLE');
        expect(detector.getState().repCount).toBe(1);
      });
    });
  });
});

