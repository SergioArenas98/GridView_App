import { describe, expect, it } from 'vitest';

import worker from '../../src/index';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import type { Env, RuntimeConfig } from '../../src/config/environment';
import { resolveProvider } from '../../src/providers/factory';
import { SnapshotPublisher } from '../../src/publication/publisher';
import { FixedClock } from '../../src/runtime/clock';
import { SynchronizationService } from '../../src/sync/sync-service';
import type { SyncProviderAccounting } from '../../src/sync/sync-service';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import type { EdgeHarness } from '../support/edge-harness';
import {
  adminRequest,
  createHarness,
  providerCalls,
  request,
  seedPublishedSnapshot,
} from '../support/edge-harness';

interface SyncBody {
  data: {
    status: string;
    failureCategory: string | null;
    providerCallCount: number;
    providerRequests: SyncProviderAccounting;
  };
}

/**
 * The admin `sync/full` route always forces every job, so the scheduler's
 * "nothing is due" path is only reachable through the service itself.
 */
function syncServiceFor(harness: EdgeHarness): SynchronizationService {
  return new SynchronizationService(
    harness.storage,
    harness.provider,
    new SnapshotPublisher(
      harness.storage,
      runtimeSnapshotValidator,
      harness.purger,
      harness.logger,
      'https://api.gridview.test',
    ),
    harness.clock,
    harness.logger,
  );
}

async function runFullSync(env: Parameters<typeof worker.fetch>[1]) {
  const response = await worker.fetch(
    adminRequest('/internal/admin/sync/full'),
    env,
  );
  return { response, body: (await response.json()) as SyncBody };
}

describe('typed provider request accounting', () => {
  it('reports typed total and per-source counts for a successful sync', async () => {
    const harness = createHarness();

    const { body } = await runFullSync(harness.env);
    const accounting = body.data.providerRequests;

    expect(body.data.status).toBe('completed');
    // The compatibility total keeps its lifetime semantics.
    expect(body.data.providerCallCount).toBe(providerCalls(harness.provider));
    expect(accounting.lifetime.total).toBe(body.data.providerCallCount);
    expect(accounting.operation).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });
    expect(accounting.bySource).toEqual({
      mock: { total: 1, successful: 1, failed: 0, rateLimited: 0 },
    });
    // No source other than the one that ran appears at all.
    expect(accounting.bySource.jolpica).toBeUndefined();
    expect(accounting.bySource.openf1).toBeUndefined();
    // One attempt served every due job, so each category is charged once.
    expect(accounting.byJobCategory.standings).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });
    expect(accounting.byJobCategory.profiles?.total).toBe(1);
  });

  it('counts a failed attempt as an attempted provider request', async () => {
    const failing = createHarness({
      provider: new MockFormulaOneProvider({
        clock: createHarness().clock,
        failureMode: 'failure',
      }),
    });

    const { body } = await runFullSync(failing.env);
    const accounting = body.data.providerRequests;

    expect(body.data.status).toBe('failed');
    expect(body.data.failureCategory).toBe('mock-provider-failure');
    expect(accounting.operation).toEqual({
      total: 1,
      successful: 0,
      failed: 1,
      rateLimited: 0,
    });
    expect(accounting.bySource.mock?.failed).toBe(1);
    expect(accounting.byJobCategory.results?.failed).toBe(1);
  });

  it('counts a rate-limited attempt as an attempted provider request', async () => {
    const rateLimited = createHarness({
      provider: new MockFormulaOneProvider({
        clock: createHarness().clock,
        failureMode: 'rate_limited',
      }),
    });

    const { body } = await runFullSync(rateLimited.env);
    const accounting = body.data.providerRequests;

    expect(body.data.failureCategory).toBe('provider-rate-limited');
    expect(accounting.operation).toEqual({
      total: 1,
      successful: 0,
      failed: 0,
      rateLimited: 1,
    });
    expect(accounting.bySource.mock?.rateLimited).toBe(1);
  });

  it('reports zero operation calls when no job is due', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const lifetimeAfterSeed = providerCalls(harness.provider);

    const result = await syncServiceFor(harness).run({
      season: 2026,
      trigger: 'scheduled',
    });
    const accounting = result.providerRequests;

    expect(result.status).toBe('skipped');
    expect(accounting.operation).toEqual({
      total: 0,
      successful: 0,
      failed: 0,
      rateLimited: 0,
    });
    expect(accounting.bySource).toEqual({});
    expect(accounting.byJobCategory).toEqual({});
    // The lifetime total still carries the earlier seed run.
    expect(accounting.lifetime.total).toBe(lifetimeAfterSeed);
    expect(result.providerCallCount).toBe(lifetimeAfterSeed);
    expect(providerCalls(harness.provider)).toBe(lifetimeAfterSeed);
  });

  it('reports zero calls for public reads', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const before = providerCalls(harness.provider);

    await worker.fetch(request('/v1/seasons/2026/calendar'), harness.env);
    await worker.fetch(request('/v1/home?season=2026'), harness.env);
    await worker.fetch(request('/v1/standings/../v1/status'), harness.env);

    expect(providerCalls(harness.provider)).toBe(before);
  });

  it('logs bounded per-source integer counts and no provider strings', async () => {
    const harness = createHarness();

    await runFullSync(harness.env);
    const completed = harness.logger.events.find(
      (event) => event.operation === 'sync.completed',
    );

    expect(completed?.providerSourceId).toBe('mock');
    expect(completed?.providerCallsBySource).toEqual({ mock: 1 });
    expect(completed?.providerOperationCallCount).toBe(1);
    expect(typeof completed?.providerCallCount).toBe('number');
    // The provider's display name never reaches a log line.
    expect(harness.logger.serialized()).not.toContain(
      'mock-development-provider',
    );
  });
});

