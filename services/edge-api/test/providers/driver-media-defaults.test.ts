/**
 * Identity-only and partially described driver rows at the content-loading
 * seam.
 *
 * The curated driver registry always carries `id` and `fullName`, and carries
 * the nine descriptive facts only where GridView owns them: the 2026 drivers
 * curated for provider mapping include identity-only rows. The normalized
 * `Driver` contract is stricter: every one of those keys must be *present*, as
 * an explicit `null` wherever no fact is recorded. `withDriverMedia` in the
 * mock provider is the single seam where the two shapes meet, following the
 * constructor and circuit precedents in `constructor-media-defaults.test.ts`
 * and `circuit-media-defaults.test.ts`.
 *
 * These tests read synthetic rows through the real provider - with the curated
 * registry replaced for this file alone - and judge what leaves the seam with
 * the production validator.
 */

import { describe, expect, it, vi } from 'vitest';

import { validateDriver } from '../../src/contract/normalized';
import type { Driver } from '../../src/contract/types';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import { FixedClock } from '../../src/runtime/clock';

/**
 * Every row is hoisted so the mock factory below and the assertions can name
 * the very same objects: the non-mutation test depends on that identity.
 */
const rows = vi.hoisted(() => ({
  /** Exactly the shape of a 2026 curated identity: `id` and `fullName` only. */
  identityOnly: {
    id: 'identity-only-driver',
    fullName: 'Identity Only Driver',
  },
  /**
   * Three of the nine descriptive facts supplied - two populated values and
   * one explicit `null` - and the other six omitted outright.
   */
  partiallyDescribed: {
    id: 'partly-described-driver',
    fullName: 'Partly Described Driver',
    givenName: 'Partly',
    permanentNumber: 99,
    biography: null,
  },
  /** All nine supplied, so the row can never need a default. */
  fullyDescribed: {
    id: 'fully-described-driver',
    fullName: 'Fully Described Driver',
    givenName: 'Fully',
    familyName: 'Described',
    shortCode: 'FUL',
    permanentNumber: 77,
    nationality: 'British',
    countryCode: 'GB',
    dateOfBirth: '1990-01-02',
    placeOfBirth: 'Somewhere',
    biography: 'An authored biography.',
  },
}));

vi.mock('../../../../content/registries/drivers.mock.json', () => ({
  default: {
    drivers: [rows.identityOnly, rows.partiallyDescribed, rows.fullyDescribed],
  } as unknown,
}));

/** Every property the normalized `Driver` contract declares, in order. */
const DECLARED_DRIVER_KEYS = [
  'id',
  'fullName',
  'givenName',
  'familyName',
  'shortCode',
  'permanentNumber',
  'nationality',
  'countryCode',
  'dateOfBirth',
  'placeOfBirth',
  'biography',
  'media',
] as const satisfies readonly (keyof Driver)[];

/**
 * The optional properties that must leave the seam present and `null` when no
 * fact is recorded: the nine descriptive facts plus `media`, which the media
 * content supplies and which no synthetic row here has.
 */
const OPTIONAL_DRIVER_KEYS = [
  'givenName',
  'familyName',
  'shortCode',
  'permanentNumber',
  'nationality',
  'countryCode',
  'dateOfBirth',
  'placeOfBirth',
  'biography',
  'media',
] as const satisfies readonly (keyof Driver)[];

/** The six the partially described row leaves out entirely. */
const OMITTED_BY_THE_PARTIAL_ROW = [
  'familyName',
  'shortCode',
  'nationality',
  'countryCode',
  'dateOfBirth',
  'placeOfBirth',
] as const satisfies readonly (keyof Driver)[];

/** The curated season as the production provider actually emits it. */
async function loadDrivers(): Promise<Driver[]> {
  const provider = new MockFormulaOneProvider({
    clock: new FixedClock(new Date('2026-07-20T12:00:00.000Z')),
  });
  const source = await provider.fetchSeasonSource(2026, ['season-calendar']);
  return source.drivers;
}

