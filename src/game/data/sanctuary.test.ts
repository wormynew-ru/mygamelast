import { describe, expect, it } from 'vitest';
import {
  SANCTUARY_MIX_BLUEPRINTS,
  getTotalCropCount,
  isMixReadyToCraft,
} from './sanctuary';

describe('Sanctuary botanical mix foundation', () => {
  it('computes total harvested crop counts across all seed types', () => {
    expect(
      getTotalCropCount({
        PROTEIN_MINT: 2,
        IRON_BAMBOO: 1,
        CHILI_PEPPER: 3,
        GOLDEN_LOTUS: 0,
      })
    ).toBe(6);
  });

  it('checks ingredient readiness accurately for planned Sanctuary mixes', () => {
    const mintIsotonic = SANCTUARY_MIX_BLUEPRINTS.find((b) => b.id === 'MINT_ISOTONIC')!;
    const lotusNectar = SANCTUARY_MIX_BLUEPRINTS.find((b) => b.id === 'LOTUS_NECTAR')!;

    const partial = {
      PROTEIN_MINT: 1,
      IRON_BAMBOO: 0,
      CHILI_PEPPER: 0,
      GOLDEN_LOTUS: 1,
    };
    expect(isMixReadyToCraft(partial, mintIsotonic)).toBe(false);
    expect(isMixReadyToCraft(partial, lotusNectar)).toBe(false);

    const ready = {
      PROTEIN_MINT: 2,
      IRON_BAMBOO: 2,
      CHILI_PEPPER: 1,
      GOLDEN_LOTUS: 1,
    };
    expect(isMixReadyToCraft(ready, mintIsotonic)).toBe(true);
    expect(isMixReadyToCraft(ready, lotusNectar)).toBe(true);
  });
});
