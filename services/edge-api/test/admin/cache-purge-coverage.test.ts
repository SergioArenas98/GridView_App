/**
 * The operator cache purge has to cover the release it is purging.
 *
 * `POST /internal/admin/cache/purge` exists so an operator can recover from a
 * stale edge cache without moving a pointer. A purge that covers only
 * `bootstrap`, `home`, `calendar` and the per-round routes leaves the season
 * detail, both standings, all three collections, the content manifest and
 * every driver, constructor and circuit detail serving the stale
 * representation - which is precisely the situation the operator invoked it
 * to fix.
 *
 * The correct set is not a longer hard-coded list: it is the active version's
 * exact inventory mapped to public routes, so a document the version carries
 * can never be missing from the purge.
 */

import { describe, expect, it } from 'vitest';

import worker from '../../src/index';
import { invalidationUrlsForDocuments } from '../../src/cache/purge';
import type {
  CachePurgeAdapter,
  CachePurgeResult,
} from '../../src/cache/purge';
import type { SnapshotDocumentName } from '../../src/storage/types';
import type { EdgeHarness } from '../support/edge-harness';
import { adminRequest, createHarness } from '../support/edge-harness';
import { SEASON } from '../providers/coordination/support';
import { ScriptableStorage } from '../publication/support';

const ORIGIN = 'https://api.gridview.test';

/** Publishes the curated season through the real synchronization path. */
async function published(): Promise<EdgeHarness> {
  const harness = createHarness();
  const response = await worker.fetch(
    adminRequest('/internal/admin/sync/full'),
    harness.env,
  );
  expect(response.status).toBe(200);
  return harness;
}

interface PurgeResponse {
  status: number;
  data: Record<string, unknown>;
}

async function purge(harness: EdgeHarness): Promise<PurgeResponse> {
  const response = await worker.fetch(
    adminRequest('/internal/admin/cache/purge'),
    harness.env,
  );
  const body = (await response.json()) as { data?: Record<string, unknown> };
  return { status: response.status, data: body.data ?? {} };
}

async function activeInventory(
  harness: EdgeHarness,
): Promise<SnapshotDocumentName[]> {
  const version = await harness.storage.getActiveVersion(SEASON);
  expect(version).not.toBeNull();
  const inventory = await harness.storage.readVersionInventory(
    SEASON,
    version as string,
  );
  expect(inventory).not.toBeNull();
  return inventory as SnapshotDocumentName[];
}

class ThrowingPurger implements CachePurgeAdapter {
  calls = 0;
  constructor(private readonly mode: 'throw' | 'reject') {}
  purgePublicUrls(): Promise<CachePurgeResult> {
    this.calls += 1;
    if (this.mode === 'throw') throw new Error('purge exploded');
    return Promise.reject(new Error('purge rejected'));
  }
}

describe('the manual purge covers every public route the active version carries', () => {
  it('purges exactly the active version inventory mapped to public routes', async () => {
    const harness = await published();
    const inventory = await activeInventory(harness);

    const before = harness.purger.purgedUrls.length;
    const result = await purge(harness);
    const purged = harness.purger.purgedUrls.slice(before);

    expect(result.status).toBe(200);
    // The curated season is the one the `current` aliases resolve to, so the
    // operator purge covers the canonical URLs *and* every alias the router
    // accepts for them - not the canonical set alone.
    const expected = invalidationUrlsForDocuments(
      ORIGIN,
      SEASON,
      inventory,
      'season-is-current',
    );
    expect(purged).toEqual(expected);
    expect(result.data.urls).toEqual(expected);
  });

  it('covers the routes the previous hard-coded set omitted', async () => {
    const harness = await published();
    const before = harness.purger.purgedUrls.length;
    await purge(harness);
    const purged = harness.purger.purgedUrls.slice(before);

    const required = [
      `${ORIGIN}/v1/seasons/${SEASON}`,
      `${ORIGIN}/v1/seasons/${SEASON}/standings/drivers`,
      `${ORIGIN}/v1/seasons/${SEASON}/standings/constructors`,
      `${ORIGIN}/v1/seasons/${SEASON}/drivers`,
      `${ORIGIN}/v1/seasons/${SEASON}/constructors`,
      `${ORIGIN}/v1/seasons/${SEASON}/circuits`,
      `${ORIGIN}/v1/content/manifest`,
      `${ORIGIN}/v1/drivers/max-verstappen?season=${SEASON}`,
      `${ORIGIN}/v1/constructors/red-bull?season=${SEASON}`,
      `${ORIGIN}/v1/circuits/monza?season=${SEASON}`,
      `${ORIGIN}/v1/circuits/monaco?season=${SEASON}`,
    ];
    for (const url of required) {
      expect(purged, url).toContain(url);
    }
  });

  it('covers every grand prix detail and results route', async () => {
    const harness = await published();
    const before = harness.purger.purgedUrls.length;
    await purge(harness);
    const purged = harness.purger.purgedUrls.slice(before);

    const source = await harness.provider.fetchSeasonSource(SEASON, [
      'season-calendar',
    ]);
    for (const event of source.calendar) {
      const detail = `${ORIGIN}/v1/seasons/${SEASON}/grand-prix/${event.round}`;
      expect(purged, detail).toContain(detail);
      if (source.results.some((result) => result.round === event.round)) {
        expect(purged, `${detail}/results`).toContain(`${detail}/results`);
      }
    }
  });

  it('moves no pointer', async () => {
    const harness = await published();
    const before = {
      active: await harness.storage.getActiveVersion(SEASON),
      previous: await harness.storage.getPreviousVersion(SEASON),
      currentSeason: await harness.storage.getCurrentSeason(),
    };

    await purge(harness);

    expect({
      active: await harness.storage.getActiveVersion(SEASON),
      previous: await harness.storage.getPreviousVersion(SEASON),
      currentSeason: await harness.storage.getCurrentSeason(),
    }).toEqual(before);
  });

  it('reports a bounded result when no version is active', async () => {
    const harness = createHarness();

    const result = await purge(harness);

    expect(result.status).toBe(207);
    expect(result.data).toMatchObject({
      ok: false,
      urls: [],
      activeVersion: null,
      reason: 'no-active-version',
    });
  });

  it('reports a bounded result when the active version has no inventory', async () => {
    const storage = new ScriptableStorage();
    const harness = createHarness({ storage });
    expect(
      (
        await worker.fetch(
          adminRequest('/internal/admin/sync/full'),
          harness.env,
        )
      ).status,
    ).toBe(200);
    const version = await storage.getActiveVersion(SEASON);
    storage.hideInventory(SEASON, version as string);

    const result = await purge(harness);

    expect(result.status).toBe(207);
    expect(result.data).toMatchObject({
      ok: false,
      urls: [],
      reason: 'missing-version-inventory',
    });
  });

  for (const mode of ['throw', 'reject'] as const) {
    it(`contains a purge adapter that ${mode}s`, async () => {
      const harness = await published();
      const purger = new ThrowingPurger(mode);
      const result = await purge({
        ...harness,
        env: { ...harness.env, __CACHE_PURGER: purger },
      });

      expect(purger.calls).toBe(1);
      expect(result.status).toBe(207);
      expect(result.data).toMatchObject({ ok: false, urls: [] });
      expect(await harness.storage.getActiveVersion(SEASON)).not.toBeNull();
    });
  }

  it('still requires authorization', async () => {
    const harness = await published();
    const response = await worker.fetch(
      adminRequest('/internal/admin/cache/purge', 'wrong-token'),
      harness.env,
    );

    expect(response.status).toBe(401);
  });
});
