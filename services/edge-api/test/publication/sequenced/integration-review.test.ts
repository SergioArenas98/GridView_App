/**
 * Regression coverage for the six Integration review findings on PR #18.
 *
 * Each `describe` below reproduces one reported defect against the Integration
 * slice as it was reviewed, and then pins the corrected behaviour:
 *
 * - **F1** an explicit `SEASON_PUBLICATION_AUTHORITY=sequencer` with no
 *   reachable port stays fail-closed instead of silently resuming legacy
 *   pointer reads and writes;
 * - **F2** no global current-season or content-metadata state moves before the
 *   authoritative `finalize`;
 * - **F3** a cross-season publication purges the outgoing season's aliases;
 * - **F4** a propagation fallback is never cached as an ordinary snapshot;
 * - **F5** a rollback republication gets its own cache validator;
 * - **F6** a strictly older ordinary candidate stays a `rejected` no-op.
 *
 * Nothing here provisions a binding, deploys, or activates anything: every
 * assertion runs against the in-process sequencer and `MemorySnapshotStorage`.
 */

import { describe, expect, it } from 'vitest';

import worker from '../../../src/index';
import { MemoryCachePurgeAdapter } from '../../../src/cache/purge';
import { CapturingLogger } from '../../../src/logging/logger';
import {
  resolvePublicationAuthority,
  legacyPublicationAuthority,
} from '../../../src/publication/authority';
import type { PublicationAuthority } from '../../../src/publication/authority';
import { SnapshotPublisher } from '../../../src/publication/publisher';
import { SequencedPublicationService } from '../../../src/publication/sequenced/service';
import type {
  SeasonPublicationSequencerPort,
  SeasonAuthority,
} from '../../../src/publication/sequencer';
import { readStoredInventory } from '../../../src/publication/version-inventory';
import { handlePublicRequest } from '../../../src/public/router';
import { FixedClock } from '../../../src/runtime/clock';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import {
  activeKey,
  contentMetadataKey,
  currentSeasonKey,
  previousKey,
} from '../../../src/storage/keys';
import type {
  SnapshotDocumentName,
  StoredSnapshot,
} from '../../../src/storage/types';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import {
  createHarness,
  seedPublishedSnapshot,
} from '../../support/edge-harness';
import {
  SEASON,
  SEED_VERSION,
  SidecarReadFailingStorage,
  countingPort,
  generatedSet,
  sequencedContext,
} from './support';

const sequencerConfig = {
  environment: 'development' as const,
  providerMode: 'mock' as const,
  publicationAuthorityMode: 'sequencer' as const,
  publicBaseUrl: null,
};

function request(
  path: string,
  method = 'GET',
  init: RequestInit = {},
): Request {
  return new Request(`https://api.gridview.local${path}`, { ...init, method });
}

async function changed(
  clock: FixedClock,
  sourceUpdatedAt: string,
  contentVersion: string,
) {
  return generatedSet(clock, 'ignored-by-sequencer', {
    sourceUpdatedAt,
    contentVersion,
  });
}

// --- F1: an explicit sequencer selection stays fail-closed -------------------

