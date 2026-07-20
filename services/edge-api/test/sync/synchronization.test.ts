import { describe, expect, it } from 'vitest';

import worker from '../../src/index';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import type { QuotaState } from '../../src/storage/types';
import {
  adminRequest,
  createHarness,
  request,
  seedPublishedSnapshot,
} from '../support/edge-harness';

describe('synchronization orchestration', () => {
  it('performs no provider call when no scheduled job is due', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const calls = harness.provider.callCount;

    await worker.scheduled?.({} as ScheduledController, harness.env);

    expect(harness.provider.callCount).toBe(calls);
    const state = await harness.storage.getSyncState(2026);
    expect(state?.lastPublicationStatus).toBe('skipped');
  });

  it('runs manual sync through the same orchestration as scheduled sync', async () => {
    const harness = createHarness();

    const response = await worker.fetch(
      adminRequest('/internal/admin/sync/resource', 'local-test-token', {
        resource: 'standings',
      }),
      harness.env,
    );
    const body = (await response.json()) as {
      data: { dueJobs: string[]; publicationStatus: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.dueJobs).toEqual(['standings']);
    expect(body.data.publicationStatus).toBe('applied');
    expect(await harness.storage.getActiveVersion(2026)).toBeTypeOf('string');
  });

  it('preserves the active snapshot after provider failure', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const active = await harness.storage.getActiveVersion(2026);
    const failingProvider = new MockFormulaOneProvider({
      clock: harness.clock,
      failureMode: 'failure',
      sourceUpdatedAt: '2026-07-18T12:10:00.000Z',
    });
    const failing = createHarness({ provider: failingProvider });
    failing.env.__LOCAL_STORAGE = harness.storage;

    const response = await worker.fetch(
      adminRequest('/internal/admin/sync/full'),
      failing.env,
    );
    const body = (await response.json()) as {
      data: { status: string; failureCategory: string };
    };

    expect(body.data.status).toBe('failed');
    expect(body.data.failureCategory).toBe('mock-provider-failure');
    expect(await harness.storage.getActiveVersion(2026)).toBe(active);
  });

  it('skips low-priority jobs when quota is high', async () => {
    const harness = createHarness();
    await harness.storage.setQuotaState(quota('high'));

    const response = await worker.fetch(
      adminRequest('/internal/admin/sync/full'),
      harness.env,
    );
    const body = (await response.json()) as {
      data: { skippedJobs: string[]; dueJobs: string[] };
    };

    expect(response.status).toBe(200);
    expect(body.data.skippedJobs).toEqual(['profiles', 'home-rebuild']);
    expect(body.data.dueJobs).not.toContain('profiles');
  });

  it('records rate limiting and avoids an immediate retry', async () => {
    const rateLimitedProvider = new MockFormulaOneProvider({
      clock: createHarness().clock,
      failureMode: 'rate_limited',
    });
    const harness = createHarness({ provider: rateLimitedProvider });

    const first = await worker.fetch(
      adminRequest('/internal/admin/sync/full'),
      harness.env,
    );
    const quotaAfterFailure = await harness.storage.getQuotaState();
    const calls = rateLimitedProvider.callCount;

    const workingProvider = new MockFormulaOneProvider({
      clock: harness.clock,
    });
    const retry = createHarness({ provider: workingProvider });
    retry.env.__LOCAL_STORAGE = harness.storage;
    await worker.scheduled?.({} as ScheduledController, retry.env);

    expect(first.status).toBe(200);
    expect(quotaAfterFailure?.retryAfter).toBeTypeOf('string');
    expect(rateLimitedProvider.callCount).toBe(calls);
    expect(workingProvider.callCount).toBe(0);
  });

  it('public reads consume no provider quota', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const calls = harness.provider.callCount;

    await worker.fetch(request('/v1/seasons/2026/calendar'), harness.env);
    await worker.fetch(request('/v1/home?season=2026'), harness.env);

    expect(harness.provider.callCount).toBe(calls);
  });
});

function quota(warningLevel: QuotaState['warningLevel']): QuotaState {
  return {
    dailyLimit: 1000,
    dailyRemaining: 100,
    perMinuteLimit: 60,
    perMinuteRemaining: 10,
    lastProviderSuccessAt: null,
    lastProviderFailureAt: null,
    retryAfter: null,
    usageByJobCategory: {},
    warningLevel,
  };
}
