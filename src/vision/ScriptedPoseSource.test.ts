/**
 * Integration tests verifying ScriptedPoseSource drives every ExerciseDetector reliably.
 */

import { describe, it, expect } from 'vitest';
import { createScriptedPoseGenerator } from './ScriptedPoseSource';
import {
  SquatDetector,
  PushUpDetector,
  PlankDetector,
  JumpingJackDetector,
  ArmHoldDetector,
  WallSitDetector,
  OverheadPressDetector,
  LungeDetector,
  HighKneesDetector,
  FrontRaiseDetector,
} from './exercises';

describe('ScriptedPoseSource', () => {
  it('drives all 7 rep-based detectors to count reps cleanly over 4 simulated seconds', () => {
    const cases = [
      { id: 'SQUAT', detector: new SquatDetector({ minBottomHoldTime: 50 }), minReps: 2 },
      { id: 'PUSH_UP', detector: new PushUpDetector(), minReps: 2 },
      { id: 'JUMPING_JACK', detector: new JumpingJackDetector(), minReps: 2 },
      { id: 'OVERHEAD_PRESS', detector: new OverheadPressDetector(), minReps: 2 },
      { id: 'LUNGE', detector: new LungeDetector({ minBottomHoldTime: 50 }), minReps: 2 },
      { id: 'HIGH_KNEES', detector: new HighKneesDetector(), minReps: 3 },
      { id: 'FRONT_RAISE', detector: new FrontRaiseDetector(), minReps: 2 },
    ];

    for (const { id, detector, minReps } of cases) {
      const gen = createScriptedPoseGenerator(id);
      let state = detector.getState();
      for (let t = 0; t <= 4200; t += 40) {
        const frame = gen(t);
        state = detector.update(frame.landmarks, t, frame.worldLandmarks);
      }
      expect(state.visibility, `${id} visibility`).toBe('VISIBLE');
      expect(state.repCount, `${id} repCount`).toBeGreaterThanOrEqual(minReps);
    }
  });

  it('drives all 3 hold-based detectors to sustain valid holds over 3 simulated seconds', () => {
    const holdCases = [
      { id: 'PLANK', detector: new PlankDetector() },
      { id: 'ARM_HOLD', detector: new ArmHoldDetector() },
      { id: 'WALL_SIT', detector: new WallSitDetector() },
    ];

    for (const { id, detector } of holdCases) {
      const gen = createScriptedPoseGenerator(id);
      let state = detector.getState();
      for (let t = 0; t <= 3000; t += 50) {
        const frame = gen(t);
        state = detector.update(frame.landmarks, t, frame.worldLandmarks);
      }
      expect(state.visibility, `${id} visibility`).toBe('VISIBLE');
      expect(state.isHolding, `${id} isHolding`).toBe(true);
      expect(state.holdDurationMs ?? 0, `${id} holdDurationMs`).toBeGreaterThanOrEqual(2500);
    }
  });
});
