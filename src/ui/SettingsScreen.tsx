/**
 * SettingsScreen - Language switcher, audio/voice toggles, camera selector,
 * scripted pose driver toggle, JSON save export/import, and in-app reset modal.
 */

import { useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, Cpu, Download, Mic, Sparkles, Trash2, Upload } from 'lucide-react';
import { exportSaveToJson, parseAndValidateSaveJson } from '../game/portability';
import { SAVE_SCHEMA_VERSION, migrateGameState, useGameStore } from '../game/store';
import { AVAILABLE_LANGUAGES } from '../i18n';
import { useTranslation } from '../i18n/useTranslation';
import { useVoiceControl } from './VoiceControl';

interface SettingsScreenProps {
  onBack: () => void;
  onOpenCalibration: () => void;
}

export function SettingsScreen({ onBack, onOpenCalibration }: SettingsScreenProps) {
  const { t, language, setLanguage } = useTranslation();
  const settings = useGameStore((state) => state.settings);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const importGameState = useGameStore((state) => state.importGameState);
  const resetGame = useGameStore((state) => state.resetGame);
  const { snapshot: voiceSnapshot, toggleVoiceControl } = useVoiceControl();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [portabilityStatus, setPortabilityStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const handleConfirmReset = () => {
    resetGame();
    setShowResetConfirm(false);
  };

  const handleExportSave = () => {
    const json = exportSaveToJson(useGameStore.getState(), SAVE_SCHEMA_VERSION);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'junk-slayer-save.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const result = parseAndValidateSaveJson(text, migrateGameState);
      if (!result.ok) {
        setPortabilityStatus({ ok: false, message: t('settings.importError') });
        return;
      }
      importGameState(result.state);
      setPortabilityStatus({ ok: true, message: t('settings.importSuccess') });
    } catch {
      setPortabilityStatus({ ok: false, message: t('settings.importError') });
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('settings.back')}</span>
          </button>

          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            {t('settings.title')}
          </h1>

          <div className="w-20" aria-hidden="true" />
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 space-y-6">
        <p className="text-sm text-slate-400">{t('settings.subtitle')}</p>

        <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
          {/* Language */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="text-sm font-semibold text-white">{t('settings.language')}</span>
            <div className="inline-flex p-1 bg-slate-950 rounded-lg border border-slate-800">
              {AVAILABLE_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    language === lang.code
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>

          {/* Sound FX */}
          <div className="p-5 flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-white">{t('settings.audio')}</span>
            <button
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                settings.soundEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {settings.soundEnabled ? t('settings.audioOn') : t('settings.audioOff')}
            </button>
          </div>

          {/* Voice Cues */}
          <div className="p-5 flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-white">{t('settings.voice')}</span>
            <button
              onClick={() => updateSettings({ voiceEnabled: !settings.voiceEnabled })}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                settings.voiceEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {settings.voiceEnabled ? t('settings.audioOn') : t('settings.audioOff')}
            </button>
          </div>

          {/* Hands-Free Voice Control */}
          <div className="p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                  <Mic className="w-4 h-4 text-emerald-400" />
                  <span>{t('voiceCtrl.label')}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{t('voiceCtrl.desc')}</p>
              </div>
              {voiceSnapshot.supported ? (
                <button
                  onClick={toggleVoiceControl}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    settings.voiceControlEnabled
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {settings.voiceControlEnabled ? t('settings.audioOn') : t('settings.audioOff')}
                </button>
              ) : (
                <span className="text-xs text-amber-400">{t('voiceCtrl.unsupported')}</span>
              )}
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-1 text-xs text-slate-300">
              <div className="font-semibold text-slate-200 mb-1.5">
                {t('voiceCtrl.commandsTitle')}
              </div>
              <div>{t('voiceCtrl.cmdBattle')}</div>
              <div>{t('voiceCtrl.cmdNav')}</div>
              <div>{t('voiceCtrl.cmdExercises')}</div>
              <div>{t('voiceCtrl.cmdLoadout')}</div>
            </div>
          </div>

          {/* Camera Facing Mode */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="text-sm font-semibold text-white">{t('settings.camera')}</span>
            <div className="inline-flex p-1 bg-slate-950 rounded-lg border border-slate-800">
              <button
                onClick={() => updateSettings({ cameraFacingMode: 'user' })}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  settings.cameraFacingMode === 'user'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('settings.cameraFront')}
              </button>
              <button
                onClick={() => updateSettings({ cameraFacingMode: 'environment' })}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  settings.cameraFacingMode === 'environment'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('settings.cameraBack')}
              </button>
            </div>
          </div>

          {/* Scripted Pose Driver (Camera-Free Demo / Testing) */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{t('settings.scriptedPose')}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t('settings.scriptedPoseDesc')}</p>
            </div>
            <button
              onClick={() =>
                updateSettings({ scriptedPoseEnabled: !settings.scriptedPoseEnabled })
              }
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center ${
                settings.scriptedPoseEnabled
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {settings.scriptedPoseEnabled ? t('settings.audioOn') : t('settings.audioOff')}
            </button>
          </div>

          {/* Pose Detection Target FPS */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="text-sm font-semibold text-white">{t('settings.poseFps')}</span>
            <div className="inline-flex p-1 bg-slate-950 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => updateSettings({ targetPoseFps: 15 })}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  settings.targetPoseFps === 15
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('settings.poseFps15')}
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ targetPoseFps: 30 })}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  settings.targetPoseFps === 30
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('settings.poseFps30')}
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ targetPoseFps: 60 })}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  settings.targetPoseFps === 60
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('settings.poseFps60')}
              </button>
            </div>
          </div>

          {/* Neural Network Compute Delegate (GPU / CPU) */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{t('settings.poseDelegate')}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t('settings.poseDelegateDesc')}</p>
            </div>
            <div className="inline-flex p-1 bg-slate-950 rounded-lg border border-slate-800 shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={() => updateSettings({ poseDelegate: 'GPU' })}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  settings.poseDelegate === 'GPU'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('settings.poseDelegateGpu')}
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ poseDelegate: 'CPU' })}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  settings.poseDelegate === 'CPU'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('settings.poseDelegateCpu')}
              </button>
            </div>
          </div>

          {/* Save Export & Import (JSON) */}
          <div className="p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">
                  {t('settings.portabilityTitle')}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('settings.portabilityDesc')}
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleExportSave}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('settings.exportSave')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t('settings.importSave')}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </div>
            </div>
            {portabilityStatus && (
              <div
                className={`text-xs font-medium px-3 py-2 rounded-lg border ${
                  portabilityStatus.ok
                    ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300'
                    : 'bg-red-950/50 border-red-700/60 text-red-300'
                }`}
              >
                {portabilityStatus.message}
              </div>
            )}
          </div>

          {/* Calibration Shortcut */}
          <div className="p-5 flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-white">{t('menu.calibration')}</span>
            <button
              onClick={onOpenCalibration}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors whitespace-nowrap"
            >
              {t('settings.cameraTest')}
            </button>
          </div>
        </div>

        {/* Danger Zone: Reset Save */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-red-400">{t('settings.resetProgress')}</span>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-700/60 transition-colors whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t('settings.resetProgress')}</span>
          </button>
        </div>
      </main>

      {/* In-app Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold text-white">{t('settings.resetConfirmTitle')}</h2>
            <p className="text-sm text-slate-300">{t('settings.resetConfirm')}</p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap"
              >
                {t('settings.cancel')}
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors whitespace-nowrap"
              >
                {t('settings.resetConfirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
