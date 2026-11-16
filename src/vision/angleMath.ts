/**
 * Pure math utilities for pose analysis.
 * NO external dependencies - pure functions only.
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { Point2D, Point3D } from './types';

/**
 * Check if a landmark has sufficient visibility confidence.
 *
 * @param landmark - MediaPipe landmark
 * @param minVisibility - Minimum confidence threshold (default 0.55)
 * @returns true if landmark is reliable
 */
export function isVisible(landmark: NormalizedLandmark, minVisibility = 0.55): boolean {
  return (landmark.visibility ?? 0) >= minVisibility;
}

/**
 * Check if all landmarks in a list are visible.
 *
 * @param landmarks - Array of landmarks to check
 * @param minVisibility - Minimum confidence threshold
 * @returns true if ALL landmarks are visible
 */
export function allVisible(landmarks: NormalizedLandmark[], minVisibility = 0.55): boolean {
  return landmarks.every(lm => isVisible(lm, minVisibility));
}

/**
 * Calculate 2D angle (in degrees) between three points.
 * Used for joint angles in side-view exercises (squats, push-ups).
 *
 * @param a - First point (e.g., shoulder)
 * @param b - Middle point (e.g., elbow) - the angle vertex
 * @param c - End point (e.g., wrist)
 * @returns Angle in degrees (0-180)
 */
export function angle2D(a: Point2D, b: Point2D, c: Point2D): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);

  if (angle > 180.0) {
    angle = 360.0 - angle;
  }

  return angle;
}

/**
 * Calculate 3D angle between three points using dot product.
 * More accurate for front-facing exercises where depth matters.
 *
 * @param a - First point
 * @param b - Middle point (angle vertex)
 * @param c - End point
 * @returns Angle in degrees (0-180)
 */
export function angle3D(a: Point3D, b: Point3D, c: Point3D): number {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const baz = a.z - b.z;

  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const bcz = c.z - b.z;

  const dot = bax * bcx + bay * bcy + baz * bcz;
  const magBA = Math.sqrt(bax * bax + bay * bay + baz * baz);
  const magBC = Math.sqrt(bcx * bcx + bcy * bcy + bcz * bcz);

  if (magBA === 0 || magBC === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));

  return (Math.acos(cosAngle) * 180.0) / Math.PI;
}

/**
 * Calculate Euclidean distance between two 2D points.
 *
 * @param a - First point
 * @param b - Second point
 * @returns Distance
 */
export function distance2D(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate Euclidean distance between two 3D points.
 *
 * @param a - First point
 * @param b - Second point
 * @returns Distance
 */
export function distance3D(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Exponential Moving Average filter for smoothing noisy sensor data.
 * Reduces jitter while maintaining responsiveness.
 *
 * @param currentValue - New raw value
 * @param previousSmoothed - Previous EMA output
 * @param alpha - Smoothing factor (0-1, higher = less smoothing, more responsive)
 * @returns Smoothed value
 */
export function ema(currentValue: number, previousSmoothed: number, alpha: number): number {
  return alpha * currentValue + (1 - alpha) * previousSmoothed;
}

/**
 * Simple low-pass filter for smoothing angles/positions over time.
 *
 * @param value - New raw value
 * @param smoothed - Previous smoothed value
 * @param factor - Smoothing factor (0-1, higher = more smoothing)
 * @returns Smoothed value
 */
export function lowPass(value: number, smoothed: number, factor: number): number {
  return smoothed * factor + value * (1 - factor);
}

/**
 * Clamp a value between min and max.
 *
 * @param value - Input value
 * @param min - Minimum bound
 * @param max - Maximum bound
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Map a value from one range to another (linear interpolation).
 * Useful for converting angles to progress (0-1).
 *
 * @param value - Input value
 * @param inMin - Input range minimum
 * @param inMax - Input range maximum
 * @param outMin - Output range minimum
 * @param outMax - Output range maximum
 * @param clampResult - Whether to clamp output to [outMin, outMax]
 * @returns Mapped value
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
  clampResult = true
): number {
  const mapped = ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  return clampResult ? clamp(mapped, Math.min(outMin, outMax), Math.max(outMin, outMax)) : mapped;
}

/**
 * Check if a value is within a range with hysteresis.
 * Prevents oscillation at threshold boundaries.
 *
 * @param value - Current value
 * @param threshold - Target threshold
 * @param hysteresis - Dead zone width
 * @param wasAbove - Previous state (true if value was above threshold)
 * @returns true if value is above threshold (considering hysteresis)
 */
export function hysteresisCheck(
  value: number,
  threshold: number,
  hysteresis: number,
  wasAbove: boolean
): boolean {
  if (wasAbove) {
    // Need to fall below (threshold - hysteresis) to switch off
    return value > threshold - hysteresis;
  } else {
    // Need to rise above (threshold + hysteresis) to switch on
    return value > threshold + hysteresis;
  }
}
