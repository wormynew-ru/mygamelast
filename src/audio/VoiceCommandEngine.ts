/**
 * VoiceCommandEngine: Pure client-side Web Speech API (SpeechRecognition)
 * hands-free command parser and recognizer for Junk Slayer.
 *
 * ZERO dependencies on React, Zustand, or game/vision layers.
 */

import type { ExerciseId } from '../game/data/exercises';
import type { CircuitId } from '../game/data/circuits';

export type VoiceAnalyticsPeriod = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL';
export type VoiceAnalyticsMetric = 'VOLUME' | 'KCAL' | 'TONNAGE';

export type VoiceCommand =
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'NEXT' }
  | { type: 'RETRY' }
  | { type: 'EXIT' }
  | { type: 'SOUND_UNLOCK' }
  | { type: 'START_FIGHT' }
  | { type: 'NAV_CAMPAIGN' }
  | { type: 'NAV_ENDLESS' }
  | { type: 'NAV_CIRCUIT' }
  | { type: 'NAV_TABATA' }
  | { type: 'START_BENCHMARK' }
  | { type: 'NAV_INVENTORY' }
  | { type: 'NAV_BESTIARY' }
  | { type: 'NAV_CALIBRATION' }
  | { type: 'NAV_SETTINGS' }
  | { type: 'NAV_GARDEN' }
  | { type: 'NAV_SANCTUARY' }
  | { type: 'NAV_TALENTS' }
  | { type: 'GARDEN_WATER' }
  | { type: 'GARDEN_HARVEST' }
  | { type: 'GARDEN_WEED' }
  | { type: 'SELECT_EXERCISE'; exerciseId: ExerciseId }
  | { type: 'START_CIRCUIT'; circuitId: CircuitId }
  | { type: 'SET_LOADOUT'; weightKg: number | null }
  | { type: 'ANALYTICS_PERIOD'; period: VoiceAnalyticsPeriod }
  | { type: 'ANALYTICS_METRIC'; metric: VoiceAnalyticsMetric };

export interface VoiceCommandMatch {
  command: VoiceCommand;
  matchedPhrase: string;
  transcript: string;
}

export type VoiceEngineStatus = 'OFF' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED';
export type VoiceErrorCode = 'NOT_ALLOWED' | 'NO_MIC' | 'UNSUPPORTED' | 'OTHER' | null;

