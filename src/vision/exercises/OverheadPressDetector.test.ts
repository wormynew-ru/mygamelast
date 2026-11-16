import { describe, it, expect, beforeEach } from 'vitest';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { PoseLandmark } from '../types';
import { OverheadPressDetector } from './OverheadPressDetector';

function createPressLandmarks(
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
  // Arms bent at shoulders (elbow ~90 deg, wrists above shoulders)
  rack: createPressLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.6, y: 0.4, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.75, y: 0.42, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.73, y: 0.28, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.4, y: 0.4, visibility: 0.95 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.25, y: 0.42, visibility: 0.95 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.27, y: 0.28, visibility: 0.95 },
  }),

  // Mid press (~125 deg, wrists higher)
  midPress: createPressLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.6, y: 0.4, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.7, y: 0.3, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.66, y: 0.17, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.4, y: 0.4, visibility: 0.95 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.3, y: 0.3, visibility: 0.95 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.34, y: 0.17, visibility: 0.95 },
  }),

  // Locked overhead (~175 deg, wrists well above shoulders)
  lockout: createPressLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.6, y: 0.4, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.61, y: 0.25, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.61, y: 0.1, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.4, y: 0.4, visibility: 0.95 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.39, y: 0.25, visibility: 0.95 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.39, y: 0.1, visibility: 0.95 },
  }),

  // Arms hanging straight down (180 deg elbows, but wrists BELOW shoulders)
  armsAtSides: createPressLandmarks({
    [PoseLandmark.LEFT_SHOULDER]: { x: 0.6, y: 0.4, visibility: 0.95 },
    [PoseLandmark.LEFT_ELBOW]: { x: 0.61, y: 0.55, visibility: 0.95 },
    [PoseLandmark.LEFT_WRIST]: { x: 0.62, y: 0.7, visibility: 0.95 },
    [PoseLandmark.RIGHT_SHOULDER]: { x: 0.4, y: 0.4, visibility: 0.95 },
    [PoseLandmark.RIGHT_ELBOW]: { x: 0.39, y: 0.55, visibility: 0.95 },
    [PoseLandmark.RIGHT_WRIST]: { x: 0.38, y: 0.7, visibility: 0.95 },
  }),
};

describe('OverheadPressDetector', () => {
  let detector: OverheadPressDetector;

  beforeEach(() => {
    detector = new OverheadPressDetector({ smoothingFactor: 0.9 });
  });

  it('counts a full rack -> lockout -> rack rep', () => {
    detector.update(POSES.rack, 0);
    expect(detector.getState().phase).toBe('IDLE');
    expect(detector.getState().repCount).toBe(0);

    detector.update(POSES.midPress, 100);
    expect(detector.getState().phase).toBe('UP');

    detector.update(POSES.lockout, 200);
    expect(detector.getState().phase).toBe('TRANSITION');
    expect(detector.getState().progress).toBe(1.0);

    detector.update(POSES.midPress, 300);
    expect(detector.getState().phase).toBe('DOWN');

    detector.update(POSES.rack, 400);
    expect(detector.getState().phase).toBe('IDLE');
    expect(detector.getState().repCount).toBe(1);
  });

  it('does not trigger lockout or reps when arms hang down at sides', () => {
    detector.update(POSES.rack, 0);
    detector.update(POSES.armsAtSides, 100);
    expect(detector.getState().phase).toBe('IDLE');
    expect(detector.getState().repCount).toBe(0);
  });

  it('handles low visibility and resets cleanly', () => {
    const lowVis = createPressLandmarks({
      [PoseLandmark.LEFT_WRIST]: { visibility: 0.1 },
    });
    const state = detector.update(lowVis, 0);
    expect(state.visibility).toBe('LOW_VISIBILITY');

    detector.update(POSES.rack, 100);
    detector.update(POSES.midPress, 200);
    detector.update(POSES.lockout, 300);
    detector.update(POSES.midPress, 400);
    detector.update(POSES.rack, 500);
    expect(detector.getState().repCount).toBe(1);

    detector.reset();
    expect(detector.getState().repCount).toBe(0);
    expect(detector.getState().phase).toBe('IDLE');
  });
});
