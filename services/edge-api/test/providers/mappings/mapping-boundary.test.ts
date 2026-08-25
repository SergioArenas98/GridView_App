/**
 * The resolver's runtime boundary.
 *
 * Every test here fails on commit 0eca498, where:
 *
 *   - `resolveUnknown` returned a bare `null` for every malformed input, so a
 *     malformed provider identity was indistinguishable from "no mapping is
 *     required here" and could not raise an operational signal at all;
 *   - `resolve` trusted compile-time typing and applied no runtime validation,
 *     so a padded, empty, control-character, oversized, NaN, Infinity,
 *     negative, zero or non-integer value reached the lookup - with **no cast**
 *     - and came back as an ordinary `unmapped`, carrying the unvalidated
 *     value into the diagnostic log field;
 *   - `ProviderMappingRegistry.valid()` was a public static that minted a
 *     registry from an arbitrary Map, handing out branded GridView identities
 *     for targets that exist in no curated registry;
 *   - construction ignored `kind` and `schemaVersion` entirely.
 */

import { describe, expect, it } from 'vitest';

import {
  ProviderMappingRegistry,
  buildProviderMappingRegistry,
  providerMappingFailureEvent,
  type ProviderMappingKeyFor,
} from '../../../src/providers/mappings';
import { CapturingLogger } from '../../../src/logging/logger';

import { canonical, documentOf, realRegistry, SEASON } from './support';

const registry = realRegistry();

/** A key literal that type-checks but carries an invalid runtime value. */
function typedDriverKey(
  providerValue: string,
): ProviderMappingKeyFor<'driver'> {
  return {
    season: SEASON,
    source: 'jolpica',
    entity: 'driver',
    providerField: 'driverId',
    providerValue,
  };
}

function typedNumberKey(
  providerValue: number,
): ProviderMappingKeyFor<'driver'> {
  return {
    season: SEASON,
    source: 'openf1',
    entity: 'driver',
    providerField: 'driver_number',
    providerValue,
  };
}

function expectInvalidKey(result: {
  outcome: string;
  failure?: { reason: string; providerValue: unknown; keyProblem?: string };
}) {
  expect(result.outcome).toBe('unresolved');
  const failure = result.failure;
  if (failure === undefined) throw new Error('expected a failure');
  expect(failure.reason).toBe('invalid-key');
  // The unvalidated value is never echoed anywhere.
  expect(failure.providerValue).toBeNull();
  expect(failure.keyProblem).toBeTruthy();
  return failure;
}

describe('an untrusted value is rejected explicitly, never as a bare absence', () => {
  it('returns a typed invalid-key failure for every malformed input', () => {
    const cases: readonly [string, unknown][] = [
      ['unknown source', { ...typedDriverKey('x'), source: 'apiSports' }],
      ['mock source', { ...typedDriverKey('x'), source: 'mock' }],
      [
        'mismatched field',
        { ...typedDriverKey('x'), providerField: 'driver_number' },
      ],
      [
        'string where integer required',
        { ...typedNumberKey(1), providerValue: '1' },
      ],
      ['NaN', { ...typedNumberKey(1), providerValue: Number.NaN }],
      [
        'Infinity',
        { ...typedNumberKey(1), providerValue: Number.POSITIVE_INFINITY },
      ],
      ['negative', { ...typedNumberKey(1), providerValue: -1 }],
      ['zero', { ...typedNumberKey(1), providerValue: 0 }],
      ['unsafe integer', { ...typedNumberKey(1), providerValue: 2 ** 53 }],
      ['padded string', typedDriverKey(' norris ')],
      ['empty string', typedDriverKey('')],
      ['newline', typedDriverKey('nor\nris')],
      ['NUL', typedDriverKey(`nor${String.fromCharCode(0)}ris`)],
      ['oversized string', typedDriverKey('x'.repeat(5000))],
      [
        'missing property',
        { season: SEASON, source: 'jolpica', entity: 'driver' },
      ],
      ['out-of-range season', { ...typedDriverKey('norris'), season: 1800 }],
      ['null', null],
      ['number', 42],
      ['string', 'norris'],
      ['array', []],
    ];

    for (const [label, value] of cases) {
      const result = registry.resolveUnknown(value);
      // Never `null`: a malformed identity is not an optional absence.
      expect(result, label).not.toBeNull();
      expectInvalidKey(result);
    }
  });

  it('distinguishes an invalid key from a genuinely unmapped identity', () => {
    const unmapped = registry.resolveUnknown({
      season: SEASON,
      source: 'openf1',
      entity: 'constructor',
      providerField: 'team_name',
      providerValue: 'Cadillac',
    });
    expect(unmapped.outcome).toBe('unresolved');
    if (unmapped.outcome !== 'unresolved') throw new Error('unreachable');
    expect(unmapped.failure.reason).toBe('unmapped');
    // A genuine curation gap still names the value, so an operator can act.
    expect(unmapped.failure.providerValue).toBe('Cadillac');
    expect(unmapped.failure.keyProblem).toBeUndefined();
  });

  it('carries a bounded closed sub-reason', () => {
    expect(expectInvalidKey(registry.resolveUnknown(null)).keyProblem).toBe(
      'not-an-object',
    );
    expect(
      expectInvalidKey(
        registry.resolveUnknown({ ...typedDriverKey('norris'), season: 1800 }),
      ).keyProblem,
    ).toBe('invalid-season');
    expect(
      expectInvalidKey(registry.resolveUnknown(typedDriverKey(' norris ')))
        .keyProblem,
    ).toBe('invalid-value');
    expect(
      expectInvalidKey(
        registry.resolveUnknown({
          ...typedDriverKey('norris'),
          source: 'mock',
        }),
      ).keyProblem,
    ).toBe('invalid-combination');
  });

  it('emits an operational signal for a malformed key, with no raw value', () => {
    const failure = expectInvalidKey(
      registry.resolveUnknown(typedDriverKey(' norris ')),
    );
    const logger = new CapturingLogger();
    logger.warn(
      providerMappingFailureEvent(
        failure as unknown as Parameters<typeof providerMappingFailureEvent>[0],
      ),
    );

    const serialized = logger.serialized();
    expect(serialized).toContain('provider_mapping_unresolved');
    expect(serialized).toContain('invalid-key');
    expect(serialized).toContain('invalid-value');
    // The value that failed validation is never echoed.
    expect(serialized).not.toContain('norris');
    expect(serialized).not.toContain('providerMappingValue');
    // No season is invented for a key that never had a valid one.
    expect(logger.events[0]).not.toHaveProperty('season');
    expect(JSON.parse(serialized)).toBeInstanceOf(Array);
  });
});

