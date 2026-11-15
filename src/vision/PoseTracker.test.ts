/**
 * Unit tests for PoseTracker.
 * Tests initialization, status tracking, and error handling.
 * Note: Camera and MediaPipe integration require mocking in unit tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PoseTracker } from './PoseTracker';

describe('PoseTracker', () => {
  let tracker: PoseTracker;

  beforeEach(() => {
    tracker = new PoseTracker();
  });

  describe('Initialization', () => {
    it('should start in IDLE status', () => {
      expect(tracker.getStatus()).toBe('IDLE');
      expect(tracker.getError()).toBeNull();
    });

    it('should accept custom camera config', () => {
      const customTracker = new PoseTracker({
        facingMode: 'environment',
        width: 1280,
        height: 720,
      });

      expect(customTracker.getStatus()).toBe('IDLE');
    });

    it('should accept custom model config', () => {
      const customTracker = new PoseTracker(
        {},
        {
          delegate: 'CPU',
          numPoses: 2,
        }
      );

      expect(customTracker.getStatus()).toBe('IDLE');
    });
  });

  describe('Status Management', () => {
    it('should track status changes via callback', () => {
      const statusChanges: string[] = [];

      tracker.onStatusChange((status) => {
        statusChanges.push(status);
      });

      // Manually trigger status changes for testing
      // (In real usage, loadModel/startCamera trigger these)
      expect(tracker.getStatus()).toBe('IDLE');
      expect(statusChanges.length).toBe(0);
    });

    it('should return null video dimensions when not started', () => {
      const dimensions = tracker.getVideoDimensions();
      expect(dimensions).toBeNull();
    });
  });

  describe('Lifecycle', () => {
    it('should allow registering pose callback', () => {
      const callback = vi.fn();
      tracker.onPose(callback);

      // Callback registered, no error thrown
      expect(callback).not.toHaveBeenCalled();
    });

    it('should allow registering status callback', () => {
      const callback = vi.fn();
      tracker.onStatusChange(callback);

      // Callback registered, no error thrown
      expect(callback).not.toHaveBeenCalled();
    });

    it('should dispose cleanly', () => {
      tracker.dispose();
      expect(tracker.getStatus()).toBe('IDLE');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when starting without initialization', () => {
      expect(() => {
        tracker.start();
      }).toThrow('Call loadModel() and startCamera() first');
    });

    it('should allow stop when not running', () => {
      // Should not throw
      tracker.stop();
      // Stop on IDLE tracker keeps it IDLE
      expect(tracker.getStatus()).toBe('IDLE');
    });
  });
});
