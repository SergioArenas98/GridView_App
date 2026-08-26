/**
 * The runtime enforces one mapping document per season.
 *
 * Every test here fails on commit 4fa738d, where the builder accepted any
 * number of same-season documents and merged them into one index. The
 * module-scope registry imports exactly one canonical document per season, so
 * a second build-time document could diverge from what actually ships — and
 * the first would silently shadow nothing while the rest quietly contributed
 * entries no evidence corpus had approved.
 *
 * The build-time half of this invariant lives in
 * `test/scripts/provider-mapping-document-set.test.mjs`.
 */

import { describe, expect, it } from 'vitest';

import { buildProviderMappingRegistry } from '../../../src/providers/mappings';

import { canonical, key, SEASON } from './support';

const norris = {
  source: 'jolpica',
  entity: 'driver',
  providerField: 'driverId',
  providerValue: 'norris',
  gridviewId: 'lando-norris',
  evidence: 'fixture',
};

const mclaren = {
  source: 'jolpica',
  entity: 'constructor',
  providerField: 'constructorId',
  providerValue: 'mclaren',
  gridviewId: 'mclaren',
  evidence: 'fixture',
};

const document = (season: number, mappings: readonly unknown[]) => ({
  kind: 'provider-mappings',
  schemaVersion: 2,
  season,
  mappings,
});

const norrisKey = key<'driver'>({
  season: SEASON,
  source: 'jolpica',
  entity: 'driver',
  providerField: 'driverId',
  providerValue: 'norris',
});

function expectDuplicateRejected(documents: readonly unknown[]) {
  const registry = buildProviderMappingRegistry(documents, canonical);
  expect(registry.isValid).toBe(false);
  expect(registry.size).toBe(0);
  expect(registry.problems.map((problem) => problem.reason)).toContain(
    'duplicate-season-document',
  );
  return registry;
}

describe('a second document for the same season invalidates the registry', () => {
  // Case 11
  it('rejects two disjoint valid 2026 documents', () => {
    expectDuplicateRejected([
      document(SEASON, [norris]),
      document(SEASON, [mclaren]),
    ]);
  });

  // Case 12
  it('rejects them in reverse order too', () => {
    expectDuplicateRejected([
      document(SEASON, [mclaren]),
      document(SEASON, [norris]),
    ]);
  });

  it('rejects an empty second document', () => {
    expectDuplicateRejected([document(SEASON, [norris]), document(SEASON, [])]);
    expectDuplicateRejected([document(SEASON, []), document(SEASON, [norris])]);
  });

  it('rejects two identical documents', () => {
    expectDuplicateRejected([
      document(SEASON, [norris]),
      document(SEASON, [norris]),
    ]);
  });

  // Case 13
  it('exposes no valid subset after the failure', () => {
    const registry = expectDuplicateRejected([
      document(SEASON, [norris]),
      document(SEASON, [mclaren]),
    ]);

    // The entry from the first document does not survive, and repeated
    // resolution keeps answering registry-invalid.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = registry.resolve(norrisKey);
      expect(result.outcome).toBe('unresolved');
      if (result.outcome !== 'unresolved') throw new Error('unreachable');
      expect(result.failure.reason).toBe('registry-invalid');
    }
    expect(registry.size).toBe(0);
  });

  it('does not let one document shadow another', () => {
    // Same key, different targets, in two same-season documents: this must be
    // a document-level rejection, never a last-entry-wins overwrite.
    const registry = expectDuplicateRejected([
      document(SEASON, [norris]),
      document(SEASON, [{ ...norris, gridviewId: 'max-verstappen' }]),
    ]);
    expect(registry.isValid).toBe(false);
  });
});

describe('different seasons remain independent', () => {
  // Case 14
  it('accepts one document per season across several seasons', () => {
    const registry = buildProviderMappingRegistry(
      [
        document(2026, [norris]),
        document(2027, [{ ...norris, gridviewId: 'max-verstappen' }]),
      ],
      canonical,
    );

    expect(registry.problems).toEqual([]);
    expect(registry.isValid).toBe(true);
    expect(registry.size).toBe(2);

    expect(registry.resolve(norrisKey)).toEqual({
      outcome: 'resolved',
      gridviewId: 'lando-norris',
    });
    expect(
      registry.resolve(
        key<'driver'>({
          season: 2027,
          source: 'jolpica',
          entity: 'driver',
          providerField: 'driverId',
          providerValue: 'norris',
        }),
      ),
    ).toEqual({ outcome: 'resolved', gridviewId: 'max-verstappen' });
  });

  it('still accepts a single document, as the canonical content does', () => {
    const registry = buildProviderMappingRegistry(
      [document(SEASON, [norris, mclaren])],
      canonical,
    );
    expect(registry.problems).toEqual([]);
    expect(registry.size).toBe(2);
  });
});
