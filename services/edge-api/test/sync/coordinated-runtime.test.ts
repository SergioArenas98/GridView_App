/**
 * The coordinated runtime through the real Worker entry points: the scheduled
 * handler, every admin route and the public reads.
 *
 * Every dependency is synthetic and local. Provider traffic is observable
 * three ways at once, and each must stay at zero: the counting limiter
 * (`__PROVIDER_RATE_LIMITER`), the counting transport
 * (`__PROVIDER_TRANSPORT`) and a global `fetch` stub. A spy on
 * `composeCoordinatedRuntime` shows whether the coordinated composition was
 * reached at all.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import worker, { type Env } from '../../src/index';
import { MemoryCachePurgeAdapter } from '../../src/cache/purge';
import { CapturingLogger } from '../../src/logging/logger';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from '../../src/providers/http/provider-rate-limiter';
import { SequencedPublicationService } from '../../src/publication/sequenced/service';
import { FixedClock } from '../../src/runtime/clock';
import { MemorySnapshotStorage } from '../../src/storage/local';
import { composeCoordinatedRuntime } from '../../src/sync/coordinated/composition';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import {
  SEASON,
  generatedSet,
  sequencedContext,
} from '../publication/sequenced/support';
import {
  adminRequest,
  createHarness,
  providerCalls,
  request,
  seedPublishedSnapshot,
} from '../support/edge-harness';

vi.mock('../../src/sync/coordinated/composition', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../src/sync/coordinated/composition')
    >();
  return {
    ...actual,
    composeCoordinatedRuntime: vi.fn(actual.composeCoordinatedRuntime),
  };
});

const compose = vi.mocked(composeCoordinatedRuntime);
const PUBLIC_BASE_URL = 'https://api.gridview.test';
const ADMIN_TOKEN = 'local-test-token';

interface Traffic {
  readonly reservations: number;
  readonly transport: number;
  readonly fetch: number;
}

class CountingLimiter implements ProviderRateLimiterClient {
  calls = 0;
  async reserve(
    sourceId: Parameters<ProviderRateLimiterClient['reserve']>[0],
  ): Promise<ReservationOutcome> {
    this.calls += 1;
    return { outcome: 'allowed', sourceId, headroom: [] };
  }
}

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

let limiter: CountingLimiter;
let transportCalls: number;
const transport = async (): Promise<Response> => {
  transportCalls += 1;
  return new Response('{}', { status: 503 });
};

beforeEach(() => {
  compose.mockClear();
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
  limiter = new CountingLimiter();
  transportCalls = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function traffic(): Traffic {
  return {
    reservations: limiter.calls,
    transport: transportCalls,
    fetch: globalFetch.mock.calls.length,
  };
}

const none: Traffic = { reservations: 0, transport: 0, fetch: 0 };

/** Every admin route, authorized, in a fixed order. */
const adminRoutes: readonly [string, string, unknown?][] = [
  ['GET', '/internal/admin/quota'],
  ['GET', '/internal/admin/sync/status'],
  ['GET', '/internal/admin/publication/cutover/status?season=2026'],
  ['POST', '/internal/admin/sync/full'],
  ['POST', '/internal/admin/sync/resource', { resource: 'standings' }],
  ['POST', '/internal/admin/rebuild/home'],
  ['POST', '/internal/admin/rollback'],
  ['POST', '/internal/admin/cache/purge'],
  ['POST', '/internal/admin/unknown'],
];

const publicReads: readonly string[] = [
  '/v1/status',
  '/v1/home?season=2026',
  '/v1/seasons/2026',
  '/v1/seasons/2026/calendar',
  '/v1/seasons/2026/standings/drivers',
];

async function driveEveryEntryPoint(env: Env): Promise<number[]> {
  const statuses: number[] = [];
  await worker.scheduled?.({} as ScheduledController, env);
  for (const [method, path, body] of adminRoutes) {
    const response = await worker.fetch(
      adminRequest(path, ADMIN_TOKEN, body, method),
      env,
    );
    statuses.push(response.status);
  }
  // Unauthorized admin calls are refused before anything else.
  statuses.push(
    (
      await worker.fetch(
        adminRequest('/internal/admin/sync/full', 'wrong'),
        env,
      )
    ).status,
  );
  for (const path of publicReads) {
    statuses.push((await worker.fetch(request(path), env)).status);
  }
  return statuses;
}

