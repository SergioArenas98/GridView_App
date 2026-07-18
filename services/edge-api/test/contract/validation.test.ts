import { describe, expect, it } from 'vitest';

import {
  isCountryCode,
  isGridViewId,
  isSlug,
  validateErrorEnvelope,
  validateMeta,
  validateSuccessEnvelope,
} from '../../src/contract/validation';

import statusOk from '../fixtures/api/v1/status/ok.json';
import calendar from '../fixtures/api/v1/calendar/2026.json';
import manifest from '../fixtures/api/v1/content/manifest.json';
import upstreamUnavailable from '../fixtures/api/v1/errors/upstream-unavailable.json';

describe('id and country-code validation', () => {
  it('accepts valid kebab-case IDs', () => {
    expect(isSlug('max-verstappen')).toBe(true);
    expect(isSlug('ferrari')).toBe(true);
    expect(isGridViewId('2026-belgian-grand-prix')).toBe(true);
  });

  it('rejects invalid IDs (prefixes, colons, casing, spaces)', () => {
    expect(isSlug('driver:max-verstappen')).toBe(false);
    expect(isSlug('Max-Verstappen')).toBe(false);
    expect(isSlug('max verstappen')).toBe(false);
    expect(isGridViewId('grand-prix:2026:belgian')).toBe(false);
  });

  it('accepts alpha-2 country codes and rejects others', () => {
    expect(isCountryCode('ES')).toBe(true);
    expect(isCountryCode('NL')).toBe(true);
    expect(isCountryCode('nl')).toBe(false);
    expect(isCountryCode('NED')).toBe(false);
    expect(isCountryCode('N')).toBe(false);
  });
});

describe('metadata variant validation', () => {
  it('status meta is a valid BaseMeta but not a SeasonSnapshotMeta', () => {
    expect(validateMeta(statusOk.meta, 'BaseMeta')).toEqual([]);
    expect(
      validateMeta(statusOk.meta, 'SeasonSnapshotMeta').length,
    ).toBeGreaterThan(0);
  });

  it('season-scoped meta is a valid SeasonSnapshotMeta', () => {
    expect(validateMeta(calendar.meta, 'SeasonSnapshotMeta')).toEqual([]);
  });

  it('content-manifest meta is a valid SnapshotMeta without a season', () => {
    expect(validateMeta(manifest.meta, 'SnapshotMeta')).toEqual([]);
    expect(
      validateMeta(manifest.meta, 'SeasonSnapshotMeta').length,
    ).toBeGreaterThan(0);
  });
});

describe('envelope validation', () => {
  it('accepts a valid success envelope', () => {
    expect(validateSuccessEnvelope(calendar, 'SeasonSnapshotMeta')).toEqual([]);
  });

  it('rejects a success envelope missing data', () => {
    expect(
      validateSuccessEnvelope({ meta: calendar.meta }, 'SeasonSnapshotMeta'),
    ).toContainEqual({
      path: 'data',
      message: 'is required',
    });
  });

  it('accepts a valid error envelope', () => {
    expect(validateErrorEnvelope(upstreamUnavailable)).toEqual([]);
  });

  it('rejects an error envelope with an unknown code', () => {
    const issues = validateErrorEnvelope({
      error: { code: 'NOPE', message: 'x', retryable: false, requestId: 'r' },
    });
    expect(issues.length).toBeGreaterThan(0);
  });
});
