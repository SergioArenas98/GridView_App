/**
 * What deploying a Worker with the `calendar-horizon` policy does to a season
 * whose active release was stamped before it (ADR 0005, amendment of
 * 2026-10-19), through the real Worker entry point with staging's settings:
 * `PROVIDER_MODE=none`, the sequencer authority and the `activate:` control.
 *
 * The policy applies only when a release is stamped. The deploy itself moves
 * no pointer and rewrites no document, so the active release keeps serving its
 * 15-minute `staleAfter` byte for byte, ETags included. The first release
 * stamped afterwards - an ordinary publication or, as here, a rollback
 * republication - is the first to carry the horizon.
 */

import { describe, expect, it } from 'vitest';

import worker, { type Env } from '../../../src/index';
import { CapturingLogger } from '../../../src/logging/logger';
import { FixedClock } from '../../../src/runtime/clock';
import type { StoredSnapshot } from '../../../src/storage/types';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import { SEASON, generatedSet, sequencedContext } from './support';

const ADMIN_TOKEN = 'local-test-token';
const BASE = 'https://api.gridview.test';
/** Round 13's sprint: the boundable mock season's horizon. */
const HORIZON = '2026-07-25T10:00:00.000Z';

const at = (instant: string) => new FixedClock(new Date(instant));

type Event = Record<string, unknown> & { sessions: Record<string, unknown>[] };

/** The mock season with a derivable horizon (see `freshness-horizon.test.ts`). */
function boundable(documents: readonly StoredSnapshot[]): StoredSnapshot[] {
  return documents.map((document) => {
    const event = document.data as Event;
    if (document.documentName === 'grand-prix:14') {
      return {
        ...document,
        data: {
          ...event,
          sessions: event.sessions.map((session) =>
            session.type === 'race'
              ? { ...session, startTime: '2026-08-09T14:00:00.000Z' }
              : session,
          ),
        },
      };
    }
    if (document.documentName === 'grand-prix:15') {
      return { ...document, data: { ...event, status: 'cancelled' } };
    }
    return document;
  });
}

async function boundableSet(instant: string, contentVersion: string) {
  const set = await generatedSet(at(instant), 'ignored-by-sequencer', {
    sourceUpdatedAt: '2026-07-20T00:00:00.000Z',
    contentVersion,
  });
  return { ...set, documents: boundable(set.documents) };
}

const PUBLIC_PATHS = [
  '/v1/home',
  '/v1/content/manifest',
  `/v1/seasons/${SEASON}/calendar`,
  `/v1/seasons/${SEASON}/grand-prix/14`,
] as const;

interface Served {
  readonly etag: string | null;
  readonly generatedAt: string;
  readonly staleAfter: string;
}

async function read(env: Env, path: string): Promise<Served> {
  const response = await worker.fetch(new Request(`${BASE}${path}`), env);
  expect(response.status, path).toBe(200);
  const body = (await response.json()) as {
    meta: { generatedAt: string; staleAfter: string };
  };
  return {
    etag: response.headers.get('ETag'),
    generatedAt: body.meta.generatedAt,
    staleAfter: body.meta.staleAfter,
  };
}

async function readAll(env: Env): Promise<Record<string, Served>> {
  const served: Record<string, Served> = {};
  for (const path of PUBLIC_PATHS) served[path] = await read(env, path);
  return served;
}

describe('deploying the calendar-horizon policy over an active release', () => {
  it('serves the existing release unchanged until the next stamping', async () => {
    // Before the deploy: a Worker on the interval policy published A, then B,
    // each at its own generation reading.
    const ctx = await sequencedContext();
    const first = await ctx.service.publish(
      await boundableSet('2026-07-20T12:05:00.000Z', '2026.07.20.2'),
    );
    expect(first.status).toBe('applied');
    const second = await ctx.service.publish(
      await boundableSet('2026-07-20T13:00:00.000Z', '2026.07.20.3'),
    );
    expect(second.status).toBe('applied');

    // The deploy: staging's settings, which select the horizon policy.
    const clock = at('2026-07-21T08:00:00.000Z');
    const env: Env = {
      ENVIRONMENT: 'staging',
      PROVIDER_MODE: 'none',
      PUBLIC_BASE_URL: BASE,
      ADMIN_TOKEN,
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_PUBLICATION_CUTOVER_CONTROL: `activate:${SEASON}`,
      __SEASON_PUBLICATION_SEQUENCER: ctx.port,
      __LOCAL_STORAGE: ctx.storage,
      __CACHE_PURGER: ctx.purger,
      __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
      __CLOCK: clock,
      __LOGGER: new CapturingLogger(),
    };
    const versionsBefore = await ctx.storage.listVersions(SEASON);

    const afterDeploy = await readAll(env);

    // Byte for byte the interval release: 15 minutes (an hour for the
    // manifest) from B's instant, the same ETags, and nothing written.
    for (const [path, served] of Object.entries(afterDeploy)) {
      expect(served.generatedAt, path).toBe('2026-07-20T13:00:00.000Z');
      expect(served.staleAfter, path).toBe(
        path === '/v1/content/manifest'
          ? '2026-07-20T14:00:00.000Z'
          : '2026-07-20T13:15:00.000Z',
      );
    }
    expect(await readAll(env)).toEqual(afterDeploy);
    expect(await ctx.storage.listVersions(SEASON)).toEqual(versionsBefore);
    const authority = await ctx.coordinator.readAuthority(SEASON);
    expect(authority.cutoverState === 'active' && authority.activeVersion).toBe(
      second.version,
    );

    // The first stamping after the deploy - a rollback to A - carries the
    // horizon. This, not the deploy, is the release a compatible app must
    // already be installed for.
    const rollback = await worker.fetch(
      new Request(`${BASE}/internal/admin/rollback?season=${SEASON}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ version: first.version }),
      }),
      env,
    );
    expect(rollback.status).toBe(200);

    const afterRollback = await readAll(env);
    for (const [path, served] of Object.entries(afterRollback)) {
      expect(served.generatedAt, path).toBe('2026-07-21T08:00:00.000Z');
      expect(served.staleAfter, path).toBe(
        path === '/v1/content/manifest' ? '2026-07-21T09:00:00.000Z' : HORIZON,
      );
      expect(served.etag, path).not.toBe(afterDeploy[path]?.etag);
    }
  });
});
