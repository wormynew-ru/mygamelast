/**
 * Pure JSON Save Export/Import (Map-safe) and RFC-4180 CSV Activity Export.
 * ZERO React, DOM, or Vision imports allowed.
 */

import type { DailyActivityEntry, GameState } from './types';
import { EXERCISES, type ExerciseId } from './data/exercises';

export interface SerializedMap<K = string, V = number> {
  __type: 'Map';
  entries: [K, V][];
}

export function isSerializedMap(value: unknown): value is SerializedMap {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__type' in value &&
    (value as SerializedMap).__type === 'Map' &&
    Array.isArray((value as SerializedMap).entries)
  );
}

export interface SaveExportEnvelope {
  app: 'JunkSlayer';
  schemaVersion: number;
  exportedAt: string;
  state: unknown;
}

function serializeWithMaps(state: GameState): unknown {
  return JSON.parse(
    JSON.stringify(state, (_key, value) => {
      if (value instanceof Map) {
        return {
          __type: 'Map',
          entries: Array.from(value.entries()),
        } satisfies SerializedMap<unknown, unknown>;
      }
      return value;
    })
  );
}

export function deserializeMaps<T>(raw: unknown): T {
  const json = JSON.stringify(raw);
  return JSON.parse(json, (_key, value) => {
    if (isSerializedMap(value)) {
      return new Map(value.entries);
    }
    return value;
  }) as T;
}

/**
 * Serialize full GameState (preserving Map instances cleanly) into a pretty JSON string.
 */
export function exportSaveToJson(state: GameState, schemaVersion: number): string {
  const envelope: SaveExportEnvelope = {
    app: 'JunkSlayer',
    schemaVersion,
    exportedAt: new Date().toISOString(),
    state: serializeWithMaps(state),
  };
  return JSON.stringify(envelope, null, 2);
}

export type SaveImportResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'INVALID_JSON' | 'INVALID_SCHEMA' };

/**
 * Parse and validate an exported JSON save string (supporting both envelope and raw Zustand persist format),
 * rehydrate Maps, and run migrateFn to normalize all fields safely.
 */
export function parseAndValidateSaveJson(
  rawJson: string,
  migrateFn: (rawState: unknown, version: number) => GameState
): SaveImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: 'INVALID_JSON' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'INVALID_SCHEMA' };
  }

  const record = parsed as Record<string, unknown>;
  let rawState: unknown = null;
  let version = 0;

  if (record.app === 'JunkSlayer' && typeof record.state === 'object' && record.state !== null) {
    rawState = record.state;
    version = typeof record.schemaVersion === 'number' ? record.schemaVersion : 14;
  } else if (
    typeof record.state === 'object' &&
    record.state !== null &&
    typeof record.version === 'number'
  ) {
    // Also tolerate raw Zustand localStorage envelope { state, version }
    rawState = record.state;
    version = record.version;
  } else {
    return { ok: false, error: 'INVALID_SCHEMA' };
  }

  const stateObj = rawState as Record<string, unknown>;
  if (!stateObj.player || typeof stateObj.player !== 'object') {
    return { ok: false, error: 'INVALID_SCHEMA' };
  }

  try {
    const rehydrated = deserializeMaps<unknown>(rawState);
    const migrated = migrateFn(rehydrated, version);
    return { ok: true, state: migrated };
  } catch {
    return { ok: false, error: 'INVALID_SCHEMA' };
  }
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export daily workout history as RFC-4180 CSV ordered chronologically.
 */
export function exportActivityToCsv(dailyHistory: Record<string, DailyActivityEntry>): string {
  const exerciseIds = Object.keys(EXERCISES) as ExerciseId[];
  const headers = [
    'date',
    'reps',
    'holdSeconds',
    'battlesWon',
    'circuitsCompleted',
    'estimatedKcal',
    'tonnageKg',
    'coinsEarned',
    'durationSec',
    ...exerciseIds.flatMap((id) =>
      EXERCISES[id].trackingType === 'hold' ? [`${id}_holdSeconds`] : [`${id}_reps`]
    ),
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(',')];
  const sortedDates = Object.keys(dailyHistory).sort();

  for (const dateKey of sortedDates) {
    const entry = dailyHistory[dateKey];
    if (!entry) continue;
    const perExercise = exerciseIds.map((id) => {
      const ex = entry.exercises?.[id];
      return EXERCISES[id].trackingType === 'hold' ? (ex?.holdSeconds ?? 0) : (ex?.reps ?? 0);
    });
    const rowValues: (string | number)[] = [
      entry.date || dateKey,
      entry.reps ?? 0,
      entry.holdSeconds ?? 0,
      entry.battlesWon ?? 0,
      entry.circuitsCompleted ?? 0,
      Math.round((entry.estimatedKcal ?? 0) * 10) / 10,
      Math.round((entry.tonnageKg ?? 0) * 10) / 10,
      entry.coinsEarned ?? 0,
      entry.durationSec ?? 0,
      ...perExercise,
    ];
    rows.push(rowValues.map(escapeCsvCell).join(','));
  }

  return rows.join('\r\n');
}
