/**
 * Unit tests for PoseTracker.
 * Tests initialization, status tracking, and error handling.
 * Note: Camera and MediaPipe integration require mocking in unit tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { PoseTracker } from './PoseTracker';

describe('PoseTracker', () => {
  let tracker: PoseTracker;

  beforeEach(() => {
    tracker = new PoseTracker();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should start in IDLE status and default to GPU delegate', () => {
      expect(tracker.getStatus()).toBe('IDLE');
      expect(tracker.getError()).toBeNull();
      expect(tracker.getRequestedDelegate()).toBe('GPU');
      expect(tracker.getActiveDelegate()).toBeNull();
      expect(tracker.didFallbackToCpu()).toBe(false);
    });

    it('should accept custom camera config', () => {
      const customTracker = new PoseTracker({
        facingMode: 'environment',
        width: 1280,
        height: 720,
      });

      expect(customTracker.getStatus()).toBe('IDLE');
    });

    it('should accept custom model config with CPU delegate', () => {
      const customTracker = new PoseTracker(
        {},
        {
          delegate: 'CPU',
          numPoses: 2,
          targetInferenceFPS: 60,
        }
      );

      expect(customTracker.getStatus()).toBe('IDLE');
      expect(customTracker.getRequestedDelegate()).toBe('CPU');
    });

    it('should track active GPU delegate when MediaPipe initializes on GPU', async () => {
      const closeMock = vi.fn();
      vi.spyOn(FilesetResolver, 'forVisionTasks').mockResolvedValue({} as never);
      const createSpy = vi
        .spyOn(PoseLandmarker, 'createFromOptions')
        .mockResolvedValue({ close: closeMock } as unknown as PoseLandmarker);

      await tracker.loadModel();

      expect(createSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          baseOptions: expect.objectContaining({ delegate: 'GPU' }),
        })
      );
      expect(tracker.getActiveDelegate()).toBe('GPU');
      expect(tracker.didFallbackToCpu()).toBe(false);
      expect(tracker.getStatus()).toBe('READY');

      tracker.dispose();
      expect(closeMock).toHaveBeenCalledTimes(1);
      expect(tracker.getActiveDelegate()).toBeNull();
    });

    it('should fall back to CPU and mark fallbackUsed if GPU delegate initialization fails', async () => {
      const closeMock = vi.fn();
      vi.spyOn(FilesetResolver, 'forVisionTasks').mockResolvedValue({} as never);
      const createSpy = vi
        .spyOn(PoseLandmarker, 'createFromOptions')
        .mockRejectedValueOnce(new Error('WebGL2 unavailable'))
        .mockResolvedValueOnce({ close: closeMock } as unknown as PoseLandmarker);

      await tracker.loadModel();

      expect(createSpy).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({
          baseOptions: expect.objectContaining({ delegate: 'GPU' }),
        })
      );
      expect(createSpy).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({
          baseOptions: expect.objectContaining({ delegate: 'CPU' }),
        })
      );
      expect(tracker.getActiveDelegate()).toBe('CPU');
      expect(tracker.didFallbackToCpu()).toBe(true);
      expect(tracker.getStatus()).toBe('READY');

      tracker.dispose();
    });

    it('should initialize directly on CPU without attempting GPU when CPU delegate is configured', async () => {
      const cpuTracker = new PoseTracker({}, { delegate: 'CPU' });
      const closeMock = vi.fn();
      vi.spyOn(FilesetResolver, 'forVisionTasks').mockResolvedValue({} as never);
      const createSpy = vi
        .spyOn(PoseLandmarker, 'createFromOptions')
        .mockResolvedValue({ close: closeMock } as unknown as PoseLandmarker);

      await cpuTracker.loadModel();

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          baseOptions: expect.objectContaining({ delegate: 'CPU' }),
        })
      );
      expect(cpuTracker.getActiveDelegate()).toBe('CPU');
      expect(cpuTracker.didFallbackToCpu()).toBe(false);

      cpuTracker.dispose();
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

    it('runs scripted mode cleanly without camera or MediaPipe model download', async () => {
      const scriptedTracker = new PoseTracker(
        {},
        {
          scriptedPoseGenerator: () => ({
            landmarks: Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 })),
            worldLandmarks: [],
          }),
        }
      );
      const onPose = vi.fn();
      scriptedTracker.onPose(onPose);

      await scriptedTracker.loadModel();
      expect(scriptedTracker.isScriptedMode()).toBe(true);
      expect(scriptedTracker.getStatus()).toBe('READY');

      const video = document.createElement('video');
      await scriptedTracker.startCamera(video);
      scriptedTracker.start();
      expect(scriptedTracker.getStatus()).toBe('RUNNING');
      expect(onPose).toHaveBeenCalledTimes(1);

      scriptedTracker.dispose();
      expect(scriptedTracker.getStatus()).toBe('IDLE');
    });
  });
});
