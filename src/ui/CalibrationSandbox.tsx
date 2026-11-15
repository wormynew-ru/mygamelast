/**
 * CalibrationSandbox: Test screen for exercise detection calibration.
 *
 * Features:
 * - Video with skeleton overlay
 * - Body visibility indicator with helpful hints
 * - Smooth squat depth gauge (0-100%)
 * - Current knee angle display
 * - Rep counter
 * - Reset button
 * - Sound toggle
 *
 * Pure React UI that subscribes to PoseTracker and SquatDetector callbacks.
 */

import React, { useEffect, useRef, useState } from 'react';
import { PoseTracker } from '../vision/PoseTracker';
import { SquatDetector } from '../vision/exercises/SquatDetector';
import { SoundFX } from '../audio/SoundFX';
import type { ExerciseState, VisibilityStatus } from '../vision/types';

interface CalibrationState {
  trackerStatus: string;
  detectorState: ExerciseState | null;
  soundEnabled: boolean;
  isInitialized: boolean;
}

export const CalibrationSandbox: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const trackerRef = useRef<PoseTracker | null>(null);
  const detectorRef = useRef<SquatDetector | null>(null);
  const soundFXRef = useRef<SoundFX | null>(null);

  const [state, setState] = useState<CalibrationState>({
    trackerStatus: 'IDLE',
    detectorState: null,
    soundEnabled: true,
    isInitialized: false,
  });

  const lastRepCountRef = useRef(0);
  const lastPhaseRef = useRef<string>('IDLE');

  // Initialize system on mount
  useEffect(() => {
    const initSystem = async () => {
      try {
        // Create instances
        const tracker = new PoseTracker(
          { facingMode: 'user', width: 640, height: 480 },
          { delegate: 'GPU' }
        );

        const detector = new SquatDetector({
          standingAngle: 160,
          bottomAngle: 90,
          hysteresis: 10,
          smoothingFactor: 0.3,
          minVisibility: 0.55,
          minBottomHoldTime: 200,
        });

        const soundFX = new SoundFX({ volume: 0.7, enabled: true });

        trackerRef.current = tracker;
        detectorRef.current = detector;
        soundFXRef.current = soundFX;

        // Status callback
        tracker.onStatusChange((status) => {
          setState((prev) => ({ ...prev, trackerStatus: status }));
        });

        // Pose callback - feed to detector
        tracker.onPose((landmarks, timestamp) => {
          if (!detector) return;

          const exerciseState = detector.update(landmarks, timestamp);

          setState((prev) => ({ ...prev, detectorState: exerciseState }));

          // Audio feedback
          if (!soundFX || !soundFXRef.current?.getConfig().enabled) return;

          // Rep complete sound
          if (exerciseState.repCount > lastRepCountRef.current) {
            soundFX.play('REP_COMPLETE');
            soundFX.speak(`${exerciseState.repCount} reps`);
            lastRepCountRef.current = exerciseState.repCount;
          }

          // Bottom hit sound (entering BOTTOM phase)
          if (exerciseState.phase === 'TRANSITION' && lastPhaseRef.current !== 'TRANSITION') {
            soundFX.play('BOTTOM_HIT');
          }

          lastPhaseRef.current = exerciseState.phase;
        });

        // Initialize MediaPipe and camera
        await tracker.loadModel();

        if (videoRef.current) {
          await tracker.startCamera(videoRef.current);
        }

        // Initialize audio (requires user interaction)
        await soundFX.init();

        // Start tracking with canvas rendering
        if (canvasRef.current) {
          tracker.start(canvasRef.current);
        }

        setState((prev) => ({ ...prev, isInitialized: true }));
      } catch (err) {
        console.error('Failed to initialize system:', err);
        setState((prev) => ({ ...prev, trackerStatus: 'ERROR' }));
      }
    };

    initSystem();

    // Cleanup on unmount
    return () => {
      if (trackerRef.current) {
        trackerRef.current.dispose();
      }
      if (soundFXRef.current) {
        soundFXRef.current.dispose();
      }
    };
  }, []);

  // Reset detector
  const handleReset = () => {
    if (detectorRef.current) {
      detectorRef.current.reset();
      lastRepCountRef.current = 0;
      lastPhaseRef.current = 'IDLE';
      setState((prev) => ({ ...prev, detectorState: null }));
    }
  };

  // Toggle sound
  const handleToggleSound = () => {
    setState((prev) => {
      const newEnabled = !prev.soundEnabled;

      if (soundFXRef.current) {
        soundFXRef.current.configure({ enabled: newEnabled });
      }

      return { ...prev, soundEnabled: newEnabled };
    });
  };

  // Get visibility hint message
  const getVisibilityHint = (visibility: VisibilityStatus): string => {
    switch (visibility) {
      case 'VISIBLE':
        return '✅ Body fully visible';
      case 'LOW_VISIBILITY':
        return '⚠️ Move to better lighting or adjust camera';
      case 'NOT_VISIBLE':
        return '❌ Step back so your legs are visible';
      default:
        return 'Waiting for body detection...';
    }
  };

  // Get phase color
  const getPhaseColor = (phase: string): string => {
    switch (phase) {
      case 'IDLE':
        return 'text-gray-400';
      case 'DOWN':
        return 'text-yellow-400';
      case 'TRANSITION':
        return 'text-orange-400';
      case 'UP':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  const { detectorState, trackerStatus, soundEnabled, isInitialized } = state;
  const kneeAngle = typeof detectorState?.debug?.kneeAngle === 'number'
    ? detectorState.debug.kneeAngle
    : 0;
  const progress = (detectorState?.progress ?? 0) * 100;
  const repCount = detectorState?.repCount ?? 0;
  const phase = detectorState?.phase ?? 'IDLE';
  const visibility = detectorState?.visibility ?? 'NOT_VISIBLE';

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Calibration Sandbox</h1>
          <p className="text-gray-400">
            Test squat detection and calibrate thresholds
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Feed */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="relative aspect-video bg-black">
                {/* Video element (hidden, rendered to canvas) */}
                <video
                  ref={videoRef}
                  className="hidden"
                  playsInline
                  muted
                  autoPlay
                />

                {/* Canvas overlay (skeleton + video) */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{ transform: 'scaleX(-1)' }} // Mirror for natural view
                />

                {/* Status overlay */}
                {!isInitialized && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
                      <p className="text-lg">{trackerStatus}...</p>
                    </div>
                  </div>
                )}

                {/* Visibility hint overlay */}
                {isInitialized && visibility !== 'VISIBLE' && (
                  <div className="absolute top-4 left-4 right-4">
                    <div className="bg-yellow-500 bg-opacity-90 text-black px-4 py-2 rounded-lg text-center font-medium">
                      {getVisibilityHint(visibility)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controls & Metrics */}
          <div className="space-y-6">
            {/* Rep Counter */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-sm font-medium text-gray-400 mb-2">Reps</h2>
              <div className="text-6xl font-bold text-center">{repCount}</div>
            </div>

            {/* Squat Depth Gauge */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-sm font-medium text-gray-400 mb-4">Squat Depth</h2>

              {/* Visual gauge */}
              <div className="relative h-48 bg-gray-700 rounded-lg overflow-hidden mb-4">
                {/* Progress bar */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 to-yellow-500 transition-all duration-150"
                  style={{ height: `${progress}%` }}
                />

                {/* Percentage label */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold drop-shadow-lg">
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>

              {/* Markers */}
              <div className="flex justify-between text-xs text-gray-400">
                <span>Standing</span>
                <span>Bottom</span>
              </div>
            </div>

            {/* Knee Angle */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-sm font-medium text-gray-400 mb-2">Knee Angle</h2>
              <div className="text-4xl font-bold text-center">
                {Math.round(kneeAngle)}°
              </div>
            </div>

            {/* Phase Indicator */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-sm font-medium text-gray-400 mb-2">Phase</h2>
              <div className={`text-2xl font-bold text-center ${getPhaseColor(phase)}`}>
                {phase}
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-3">
              {/* Reset Button */}
              <button
                onClick={handleReset}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                disabled={!isInitialized}
              >
                Reset Counter
              </button>

              {/* Sound Toggle */}
              <button
                onClick={handleToggleSound}
                className={`w-full font-medium py-3 px-4 rounded-lg transition-colors ${
                  soundEnabled
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                disabled={!isInitialized}
              >
                {soundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF'}
              </button>
            </div>

            {/* Debug Info */}
            {detectorState?.debug && (
              <div className="bg-gray-800 rounded-lg p-4 text-xs">
                <h3 className="text-gray-400 font-medium mb-2">Debug</h3>
                <div className="space-y-1 font-mono text-gray-300">
                  <div>Standing: {detectorState.debug.standingThreshold}°</div>
                  <div>Bottom: {detectorState.debug.bottomThreshold}°</div>
                  <div>Phase: {detectorState.debug.phase}</div>
                  <div>Reached Bottom: {detectorState.debug.reachedBottom}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-bold mb-4">Instructions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
            <div>
              <h3 className="font-medium text-white mb-2">Setup:</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Stand facing camera, full body visible</li>
                <li>Ensure good lighting</li>
                <li>Enable camera access when prompted</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Squat Form:</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Start standing (160° knee angle)</li>
                <li>Descend to bottom (90° knee angle)</li>
                <li>Hold briefly at bottom</li>
                <li>Return to standing to count rep</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
