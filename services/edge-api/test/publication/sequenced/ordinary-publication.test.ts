/**
 * Ordinary publication through the two-phase protocol (ADR 0025 D3, D4;
 * Phase 9B-6b task §9).
 *
 * Every assertion is over the sequencer's own authority record and the stored
 * KV documents - never over a Cloudflare platform guarantee.
 */

import { describe, expect, it } from 'vitest';

import { versionNamespace } from '../../../src/publication/sequencer';
import { buildPublicationPlan } from '../../../src/publication/sequenced/manifest-plan';
import { readStoredPublicationMetadata } from '../../../src/publication/publication-metadata';
import { readStoredInventory } from '../../../src/publication/version-inventory';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import { activeKey, previousKey } from '../../../src/storage/keys';
import {
  SEASON,
  SEED_HIGH_WATER_MARK,
  SEED_VERSION,
  generatedSet,
  sequencedContext,
} from './support';

const LATER_ORDERING = '2026-07-20T00:00:00.000Z';
const FRESH_TIMESTAMP = '2026-07-20T12:00:00.000Z'; // the fixed test clock

async function changedSet(clock: Parameters<typeof generatedSet>[0]) {
  return generatedSet(clock, 'ignored-by-sequencer', {
    sourceUpdatedAt: LATER_ORDERING,
    contentVersion: '2026.07.20.2',
  });
}

describe('the plan is version-independent and deterministic', () => {
  it('produces the same manifest commitment however the documents are ordered', async () => {
    const ctx = await sequencedContext();
    const set = await changedSet(ctx.clock);
    const a = await buildPublicationPlan(set.documents);
    const b = await buildPublicationPlan([...set.documents].reverse());
    expect(a.expectedManifestCommitment).toBe(b.expectedManifestCommitment);
    expect(a.documentNames).toEqual(b.documentNames);
    expect(a.perKeyRevisions.map((r) => r.documentName)).toEqual(
      a.documentNames,
    );
    // Nothing in the plan mentions a version.
    expect(JSON.stringify(a)).not.toContain('pm1-');
  });
});

describe('the committed release', () => {
  it('is a sequencer-allocated pm1 version the caller never chose', async () => {
    const ctx = await sequencedContext();
    const result = await ctx.service.publish(await changedSet(ctx.clock));

    expect(result.status).toBe('applied');
    expect(result.version).not.toBe('ignored-by-sequencer');
    expect(result.version).not.toBe(SEED_VERSION);
    expect(versionNamespace(result.version)).toBe('sidecar-required');
    expect(result.previousVersion).toBe(SEED_VERSION);
    expect(result.pointerMaintenance).toBe('not-required');

    const authority = await ctx.port.readAuthority(SEASON);
    expect(authority).toMatchObject({
      cutoverState: 'active',
      activeVersion: result.version,
      previousVersion: SEED_VERSION,
    });
  });

  it('writes no legacy active or previous KV pointer', async () => {
    const ctx = await sequencedContext();
    ctx.storage.writeLog.length = 0;
    await ctx.service.publish(await changedSet(ctx.clock));

    expect(ctx.storage.writeLog).not.toContain(activeKey(SEASON));
    expect(ctx.storage.writeLog).not.toContain(previousKey(SEASON));
    // The legacy pointer still names the seed version, untouched.
    expect(await ctx.storage.getActiveVersion(SEASON)).toBe(SEED_VERSION);
  });

  it('bakes each key its own assigned observation timestamp', async () => {
    const ctx = await sequencedContext();
    const result = await ctx.service.publish(await changedSet(ctx.clock));

    const manifest = await ctx.storage.readVersionedDocument(
      SEASON,
      result.version,
      'content:manifest',
    );
    const circuits = await ctx.storage.readVersionedDocument(
      SEASON,
      result.version,
      'circuits',
    );
    // content:manifest changed (contentVersion) -> a fresh activation.
    expect(manifest?.meta.sourceUpdatedAt).toBe(FRESH_TIMESTAMP);
    // circuits did not change -> it keeps the seeded timestamp.
    expect(circuits?.meta.sourceUpdatedAt).toBe(SEED_HIGH_WATER_MARK);
  });

  it('writes the publication-metadata sidecar with the operation ordering input', async () => {
    const ctx = await sequencedContext();
    const result = await ctx.service.publish(await changedSet(ctx.clock));

    const sidecar = await readStoredPublicationMetadata(
      ctx.storage,
      SEASON,
      result.version,
    );
    expect(sidecar).toEqual({
      kind: 'record',
      record: { schemaVersion: 1, sourceOrderingInput: LATER_ORDERING },
    });

    const inventory = await readStoredInventory(
      ctx.storage,
      SEASON,
      result.version,
    );
    expect(inventory.kind).toBe('documents');
  });

  it('survives a post-commit cache purge failure', async () => {
    const ctx = await sequencedContext();
    ctx.purger.failNext = true;
    const result = await ctx.service.publish(await changedSet(ctx.clock));

    expect(result.status).toBe('applied');
    expect(result.cachePurge).toBe('failed');
    expect(result.reason).toBe('cache-purge-failed');
    const authority = await ctx.port.readAuthority(SEASON);
    expect(authority).toMatchObject({ activeVersion: result.version });
  });
});

