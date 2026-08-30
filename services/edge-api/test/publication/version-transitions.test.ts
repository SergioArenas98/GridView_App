/**
 * A version transition has to be recoverable.
 *
 * Two pointers describe a season: `active` is what serves, and `previous` is
 * the one thing a default rollback can reach. `previous` is therefore the
 * whole recovery path, and three separate defects destroy it:
 *
 * - **Rolling back to the version already active.** Nothing needs to move, but
 *   the operation still reports a transition and still overwrites `previous`
 *   with the active version - so the release the operator could have returned
 *   to is gone, and a later default rollback lands on the version it started
 *   from.
 * - **A publication that fails at the commit point.** `previous` is written
 *   *before* `setActiveVersion`, so a failed commit leaves `previous` pointing
 *   at the still-active version. The release did not change, but recovery from
 *   it did.
 * - **A storage failure during rollback.** Rollback performs unguarded reads
 *   and writes, so an outage escapes as a rejected promise instead of the
 *   bounded result the boundary promises - and the caller cannot tell which
 *   side of the commit point the run ended on.
 */

import { describe, expect, it } from 'vitest';

import { MemoryCachePurgeAdapter } from '../../src/cache/purge';
import type { PublicationResult } from '../../src/publication/publisher';
import type { SnapshotPublisher } from '../../src/publication/publisher';
import { SEASON, seasonFixture } from '../providers/coordination/support';
import type { ProviderSeasonSource } from '../../src/providers/formula-one-provider';
import {
  ExplodingPurgeAdapter,
  ScriptableStorage,
  publisherFor,
  setFor,
  type StoragePhase,
} from './support';

const V1 = 'v1';
const V2 = 'v2';
const V3 = 'v3';
const AT_V1 = '2026-07-01T00:00:00.000Z';
const AT_V2 = '2026-07-10T00:00:00.000Z';
const AT_V3 = '2026-07-20T00:00:00.000Z';

interface Seeded {
  storage: ScriptableStorage;
  purger: MemoryCachePurgeAdapter;
  publisher: SnapshotPublisher;
  source: ProviderSeasonSource;
}

/** Publishes v1 then v2, so `active=v2` and `previous=v1`. */
async function seeded(): Promise<Seeded> {
  const storage = new ScriptableStorage();
  const purger = new MemoryCachePurgeAdapter();
  const publisher = publisherFor(storage, purger);
  const source = await seasonFixture();

  expect((await publisher.publish(setFor(source, V1, AT_V1))).status).toBe(
    'applied',
  );
  expect((await publisher.publish(setFor(source, V2, AT_V2))).status).toBe(
    'applied',
  );
  expect(await storage.pointers(SEASON)).toEqual({
    active: V2,
    previous: V1,
  });
  return { storage, purger, publisher, source };
}

/** Runs an operation and reports whether it returned or rejected. */
async function settle(
  operation: () => Promise<PublicationResult>,
): Promise<{ rejected: boolean; value: PublicationResult | null }> {
  try {
    return { rejected: false, value: await operation() };
  } catch {
    return { rejected: true, value: null };
  }
}

describe('rolling back to the already-active version is a bounded no-op', () => {
  it('reports a truthful no-op rather than a transition', async () => {
    const { storage, publisher } = await seeded();

    const result = await publisher.rollback(SEASON, V2);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('idempotent');
    expect(result.version).toBe(V2);
    expect(result.cachePurge).toBe('not-required');
    expect(result.purgedUrls).toEqual([]);
    expect(await storage.pointers(SEASON)).toEqual({
      active: V2,
      previous: V1,
    });
  });

  it('writes no pointer and purges nothing', async () => {
    const { storage, purger, publisher } = await seeded();
    const purgedBefore = purger.purgedUrls.length;
    storage.arm('setPreviousVersion', 'every');

    const result = await publisher.rollback(SEASON, V2);

    // Armed to fail: reaching either pointer write at all would surface here.
    expect(result.status).toBe('skipped');
    expect(purger.purgedUrls.length).toBe(purgedBefore);
  });

  it('leaves the earlier version reachable by a later default rollback', async () => {
    const { storage, publisher } = await seeded();

    await publisher.rollback(SEASON, V2);
    const second = await publisher.rollback(SEASON);

    expect(second.status).toBe('applied');
    expect(second.version).toBe(V1);
    expect((await storage.pointers(SEASON)).active).toBe(V1);
  });
});

describe('a failed publication leaves both pointers exactly where they were', () => {
  it('does not overwrite previous when the active-pointer write fails', async () => {
    const { storage, publisher, source } = await seeded();
    storage.arm('setActiveVersion', 1);

    const result = await publisher.publish(setFor(source, V3, AT_V3));

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('storage-write');
    expect(await storage.pointers(SEASON)).toEqual({
      active: V2,
      previous: V1,
    });
  });

  it('keeps the earlier version reachable after a failed publication', async () => {
    const { storage, publisher, source } = await seeded();
    storage.arm('setActiveVersion', 1);
    await publisher.publish(setFor(source, V3, AT_V3));
    storage.disarm();

    const rollback = await publisher.rollback(SEASON);

    expect(rollback.status).toBe('applied');
    expect(rollback.version).toBe(V1);
    expect((await storage.pointers(SEASON)).active).toBe(V1);
  });
});

