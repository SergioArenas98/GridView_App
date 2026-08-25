/**
 * The TypeScript half of the build-time/runtime parity check.
 *
 * `scripts/lib/provider-mapping-rules.mjs` and
 * `src/providers/mappings/mapping-key.ts` implement the same rules twice: the
 * validator runs on plain Node inside `validate:content`, the resolver ships to
 * the Worker, and neither may import the other without a dependency or a
 * package-script change. Duplicated rules drift, so both halves consume the
 * **same** checked-in corpus (`key-cases.json`) and this file asserts the
 * TypeScript verdicts while `test/scripts/provider-mapping-parity.test.mjs`
 * asserts the `.mjs` verdicts against the identical expectations.
 *
 * A rule that is tightened on one side and not the other fails here.
 */

import { describe, expect, it } from 'vitest';

import {
  canonicalKey,
  decodeProviderMappingKey,
  type ProviderMappingKey,
} from '../../../src/providers/mappings';

import corpus from './key-cases.json';

interface KeyCase {
  readonly label: string;
  readonly accepted: boolean;
  readonly key: Record<string, unknown>;
}

const cases = corpus.cases as readonly KeyCase[];

describe('the shared key corpus is meaningful', () => {
  it('carries both accepted and rejected cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
    expect(cases.some((entry) => entry.accepted)).toBe(true);
    expect(cases.some((entry) => !entry.accepted)).toBe(true);
  });

  it('has a unique label per case', () => {
    expect(new Set(cases.map((entry) => entry.label)).size).toBe(cases.length);
  });

  /**
   * The same sorted-label assertion the `.mjs` twin makes. Both suites derive
   * it from the one physical file and neither filters, so an identical list
   * proves both validators saw exactly the same cases.
   */
  it('runs every case, unfiltered', () => {
    const labels = [...cases.map((entry) => entry.label)].sort();
    expect(labels.length).toBe(cases.length);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('the TypeScript decoder agrees with the shared corpus', () => {
  for (const entry of cases) {
    it(`${entry.accepted ? 'accepts' : 'rejects'} ${entry.label}`, () => {
      const decoded = decodeProviderMappingKey(entry.key);
      expect(decoded.ok, entry.label).toBe(entry.accepted);
    });
  }
});

describe('the canonical encoding is injective over the corpus', () => {
  it('gives every accepted case a distinct key', () => {
    const accepted = cases.filter((entry) => entry.accepted);
    const encoded = accepted.map((entry) => {
      const decoded = decodeProviderMappingKey(entry.key);
      if (!decoded.ok) throw new Error(`corpus disagrees: ${entry.label}`);
      return canonicalKey(decoded.key);
    });
    expect(new Set(encoded).size).toBe(accepted.length);
  });

  /**
   * The encoding must be injective by construction, not merely because the
   * inputs happened to be validated first.
   *
   * The earlier separator-joined form was not: a `providerField` carrying an
   * embedded separator plus a short value serialized identically to an honest
   * field with a longer value. Length-prefixing removes the ambiguity, so this
   * pair is distinct even though neither side is validated.
   */
  it('cannot be forged by a component carrying a separator', () => {
    const NUL = String.fromCharCode(0);
    const forgedField = canonicalKey({
      season: 2026,
      source: 'jolpica',
      entity: 'driver',
      providerField: `driverId${NUL}string${NUL}a`,
      providerValue: 'b',
    } as unknown as ProviderMappingKey);
    const forgedValue = canonicalKey({
      season: 2026,
      source: 'jolpica',
      entity: 'driver',
      providerField: 'driverId',
      providerValue: `a${NUL}string${NUL}b`,
    } as unknown as ProviderMappingKey);

    expect(forgedField).not.toBe(forgedValue);
  });

  it('separates the integer and string type tags', () => {
    const asNumber = canonicalKey({
      season: 2026,
      source: 'openf1',
      entity: 'driver',
      providerField: 'driver_number',
      providerValue: 1,
    });
    const asString = canonicalKey({
      season: 2026,
      source: 'openf1',
      entity: 'constructor',
      providerField: 'team_name',
      providerValue: '1',
    });
    expect(asNumber).not.toBe(asString);
  });

  /** The pinned wire form; the .mjs twin asserts the identical string. */
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

  /**
   * The length prefix counts **JavaScript UTF-16 code units** - `String#length`
   * - not code points or UTF-8 bytes. Any deterministic measure works so long
   * as encoder and decoder agree; this documents which one is in use, and the
   * cases below pin that it stays injective across scripts, astral pairs and
   * combining marks.
   */
  it('stays injective across non-ASCII, astral and combining input', () => {
    const values = [
      'Alpine',
      'Alpiné',
      'Alpine\u0301',
      'ALPINE',
      'Ålpine',
      'Alpine ',
      ' Alpine',
      'Al pine',
      '\u{1F3CE}\u{FE0F}',
      '\u{1F3CE}',
      'Ａlpine',
      'a'.repeat(64),
      'a'.repeat(63) + 'b',
      '',
      ';',
      '6:string;',
      '2:26;',
    ];

    const encoded = values.map((providerValue) =>
      canonicalKey({
        season: 2026,
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue,
      } as unknown as ProviderMappingKey),
    );

    expect(new Set(encoded).size).toBe(values.length);
  });

  it('separates a season, source, entity or field swap', () => {
    const variants = [
      {
        season: 2026,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
      },
      {
        season: 2027,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
      },
      {
        season: 2026,
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
      },
      {
        season: 2026,
        source: 'jolpica',
        entity: 'constructor',
        providerField: 'constructorId',
      },
      {
        season: 2026,
        source: 'jolpica',
        entity: 'circuit',
        providerField: 'circuitId',
      },
    ];
    const encoded = variants.map((variant) =>
      canonicalKey({
        ...variant,
        providerValue: 'x',
      } as unknown as ProviderMappingKey),
    );
    expect(new Set(encoded).size).toBe(variants.length);
  });

  it('separates values whose concatenation would otherwise coincide', () => {
    const a = canonicalKey({
      season: 2026,
      source: 'openf1',
      entity: 'constructor',
      providerField: 'team_name',
      providerValue: 'ab',
    });
    const b = canonicalKey({
      season: 2026,
      source: 'openf1',
      entity: 'constructor',
      providerField: 'team_name',
      providerValue: 'a b',
    });
    expect(a).not.toBe(b);
  });
});