function unselectedEnv(environment: string, providerMode: string) {
  const harness = createHarness({ environment, providerMode });
  harness.env.PUBLIC_BASE_URL = PUBLIC_BASE_URL;
  harness.env.__PROVIDER_RATE_LIMITER = limiter;
  harness.env.__PROVIDER_TRANSPORT = transport;
  return harness;
}

describe('the existing modes never reach the coordinated runtime', () => {
  it.each([
    ['development', 'mock'],
    ['staging', 'mock'],
    ['staging', 'none'],
    ['production', 'none'],
    ['production', undefined],
  ] as const)(
    '%s / %s: scheduled, every admin route and every public read',
    async (environment, providerMode) => {
      const harness = unselectedEnv(environment, providerMode ?? 'none');
      if (providerMode === undefined) delete harness.env.PROVIDER_MODE;

      const statuses = await driveEveryEntryPoint(harness.env);

      expect(statuses.every((status) => status < 500)).toBe(true);
      expect(compose).not.toHaveBeenCalled();
      expect(traffic()).toEqual(none);
      expect(
        harness.logger.events.some((event) =>
          event.operation.startsWith('sync.coordinated'),
        ),
      ).toBe(false);
    },
  );

  it('keeps the mock mode synchronizing through the whole-season provider', async () => {
    const harness = unselectedEnv('staging', 'mock');
    const before = providerCalls(harness.provider);

    const response = await worker.fetch(
      adminRequest('/internal/admin/sync/full'),
      harness.env,
    );
    await worker.scheduled?.({} as ScheduledController, harness.env);

    expect(response.status).toBe(200);
    expect(providerCalls(harness.provider)).toBeGreaterThan(before);
    expect(await harness.storage.getActiveVersion(2026)).toBeTypeOf('string');
    expect(compose).not.toHaveBeenCalled();
    expect(traffic()).toEqual(none);
  });
});

/**
 * Staging selecting `coordinated`, with every dependency this change can bind:
 * the limiter, a reachable sequencer holding season 2026 `active`, and a purge
 * origin. Only the reconciliation ledger is missing, because nothing can bind
 * one yet.
 */
async function selectedStaging(
  options: { control?: string; cutover?: 'active' | 'seeded' } = {},
) {
  const ctx = await sequencedContext({ cutover: options.cutover ?? 'active' });
  const logger = new CapturingLogger();
  const provider = createHarness().provider;
  const env: Env = {
    ENVIRONMENT: 'staging',
    PROVIDER_MODE: 'coordinated',
    PUBLIC_BASE_URL,
    ADMIN_TOKEN,
    SEASON_PUBLICATION_AUTHORITY: 'sequencer',
    SEASON_PUBLICATION_CUTOVER_CONTROL: options.control ?? 'activate:2026',
    __SEASON_PUBLICATION_SEQUENCER: ctx.port,
    __LOCAL_STORAGE: ctx.storage,
    __CACHE_PURGER: new MemoryCachePurgeAdapter(),
    __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
    __CLOCK: ctx.clock,
    __LOGGER: logger,
    __PROVIDER: provider,
    __PROVIDER_RATE_LIMITER: limiter,
    __PROVIDER_TRANSPORT: transport,
  };
  return { ctx, env, logger, provider };
}

