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
  isProviderIntegerValue,
  isProviderStringValue,
  isSeason,
  isValidKeyShape,
} from '../../scripts/lib/provider-mapping-rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(
    join(here, '..', 'providers', 'mappings', 'key-cases.json'),
    'utf8',
  ),
);
const cases = corpus.cases;

/**
 * The `.mjs` validator checks the key shape and the season separately, because
 * a curated record carries its season at the document level. This composes the
 * two into the same yes/no verdict the TypeScript decoder produces for a whole
 * key, so the two sides are compared on equal terms.
 */
function accepts(key) {
  return isSeason(key.season) && isValidKeyShape(key);
}

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