describe('F1: explicit sequencer selection with no reachable port', () => {
  it('resolves to an explicit unavailable authority, never legacy', () => {
    const authority = resolvePublicationAuthority(
      { SEASON_PUBLICATION_AUTHORITY: 'sequencer' },
      sequencerConfig,
    );
    expect(authority.mode).toBe('sequencer-unavailable');
    expect(authority).not.toBe(legacyPublicationAuthority);
  });

  it('still resolves to legacy for an absent or unknown configuration', () => {
    expect(
      resolvePublicationAuthority(
        { SEASON_PUBLICATION_AUTHORITY: 'nonsense' },
        { ...sequencerConfig, publicationAuthorityMode: 'legacy' },
      ),
    ).toBe(legacyPublicationAuthority);
    expect(
      resolvePublicationAuthority(
        {},
        { ...sequencerConfig, publicationAuthorityMode: 'legacy' },
      ),
    ).toBe(legacyPublicationAuthority);
  });

  it('still selects the sequencer when a port is reachable', () => {
    const port = countingPort();
    const authority = resolvePublicationAuthority(
      { __SEASON_PUBLICATION_SEQUENCER: port },
      sequencerConfig,
    );
    expect(authority.mode).toBe('sequencer');
  });

  it('returns a bounded 503 for a public request without reading the legacy pointer', async () => {
    const clock = new FixedClock(new Date('2026-07-20T12:00:00.000Z'));
    const storage = new ActiveReadRecordingStorage();
    const publisher = new SnapshotPublisher(
      storage,
      runtimeSnapshotValidator,
      new MemoryCachePurgeAdapter(),
      new CapturingLogger(),
    );
    await publisher.publish(await generatedSet(clock, 'v1'));
    storage.activeReads.length = 0;

    const result = await handlePublicRequest(
      request('/v1/seasons/2026'),
      storage,
      'req',
      { mode: 'sequencer-unavailable' } as PublicationAuthority,
    );

    expect(result.response.status).toBe(503);
    expect(result.cacheOutcome).toBe('error');
    expect(storage.activeReads).toEqual([]);
  });

  it('performs no legacy pointer write for an ordinary publication', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    harness.storage.writeLog.length = 0;

    const response = await worker.fetch(
      new Request('https://api.gridview.test/internal/admin/sync/full', {
        method: 'POST',
        headers: { Authorization: 'Bearer local-test-token' },
      }),
      { ...harness.env, SEASON_PUBLICATION_AUTHORITY: 'sequencer' },
    );

    const body = (await response.json()) as {
      data: { status: string; failureCategory: string | null };
    };
    expect(body.data.status).toBe('failed');
    expect(body.data.failureCategory).toBe('sequencer-authority-unavailable');
    expect(harness.storage.writeLog).not.toContain(activeKey(SEASON));
    expect(harness.storage.writeLog).not.toContain(previousKey(SEASON));
  });

  it('performs no legacy pointer read or write for a rollback', async () => {
    const harness = createHarness({
      storage: new ActiveReadRecordingStorage(),
    });
    await seedPublishedSnapshot(harness);
    const storage = harness.storage as ActiveReadRecordingStorage;
    storage.writeLog.length = 0;
    storage.activeReads.length = 0;

    const response = await worker.fetch(
      new Request('https://api.gridview.test/internal/admin/rollback', {
        method: 'POST',
        headers: { Authorization: 'Bearer local-test-token' },
      }),
      { ...harness.env, SEASON_PUBLICATION_AUTHORITY: 'sequencer' },
    );

    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      data: { status: string; reason: string };
    };
    expect(body.data.status).toBe('failed');
    expect(body.data.reason).toBe('sequencer-authority-unavailable');
    expect(storage.activeReads).toEqual([]);
    expect(storage.writeLog).not.toContain(activeKey(SEASON));
    expect(storage.writeLog).not.toContain(previousKey(SEASON));
  });

  it('returns a bounded unavailable result for a manual cache purge', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);

    const response = await worker.fetch(
      new Request('https://api.gridview.test/internal/admin/cache/purge', {
        method: 'POST',
        headers: { Authorization: 'Bearer local-test-token' },
      }),
      { ...harness.env, SEASON_PUBLICATION_AUTHORITY: 'sequencer' },
    );

    expect(response.status).toBe(207);
    const body = (await response.json()) as {
      data: { ok: boolean; reason: string; activeVersion: string | null };
    };
    expect(body.data).toMatchObject({
      ok: false,
      reason: 'sequencer-authority-unavailable',
      activeVersion: null,
    });
  });

  it('keeps uninitialized and seeded on the legacy authority before cutover', async () => {
    const clock = new FixedClock(new Date('2026-07-20T12:00:00.000Z'));
    const storage = new MemorySnapshotStorage();
    const publisher = new SnapshotPublisher(
      storage,
      runtimeSnapshotValidator,
      new MemoryCachePurgeAdapter(),
      new CapturingLogger(),
    );
    await publisher.publish(await generatedSet(clock, 'v1'));

    for (const state of ['uninitialized', 'seeded'] as const) {
      const port = countingPort(
        authorityPort(
          state === 'uninitialized'
            ? { cutoverState: 'uninitialized', authoritative: false }
            : {
                cutoverState: 'seeded',
                authoritative: false,
                activeVersion: 'v1',
                previousVersion: null,
                cutoverFingerprint: 'f',
              },
        ),
      );
      const result = await handlePublicRequest(
        request('/v1/seasons/2026'),
        storage,
        'req',
        { mode: 'sequencer', port },
      );
      // A positive non-authoritative state, so legacy still serves (D12).
      expect(result.response.status).toBe(200);
    }
  });

  it('never confuses a lookup failure with uninitialized or seeded', async () => {
    const clock = new FixedClock(new Date('2026-07-20T12:00:00.000Z'));
    const storage = new ActiveReadRecordingStorage();
    const publisher = new SnapshotPublisher(
      storage,
      runtimeSnapshotValidator,
      new MemoryCachePurgeAdapter(),
      new CapturingLogger(),
    );
    await publisher.publish(await generatedSet(clock, 'v1'));
    storage.activeReads.length = 0;

    const throwing: SeasonPublicationSequencerPort = {
      ...countingPort(),
      readAuthority: async () => {
        throw new Error('lookup down');
      },
    };
    const result = await handlePublicRequest(
      request('/v1/seasons/2026'),
      storage,
      'req',
      { mode: 'sequencer', port: throwing },
    );
    expect(result.response.status).toBe(503);
    expect(storage.activeReads).toEqual([]);
  });
});

