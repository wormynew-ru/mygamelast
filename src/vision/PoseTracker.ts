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

  /** Optional specific device ID (for multi-camera devices) */
  deviceId?: string;
}

/**
 * MediaPipe model loading configuration.
 */
export interface ModelConfig {
  /** Base URL for MediaPipe WASM/model files */
  wasmPath?: string;

  /** Model asset path (lite/full/heavy) */
  modelAssetPath?: string;

  /** Delegate to use (GPU/CPU) */
  delegate?: 'GPU' | 'CPU';

  /** Number of poses to detect (default: 1) */
  numPoses?: number;

  /** Minimum detection confidence (0-1, default: 0.5) */
  minDetectionConfidence?: number;

  /** Minimum tracking confidence (0-1, default: 0.5) */
  minTrackingConfidence?: number;

  /** Target FPS for MediaPipe inference (default: 30) */
  targetInferenceFPS?: number;
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
  targetInferenceFPS: 30, // Throttle inference to 30 FPS (canvas still 60 FPS)
};

/**
 * Default camera configuration.
 */
const DEFAULT_CAMERA_CONFIG: Required<CameraConfig> = {
  facingMode: 'user',
  width: 640,
  height: 480,
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

  private animationFrameId: number | null = null;
  private isRunning = false;

  // FPS throttling for inference
  private lastInferenceTime = 0;
  private inferenceInterval = 0; // Base interval from targetInferenceFPS
  private adaptiveInferenceInterval = 0; // Expands automatically if device inference is slow
  private lastLandmarks: NormalizedLandmark[] | null = null;
  private lastWorldLandmarks: Landmark[] | undefined = undefined;

  private cameraConfig: Required<CameraConfig>;
  private modelConfig: Required<ModelConfig>;

  private poseCallback: PoseCallback | null = null;
  private statusCallback: StatusCallback | null = null;

  constructor(
    cameraConfig: Partial<CameraConfig> = {},
    modelConfig: Partial<ModelConfig> = {}
  ) {
    this.cameraConfig = { ...DEFAULT_CAMERA_CONFIG, ...cameraConfig };
    this.modelConfig = { ...DEFAULT_MODEL_CONFIG, ...modelConfig };

    // Calculate inference interval from target FPS (e.g., 30 FPS = 33.33ms)
    this.inferenceInterval = 1000 / this.modelConfig.targetInferenceFPS;
    this.adaptiveInferenceInterval = this.inferenceInterval;
  }

  /**
   * Initialize MediaPipe PoseLandmarker.
   */
  async loadModel(): Promise<void> {
    if (this.poseLandmarker) {
      return; // Already loaded
    }

    this.setStatus('LOADING_MODEL');

    try {
      this.poseLandmarker = await this.createLandmarkerWithDelegateFallback(
        this.modelConfig.wasmPath,
        this.modelConfig.modelAssetPath
      );
      this.setStatus('READY');
    } catch (localErr) {
      // Fallback to CDN if local assets or custom path fail
      if (
        this.modelConfig.wasmPath !== CDN_WASM_PATH ||
        this.modelConfig.modelAssetPath !== CDN_MODEL_ASSET_PATH
      ) {
        try {
          console.warn('Local MediaPipe load failed, falling back to CDN:', localErr);
          this.poseLandmarker = await this.createLandmarkerWithDelegateFallback(
            CDN_WASM_PATH,
            CDN_MODEL_ASSET_PATH
          );
          this.setStatus('READY');
          return;
        } catch (cdnErr) {
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
  ): Promise<PoseLandmarker> {
    try {
      return await this.createLandmarker(wasmPath, modelAssetPath, this.modelConfig.delegate);
    } catch (err) {
      if (this.modelConfig.delegate === 'GPU') {
        console.warn('GPU delegate initialization failed, falling back to CPU delegate:', err);
        return this.createLandmarker(wasmPath, modelAssetPath, 'CPU');
      }
      throw err;
    }
  }

  private async createLandmarker(
    wasmPath: string,
    modelAssetPath: string,
    delegate: 'GPU' | 'CPU'
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
    this.videoElement = videoElement;
    this.setStatus('REQUESTING_CAMERA');

    try {
      // Build constraints for getUserMedia
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.cameraConfig.facingMode,
          width: { ideal: this.cameraConfig.width },
          height: { ideal: this.cameraConfig.height },
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
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Configure video element for mobile compatibility
      this.videoElement.srcObject = this.mediaStream;
      this.videoElement.playsInline = true; // Critical for iOS
      this.videoElement.muted = true;
      this.videoElement.autoplay = true;

      // Wait for video to be ready (clean up timeout on resolution/error)
      await new Promise<void>((resolve, reject) => {
        const video = this.videoElement;
        if (!video) {
          reject(new Error('Video element is null'));
          return;
        }

        const timeoutId = window.setTimeout(() => {
          reject(new Error('Video load timeout'));
        }, 10000);

        const startPlayback = () => {
          video.play()
            .then(() => {
              window.clearTimeout(timeoutId);
              resolve();
            })
            .catch((playErr) => {
              window.clearTimeout(timeoutId);
              reject(playErr);
            });
        };

        if (video.readyState >= 1) {
          startPlayback();
        } else {
          video.onloadedmetadata = startPlayback;
        }
      });

      this.setStatus('READY');
    } catch (err) {
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

    if (!this.poseLandmarker || !this.videoElement) {
      throw new Error('Call loadModel() and startCamera() first');
    }

    // Setup canvas for skeleton rendering if provided
    if (canvasElement) {
      this.canvasElement = canvasElement;
      this.canvasCtx = canvasElement.getContext('2d', { alpha: false });

      if (this.canvasCtx) {
        // Match canvas size to video
        this.canvasElement.width = this.videoElement.videoWidth || this.cameraConfig.width;
        this.canvasElement.height = this.videoElement.videoHeight || this.cameraConfig.height;
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
    this.stop();

    // Stop camera stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Clear video element
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    // Dispose MediaPipe resources
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }

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
    if (!this.isRunning || !this.videoElement || !this.poseLandmarker) {
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

    const now = performance.now();

    // Adaptive FPS throttling: skip inference if within budget or previous inference ran hot
    const timeSinceLastInference = now - this.lastInferenceTime;
    const shouldRunInference = timeSinceLastInference >= this.adaptiveInferenceInterval;

    let landmarks: NormalizedLandmark[] | null = this.lastLandmarks;
    let worldLandmarks: Landmark[] | undefined = this.lastWorldLandmarks;

    if (shouldRunInference) {
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
