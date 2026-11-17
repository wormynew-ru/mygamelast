/**
 * PoseTracker: Camera capture, MediaPipe initialization, and skeleton rendering.
 *
 * Responsibilities:
 * - Safe camera access with mobile/desktop compatibility
 * - MediaPipe PoseLandmarker loading with progress tracking
 * - Real-time pose detection loop via requestAnimationFrame
 * - Canvas skeleton rendering (mirrored for front-facing camera)
 * - Resource cleanup on stop
 *
 * ZERO dependencies on React, Zustand, or game logic.
 */

import {
  PoseLandmarker,
  FilesetResolver,
  type Landmark,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { PoseLandmark } from './types';
import type { ScriptedPoseGenerator } from './ScriptedPoseSource';

const POSE_CONNECTIONS: ReadonlyArray<readonly [PoseLandmark, PoseLandmark]> = [
  // Face
  [PoseLandmark.LEFT_EYE, PoseLandmark.RIGHT_EYE],
  [PoseLandmark.LEFT_EYE, PoseLandmark.NOSE],
  [PoseLandmark.RIGHT_EYE, PoseLandmark.NOSE],
  [PoseLandmark.LEFT_EYE, PoseLandmark.LEFT_EAR],
  [PoseLandmark.RIGHT_EYE, PoseLandmark.RIGHT_EAR],
  [PoseLandmark.MOUTH_LEFT, PoseLandmark.MOUTH_RIGHT],
  // Torso
  [PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER],
  [PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_HIP],
  [PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_HIP],
  [PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP],
  // Left arm
  [PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_ELBOW],
  [PoseLandmark.LEFT_ELBOW, PoseLandmark.LEFT_WRIST],
  [PoseLandmark.LEFT_WRIST, PoseLandmark.LEFT_THUMB],
  [PoseLandmark.LEFT_WRIST, PoseLandmark.LEFT_INDEX],
  [PoseLandmark.LEFT_WRIST, PoseLandmark.LEFT_PINKY],
  // Right arm
  [PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_ELBOW],
  [PoseLandmark.RIGHT_ELBOW, PoseLandmark.RIGHT_WRIST],
  [PoseLandmark.RIGHT_WRIST, PoseLandmark.RIGHT_THUMB],
  [PoseLandmark.RIGHT_WRIST, PoseLandmark.RIGHT_INDEX],
  [PoseLandmark.RIGHT_WRIST, PoseLandmark.RIGHT_PINKY],
  // Left leg
  [PoseLandmark.LEFT_HIP, PoseLandmark.LEFT_KNEE],
  [PoseLandmark.LEFT_KNEE, PoseLandmark.LEFT_ANKLE],
  [PoseLandmark.LEFT_ANKLE, PoseLandmark.LEFT_HEEL],
  [PoseLandmark.LEFT_ANKLE, PoseLandmark.LEFT_FOOT_INDEX],
  // Right leg
  [PoseLandmark.RIGHT_HIP, PoseLandmark.RIGHT_KNEE],
  [PoseLandmark.RIGHT_KNEE, PoseLandmark.RIGHT_ANKLE],
  [PoseLandmark.RIGHT_ANKLE, PoseLandmark.RIGHT_HEEL],
  [PoseLandmark.RIGHT_ANKLE, PoseLandmark.RIGHT_FOOT_INDEX],
];

const LANDMARK_RADIUS = 4;
const TWO_PI = Math.PI * 2;

/**
 * Camera configuration options.
 */
export interface CameraConfig {
  /** Preferred camera facing mode */
  facingMode: 'user' | 'environment';

  /** Preferred video resolution width */
  width?: number;

  /** Preferred video resolution height */
  height?: number;

  /** Preferred camera frame rate (FPS, default: 60) */
  frameRate?: number;

  /** Optional specific device ID (for multi-camera devices) */
  deviceId?: string;
}

/**
 * Compute delegate for MediaPipe neural network inference.
 */
export type PoseDelegate = 'GPU' | 'CPU';

/**
 * MediaPipe model loading configuration.
 */
export interface ModelConfig {
  /** Base URL for MediaPipe WASM/model files */
  wasmPath?: string;

  /** Model asset path (lite/full/heavy) */
  modelAssetPath?: string;

  /** Delegate to use (GPU/CPU) */
  delegate?: PoseDelegate;

  /** Number of poses to detect (default: 1) */
  numPoses?: number;

  /** Minimum detection confidence (0-1, default: 0.5) */
  minDetectionConfidence?: number;

  /** Minimum tracking confidence (0-1, default: 0.5) */
  minTrackingConfidence?: number;

  /** Target FPS for MediaPipe inference (default: 30) */
  targetInferenceFPS?: number;

  /** Optional deterministic scripted pose generator (bypasses camera/MediaPipe) */
  scriptedPoseGenerator?: ScriptedPoseGenerator | null;
}

/**
 * Tracker status states.
 */
export type TrackerStatus =
  | 'IDLE'
  | 'LOADING_MODEL'
  | 'REQUESTING_CAMERA'
  | 'READY'
  | 'RUNNING'
  | 'ERROR';

/**
 * Tracker error types.
 */
export type TrackerError =
  | 'CAMERA_NOT_FOUND'
  | 'CAMERA_PERMISSION_DENIED'
  | 'CAMERA_IN_USE'
  | 'MODEL_LOAD_FAILED'
  | 'UNKNOWN_ERROR';

/**
 * Callback for pose detection results.
 */
export type PoseCallback = (
  landmarks: NormalizedLandmark[],
  timestamp: number,
  worldLandmarks?: Landmark[]
) => void;

/**
 * Callback for status changes.
 */
export type StatusCallback = (status: TrackerStatus, error?: TrackerError) => void;

/**
 * Default MediaPipe configuration.
 */
const CDN_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm';
const CDN_MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const DEFAULT_MODEL_CONFIG: Required<ModelConfig> = {
  wasmPath: '/mediapipe/wasm',
  modelAssetPath: '/mediapipe/pose_landmarker_lite.task',
  delegate: 'GPU',
  numPoses: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  targetInferenceFPS: 60, // Up to 60 FPS on desktop GPU; adaptive + new-frame guard prevents waste
  scriptedPoseGenerator: null,
};

/**
 * Default camera configuration.
 */
const DEFAULT_CAMERA_CONFIG: Required<CameraConfig> = {
  facingMode: 'user',
  width: 640,
  height: 480,
  frameRate: 60,
  deviceId: '',
};

/**
 * PoseTracker handles camera, MediaPipe, and rendering.
 */
export class PoseTracker {
  private status: TrackerStatus = 'IDLE';
  private error: TrackerError | null = null;

  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;

  private poseLandmarker: PoseLandmarker | null = null;
  private mediaStream: MediaStream | null = null;
  private activeDelegate: PoseDelegate | null = null;
  private fallbackUsed = false;

  private animationFrameId: number | null = null;
  private isRunning = false;
  private lifecycleToken = 0;
  private abortPendingCameraWait: (() => void) | null = null;

  // FPS throttling for inference
  private lastInferenceTime = 0;
  private lastVideoTime = -1;
  private inferenceInterval = 0; // Base interval from targetInferenceFPS
  private adaptiveInferenceInterval = 0; // Expands automatically if device inference is slow
  private lastLandmarks: NormalizedLandmark[] | null = null;
  private lastWorldLandmarks: Landmark[] | undefined = undefined;

  private cameraConfig: Required<CameraConfig>;
  private modelConfig: Required<ModelConfig>;

  private poseCallback: PoseCallback | null = null;
  private statusCallback: StatusCallback | null = null;
  private scriptedPoseGenerator: ScriptedPoseGenerator | null = null;

  constructor(
    cameraConfig: Partial<CameraConfig> = {},
    modelConfig: Partial<ModelConfig> = {}
  ) {
    this.cameraConfig = { ...DEFAULT_CAMERA_CONFIG, ...cameraConfig };
    this.modelConfig = { ...DEFAULT_MODEL_CONFIG, ...modelConfig };

    // Calculate inference interval from target FPS (e.g., 30 FPS = 33.33ms)
    this.inferenceInterval = 1000 / this.modelConfig.targetInferenceFPS;
    this.adaptiveInferenceInterval = this.inferenceInterval;
    this.scriptedPoseGenerator = this.modelConfig.scriptedPoseGenerator ?? null;
  }

  /**
   * Enable or switch deterministic scripted pose mode (pass null to return to camera mode).
   */
  setScriptedPoseGenerator(generator: ScriptedPoseGenerator | null): void {
    this.scriptedPoseGenerator = generator;
  }

  /**
   * Returns true if PoseTracker is currently driving poses from a scripted source.
   */
  isScriptedMode(): boolean {
    return this.scriptedPoseGenerator !== null;
  }

  /**
   * Initialize MediaPipe PoseLandmarker (or short-circuit cleanly in scripted mode).
   */
  async loadModel(): Promise<void> {
    if (this.scriptedPoseGenerator) {
      this.activeDelegate = 'CPU';
      this.fallbackUsed = false;
      this.setStatus('READY');
      return;
    }
    if (this.poseLandmarker) {
      return; // Already loaded
    }

    const token = this.lifecycleToken;
    this.setStatus('LOADING_MODEL');
    this.activeDelegate = null;
    this.fallbackUsed = false;

    try {
      const created = await this.createLandmarkerWithDelegateFallback(
        this.modelConfig.wasmPath,
        this.modelConfig.modelAssetPath
      );
      if (token !== this.lifecycleToken) {
        created.landmarker.close();
        return;
      }
      this.poseLandmarker = created.landmarker;
      this.activeDelegate = created.delegate;
      this.fallbackUsed = created.fallbackUsed;
      this.setStatus('READY');
    } catch (localErr) {
      if (token !== this.lifecycleToken) {
        return;
      }
      // Fallback to CDN if local assets or custom path fail
      if (
        this.modelConfig.wasmPath !== CDN_WASM_PATH ||
        this.modelConfig.modelAssetPath !== CDN_MODEL_ASSET_PATH
      ) {
        try {
          console.warn('Local MediaPipe load failed, falling back to CDN:', localErr);
          const created = await this.createLandmarkerWithDelegateFallback(
            CDN_WASM_PATH,
            CDN_MODEL_ASSET_PATH
          );
          if (token !== this.lifecycleToken) {
            created.landmarker.close();
            return;
          }
          this.poseLandmarker = created.landmarker;
          this.activeDelegate = created.delegate;
          this.fallbackUsed = created.fallbackUsed;
          this.setStatus('READY');
          return;
        } catch (cdnErr) {
          if (token !== this.lifecycleToken) {
            return;
          }
          console.error('Failed to load MediaPipe model from CDN fallback:', cdnErr);
          this.setError('MODEL_LOAD_FAILED');
          throw cdnErr;
        }
      }

      console.error('Failed to load MediaPipe model:', localErr);
      this.setError('MODEL_LOAD_FAILED');
      throw localErr;
    }
  }

  private async createLandmarkerWithDelegateFallback(
    wasmPath: string,
    modelAssetPath: string
  ): Promise<{ landmarker: PoseLandmarker; delegate: PoseDelegate; fallbackUsed: boolean }> {
    try {
      const landmarker = await this.createLandmarker(
        wasmPath,
        modelAssetPath,
        this.modelConfig.delegate
      );
      return {
        landmarker,
        delegate: this.modelConfig.delegate,
        fallbackUsed: false,
      };
    } catch (err) {
      if (this.modelConfig.delegate === 'GPU') {
        console.warn('GPU delegate initialization failed, falling back to CPU delegate:', err);
        const landmarker = await this.createLandmarker(wasmPath, modelAssetPath, 'CPU');
        return {
          landmarker,
          delegate: 'CPU',
          fallbackUsed: true,
        };
      }
      throw err;
    }
  }

  private async createLandmarker(
    wasmPath: string,
    modelAssetPath: string,
    delegate: PoseDelegate
  ): Promise<PoseLandmarker> {
    const vision = await FilesetResolver.forVisionTasks(wasmPath);
    return PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath,
        delegate,
      },
      runningMode: 'VIDEO',
      numPoses: this.modelConfig.numPoses,
      minPoseDetectionConfidence: this.modelConfig.minDetectionConfidence,
      minTrackingConfidence: this.modelConfig.minTrackingConfidence,
    });
  }

  /**
   * Request camera access and initialize video stream.
   */
  async startCamera(videoElement: HTMLVideoElement): Promise<void> {
    const token = this.lifecycleToken;
    this.videoElement = videoElement;

    if (this.scriptedPoseGenerator) {
      this.setStatus('READY');
      return;
    }

    this.setStatus('REQUESTING_CAMERA');

    try {
      // Release any prior stream owned by this tracker before re-acquiring
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      }

      // Build constraints for getUserMedia
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.cameraConfig.facingMode,
          width: { ideal: this.cameraConfig.width },
          height: { ideal: this.cameraConfig.height },
          frameRate: { ideal: this.cameraConfig.frameRate },
        },
        audio: false,
      };

      // Add specific device ID if provided
      if (this.cameraConfig.deviceId) {
        (constraints.video as MediaTrackConstraints).deviceId = {
          exact: this.cameraConfig.deviceId,
        };
      }

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (token !== this.lifecycleToken) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.mediaStream = stream;

      // Configure video element for mobile & desktop compatibility
      videoElement.playsInline = true; // Critical for iOS
      videoElement.muted = true;
      videoElement.autoplay = true;
      videoElement.srcObject = stream;

      // Wait for video metadata/playback readiness without clobbering or leaking handlers
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let timeoutId: number | null = null;

        const cleanup = () => {
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
          }
          videoElement.removeEventListener('loadedmetadata', startPlayback);
          videoElement.removeEventListener('loadeddata', startPlayback);
          videoElement.removeEventListener('canplay', startPlayback);
          videoElement.removeEventListener('error', onVideoError);
          if (this.abortPendingCameraWait === abortWait) {
            this.abortPendingCameraWait = null;
          }
        };

        const finishResolve = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        };

        const finishReject = (err: unknown) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(err);
        };

        const abortWait = () => {
          // Silently settle on dispose so unmount cleanup doesn't emit unhandled rejections
          finishResolve();
        };

        const onVideoError = () => {
          finishReject(new Error('Video stream error'));
        };

        const startPlayback = () => {
          if (settled || token !== this.lifecycleToken) {
            finishResolve();
            return;
          }

          videoElement
            .play()
            .then(() => {
              finishResolve();
            })
            .catch((playErr: unknown) => {
              // AbortError happens when srcObject changes concurrently; treat stale token as benign
              if (token !== this.lifecycleToken) {
                finishResolve();
                return;
              }
              finishReject(playErr);
            });
        };

        this.abortPendingCameraWait = abortWait;

        timeoutId = window.setTimeout(() => {
          finishReject(new Error('Video load timeout'));
        }, 15000);

        videoElement.addEventListener('loadedmetadata', startPlayback);
        videoElement.addEventListener('loadeddata', startPlayback);
        videoElement.addEventListener('canplay', startPlayback);
        videoElement.addEventListener('error', onVideoError);

        if (videoElement.readyState >= 1) {
          startPlayback();
        }
      });

      if (token !== this.lifecycleToken) {
        return;
      }

      this.setStatus('READY');
    } catch (err) {
      if (token !== this.lifecycleToken) {
        return;
      }
      console.error('Failed to start camera:', err);

      // Map error to specific type
      if (err instanceof Error) {
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          this.setError('CAMERA_NOT_FOUND');
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          this.setError('CAMERA_PERMISSION_DENIED');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          this.setError('CAMERA_IN_USE');
        } else {
          this.setError('UNKNOWN_ERROR');
        }
      } else {
        this.setError('UNKNOWN_ERROR');
      }

      throw err;
    }
  }

  /**
   * Start pose detection loop with optional canvas rendering.
   */
  start(canvasElement?: HTMLCanvasElement): void {
    if (this.isRunning) {
      return; // Already running
    }

    const isScripted = this.scriptedPoseGenerator !== null;
    if (!isScripted && (!this.poseLandmarker || !this.videoElement)) {
      throw new Error('Call loadModel() and startCamera() first');
    }

    // Setup canvas for skeleton rendering if provided
    if (canvasElement) {
      this.canvasElement = canvasElement;
      this.canvasCtx = canvasElement.getContext('2d', { alpha: false, desynchronized: true });

      if (this.canvasCtx) {
        this.canvasElement.width =
          this.videoElement?.videoWidth || this.cameraConfig.width;
        this.canvasElement.height =
          this.videoElement?.videoHeight || this.cameraConfig.height;
      }
    }

    this.isRunning = true;
    this.setStatus('RUNNING');

    // Start detection loop
    this.detectLoop();
  }

  /**
   * Stop pose detection and rendering.
   */
  stop(): void {
    this.isRunning = false;
    this.lastVideoTime = -1;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Only set to READY if we have initialized resources
    if (this.status !== 'IDLE' && this.status !== 'ERROR') {
      this.setStatus('READY');
    }
  }

  /**
   * Release all resources (camera, MediaPipe, canvas).
   */
  dispose(): void {
    this.lifecycleToken++;
    this.abortPendingCameraWait?.();
    this.abortPendingCameraWait = null;
    this.stop();

    const ownedStream = this.mediaStream;

    // Only clear srcObject if this tracker actively owns it (prevents wiping a remounted instance)
    if (this.videoElement) {
      if (ownedStream && this.videoElement.srcObject === ownedStream) {
        this.videoElement.srcObject = null;
      }
      this.videoElement = null;
    }

    // Stop camera stream
    if (ownedStream) {
      ownedStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Dispose MediaPipe resources
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
    this.activeDelegate = null;
    this.fallbackUsed = false;

    // Clear canvas
    this.canvasElement = null;
    this.canvasCtx = null;

    this.setStatus('IDLE');
  }

  /**
   * Register callback for pose detection results.
   */
  onPose(callback: PoseCallback): void {
    this.poseCallback = callback;
  }

  /**
   * Register callback for status changes.
   */
  onStatusChange(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  /**
   * Get current tracker status.
   */
  getStatus(): TrackerStatus {
    return this.status;
  }

  /**
   * Get current error (if any).
   */
  getError(): TrackerError | null {
    return this.error;
  }

  /**
   * Get configured compute delegate ('GPU' | 'CPU').
   */
  getRequestedDelegate(): PoseDelegate {
    return this.modelConfig.delegate;
  }

  /**
   * Get active runtime compute delegate after model initialization.
   */
  getActiveDelegate(): PoseDelegate | null {
    return this.activeDelegate;
  }

  /**
   * Returns true when GPU initialization failed and fell back to CPU.
   */
  didFallbackToCpu(): boolean {
    return this.fallbackUsed;
  }

  /**
   * Get video element dimensions.
   */
  getVideoDimensions(): { width: number; height: number } | null {
    if (!this.videoElement) {
      return null;
    }

    return {
      width: this.videoElement.videoWidth,
      height: this.videoElement.videoHeight,
    };
  }

  /**
   * Main detection loop (runs every frame via requestAnimationFrame).
   * Canvas rendering: 60 FPS, MediaPipe inference: throttled to targetInferenceFPS.
   */
  private detectLoop = (): void => {
    if (!this.isRunning) {
      return;
    }

    const now = performance.now();

    if (this.scriptedPoseGenerator) {
      const timeSinceLastInference = now - this.lastInferenceTime;
      const budgetWithJitterMs = Math.max(0, this.inferenceInterval - 2);
      const shouldStep = this.lastInferenceTime === 0 || timeSinceLastInference >= budgetWithJitterMs;

      if (shouldStep) {
        const frame = this.scriptedPoseGenerator(now);
        this.lastLandmarks = frame.landmarks;
        this.lastWorldLandmarks = frame.worldLandmarks;
        this.lastInferenceTime = now;

        if (this.canvasCtx && this.canvasElement) {
          const ctx = this.canvasCtx;
          const cw = this.canvasElement.width;
          const ch = this.canvasElement.height;
          ctx.fillStyle = '#090f1d';
          ctx.fillRect(0, 0, cw, ch);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let gx = 40; gx < cw; gx += 40) {
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, ch);
          }
          for (let gy = 40; gy < ch; gy += 40) {
            ctx.moveTo(0, gy);
            ctx.lineTo(cw, gy);
          }
          ctx.stroke();
          this.drawSkeleton(frame.landmarks);
        }

        if (this.poseCallback) {
          this.poseCallback(frame.landmarks, now, frame.worldLandmarks);
        }
      }

      this.animationFrameId = requestAnimationFrame(this.detectLoop);
      return;
    }

    if (!this.videoElement || !this.poseLandmarker) {
      return;
    }

    const video = this.videoElement;
    const isVideoReady = video.readyState >= 2 && video.videoWidth > 0 && !video.paused;

    if (!isVideoReady) {
      this.animationFrameId = requestAnimationFrame(this.detectLoop);
      return;
    }

    // Keep canvas resolution synced if mobile orientation changes
    if (
      this.canvasElement &&
      (this.canvasElement.width !== video.videoWidth ||
        this.canvasElement.height !== video.videoHeight)
    ) {
      this.canvasElement.width = video.videoWidth;
      this.canvasElement.height = video.videoHeight;
    }

    // Adaptive FPS throttling + duplicate frame guard:
    // - 2ms jitter tolerance avoids dropping 60Hz vsync to 30Hz
    // - video.currentTime guard avoids re-running inference twice on the same 30Hz webcam frame
    const timeSinceLastInference = now - this.lastInferenceTime;
    const budgetWithJitterMs = Math.max(0, this.adaptiveInferenceInterval - 2);
    const hasNewVideoFrame =
      this.lastVideoTime === -1 || video.currentTime !== this.lastVideoTime;
    const shouldRunInference =
      hasNewVideoFrame && timeSinceLastInference >= budgetWithJitterMs;

    let landmarks: NormalizedLandmark[] | null = this.lastLandmarks;
    let worldLandmarks: Landmark[] | undefined = this.lastWorldLandmarks;

    if (shouldRunInference) {
      this.lastVideoTime = video.currentTime;
      const inferStart = performance.now();
      const result = this.poseLandmarker.detectForVideo(video, now);
      const inferDuration = performance.now() - inferStart;

      // Adaptively widen interval when device CPU/GPU inference exceeds ~85% of budget
      if (inferDuration > this.inferenceInterval * 0.85) {
        this.adaptiveInferenceInterval = Math.min(100, Math.max(this.inferenceInterval, inferDuration * 1.25));
      } else {
        this.adaptiveInferenceInterval = this.inferenceInterval;
      }

      if (result.landmarks && result.landmarks.length > 0) {
        landmarks = result.landmarks[0];
        this.lastLandmarks = landmarks;
        worldLandmarks = result.worldLandmarks?.[0];
        this.lastWorldLandmarks = worldLandmarks;
      }

      this.lastInferenceTime = now;
    }

    // Render video frame + batched skeleton overlay (runs at display refresh rate)
    if (this.canvasCtx && this.canvasElement) {
      const ctx = this.canvasCtx;
      const cw = this.canvasElement.width;
      const ch = this.canvasElement.height;

      ctx.save();

      if (this.cameraConfig.facingMode === 'user') {
        ctx.scale(-1, 1);
        ctx.translate(-cw, 0);
      }

      ctx.drawImage(video, 0, 0, cw, ch);

      if (landmarks) {
        this.drawSkeleton(landmarks);
      }

      ctx.restore();
    }

    // Notify callback only on fresh inference
    if (landmarks && shouldRunInference && this.poseCallback) {
      this.poseCallback(landmarks, now, worldLandmarks);
    }

    this.animationFrameId = requestAnimationFrame(this.detectLoop);
  };

  /**
   * Draw pose skeleton on canvas using batched paths (single stroke + single fill per frame).
   */
  private drawSkeleton(landmarks: NormalizedLandmark[]): void {
    if (!this.canvasCtx || !this.canvasElement) {
      return;
    }

    const ctx = this.canvasCtx;
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;

    // Batch all skeleton connections in one path flush
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < POSE_CONNECTIONS.length; i++) {
      const [startIdx, endIdx] = POSE_CONNECTIONS[i];
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];

      if (start && end && (start.visibility ?? 0) > 0.5 && (end.visibility ?? 0) > 0.5) {
        ctx.moveTo(start.x * width, start.y * height);
        ctx.lineTo(end.x * width, end.y * height);
      }
    }
    ctx.stroke();

    // Batch all landmark joint dots in one path flush
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();

    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if ((lm.visibility ?? 0) > 0.5) {
        const cx = lm.x * width;
        const cy = lm.y * height;
        ctx.moveTo(cx + LANDMARK_RADIUS, cy);
        ctx.arc(cx, cy, LANDMARK_RADIUS, 0, TWO_PI);
      }
    }
    ctx.fill();
  }

  /**
   * Update tracker status and notify callback.
   */
  private setStatus(status: TrackerStatus): void {
    this.status = status;

    if (status !== 'ERROR') {
      this.error = null;
    }

    if (this.statusCallback) {
      this.statusCallback(status, this.error ?? undefined);
    }
  }

  /**
   * Set error state and notify callback.
   */
  private setError(error: TrackerError): void {
    this.error = error;
    this.setStatus('ERROR');
  }
}