describe('operation-scoped accounting rests on ledger isolation', () => {
  it('gives every runtime operation its own provider ledger', () => {
    // `operation` is a difference of lifetime snapshots, which is only sound
    // while one provider instance serves one operation. In production that is
    // structural: resolveProvider constructs a new provider per fetch and per
    // scheduled invocation, so overlapping runs cannot share a ledger.
    const env: Env = { ENVIRONMENT: 'development', PROVIDER_MODE: 'mock' };
    const config: RuntimeConfig = {
      environment: 'development',
      providerMode: 'mock',
      publicBaseUrl: null,
    };
    const clock = new FixedClock(new Date('2026-07-20T12:00:00.000Z'));

    const first = resolveProvider(env, config, clock);
    const second = resolveProvider(env, config, clock);

    expect(first).not.toBe(second);
    expect(first?.requestMetrics().lifetime.total).toBe(0);
    expect(second?.requestMetrics().lifetime.total).toBe(0);
  });

  it('reports each run separately when a provider is deliberately shared', async () => {
    // The test-only __PROVIDER override is the one shared-instance path. Runs
    // are sequential, so each still reports its own attempts while the
    // lifetime total accumulates.
    const harness = createHarness();
    const service = syncServiceFor(harness);

    const first = await service.run({
      season: 2026,
      trigger: 'manual-full',
      forceJobs: ['standings'],
    });
    const second = await service.run({
      season: 2026,
      trigger: 'manual-full',
      forceJobs: ['results'],
    });

    expect(first.providerRequests.operation.total).toBe(1);
    expect(second.providerRequests.operation.total).toBe(1);
    expect(first.providerRequests.lifetime.total).toBe(1);
    expect(second.providerRequests.lifetime.total).toBe(2);
    expect(second.providerRequests.byJobCategory.standings).toBeUndefined();
    expect(second.providerRequests.byJobCategory.results?.total).toBe(1);
  });
});

describe('locally modelled quota is updated per source', () => {
  it('records a successful attempt against the mock source only', async () => {
    const harness = createHarness();

    await runFullSync(harness.env);

    const mock = await harness.storage.getQuotaState('mock');
    expect(mock?.sourceId).toBe('mock');
    expect(mock?.testOnly).toBe(true);
    expect(mock?.lastProviderSuccessAt).toBe('2026-07-20T12:00:00.000Z');
    expect(mock?.windows.every((window) => window.used === 1)).toBe(true);
    expect(mock?.usageByJobCategory.standings).toBe(1);
    // Nothing was written for a source that never ran.
    expect(await harness.storage.getQuotaState('jolpica')).toBeNull();
    expect(await harness.storage.getQuotaState('openf1')).toBeNull();
  });

  it('records a rate-limit rejection as critical with its Retry-After', async () => {
    const harness = createHarness({
      provider: new MockFormulaOneProvider({
        clock: createHarness().clock,
        failureMode: 'rate_limited',
      }),
    });

    await runFullSync(harness.env);
    const mock = await harness.storage.getQuotaState('mock');

    expect(mock?.warningLevel).toBe('critical');
    expect(mock?.retryAfter).toBe('2026-07-20T12:01:00.000Z');
    expect(mock?.lastProviderFailureAt).toBe('2026-07-20T12:00:00.000Z');
    // The rejected request still consumed modelled capacity.
    expect(mock?.windows.every((window) => window.used === 1)).toBe(true);
  });
});

describe('internal admin quota endpoint', () => {
  it('reports every canonical source separately', async () => {
    const harness = createHarness();
    await runFullSync(harness.env);

    const response = await worker.fetch(
      adminRequest(
        '/internal/admin/quota',
        'local-test-token',
        undefined,
        'GET',
      ),
      harness.env,
    );
    const body = (await response.json()) as {
      data: { sources: Record<string, { sourceId?: string } | null> };
    };

    expect(response.status).toBe(200);
    expect(Object.keys(body.data.sources).sort()).toEqual([
      'jolpica',
      'mock',
      'openf1',
    ]);
    expect(body.data.sources.mock?.sourceId).toBe('mock');
    expect(body.data.sources.jolpica).toBeNull();
    expect(body.data.sources.openf1).toBeNull();
  });
});
