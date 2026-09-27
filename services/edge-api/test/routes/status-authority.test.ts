/**
 * `GET /v1/status` reads the active version through the season's publication
 * authority, as the public router does (ADR 0025 D6). Sequenced publication
 * never moves the legacy `active:{season}` pointer, so reading that pointer
 * for a sequencer-active season reported the pre-activation release.
 */

import { describe, expect, it, vi } from 'vitest';

import worker, { type Env } from '../../src/index';
import type { PublicationAuthority } from '../../src/publication/authority';
import type { SeasonPublicationSequencerPort } from '../../src/publication/sequencer';
import { handleStatus } from '../../src/routes/status';
import { FixedClock } from '../../src/runtime/clock';
import {
  SEASON,
  SEED_ORDERING_INPUT,
  SEED_VERSION,
  generatedSet,
  sequencedContext,
} from '../publication/sequenced/support';

const NOW = new FixedClock(new Date('2026-07-20T12:00:00.000Z'));
const env: Env = { ENVIRONMENT: 'staging' };

interface StatusBody {
  data: {
    status: string;
    currentSeason: number | null;
    snapshotAgeSeconds: number | null;
  };
}

async function status(
  ctx: Awaited<ReturnType<typeof sequencedContext>>,
  authority: PublicationAuthority,
) {
  const response = await handleStatus(
    new Request('https://api.gridview.test/v1/status'),
    env,
    ctx.storage,
    NOW,
    'req',
    authority,
  );
  return {
    response,
    etag: response.headers.get('ETag'),
    body: (await response.json()) as StatusBody,
  };
}

function ageFrom(instant: string): number {
  return Math.floor((NOW.now().getTime() - Date.parse(instant)) / 1000);
}

/** A sequencer-active season whose sequenced release is newer than the seed. */
async function activeAfterSequencedPublication() {
  const ctx = await sequencedContext();
  const published = await ctx.service.publish(
    await generatedSet(ctx.clock, 'x', {
      sourceUpdatedAt: '2026-07-20T00:00:00.000Z',
      contentVersion: '2026.07.20.a',
    }),
  );
  if (published.status !== 'applied') throw new Error('setup publish failed');
  return ctx;
}

async function sequencerActiveVersion(
  ctx: Awaited<ReturnType<typeof sequencedContext>>,
): Promise<string> {
  const authority = await ctx.port.readAuthority(SEASON);
  if (authority.cutoverState !== 'active') throw new Error('not active');
  return authority.activeVersion;
}

async function seasonSourceUpdatedAt(
  ctx: Awaited<ReturnType<typeof sequencedContext>>,
  version: string,
): Promise<string> {
  const season = await ctx.storage.readVersionedDocument(
    SEASON,
    version,
    'season',
  );
  if (season === null) throw new Error('no season document');
  return season.meta.sourceUpdatedAt;
}

function rigged(
  port: SeasonPublicationSequencerPort,
  mode: 'throw' | 'unavailable',
): PublicationAuthority {
  return {
    mode: 'sequencer',
    port: {
      ...port,
      readAuthority: async () => {
        if (mode === 'throw') throw new Error('lookup down');
        return { cutoverState: 'unavailable', authoritative: false };
      },
    },
  };
}

describe('GET /v1/status through the publication authority', () => {
  it('reports the sequencer-active release, not the stale legacy pointer', async () => {
    const ctx = await activeAfterSequencedPublication();
    const active = await sequencerActiveVersion(ctx);
    // The legacy pointer still names the seed.
    expect(await ctx.storage.getActiveVersion(SEASON)).toBe(SEED_VERSION);
    expect(active).not.toBe(SEED_VERSION);

    const reads = vi.spyOn(ctx.storage, 'readVersionedDocument');
    const viaSequencer = await status(ctx, {
      mode: 'sequencer',
      port: ctx.port,
    });
    const sequencerReads = reads.mock.calls.map((call) => call[1]);
    reads.mockClear();
    const viaLegacy = await status(ctx, { mode: 'legacy' });
    const legacyReads = reads.mock.calls.map((call) => call[1]);

    expect(viaSequencer.response.status).toBe(200);
    expect(sequencerReads).toEqual([active]);
    expect(viaSequencer.body.data.snapshotAgeSeconds).toBe(
      ageFrom(await seasonSourceUpdatedAt(ctx, active)),
    );
    // The legacy authority is unchanged: it reads the pointer, as before.
    expect(legacyReads).toEqual([SEED_VERSION]);
    // The cache identity follows the release actually read.
    expect(viaSequencer.etag).not.toBe(viaLegacy.etag);
  });

  it('reads the legacy pointer for a season the sequencer has only seeded', async () => {
    const ctx = await sequencedContext({ cutover: 'seeded' });
    const viaSequencer = await status(ctx, {
      mode: 'sequencer',
      port: ctx.port,
    });
    const viaLegacy = await status(ctx, { mode: 'legacy' });

    expect(viaSequencer.body.data.snapshotAgeSeconds).toBe(
      ageFrom(SEED_ORDERING_INPUT),
    );
    expect(viaSequencer.etag).toBe(viaLegacy.etag);
  });

  it.each(['throw', 'unavailable'] as const)(
    'stays available with no snapshot age when the authority read fails (%s), never reading the legacy pointer',
    async (mode) => {
      const ctx = await activeAfterSequencedPublication();
      const healthy = await status(ctx, { mode: 'sequencer', port: ctx.port });
      const failed = await status(ctx, rigged(ctx.port, mode));

      expect(failed.response.status).toBe(200);
      expect(failed.body.data.status).toBe('ok');
      expect(failed.body.data.currentSeason).toBe(SEASON);
      expect(failed.body.data.snapshotAgeSeconds).toBeNull();
      expect(failed.etag).not.toBe(healthy.etag);
    },
  );

  it('stays available when the selected sequencer is unreachable', async () => {
    const ctx = await activeAfterSequencedPublication();
    const unreachable = await status(ctx, { mode: 'sequencer-unavailable' });

    expect(unreachable.response.status).toBe(200);
    expect(unreachable.body.data.snapshotAgeSeconds).toBeNull();
  });

  it('is wired to the authority the Worker resolves', async () => {
    const ctx = await activeAfterSequencedPublication();
    const workerEnv: Env = {
      ENVIRONMENT: 'staging',
      PROVIDER_MODE: 'mock',
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_PUBLICATION_CUTOVER_CONTROL: 'activate:2026',
      __SEASON_PUBLICATION_SEQUENCER: ctx.port,
      __LOCAL_STORAGE: ctx.storage,
      __CLOCK: NOW,
    };

    const active = await sequencerActiveVersion(ctx);
    const reads = vi.spyOn(ctx.storage, 'readVersionedDocument');

    const response = await worker.fetch(
      new Request('https://api.gridview.test/v1/status'),
      workerEnv,
    );

    expect(response.status).toBe(200);
    expect(reads.mock.calls.map((call) => call[1])).toEqual([active]);
  });
});
