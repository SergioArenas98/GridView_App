/**
 * Partially described circuit rows at the content-loading seam.
 *
 * The curated circuit registry always carries `id` and `name`, and carries the
 * ten descriptive facts only where GridView owns them, so a row may supply any
 * subset of them. The normalized `Circuit` contract is stricter: every one of
 * those keys must be *present*, as an explicit `null` wherever no fact is
 * recorded. `withCircuitMedia` in the mock provider is the single seam where
 * the two shapes meet.
 *
 * The extremes are already covered elsewhere: the wholly absent case by the 17
 * identity-only 2026 rows that `payload-contract.test.ts` validates, and the
 * wholly present case by the five fully described circuits pinned in the
 * `api/v1/circuits` goldens. A row that fills in only *some* of the ten is
 * neither, and nothing pinned it. These tests read exactly such a row through
 * the real provider - with the curated registry replaced for this file alone -
 * and assert what leaves the seam.
 */

import { describe, expect, it, vi } from 'vitest';

import { validateCircuit } from '../../src/contract/normalized';
import type { Circuit } from '../../src/contract/types';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import { FixedClock } from '../../src/runtime/clock';

/**
 * Both rows are hoisted so the mock factory below and the assertions can name
 * the very same objects: the non-mutation test depends on that identity.
 */
const rows = vi.hoisted(() => ({
  /**
   * Three of the ten descriptive facts supplied - one string, one number and
   * one explicit `null` - and the other seven omitted outright.
   */
  partiallyDescribed: {
    id: 'partly-described-venue',
    name: 'Partly Described Circuit',
    locality: 'Stavelot',
    lengthMeters: 7004,
    lapRecord: null,
  },
  /** All ten supplied, so the row can never need a default. */
  fullyDescribed: {
    id: 'fully-described-venue',
    name: 'Fully Described Circuit',
    locality: 'Monza',
    country: 'Italy',
    countryCode: 'IT',
    latitude: 45.6156,
    longitude: 9.2811,
    lengthMeters: 5793,
    cornerCount: 11,
    direction: 'clockwise',
    firstGrandPrixYear: 1950,
    lapRecord: { driverId: 'max-verstappen', timeMillis: 106286, year: 2020 },
  },
}));

vi.mock('../../../../content/registries/circuits.mock.json', () => ({
  default: {
    circuits: [rows.partiallyDescribed, rows.fullyDescribed],
  } as unknown,
}));

/** Every property the normalized `Circuit` contract declares. */
const DECLARED_CIRCUIT_KEYS = [
  'id',
  'name',
  'locality',
  'country',
  'countryCode',
  'latitude',
  'longitude',
  'lengthMeters',
  'cornerCount',
  'direction',
  'firstGrandPrixYear',
  'lapRecord',
  'media',
] as const satisfies readonly (keyof Circuit)[];

/** The seven the partially described row leaves out entirely. */
const OMITTED_BY_THE_PARTIAL_ROW = [
  'country',
  'countryCode',
  'latitude',
  'longitude',
  'cornerCount',
  'direction',
  'firstGrandPrixYear',
] as const satisfies readonly (keyof Circuit)[];

/** The curated season as the production provider actually emits it. */
async function loadCircuits(): Promise<Circuit[]> {
  const provider = new MockFormulaOneProvider({
    clock: new FixedClock(new Date('2026-07-20T12:00:00.000Z')),
  });
  const source = await provider.fetchSeasonSource(2026, ['season-calendar']);
  return source.circuits;
}

function circuitFrom(circuits: readonly Circuit[], id: string): Circuit {
  const circuit = circuits.find((entry) => entry.id === id);
  if (circuit === undefined) {
    throw new Error(`the provider emitted no circuit "${id}"`);
  }
  return circuit;
}

describe('a partially described circuit row', () => {
  it('keeps its identity untouched', async () => {
    const circuit = circuitFrom(await loadCircuits(), 'partly-described-venue');

    expect(circuit.id).toBe('partly-described-venue');
    expect(circuit.name).toBe('Partly Described Circuit');
  });

  it('preserves every supplied value exactly, including an explicit null', async () => {
    const circuit = circuitFrom(await loadCircuits(), 'partly-described-venue');

    // Supplied and populated: the row wins over the default.
    expect(circuit.locality).toBe('Stavelot');
    expect(circuit.lengthMeters).toBe(7004);
    // Supplied as `null`: indistinguishable from the default, and left alone.
    expect(circuit.lapRecord).toBeNull();
  });

  it('turns each omitted fact into a present, explicit null', async () => {
    const circuit = circuitFrom(await loadCircuits(), 'partly-described-venue');

    for (const key of OMITTED_BY_THE_PARTIAL_ROW) {
      // Presence is the whole point: an absent key fails the contract, an
      // explicit `null` satisfies it, and `undefined` would pass neither.
      expect(Object.hasOwn(circuit, key), key).toBe(true);
      expect(circuit[key], key).toBeNull();
    }
  });

  it('emits the complete contract field set and nothing more', async () => {
    const circuit = circuitFrom(await loadCircuits(), 'partly-described-venue');

    expect([...Object.keys(circuit)].sort()).toEqual(
      [...DECLARED_CIRCUIT_KEYS].sort(),
    );
    // Judged by the production validator, not by a second copy of the rule:
    // it reports `missing` for an absent key and `unknown` for a surplus one.
    expect(validateCircuit(circuit, 'circuit')).toEqual([]);
  });

  it('is read without mutating the curated row', async () => {
    const before = structuredClone(rows.partiallyDescribed);

    await loadCircuits();

    // The seam clones before it maps, so the loaded content stays pristine and
    // a second read cannot observe the first one's defaults.
    expect(rows.partiallyDescribed).toEqual(before);
    expect(Object.hasOwn(rows.partiallyDescribed, 'country')).toBe(false);
  });
});

describe('a fully described circuit row', () => {
  it('reaches the contract with every curated value intact', async () => {
    const circuit = circuitFrom(await loadCircuits(), 'fully-described-venue');

    expect(circuit).toEqual({
      id: 'fully-described-venue',
      name: 'Fully Described Circuit',
      locality: 'Monza',
      country: 'Italy',
      countryCode: 'IT',
      latitude: 45.6156,
      longitude: 9.2811,
      lengthMeters: 5793,
      cornerCount: 11,
      direction: 'clockwise',
      firstGrandPrixYear: 1950,
      lapRecord: { driverId: 'max-verstappen', timeMillis: 106286, year: 2020 },
      media: null,
    });
    expect(validateCircuit(circuit, 'circuit')).toEqual([]);
  });
});