describe('a typed caller cannot bypass the runtime invariants', () => {
  it('rejects an invalid string value passed with no cast at all', () => {
    for (const providerValue of [
      ' norris ',
      'norris ',
      ' norris',
      '',
      'nor\nris',
      'nor\rris',
      `nor${String.fromCharCode(0)}ris`,
      `nor${String.fromCharCode(127)}ris`,
      'x'.repeat(65),
    ]) {
      expectInvalidKey(registry.resolve(typedDriverKey(providerValue)));
    }
  });

  it('rejects an invalid numeric value passed with no cast at all', () => {
    for (const providerValue of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -1,
      0,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expectInvalidKey(registry.resolve(typedNumberKey(providerValue)));
    }
  });

  it('rejects an out-of-range season passed with no cast at all', () => {
    for (const season of [Number.NaN, 0, 1800, 3000, 2026.5]) {
      expectInvalidKey(
        registry.resolve({ ...typedDriverKey('norris'), season }),
      );
    }
  });

  it('still resolves a well-formed key', () => {
    expect(registry.resolve(typedDriverKey('norris'))).toEqual({
      outcome: 'resolved',
      gridviewId: 'lando-norris',
    });
    expect(registry.resolve(typedNumberKey(1))).toEqual({
      outcome: 'resolved',
      gridviewId: 'lando-norris',
    });
  });
});

describe('the validated-construction boundary has no structural bypass', () => {
  it('exposes no public factory that skips validation', () => {
    const exposed = Object.getOwnPropertyNames(ProviderMappingRegistry);
    expect(exposed).not.toContain('valid');
    expect(exposed).not.toContain('invalid');
    // `build` is the only public entry point, and it validates.
    expect(exposed).toContain('build');
  });

  it('refuses a document whose kind or schemaVersion is not supported', () => {
    const good = {
      source: 'jolpica',
      entity: 'driver',
      providerField: 'driverId',
      providerValue: 'norris',
      gridviewId: 'lando-norris',
      evidence: 'fixture',
    };

    for (const document of [
      {
        kind: 'media-assets',
        schemaVersion: 2,
        season: SEASON,
        mappings: [good],
      },
      {
        kind: 'provider-mappings',
        schemaVersion: 1,
        season: SEASON,
        mappings: [good],
      },
      {
        kind: 'provider-mappings',
        schemaVersion: 99,
        season: SEASON,
        mappings: [good],
      },
      { kind: 'provider-mappings', season: SEASON, mappings: [good] },
      { schemaVersion: 2, season: SEASON, mappings: [good] },
      {
        kind: 'provider-mappings',
        schemaVersion: '2',
        season: SEASON,
        mappings: [good],
      },
    ]) {
      const built = buildProviderMappingRegistry([document], canonical);
      expect(built.isValid, JSON.stringify(document.kind)).toBe(false);
      expect(built.size).toBe(0);
      expect(built.problems.map((problem) => problem.reason)).toContain(
        'unsupported-document',
      );
    }

    // The well-formed envelope still builds.
    expect(
      buildProviderMappingRegistry([documentOf([good])], canonical).isValid,
    ).toBe(true);
  });

  it('is unaffected by mutation of its inputs after construction', () => {
    const records: Record<string, unknown>[] = [
      {
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'norris',
        gridviewId: 'lando-norris',
        evidence: 'fixture',
      },
    ];
    const drivers = new Set(['lando-norris']);
    const document = documentOf(records);
    const built = buildProviderMappingRegistry([document], {
      driver: drivers,
      constructor: new Set(),
      circuit: new Set(),
    });
    expect(built.isValid).toBe(true);

    records[0]!.gridviewId = 'max-verstappen';
    records.push({ nonsense: true });
    document.mappings = [];
    drivers.clear();

    expect(built.resolve(typedDriverKey('norris'))).toEqual({
      outcome: 'resolved',
      gridviewId: 'lando-norris',
    });
    expect(built.size).toBe(1);
    expect(Object.isFrozen(built.problems)).toBe(true);
  });
});
