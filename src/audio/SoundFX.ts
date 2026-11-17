/**
 * SoundFX: Simple Web Audio API synthesizer for in-game audio feedback.
 *
 * NO external audio files (mp3/wav) required — pure synthesis.
 * Critical for UX: players often look away from screen during exercises.
 *
 * Sounds:
 * - Bottom hit: soft "thud" when reaching squat bottom
 * - Rep complete: crisp "beep/hit" when rep is counted
 * - Error: subtle "buzz" for invalid form
 * - Power-up: ascending tone for level up
 *
 * ZERO dependencies on React, Zustand, or game logic.
 */

/**
 * Sound types available in the system.
 */
export type SoundType =
  | 'BOTTOM_HIT'     // Squat bottom reached
  | 'REP_COMPLETE'   // Valid rep counted
  | 'ERROR'          // Invalid form/incomplete rep
  | 'POWER_UP'       // Level up/achievement
  | 'COMBO'          // Combo multiplier
  | 'DAMAGE'         // Player takes damage
  | 'WARNING'        // Incoming enemy attack telegraph
  | 'VICTORY'        // Battle won
  | 'METRONOME_TICK' // Tempo cadence pulse
  | 'INTERVAL_BELL'; // Tabata/Benchmark interval transition bell

/**
 * Audio configuration.
 */
export interface AudioConfig {
  /** Master volume (0-1) */
  volume: number;

  /** Enable/disable all sounds */
  enabled: boolean;

  /** Enable voice feedback via Web Speech API */
  voiceEnabled: boolean;
}

/**
 * Default audio configuration.
 */
const DEFAULT_CONFIG: AudioConfig = {
  volume: 0.7,
  enabled: true,
  voiceEnabled: false,
};

/**
 * SoundFX manages all in-game audio using Web Audio API.
 */
export class SoundFX {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private config: AudioConfig;

  // Voice synthesis (optional)
  private synth: SpeechSynthesis | null = null;

