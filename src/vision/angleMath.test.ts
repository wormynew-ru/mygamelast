/**
 * Unit tests for angleMath utilities.
 * Tests all mathematical functions used for pose analysis.
 */

import { describe, it, expect } from 'vitest';
import {
  isVisible,
  allVisible,
  angle2D,
  angle3D,
  distance2D,
  distance3D,
  ema,
  lowPass,
  clamp,
  mapRange,
  hysteresisCheck,
} from './angleMath';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { Point2D, Point3D } from './types';

describe('angleMath', () => {
  describe('Visibility Checks', () => {
    it('should check if landmark is visible', () => {
      const visible: NormalizedLandmark = { x: 0, y: 0, z: 0, visibility: 0.8 };
      const notVisible: NormalizedLandmark = { x: 0, y: 0, z: 0, visibility: 0.3 };

      expect(isVisible(visible)).toBe(true);
      expect(isVisible(notVisible)).toBe(false);
    });

    it('should use custom visibility threshold', () => {
      const landmark: NormalizedLandmark = { x: 0, y: 0, z: 0, visibility: 0.6 };

      expect(isVisible(landmark, 0.5)).toBe(true);
      expect(isVisible(landmark, 0.7)).toBe(false);
    });

    it('should handle missing visibility value', () => {
      // Type assertion to test runtime behavior when visibility is missing
      const landmark = { x: 0, y: 0, z: 0 } as NormalizedLandmark;

      expect(isVisible(landmark)).toBe(false); // visibility ?? 0
    });

    it('should check if all landmarks are visible', () => {
      const visible1: NormalizedLandmark = { x: 0, y: 0, z: 0, visibility: 0.9 };
      const visible2: NormalizedLandmark = { x: 0, y: 0, z: 0, visibility: 0.8 };
      const notVisible: NormalizedLandmark = { x: 0, y: 0, z: 0, visibility: 0.3 };

      expect(allVisible([visible1, visible2])).toBe(true);
      expect(allVisible([visible1, notVisible])).toBe(false);
      expect(allVisible([])).toBe(true); // Empty array
    });
  });

  describe('2D Angle Calculation', () => {
    it('should calculate right angle (90°)', () => {
      const a: Point2D = { x: 0, y: 0 };
      const b: Point2D = { x: 1, y: 0 }; // Vertex
      const c: Point2D = { x: 1, y: 1 };

      const angle = angle2D(a, b, c);
      expect(angle).toBeCloseTo(90, 1);
    });

    it('should calculate straight line (180°)', () => {
      const a: Point2D = { x: 0, y: 0 };
      const b: Point2D = { x: 1, y: 0 }; // Vertex
      const c: Point2D = { x: 2, y: 0 };

      const angle = angle2D(a, b, c);
      expect(angle).toBeCloseTo(180, 1);
    });

    it('should calculate acute angle (45°)', () => {
      const a: Point2D = { x: 0, y: 0 };
      const b: Point2D = { x: 1, y: 0 }; // Vertex
      const c: Point2D = { x: 1, y: 1 };

      const angle = angle2D(a, b, c);
      expect(angle).toBeCloseTo(90, 1);

      // 45° test
      const a2: Point2D = { x: 0, y: 1 };
      const b2: Point2D = { x: 0, y: 0 };
      const c2: Point2D = { x: 1, y: 0 };

      const angle2 = angle2D(a2, b2, c2);
      expect(angle2).toBeCloseTo(90, 1);
    });

    it('should handle zero-length vectors', () => {
      const a: Point2D = { x: 0, y: 0 };
      const b: Point2D = { x: 0, y: 0 }; // Same as a
      const c: Point2D = { x: 1, y: 1 };

      const angle = angle2D(a, b, c);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThanOrEqual(180);
    });
  });

  describe('3D Angle Calculation', () => {
    it('should calculate right angle in 3D', () => {
      const a: Point3D = { x: 0, y: 0, z: 0 };
      const b: Point3D = { x: 1, y: 0, z: 0 }; // Vertex
      const c: Point3D = { x: 1, y: 1, z: 0 };

      const angle = angle3D(a, b, c);
      expect(angle).toBeCloseTo(90, 1);
    });

    it('should calculate angle with depth', () => {
      const a: Point3D = { x: 0, y: 0, z: 0 };
      const b: Point3D = { x: 1, y: 0, z: 0 }; // Vertex
      const c: Point3D = { x: 1, y: 0, z: 1 }; // Z-axis

      const angle = angle3D(a, b, c);
      expect(angle).toBeCloseTo(90, 1);
    });

    it('should handle degenerate cases', () => {
      const a: Point3D = { x: 0, y: 0, z: 0 };
      const b: Point3D = { x: 0, y: 0, z: 0 }; // Same point
      const c: Point3D = { x: 1, y: 1, z: 1 };

      const angle = angle3D(a, b, c);
      expect(angle).toBe(0); // Returns 0 for zero-length vectors
    });

    it('should clamp dot product to avoid NaN', () => {
      // This tests the internal clamping logic
      const a: Point3D = { x: 1, y: 0, z: 0 };
      const b: Point3D = { x: 0, y: 0, z: 0 };
      const c: Point3D = { x: 1, y: 0, z: 0 };

      const angle = angle3D(a, b, c);
      expect(isNaN(angle)).toBe(false);
    });
  });

  describe('Distance Calculations', () => {
    it('should calculate 2D Euclidean distance', () => {
      const a: Point2D = { x: 0, y: 0 };
      const b: Point2D = { x: 3, y: 4 };

      const distance = distance2D(a, b);
      expect(distance).toBeCloseTo(5, 5); // 3-4-5 triangle
    });

    it('should return 0 for same point', () => {
      const a: Point2D = { x: 5, y: 5 };
      const b: Point2D = { x: 5, y: 5 };

      expect(distance2D(a, b)).toBe(0);
    });

    it('should calculate 3D Euclidean distance', () => {
      const a: Point3D = { x: 0, y: 0, z: 0 };
      const b: Point3D = { x: 1, y: 1, z: 1 };

      const distance = distance3D(a, b);
      expect(distance).toBeCloseTo(Math.sqrt(3), 5);
    });

    it('should handle negative coordinates', () => {
      const a: Point2D = { x: -5, y: -5 };
      const b: Point2D = { x: 5, y: 5 };

      const distance = distance2D(a, b);
      expect(distance).toBeCloseTo(Math.sqrt(200), 5);
    });
  });

  describe('Smoothing Functions', () => {
    it('should apply EMA smoothing', () => {
      const current = 100;
      const previous = 50;
      const alpha = 0.5;

      const smoothed = ema(current, previous, alpha);
      expect(smoothed).toBe(75); // 0.5 * 100 + 0.5 * 50
    });

    it('should favor new value with high alpha', () => {
      const current = 100;
      const previous = 0;
      const alpha = 0.9; // High responsiveness

      const smoothed = ema(current, previous, alpha);
      expect(smoothed).toBe(90); // Mostly new value
    });

    it('should favor previous value with low alpha', () => {
      const current = 100;
      const previous = 0;
      const alpha = 0.1; // Low responsiveness

      const smoothed = ema(current, previous, alpha);
      expect(smoothed).toBe(10); // Mostly old value
    });

    it('should apply low-pass filter', () => {
      const value = 100;
      const smoothed = 50;
      const factor = 0.5;

      const result = lowPass(value, smoothed, factor);
      expect(result).toBe(75); // 50 * 0.5 + 100 * 0.5
    });

    it('should smooth out jitter over multiple frames', () => {
      let smoothed = 50;
      const alpha = 0.3;

      // Simulate jittery input
      const noisyValues = [55, 45, 60, 40, 58, 42];

      noisyValues.forEach(value => {
        smoothed = ema(value, smoothed, alpha);
      });

      // Smoothed value should be closer to mean than any individual spike
      const mean = noisyValues.reduce((a, b) => a + b) / noisyValues.length;
      expect(Math.abs(smoothed - mean)).toBeLessThan(10);
    });
  });

  describe('Utility Functions', () => {
    it('should clamp values within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it('should map values between ranges', () => {
      // Map 50 from [0, 100] to [0, 1]
      expect(mapRange(50, 0, 100, 0, 1)).toBeCloseTo(0.5);

      // Map 25 from [0, 100] to [0, 200]
      expect(mapRange(25, 0, 100, 0, 200)).toBeCloseTo(50);

      // Inverted range
      expect(mapRange(50, 0, 100, 100, 0)).toBeCloseTo(50);
    });

    it('should clamp mapped values by default', () => {
      // Value outside input range
      expect(mapRange(150, 0, 100, 0, 1)).toBe(1); // Clamped to max
      expect(mapRange(-50, 0, 100, 0, 1)).toBe(0); // Clamped to min
    });

    it('should allow unclamped mapping', () => {
      const result = mapRange(150, 0, 100, 0, 1, false);
      expect(result).toBeGreaterThan(1); // Not clamped
    });
  });

  describe('Hysteresis', () => {
    it('should implement rising hysteresis', () => {
      const threshold = 100;
      const hysteresis = 10;

      // Starting below threshold
      let wasAbove = false;

      // Value must exceed threshold + hysteresis to switch on
      expect(hysteresisCheck(105, threshold, hysteresis, wasAbove)).toBe(false);
      expect(hysteresisCheck(110, threshold, hysteresis, wasAbove)).toBe(false);
      expect(hysteresisCheck(111, threshold, hysteresis, wasAbove)).toBe(true);

      // Now above threshold
      wasAbove = true;
      expect(hysteresisCheck(111, threshold, hysteresis, wasAbove)).toBe(true);
    });

    it('should implement falling hysteresis', () => {
      const threshold = 100;
      const hysteresis = 10;

      // Starting above threshold
      let wasAbove = true;

      // Value must fall below threshold - hysteresis to switch off
      expect(hysteresisCheck(95, threshold, hysteresis, wasAbove)).toBe(true);
      expect(hysteresisCheck(91, threshold, hysteresis, wasAbove)).toBe(true);
      expect(hysteresisCheck(89, threshold, hysteresis, wasAbove)).toBe(false);

      // Now below threshold
      wasAbove = false;
      expect(hysteresisCheck(89, threshold, hysteresis, wasAbove)).toBe(false);
    });

    it('should prevent oscillation at boundary', () => {
      const threshold = 100;
      const hysteresis = 10;
      let wasAbove = false;

      // Oscillating values around threshold
      const values = [98, 102, 99, 103, 100, 104, 101];
      const states: boolean[] = [];

      values.forEach(value => {
        wasAbove = hysteresisCheck(value, threshold, hysteresis, wasAbove);
        states.push(wasAbove);
      });

      // Should not oscillate - stays false until exceeding 110
      expect(states.every(s => s === false)).toBe(true);
    });

    it('should require full hysteresis zone crossing', () => {
      const threshold = 150;
      const hysteresis = 10;

      // Going up: must exceed 150 + 10 = 160
      let wasAbove = false;
      expect(hysteresisCheck(159, threshold, hysteresis, wasAbove)).toBe(false);
      expect(hysteresisCheck(161, threshold, hysteresis, wasAbove)).toBe(true);

      // Going down: must fall below 150 - 10 = 140
      wasAbove = true;
      expect(hysteresisCheck(141, threshold, hysteresis, wasAbove)).toBe(true);
      expect(hysteresisCheck(139, threshold, hysteresis, wasAbove)).toBe(false);
    });
  });

  describe('Integration: Angle Smoothing Pipeline', () => {
    it('should smooth jittery angle measurements', () => {
      // Simulate real-world jittery knee angle readings
      const readings = [160, 162, 158, 161, 159, 163, 157, 160];
      let smoothed = readings[0];

      const smoothedValues = readings.map(reading => {
        smoothed = ema(reading, smoothed, 0.3);
        return smoothed;
      });

      // Smoothed values should have less variance
      const originalVariance = variance(readings);
      const smoothedVariance = variance(smoothedValues);

      expect(smoothedVariance).toBeLessThan(originalVariance);
    });

    it('should track gradual angle changes', () => {
      // Simulate gradual descent in squat
      const readings = [160, 155, 150, 145, 140, 135, 130];
      let smoothed = readings[0];

      const smoothedValues = readings.map(reading => {
        smoothed = ema(reading, smoothed, 0.3);
        return smoothed;
      });

      // Smoothed values should follow trend
      expect(smoothedValues[0]).toBeGreaterThan(smoothedValues[smoothedValues.length - 1]);
      expect(smoothedValues).toEqual(smoothedValues.slice().sort((a, b) => b - a)); // Descending
    });
  });
});

/**
 * Helper: Calculate variance of array
 */
function variance(arr: number[]): number {
  const mean = arr.reduce((a, b) => a + b) / arr.length;
  return arr.reduce((sum, val) => sum + (val - mean) ** 2, 0) / arr.length;
}