describe('the previous pointer is maintained after the commit point', () => {
  it('records the outgoing active version once publication commits', async () => {
    const { storage, publisher, source } = await seeded();

    const result = await publisher.publish(setFor(source, V3, AT_V3));

    expect(result.status).toBe('applied');
    expect(await storage.pointers(SEASON)).toEqual({
      active: V3,
      previous: V2,
    });
  });

  it('reports an applied publication whose maintenance write failed', async () => {
    const { storage, purger, publisher, source } = await seeded();
    const purgedBefore = purger.purgedUrls.length;
    storage.arm('setPreviousVersion', 'every');

    const result = await publisher.publish(setFor(source, V3, AT_V3));

    expect(result.status).toBe('applied');
    expect(result.pointerMaintenance).toBe('failed');
    expect(result.reason).toBe('previous-pointer-maintenance-failed');
    expect((await storage.pointers(SEASON)).active).toBe(V3);
    // The commit already happened, so the required purge still runs.
    expect(purger.purgedUrls.length).toBeGreaterThan(purgedBefore);
  });

  it('reports an applied rollback whose maintenance write failed', async () => {
    const { storage, purger, publisher } = await seeded();
    const purgedBefore = purger.purgedUrls.length;
    storage.arm('setPreviousVersion', 'every');

    const result = await publisher.rollback(SEASON, V1);

    expect(result.status).toBe('applied');
    expect(result.pointerMaintenance).toBe('failed');
    expect((await storage.pointers(SEASON)).active).toBe(V1);
    expect(purger.purgedUrls.length).toBeGreaterThan(purgedBefore);
  });

  it('records not-required when nothing was previously active', async () => {
    const storage = new ScriptableStorage();
    const publisher = publisherFor(storage, new MemoryCachePurgeAdapter());
    const source = await seasonFixture();

    const result = await publisher.publish(setFor(source, V1, AT_V1));

    expect(result.status).toBe('applied');
    expect(result.pointerMaintenance).toBe('not-required');
  });
});

describe('every rollback phase failure returns a bounded result', () => {
  const preCommitReads: { phase: StoragePhase; onCall: number | 'every' }[] = [
    { phase: 'getActiveVersion', onCall: 1 },
    { phase: 'getPreviousVersion', onCall: 1 },
    { phase: 'readVersionInventory', onCall: 'every' },
    { phase: 'readVersionedDocument', onCall: 'every' },
  ];

  for (const mode of ['throw', 'reject'] as const) {
    const label = mode === 'throw' ? 'throwing' : 'rejecting';
    for (const { phase, onCall } of preCommitReads) {
      it(`contains a ${label} ${phase} read as storage-read`, async () => {
        const { storage, publisher } = await seeded();
        storage.arm(phase, onCall, mode);

        const settled = await settle(() => publisher.rollback(SEASON));

        expect(settled.rejected).toBe(false);
        expect(settled.value?.status).toBe('failed');
        expect(settled.value?.reason).toBe('storage-read');
        expect(await storage.pointers(SEASON)).toEqual({
          active: V2,
          previous: V1,
        });
      });
    }

    it(`contains a ${label} active-pointer commit as storage-write`, async () => {
      const { storage, purger, publisher } = await seeded();
      const purgedBefore = purger.purgedUrls.length;
      storage.arm('setActiveVersion', 1, mode);

      const settled = await settle(() => publisher.rollback(SEASON));

      expect(settled.rejected).toBe(false);
      expect(settled.value?.status).toBe('failed');
      expect(settled.value?.reason).toBe('storage-write');
      expect(await storage.pointers(SEASON)).toEqual({
        active: V2,
        previous: V1,
      });
      expect(purger.purgedUrls.length).toBe(purgedBefore);
    });

    it(`contains a ${label} previous-pointer maintenance write after commit`, async () => {
      const { storage, publisher } = await seeded();
      storage.arm('setPreviousVersion', 'every', mode);

      const settled = await settle(() => publisher.rollback(SEASON));

      expect(settled.rejected).toBe(false);
      expect(settled.value?.status).toBe('applied');
      expect(settled.value?.pointerMaintenance).toBe('failed');
      expect((await storage.pointers(SEASON)).active).toBe(V1);
    });

    it(`contains a ${label} purge as an applied rollback`, async () => {
      const storage = new ScriptableStorage();
      const seedPublisher = publisherFor(
        storage,
        new MemoryCachePurgeAdapter(),
      );
      const source = await seasonFixture();
      await seedPublisher.publish(setFor(source, V1, AT_V1));
      await seedPublisher.publish(setFor(source, V2, AT_V2));

      const purger = new ExplodingPurgeAdapter(mode);
      const settled = await settle(() =>
        publisherFor(storage, purger).rollback(SEASON),
      );

      expect(settled.rejected).toBe(false);
      expect(settled.value?.status).toBe('applied');
      expect(settled.value?.cachePurge).toBe('failed');
      expect(settled.value?.purgedUrls).toEqual([]);
      expect((await storage.pointers(SEASON)).active).toBe(V1);
    });
  }

  it('rejects an incomplete target with the precise reason and moves nothing', async () => {
    const { storage, purger, publisher } = await seeded();
    const purgedBefore = purger.purgedUrls.length;
    storage.hideDocument(SEASON, V1, 'circuit:monaco');

    const result = await publisher.rollback(SEASON, V1);

    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('rollback-target-incomplete');
    expect(await storage.pointers(SEASON)).toEqual({
      active: V2,
      previous: V1,
    });
    expect(purger.purgedUrls.length).toBe(purgedBefore);
  });

  it('never exposes the underlying storage message', async () => {
    const { storage, publisher } = await seeded();
    storage.arm('getActiveVersion', 1);

    const result = await publisher.rollback(SEASON);

    expect(JSON.stringify(result)).not.toContain('secret-key');
    expect(JSON.stringify(result)).not.toContain('KV outage');
  });
});