describe('a pre-finalize failure never commits', () => {
  it('a document write failure leaves the active release untouched and cleans the candidate', async () => {
    const inner = new MemorySnapshotStorage();
    const ctx = await sequencedContext({ storage: inner });
    inner.setWriteFailure((key) => key.includes(':calendar'));

    const result = await ctx.service.publish(await changedSet(ctx.clock));

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('storage-write');
    const authority = await ctx.port.readAuthority(SEASON);
    expect(authority).toMatchObject({ activeVersion: SEED_VERSION });
    // The orphaned candidate's documents were removed.
    expect(await inner.listVersions(SEASON)).toEqual([SEED_VERSION]);
  });

  it('a sidecar write failure prevents the commit', async () => {
    const inner = new MemorySnapshotStorage();
    const ctx = await sequencedContext({ storage: inner });
    inner.setWriteFailure((key) => key.includes(':__publication_metadata'));

    const result = await ctx.service.publish(await changedSet(ctx.clock));

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('storage-write');
    const authority = await ctx.port.readAuthority(SEASON);
    expect(authority).toMatchObject({ activeVersion: SEED_VERSION });
  });

  it('an unchanged candidate keeps every seeded timestamp and still commits', async () => {
    const ctx = await sequencedContext();
    // Republish the seed content verbatim (same clock, same overrides).
    const result = await ctx.service.publish(
      await generatedSet(ctx.clock, 'unused', {
        sourceUpdatedAt: '2026-07-10T00:00:00.000Z',
        contentVersion: '2026.07.10.1',
      }),
    );

    expect(result.status).toBe('applied');
    for (const name of ['circuits', 'drivers', 'calendar'] as const) {
      const document = await ctx.storage.readVersionedDocument(
        SEASON,
        result.version,
        name,
      );
      expect(document?.meta.sourceUpdatedAt).toBe(SEED_HIGH_WATER_MARK);
    }
    const authority = await ctx.port.readAuthority(SEASON);
    expect(authority).toMatchObject({ activeVersion: result.version });
  });
});

describe('ordinary staleness admission is unchanged', () => {
  it('rejects a candidate strictly older than the committed ordering input', async () => {
    const ctx = await sequencedContext();
    await ctx.service.publish(await changedSet(ctx.clock)); // advances committed to LATER_ORDERING

    const older = await ctx.service.publish(
      await generatedSet(ctx.clock, 'unused', {
        sourceUpdatedAt: '2026-07-01T00:00:00.000Z',
        contentVersion: '2026.07.01.9',
      }),
    );
    expect(older.status).toBe('failed');
    expect(older.reason).toBe('older-source-updated-at');
  });
});
