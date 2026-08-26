/**
 * A provider mapping key is a closed shape.
 *
 * Every test here fails on commit 8f419e0, where the runtime decoder ignored
 * additional properties while the curated JSON Schema rejected them. An object
 * carrying a valid key *plus* a second identity representation - `gridviewId`,
 * `target`, `providerId` - decoded and resolved happily. Nothing read the
 * smuggled field, but a future adapter that spreads the same object into a
 * domain record would carry it along, which is a confused-deputy hazard rather
 * than a theoretical one.
 *
 * Property reads also walked the prototype chain, so an object could supply a
 * key field it did not own.
 */

import { describe, expect, it } from 'vitest';

import {
  buildProviderMappingRegistry,
  decodeProviderMappingKey,
  providerKeyProblems,
  providerMappingFailureEvent,
  type ProviderMappingKeyFor,
} from '../../../src/providers/mappings';
import { CapturingLogger } from '../../../src/logging/logger';

import { canonical, documentOf, realRegistry, SEASON } from './support';

const registry = realRegistry();

/** The exact five properties a key may carry, and nothing else. */
const validKey = {
  season: SEASON,
  source: 'jolpica',
  entity: 'driver',
  providerField: 'driverId',
  providerValue: 'norris',
} as const;

const curatedRecord = {
  source: 'jolpica',
  entity: 'driver',
  providerField: 'driverId',
  providerValue: 'norris',
  gridviewId: 'lando-norris',
  evidence: 'fixture',
};

const registries = {
  driver: new Set(['lando-norris']),
  constructor: new Set<string>(),
  circuit: new Set<string>(),
};

describe('the key decoder rejects any additional property', () => {
  it('declares unexpected-property as a bounded problem reason', () => {
    expect(providerKeyProblems).toContain('unexpected-property');
  });

  it('rejects an otherwise-valid key carrying a smuggled field', () => {
    const extras: readonly [string, unknown][] = [
      ['providerId', 'mock-drv-001'],
      ['gridviewId', 'max-verstappen'],
      ['target', 'max-verstappen'],
      ['kind', 'provider-mappings'],
      ['providerValueType', 'string'],
      ['resolved', true],
      ['mock', true],
      ['constructor', 'evil'],
      ['evidence', 'not part of a key'],
      ['note', 'not part of a key'],
    ];

    for (const [property, value] of extras) {
      const decoded = decodeProviderMappingKey({
        ...validKey,
        [property]: value,
      });
      expect(decoded.ok, property).toBe(false);
      if (decoded.ok) throw new Error('unreachable');
      expect(decoded.problem, property).toBe('unexpected-property');
    }
  });

  it('rejects a __proto__ key that arrived as real own data', () => {
    // JSON round-tripping turns `__proto__` into an ordinary own property.
    const parsed = JSON.parse(
      '{"season":2026,"source":"jolpica","entity":"driver",' +
        '"providerField":"driverId","providerValue":"norris",' +
        '"__proto__":{"polluted":true}}',
    ) as unknown;

    const decoded = decodeProviderMappingKey(parsed);
    expect(decoded.ok).toBe(false);
    if (decoded.ok) throw new Error('unreachable');
    expect(decoded.problem).toBe('unexpected-property');

    // And nothing was polluted along the way.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects a missing property as well as an extra one', () => {
    const incomplete: Record<string, unknown> = { ...validKey };
    delete incomplete.providerValue;
    const decoded = decodeProviderMappingKey(incomplete);
    expect(decoded.ok).toBe(false);
    if (decoded.ok) throw new Error('unreachable');
    expect(decoded.problem).toBe('unexpected-property');
  });

  it('does not let a prototype supply a key field', () => {
    const proto = { providerValue: 'norris' };
    const inherited = Object.create(proto) as Record<string, unknown>;
    inherited.season = SEASON;
    inherited.source = 'jolpica';
    inherited.entity = 'driver';
    inherited.providerField = 'driverId';

    // `providerValue` is readable but not owned, so this is not a key.
    expect((inherited as { providerValue?: string }).providerValue).toBe(
      'norris',
    );
    const decoded = decodeProviderMappingKey(inherited);
    expect(decoded.ok).toBe(false);
    if (decoded.ok) throw new Error('unreachable');
    expect(decoded.problem).toBe('unexpected-property');
  });

  it('accepts a null-prototype object with exactly the right own properties', () => {
    // Deliberate: building a key without inheriting anything is legitimate.
    const bare = Object.assign(Object.create(null), validKey) as object;
    const decoded = decodeProviderMappingKey(bare);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error('unreachable');
    expect(decoded.key.providerValue).toBe('norris');
  });

  it('still accepts the exact five-property key', () => {
    expect(decodeProviderMappingKey(validKey).ok).toBe(true);
  });
});

