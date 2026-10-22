/**
 * A `genesis` season's publications, rollbacks and public reads (ADR 0025 D12,
 * "Amendment (2026-10-20): production genesis"), and the production
 * season-batch ingest that publishes its first release - through the
 * sequenced service, and through the real Worker entry point.
 *
 * Every sequencer is in process, every storage in memory, every batch
 * synthetic. Nothing here deploys, provisions or contacts Cloudflare.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

import worker, { type Env } from '../../../src/index';
import { MemoryCachePurgeAdapter } from '../../../src/cache/purge';
import { CapturingLogger } from '../../../src/logging/logger';
import { CutoverPausedPublicationCommands } from '../../../src/publication/cutover/admission';
import { genesisFingerprint } from '../../../src/publication/cutover/genesis';
import { SnapshotPublisher } from '../../../src/publication/publisher';
import { SequencedPublicationService } from '../../../src/publication/sequenced/service';
import {
  LocalSeasonPublicationSequencer,
  MemorySequencerHost,
  SeasonPublicationCoordinator,
} from '../../../src/publication/sequencer';
import { FixedClock } from '../../../src/runtime/clock';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import type { SnapshotStorage } from '../../../src/storage/types';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import {
  submissionFor,
  syntheticBatch,
  type Batch,
} from '../../ingest/support';
import { MutableClock } from '../sequencer/support';
import { SEASON, generatedSet, hexCounter } from './support';

const NOW = '2026-07-20T12:00:00.000Z';
const IDENTITY = 'gridview-production-2026-genesis-01';

async function genesisContext(
  options: { storage?: MemorySnapshotStorage } = {},
) {
  const clock = new MutableClock(new Date(NOW));
  const storage = options.storage ?? new MemorySnapshotStorage();
  const logger = new CapturingLogger();
  const purger = new MemoryCachePurgeAdapter();
  const host = new MemorySequencerHost();
  let token = 0;
  const coordinator = new SeasonPublicationCoordinator(host, {
    clock,
    token: () => `op-token-${(token += 1)}`,
    opaqueVersionComponent: hexCounter(),
  });
  const port = new LocalSeasonPublicationSequencer(coordinator);
  const fingerprint = await genesisFingerprint(SEASON, IDENTITY);
  const created = await port.commitGenesis({
    season: SEASON,
    genesisFingerprint: fingerprint,
  });
  if (created.outcome !== 'created') throw new Error('genesis failed');
  const legacy = new SnapshotPublisher(
    storage,
    runtimeSnapshotValidator,
    purger,
    logger,
  );
  const service = new SequencedPublicationService({
    port,
    // Exactly what the Worker composes under `genesis:<season>`.
    fallback: new CutoverPausedPublicationCommands(legacy, SEASON),
    storage,
    validator: runtimeSnapshotValidator,
    purger,
    logger,
    clock,
  });
  return { clock, storage, logger, host, port, service, legacy, fingerprint };
}

/** A mock candidate generated at the context clock's current reading. */
const candidate = (clock: MutableClock, label = 'candidate') =>
  generatedSet(new FixedClock(clock.now()), `v-${label}`, {
    sourceUpdatedAt: clock.now().toISOString(),
  });

