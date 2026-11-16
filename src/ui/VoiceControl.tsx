/**
 * VoiceControl - React Context, hook, floating command feedback toast,
 * and toggle button connecting VoiceCommandEngine across all game screens.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Mic, MicOff } from 'lucide-react';
import {
  VoiceCommandEngine,
  type VoiceCommand,
  type VoiceCommandMatch,
  type VoiceEngineSnapshot,
} from '../audio/VoiceCommandEngine';
import { useGameStore } from '../game/store';
import { useTranslation } from '../i18n/useTranslation';

export type VoiceCommandHandler = (command: VoiceCommand, match: VoiceCommandMatch) => boolean | void;

interface RegisteredHandler {
  id: number;
  handler: VoiceCommandHandler;
}

interface VoiceControlContextValue {
  snapshot: VoiceEngineSnapshot;
  enabled: boolean;
  toggleVoiceControl: () => void;
  registerHandler: (handler: VoiceCommandHandler) => () => void;
}

const VoiceControlContext = createContext<VoiceControlContextValue | null>(null);

export function VoiceControlProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const enabled = useGameStore((state) => state.settings.voiceControlEnabled);
  const language = useGameStore((state) => state.settings.language);
  const updateSettings = useGameStore((state) => state.updateSettings);

  const engineRef = useRef<VoiceCommandEngine | null>(null);
  const handlersRef = useRef<RegisteredHandler[]>([]);
  const nextHandlerIdRef = useRef<number>(1);
  const toastTimerRef = useRef<number | null>(null);

  const [snapshot, setSnapshot] = useState<VoiceEngineSnapshot>(() => ({
    supported: VoiceCommandEngine.isSupported(),
    status: VoiceCommandEngine.isSupported() ? 'OFF' : 'UNSUPPORTED',
    errorCode: null,
    lastTranscript: '',
    lastMatch: null,
  }));

  const [toastText, setToastText] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'ok' | 'error'>('ok');

  const showToast = useCallback((text: string, tone: 'ok' | 'error' = 'ok', durationMs = 2400) => {
    setToastText(text);
    setToastTone(tone);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastText(null);
      toastTimerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    const engine = new VoiceCommandEngine({ language });
    engineRef.current = engine;

    const unsubState = engine.onStateChange((next) => {
      setSnapshot(next);
      if (next.status === 'ERROR') {
        updateSettings({ voiceControlEnabled: false });
        if (next.errorCode === 'NOT_ALLOWED') {
          showToast(t('voiceCtrl.errorNotAllowed'), 'error', 4000);
        } else if (next.errorCode === 'NO_MIC') {
          showToast(t('voiceCtrl.errorNoMic'), 'error', 4000);
        }
      }
    });

    const unsubCmd = engine.onCommand((match) => {
      showToast(`${t('voiceCtrl.heardPrefix')}: «${match.matchedPhrase}»`, 'ok', 2200);
      // Dispatch from most recently mounted screen down to root App handler.
      const stack = handlersRef.current;
      for (let i = stack.length - 1; i >= 0; i--) {
        const handled = stack[i]?.handler(match.command, match);
        if (handled === true) {
          break;
        }
      }
    });

    return () => {
      unsubState();
      unsubCmd();
      engine.dispose();
      engineRef.current = null;
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setLanguage(language);
  }, [language]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (enabled) {
      engine.start();
    } else {
      engine.stop();
    }
  }, [enabled]);

  const toggleVoiceControl = useCallback(() => {
    if (!VoiceCommandEngine.isSupported()) {
      showToast(t('voiceCtrl.unsupported'), 'error', 3500);
      return;
    }
    const current = useGameStore.getState().settings.voiceControlEnabled;
    updateSettings({ voiceControlEnabled: !current });
  }, [showToast, t, updateSettings]);

  const registerHandler = useCallback((handler: VoiceCommandHandler) => {
    const id = nextHandlerIdRef.current++;
    handlersRef.current = [...handlersRef.current, { id, handler }];
    return () => {
      handlersRef.current = handlersRef.current.filter((entry) => entry.id !== id);
    };
  }, []);

  const value = useMemo<VoiceControlContextValue>(
    () => ({
      snapshot,
      enabled,
      toggleVoiceControl,
      registerHandler,
    }),
    [snapshot, enabled, toggleVoiceControl, registerHandler]
  );

  return (
    <VoiceControlContext.Provider value={value}>
      {children}

      {toastText && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 z-[60] pointer-events-none inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-semibold shadow-lg ${
            toastTone === 'error'
              ? 'bg-red-950/95 border-red-700 text-red-200'
              : 'bg-slate-900/95 border-emerald-500/70 text-emerald-200'
          }`}
        >
          <Mic className="w-3.5 h-3.5 shrink-0" />
          <span>{toastText}</span>
        </div>
      )}
    </VoiceControlContext.Provider>
  );
}

export function useVoiceControl(): VoiceControlContextValue {
  const ctx = useContext(VoiceControlContext);
  if (!ctx) {
    throw new Error('useVoiceControl must be used within VoiceControlProvider');
  }
  return ctx;
}

/**
 * Subscribe the currently active screen/component to voice commands.
 * Uses a ref internally so callers don't need to memoize the callback.
 */
export function useVoiceCommandHandler(handler: VoiceCommandHandler): void {
  const { registerHandler } = useVoiceControl();
  const handlerRef = useRef<VoiceCommandHandler>(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return registerHandler((cmd, match) => handlerRef.current(cmd, match));
  }, [registerHandler]);
}

export function VoiceToggleButton({
  compact = false,
  className = '',
}: {
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const { snapshot, enabled, toggleVoiceControl } = useVoiceControl();

  if (!snapshot.supported) {
    return null;
  }

  const isListening = enabled && snapshot.status === 'LISTENING';

  return (
    <button
      type="button"
      onClick={toggleVoiceControl}
      title={enabled ? t('voiceCtrl.listening') : t('voiceCtrl.label')}
      aria-pressed={enabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
        isListening
          ? 'bg-emerald-500/20 border-emerald-500/70 text-emerald-300 hover:bg-emerald-500/30'
          : enabled
            ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
            : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
      } ${compact ? 'px-2.5 py-2' : 'px-3.5 py-2.5'} ${className}`}
    >
      {enabled ? (
        <Mic className={`w-4 h-4 shrink-0 ${isListening ? 'animate-pulse' : ''}`} />
      ) : (
        <MicOff className="w-4 h-4 shrink-0" />
      )}
      {!compact && (
        <span>{enabled ? t('voiceCtrl.listening') : t('voiceCtrl.off')}</span>
      )}
      {compact && (
        <span className="hidden sm:inline">
          {enabled ? t('voiceCtrl.listening') : t('voiceCtrl.shortLabel')}
        </span>
      )}
    </button>
  );
}
