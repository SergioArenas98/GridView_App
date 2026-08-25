/**
 * Fail-closed registry construction.
 *
 * Required cases 25-39.
 */

import { describe, expect, it } from 'vitest';

import {
  buildProviderMappingRegistry,
  type CanonicalRegistries,
} from '../../../src/providers/mappings';

import { canonical, key, record, registryOf, SEASON } from './support';

/** Builds a registry and asserts it refused to expose an index. */
function expectRejected(
  mappings: readonly unknown[],
  reason: string,
  registries: CanonicalRegistries = canonical,
) {
  const registry = buildProviderMappingRegistry(
    [{ season: SEASON, mappings }],
    registries,
  );
  expect(registry.isValid).toBe(false);
  expect(registry.size).toBe(0);
  expect(registry.problems.map((problem) => problem.reason)).toContain(reason);
  return registry;
}

describe('a malformed registry never becomes a usable index', () => {
  // Case 25
  it('rejects a duplicated identical complete key', () => {
    expectRejected([record(), record()], 'duplicate-key');
  });

  // Case 26
  it('rejects a repeated complete key with a different target', () => {
    expectRejected(
      [record(), record({ gridviewId: 'max-verstappen' })],
      'ambiguous-key',
    );
  });

  // Case 27
  it('rejects a dangling target ID', () => {
    expectRejected([record({ gridviewId: 'nobody-at-all' })], 'target-missing');
  });

  // Case 28
  it('rejects a target of the wrong entity kind', () => {
    // `mclaren` is a real canonical ID, but it is a constructor, not a driver.
    expectRejected([record({ gridviewId: 'mclaren' })], 'target-missing');
    // And a driver ID may not be the target of a circuit mapping.
    expectRejected(
      [
        record({
          entity: 'circuit',
          providerField: 'circuitId',
          providerValue: 'monza',
          gridviewId: 'lando-norris',
        }),
      ],
      'target-missing',
    );
  });

  // Case 29
  it('rejects an unknown provider source', () => {
    for (const source of ['mock', 'apiSports', 'ergast', '', 'JOLPICA']) {
      expectRejected([record({ source })], 'invalid-key-combination');
    }
  });

  // Case 30
  it('rejects an invalid source/entity/field combination', () => {
    expectRejected(
      [record({ source: 'openf1', providerField: 'driverId' })],
      'invalid-key-combination',
    );
    expectRejected(
      [record({ entity: 'constructor', providerField: 'driverId' })],
      'invalid-key-combination',
    );
    expectRejected(
      [record({ providerField: 'team_name' })],
      'invalid-key-combination',
    );
    expectRejected(
      [record({ entity: 'meeting', providerField: 'meeting_key' })],
      'invalid-key-combination',
    );
  });

  // Case 31
  it('rejects a provider value of the wrong type', () => {
    // A Jolpica slug field given an integer.
    expectRejected([record({ providerValue: 4 })], 'invalid-key-combination');
    // An OpenF1 driver_number given a string.
    expectRejected(
      [
        record({
          source: 'openf1',
          providerField: 'driver_number',
          providerValue: '1',
        }),
      ],
      'invalid-key-combination',
    );
    for (const providerValue of [null, true, {}, [], undefined]) {
      expectRejected([record({ providerValue })], 'invalid-key-combination');
    }
  });

  // Case 32
  it('rejects an empty provider value', () => {
    expectRejected([record({ providerValue: '' })], 'invalid-key-combination');
  });

  // Case 33
  it('rejects leading or trailing whitespace in curated data', () => {
    for (const providerValue of [
      ' norris',
      'norris ',
      ' norris ',
      '\tnorris',
    ]) {
      expectRejected([record({ providerValue })], 'invalid-key-combination');
    }
  });

  // Case 34
  it('rejects an unsafe, negative, zero or non-integer numeric value', () => {
    const numeric = (providerValue: unknown) =>
      record({
        source: 'openf1',
        entity: 'driver',
        providerField: 'driver_number',
        providerValue,
        gridviewId: 'lando-norris',
      });

    for (const providerValue of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      2 ** 53,
    ]) {
      expectRejected([numeric(providerValue)], 'invalid-key-combination');
    }

    // The boundary itself is accepted.
    const atBoundary = registryOf([numeric(Number.MAX_SAFE_INTEGER)]);
    expect(atBoundary.isValid).toBe(true);
  });

  // Case 35 - an unknown property is rejected structurally by the schema
  // (additionalProperties: false); the runtime independently refuses a record
  // whose target does not follow the public-ID grammar.
  it('rejects a target that is not a public GridView ID', () => {
    for (const gridviewId of [
      'Lando-Norris',
      'lando_norris',
      'driver:lando-norris',
      'lando norris',
      '-lando',
      'lando-',
      '',
      42,
      null,
    ]) {
      expectRejected([record({ gridviewId })], 'invalid-target-grammar');
    }
  });

  // Case 36
  it('rejects a malformed top-level object', () => {
    for (const document of [
      null,
      undefined,
      42,
      'nope',
      [],
      { season: 2026 },
    ]) {
      const registry = buildProviderMappingRegistry([document], canonical);
      expect(registry.isValid).toBe(false);
      expect(registry.size).toBe(0);
    }
    // A record that is not an object at all.
    expectRejected([null], 'invalid-record');
    expectRejected(['norris'], 'invalid-record');
  });

  // Case 37 and 38
  it('exposes no valid subset when one record is invalid', () => {
    const good = record();
    const alsoGood = record({
      entity: 'constructor',
      providerField: 'constructorId',
      providerValue: 'mclaren',
      gridviewId: 'mclaren',
    });
    const bad = record({
      providerValue: 'ghost',
      gridviewId: 'not-a-real-driver',
    });

    // Every record before it validated, and one after it would too.
    const registry = registryOf([good, bad, alsoGood]);

    expect(registry.isValid).toBe(false);
    expect(registry.size).toBe(0);

    // The records that were individually fine are not resolvable either.
    const lookup = key<'driver'>({
      season: SEASON,
      source: 'jolpica',
      entity: 'driver',
      providerField: 'driverId',
      providerValue: 'norris',
    });
    const result = registry.resolve(lookup);
    expect(result.outcome).toBe('unresolved');
    if (result.outcome !== 'unresolved') throw new Error('unreachable');
    expect(result.failure.reason).toBe('registry-invalid');
  });

  // Case 39
  it('has no last-entry-wins behaviour', () => {
    const first = record({ gridviewId: 'lando-norris' });
    const second = record({ gridviewId: 'max-verstappen' });

    // Both orders fail, and neither target survives.
    for (const mappings of [
      [first, second],
      [second, first],
    ]) {
      const registry = registryOf(mappings);
      expect(registry.isValid).toBe(false);
      expect(registry.size).toBe(0);
      expect(registry.problems.map((p) => p.reason)).toContain('ambiguous-key');
    }
  });

  it('reports every problem rather than stopping at the first', () => {
    const registry = registryOf([
      record({ gridviewId: 'nobody' }),
      record({ source: 'mock' }),
      record({ providerValue: '' }),
    ]);
    expect(registry.problems.length).toBe(3);
  });

  it('names the failing record so an operator can find it', () => {
    const registry = registryOf([record(), record({ gridviewId: 'nobody' })]);
    expect(registry.problems[0]?.at).toBe('documents[0].mappings[1]');
  });
});

describe('the invalid registry stays inert', () => {
  it('answers registry-invalid for every lookup, and never resolves', () => {
    const registry = registryOf([record({ gridviewId: 'nobody' })]);

    for (const lookup of [
      key<'driver'>({
        season: SEASON,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'norris',
      }),
      key<'constructor'>({
        season: SEASON,
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue: 'Mercedes',
      }),
    ]) {
      const result = registry.resolve(lookup);
      expect(result.outcome).toBe('unresolved');
      if (result.outcome !== 'unresolved') throw new Error('unreachable');
      expect(result.failure.reason).toBe('registry-invalid');
    }
  });

  it('keeps ambiguous and target-missing as distinct defensive categories', () => {
    // They are unreachable through a *successfully* constructed registry,
    // which is the point: construction is what rejects them.
    const reasons = new Set([
      ...registryOf([
        record(),
        record({ gridviewId: 'max-verstappen' }),
      ]).problems.map((p) => p.reason),
      ...registryOf([record({ gridviewId: 'nobody' })]).problems.map(
        (p) => p.reason,
      ),
    ]);
    expect(reasons).toContain('ambiguous-key');
    expect(reasons).toContain('target-missing');
  });
});
