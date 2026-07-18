// Tolerant-consumer parsers. Given contract data (already structurally valid),
// these map raw JSON into typed contract objects while:
//   - ignoring unknown additive fields,
//   - mapping unrecognised enum values to `unknown`,
//   - preserving nulls (never substituting zero or empty string),
//   - preserving structured timing values.
// They mirror what a tolerant client does; the Worker uses them when reading
// snapshot data. Full per-field parsing for every entity lives in the Flutter
// DTO layer.

import {
  EVENT_STATUSES,
  FINISH_STATUSES,
  SESSION_STATUSES,
  SESSION_TYPES,
  WEEKEND_FORMATS,
  parseEnum,
} from './enums';
import type { GrandPrix, RaceResultEntry, Session } from './types';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function reqString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

// Required numeric contract fields (e.g. season, round) are always present in
// valid data; the fallback exists only to keep the return type total.
function reqNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number.NaN;
}

export function parseSession(input: unknown): Session {
  const raw = asRecord(input);
  return {
    id: reqString(raw['id']),
    type: parseEnum(raw['type'], SESSION_TYPES, 'unknown'),
    name: asString(raw['name']),
    startTime: asString(raw['startTime']),
    endTime: asString(raw['endTime']),
    status: parseEnum(raw['status'], SESSION_STATUSES, 'unknown'),
  };
}

export function parseGrandPrix(input: unknown): GrandPrix {
  const raw = asRecord(input);
  const sessions = Array.isArray(raw['sessions'])
    ? raw['sessions'].map((session) => parseSession(session))
    : [];
  return {
    id: reqString(raw['id']),
    season: reqNumber(raw['season']),
    round: reqNumber(raw['round']),
    eventSlug: reqString(raw['eventSlug']),
    name: reqString(raw['name']),
    officialName: asString(raw['officialName']),
    circuitId: reqString(raw['circuitId']),
    status: parseEnum(raw['status'], EVENT_STATUSES, 'unknown'),
    format: parseEnum(raw['format'], WEEKEND_FORMATS, 'unknown'),
    startDate: asString(raw['startDate']),
    endDate: asString(raw['endDate']),
    timezone: asString(raw['timezone']),
    sessions,
    hasResults: asBoolean(raw['hasResults']) ?? false,
    // Media is passed through structurally; the Flutter DTO layer parses it fully.
    media: Array.isArray(raw['media'])
      ? (raw['media'] as GrandPrix['media'])
      : null,
  };
}

export function parseRaceResultEntry(input: unknown): RaceResultEntry {
  const raw = asRecord(input);
  return {
    driverId: reqString(raw['driverId']),
    constructorId: reqString(raw['constructorId']),
    position: asNumber(raw['position']),
    gridPosition: asNumber(raw['gridPosition']),
    points: asNumber(raw['points']),
    status: parseEnum(raw['status'], FINISH_STATUSES, 'unknown'),
    laps: asNumber(raw['laps']),
    elapsedTimeMillis: asNumber(raw['elapsedTimeMillis']),
    gapToLeaderMillis: asNumber(raw['gapToLeaderMillis']),
    lapsBehind: asNumber(raw['lapsBehind']),
    fastestLap: asBoolean(raw['fastestLap']),
    dnfReason: asString(raw['dnfReason']),
    gapText: asString(raw['gapText']),
  };
}
