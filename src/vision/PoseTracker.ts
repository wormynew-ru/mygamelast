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
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { PoseLandmark } from './types';

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
export type PoseCallback = (landmarks: NormalizedLandmark[], timestamp: number) => void;

/**
 * Callback for status changes.
 */
export type StatusCallback = (status: TrackerStatus, error?: TrackerError) => void;

/**
 * Default MediaPipe configuration.
 */
const DEFAULT_MODEL_CONFIG: Required<ModelConfig> = {
  wasmPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm',
  modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
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
  private inferenceInterval = 0; // Will be calculated from targetInferenceFPS
  private lastLandmarks: NormalizedLandmark[] | null = null;

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
      // Load MediaPipe Vision WASM
      const vision = await FilesetResolver.forVisionTasks(this.modelConfig.wasmPath);

      // Create PoseLandmarker
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: this.modelConfig.modelAssetPath,
          delegate: this.modelConfig.delegate,
        },
        runningMode: 'VIDEO',
        numPoses: this.modelConfig.numPoses,
        minPoseDetectionConfidence: this.modelConfig.minDetectionConfidence,
        minTrackingConfidence: this.modelConfig.minTrackingConfidence,
      });

      this.setStatus('READY');
    } catch (err) {
      console.error('Failed to load MediaPipe model:', err);
      this.setError('MODEL_LOAD_FAILED');
      throw err;
    }
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

      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        if (!this.videoElement) {
          reject(new Error('Video element is null'));
          return;
        }

        this.videoElement.onloadedmetadata = () => {
          this.videoElement!.play()
            .then(() => resolve())
            .catch(reject);
        };

        // Timeout fallback
        setTimeout(() => reject(new Error('Video load timeout')), 10000);
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
      this.canvasCtx = canvasElement.getContext('2d');

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

    const now = performance.now();

    // Adaptive FPS throttling: skip inference if not enough time passed
    const timeSinceLastInference = now - this.lastInferenceTime;
    const shouldRunInference = timeSinceLastInference >= this.inferenceInterval;

    let landmarks: NormalizedLandmark[] | null = this.lastLandmarks;

    if (shouldRunInference) {
      // Run MediaPipe inference (expensive operation)
      const result = this.poseLandmarker.detectForVideo(this.videoElement, now);

      if (result.landmarks && result.landmarks.length > 0) {
        landmarks = result.landmarks[0]; // First pose only
        this.lastLandmarks = landmarks; // Cache for skipped frames
      }

      this.lastInferenceTime = now;
    }

    // Clear canvas before drawing (runs every frame at 60 FPS)
    if (this.canvasCtx && this.canvasElement && this.videoElement) {
      this.canvasCtx.save();
      this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

      // Mirror canvas for front-facing camera (user-facing mode)
      if (this.cameraConfig.facingMode === 'user') {
        this.canvasCtx.scale(-1, 1);
        this.canvasCtx.translate(-this.canvasElement.width, 0);
      }

      // Draw video frame first (background)
      this.canvasCtx.drawImage(
        this.videoElement,
        0,
        0,
        this.canvasElement.width,
        this.canvasElement.height
      );
    }

    // Draw skeleton and notify callback (use cached landmarks if inference was skipped)
    if (landmarks) {
      // Draw skeleton on canvas
      if (this.canvasCtx) {
        this.drawSkeleton(landmarks);
      }

      // Notify callback only on new inference (not on cached frames)
      if (shouldRunInference && this.poseCallback) {
        this.poseCallback(landmarks, now);
      }
    }

    // Restore canvas state
    if (this.canvasCtx) {
      this.canvasCtx.restore();
    }

    // Schedule next frame (60 FPS rendering loop)
    this.animationFrameId = requestAnimationFrame(this.detectLoop);
  };

  /**
   * Draw pose skeleton on canvas.
   */
  private drawSkeleton(landmarks: NormalizedLandmark[]): void {
    if (!this.canvasCtx || !this.canvasElement) {
      return;
    }

    const ctx = this.canvasCtx;
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;

    // Define skeleton connections (pairs of landmark indices)
    const connections: [PoseLandmark, PoseLandmark][] = [
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

    // Draw connections (lines)
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;

    connections.forEach(([startIdx, endIdx]) => {
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];

      // Only draw if both points are visible
      if ((start.visibility ?? 0) > 0.5 && (end.visibility ?? 0) > 0.5) {
        ctx.beginPath();
        ctx.moveTo(start.x * width, start.y * height);
        ctx.lineTo(end.x * width, end.y * height);
        ctx.stroke();
      }
    });

    // Draw landmark points
    ctx.fillStyle = '#FF0000';
    landmarks.forEach((landmark) => {
      if ((landmark.visibility ?? 0) > 0.5) {
        ctx.beginPath();
        ctx.arc(landmark.x * width, landmark.y * height, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
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