export interface VoiceEngineSnapshot {
  supported: boolean;
  status: VoiceEngineStatus;
  errorCode: VoiceErrorCode;
  lastTranscript: string;
  lastMatch: VoiceCommandMatch | null;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface WindowWithSpeechRecognition {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

const WEIGHT_PRESETS = [1, 2, 3, 5, 7.5, 10, 12.5, 15] as const;

export function snapToDumbbellPreset(rawWeight: number): number {
  let closest: number = WEIGHT_PRESETS[0];
  let bestDiff = Math.abs(rawWeight - closest);
  for (const preset of WEIGHT_PRESETS) {
    const diff = Math.abs(rawWeight - preset);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = preset;
    }
  }
  return closest;
}

function normalizeTranscript(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9.,\s-]/gi, ' ')
    .replace(/[-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsWholePhrase(normalized: string, phrase: string): boolean {
  if (!normalized || !phrase) return false;
  if (normalized === phrase) return true;
  return ` ${normalized} `.includes(` ${phrase} `);
}

interface PhraseRule {
  phrases: readonly string[];
  build: () => VoiceCommand;
}

// Ordered from most specific multi-word phrases down to concise single-word triggers.
const PHRASE_RULES: readonly PhraseRule[] = [
  // Multi-word loadout reset
  {
    phrases: ['без веса', 'свой вес', 'без гантелей', 'пустые руки', 'bodyweight', 'no weight'],
    build: () => ({ type: 'SET_LOADOUT', weightKg: 0 }),
  },
  // Circuit presets
  {
    phrases: ['стальной верх', 'upper iron', 'upper body iron'],
    build: () => ({ type: 'START_CIRCUIT', circuitId: 'UPPER_IRON' }),
  },
  {
    phrases: ['испытание статики', 'static gauntlet', 'static endurance'],
    build: () => ({ type: 'START_CIRCUIT', circuitId: 'STATIC_GAUNTLET' }),
  },
  {
    phrases: ['полный круг', 'босс раш', 'boss rush', 'full body blitz'],
    build: () => ({ type: 'START_CIRCUIT', circuitId: 'FULL_BODY_BLITZ' }),
  },
  // Specific multi-word exercises
  {
    phrases: ['жим над головой', 'армейский жим', 'над головой', 'overhead press', 'shoulder press'],
    build: () => ({ type: 'SELECT_EXERCISE', exerciseId: 'OVERHEAD_PRESS' }),
  },
  {
    phrases: ['стульчик у стены', 'у стены', 'стульчик', 'wall sit'],
    build: () => ({ type: 'SELECT_EXERCISE', exerciseId: 'WALL_SIT' }),
  },
  {
    phrases: ['удержание рук', 'держать руки', 'руки в стороны', 'руки прямо', 'разводка', 'arm hold', 't pose'],
    build: () => ({ type: 'SELECT_EXERCISE', exerciseId: 'ARM_HOLD' }),
  },
  {
    phrases: ['джампинг джек', 'джампинг джекс', 'джампинг', 'jumping jack', 'jumping jacks', 'прыжки'],
    build: () => ({ type: 'SELECT_EXERCISE', exerciseId: 'JUMPING_JACK' }),
  },
  {
    phrases: ['отжимания', 'отжиматься', 'отжимание', 'push up', 'push ups', 'pushup', 'pushups'],
    build: () => ({ type: 'SELECT_EXERCISE', exerciseId: 'PUSH_UP' }),
  },
  {
    phrases: ['приседания', 'приседать', 'приседание', 'присед', 'squat', 'squats'],
    build: () => ({ type: 'SELECT_EXERCISE', exerciseId: 'SQUAT' }),
  },
  {
    phrases: ['планка', 'планку', 'plank'],
    build: () => ({ type: 'SELECT_EXERCISE', exerciseId: 'PLANK' }),
  },
  {
    phrases: ['высокое поднимание бедра', 'поднимание бедра', 'бег на месте', 'high knees', 'high knee'],
    build: () => ({ type: 'SELECT_EXERCISE', exerciseId: 'HIGH_KNEES' }),
  },
  {
    phrases: ['подъем рук вперед', 'подъемы вперед', 'махи вперед', 'front raise', 'front raises'],
    build: () => ({ type: 'SELECT_EXERCISE', exerciseId: 'FRONT_RAISE' }),
  },
  {
    phrases: ['выпады', 'выпад', 'lunge', 'lunges'],
    build: () => ({ type: 'SELECT_EXERCISE', exerciseId: 'LUNGE' }),
  },
  {
    phrases: ['жим'],
    build: () => ({ type: 'SELECT_EXERCISE', exerciseId: 'OVERHEAD_PRESS' }),
  },
  // Analytics periods & metrics
  {
    phrases: ['все время', 'за все время', 'all time'],
    build: () => ({ type: 'ANALYTICS_PERIOD', period: 'ALL' }),
  },
  {
    phrases: ['7 дней', 'семь дней', 'неделя', 'за неделю', 'week', '7 days'],
    build: () => ({ type: 'ANALYTICS_PERIOD', period: 'WEEK' }),
  },
  {
    phrases: ['сегодня', 'за сегодня', 'today'],
    build: () => ({ type: 'ANALYTICS_PERIOD', period: 'TODAY' }),
  },
  {
    phrases: ['месяц', 'за месяц', 'month'],
    build: () => ({ type: 'ANALYTICS_PERIOD', period: 'MONTH' }),
  },
  {
    phrases: ['год', 'за год', 'year'],
    build: () => ({ type: 'ANALYTICS_PERIOD', period: 'YEAR' }),
  },
  {
    phrases: ['калории', 'ккал', 'calories', 'kcal'],
    build: () => ({ type: 'ANALYTICS_METRIC', metric: 'KCAL' }),
  },
  {
    phrases: ['тоннаж', 'tonnage'],
    build: () => ({ type: 'ANALYTICS_METRIC', metric: 'TONNAGE' }),
  },
  {
    phrases: ['объем', 'volume'],
    build: () => ({ type: 'ANALYTICS_METRIC', metric: 'VOLUME' }),
  },
  // Multi-word navigation / actions
  {
    phrases: ['быстрый бой', 'в бой', 'quick battle', 'start fight', 'start battle'],
    build: () => ({ type: 'START_FIGHT' }),
  },
  {
    phrases: ['включи звук', 'включить звук', 'enable sound', 'sound'],
    build: () => ({ type: 'SOUND_UNLOCK' }),
  },
  {
    phrases: ['бесконечная арена', 'выживание', 'endless arena', 'endless', 'арена', 'арену', 'arena'],
    build: () => ({ type: 'NAV_ENDLESS' }),
  },
  {
    phrases: ['круговой данж', 'круговая тренировка', 'круговая', 'круговой', 'данж', 'круг', 'circuit', 'dungeon'],
    build: () => ({ type: 'NAV_CIRCUIT' }),
  },
  {
    phrases: ['табата', 'интервалы', 'интервальная', 'tabata', 'hiit'],
    build: () => ({ type: 'NAV_TABATA' }),
  },
  {
    phrases: ['фитнес тест', 'бенчмарк', 'тест 60 секунд', 'fitness test', 'benchmark'],
    build: () => ({ type: 'START_BENCHMARK' }),
  },
  {
    phrases: ['выбрать уровень', 'выбор уровня', 'кампания', 'кампанию', 'уровни', 'campaign', 'levels'],
    build: () => ({ type: 'NAV_CAMPAIGN' }),
  },
  {
    phrases: ['тест камеры', 'калибровка', 'калибровку', 'calibration', 'calibrate'],
    build: () => ({ type: 'NAV_CALIBRATION' }),
  },
  {
    phrases: ['инвентарь', 'магазин', 'сумка', 'снаряжение', 'inventory', 'shop', 'bag'],
    build: () => ({ type: 'NAV_INVENTORY' }),
  },
  {
    phrases: ['бестиарий', 'статистика', 'статистику', 'отчет', 'аналитика', 'bestiary', 'stats', 'statistics', 'analytics'],
    build: () => ({ type: 'NAV_BESTIARY' }),
  },
  {
    phrases: ['личный сад', 'мой сад', 'огород', 'сад', 'грядки', 'грядка', 'my garden', 'garden'],
    build: () => ({ type: 'NAV_GARDEN' }),
  },
  {
    phrases: ['убежище', 'фито лаборатория', 'миксы', 'mix lab', 'sanctuary', 'hideout'],
    build: () => ({ type: 'NAV_SANCTUARY' }),
  },
  {
    phrases: ['дерево талантов', 'таланты', 'навыки', 'talent tree', 'talents', 'skills'],
    build: () => ({ type: 'NAV_TALENTS' }),
  },
  {
    phrases: ['полить все', 'полить сад', 'полить', 'полив', 'лейка', 'water garden', 'water all', 'water'],
    build: () => ({ type: 'GARDEN_WATER' }),
  },
  {
    phrases: ['собрать урожай', 'собрать все', 'собрать', 'урожай', 'harvest all', 'harvest'],
    build: () => ({ type: 'GARDEN_HARVEST' }),
  },
  {
    phrases: ['битва с сорняками', 'прополоть', 'сорняки', 'сорняк', 'clear weeds', 'fight weed', 'weed'],
    build: () => ({ type: 'GARDEN_WEED' }),
  },
  {
    phrases: ['настройки', 'параметры', 'settings'],
    build: () => ({ type: 'NAV_SETTINGS' }),
  },
  // Core battle control triggers
  {
    phrases: ['пауза', 'паузу', 'стоп', 'останови', 'остановить', 'подожди', 'pause', 'stop', 'wait'],
    build: () => ({ type: 'PAUSE' }),
  },
  {
    phrases: ['продолжить', 'продолжай', 'возобновить', 'снять паузу', 'resume', 'continue'],
    build: () => ({ type: 'RESUME' }),
  },
  {
    phrases: ['следующий', 'следующее', 'следующая', 'дальше', 'далее', 'вперед', 'пропустить', 'next', 'skip', 'advance'],
    build: () => ({ type: 'NEXT' }),
  },
  {
    phrases: ['заново', 'повтор', 'повторить', 'реванш', 'еще раз', 'сначала', 'retry', 'again', 'restart', 'rematch'],
    build: () => ({ type: 'RETRY' }),
  },
  {
    phrases: ['в меню', 'выход', 'выйти', 'сдаться', 'назад', 'меню', 'домой', 'exit', 'quit', 'surrender', 'menu', 'back'],
    build: () => ({ type: 'EXIT' }),
  },
  {
    phrases: ['начать', 'начинай', 'поехали', 'старт', 'играть', 'бой', 'атака', 'fight', 'battle', 'start', 'play'],
    build: () => ({ type: 'START_FIGHT' }),
  },
  {
    phrases: ['звук'],
    build: () => ({ type: 'SOUND_UNLOCK' }),
  },
];

const DUMBBELL_WEIGHT_REGEX =
  /(?:^|\s)(?:гантел\w*|вес|нагрузк\w*|dumbbell\w*)\s+(\d+(?:[.,]\d+)?)(?:\s*(?:кг|килограмм\w*|kg))?(?:\s|$)|(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:кг|килограмм\w*|kg)(?:\s|$)/;

/**
 * Pure parser mapping recognized speech transcripts into structured VoiceCommand objects.
 */
export function parseVoiceCommand(rawTranscript: string): VoiceCommandMatch | null {
  const normalized = normalizeTranscript(rawTranscript);
  if (!normalized) return null;

  // Check explicit weight command first (e.g. "гантели 5 кг", "7.5 kg", "гантели 3")
  const weightMatch = DUMBBELL_WEIGHT_REGEX.exec(normalized);
  if (weightMatch) {
    const numStr = (weightMatch[1] ?? weightMatch[2] ?? '').replace(',', '.');
    const parsedNum = Number.parseFloat(numStr);
    if (Number.isFinite(parsedNum) && parsedNum >= 0 && parsedNum <= 40) {
      const weightKg = parsedNum === 0 ? 0 : snapToDumbbellPreset(parsedNum);
      return {
        command: { type: 'SET_LOADOUT', weightKg },
        matchedPhrase: weightMatch[0].trim(),
        transcript: rawTranscript.trim(),
      };
    }
  }

  for (const rule of PHRASE_RULES) {
    for (const phrase of rule.phrases) {
      if (containsWholePhrase(normalized, phrase)) {
        return {
          command: rule.build(),
          matchedPhrase: phrase,
          transcript: rawTranscript.trim(),
        };
      }
    }
  }

  if (
    containsWholePhrase(normalized, 'гантели') ||
    containsWholePhrase(normalized, 'с гантелями') ||
    containsWholePhrase(normalized, 'dumbbells') ||
    containsWholePhrase(normalized, 'dumbbell')
  ) {
    return {
      command: { type: 'SET_LOADOUT', weightKg: null },
      matchedPhrase: normalized,
      transcript: rawTranscript.trim(),
    };
  }

  return null;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as WindowWithSpeechRecognition;
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export class VoiceCommandEngine {
  private recognition: SpeechRecognitionLike | null = null;
  private language: 'ru' | 'en';
  private enabled = false;
  private disposed = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  private status: VoiceEngineStatus;
  private errorCode: VoiceErrorCode = null;
  private lastTranscript = '';
  private lastMatch: VoiceCommandMatch | null = null;

  private lastDispatchedByKey = new Map<string, number>();
  private stateListeners = new Set<(snapshot: VoiceEngineSnapshot) => void>();
  private commandListeners = new Set<(match: VoiceCommandMatch) => void>();

  private readonly cooldownMs: number;

  constructor(options: { language?: 'ru' | 'en'; cooldownMs?: number } = {}) {
    this.language = options.language ?? 'ru';
    this.cooldownMs = options.cooldownMs ?? 1300;
    this.status = VoiceCommandEngine.isSupported() ? 'OFF' : 'UNSUPPORTED';
  }

  static isSupported(): boolean {
    return getSpeechRecognitionCtor() !== null;
  }

  getSnapshot(): VoiceEngineSnapshot {
    return {
      supported: VoiceCommandEngine.isSupported(),
      status: this.status,
      errorCode: this.errorCode,
      lastTranscript: this.lastTranscript,
      lastMatch: this.lastMatch,
    };
  }

  onStateChange(cb: (snapshot: VoiceEngineSnapshot) => void): () => void {
    this.stateListeners.add(cb);
    cb(this.getSnapshot());
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  onCommand(cb: (match: VoiceCommandMatch) => void): () => void {
    this.commandListeners.add(cb);
    return () => {
      this.commandListeners.delete(cb);
    };
  }

  setLanguage(language: 'ru' | 'en'): void {
    if (this.language === language) return;
    this.language = language;
    if (this.enabled && this.recognition) {
      // Restart recognizer to apply updated BCP-47 speech locale cleanly.
      this.stopRecognitionInstance();
      this.scheduleRestart(120);
    }
  }

  start(): void {
    if (this.disposed) return;
    if (!VoiceCommandEngine.isSupported()) {
      this.status = 'UNSUPPORTED';
      this.errorCode = 'UNSUPPORTED';
      this.emitState();
      return;
    }

    this.enabled = true;
    this.errorCode = null;
    this.startRecognitionInstance();
  }

  stop(): void {
    this.enabled = false;
    this.clearRestartTimer();
    this.stopRecognitionInstance();
    this.status = VoiceCommandEngine.isSupported() ? 'OFF' : 'UNSUPPORTED';
    this.emitState();
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.stateListeners.clear();
    this.commandListeners.clear();
  }

  private clearRestartTimer(): void {
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private scheduleRestart(delayMs: number): void {
    this.clearRestartTimer();
    if (!this.enabled || this.disposed) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.enabled && !this.disposed) {
        this.startRecognitionInstance();
      }
    }, delayMs);
  }

  private stopRecognitionInstance(): void {
    if (!this.recognition) return;
    const rec = this.recognition;
    this.recognition = null;
    rec.onstart = null;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.stop();
    } catch {
      // Ignore already-stopped errors
    }
  }

  private startRecognitionInstance(): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || this.recognition || !this.enabled || this.disposed) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 2;
    rec.lang = this.language === 'ru' ? 'ru-RU' : 'en-US';

    rec.onstart = () => {
      if (!this.enabled || this.disposed) return;
      this.status = 'LISTENING';
      this.errorCode = null;
      this.emitState();
    };

    rec.onresult = (event) => {
      if (!this.enabled || this.disposed) return;
      const startIndex = Math.max(0, event.resultIndex ?? 0);
      for (let i = startIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result || result.length === 0) continue;

        for (let alt = 0; alt < result.length; alt++) {
          const transcript = result[alt]?.transcript ?? '';
          if (!transcript.trim()) continue;
          this.lastTranscript = transcript.trim();

          const match = parseVoiceCommand(transcript);
          if (match) {
            this.dispatchMatch(match);
            break;
          }
        }
      }
      this.emitState();
    };

    rec.onerror = (event) => {
      const code = event.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        this.enabled = false;
        this.errorCode = 'NOT_ALLOWED';
        this.status = 'ERROR';
        this.stopRecognitionInstance();
        this.emitState();
        return;
      }
      if (code === 'audio-capture') {
        this.enabled = false;
        this.errorCode = 'NO_MIC';
        this.status = 'ERROR';
        this.stopRecognitionInstance();
        this.emitState();
        return;
      }
      // Transient errors ('no-speech', 'aborted', 'network') recover via onend auto-restart.
    };

    rec.onend = () => {
      if (this.recognition === rec) {
        this.recognition = null;
      }
      if (this.enabled && !this.disposed) {
        this.scheduleRestart(250);
      } else if (this.status !== 'ERROR') {
        this.status = VoiceCommandEngine.isSupported() ? 'OFF' : 'UNSUPPORTED';
        this.emitState();
      }
    };

    this.recognition = rec;
    try {
      rec.start();
    } catch {
      this.recognition = null;
      if (this.enabled && !this.disposed) {
        this.scheduleRestart(400);
      }
    }
  }

  private dispatchMatch(match: VoiceCommandMatch): void {
    const key = JSON.stringify(match.command);
    const now = Date.now();
    const prev = this.lastDispatchedByKey.get(key) ?? 0;
    if (now - prev < this.cooldownMs) {
      return;
    }

    this.lastDispatchedByKey.set(key, now);
    this.lastMatch = match;
    this.commandListeners.forEach((cb) => cb(match));
  }

  private emitState(): void {
    const snapshot = this.getSnapshot();
    this.stateListeners.forEach((cb) => cb(snapshot));
  }
}
