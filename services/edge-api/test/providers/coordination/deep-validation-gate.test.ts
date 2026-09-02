/**
 * What `SnapshotValidator` actually enforces, and what still gates a real
 * adapter.
 *
 * It would be easy to read "snapshot-set contract validation" as deep
 * per-field validation against the published OpenAPI schema. It is not. The
 * runtime validator checks snapshot **metadata**, the required **top-level
 * shape** of each document, and **provider neutrality** of the body. That is
 * structural, and structural is all it claims.
 *
 * Deep normalized-contract validation is an **adapter** responsibility: the
 * adapter is the component that turns provider data into the public contract
 * types, so it is the only place holding both. This file pins the real scope of
 * the validator so the claim cannot drift, and pins the dormancy the gate rests
 * on: no adapter exists, no provider port is registered in production wiring,
 * and `SynchronizationService` is not rewired for coordination.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

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
    // no provider. This is the gap a real adapter has to close in its own
    // normalization, and it is why registering one is gated on that.
    const nonsense = documentWith([
      { driverId: 42, fullName: null, raceNumber: 'one' },
      {},
    ]);

    expect(runtimeSnapshotValidator.validate(nonsense)).toEqual([]);
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