describe('resolution rejects a smuggled identity on both entry points', () => {
  it('resolveUnknown returns invalid-key, not a resolved identity', () => {
    const result = registry.resolveUnknown({
      ...validKey,
      gridviewId: 'max-verstappen',
      target: 'max-verstappen',
      providerId: 'mock-drv-001',
    });

    expect(result.outcome).toBe('unresolved');
    if (result.outcome !== 'unresolved') throw new Error('unreachable');
    expect(result.failure.reason).toBe('invalid-key');
    expect(result.failure.keyProblem).toBe('unexpected-property');
    expect(result.failure.providerValue).toBeNull();
  });

  it('direct resolve() rejects it too', () => {
    const key = {
      ...validKey,
      gridviewId: 'max-verstappen',
    } as unknown as ProviderMappingKeyFor<'driver'>;

    const result = registry.resolve(key);
    expect(result.outcome).toBe('unresolved');
    if (result.outcome !== 'unresolved') throw new Error('unreachable');
    expect(result.failure.reason).toBe('invalid-key');
    expect(result.failure.keyProblem).toBe('unexpected-property');
  });

  it('logs the bounded reason without echoing the extra key or value', () => {
    const result = registry.resolveUnknown({
      ...validKey,
      smuggledProperty: 'smuggledValue',
    });
    if (result.outcome !== 'unresolved') throw new Error('unreachable');

    const logger = new CapturingLogger();
    logger.warn(providerMappingFailureEvent(result.failure));
    const serialized = logger.serialized();

    expect(serialized).toContain('unexpected-property');
    // Neither the offending property name nor its value reaches the log.
    expect(serialized).not.toContain('smuggledProperty');
    expect(serialized).not.toContain('smuggledValue');
    // Nor does the otherwise-valid provider value.
    expect(serialized).not.toContain('norris');
    expect(serialized).not.toContain('providerMappingValue');
    expect(JSON.parse(serialized)).toBeInstanceOf(Array);
  });
});

describe('curated documents and records are closed shapes too', () => {
  it('rejects an unexpected top-level document property', () => {
    const built = buildProviderMappingRegistry(
      [{ ...documentOf([curatedRecord]), smuggled: 'ignored' }],
      registries,
    );

    expect(built.isValid).toBe(false);
    expect(built.size).toBe(0);
    expect(built.problems.map((problem) => problem.reason)).toContain(
      'unexpected-property',
    );
  });

  it('rejects an unexpected mapping-record property', () => {
    const built = buildProviderMappingRegistry(
      [documentOf([{ ...curatedRecord, smuggled: 'ignored' }])],
      registries,
    );

    expect(built.isValid).toBe(false);
    expect(built.size).toBe(0);
    expect(built.problems.map((problem) => problem.reason)).toContain(
      'unexpected-property',
    );
  });

  it('still accepts the documented optional curated fields', () => {
    const built = buildProviderMappingRegistry(
      [
        {
          $schema: '../../schemas/provider-mappings.schema.json',
          kind: 'provider-mappings',
          schemaVersion: 2,
          status: 'development',
          note: 'a curated note',
          season: SEASON,
          mappings: [{ ...curatedRecord, note: 'a per-record note' }],
        },
      ],
      registries,
    );

    expect(built.problems).toEqual([]);
    expect(built.isValid).toBe(true);
    expect(built.size).toBe(1);
  });

  it('keeps the real curated content valid', () => {
    expect(realRegistry().problems).toEqual([]);
    expect(realRegistry().isValid).toBe(true);
    expect(canonical.driver.size).toBeGreaterThan(0);
  });
});