function driverFrom(drivers: readonly Driver[], id: string): Driver {
  const driver = drivers.find((entry) => entry.id === id);
  if (driver === undefined) {
    throw new Error(`the provider emitted no driver "${id}"`);
  }
  return driver;
}

describe('an identity-only driver row', () => {
  it('keeps its identity untouched', async () => {
    const driver = driverFrom(await loadDrivers(), 'identity-only-driver');

    expect(driver.id).toBe('identity-only-driver');
    expect(driver.fullName).toBe('Identity Only Driver');
  });

  it('turns every optional property into a present, explicit null', async () => {
    const driver = driverFrom(await loadDrivers(), 'identity-only-driver');

    for (const key of OPTIONAL_DRIVER_KEYS) {
      // Presence is the whole point: an absent key fails the contract, an
      // explicit `null` satisfies it, and `undefined` would pass neither.
      expect(Object.hasOwn(driver, key), key).toBe(true);
      expect(driver[key], key).toBeNull();
    }
  });

  it('emits the complete contract field set and nothing more', async () => {
    const driver = driverFrom(await loadDrivers(), 'identity-only-driver');

    // In contract order, too: a default never moves ahead of `id` and
    // `fullName`.
    expect(Object.keys(driver)).toEqual([...DECLARED_DRIVER_KEYS]);
    // Judged by the production validator, not by a second copy of the rule:
    // it reports `missing` for an absent key and `unknown` for a surplus one.
    expect(validateDriver(driver, 'driver')).toEqual([]);
  });
});

describe('a partially described driver row', () => {
  it('preserves every supplied value exactly, including an explicit null', async () => {
    const driver = driverFrom(await loadDrivers(), 'partly-described-driver');

    // Supplied and populated: the row wins over the default.
    expect(driver.givenName).toBe('Partly');
    expect(driver.permanentNumber).toBe(99);
    // Supplied as `null`: indistinguishable from the default, and left alone.
    expect(Object.hasOwn(driver, 'biography')).toBe(true);
    expect(driver.biography).toBeNull();
  });

  it('defaults only the facts it omits', async () => {
    const driver = driverFrom(await loadDrivers(), 'partly-described-driver');

    for (const key of OMITTED_BY_THE_PARTIAL_ROW) {
      expect(Object.hasOwn(rows.partiallyDescribed, key), key).toBe(false);
      expect(Object.hasOwn(driver, key), key).toBe(true);
      expect(driver[key], key).toBeNull();
    }
  });

  it('emits the complete contract field set and nothing more', async () => {
    const driver = driverFrom(await loadDrivers(), 'partly-described-driver');

    expect(Object.keys(driver).slice(0, 2)).toEqual(['id', 'fullName']);
    expect([...Object.keys(driver)].sort()).toEqual(
      [...DECLARED_DRIVER_KEYS].sort(),
    );
    expect(validateDriver(driver, 'driver')).toEqual([]);
  });
});

describe('a fully described driver row', () => {
  it('reaches the contract with every authored value winning over the defaults', async () => {
    const driver = driverFrom(await loadDrivers(), 'fully-described-driver');

    expect(Object.keys(driver)).toEqual([...DECLARED_DRIVER_KEYS]);
    expect(driver).toEqual({
      id: 'fully-described-driver',
      fullName: 'Fully Described Driver',
      givenName: 'Fully',
      familyName: 'Described',
      shortCode: 'FUL',
      permanentNumber: 77,
      nationality: 'British',
      countryCode: 'GB',
      dateOfBirth: '1990-01-02',
      placeOfBirth: 'Somewhere',
      biography: 'An authored biography.',
      media: null,
    });
    expect(validateDriver(driver, 'driver')).toEqual([]);
  });
});

describe('the seam', () => {
  it('reads every curated row without mutating it', async () => {
    const before = structuredClone(rows);

    await loadDrivers();
    await loadDrivers();

    // The seam clones before it maps, so the loaded content stays pristine and
    // a second read cannot observe the first one's defaults.
    expect(rows).toEqual(before);
    expect(Object.keys(rows.identityOnly)).toEqual(['id', 'fullName']);
    expect(Object.hasOwn(rows.partiallyDescribed, 'nationality')).toBe(false);
  });
});
