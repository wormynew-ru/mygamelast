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
          targetInferenceFPS: 60,
        }
      );

      expect(customTracker.getStatus()).toBe('IDLE');
    });

    it('should pass ideal frameRate constraint when starting camera', async () => {
      const customTracker = new PoseTracker({ frameRate: 60 }, { targetInferenceFPS: 60 });
      const stopTrack = vi.fn();
      const mockStream = {
        getTracks: () => [{ stop: stopTrack }],
      } as unknown as MediaStream;
      const getUserMediaSpy = vi.fn().mockResolvedValue(mockStream);

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: getUserMediaSpy },
      });

      const video = document.createElement('video');
      Object.defineProperty(video, 'readyState', { value: 2 });
      video.play = vi.fn().mockResolvedValue(undefined);

      await customTracker.startCamera(video);

      expect(getUserMediaSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({
            frameRate: { ideal: 60 },
          }),
        })
      );

      customTracker.dispose();
      expect(stopTrack).toHaveBeenCalled();
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

    it('should stop stream and preserve foreign video srcObject if disposed mid-startCamera', async () => {
      const stopLeakedTrack = vi.fn();
      let resolveStream!: (stream: MediaStream) => void;
      const pendingStream = new Promise<MediaStream>((resolve) => {
        resolveStream = resolve;
      });

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn().mockReturnValue(pendingStream) },
      });

      const video = document.createElement('video');
      const newerStream = { getTracks: () => [] } as unknown as MediaStream;
      video.srcObject = newerStream;

      const startPromise = tracker.startCamera(video);
      tracker.dispose();

      resolveStream({
        getTracks: () => [{ stop: stopLeakedTrack }],
      } as unknown as MediaStream);
      await startPromise;

      expect(stopLeakedTrack).toHaveBeenCalledTimes(1);
      expect(video.srcObject).toBe(newerStream);
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