  constructor(config: Partial<AudioConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Web Speech API (optional voice feedback)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  /**
   * Initialize Web Audio API context.
   * Must be called after user interaction (browser autoplay policy).
   */
  async init(): Promise<void> {
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
        } catch (err) {
          console.warn('Failed to resume Web Audio API:', err);
        }
      }
      return;
    }

    try {
      // Create AudioContext (webkit prefix for Safari)
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass();

      // Create master gain node for volume control
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.config.volume;
      this.masterGain.connect(this.audioContext.destination);

      // Resume context if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (err) {
      console.warn('Failed to initialize Web Audio API:', err);
    }
  }

  /**
   * Check if audio context is unlocked and ready to play.
   */
  isUnlocked(): boolean {
    if (!this.config.enabled) {
      return true;
    }
    return this.audioContext !== null && this.audioContext.state === 'running';
  }

  /**
   * Play a sound effect by type.
   */
  play(type: SoundType): void {
    if (!this.config.enabled || !this.audioContext || !this.masterGain) {
      return;
    }

    switch (type) {
      case 'BOTTOM_HIT':
        this.playBottomHit();
        break;
      case 'REP_COMPLETE':
        this.playRepComplete();
        break;
      case 'ERROR':
        this.playError();
        break;
      case 'POWER_UP':
        this.playPowerUp();
        break;
      case 'COMBO':
        this.playCombo();
        break;
      case 'DAMAGE':
        this.playDamage();
        break;
      case 'WARNING':
        this.playWarning();
        break;
      case 'VICTORY':
        this.playVictory();
        break;
      case 'METRONOME_TICK':
        this.playMetronomeTick();
        break;
      case 'INTERVAL_BELL':
        this.playIntervalBell();
        break;
    }
  }

  /**
   * Speak text using Web Speech API (optional voice feedback).
   */
  speak(text: string, options: { rate?: number; pitch?: number } = {}): void {
    if (!this.config.voiceEnabled || !this.synth) {
      return;
    }

    // Cancel any ongoing speech
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = this.config.volume;

    this.synth.speak(utterance);
  }

  /**
   * Update audio configuration.
   */
  configure(config: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...config };

    // Update master volume
    if (this.masterGain) {
      this.masterGain.gain.value = this.config.volume;
    }
  }

  /**
   * Get current configuration.
   */
  getConfig(): Readonly<AudioConfig> {
    return { ...this.config };
  }

  /**
   * Dispose audio context and resources.
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.masterGain = null;

    if (this.synth) {
      this.synth.cancel();
    }
  }

  // ============================================================
  // SOUND SYNTHESIS METHODS
  // ============================================================

  /**
   * Play soft "thud" when reaching squat bottom.
   * Low frequency, short decay.
   */
  private playBottomHit(): void {
    if (!this.audioContext || !this.masterGain) return;

    const now = this.audioContext.currentTime;

    // Create oscillator for bass thud
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now); // Deep bass
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1); // Pitch drop

    // Envelope (quick attack, short decay)
    const env = this.audioContext.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.3, now + 0.01); // Attack
    env.gain.exponentialRampToValueAtTime(0.01, now + 0.15); // Decay

    // Connect and play
    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Play crisp "beep/hit" when rep is counted.
   * Mid-high frequency, punchy envelope.
   */
  private playRepComplete(): void {
    if (!this.audioContext || !this.masterGain) return;

    const now = this.audioContext.currentTime;

    // Create two oscillators for richer tone
    const osc1 = this.audioContext.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(800, now); // Primary tone

    const osc2 = this.audioContext.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, now); // Harmonic

    // Envelope (punchy, short)
    const env = this.audioContext.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.4, now + 0.005); // Fast attack
    env.gain.exponentialRampToValueAtTime(0.01, now + 0.1); // Quick decay

    // Connect and play
    osc1.connect(env);
    osc2.connect(env);
    env.connect(this.masterGain);

    osc1.start(now);
    osc1.stop(now + 0.1);
    osc2.start(now);
    osc2.stop(now + 0.1);
  }

  /**
   * Play subtle "buzz" for errors (invalid form).
   * Dissonant, short.
   */
  private playError(): void {
    if (!this.audioContext || !this.masterGain) return;

    const now = this.audioContext.currentTime;

    // Dissonant sawtooth
    const osc = this.audioContext.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(150, now + 0.08); // Descending buzz

    // Short envelope
    const env = this.audioContext.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.2, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Play ascending "power-up" tone for level up.
   * Bright, rising pitch.
   */
  private playPowerUp(): void {
    if (!this.audioContext || !this.masterGain) return;

    const now = this.audioContext.currentTime;

    // Ascending arpeggio
    const frequencies = [440, 554, 659, 880]; // A major chord + octave

    frequencies.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now);

      const env = this.audioContext!.createGain();
      const startTime = now + i * 0.08; // Stagger notes
      env.gain.setValueAtTime(0, startTime);
      env.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
      env.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

      osc.connect(env);
      env.connect(this.masterGain!);

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  /**
   * Play combo multiplier sound (quick ascending beep).
   */
  private playCombo(): void {
    if (!this.audioContext || !this.masterGain) return;

    const now = this.audioContext.currentTime;

    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);

    const env = this.audioContext.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.3, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Play damage sound (low rumble).
   */
  private playDamage(): void {
    if (!this.audioContext || !this.masterGain) return;

    const now = this.audioContext.currentTime;

    const osc = this.audioContext.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);

    const env = this.audioContext.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.25, now + 0.02);
    env.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Play urgent two-tone wind-up chime before an enemy/boss attack lands.
   */
  private playWarning(): void {
    if (!this.audioContext || !this.masterGain) return;

    const now = this.audioContext.currentTime;
    const pulses = [
      { freq: 520, offset: 0, duration: 0.08 },
      { freq: 780, offset: 0.1, duration: 0.1 },
    ];

    pulses.forEach(({ freq, offset, duration }) => {
      const osc = this.audioContext!.createOscillator();
      osc.type = 'triangle';
      const startTime = now + offset;
      osc.frequency.setValueAtTime(freq, startTime);

      const env = this.audioContext!.createGain();
      env.gain.setValueAtTime(0, startTime);
      env.gain.linearRampToValueAtTime(0.32, startTime + 0.01);
      env.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      osc.connect(env);
      env.connect(this.masterGain!);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  /**
   * Play victory fanfare (ascending chord).
   */
  private playVictory(): void {
    if (!this.audioContext || !this.masterGain) return;

    const now = this.audioContext.currentTime;

    // Victory chord (C major)
    const chord = [523, 659, 784]; // C5, E5, G5

    chord.forEach((freq) => {
      const osc = this.audioContext!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      const env = this.audioContext!.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.15, now + 0.05);
      env.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

      osc.connect(env);
      env.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.8);
    });
  }

  /**
   * Subtle crisp metronome tick for tempo cadence pacing.
   */
  private playMetronomeTick(): void {
    if (!this.audioContext || !this.masterGain) return;

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1050, now);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.03);

    const env = this.audioContext.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.16, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.005, now + 0.045);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Crisp double bell for Tabata Work/Rest transitions & Benchmark completion.
   */
  private playIntervalBell(): void {
    if (!this.audioContext || !this.masterGain) return;

    const now = this.audioContext.currentTime;
    const strikes = [0, 0.14];
    for (const offset of strikes) {
      const osc = this.audioContext.createOscillator();
      osc.type = 'triangle';
      const t0 = now + offset;
      osc.frequency.setValueAtTime(880, t0);

      const env = this.audioContext.createGain();
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(0.28, t0 + 0.01);
      env.gain.exponentialRampToValueAtTime(0.008, t0 + 0.22);

      osc.connect(env);
      env.connect(this.masterGain);

      osc.start(t0);
      osc.stop(t0 + 0.24);
    }
  }
}