describe('a selected coordinated mode fails closed without the ledger', () => {
  it('refuses a manual run as ledger-unbound with zero provider requests', async () => {
    const { ctx, env, logger, provider } = await selectedStaging();
    const before = await ctx.port.readAuthority(SEASON);
    const mockCalls = providerCalls(provider);

    const response = await worker.fetch(
      adminRequest('/internal/admin/sync/full'),
      env,
    );
    const body = (await response.json()) as { data: unknown };

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body.data).toEqual({
      status: 'coordinated-runtime-unavailable',
      season: SEASON,
      run: {
        trigger: 'manual',
        forcedPublication: true,
        advancesSchedule: false,
      },
      reasons: ['ledger-unbound'],
      providerRequests: 0,
    });
    expect(compose).toHaveBeenCalledTimes(1);
    expect(compose.mock.results[0]?.value).toEqual({
      kind: 'unavailable',
      reasons: ['ledger-unbound'],
    });
    expect(traffic()).toEqual(none);
    // The mock provider is never used, nothing moved and nothing was recorded.
    expect(providerCalls(provider)).toBe(mockCalls);
    expect(await ctx.port.readAuthority(SEASON)).toEqual(before);
    expect(await ctx.storage.getSyncState(SEASON)).toBeNull();
    expect(
      logger.events.filter((event) =>
        event.operation.startsWith('sync.coordinated'),
      ),
    ).toEqual([
      {
        level: 'warn',
        operation: 'sync.coordinated.withheld',
        season: SEASON,
        syncTrigger: 'manual',
        coordinationStatus: 'coordinated-runtime-unavailable',
        failureCategory: 'coordinated-runtime-unavailable',
        coordinationMissingDependencies: ['ledger-unbound'],
        providerOperationCallCount: 0,
      },
    ]);
  });

  it('refuses a scheduled run the same way, in one bounded log line', async () => {
    const { ctx, env, logger } = await selectedStaging();
    const before = await ctx.port.readAuthority(SEASON);

    await worker.scheduled?.({} as ScheduledController, env);

    expect(compose).toHaveBeenCalledTimes(1);
    expect(compose.mock.calls[0]?.[0]).toMatchObject({
      purgeOrigin: PUBLIC_BASE_URL,
      authorityMode: 'sequencer',
      ledger: null,
    });
    expect(traffic()).toEqual(none);
    expect(await ctx.port.readAuthority(SEASON)).toEqual(before);
    const lines = logger.events.filter(
      (event) =>
        event.operation.startsWith('sync.') ||
        event.operation.startsWith('scheduled.'),
    );
    expect(lines).toEqual([
      expect.objectContaining({
        operation: 'sync.coordinated.withheld',
        syncTrigger: 'scheduled',
        coordinationMissingDependencies: ['ledger-unbound'],
      }),
    ]);
  });

  it('reports every missing dependency, and still sends nothing, when nothing is bound', async () => {
    const logger = new CapturingLogger();
    const env: Env = {
      ENVIRONMENT: 'staging',
      PROVIDER_MODE: 'coordinated',
      ADMIN_TOKEN,
      __LOCAL_STORAGE: new MemorySnapshotStorage(),
      __CACHE_PURGER: new MemoryCachePurgeAdapter(),
      __CLOCK: new FixedClock(new Date('2026-09-27T12:00:00.000Z')),
      __LOGGER: logger,
      __PROVIDER_TRANSPORT: transport,
    };

    // Scheduled: no PUBLIC_BASE_URL is a bounded reason, not a crash.
    await worker.scheduled?.({} as ScheduledController, env);
    // Manual: the request origin is the purge origin.
    const response = await worker.fetch(
      adminRequest('/internal/admin/sync/full'),
      env,
    );

    expect(
      logger.events
        .filter((event) => event.operation === 'sync.coordinated.withheld')
        .map((event) => [
          event.syncTrigger,
          event.coordinationMissingDependencies,
        ]),
    ).toEqual([
      [
        'scheduled',
        [
          'limiter-unbound',
          'authority-not-sequencer',
          'purge-origin-missing',
          'ledger-unbound',
        ],
      ],
      [
        'manual',
        ['limiter-unbound', 'authority-not-sequencer', 'ledger-unbound'],
      ],
    ]);
    expect(response.status).toBe(503);
    expect(
      logger.events.some((event) => event.operation === 'scheduled.failed'),
    ).toBe(false);
    expect(traffic()).toEqual(none);
  });

  it('refuses production under its legacy authority before any request', async () => {
    const harness = createHarness({
      environment: 'production',
      providerMode: 'coordinated',
    });
    harness.env.__PROVIDER_RATE_LIMITER = limiter;
    harness.env.__PROVIDER_TRANSPORT = transport;

    const response = await worker.fetch(
      adminRequest('/internal/admin/sync/full'),
      harness.env,
    );
    const body = (await response.json()) as { data: { reasons: string[] } };

    expect(response.status).toBe(503);
    expect(body.data.reasons).toEqual([
      'authority-not-sequencer',
      'ledger-unbound',
    ]);
    expect(traffic()).toEqual(none);
  });

  it('refuses the subset and home routes as unsupported without composing anything', async () => {
    const { env } = await selectedStaging();

    for (const [path, body] of [
      ['/internal/admin/sync/resource', { resource: 'standings' }],
      ['/internal/admin/rebuild/home', undefined],
    ] as const) {
      const response = await worker.fetch(
        adminRequest(path, ADMIN_TOKEN, body),
        env,
      );
      const payload = (await response.json()) as { error: { code: string } };
      expect(response.status, path).toBe(409);
      expect(payload.error.code).toBe('SYNC_MODE_UNSUPPORTED');
    }
    expect(compose).not.toHaveBeenCalled();
    expect(traffic()).toEqual(none);
  });

  it('keeps public reads and the other admin routes available', async () => {
    const seed = createHarness();
    await seedPublishedSnapshot(seed);
    const env: Env = {
      ...seed.env,
      ENVIRONMENT: 'staging',
      PROVIDER_MODE: 'coordinated',
      PUBLIC_BASE_URL,
      __PROVIDER_RATE_LIMITER: limiter,
      __PROVIDER_TRANSPORT: transport,
    };

    for (const path of publicReads) {
      expect((await worker.fetch(request(path), env)).status, path).toBe(200);
    }
    for (const path of [
      '/internal/admin/sync/status',
      '/internal/admin/quota',
    ]) {
      const response = await worker.fetch(
        adminRequest(path, ADMIN_TOKEN, undefined, 'GET'),
        env,
      );
      expect(response.status, path).toBe(200);
    }
    expect(compose).not.toHaveBeenCalled();
    expect(traffic()).toEqual(none);
  });
});

