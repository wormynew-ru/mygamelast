/**
 * Tests for JumpingJackDetector - rep-based front-facing jumping jack detection.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JumpingJackDetector } from './JumpingJackDetector';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { PoseLandmark } from '../types';

function createBaseLandmarks(
  armState: 'down' | 'mid' | 'up',
  legState: 'closed' | 'wide',
  visibility = 0.95
): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility,
  }));

  // Shoulders & hips (hip width = 0.2)
  landmarks[PoseLandmark.LEFT_SHOULDER] = { x: 0.4, y: 0.3, z: 0, visibility };
  landmarks[PoseLandmark.RIGHT_SHOULDER] = { x: 0.6, y: 0.3, z: 0, visibility };
  landmarks[PoseLandmark.LEFT_HIP] = { x: 0.4, y: 0.55, z: 0, visibility };
  landmarks[PoseLandmark.RIGHT_HIP] = { x: 0.6, y: 0.55, z: 0, visibility };

  // Wrists based on arm position
  if (armState === 'down') {
    landmarks[PoseLandmark.LEFT_WRIST] = { x: 0.36, y: 0.55, z: 0, visibility };
    landmarks[PoseLandmark.RIGHT_WRIST] = { x: 0.64, y: 0.55, z: 0, visibility };
  } else if (armState === 'mid') {
    landmarks[PoseLandmark.LEFT_WRIST] = { x: 0.2, y: 0.3, z: 0, visibility };
    landmarks[PoseLandmark.RIGHT_WRIST] = { x: 0.8, y: 0.3, z: 0, visibility };
  } else {
    // Raised overhead (~160°)
    landmarks[PoseLandmark.LEFT_WRIST] = { x: 0.34, y: 0.08, z: 0, visibility };
    landmarks[PoseLandmark.RIGHT_WRIST] = { x: 0.66, y: 0.08, z: 0, visibility };
  }

  // Ankles based on leg spread (hip width = 0.2 -> closed ratio 1.0, wide ratio 2.5)
  if (legState === 'closed') {
    landmarks[PoseLandmark.LEFT_ANKLE] = { x: 0.4, y: 0.9, z: 0, visibility };
    landmarks[PoseLandmark.RIGHT_ANKLE] = { x: 0.6, y: 0.9, z: 0, visibility };
  } else {
    landmarks[PoseLandmark.LEFT_ANKLE] = { x: 0.25, y: 0.9, z: 0, visibility };
    landmarks[PoseLandmark.RIGHT_ANKLE] = { x: 0.75, y: 0.9, z: 0, visibility };
  }

  return landmarks;
}

function feedFrames(
  detector: JumpingJackDetector,
  pose: NormalizedLandmark[],
  count: number,
  startTs: number
): { state: ReturnType<JumpingJackDetector['getState']>; nextTs: number } {
  let state = detector.getState();
  let ts = startTs;
  for (let i = 0; i < count; i++) {
    state = detector.update(pose, ts);
    ts += 33;
  }
  return { state, nextTs: ts };
}

describe('JumpingJackDetector', () => {
  let detector: JumpingJackDetector;

  beforeEach(() => {
    detector = new JumpingJackDetector();
  });

  it('starts at 0 reps in IDLE phase', () => {
    const state = detector.getState();
    expect(state.repCount).toBe(0);
    expect(state.phase).toBe('IDLE');
  });

  it('counts a full jumping jack rep', () => {
    const restPose = createBaseLandmarks('down', 'closed');
    const midPose = createBaseLandmarks('mid', 'wide');
    const peakPose = createBaseLandmarks('up', 'wide');

    let ts = 0;
    ({ nextTs: ts } = feedFrames(detector, restPose, 3, ts));
    ({ nextTs: ts } = feedFrames(detector, midPose, 4, ts));
    ({ nextTs: ts } = feedFrames(detector, peakPose, 6, ts));
    ({ nextTs: ts } = feedFrames(detector, midPose, 4, ts));
    const { state } = feedFrames(detector, restPose, 8, ts);

    expect(state.repCount).toBe(1);
    expect(state.phase).toBe('IDLE');
  });

  it('counts multiple consecutive reps', () => {
    const restPose = createBaseLandmarks('down', 'closed');
    const midPose = createBaseLandmarks('mid', 'wide');
    const peakPose = createBaseLandmarks('up', 'wide');

    let ts = 0;
    for (let i = 0; i < 3; i++) {
      ({ nextTs: ts } = feedFrames(detector, restPose, 6, ts));
      ({ nextTs: ts } = feedFrames(detector, midPose, 3, ts));
      ({ nextTs: ts } = feedFrames(detector, peakPose, 6, ts));
      ({ nextTs: ts } = feedFrames(detector, midPose, 3, ts));
    }
    const { state } = feedFrames(detector, restPose, 8, ts);

    expect(state.repCount).toBe(3);
  });

  it('does not count incomplete rep when legs stay closed', () => {
    const restPose = createBaseLandmarks('down', 'closed');
    const armsOnlyPeak = createBaseLandmarks('up', 'closed');

    let ts = 0;
    ({ nextTs: ts } = feedFrames(detector, restPose, 4, ts));
    ({ nextTs: ts } = feedFrames(detector, armsOnlyPeak, 8, ts));
    const { state } = feedFrames(detector, restPose, 8, ts);

    expect(state.repCount).toBe(0);
  });

  it('reports LOW_VISIBILITY when landmarks are occluded', () => {
    const hiddenPose = createBaseLandmarks('down', 'closed', 0.2);
    const state = detector.update(hiddenPose, 0);
    expect(state.visibility).toBe('LOW_VISIBILITY');
  });

  it('resets state and supports runtime configuration', () => {
    const restPose = createBaseLandmarks('down', 'closed');
    const peakPose = createBaseLandmarks('up', 'wide');

    let ts = 0;
    ({ nextTs: ts } = feedFrames(detector, restPose, 4, ts));
    ({ nextTs: ts } = feedFrames(detector, peakPose, 6, ts));
    feedFrames(detector, restPose, 8, ts);

    expect(detector.getState().repCount).toBe(1);

    detector.reset();
    expect(detector.getState().repCount).toBe(0);

    detector.configure({ peakArmAngle: 145 });
    expect(detector.getConfig().peakArmAngle).toBe(145);
  });
});
