/**
 * CalibrationSandbox - Test & calibration screen for all 7 exercise detectors.
 * Supports live angle threshold tuning persisted in Zustand store
 * and applied across both calibration and live battles.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, RotateCcw, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { PoseTracker, type PoseDelegate } from '../vision/PoseTracker';
import { SoundFX } from '../audio/SoundFX';
import { applyExerciseCalibration, createExerciseDetector } from '../session/WorkoutSession';
import type { ExerciseDetector, ExerciseState, VisibilityStatus } from '../vision/types';
import { EXERCISES, type ExerciseId } from '../game/data/exercises';
import type { ExerciseCalibrationSettings } from '../game/types';
import { useGameStore } from '../game/store';
import { useTranslation, type TranslationKey } from '../i18n/useTranslation';
import { EXERCISE_NAME_KEYS } from './gameKeys';
import { useVoiceCommandHandler } from './VoiceControl';

interface CalibrationSandboxProps {
  onBack?: () => void;
}

interface ThresholdDescriptor {
  field: keyof ExerciseCalibrationSettings;
  labelKey: TranslationKey;
  min: number;
  max: number;
  step: number;
}

const EXERCISE_THRESHOLD_DESCRIPTORS: Record<ExerciseId, ThresholdDescriptor> = {
  SQUAT: {
    field: 'squatBottomAngle',
    labelKey: 'calibration.squatBottomAngle',
    min: 70,
    max: 120,
    step: 5,
  },
  PUSH_UP: {
    field: 'pushupBottomAngle',
    labelKey: 'calibration.pushupBottomAngle',
    min: 70,
    max: 115,
    step: 5,
  },
  PLANK: {
    field: 'plankMinBodyAngle',
    labelKey: 'calibration.plankMinBodyAngle',
    min: 145,
    max: 170,
    step: 5,
  },
  JUMPING_JACK: {
    field: 'jumpingJackPeakArmAngle',
    labelKey: 'calibration.jumpingJackPeakArmAngle',
    min: 115,
    max: 155,
    step: 5,
  },
  ARM_HOLD: {
    field: 'armHoldMinShoulderAngle',
    labelKey: 'calibration.armHoldMinShoulderAngle',
    min: 50,
    max: 85,
    step: 5,
  },
  WALL_SIT: {
    field: 'wallSitMaxKneeAngle',
    labelKey: 'calibration.wallSitMaxKneeAngle',
    min: 95,
    max: 135,
    step: 5,
  },
  OVERHEAD_PRESS: {
    field: 'overheadPressTopAngle',
    labelKey: 'calibration.overheadPressTopAngle',
    min: 140,
    max: 170,
    step: 5,
  },
};

const EXERCISE_FORM_KEYS: Record<ExerciseId, TranslationKey> = {
  SQUAT: 'calibration.formSquat',
  PUSH_UP: 'calibration.formPushup',
  PLANK: 'calibration.formPlank',
  JUMPING_JACK: 'calibration.formJumpingJack',
  ARM_HOLD: 'calibration.formArmHold',
  WALL_SIT: 'calibration.formWallSit',
  OVERHEAD_PRESS: 'calibration.formOverheadPress',
};

const PHASE_KEYS: Record<string, TranslationKey> = {
  IDLE: 'phase.IDLE',
  DOWN: 'phase.DOWN',
  UP: 'phase.UP',
  TRANSITION: 'phase.TRANSITION',
};

export function CalibrationSandbox({ onBack }: CalibrationSandboxProps) {
  const { t } = useTranslation();
  const cameraFacingMode = useGameStore((state) => state.settings.cameraFacingMode);
  const targetPoseFps = useGameStore((state) => state.settings.targetPoseFps);
  const poseDelegate = useGameStore((state) => state.settings.poseDelegate);
  const exerciseCalibration = useGameStore((state) => state.settings.exerciseCalibration);
  const updateExerciseCalibration = useGameStore((state) => state.updateExerciseCalibration);
  const resetExerciseCalibration = useGameStore((state) => state.resetExerciseCalibration);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<PoseTracker | null>(null);
  const detectorRef = useRef<ExerciseDetector | null>(null);
  const soundFXRef = useRef<SoundFX | null>(null);
  const soundEnabledRef = useRef(true);
  const lastRepCountRef = useRef(0);
  const lastPhaseRef = useRef<string>('IDLE');
  const lastVisibilityRef = useRef<string>('NOT_VISIBLE');
  const lastHoldingRef = useRef<boolean | undefined>(undefined);
  const lastUiSyncRef = useRef<number>(-Infinity);

  const [selectedExercise, setSelectedExercise] = useState<ExerciseId>('SQUAT');
  const [trackerStatus, setTrackerStatus] = useState<string>('IDLE');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectorState, setDetectorState] = useState<ExerciseState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeDelegate, setActiveDelegate] = useState<PoseDelegate>(poseDelegate);
  const [delegateFallback, setDelegateFallback] = useState(false);

  // Switch detector cleanly when user changes exercise
  useEffect(() => {
    const newDetector = createExerciseDetector(selectedExercise, exerciseCalibration);
    detectorRef.current = newDetector;
    lastRepCountRef.current = 0;
    lastPhaseRef.current = 'IDLE';
    setDetectorState(null);
  }, [selectedExercise]);

  // Apply updated angle threshold live without resetting camera or rep counter
  useEffect(() => {
    const detector = detectorRef.current;
    if (!detector) return;
    applyExerciseCalibration(detector, selectedExercise, exerciseCalibration);
  }, [selectedExercise, exerciseCalibration]);

  // Initialize camera & MediaPipe once on mount
  useEffect(() => {
    let disposed = false;

    const initSystem = async () => {
      try {
        const tracker = new PoseTracker(
          {
            facingMode: cameraFacingMode,
            width: 640,
            height: 480,
            frameRate: Math.max(30, targetPoseFps),
          },
          { delegate: poseDelegate, targetInferenceFPS: targetPoseFps }
        );
        const soundFX = new SoundFX({ volume: 0.7, enabled: true });

        trackerRef.current = tracker;
        soundFXRef.current = soundFX;
        if (!detectorRef.current) {
          detectorRef.current = createExerciseDetector(
            selectedExercise,
            useGameStore.getState().settings.exerciseCalibration
          );
        }

        tracker.onStatusChange((status) => {
          if (!disposed) {
            setTrackerStatus(status);
          }
        });

        tracker.onPose((landmarks, timestamp, worldLandmarks) => {
          const detector = detectorRef.current;
          if (!detector || disposed) return;

          const exerciseState = detector.update(landmarks, timestamp, worldLandmarks);

          const discreteChanged =
            exerciseState.repCount !== lastRepCountRef.current ||
            exerciseState.phase !== lastPhaseRef.current ||
            exerciseState.visibility !== lastVisibilityRef.current ||
            exerciseState.isHolding !== lastHoldingRef.current;

          if (discreteChanged || timestamp - lastUiSyncRef.current >= 75) {
            lastUiSyncRef.current = timestamp;
            lastVisibilityRef.current = exerciseState.visibility;
            lastHoldingRef.current = exerciseState.isHolding;
            setDetectorState(exerciseState);
          }

          if (!soundEnabledRef.current || !soundFXRef.current) return;

          if (exerciseState.repCount > lastRepCountRef.current) {
            soundFXRef.current.play('REP_COMPLETE');
            lastRepCountRef.current = exerciseState.repCount;
          }

          if (exerciseState.phase === 'TRANSITION' && lastPhaseRef.current !== 'TRANSITION') {
            soundFXRef.current.play('BOTTOM_HIT');
          }

          lastPhaseRef.current = exerciseState.phase;
        });

        await tracker.loadModel();
        if (disposed) return;

        if (videoRef.current) {
          await tracker.startCamera(videoRef.current);
        }
        if (disposed) return;

        await soundFX.init();
        if (canvasRef.current) {
          tracker.start(canvasRef.current);
        }

        if (!disposed) {
          setActiveDelegate(tracker.getActiveDelegate() ?? poseDelegate);
          setDelegateFallback(tracker.didFallbackToCpu());
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('Failed to initialize calibration:', err);
        if (!disposed) {
          setTrackerStatus('ERROR');
          const name = err instanceof Error ? err.name : '';
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            setCameraError(t('error.cameraPermission'));
          } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            setCameraError(t('error.cameraNotFound'));
          } else {
            setCameraError(err instanceof Error ? err.message : t('error.unknown'));
          }
        }
      }
    };

    void initSystem();

    return () => {
      disposed = true;
      trackerRef.current?.dispose();
      soundFXRef.current?.dispose();
    };
  }, [cameraFacingMode, targetPoseFps, poseDelegate]);

  const handleReset = () => {
    detectorRef.current?.reset();
    lastRepCountRef.current = 0;
    lastPhaseRef.current = 'IDLE';
    setDetectorState(null);
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
    soundFXRef.current?.configure({ enabled: next });
    if (next) {
      void soundFXRef.current?.init();
    }
  };

  useVoiceCommandHandler((cmd) => {
    if (cmd.type === 'SELECT_EXERCISE') {
      setSelectedExercise(cmd.exerciseId);
      return true;
    }
    if (cmd.type === 'RETRY') {
      handleReset();
      return true;
    }
    if (cmd.type === 'SOUND_UNLOCK' && !soundEnabled) {
      handleToggleSound();
      return true;
    }
    if (cmd.type === 'EXIT') {
      onBack?.();
      return true;
    }
    return false;
  });

  const getVisibilityHint = (visibility: VisibilityStatus): string => {
    switch (visibility) {
      case 'VISIBLE':
        return t('calibration.visible');
      case 'LOW_VISIBILITY':
        return t('calibration.lowVisibility');
      case 'NOT_VISIBLE':
      default:
        return t('calibration.notVisible');
    }
  };

  const primaryAngle =
    typeof detectorState?.debug?.kneeAngle === 'number'
      ? detectorState.debug.kneeAngle
      : typeof detectorState?.debug?.armAngle === 'number'
      ? detectorState.debug.armAngle
      : typeof detectorState?.debug?.elbowAngle === 'number'
      ? detectorState.debug.elbowAngle
      : typeof detectorState?.debug?.bodyAngle === 'number'
      ? detectorState.debug.bodyAngle
      : 0;

  const progress = Math.round((detectorState?.progress ?? 0) * 100);
  const repCount = detectorState?.repCount ?? 0;
  const phase = detectorState?.phase ?? 'IDLE';
  const visibility = detectorState?.visibility ?? 'NOT_VISIBLE';
  const isHoldExercise = EXERCISES[selectedExercise].trackingType === 'hold';
  const holdSeconds = Math.floor((detectorState?.holdDurationMs ?? 0) / 1000);

  const thresholdDesc = EXERCISE_THRESHOLD_DESCRIPTORS[selectedExercise];
  const currentThresholdValue = exerciseCalibration[thresholdDesc.field];

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          {onBack ? (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('menu.back')}</span>
            </button>
          ) : (
            <div className="w-24" />
          )}

          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            {t('calibration.title')}
          </h1>

          <div className="w-24" aria-hidden="true" />
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-6">
        {/* Exercise Segmented Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-400">{t('calibration.instructions')}</p>

          <div className="inline-flex flex-wrap p-1 bg-slate-900 border border-slate-800 rounded-lg gap-1">
            {(Object.keys(EXERCISES) as ExerciseId[]).map((exId) => (
              <button
                key={exId}
                onClick={() => setSelectedExercise(exId)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  selectedExercise === exId
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t(EXERCISE_NAME_KEYS[exId])}
              </button>
            ))}
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Video Canvas */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="relative aspect-video bg-black">
              <video ref={videoRef} className="hidden" playsInline muted autoPlay />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain" />

              {!isInitialized && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 p-6">
                  {trackerStatus === 'ERROR' ? (
                    <div className="text-center space-y-2.5 max-w-sm">
                      <AlertTriangle className="w-9 h-9 text-amber-400 mx-auto" />
                      <p className="text-sm font-medium text-slate-200">
                        {cameraError ?? t('error.cameraNotFound')}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-sm text-slate-200">{t('battle.starting')}</p>
                    </div>
                  )}
                </div>
              )}

              {isInitialized && (
                <div className="absolute bottom-3 left-3 bg-slate-950/85 border border-slate-800 px-2.5 py-1 rounded-md text-[11px] font-numeric">
                  <span
                    className={
                      delegateFallback
                        ? 'text-amber-400 font-semibold'
                        : activeDelegate === 'GPU'
                          ? 'text-emerald-400 font-semibold'
                          : 'text-sky-400 font-semibold'
                    }
                  >
                    {delegateFallback ? t('battle.delegateFallback') : activeDelegate}
                  </span>
                </div>
              )}

              {isInitialized && visibility !== 'VISIBLE' && (
                <div className="absolute top-4 left-4 right-4 bg-amber-500/95 text-slate-950 px-4 py-2 rounded-lg text-center text-sm font-semibold">
                  {getVisibilityHint(visibility)}
                </div>
              )}
            </div>
          </div>

          {/* Metrics & Calibration Column */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">
                  {isHoldExercise ? t('battle.holdTime') : t('battle.reps')}
                </div>
                <div className="font-numeric text-4xl font-bold text-white mt-1">
                  {isHoldExercise ? `${holdSeconds}s` : repCount}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">{t('battle.phase')}</div>
                <div className="text-sm font-semibold text-amber-400 mt-1">
                  {t(PHASE_KEYS[phase] ?? 'phase.IDLE')}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{t('calibration.depthOrHold')}</span>
                <span className="font-numeric text-slate-200">{progress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-[width] duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs pt-2 border-t border-slate-800">
                <span className="text-slate-400">{t('calibration.angleLabel')}</span>
                <span className="font-numeric font-semibold text-white">
                  {Math.round(primaryAngle)}°
                </span>
              </div>
            </div>

            {/* Per-Exercise Threshold Calibration Slider */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200 min-w-0">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{t('calibration.thresholdsTitle')}</span>
                </div>
                <button
                  type="button"
                  onClick={resetExerciseCalibration}
                  className="text-xs text-slate-400 hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
                >
                  {t('calibration.resetDefaults')}
                </button>
              </div>

              <div>
                <div className="flex justify-between items-baseline text-xs mb-2 gap-2">
                  <label htmlFor="threshold-slider" className="text-slate-400">
                    {t(thresholdDesc.labelKey)}
                  </label>
                  <span className="font-numeric font-bold text-amber-400 shrink-0">
                    {currentThresholdValue}°
                  </span>
                </div>
                <input
                  id="threshold-slider"
                  type="range"
                  min={thresholdDesc.min}
                  max={thresholdDesc.max}
                  step={thresholdDesc.step}
                  value={currentThresholdValue}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    updateExerciseCalibration({ [thresholdDesc.field]: value });
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between font-numeric text-[11px] text-slate-500 mt-1">
                  <span>{thresholdDesc.min}°</span>
                  <span>{thresholdDesc.max}°</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleReset}
                disabled={!isInitialized}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t('calibration.reset')}</span>
              </button>

              <button
                onClick={handleToggleSound}
                disabled={!isInitialized}
                className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 font-semibold text-sm rounded-lg transition-colors ${
                  soundEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span>{soundEnabled ? t('calibration.soundOn') : t('calibration.soundOff')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-300">
          <div>
            <h2 className="font-semibold text-white mb-2">{t('calibration.setupTitle')}</h2>
            <ul className="space-y-1 list-disc list-inside text-slate-400">
              <li>{t('calibration.setup1')}</li>
              <li>{t('calibration.setup2')}</li>
              <li>{t('calibration.setup3')}</li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold text-white mb-2">{t('calibration.formTitle')}</h2>
            <p className="text-slate-400">{t(EXERCISE_FORM_KEYS[selectedExercise])}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