describe('the guarded publication a coordinated run would bind', () => {
  it('is the concrete sequenced service in the activation phase, publishing through the guard', async () => {
    const { ctx, env } = await selectedStaging();

    await worker.fetch(adminRequest('/internal/admin/sync/full'), env);

    const guarded = compose.mock.calls[0]?.[0].guarded;
    expect(guarded).toBeInstanceOf(SequencedPublicationService);
    // It is wired to this environment's sequencer: a guarded publication
    // against the active season commits there.
    const result = await guarded?.publishGuarded(
      await generatedSet(ctx.clock, 'guarded-probe', {
        sourceUpdatedAt: '2026-07-20T00:00:00.000Z',
        contentVersion: '2026.07.20.a',
      }),
    );
    expect(result?.status).toBe('applied');
    const authority = await ctx.port.readAuthority(SEASON);
    expect(authority.cutoverState === 'active' && authority.activeVersion).toBe(
      result?.version,
    );
  });

  it('is the concrete sequenced service in the seed phase too, which still refuses a season that is not active', async () => {
    const { ctx, env } = await selectedStaging({
      control: 'seed:2026',
      cutover: 'seeded',
    });

    await worker.fetch(adminRequest('/internal/admin/sync/full'), env);

    const guarded = compose.mock.calls[0]?.[0].guarded;
    expect(guarded).toBeInstanceOf(SequencedPublicationService);
    const before = await ctx.storage.getActiveVersion(SEASON);
    const result = await guarded?.publishGuarded(
      await generatedSet(ctx.clock, 'guarded-probe'),
    );
    expect(result).toMatchObject({
      status: 'failed',
      reason: 'guard-authority-not-sequenced',
    });
    expect(await ctx.storage.getActiveVersion(SEASON)).toBe(before);
  });

  it('is absent under the legacy authority', async () => {
    const harness = createHarness({
      environment: 'staging',
      providerMode: 'coordinated',
    });
    harness.env.PUBLIC_BASE_URL = PUBLIC_BASE_URL;

    await worker.fetch(adminRequest('/internal/admin/sync/full'), harness.env);

    expect(compose.mock.calls[0]?.[0]).toMatchObject({
      authorityMode: 'legacy',
      guarded: null,
    });
  });
});
