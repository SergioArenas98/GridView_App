/**
 * What `SnapshotValidator` actually enforces, where deep validation now lives,
 * and what still gates a real adapter.
 *
 * It would be easy to read "snapshot-set contract validation" as deep
 * per-field validation against the published OpenAPI schema. It is not, and it
 * is deliberately still not: the runtime validator checks snapshot
 * **metadata**, the required **top-level shape** of each document, and
 * **provider neutrality** of the body. That is structural, structural is all it
 * claims, and Phase 9B-5 did not widen it - a document reaching publication has
 * already been assembled from validated candidates, so re-deriving the contract
 * at the last write would duplicate the rule in a second place it could drift
 * from.
 *
 * **Deep normalized-contract validation now runs at the coordination
 * boundary** (`providers/coordination/payload-contract.ts`), against the
 * detached snapshot that is the value later selected, assembled and published.
 * An adapter is still the component that *normalizes* provider data; the
 * coordinator is what independently *verifies* the result, exactly as it
 * already refuses to trust an adapter's own outcome shape, attempt accounting
 * or payload ownership.
 *
 * This file pins both scopes so neither claim can drift, and pins the dormancy
 * the remaining gate rests on: no adapter exists, no provider port is
 * registered in production wiring, and `SynchronizationService` is not rewired
 * for coordination.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateDriver } from '../../../src/contract/normalized';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import type { StoredSnapshot } from '../../../src/storage/types';
import { SEASON } from './support';

const sourceRoot = join(__dirname, '..', '..', '..', 'src');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

function documentWith(data: unknown): StoredSnapshot {
  return {
    data,
    meta: {
      apiVersion: '1',
      schemaVersion: 1,
      generatedAt: '2026-07-20T12:00:00.000Z',
      sourceUpdatedAt: '2026-07-18T11:55:00.000Z',
      staleAfter: '2026-07-20T12:15:00.000Z',
      contentVersion: '2026.07.18.1',
      season: SEASON,
    },
    documentName: 'drivers',
    resourceIdentity: `v1:${SEASON}:drivers`,
  };
}

describe('the runtime validator enforces structure, not the deep contract', () => {
  it('accepts a well-formed metadata and top-level shape', () => {
    expect(runtimeSnapshotValidator.validate(documentWith([]))).toEqual([]);
  });

  it('rejects invalid metadata', () => {
    const document = documentWith([]);
    const broken: StoredSnapshot = {
      ...document,
      meta: { ...document.meta, generatedAt: 'not-a-timestamp' },
    };

    expect(runtimeSnapshotValidator.validate(broken).length).toBeGreaterThan(0);
  });

  it('rejects a collection document that is not an array', () => {
    expect(
      runtimeSnapshotValidator.validate(documentWith({ drivers: [] })).length,
    ).toBeGreaterThan(0);
  });

  it('rejects a provider identifier anywhere in the body', () => {
    expect(
      runtimeSnapshotValidator.validate(
        documentWith([{ providerId: 'upstream-42' }]),
      ).length,
    ).toBeGreaterThan(0);
  });

  it('does not validate a driver entry field by field', () => {
    // Every entry here is nonsense as a `SeasonDriverSummary`, and the runtime
    // validator accepts it: the top-level shape is an array and the body names
    // no provider. Its scope is unchanged by Phase 9B-5, deliberately.
    const nonsense = documentWith([
      { driverId: 42, fullName: null, raceNumber: 'one' },
      {},
    ]);

    expect(runtimeSnapshotValidator.validate(nonsense)).toEqual([]);
  });
});

describe('deep validation runs at the coordination boundary instead', () => {
  it('rejects the entity the publication validator accepts structurally', () => {
    const nonsense = { id: 42, fullName: null };

    expect(runtimeSnapshotValidator.validate(documentWith([nonsense]))).toEqual(
      [],
    );
    expect(validateDriver(nonsense, 'data').length).toBeGreaterThan(0);
  });

  it('reports the exact fields, not merely that something was wrong', () => {
    const issues = validateDriver({ id: 42, fullName: null }, 'data');

    expect(
      issues.filter((issue) => issue.path === 'data.id').map((i) => i.code),
    ).toEqual(['type']);
    expect(
      issues
        .filter((issue) => issue.path === 'data.fullName')
        .map((i) => i.code),
    ).toEqual(['null']);
  });

  it('still accepts a contract-valid entity, so the gate can actually open', () => {
    expect(
      validateDriver(
        {
          id: 'max-verstappen',
          fullName: 'Max Verstappen',
          givenName: 'Max',
          familyName: 'Verstappen',
          shortCode: 'VER',
          permanentNumber: 1,
          nationality: 'Dutch',
          countryCode: 'NL',
          dateOfBirth: '1997-09-30',
          placeOfBirth: 'Hasselt',
          biography: null,
          media: null,
        },
        'data',
      ),
    ).toEqual([]);
  });
});

describe('no real coordination port is wired into production', () => {
  const files = sourceFiles(sourceRoot).filter(
    (path) => !path.includes(join('providers', 'coordination')),
  );

  it('constructs no coordinator outside the coordination module', () => {
    const offenders = files.filter((path) =>
      readFileSync(path, 'utf8').includes('new MultiSourceCoordinator'),
    );

    expect(offenders).toEqual([]);
  });

  it('registers no provider resource port anywhere in runtime wiring', () => {
    const offenders = files.filter((path) =>
      readFileSync(path, 'utf8').includes('ProviderResourcePort'),
    );

    expect(offenders).toEqual([]);
  });

  it('keeps the synchronization service on the single-provider path', () => {
    const service = readFileSync(
      join(sourceRoot, 'sync', 'sync-service.ts'),
      'utf8',
    );

    expect(service).not.toContain('coordination');
    expect(service).not.toContain('Coordinator');
  });

  it('leaves the provider factory able to build only the mock or nothing', () => {
    const factory = readFileSync(
      join(sourceRoot, 'providers', 'factory.ts'),
      'utf8',
    );

    expect(factory).toContain('MockFormulaOneProvider');
    expect(factory).not.toContain('Jolpica');
    expect(factory).not.toContain('OpenF1');
    expect(factory).not.toContain('Coordinator');
  });
});
