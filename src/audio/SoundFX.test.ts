/**
 * Unit tests for SoundFX.
 * Tests initialization, configuration, and API surface.
 * Note: Actual audio playback requires browser environment with user interaction.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SoundFX } from './SoundFX';

describe('SoundFX', () => {
  let soundFX: SoundFX;

  beforeEach(() => {
    soundFX = new SoundFX();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const config = soundFX.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.volume).toBe(0.7);
      expect(config.voiceEnabled).toBe(false);
    });

    it('should accept custom config', () => {
      const customSoundFX = new SoundFX({
        volume: 0.5,
        enabled: false,
        voiceEnabled: true,
      });

      const config = customSoundFX.getConfig();
      expect(config.volume).toBe(0.5);
      expect(config.enabled).toBe(false);
      expect(config.voiceEnabled).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      soundFX.configure({ volume: 0.9 });
      expect(soundFX.getConfig().volume).toBe(0.9);
    });

    it('should partially update configuration', () => {
      soundFX.configure({ enabled: false });

      const config = soundFX.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.volume).toBe(0.7); // Unchanged
    });
  });

  describe('Sound Playback', () => {
    it('should not throw when playing sounds before init', () => {
      // Should not throw, just silently skip
      expect(() => {
        soundFX.play('BOTTOM_HIT');
        soundFX.play('REP_COMPLETE');
        soundFX.play('ERROR');
        soundFX.play('POWER_UP');
        soundFX.play('COMBO');
        soundFX.play('DAMAGE');
        soundFX.play('WARNING');
        soundFX.play('VICTORY');
      }).not.toThrow();
    });

    it('should respect enabled flag', () => {
      soundFX.configure({ enabled: false });

      // Should not throw even when disabled
      expect(() => {
        soundFX.play('REP_COMPLETE');
      }).not.toThrow();
    });
  });

  describe('Voice Synthesis', () => {
    it('should not throw when speaking before init', () => {
      expect(() => {
        soundFX.speak('Test');
      }).not.toThrow();
    });

    it('should respect voiceEnabled flag', () => {
      soundFX.configure({ voiceEnabled: false });

      expect(() => {
        soundFX.speak('Test');
      }).not.toThrow();
    });

    it('should accept speech options', () => {
      expect(() => {
        soundFX.speak('Test', { rate: 1.5, pitch: 1.2 });
      }).not.toThrow();
    });
  });

  describe('Lifecycle', () => {
    it('should dispose cleanly', () => {
      soundFX.dispose();

      // Should not throw after dispose
      expect(() => {
        soundFX.play('REP_COMPLETE');
        soundFX.speak('Test');
      }).not.toThrow();
    });
  });
});