// --- F2: no global publication state before finalize ------------------------

describe('F2: global current-season state moves only after finalize', () => {
  async function contextWithOutgoingSeason() {
    const ctx = await sequencedContext();
    // A different season holds the `current` pointer, so a pre-commit
    // `setCurrentSeason` is observable.
    await seedOutgoingSeason(ctx.storage);
    return ctx;
  }

  for (const [label, finalize] of finalizeFailures()) {
    it(`leaves the current season and content metadata untouched when finalize ${label}`, async () => {
      const ctx = await contextWithOutgoingSeason();
      const service = serviceWithPort(ctx, portWith(ctx.port, { finalize }));

      const result = await service.publish(
        await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.2'),
      );

      expect(result.status).toBe('failed');
      expect(await ctx.storage.getCurrentSeason()).toBe(2025);
      expect((await ctx.storage.getContentMetadata())?.contentVersion).toBe(
        '2026.07.10.1',
      );
    });
  }

  it('performs the current-season and content-metadata maintenance after a successful finalize', async () => {
    const ctx = await contextWithOutgoingSeason();
    const result = await ctx.service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.2'),
    );

    expect(result.status).toBe('applied');
    expect(result.pointerMaintenance).toBe('succeeded');
    expect(await ctx.storage.getCurrentSeason()).toBe(SEASON);
    expect((await ctx.storage.getContentMetadata())?.contentVersion).toBe(
      '2026.07.20.2',
    );
  });

  for (const failing of [currentSeasonKey, contentMetadataKey] as const) {
    it(`reports an applied publication with failed maintenance when "${failing}" cannot be written`, async () => {
      const inner = new MemorySnapshotStorage();
      const ctx = await sequencedContext({ storage: inner });
      await seedOutgoingSeason(inner);
      inner.setWriteFailure((key) => key === failing);

      const result = await ctx.service.publish(
        await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.2'),
      );

      expect(result.status).toBe('applied');
      expect(result.pointerMaintenance).toBe('failed');
      expect(result.reason).toBe('current-season-maintenance-failed');
      // The release itself committed and is serving.
      const authority = await ctx.port.readAuthority(SEASON);
      expect(authority).toMatchObject({ activeVersion: result.version });
    });
  }

  it('never moves the current-season pointer during a rollback', async () => {
    const ctx = await sequencedContext();
    const first = await ctx.service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.a'),
    );
    await ctx.service.publish(
      await changed(ctx.clock, '2026-07-21T00:00:00.000Z', '2026.07.21.b'),
    );
    await ctx.storage.setCurrentSeason(2025);

    const rollback = await ctx.service.rollback(SEASON, first.version);

    expect(rollback.status).toBe('applied');
    expect(rollback.pointerMaintenance).toBe('not-required');
    expect(await ctx.storage.getCurrentSeason()).toBe(2025);
  });

  it('leaves the committed release intact when the candidate cleanup runs', async () => {
    const ctx = await sequencedContext();
    const committed = await ctx.service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.a'),
    );
    const service = serviceWithPort(
      ctx,
      portWith(ctx.port, {
        finalize: async () => ({
          outcome: 'rejected' as const,
          reason: 'state-corrupt' as const,
        }),
      }),
    );

    const rejected = await service.publish(
      await changed(ctx.clock, '2026-07-22T00:00:00.000Z', '2026.07.22.c'),
    );

    expect(rejected.status).toBe('failed');
    const versions = await ctx.storage.listVersions(SEASON);
    expect(versions).toContain(committed.version);
    const authority = await ctx.port.readAuthority(SEASON);
    expect(authority).toMatchObject({ activeVersion: committed.version });
  });
});

// --- F3: the outgoing current season's aliases are purged -------------------