describe('the first release of a genesis season', () => {
  it('publishes against the empty predecessor and makes the season active', async () => {
    const ctx = await genesisContext();
    const result = await ctx.service.publishGuarded(
      await candidate(ctx.clock),
      {
        expectedActiveVersion: null,
      },
    );
    expect(result).toMatchObject({
      status: 'applied',
      previousVersion: null,
      reason: null,
    });
    expect(await ctx.port.readAuthority(SEASON)).toEqual({
      cutoverState: 'active',
      authoritative: true,
      activeVersion: result.version,
      previousVersion: null,
      cutoverFingerprint: ctx.fingerprint,
    });
    // The publication instant is the clock reading: there is nothing to clear.
    const season = await ctx.storage.readVersionedDocument(
      SEASON,
      result.version,
      'season',
    );
    expect(season?.meta.generatedAt).toBe(NOW);
    expect(await ctx.storage.getCurrentSeason()).toBe(SEASON);
    // No legacy pointer is ever written for a sequencer-owned season.
    expect(await ctx.storage.getActiveVersion(SEASON)).toBeNull();
    expect(await ctx.storage.getPreviousVersion(SEASON)).toBeNull();
  });

  it('refuses a candidate reviewed against a release that does not exist', async () => {
    const ctx = await genesisContext();
    const result = await ctx.service.publishGuarded(
      await candidate(ctx.clock),
      {
        expectedActiveVersion: 'v-imagined',
      },
    );
    expect(result).toMatchObject({
      status: 'rejected',
      reason: 'guard-predecessor-stale',
    });
    expect((await ctx.port.readAuthority(SEASON)).cutoverState).toBe('genesis');
    expect(await ctx.storage.listVersions(SEASON)).toEqual([]);
  });

  it('refuses a retry of the first release once it has committed', async () => {
    const ctx = await genesisContext();
    const first = await ctx.service.publishGuarded(await candidate(ctx.clock), {
      expectedActiveVersion: null,
    });
    const retry = await ctx.service.publishGuarded(
      await candidate(ctx.clock, 'retry'),
      { expectedActiveVersion: null },
    );
    expect(retry).toMatchObject({
      status: 'rejected',
      reason: 'guard-predecessor-stale',
    });
    expect((await ctx.port.readAuthority(SEASON)).cutoverState).toBe('active');
    expect(await ctx.storage.listVersions(SEASON)).toEqual([first.version]);
  });

  it('commits exactly one of two concurrent first releases', async () => {
    const ctx = await genesisContext();
    const [a, b] = await Promise.all([
      ctx.service.publishGuarded(await candidate(ctx.clock, 'a'), {
        expectedActiveVersion: null,
      }),
      ctx.service.publishGuarded(await candidate(ctx.clock, 'b'), {
        expectedActiveVersion: null,
      }),
    ]);
    const applied = [a, b].filter((result) => result.status === 'applied');
    expect(applied).toHaveLength(1);
    const authority = await ctx.port.readAuthority(SEASON);
    expect(authority).toMatchObject({
      cutoverState: 'active',
      activeVersion: applied[0]!.version,
      previousVersion: null,
    });
  });

  it('stays in genesis when the candidate write fails, and a retry publishes', async () => {
    const ctx = await genesisContext();
    const original = ctx.storage.writeVersionedDocument.bind(ctx.storage);
    let failNext = true;
    ctx.storage.writeVersionedDocument = (async (...args) => {
      if (failNext) {
        failNext = false;
        throw new Error('simulated KV write failure');
      }
      return original(...args);
    }) as SnapshotStorage['writeVersionedDocument'];

    const failed = await ctx.service.publishGuarded(
      await candidate(ctx.clock),
      { expectedActiveVersion: null },
    );
    expect(failed.status).toBe('failed');
    expect((await ctx.port.readAuthority(SEASON)).cutoverState).toBe('genesis');
    expect(await ctx.storage.getCurrentSeason()).toBeNull();

    const retried = await ctx.service.publishGuarded(
      await candidate(ctx.clock, 'retried'),
      { expectedActiveVersion: null },
    );
    expect(retried).toMatchObject({ status: 'applied', previousVersion: null });
  });

  it('never hands an unguarded publication to the legacy publisher', async () => {
    const ctx = await genesisContext();
    const legacyPublish = vi.spyOn(ctx.legacy, 'publish');
    const result = await ctx.service.publish(await candidate(ctx.clock));
    expect(result).toMatchObject({ status: 'applied', previousVersion: null });
    expect(legacyPublish).not.toHaveBeenCalled();
    expect(await ctx.storage.getActiveVersion(SEASON)).toBeNull();
  });
});

describe('rollback needs a previous release', () => {
  it('is refused in genesis, with or without a target', async () => {
    const ctx = await genesisContext();
    for (const target of [undefined, 'v-anything']) {
      expect(await ctx.service.rollback(SEASON, target)).toMatchObject({
        status: 'rejected',
        reason: 'missing-previous-version',
      });
    }
    expect((await ctx.port.readAuthority(SEASON)).cutoverState).toBe('genesis');
  });

  it('is refused after the first release, even naming another version', async () => {
    const ctx = await genesisContext();
    const first = await ctx.service.publishGuarded(await candidate(ctx.clock), {
      expectedActiveVersion: null,
    });
    // A version that exists in storage but never committed: a cancelled or
    // orphaned candidate is never a release to restore.
    for (const target of [
      undefined,
      first.version,
      'pm1-0000000000009-00000009',
    ]) {
      expect(await ctx.service.rollback(SEASON, target)).toMatchObject({
        status: 'rejected',
        reason: 'missing-previous-version',
      });
    }
    expect(await ctx.port.readAuthority(SEASON)).toMatchObject({
      activeVersion: first.version,
      previousVersion: null,
    });
  });

  it('is admitted once a second release gives it a previous one', async () => {
    const ctx = await genesisContext();
    const first = await ctx.service.publishGuarded(await candidate(ctx.clock), {
      expectedActiveVersion: null,
    });
    ctx.clock.set('2026-07-20T13:00:00.000Z');
    const second = await ctx.service.publishGuarded(
      await candidate(ctx.clock, 'second'),
      { expectedActiveVersion: first.version },
    );
    expect(second).toMatchObject({
      status: 'applied',
      previousVersion: first.version,
    });
    ctx.clock.set('2026-07-20T14:00:00.000Z');
    expect(await ctx.service.rollback(SEASON)).toMatchObject({
      status: 'applied',
      previousVersion: second.version,
    });
  });
});

describe('the operator purge', () => {
  it('has nothing to purge in genesis', async () => {
    const ctx = await genesisContext();
    expect(await ctx.service.purgeActiveVersion(SEASON)).toEqual({
      season: SEASON,
      activeVersion: null,
      ok: false,
      reason: 'no-active-version',
      urls: [],
    });
  });
});

let batch: Batch;

beforeAll(async () => {
  batch = await syntheticBatch();
});

