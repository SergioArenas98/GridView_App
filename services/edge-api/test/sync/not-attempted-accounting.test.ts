import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import worker from '../../src/index';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import {
  ProviderError,
  ProviderRateLimitedError,
  ProviderRequestNotAttemptedError,
  type FormulaOneProvider,
  type ProviderSeasonSource,
  type ProviderStatus,
} from '../../src/providers/formula-one-provider';
import {
  ProviderRequestLedger,
  type ProviderRequestMetrics,
} from '../../src/providers/provider-metrics';
import {
  quotaPolicyFor,
  type ProviderQuotaPolicy,
} from '../../src/providers/provider-source';
import type { SyncProviderAccounting } from '../../src/sync/sync-service';
import {
  adminRequest,
  createHarness,
  providerCalls,
  request,
  seedPublishedSnapshot,
} from '../support/edge-harness';

const repoRoot = join(__dirname, '..', '..', '..', '..');

interface SyncBody {
  data: {
    status: string;
    failureCategory: string | null;
    providerCallCount: number;
    providerRequests: SyncProviderAccounting;
  };
}

/**
 * A provider that throws before issuing anything, standing in for a future
 * adapter whose reservation was deferred or whose limiter was unavailable.
 * Its ledger stays empty precisely because nothing left GridView.
 */
class NotAttemptingProvider implements FormulaOneProvider {
  readonly name = 'not-attempting-test-provider';
  readonly sourceId = 'mock' as const;
  readonly quotaPolicy: ProviderQuotaPolicy = quotaPolicyFor('mock');
  private readonly ledger = new ProviderRequestLedger();

  constructor(
    private readonly category: string,
    private readonly retryAt?: string,
  ) {}

  requestMetrics(): ProviderRequestMetrics {
    return this.ledger.snapshot();
  }

  async fetchSeasonSource(): Promise<ProviderSeasonSource> {
    throw new ProviderRequestNotAttemptedError(this.category, this.retryAt);
  }

  async getProviderStatus(): Promise<ProviderStatus> {
    return { sourceId: this.sourceId, status: 'degraded' };
  }
}

async function fullSync(env: Parameters<typeof worker.fetch>[1]) {
  const response = await worker.fetch(
    adminRequest('/internal/admin/sync/full'),
    env,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as SyncBody;
}

describe('a request GridView never sent is not a provider attempt', () => {
  it('records zero provider attempts for a local rate-limit deferral', async () => {
    const harness = createHarness();
    harness.env.__PROVIDER = new NotAttemptingProvider(
      'provider-rate-limit-deferred',
      '2026-07-20T12:00:01.000Z',
    );

    const body = await fullSync(harness.env);
    const quota = await harness.storage.getQuotaState('mock');

    expect(body.data.status).toBe('failed');
    expect(body.data.failureCategory).toBe('provider-rate-limit-deferred');
    // No attempt in the ledger, and none charged to quota.
    expect(body.data.providerRequests.operation).toEqual({
      total: 0,
      successful: 0,
      failed: 0,
      rateLimited: 0,
    });
    expect(body.data.providerRequests.bySource).toEqual({});
    expect(quota).toBeNull();
  });

  it('records zero provider attempts when the limiter is unavailable', async () => {
    const harness = createHarness();
    harness.env.__PROVIDER = new NotAttemptingProvider(
      'provider-limiter-unavailable',
    );

    const body = await fullSync(harness.env);

    expect(body.data.failureCategory).toBe('provider-limiter-unavailable');
    expect(body.data.providerRequests.operation.total).toBe(0);
    expect(providerCalls(harness.provider)).toBe(0);
    // Quota was never written, so no usage or failure timestamp was invented.
    expect(await harness.storage.getQuotaState('mock')).toBeNull();
  });

  it('preserves the last-known-good release when nothing was sent', async () => {
    const seed = createHarness();
    await seedPublishedSnapshot(seed);
    const active = await seed.storage.getActiveVersion(2026);
    const quotaAfterSeed = await seed.storage.getQuotaState('mock');

    const deferring = createHarness();
    deferring.env.__PROVIDER = new NotAttemptingProvider(
      'provider-rate-limit-deferred',
    );
    deferring.env.__LOCAL_STORAGE = seed.storage;
    await fullSync(deferring.env);

    expect(await seed.storage.getActiveVersion(2026)).toBe(active);
    // Quota is byte-identical to before: no attempt, no usage, no timestamps.
    expect(await seed.storage.getQuotaState('mock')).toEqual(quotaAfterSeed);
  });

  it('keeps the not-attempted type distinct from a real provider failure', () => {
    const notAttempted = new ProviderRequestNotAttemptedError('deferred');

    // Must not be catchable as a ProviderError, or the sync service would
    // record a failed attempt for a request that never happened.
    expect(notAttempted).not.toBeInstanceOf(ProviderError);
    expect(notAttempted).not.toBeInstanceOf(ProviderRateLimitedError);
    expect(new ProviderRateLimitedError('x')).toBeInstanceOf(ProviderError);
  });
});

describe('an attempted request still counts, unchanged from Phase 9B-1', () => {
  it('counts an upstream 429 as an attempted, rate-limited request', async () => {
    const harness = createHarness({
      provider: new MockFormulaOneProvider({
        clock: createHarness().clock,
        failureMode: 'rate_limited',
      }),
    });

    const body = await fullSync(harness.env);
    const quota = await harness.storage.getQuotaState('mock');

    expect(body.data.providerRequests.operation).toEqual({
      total: 1,
      successful: 0,
      failed: 0,
      rateLimited: 1,
    });
    expect(quota?.warningLevel).toBe('critical');
    expect(quota?.retryAfter).toBe('2026-07-20T12:01:00.000Z');
  });

  it('leaves mock success and failure accounting untouched', async () => {
    const success = createHarness();
    const successBody = await fullSync(success.env);
    expect(successBody.data.providerRequests.operation).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });

    const failing = createHarness({
      provider: new MockFormulaOneProvider({
        clock: createHarness().clock,
        failureMode: 'failure',
      }),
    });
    const failingBody = await fullSync(failing.env);
    expect(failingBody.data.providerRequests.operation).toEqual({
      total: 1,
      successful: 0,
      failed: 1,
      rateLimited: 0,
    });
    expect(failingBody.data.failureCategory).toBe('mock-provider-failure');
  });

  it('keeps public reads free of provider requests', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const before = providerCalls(harness.provider);

    await worker.fetch(request('/v1/seasons/2026/calendar'), harness.env);
    await worker.fetch(request('/v1/home?season=2026'), harness.env);
    await worker.fetch(request('/v1/status'), harness.env);

    expect(providerCalls(harness.provider)).toBe(before);
  });
});