describe('F3: cross-season publication purges the outgoing aliases', () => {
  const outgoingAlias = 'https://api.gridview.local/v1/drivers/only-2025';

  it('purges an outgoing-only profile alias and still purges the incoming season', async () => {
    const ctx = await sequencedContext();
    await seedOutgoingSeason(ctx.storage);
    const service = serviceWithPort(ctx, multiSeasonPort(ctx.port));
    ctx.purger.purgedUrls.length = 0;

    const result = await service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.2'),
    );

    expect(result.status).toBe('applied');
    expect(result.cachePurge).toBe('succeeded');
    expect(ctx.purger.purgedUrls).toContain(outgoingAlias);
    expect(ctx.purger.purgedUrls).toContain(`${outgoingAlias}?season=current`);
    // The outgoing season's own canonical routes still serve and are not evicted.
    expect(ctx.purger.purgedUrls).not.toContain(
      'https://api.gridview.local/v1/drivers/only-2025?season=2025',
    );
    // The incoming season is still purged.
    expect(ctx.purger.purgedUrls).toContain(
      'https://api.gridview.local/v1/seasons/2026/calendar',
    );
    expect(ctx.purger.purgedUrls).toContain(
      'https://api.gridview.local/v1/seasons/current',
    );
  });

  it('returns a deduplicated, sorted URL set', async () => {
    const ctx = await sequencedContext();
    await seedOutgoingSeason(ctx.storage);
    const service = serviceWithPort(ctx, multiSeasonPort(ctx.port));
    const result = await service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.2'),
    );
    expect(result.purgedUrls).toEqual([...new Set(result.purgedUrls)]);
    expect(result.purgedUrls).toEqual([...result.purgedUrls].sort());
  });

  it('invents no cross-season outgoing set for a same-season publication', async () => {
    const ctx = await sequencedContext();
    // The seed publication already made 2026 the current season.
    const result = await ctx.service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.2'),
    );
    expect(result.status).toBe('applied');
    expect(result.cachePurge).toBe('succeeded');
    expect(result.purgedUrls.filter((url) => url.includes('2025'))).toEqual([]);
  });

  it('reports a failed purge when the outgoing surface cannot be enumerated', async () => {
    const ctx = await sequencedContext();
    await seedOutgoingSeason(ctx.storage);
    const service = serviceWithPort(ctx, multiSeasonPort(ctx.port));
    // The outgoing season's active version exists but records no inventory.
    await ctx.storage.setActiveVersion(2025, 'v-2025-unknown');

    const result = await service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.2'),
    );

    expect(result.status).toBe('applied');
    expect(result.cachePurge).toBe('failed');
    expect(result.reason).toBe('cache-purge-failed');
    const authority = await ctx.port.readAuthority(SEASON);
    expect(authority).toMatchObject({ activeVersion: result.version });
  });

  it('consults no legacy active pointer for an outgoing season the sequencer owns', async () => {
    const storage = new ActiveReadRecordingStorage();
    const ctx = await sequencedContext({ storage });
    await seedOutgoingSeason(storage);
    const service = serviceWithPort(
      ctx,
      portWith(ctx.port, {
        readAuthority: async (season: number) =>
          season === 2025
            ? ({
                cutoverState: 'active',
                authoritative: true,
                activeVersion: 'v-2025',
                previousVersion: null,
                cutoverFingerprint: 'outgoing',
              } as SeasonAuthority)
            : ctx.port.readAuthority(season),
      }),
    );
    storage.activeReads.length = 0;

    const result = await service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.2'),
    );

    expect(result.status).toBe('applied');
    expect(ctx.purger.purgedUrls).toContain(outgoingAlias);
    expect(storage.activeReads).not.toContain(2025);
  });

  it('purges the outgoing aliases when the current-season maintenance fails after the pointer already moved', async () => {
    const storage = new LateFailingCurrentSeasonStorage();
    const ctx = await sequencedContext({ storage });
    await seedOutgoingSeason(storage);
    storage.failAfterWrite = true;
    const service = serviceWithPort(ctx, multiSeasonPort(ctx.port));
    ctx.purger.purgedUrls.length = 0;

    const result = await service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.2'),
    );

    // The release committed and the maintenance disposition stays truthful.
    expect(result.status).toBe('applied');
    expect(result.pointerMaintenance).toBe('failed');
    expect(result.reason).toBe('current-season-maintenance-failed');
    // The rejected write nevertheless landed: `failed` does not mean "the
    // pointer did not move", so 2025 really did lose the `current` aliases.
    expect(await storage.getCurrentSeason()).toBe(SEASON);
    expect(ctx.purger.purgedUrls).toContain(outgoingAlias);
    expect(ctx.purger.purgedUrls).toContain(`${outgoingAlias}?season=current`);
  });

  it('purges the outgoing aliases when the current-season write fails before it applies', async () => {
    const storage = new MemorySnapshotStorage();
    const ctx = await sequencedContext({ storage });
    await seedOutgoingSeason(storage);
    storage.setWriteFailure((key) => key === currentSeasonKey);
    const service = serviceWithPort(ctx, multiSeasonPort(ctx.port));
    ctx.purger.purgedUrls.length = 0;

    const result = await service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.2'),
    );

    expect(result.status).toBe('applied');
    expect(result.pointerMaintenance).toBe('failed');
    expect(await storage.getCurrentSeason()).toBe(2025);
    // Conservative over-invalidation: 2025 kept the aliases, and dropping them
    // only costs a re-fetch of URLs that still resolve to 2025 content. Only
    // aliases are taken - the outgoing season's canonical routes still serve.
    expect(ctx.purger.purgedUrls).toContain(outgoingAlias);
    expect(ctx.purger.purgedUrls).not.toContain(
      'https://api.gridview.local/v1/drivers/only-2025?season=2025',
    );
  });
});

