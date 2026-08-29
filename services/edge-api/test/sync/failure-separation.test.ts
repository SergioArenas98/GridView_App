import { describe, expect, it } from 'vitest';

import worker from '../../src/index';
import type { CachePurgeAdapter } from '../../src/cache/purge';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import type { SyncProviderAccounting } from '../../src/sync/sync-service';
import type { SnapshotValidator } from '../../src/validation/snapshot-validator';
import {
  adminRequest,
  createHarness,
  providerCalls,
  seedPublishedSnapshot,
  type EdgeHarness,
} from '../support/edge-harness';

interface SyncBody {
  data: {
    status: string;
    failureCategory: string | null;
    publicationStatus: string | null;
    providerCallCount: number;
    providerRequests: SyncProviderAccounting;
  };
}

async function fullSync(harness: EdgeHarness): Promise<SyncBody> {
  const response = await worker.fetch(
    adminRequest('/internal/admin/sync/full'),
    harness.env,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as SyncBody;
}

/** Rejects every document, so publication fails without throwing. */
const rejectingValidator: SnapshotValidator = {
  validate: () => [{ path: 'data', message: 'injected contract failure' }],
};

/**
 * Throws during cache purge, which the publisher runs *outside* its internal
 * storage try. It runs *after* the active pointer has moved, so it can no
 * longer fail a publication - the release is already serving. It is kept here
 * to pin exactly that: a purge explosion is a completed synchronization with a
 * bounded cache warning, never a synchronization failure.
 */
const throwingPurger: CachePurgeAdapter = {
  purgePublicUrls: () => {
    throw new Error('injected purge explosion with sensitive detail');
  },
};

describe('provider-fetch failures are accounted as provider failures', () => {
  it('records exactly one failed attempt and preserves last-known-good', async () => {
    const seed = createHarness();
    await seedPublishedSnapshot(seed);
    const active = await seed.storage.getActiveVersion(2026);
    const quotaAfterSeed = await seed.storage.getQuotaState('mock');

    const failing = createHarness({
      provider: new MockFormulaOneProvider({
        clock: seed.clock,
        failureMode: 'failure',
      }),
    });
    failing.env.__LOCAL_STORAGE = seed.storage;

    const body = await fullSync(failing);
    const quota = await seed.storage.getQuotaState('mock');

    expect(body.data.status).toBe('failed');
    expect(body.data.failureCategory).toBe('mock-provider-failure');
    expect(body.data.providerRequests.operation).toEqual({
      total: 1,
      successful: 0,
      failed: 1,
      rateLimited: 0,
    });
    // The failure timestamp advanced; no success timestamp was invented.
    expect(quota?.lastProviderFailureAt).toBe('2026-07-20T12:00:00.000Z');
    expect(quota?.lastProviderSuccessAt).toBe(
      quotaAfterSeed?.lastProviderSuccessAt ?? null,
    );
    expect(await seed.storage.getActiveVersion(2026)).toBe(active);
  });

  it('records exactly one rate-limited attempt and preserves Retry-After', async () => {
    const harness = createHarness({
      provider: new MockFormulaOneProvider({
        clock: createHarness().clock,
        failureMode: 'rate_limited',
      }),
    });

    const body = await fullSync(harness);
    const quota = await harness.storage.getQuotaState('mock');

    expect(body.data.failureCategory).toBe('provider-rate-limited');
    expect(body.data.providerRequests.operation).toEqual({
      total: 1,
      successful: 0,
      failed: 0,
      rateLimited: 1,
    });
    expect(quota?.warningLevel).toBe('critical');
    expect(quota?.retryAfter).toBe('2026-07-20T12:01:00.000Z');
  });
});

describe('post-fetch failures never rewrite provider accounting', () => {
  it('keeps provider success when publication throws after the fetch', async () => {
    const seed = createHarness();
    await seedPublishedSnapshot(seed);

    const later = createHarness();
    later.env.__LOCAL_STORAGE = seed.storage;
    later.env.__CLOCK = { now: () => new Date('2026-07-21T14:00:00.000Z') };
    // A pre-commit storage write failure: publication cannot reach the active
    // pointer, so the synchronization genuinely failed on GridView's side.
    seed.storage.setWriteFailure((key) => key.includes(':calendar'));

    const body = await fullSync(later);
    seed.storage.setWriteFailure(null);
    const quota = await seed.storage.getQuotaState('mock');

    // Provider side: exactly one success, zero failures.
    expect(body.data.providerRequests.operation).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });
    expect(body.data.providerRequests.bySource.mock?.successful).toBe(1);
    expect(body.data.providerRequests.bySource.mock?.failed).toBe(0);
    // Quota agrees with the ledger: the success stands, no provider failure.
    expect(quota?.lastProviderSuccessAt).toBe('2026-07-21T14:00:00.000Z');
    expect(quota?.lastProviderFailureAt).toBeNull();
    expect(quota?.warningLevel).not.toBe('critical');
    // The synchronization still failed, attributed to GridView, not the source.
    expect(body.data.status).toBe('failed');
    // The publisher now contains the failure and reports its own bounded
    // reason, which is more precise than the generic post-fetch category and
    // still a closed value. What matters is that it is a GridView-side
    // category, never a provider one.
    expect(body.data.failureCategory).toBe('storage-write');
    expect(body.data.failureCategory).not.toBe('mock-provider-failure');
    expect(body.data.failureCategory).not.toBe('provider-rate-limited');
    const syncState = await seed.storage.getSyncState(2026);
    expect(syncState?.lastFailedAt).toBeTypeOf('string');
    expect(syncState?.lastFailureCategory).toBe('storage-write');
    // The internal exception body never reaches the response or the logs.
    expect(JSON.stringify(body)).not.toContain('sensitive detail');
    expect(later.logger.serialized()).not.toContain('sensitive detail');
  });

  it('leaves a complete published release behind when publication throws', async () => {
    const seed = createHarness();
    await seedPublishedSnapshot(seed);
    const active = await seed.storage.getActiveVersion(2026);

    const later = createHarness();
    later.env.__LOCAL_STORAGE = seed.storage;
    later.env.__CLOCK = { now: () => new Date('2026-07-21T14:00:00.000Z') };
    later.env.__CACHE_PURGER = throwingPurger;
    await fullSync(later);

    // The purge throws only after the pointer moves, so what survives is a
    // complete release - never a torn or absent active pointer.
    expect(await seed.storage.getActiveVersion(2026)).toBeTypeOf('string');
    expect(await seed.storage.getPreviousVersion(2026)).toBe(active);
  });

  it('keeps provider success when a storage write fails without throwing', async () => {
    const seed = createHarness();
    await seedPublishedSnapshot(seed);
    const active = await seed.storage.getActiveVersion(2026);

    const later = createHarness();
    later.env.__LOCAL_STORAGE = seed.storage;
    later.env.__CLOCK = { now: () => new Date('2026-07-21T14:00:00.000Z') };
    seed.storage.setWriteFailure((key) => key.includes(':calendar'));

    const body = await fullSync(later);
    seed.storage.setWriteFailure(null);
    const quota = await seed.storage.getQuotaState('mock');

    // The publisher absorbs the storage error and returns its own failed
    // result. Existing semantics are preserved and no provider failure is
    // counted.
    expect(body.data.status).toBe('failed');
    expect(body.data.publicationStatus).toBe('failed');
    expect(body.data.failureCategory).toBe('storage-write');
    expect(body.data.providerRequests.operation).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });
    expect(quota?.lastProviderSuccessAt).toBe('2026-07-21T14:00:00.000Z');
    expect(quota?.lastProviderFailureAt).toBeNull();
    expect(await seed.storage.getActiveVersion(2026)).toBe(active);
  });

  it('preserves the existing semantics of an ordinary rejected publication', async () => {
    // A rejecting validator makes publish() return a non-throwing rejection.
    // How `rejected` maps to the synchronization status is pre-existing
    // behaviour and deliberately unchanged here; what this correction requires
    // is that no provider failure is recorded for it.
    const harness = createHarness({ validator: rejectingValidator });

    const body = await fullSync(harness);
    const quota = await harness.storage.getQuotaState('mock');

    expect(body.data.providerRequests.operation).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });
    expect(body.data.publicationStatus).toBe('rejected');
    expect(quota?.lastProviderSuccessAt).toBe('2026-07-20T12:00:00.000Z');
    expect(quota?.lastProviderFailureAt).toBeNull();
    expect(await harness.storage.getActiveVersion(2026)).toBeNull();
  });

  it('records exactly one quota attempt per provider request', async () => {
    const seed = createHarness();
    await seedPublishedSnapshot(seed);

    const later = createHarness();
    later.env.__LOCAL_STORAGE = seed.storage;
    later.env.__CLOCK = { now: () => new Date('2026-07-21T14:00:00.000Z') };
    later.env.__CACHE_PURGER = throwingPurger;
    await fullSync(later);

    const quota = await seed.storage.getQuotaState('mock');
    // The later clock rolled the minute window over, so this window shows the
    // single attempt this run made - not two from one request.
    const sustained = quota?.windows.find(
      (window) => window.windowClass === 'sustained',
    );
    expect(sustained?.used).toBe(1);
    expect(providerCalls(later.provider)).toBe(1);
  });
});

