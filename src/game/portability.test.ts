import { describe, it, expect } from 'vitest';
import { exportActivityToCsv, exportSaveToJson, parseAndValidateSaveJson } from './portability';
import { SAVE_SCHEMA_VERSION, migrateGameState, useGameStore } from './store';

describe('Save JSON & CSV Portability', () => {
  it('round-trips Map inventory cleanly via exportSaveToJson and parseAndValidateSaveJson', () => {
    useGameStore.getState().resetGame();
    useGameStore.getState().addCoins(300);
    useGameStore.getState().addItem('ENERGY_BAR', 4);
    useGameStore.getState().addItem('TITANIUM_DUMBBELLS', 1);
    useGameStore.getState().equipItem('TITANIUM_DUMBBELLS');

    const snapshot = useGameStore.getState();
    const json = exportSaveToJson(snapshot, SAVE_SCHEMA_VERSION);
    const parsed = parseAndValidateSaveJson(json, migrateGameState);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.state.coins).toBe(300);
    expect(parsed.state.inventory.items instanceof Map).toBe(true);
    expect(parsed.state.inventory.items.get('ENERGY_BAR')).toBe(4);
    expect(parsed.state.inventory.items.get('TITANIUM_DUMBBELLS')).toBe(1);
    expect(parsed.state.inventory.equippedItems).toContain('TITANIUM_DUMBBELLS');
  });

  it('rejects invalid JSON or malformed save objects gracefully', () => {
    expect(parseAndValidateSaveJson('{not valid json', migrateGameState)).toEqual({
      ok: false,
      error: 'INVALID_JSON',
    });
    expect(parseAndValidateSaveJson('{"foo":"bar"}', migrateGameState)).toEqual({
      ok: false,
      error: 'INVALID_SCHEMA',
    });
  });

  it('exports RFC-4180 CSV with all 10 exercises sorted chronologically', () => {
    const csv = exportActivityToCsv({
      '2026-04-02': {
        date: '2026-04-02',
        reps: 25,
        holdSeconds: 10,
        battlesWon: 2,
        coinsEarned: 90,
        estimatedKcal: 18.4,
        tonnageKg: 100,
        circuitsCompleted: 1,
        durationSec: 120,
        exercises: {
          LUNGE: { reps: 15, holdSeconds: 0 },
          HIGH_KNEES: { reps: 10, holdSeconds: 0 },
          PLANK: { reps: 0, holdSeconds: 10 },
        },
      },
      '2026-04-01': {
        date: '2026-04-01',
        reps: 12,
        holdSeconds: 0,
        battlesWon: 1,
        coinsEarned: 40,
        estimatedKcal: 6.2,
        exercises: {
          FRONT_RAISE: { reps: 12, holdSeconds: 0 },
        },
      },
    });

    const lines = csv.split('\r\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain('LUNGE_reps');
    expect(lines[0]).toContain('HIGH_KNEES_reps');
    expect(lines[0]).toContain('FRONT_RAISE_reps');
    expect(lines[1].startsWith('2026-04-01,')).toBe(true);
    expect(lines[2].startsWith('2026-04-02,')).toBe(true);
  });
});