// --- F4: propagation fallbacks are never cached as ordinary snapshots -------

describe('F4: the propagation fallback is non-cacheable', () => {
  async function fallbackContext() {
    const ctx = await sequencedContext();
    const published = await ctx.service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.a'),
    );
    if (published.status !== 'applied') throw new Error('setup publish failed');
    const inventory = await readStoredInventory(
      ctx.storage,
      SEASON,
      published.version,
    );
    if (inventory.kind !== 'documents') throw new Error('active inventory');
    const profile = inventory.documents.find((name) =>
      name.startsWith('driver:'),
    );
    if (!profile) throw new Error('no driver profile');
    const view = new SidecarReadFailingStorage(ctx.storage);
    const path = `/v1/drivers/${profile.slice('driver:'.length)}`;
    return { ctx, view, profile, path, activeVersion: published.version };
  }

  it('serves the previous document with no-store and no CDN lifetime', async () => {
    const { ctx, view, profile, path, activeVersion } = await fallbackContext();
    const normal = await handlePublicRequest(request(path), view, 'req-0', {
      mode: 'sequencer',
      port: ctx.port,
    });
    expect(normal.response.headers.get('Cache-Control')).toContain('max-age');

    view.hiddenDocuments.add(`${activeVersion}|${profile}`);
    const fallback = await handlePublicRequest(request(path), view, 'req-1', {
      mode: 'sequencer',
      port: ctx.port,
    });

    expect(fallback.response.status).toBe(200);
    expect(fallback.response.headers.get('Cache-Control')).toBe('no-store');
    expect(fallback.response.headers.get('CDN-Cache-Control')).toBeNull();
  });

  it('never turns a matching If-None-Match into a cache-extending 304', async () => {
    const { ctx, view, profile, path, activeVersion } = await fallbackContext();
    // The ETag a client holds for the previous version, taken while it served.
    const previous = await handlePublicRequest(request(path), view, 'req-0', {
      mode: 'sequencer',
      port: ctx.port,
    });
    const heldEtag = previous.response.headers.get('ETag') ?? '';

    view.hiddenDocuments.add(`${activeVersion}|${profile}`);
    const fallback = await handlePublicRequest(
      request(path, 'GET', { headers: { 'If-None-Match': heldEtag } }),
      view,
      'req-1',
      { mode: 'sequencer', port: ctx.port },
    );

    expect(fallback.response.status).toBe(200);
    expect(fallback.cacheOutcome).not.toBe('not-modified');
    expect(fallback.response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('applies the same restrictions to HEAD and returns no body', async () => {
    const { ctx, view, profile, path, activeVersion } = await fallbackContext();
    view.hiddenDocuments.add(`${activeVersion}|${profile}`);

    const head = await handlePublicRequest(request(path, 'HEAD'), view, 'r', {
      mode: 'sequencer',
      port: ctx.port,
    });

    expect(head.response.status).toBe(200);
    expect(await head.response.text()).toBe('');
    expect(head.response.headers.get('Cache-Control')).toBe('no-store');
    expect(head.response.headers.get('CDN-Cache-Control')).toBeNull();
  });

  it('resumes the normal cache policy once the active document is readable', async () => {
    const { ctx, view, profile, path, activeVersion } = await fallbackContext();
    view.hiddenDocuments.add(`${activeVersion}|${profile}`);
    await handlePublicRequest(request(path), view, 'r1', {
      mode: 'sequencer',
      port: ctx.port,
    });
    view.hiddenDocuments.delete(`${activeVersion}|${profile}`);

    const normal = await handlePublicRequest(request(path), view, 'r2', {
      mode: 'sequencer',
      port: ctx.port,
    });

    expect(normal.response.headers.get('Cache-Control')).toBe(
      'public, max-age=1800, stale-while-revalidate=1800',
    );
    expect(normal.response.headers.get('CDN-Cache-Control')).toBe(
      'public, s-maxage=3600',
    );
  });

  it('still refuses a fallback the previous inventory excludes', async () => {
    const { ctx, view, profile, path, activeVersion } = await fallbackContext();
    view.hiddenDocuments.add(`${activeVersion}|${profile}`);
    view.hiddenDocuments.add(`${SEED_VERSION}|${profile}`);

    const result = await handlePublicRequest(request(path), view, 'r', {
      mode: 'sequencer',
      port: ctx.port,
    });

    expect(result.response.status).toBe(404);
  });
});

// --- F5: the ETag identifies the republished representation -----------------

describe('F5: a rollback republication carries its own cache validator', () => {
  async function etagFor(
    ctx: Awaited<ReturnType<typeof sequencedContext>>,
    ifNoneMatch?: string,
  ) {
    const result = await handlePublicRequest(
      request(
        '/v1/seasons/2026',
        'GET',
        ifNoneMatch ? { headers: { 'If-None-Match': ifNoneMatch } } : {},
      ),
      ctx.storage,
      'req',
      { mode: 'sequencer', port: ctx.port },
    );
    return result;
  }

  it('gives the rollback destination a different ETag from its historical source', async () => {
    const ctx = await sequencedContext();
    const first = await ctx.service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.a'),
    );
    const historical = (await etagFor(ctx)).response.headers.get('ETag');

    await ctx.service.publish(
      await changed(ctx.clock, '2026-07-21T00:00:00.000Z', '2026.07.21.b'),
    );
    const rollback = await ctx.service.rollback(SEASON, first.version);
    expect(rollback.status).toBe('applied');

    const republished = (await etagFor(ctx)).response.headers.get('ETag');
    expect(republished).not.toBe(historical);
  });

  it('returns 200 with the fresh representation for the historical ETag', async () => {
    const ctx = await sequencedContext();
    const first = await ctx.service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.a'),
    );
    const historical = (await etagFor(ctx)).response.headers.get('ETag') ?? '';
    await ctx.service.publish(
      await changed(ctx.clock, '2026-07-21T00:00:00.000Z', '2026.07.21.b'),
    );
    const rollback = await ctx.service.rollback(SEASON, first.version);

    const conditional = await etagFor(ctx, historical);
    expect(conditional.response.status).toBe(200);
    const body = (await conditional.response.json()) as {
      meta: { sourceUpdatedAt: string; contentVersion: string };
    };
    const stored = await ctx.storage.readVersionedDocument(
      SEASON,
      rollback.version,
      'season',
    );
    expect(body.meta.sourceUpdatedAt).toBe(stored?.meta.sourceUpdatedAt);
    // Stable historical data was not mutated to force the new validator.
    expect(body.meta.contentVersion).toBe('2026.07.20.a');
  });

  it('keeps one stable ETag for repeated requests to the same version', async () => {
    const ctx = await sequencedContext();
    const first = await ctx.service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.a'),
    );
    await ctx.service.publish(
      await changed(ctx.clock, '2026-07-21T00:00:00.000Z', '2026.07.21.b'),
    );
    await ctx.service.rollback(SEASON, first.version);

    const a = (await etagFor(ctx)).response.headers.get('ETag');
    const b = (await etagFor(ctx)).response.headers.get('ETag');
    expect(a).toBe(b);
    expect(a).toMatch(/^W\/"gv1-/);

    const conditional = await etagFor(ctx, a ?? '');
    expect(conditional.response.status).toBe(304);
    expect(conditional.cacheOutcome).toBe('not-modified');
  });

  it('gives an ordinary new publication its own validator too', async () => {
    const ctx = await sequencedContext();
    await ctx.service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.a'),
    );
    const before = (await etagFor(ctx)).response.headers.get('ETag');
    await ctx.service.publish(
      await changed(ctx.clock, '2026-07-21T00:00:00.000Z', '2026.07.20.a'),
    );
    const after = (await etagFor(ctx)).response.headers.get('ETag');
    expect(after).not.toBe(before);
  });
});

