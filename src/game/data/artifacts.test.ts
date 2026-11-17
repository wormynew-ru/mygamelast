import { describe, it, expect } from 'vitest';
import {
  ARTIFACT_ORDER,
  MAX_EQUIPPED_ARTIFACTS,
  getAggregatedArtifactEffects,
  getArtifactUnlockForWave,
  normalizeArtifactState,
} from './artifacts';

describe('Endgame Artifacts System', () => {
  it('defines 6 artifacts and caps equipped slots at 2', () => {
    expect(ARTIFACT_ORDER.length).toBe(6);
    const normalized = normalizeArtifactState({
      unlockedIds: ['PHOENIX_BAND', 'TITAN_CORE', 'BERSERKER_SIGIL'],
      equippedIds: ['PHOENIX_BAND', 'TITAN_CORE', 'BERSERKER_SIGIL'],
    });
    expect(normalized.equippedIds.length).toBe(MAX_EQUIPPED_ARTIFACTS);
    expect(normalized.equippedIds).toEqual(['PHOENIX_BAND', 'TITAN_CORE']);
  });

  it('drops equipped artifacts that are not unlocked during normalization', () => {
    const normalized = normalizeArtifactState({
      unlockedIds: ['PHOENIX_BAND'],
      equippedIds: ['TITAN_CORE', 'PHOENIX_BAND'],
    });
    expect(normalized.equippedIds).toEqual(['PHOENIX_BAND']);
  });

  it('aggregates passive combat hooks and maps Endless waves to unlocks', () => {
    const effects = getAggregatedArtifactEffects(['PHOENIX_BAND', 'BERSERKER_SIGIL']);
    expect(effects.attackBonus).toBe(7);
    expect(effects.healOnOverdrive).toBe(12);
    expect(effects.executeBonusRatio).toBe(0.25);

    expect(getArtifactUnlockForWave(4)).toBeNull();
    expect(getArtifactUnlockForWave(5)).toBe('PHOENIX_BAND');
    expect(getArtifactUnlockForWave(10)).toBe('TITAN_CORE');
    expect(getArtifactUnlockForWave(15)).toBe('BERSERKER_SIGIL');
    expect(getArtifactUnlockForWave(20)).toBe('SHIELD_BREAKER_PRISM');
  });
});
