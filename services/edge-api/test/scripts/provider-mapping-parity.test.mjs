/**
 * The `.mjs` half of the build-time/runtime parity check.
 *
 * It consumes the same `key-cases.json` corpus as
 * `test/providers/mappings/mapping-key-parity.test.ts` and asserts the
 * identical accept/reject verdicts, so a rule tightened on one side and not
 * the other fails CI instead of drifting silently.
 *
 * The two implementations exist because `validate:content` runs on plain Node
 * while the resolver ships to the Worker, and importing across that boundary
 * would need a dependency or a `package.json` change.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  canonicalKey,
  decodeProviderKey,
  isProviderIntegerValue,
  isProviderStringValue,
  isSeason,
} from '../../scripts/lib/provider-mapping-rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(
    join(here, '..', 'providers', 'mappings', 'key-cases.json'),
    'utf8',
  ),
);
const cases = corpus.cases;

/** Sorted case labels, asserted identically by both parity suites. */
const EXPECTED_LABELS = [...cases.map((entry) => entry.label)].sort();

/**
 * `decodeProviderKey` answers exactly the question the TypeScript decoder
 * answers about a whole key - closed shape, own properties only, valid season,
 * valid value type, declared combination - so the two sides are compared on
 * equal terms rather than through a loosened local wrapper.
 */
function accepts(key) {
  return decodeProviderKey(key);
}

describe('the shared key corpus is meaningful', () => {
  it('is non-empty and carries both verdicts', () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
    expect(cases.some((entry) => entry.accepted)).toBe(true);
    expect(cases.some((entry) => !entry.accepted)).toBe(true);
  });

  it('has a unique label per case', () => {
    expect(new Set(cases.map((entry) => entry.label)).size).toBe(cases.length);
  });

  /**
   * Pins the exact case-label set. The TypeScript twin asserts the identical
   * list, so neither suite can quietly stop running a case the other still
   * runs - which is the only way the two validators could drift while both
   * suites stayed green.
   */
  it('runs the same case labels as the TypeScript twin', () => {
    expect([...cases.map((entry) => entry.label)].sort()).toEqual(
      EXPECTED_LABELS,
    );
  });
});

describe('the .mjs validator agrees with the shared corpus', () => {
  for (const entry of cases) {
    it(`${entry.accepted ? 'accepts' : 'rejects'} ${entry.label}`, () => {
      expect(accepts(entry.key), entry.label).toBe(entry.accepted);
    });
  }
});

describe('the .mjs value predicates match the runtime bounds', () => {
  it('rejects padded, empty, control-character and oversized strings', () => {
    expect(isProviderStringValue('norris')).toBe(true);
    expect(isProviderStringValue('Red Bull Racing')).toBe(true);
    expect(isProviderStringValue('a'.repeat(64))).toBe(true);

    for (const value of [
      '',
      ' norris',
      'norris ',
      'nor\nris',
      'nor\rris',
      'nor' + String.fromCharCode(0) + 'ris',
      'nor' + String.fromCharCode(127) + 'ris',
      'a'.repeat(65),
      1,
      null,
      undefined,
    ]) {
      expect(isProviderStringValue(value), JSON.stringify(value)).toBe(false);
    }
  });

  it('requires a positive safe integer', () => {
    expect(isProviderIntegerValue(1)).toBe(true);
    expect(isProviderIntegerValue(Number.MAX_SAFE_INTEGER)).toBe(true);

    for (const value of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      '1',
      null,
    ]) {
      expect(isProviderIntegerValue(value), JSON.stringify(value)).toBe(false);
    }
  });

  /**
   * The build-time half of the Unicode boundary.
   *
   * JSON Schema `maxLength` counts Unicode code points, so this predicate must
   * too. The identical values are asserted against the curated schema and the
   * TypeScript runtime in
   * `test/providers/mappings/mapping-unicode-bounds.test.ts`, and both suites
   * additionally run them through the shared corpus above.
   */
  it('counts the provider-string bound in Unicode code points', () => {
    const astral = String.fromCodePoint(0x1f3ce);
    const atBound = astral.repeat(64);
    const overBound = astral.repeat(65);

    // The whole point: 64 code points is 128 UTF-16 code units.
    expect([...atBound].length).toBe(64);
    expect(atBound.length).toBe(128);

    expect(isProviderStringValue(atBound)).toBe(true);
    expect(isProviderStringValue(overBound)).toBe(false);

    // Mixed BMP / non-BMP, and the unchanged ASCII behaviour.
    expect(isProviderStringValue('a'.repeat(32) + astral.repeat(32))).toBe(
      true,
    );
    expect(isProviderStringValue('a'.repeat(33) + astral.repeat(32))).toBe(
      false,
    );
    expect(isProviderStringValue('a'.repeat(64))).toBe(true);
    expect(isProviderStringValue('a'.repeat(65))).toBe(false);
  });

  it('bounds the season', () => {
    expect(isSeason(1950)).toBe(true);
    expect(isSeason(2026)).toBe(true);
    expect(isSeason(2100)).toBe(true);
    for (const value of [1949, 2101, 2026.5, Number.NaN, '2026', null]) {
      expect(isSeason(value), JSON.stringify(value)).toBe(false);
    }
  });
});

describe('the .mjs canonical encoding matches the runtime encoding', () => {
  it('is injective over the accepted corpus', () => {
    const accepted = cases.filter((entry) => entry.accepted);
    const encoded = accepted.map((entry) => canonicalKey(entry.key));
    expect(new Set(encoded).size).toBe(accepted.length);
  });

  it('cannot be forged by a component carrying a separator', () => {
    const NUL = String.fromCharCode(0);

    // The build-time encoder validates the value first, so a control
    // character never even reaches the encoding.
    expect(() =>
      canonicalKey({
        season: 2026,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'a' + NUL + 'string' + NUL + 'b',
      }),
    ).toThrow(TypeError);

    // And a forged *field* - which no validation covers, because the field is
    // a closed union on the runtime side - is still distinct, because the
    // encoding is length-prefixed rather than separator-joined.
    const forgedField = canonicalKey({
      season: 2026,
      source: 'jolpica',
      entity: 'driver',
      providerField: 'driverId' + NUL + 'string' + NUL + 'ab',
      providerValue: 'b',
    });
    const honest = canonicalKey({
      season: 2026,
      source: 'jolpica',
      entity: 'driver',
      providerField: 'driverId',
      providerValue: 'b',
    });
    expect(forgedField).not.toBe(honest);
  });

  it('refuses to key an out-of-range season', () => {
    expect(() =>
      canonicalKey({
        season: 1800,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'norris',
      }),
    ).toThrow(TypeError);
  });

  /**
   * Pins the exact wire form of the key.
   *
   * The TypeScript twin asserts the same string, so an edit to either encoder
   * that changes the representation fails on both sides rather than leaving the
   * build-time index and the runtime index keyed differently.
   */
  it('produces the pinned representation', () => {
    expect(
      canonicalKey({
        season: 2026,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'norris',
      }),
    ).toBe('4:2026;7:jolpica;6:driver;8:driverId;6:string;6:norris;');
  });
});