// --- F6: stale-candidate rejection semantics --------------------------------

describe('F6: a strictly older ordinary candidate is rejected, not failed', () => {
  it('returns a rejected publication with the older-source reason', async () => {
    const ctx = await sequencedContext();
    await ctx.service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.a'),
    );

    const older = await ctx.service.publish(
      await changed(ctx.clock, '2026-07-01T00:00:00.000Z', '2026.07.01.9'),
    );

    expect(older.status).toBe('rejected');
    expect(older.reason).toBe('older-source-updated-at');
  });

  it('still admits an equal and a newer ordering input', async () => {
    const ctx = await sequencedContext();
    await ctx.service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.a'),
    );
    const equal = await ctx.service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.b'),
    );
    expect(equal.status).toBe('applied');
    const newer = await ctx.service.publish(
      await changed(ctx.clock, '2026-07-22T00:00:00.000Z', '2026.07.22.c'),
    );
    expect(newer.status).toBe('applied');
  });

  it('leaves an operational prepare refusal a failure', async () => {
    const ctx = await sequencedContext();
    const service = serviceWithPort(
      ctx,
      portWith(ctx.port, {
        prepare: async () => ({
          outcome: 'rejected' as const,
          reason: 'state-corrupt' as const,
        }),
      }),
    );

    const result = await service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.a'),
    );

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('sequencer-prepare-rejected');
  });

  it('keeps rollback exempt from the ordinary staleness predicate', async () => {
    const ctx = await sequencedContext();
    const older = await ctx.service.publish(
      await changed(ctx.clock, '2026-07-15T00:00:00.000Z', '2026.07.15.a'),
    );
    await ctx.service.publish(
      await changed(ctx.clock, '2026-07-25T00:00:00.000Z', '2026.07.25.b'),
    );
    const rollback = await ctx.service.rollback(SEASON, older.version);
    expect(rollback.status).toBe('applied');
  });
});

