/**
 * Rollback republication and its source-ordering provenance matrix
 * (ADR 0025 D8; Phase 9B-6b task §9).
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import { MemoryCachePurgeAdapter } from '../../../src/cache/purge';
import { versionNamespace } from '../../../src/publication/sequencer';
import { resolveRollbackSourceOrdering } from '../../../src/publication/sequenced/rollback-provenance';
import { SequencedPublicationService } from '../../../src/publication/sequenced/service';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import { activeKey, previousKey } from '../../../src/storage/keys';
import type {
  SnapshotDocumentName,
  StoredSnapshot,
} from '../../../src/storage/types';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import {
  SEASON,
  SEED_VERSION,
  SidecarReadFailingStorage,
  countingPort,
  generatedSet,
  sequencedContext,
} from './support';

const PM1 = 'pm1-000000000002a-0000abcd';
const LEGACY = '20260701T000000000-deadbeef';
const ORDERING = '2026-06-01T00:00:00.000Z';

function doc(
  name: string,
  sourceUpdatedAt: string | undefined,
): StoredSnapshot {
  return {
    documentName: name as SnapshotDocumentName,
    data: {},
    resourceIdentity: `v1:${SEASON}:${name}`,
    meta: {
      apiVersion: '1',
      schemaVersion: 1,
      generatedAt: '2026-06-01T00:00:00.000Z',
      staleAfter: '2026-06-01T00:15:00.000Z',
      contentVersion: '2026.06.01.1',
      season: SEASON,
      ...(sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt }),
    } as StoredSnapshot['meta'],
  };
}

function docMap(
  entries: Array<[string, string | undefined]>,
): ReadonlyMap<SnapshotDocumentName, StoredSnapshot> {
  return new Map(
    entries.map(([name, ts]) => [name as SnapshotDocumentName, doc(name, ts)]),
  );
}

describe('resolveRollbackSourceOrdering: the full matrix', () => {
  const uniformDocs = docMap([
    ['calendar', ORDERING],
    ['drivers', ORDERING],
  ]);

  it('a valid sidecar is used verbatim in either namespace', async () => {
    for (const version of [PM1, LEGACY]) {
      const storage = new MemorySnapshotStorage();
      await storage.writePublicationMetadata(SEASON, version, {
        schemaVersion: 1,
        sourceOrderingInput: ORDERING,
      });
      const result = await resolveRollbackSourceOrdering(
        storage,
        SEASON,
        version,
        uniformDocs,
      );
      expect(result).toEqual({
        kind: 'resolved',
        sourceOrderingInput: ORDERING,
        classification: 'sidecar',
      });
    }
  });

  it('an absent sidecar on a pm1 version fails closed even with uniform documents', async () => {
    const result = await resolveRollbackSourceOrdering(
      new MemorySnapshotStorage(),
      SEASON,
      PM1,
      uniformDocs,
    );
    expect(result).toEqual({
      kind: 'rejected',
      classification: 'absent-sidecar-required',
    });
  });

  it('an absent sidecar on a legacy version with uniform timestamps resolves', async () => {
    const result = await resolveRollbackSourceOrdering(
      new MemorySnapshotStorage(),
      SEASON,
      LEGACY,
      uniformDocs,
    );
    expect(result).toEqual({
      kind: 'resolved',
      sourceOrderingInput: ORDERING,
      classification: 'legacy-uniform-documents',
    });
  });

  it('non-uniform legacy timestamps fail closed', async () => {
    const result = await resolveRollbackSourceOrdering(
      new MemorySnapshotStorage(),
      SEASON,
      LEGACY,
      docMap([
        ['calendar', ORDERING],
        ['drivers', '2026-06-02T00:00:00.000Z'],
      ]),
    );
    expect(result.kind).toBe('rejected');
    expect(result).toMatchObject({
      classification: 'legacy-non-uniform-document-timestamps',
    });
  });

  it('a missing legacy timestamp fails closed', async () => {
    const result = await resolveRollbackSourceOrdering(
      new MemorySnapshotStorage(),
      SEASON,
      LEGACY,
      docMap([
        ['calendar', ORDERING],
        ['drivers', undefined],
      ]),
    );
    expect(result).toMatchObject({
      kind: 'rejected',
      classification: 'legacy-missing-document-timestamp',
    });
  });

  it('a malformed sidecar fails closed in either namespace', async () => {
    for (const version of [PM1, LEGACY]) {
      const storage = new MemorySnapshotStorage();
      await storage.writePublicationMetadata(SEASON, version, {
        schemaVersion: 9,
        sourceOrderingInput: ORDERING,
      } as never);
      const result = await resolveRollbackSourceOrdering(
        storage,
        SEASON,
        version,
        uniformDocs,
      );
      expect(result).toMatchObject({
        kind: 'rejected',
        classification: 'malformed-sidecar',
      });
    }
  });

  it('an unreadable sidecar fails closed and is never treated as absent', async () => {
    for (const version of [PM1, LEGACY]) {
      const inner = new MemorySnapshotStorage();
      // Even with a valid record present, the failing read must reject.
      await inner.writePublicationMetadata(SEASON, version, {
        schemaVersion: 1,
        sourceOrderingInput: ORDERING,
      });
      const storage = new SidecarReadFailingStorage(inner);
      storage.failReadFor = version;
      const result = await resolveRollbackSourceOrdering(
        storage,
        SEASON,
        version,
        uniformDocs,
      );
      expect(result).toMatchObject({
        kind: 'rejected',
        classification: 'unreadable-sidecar',
      });
    }
  });

  it('a transient null on a pm1 version rejects rather than inferring from documents', async () => {
    // A not-yet-propagated read: the first read is null, and D8 requires it to
    // reject there rather than wait or infer.
    const result = await resolveRollbackSourceOrdering(
      new MemorySnapshotStorage(),
      SEASON,
      PM1,
      uniformDocs,
    );
    expect(result.kind).toBe('rejected');
  });
});

describe('rollback republication through the two-phase protocol', () => {
  it('republishes a pm1 target as a new pm1 version with its own sidecar', async () => {
    const ctx = await sequencedContext();
    const first = await ctx.service.publish(
      await generatedSet(ctx.clock, 'x', {
        sourceUpdatedAt: '2026-07-20T00:00:00.000Z',
        contentVersion: '2026.07.20.a',
      }),
    );
    const second = await ctx.service.publish(
      await generatedSet(ctx.clock, 'x', {
        sourceUpdatedAt: '2026-07-21T00:00:00.000Z',
        contentVersion: '2026.07.21.b',
      }),
    );
    expect(second.status).toBe('applied');

    const rollback = await ctx.service.rollback(SEASON, first.version);
    expect(rollback.status).toBe('applied');
    expect(rollback.version).not.toBe(first.version);
    expect(versionNamespace(rollback.version)).toBe('sidecar-required');

    const authority = await ctx.port.readAuthority(SEASON);
    expect(authority).toMatchObject({ activeVersion: rollback.version });
    // No legacy pointer flip.
    expect(await ctx.storage.getActiveVersion(SEASON)).toBe(SEED_VERSION);
  });

  it('rolls back to a legacy-format target via the uniform-document fallback', async () => {
    const ctx = await sequencedContext();
    await ctx.service.publish(
      await generatedSet(ctx.clock, 'x', {
        sourceUpdatedAt: '2026-07-20T00:00:00.000Z',
        contentVersion: '2026.07.20.a',
      }),
    );
    // SEED_VERSION (legacy-format, uniform timestamps) is now the previous.
    const rollback = await ctx.service.rollback(SEASON, SEED_VERSION);
    expect(rollback.status).toBe('applied');
    expect(versionNamespace(rollback.version)).toBe('sidecar-required');
  });

  it('rejects an unresolvable provenance before prepare and leaves the release serving', async () => {
    const ctx = await sequencedContext();
    const spy = countingPort(ctx.port);
    const service = new SequencedPublicationService({
      port: spy,
      fallback: ctx.legacy,
      storage: ctx.storage,
      validator: runtimeSnapshotValidator,
      purger: ctx.purger,
      logger: ctx.logger,
      clock: ctx.clock,
    });
    const first = await service.publish(
      await generatedSet(ctx.clock, 'x', {
        sourceUpdatedAt: '2026-07-20T00:00:00.000Z',
        contentVersion: '2026.07.20.a',
      }),
    );
    await service.publish(
      await generatedSet(ctx.clock, 'x', {
        sourceUpdatedAt: '2026-07-21T00:00:00.000Z',
        contentVersion: '2026.07.21.b',
      }),
    );
    // Break the pm1 target's provenance.
    await ctx.storage.deletePublicationMetadata(SEASON, first.version);
    spy.calls.length = 0;
    ctx.storage.writeLog.length = 0;

    const rollback = await service.rollback(SEASON, first.version);
    expect(rollback.status).toBe('rejected');
    expect(rollback.reason).toBe('rollback-source-ordering-unavailable');
    expect(spy.calls).not.toContain('prepare');

    // No pointer moved by the rejected attempt.
    expect(ctx.storage.writeLog).not.toContain(activeKey(SEASON));
    expect(ctx.storage.writeLog).not.toContain(previousKey(SEASON));
  });

  it('admits a rollback whose ordering input is older than what is committed', async () => {
    const ctx = await sequencedContext();
    const older = await ctx.service.publish(
      await generatedSet(ctx.clock, 'x', {
        sourceUpdatedAt: '2026-07-15T00:00:00.000Z',
        contentVersion: '2026.07.15.a',
      }),
    );
    await ctx.service.publish(
      await generatedSet(ctx.clock, 'x', {
        sourceUpdatedAt: '2026-07-25T00:00:00.000Z',
        contentVersion: '2026.07.25.b',
      }),
    );
    // committed ordering is now 2026-07-25; the rollback target's is 2026-07-15.
    const rollback = await ctx.service.rollback(SEASON, older.version);
    expect(rollback.status).toBe('applied');
    // The rollback committed its own historical ordering input (D8), so the
    // committed baseline moved *backward* to 2026-07-15.

    // An ordinary publish strictly older than that new baseline is still
    // rejected exactly as before - the exemption is scoped to the rollback.
    const ordinary = await ctx.service.publish(
      await generatedSet(ctx.clock, 'x', {
        sourceUpdatedAt: '2026-07-09T00:00:00.000Z',
        contentVersion: '2026.07.09.c',
      }),
    );
    expect(ordinary.reason).toBe('older-source-updated-at');
  });

  it('never constructs a provider', () => {
    // Structural: the service's dependencies contain no provider port, so a
    // rollback cannot contact one however its data is resolved.
    const deps = Object.getOwnPropertyNames(
      new SequencedPublicationService({
        port: countingPort(),
        fallback: new (class {
          publish = async () => ({}) as never;
          rollback = async () => ({}) as never;
          purgeActiveVersion = async () => ({}) as never;
        })(),
        storage: new MemorySnapshotStorage(),
        validator: runtimeSnapshotValidator,
        purger: new MemoryCachePurgeAdapter(),
        logger: new CapturingLogger(),
      }),
    );
    expect(deps).not.toContain('provider');
  });
});