describe('a post-commit purge explosion does not fail the synchronization', () => {
  it('reports a completed run because the release is already serving', async () => {
    const seed = createHarness();
    await seedPublishedSnapshot(seed);
    const before = await seed.storage.getActiveVersion(2026);

    const later = createHarness();
    later.env.__LOCAL_STORAGE = seed.storage;
    later.env.__CLOCK = { now: () => new Date('2026-07-21T14:00:00.000Z') };
    later.env.__CACHE_PURGER = throwingPurger;

    const body = await fullSync(later);

    // The active pointer moved, so the publication committed. Calling this a
    // `snapshot-publication-failure` would claim the old release still serves.
    expect(body.data.status).toBe('completed');
    expect(body.data.publicationStatus).toBe('applied');
    expect(await seed.storage.getActiveVersion(2026)).not.toBe(before);
    // The injected detail never reaches a log line or the response.
    expect(later.logger.serialized()).not.toContain('sensitive detail');
    expect(JSON.stringify(body)).not.toContain('sensitive detail');
  });
});

describe('telemetry agrees across logs, quota and the admin result', () => {
  it('reports the same counts and source in the log line and the response', async () => {
    const seed = createHarness();
    await seedPublishedSnapshot(seed);

    const later = createHarness();
    later.env.__LOCAL_STORAGE = seed.storage;
    later.env.__CLOCK = { now: () => new Date('2026-07-21T14:00:00.000Z') };
    seed.storage.setWriteFailure((key) => key.includes(':calendar'));
    const body = await fullSync(later);
    seed.storage.setWriteFailure(null);

    const failed = later.logger.events.find(
      (event) => event.operation === 'sync.failed',
    );

    expect(failed?.providerSourceId).toBe('mock');
    expect(failed?.providerOperationCallCount).toBe(
      body.data.providerRequests.operation.total,
    );
    expect(failed?.providerCallCount).toBe(body.data.providerCallCount);
    expect(failed?.providerCallsBySource).toEqual({ mock: 1 });
    // No provider-controlled string reaches the log.
    expect(later.logger.serialized()).not.toContain(
      'mock-development-provider',
    );
  });
});