describe('Phase 9B-2 changes no runtime provider posture', () => {
  const wrangler = readFileSync(
    join(repoRoot, 'services', 'edge-api', 'wrangler.toml'),
    'utf8',
  );

  it('keeps PROVIDER_MODE exactly mock and none', () => {
    const environment = readFileSync(
      join(repoRoot, 'services', 'edge-api', 'src', 'config', 'environment.ts'),
      'utf8',
    );

    expect(environment).toContain(
      "const validProviderModes = ['mock', 'none'] as const;",
    );
    expect(wrangler).not.toMatch(
      /PROVIDER_MODE = "(jolpica|openf1|live|dual)"/,
    );
  });

  it('keeps staging on mock and production on none', () => {
    expect(wrangler).toMatch(
      /\[env\.staging\.vars\][\s\S]*PROVIDER_MODE = "mock"/,
    );
    expect(wrangler).toMatch(
      /\[env\.production\.vars\][\s\S]*PROVIDER_MODE = "none"/,
    );
  });

  it('declares the Durable Object binding and SQLite export in every environment', () => {
    // Configuration only: nothing is provisioned or deployed by this phase.
    const bindings = wrangler.match(/name = "PROVIDER_RATE_LIMITER"/g) ?? [];
    expect(bindings).toHaveLength(3);
    expect(wrangler).toContain('[exports.ProviderRateLimiter]');
    expect(wrangler).toContain('storage = "sqlite"');
    expect(wrangler).toContain('class_name = "ProviderRateLimiter"');
  });

  it('adds no other Cloudflare service and no rate-limiting binding', () => {
    expect(wrangler).not.toContain('[[unsafe.bindings]]');
    expect(wrangler).not.toContain('ratelimit');
    expect(wrangler).not.toContain('[[d1_databases]]');
    expect(wrangler).not.toContain('[[r2_buckets]]');
    expect(wrangler).not.toContain('[[queues');
    // The staging cron is unchanged.
    expect(wrangler).toContain('crons = ["17 3 * * *"]');
  });

  it('exports the Durable Object class from the Worker module', () => {
    const index = readFileSync(
      join(repoRoot, 'services', 'edge-api', 'src', 'index.ts'),
      'utf8',
    );

    expect(index).toContain('export { ProviderRateLimiter }');
  });
});
