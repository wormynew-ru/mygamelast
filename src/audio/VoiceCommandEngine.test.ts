import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VoiceCommandEngine,
  parseVoiceCommand,
  snapToDumbbellPreset,
} from './VoiceCommandEngine';

describe('VoiceCommandEngine parser', () => {
  it('parses Russian and English battle control commands', () => {
    expect(parseVoiceCommand('Пауза!')?.command).toEqual({ type: 'PAUSE' });
    expect(parseVoiceCommand('pause')?.command).toEqual({ type: 'PAUSE' });
    expect(parseVoiceCommand('Продолжить')?.command).toEqual({ type: 'RESUME' });
    expect(parseVoiceCommand('resume')?.command).toEqual({ type: 'RESUME' });
    expect(parseVoiceCommand('Дальше')?.command).toEqual({ type: 'NEXT' });
    expect(parseVoiceCommand('next')?.command).toEqual({ type: 'NEXT' });
    expect(parseVoiceCommand('Заново')?.command).toEqual({ type: 'RETRY' });
    expect(parseVoiceCommand('retry')?.command).toEqual({ type: 'RETRY' });
    expect(parseVoiceCommand('Выход в меню')?.command).toEqual({ type: 'EXIT' });
    expect(parseVoiceCommand('Быстрый бой')?.command).toEqual({ type: 'START_FIGHT' });
    expect(parseVoiceCommand('включи звук')?.command).toEqual({ type: 'SOUND_UNLOCK' });
  });

  it('parses all 7 exercises in Russian and English including ё->е normalization', () => {
    expect(parseVoiceCommand('выбираю приседания')?.command).toEqual({
      type: 'SELECT_EXERCISE',
      exerciseId: 'SQUAT',
    });
    expect(parseVoiceCommand('отжимания')?.command).toEqual({
      type: 'SELECT_EXERCISE',
      exerciseId: 'PUSH_UP',
    });
    expect(parseVoiceCommand('планка')?.command).toEqual({
      type: 'SELECT_EXERCISE',
      exerciseId: 'PLANK',
    });
    expect(parseVoiceCommand('прыжки jumping jacks')?.command).toEqual({
      type: 'SELECT_EXERCISE',
      exerciseId: 'JUMPING_JACK',
    });
    expect(parseVoiceCommand('удержание рук')?.command).toEqual({
      type: 'SELECT_EXERCISE',
      exerciseId: 'ARM_HOLD',
    });
    expect(parseVoiceCommand('стульчик у стены')?.command).toEqual({
      type: 'SELECT_EXERCISE',
      exerciseId: 'WALL_SIT',
    });
    expect(parseVoiceCommand('жим над головой')?.command).toEqual({
      type: 'SELECT_EXERCISE',
      exerciseId: 'OVERHEAD_PRESS',
    });
    expect(parseVoiceCommand('жим')?.command).toEqual({
      type: 'SELECT_EXERCISE',
      exerciseId: 'OVERHEAD_PRESS',
    });
  });

  it('parses dumbbell weights, bodyweight reset, and snaps to nearest preset', () => {
    expect(snapToDumbbellPreset(4.8)).toBe(5);
    expect(snapToDumbbellPreset(7.4)).toBe(7.5);
    expect(parseVoiceCommand('гантели 5 кг')?.command).toEqual({
      type: 'SET_LOADOUT',
      weightKg: 5,
    });
    expect(parseVoiceCommand('dumbbells 7.5 kg')?.command).toEqual({
      type: 'SET_LOADOUT',
      weightKg: 7.5,
    });
    expect(parseVoiceCommand('без веса')?.command).toEqual({
      type: 'SET_LOADOUT',
      weightKg: 0,
    });
    expect(parseVoiceCommand('с гантелями')?.command).toEqual({
      type: 'SET_LOADOUT',
      weightKg: null,
    });
  });

  it('parses navigation, circuits, and analytics commands without partial-word misfires', () => {
    expect(parseVoiceCommand('бесконечная арена')?.command).toEqual({ type: 'NAV_ENDLESS' });
    expect(parseVoiceCommand('круговой данж')?.command).toEqual({ type: 'NAV_CIRCUIT' });
    expect(parseVoiceCommand('стальной верх')?.command).toEqual({
      type: 'START_CIRCUIT',
      circuitId: 'UPPER_IRON',
    });
    expect(parseVoiceCommand('за всё время')?.command).toEqual({
      type: 'ANALYTICS_PERIOD',
      period: 'ALL',
    });
    expect(parseVoiceCommand('покажи объём')?.command).toEqual({
      type: 'ANALYTICS_METRIC',
      metric: 'VOLUME',
    });
    expect(parseVoiceCommand('личный сад')?.command).toEqual({ type: 'NAV_GARDEN' });
    expect(parseVoiceCommand('полить все')?.command).toEqual({ type: 'GARDEN_WATER' });
    expect(parseVoiceCommand('собрать урожай')?.command).toEqual({ type: 'GARDEN_HARVEST' });
    expect(parseVoiceCommand('битва с сорняками')?.command).toEqual({ type: 'GARDEN_WEED' });
    expect(parseVoiceCommand('вы')).toBeNull();
    expect(parseVoiceCommand('просто случайный шум')).toBeNull();
  });
});

describe('VoiceCommandEngine runtime', () => {
  interface MockRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onstart: (() => void) | null;
    onresult: ((event: { resultIndex: number; results: unknown[] }) => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
  }

  let instances: MockRecognitionInstance[] = [];

  beforeEach(() => {
    instances = [];
    vi.useFakeTimers();
    class FakeSpeechRecognition implements MockRecognitionInstance {
      continuous = false;
      interimResults = false;
      lang = '';
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onresult: ((event: { resultIndex: number; results: unknown[] }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start = () => {
        this.onstart?.();
      };
      stop = vi.fn();
      abort = vi.fn();
      constructor() {
        instances.push(this);
      }
    }
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeSpeechRecognition;
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    vi.useRealTimers();
  });

  it('deduplicates repeated interim/final commands within cooldown and handles permission error', () => {
    const engine = new VoiceCommandEngine({ language: 'ru', cooldownMs: 1200 });
    const received: string[] = [];
    engine.onCommand((match) => received.push(match.command.type));

    engine.start();
    expect(engine.getSnapshot().status).toBe('LISTENING');
    expect(instances[0].lang).toBe('ru-RU');

    // Fire interim then final within cooldown -> dispatches only once
    instances[0].onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, length: 1, 0: { transcript: 'пауза', confidence: 0.9 } }],
    });
    instances[0].onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, length: 1, 0: { transcript: 'пауза', confidence: 0.98 } }],
    });
    expect(received).toEqual(['PAUSE']);

    // Advance past cooldown and say NEXT
    vi.advanceTimersByTime(1500);
    instances[0].onresult?.({
      resultIndex: 1,
      results: [
        { isFinal: true, length: 1, 0: { transcript: 'пауза', confidence: 0.9 } },
        { isFinal: true, length: 1, 0: { transcript: 'дальше', confidence: 0.95 } },
      ],
    });
    expect(received).toEqual(['PAUSE', 'NEXT']);

    // Permission denied stops listening cleanly
    instances[0].onerror?.({ error: 'not-allowed' });
    expect(engine.getSnapshot().status).toBe('ERROR');
    expect(engine.getSnapshot().errorCode).toBe('NOT_ALLOWED');
    engine.dispose();
  });
});