// --- cross-finding interaction ---------------------------------------------

describe('cross-finding: a cross-season publication end to end', () => {
  it('commits, then transitions the season, purges both surfaces and re-validates', async () => {
    const ctx = await sequencedContext();
    await seedOutgoingSeason(ctx.storage);
    const service = serviceWithPort(ctx, multiSeasonPort(ctx.port));
    const beforeEtag = await seasonEtag(ctx);

    const result = await service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.2'),
    );

    expect(result.status).toBe('applied');
    expect(result.pointerMaintenance).toBe('succeeded');
    expect(await ctx.storage.getCurrentSeason()).toBe(SEASON);
    expect(ctx.purger.purgedUrls).toContain(
      'https://api.gridview.local/v1/drivers/only-2025?season=current',
    );
    expect(ctx.purger.purgedUrls).toContain(
      'https://api.gridview.local/v1/seasons/2026/calendar',
    );
    expect(await seasonEtag(ctx)).not.toBe(beforeEtag);
  });

  it('reports no outgoing transition when finalization fails', async () => {
    const ctx = await sequencedContext();
    await seedOutgoingSeason(ctx.storage);
    ctx.purger.purgedUrls.length = 0;
    const service = serviceWithPort(
      ctx,
      portWith(ctx.port, {
        finalize: async () => ({
          outcome: 'rejected' as const,
          reason: 'preparation-expired' as const,
        }),
      }),
    );

    const result = await service.publish(
      await changed(ctx.clock, '2026-07-20T00:00:00.000Z', '2026.07.20.2'),
    );

    expect(result.status).toBe('failed');
    expect(result.purgedUrls).toEqual([]);
    expect(ctx.purger.purgedUrls).toEqual([]);
    expect(await ctx.storage.getCurrentSeason()).toBe(2025);
    expect((await ctx.storage.getContentMetadata())?.contentVersion).toBe(
      '2026.07.10.1',
    );
    // The candidate was cleaned up and the seed release still serves.
    expect(await ctx.storage.listVersions(SEASON)).toEqual([SEED_VERSION]);
  });
});

// --- local scaffolding ------------------------------------------------------

/** Records every legacy `active:{season}` pointer read, by season. */
class ActiveReadRecordingStorage extends MemorySnapshotStorage {
  readonly activeReads: number[] = [];

  override async getActiveVersion(season: number): Promise<string | null> {
    this.activeReads.push(season);
    return super.getActiveVersion(season);
  }
}

/**
 * `setCurrentSeason` writes through and *then* rejects.
 *
 * A real storage failure can be reported after the value already landed, so a
 * rejected promise is never evidence that the global pointer stayed put.
 */
class LateFailingCurrentSeasonStorage extends MemorySnapshotStorage {
  failAfterWrite = false;