describe('production through the Worker: genesis, first batch, public reads', () => {
  async function production() {
    const clock = new FixedClock(new Date(NOW));
    const storage = new MemorySnapshotStorage();
    const port = new LocalSeasonPublicationSequencer(
      new SeasonPublicationCoordinator(new MemorySequencerHost(), { clock }),
    );
    const env = {
      ENVIRONMENT: 'production',
      PROVIDER_MODE: 'none',
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_PUBLICATION_CUTOVER_CONTROL: `genesis:${SEASON}`,
      SEASON_BATCH_INGEST: String(SEASON),
      ADMIN_TOKEN: 'local-test-token',
      __LOCAL_STORAGE: storage,
      __SEASON_PUBLICATION_SEQUENCER: port,
      __CLOCK: clock,
      __CACHE_PURGER: new MemoryCachePurgeAdapter(),
      __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
      __LOGGER: new CapturingLogger(),
    } as Env;
    return { env, storage, port };
  }

  const admin = (path: string, body: unknown) =>
    new Request(`https://api.gridview.local${path}`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer local-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  const read = (path: string) =>
    worker.fetch(new Request(`https://api.gridview.local${path}`), envRef!);
  let envRef: Env | null = null;

  it('keeps season reads unavailable until the first batch commits, then serves it', async () => {
    const { env, storage, port } = await production();
    envRef = env;

    // Before genesis: no season is current, so nothing is ready.
    expect((await read('/v1/seasons/current')).status).toBe(503);

    const genesis = await worker.fetch(
      admin('/internal/admin/publication/cutover/genesis', {
        season: SEASON,
        genesisIdentity: IDENTITY,
        confirmGenesis: true,
      }),
      env,
    );
    expect(genesis.status).toBe(200);
    // Genesis itself checked the legacy pointers. From here on nothing may.
    const pointerReads = vi.spyOn(storage, 'getActiveVersion');

    // In genesis: the sequencer owns the season and has no release.
    for (const path of [
      `/v1/seasons/${SEASON}`,
      `/v1/seasons/${SEASON}/drivers`,
      '/v1/seasons/current',
    ]) {
      const response = await read(path);
      expect(response.status, path).toBe(503);
      expect(await response.json(), path).toMatchObject({
        error: { code: 'SNAPSHOT_NOT_READY' },
      });
    }
    const status = await read('/v1/status');
    expect(await status.json()).toMatchObject({
      data: { currentSeason: null, snapshotAgeSeconds: null },
    });
    // A rollback and an unguarded sync have nothing to act on.
    const rollback = await worker.fetch(
      admin(`/internal/admin/rollback?season=${SEASON}`, {}),
      env,
    );
    expect(rollback.status).toBe(409);
    expect(await rollback.json()).toMatchObject({
      data: { status: 'rejected', reason: 'missing-previous-version' },
    });

    // The first batch names no release.
    const submission = submissionFor(batch, null);
    const first = await worker.fetch(
      admin('/internal/admin/season/ingest', submission),
      env,
    );
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as {
      data: { publication: { version: string; previousVersion: null } };
    };
    expect(firstBody.data.publication.previousVersion).toBeNull();
    expect(await port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'active',
      activeVersion: firstBody.data.publication.version,
      previousVersion: null,
    });

    // Now the season is served, from the sequencer's release.
    expect((await read(`/v1/seasons/${SEASON}`)).status).toBe(200);
    expect((await read('/v1/seasons/current')).status).toBe(200);
    // The legacy pointer was never consulted for this season.
    expect(pointerReads).not.toHaveBeenCalled();

    // A retry of the same first-batch submission is refused, not duplicated.
    const retry = await worker.fetch(
      admin('/internal/admin/season/ingest', submission),
      env,
    );
    expect(retry.status).toBe(409);
    expect(await retry.json()).toMatchObject({
      data: {
        publication: { status: 'rejected', reason: 'guard-predecessor-stale' },
      },
    });
    expect(await storage.listVersions(SEASON)).toEqual([
      firstBody.data.publication.version,
    ]);

    // Still no previous release, so rollback stays refused.
    const later = await worker.fetch(
      admin(`/internal/admin/rollback?season=${SEASON}`, {}),
      env,
    );
    expect(later.status).toBe(409);
  });

  it('refuses a first batch before genesis without writing', async () => {
    const { env, storage, port } = await production();
    const response = await worker.fetch(
      admin('/internal/admin/season/ingest', submissionFor(batch, null)),
      env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      data: {
        publication: {
          status: 'failed',
          reason: 'guard-authority-not-sequenced',
        },
      },
    });
    expect((await port.readAuthority(SEASON)).cutoverState).toBe(
      'uninitialized',
    );
    expect(await storage.listVersions(SEASON)).toEqual([]);
  });

  it('refuses a submission that omits the expected version rather than reading it as none', async () => {
    const { env } = await production();
    const body = submissionFor(batch, null);
    delete (body as Record<string, unknown>).expectedActiveVersion;
    const response = await worker.fetch(
      admin('/internal/admin/season/ingest', body),
      env,
    );
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain(
      'submission-malformed',
    );
  });
});