  override async setCurrentSeason(season: number): Promise<void> {
    await super.setCurrentSeason(season);
    if (this.failAfterWrite) {
      throw new Error('simulated post-write current-season failure');
    }
  }
}

function authorityPort(
  authority: SeasonAuthority,
): SeasonPublicationSequencerPort {
  return { ...countingPort(), readAuthority: async () => authority };
}

/**
 * A port that delegates to `base` except for the named overrides.
 *
 * Spelled out rather than spread: `base` is a class instance, so `{ ...base }`
 * would silently drop every prototype method and make a test pass for the wrong
 * reason.
 */
/**
 * The realistic multi-season topology: one sequencer object owns one season, so
 * a lookup for a season it does not own is answered by *that* season's object.
 * `LocalSeasonPublicationSequencer` is single-season and reports `unavailable`
 * for any other season, which would make an outgoing season look unreadable
 * rather than simply not cut over. Here 2025 answers `uninitialized`, which is
 * what a season with no sequencer state actually reports.
 */
function multiSeasonPort(
  base: SeasonPublicationSequencerPort,
): SeasonPublicationSequencerPort {
  return portWith(base, {
    readAuthority: async (season: number) =>
      season === 2025
        ? ({ cutoverState: 'uninitialized', authoritative: false } as const)
        : base.readAuthority(season),
  });
}

function portWith(
  base: SeasonPublicationSequencerPort,
  overrides: Partial<SeasonPublicationSequencerPort>,
): SeasonPublicationSequencerPort {
  return {
    readAuthority: (r) => base.readAuthority(r),
    prepare: (r) => base.prepare(r),
    finalize: (r) => base.finalize(r),
    cancel: (r) => base.cancel(r),
    authorizeCleanup: (r) => base.authorizeCleanup(r),
    acknowledgeCleanup: (r) => base.acknowledgeCleanup(r),
    seedCutover: (r) => base.seedCutover(r),
    activateCutover: (r) => base.activateCutover(r),
    ...overrides,
  };
}

function serviceWithPort(
  ctx: Awaited<ReturnType<typeof sequencedContext>>,
  port: SeasonPublicationSequencerPort,
): SequencedPublicationService {
  return new SequencedPublicationService({
    port,
    fallback: ctx.legacy,
    storage: ctx.storage,
    validator: runtimeSnapshotValidator,
    purger: ctx.purger,
    logger: ctx.logger,
    clock: ctx.clock,
    purgeOrigin: 'https://api.gridview.local',
  });
}

function finalizeFailures(): Array<
  [string, SeasonPublicationSequencerPort['finalize']]
> {
  return [
    [
      'is rejected',
      async () => ({
        outcome: 'rejected' as const,
        reason: 'preparation-expired' as const,
      }),
    ],
    [
      'is superseded',
      async () => ({
        outcome: 'superseded' as const,
        currentOperationEpoch: 99,
        activeVersion: SEED_VERSION,
        previousVersion: null,
      }),
    ],
    [
      'throws',
      async () => {
        throw new Error('transport failure');
      },
    ],
  ];
}

/**
 * Makes 2025 the current season, with its own active release carrying a profile
 * that 2026 does not.
 */
async function seedOutgoingSeason(
  storage: MemorySnapshotStorage,
): Promise<void> {
  const documents: SnapshotDocumentName[] = ['season', 'driver:only-2025'];
  for (const name of documents) {
    await storage.writeVersionedDocument(2025, 'v-2025', outgoingDoc(name));
  }
  await storage.writeVersionInventory(2025, 'v-2025', documents);
  await storage.setActiveVersion(2025, 'v-2025');
  await storage.setCurrentSeason(2025);
}

function outgoingDoc(name: SnapshotDocumentName): StoredSnapshot {
  return {
    documentName: name,
    data: {},
    resourceIdentity: `v1:2025:${name}`,
    meta: {
      apiVersion: '1',
      schemaVersion: 1,
      generatedAt: '2025-12-01T00:00:00.000Z',
      sourceUpdatedAt: '2025-12-01T00:00:00.000Z',
      staleAfter: '2025-12-01T00:15:00.000Z',
      contentVersion: '2025.12.01.1',
      season: 2025,
    } as StoredSnapshot['meta'],
  };
}

async function seasonEtag(
  ctx: Awaited<ReturnType<typeof sequencedContext>>,
): Promise<string | null> {
  const result = await handlePublicRequest(
    request('/v1/seasons/2026'),
    ctx.storage,
    'req',
    { mode: 'sequencer', port: ctx.port },
  );
  return result.response.headers.get('ETag');
}
