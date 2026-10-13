/**
 * The staging season-batch ingest configuration (decision pack 2026-10-07
 * PR-4, DP-6(b)), as Wrangler itself resolves `wrangler.toml`, driven through
 * the real Worker entry points.
 *
 * `env.staging` sets `SEASON_BATCH_INGEST = "2026"` and moves
 * `PROVIDER_MODE` from `mock` to `none`. Development, production, the cron and
 * the absent reconciliation-ledger binding do not change. This file proves
 * three things about that resolved configuration:
 *
 * - no scheduled run, and no manual whole-season sync, can build or publish a
 *   mock candidate in staging any more;
 * - production cannot ingest, whatever it is sent;
 * - the staging ingest still needs `ADMIN_TOKEN` and still publishes only
 *   through the guarded sequencer, bound to the reviewed active release.
 *
 * `unstable_readConfig` only reads the file. Nothing here deploys, provisions
 * or contacts Cloudflare, Jolpica or staging; every sequencer is in process
 * and every batch is synthetic.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { unstable_readConfig } from 'wrangler';

import rawConfig from '../../wrangler.toml?raw';
import worker, { type Env } from '../../src/index';
import { MemoryCachePurgeAdapter } from '../../src/cache/purge';
import { resolveRuntimeConfig } from '../../src/config/environment';
import { CapturingLogger } from '../../src/logging/logger';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import { SnapshotPublisher } from '../../src/publication/publisher';
import { SequencedPublicationService } from '../../src/publication/sequenced/service';
import { syncStateKey } from '../../src/storage/keys';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import type { SequencedContext } from '../publication/sequenced/support';
import {
  ingestContext,
  SEASON,
  SEED_VERSION,
  submissionFor,
  syntheticBatch,
  type Batch,
  type Json,
} from '../ingest/support';

const configPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'wrangler.toml',
);

const ADMIN_TOKEN = 'local-test-token';
const INGEST = '/internal/admin/season/ingest';
const SYNC = '/internal/admin/sync/full';

type Environment = '' | 'staging' | 'production';

/** The configuration Wrangler resolves for one environment (`''` = top level). */
function resolved(environment: Environment) {
  return unstable_readConfig(
    { config: configPath, env: environment === '' ? undefined : environment },
    { hideWarnings: true },
  );
}

/** The resolved variables of one environment, as the Worker receives them. */
function resolvedVars(environment: Environment): Partial<Env> {
  return Object.fromEntries(
    Object.entries(resolved(environment).vars).map(([name, value]) => [
      name,
      String(value),
    ]),
  );
}

function bindingNames(environment: Environment): string[] {
  return resolved(environment).durable_objects.bindings.map(
    (binding: { readonly name: string }) => binding.name,
  );
}

describe('the resolved configuration', () => {
  it('sets exactly SEASON_BATCH_INGEST "2026" and PROVIDER_MODE "none" in staging', () => {
    expect(resolved('staging').vars).toEqual({
      ENVIRONMENT: 'staging',
      PROVIDER_MODE: 'none',
      PUBLIC_BASE_URL: 'https://gridview-api-staging.sejuma18.workers.dev',
      SEASON_PUBLICATION_CUTOVER_CONTROL: 'activate:2026',
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_BATCH_INGEST: '2026',
    });
    // Assigned once in the whole file, so no other environment sets it.
    expect(rawConfig.match(/^\s*SEASON_BATCH_INGEST\s*=/gm)).toHaveLength(1);
    // No environment commits the mock provider any more.
    expect(rawConfig).not.toMatch(/^\s*PROVIDER_MODE\s*=\s*"mock"/m);
  });

  it('resolves staging to no provider under the unchanged sequencer and activation phase', () => {
    const config = resolveRuntimeConfig(resolvedVars('staging'));
    expect(config.environment).toBe('staging');
    expect(config.providerMode).toBe('none');
    expect(config.publicationAuthorityMode).toBe('sequencer');
    expect(config.publicationCutoverControl).toEqual({
      kind: 'activate',
      season: 2026,
    });
  });

  it('leaves development and production variables unchanged', () => {
    expect(resolved('').vars).toEqual({ ENVIRONMENT: 'development' });
    expect(resolved('production').vars).toEqual({
      ENVIRONMENT: 'production',
      PROVIDER_MODE: 'none',
    });
  });

  it('leaves the cron, the bindings and the absent ledger unchanged', () => {
    expect(resolved('staging').triggers.crons).toEqual(['17 3 * * *']);
    expect(resolved('').triggers.crons).toBeUndefined();
    expect(resolved('production').triggers.crons).toBeUndefined();
    expect(bindingNames('staging')).toEqual([
      'PROVIDER_RATE_LIMITER',
      'SEASON_PUBLICATION_SEQUENCER',
    ]);
    expect(bindingNames('')).toEqual(['PROVIDER_RATE_LIMITER']);
    expect(bindingNames('production')).toEqual(['PROVIDER_RATE_LIMITER']);
    for (const environment of ['', 'staging', 'production'] as const) {
      const config = resolved(environment);
      expect(Object.keys(config.exports), environment).toEqual([
        'ProviderRateLimiter',
        'SeasonPublicationSequencer',
      ]);
      expect(config.migrations, environment).toEqual([]);
      expect(JSON.stringify(config.vars), environment).not.toMatch(
        /RECONCILIATION/,
      );
    }
    expect(resolved('staging').kv_namespaces).toEqual([
      { binding: 'GRIDVIEW_DATA', id: '1d0fb55486a745a1ad12e03d9f04942b' },
    ]);
    expect(resolved('production').kv_namespaces).toEqual([]);
  });
});

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Every publication command a scheduled or manual sync could reach. */
function publicationSpies() {
  return {
    mockFetch: vi.spyOn(MockFormulaOneProvider.prototype, 'fetchSeasonSource'),
    legacyPublish: vi.spyOn(SnapshotPublisher.prototype, 'publish'),
    sequencedPublish: vi.spyOn(
      SequencedPublicationService.prototype,
      'publish',
    ),
    guardedPublish: vi.spyOn(
      SequencedPublicationService.prototype,
      'publishGuarded',
    ),
  };
}

/**
 * A Worker env carrying one environment's resolved variables over an
 * in-process season-2026 release that is active in its sequencer, as live
 * staging's is. No `__PROVIDER` hook: the committed mode decides.
 */
function workerEnv(
  vars: Partial<Env>,
  context: SequencedContext,
  logger = new CapturingLogger(),
): Env {
  return {
    ...vars,
    ADMIN_TOKEN,
    __LOCAL_STORAGE: context.storage,
    __SEASON_PUBLICATION_SEQUENCER: context.port,
    __CLOCK: context.clock,
    __CACHE_PURGER: new MemoryCachePurgeAdapter(),
    __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
    __LOGGER: logger,
  } as Env;
}

function adminPost(path: string, body?: unknown, token = ADMIN_TOKEN) {
  return new Request(`https://api.gridview.local${path}`, {
    method: 'POST',
    headers: {
      ...(token === '' ? {} : { Authorization: `Bearer ${token}` }),
      'Content-Type': 'application/json',
    },
    body: body === undefined ? '{not json' : JSON.stringify(body),
  });
}

describe('the committed staging variables cannot publish mock data', () => {
  it('a scheduled run builds no provider, publishes nothing and writes only its sync state', async () => {
    const context = await ingestContext();
    const before = await context.coordinator.readAuthority(SEASON);
    context.storage.writeLog.length = 0;
    const logger = new CapturingLogger();
    const spies = publicationSpies();

    await worker.scheduled?.(
      {} as ScheduledController,
      workerEnv(resolvedVars('staging'), context, logger),
    );

    expect(spies.mockFetch).not.toHaveBeenCalled();
    expect(spies.legacyPublish).not.toHaveBeenCalled();
    expect(spies.sequencedPublish).not.toHaveBeenCalled();
    expect(spies.guardedPublish).not.toHaveBeenCalled();
    expect(globalFetch).not.toHaveBeenCalled();
    expect(new Set(context.storage.writeLog)).toEqual(
      new Set([syncStateKey(SEASON)]),
    );
    expect(await context.coordinator.readAuthority(SEASON)).toEqual(before);
    expect(
      logger.events.find((event) => event.operation === 'sync.failed'),
    ).toMatchObject({
      failureCategory: 'provider-unavailable',
      providerSourceId: null,
      providerCallCount: 0,
    });
    expect(
      logger.events.filter((event) =>
        event.operation.startsWith('publication.'),
      ),
    ).toEqual([]);
    expect(
      logger.events.filter((event) => event.operation === 'scheduled.failed'),
    ).toEqual([]);
  });

  it.each([
    [SYNC, {}],
    ['/internal/admin/sync/resource', { resource: 'results' }],
    ['/internal/admin/rebuild/home', {}],
  ] as const)(
    'the authenticated manual %s publishes nothing either',
    async (path, body) => {
      const context = await ingestContext();
      const before = await context.coordinator.readAuthority(SEASON);
      context.storage.writeLog.length = 0;
      const spies = publicationSpies();

      const response = await worker.fetch(
        adminPost(path, body),
        workerEnv(resolvedVars('staging'), context),
      );

      // The route answers the run's own result: failed, before any provider.
      expect(response.status).toBe(200);
      expect(((await response.json()) as { data: Json }).data).toMatchObject({
        status: 'failed',
        publicationStatus: 'failed',
        releaseVersion: null,
        failureCategory: 'provider-unavailable',
        providerCallCount: 0,
      });
      expect(spies.mockFetch).not.toHaveBeenCalled();
      expect(spies.legacyPublish).not.toHaveBeenCalled();
      expect(spies.sequencedPublish).not.toHaveBeenCalled();
      expect(spies.guardedPublish).not.toHaveBeenCalled();
      expect(new Set(context.storage.writeLog)).toEqual(
        new Set([syncStateKey(SEASON)]),
      );
      expect(await context.coordinator.readAuthority(SEASON)).toEqual(before);
    },
  );

  it('is sensitive: the same run under the live Stage A value mock does build and publish a mock candidate', async () => {
    const context = await ingestContext();
    const spies = publicationSpies();

    await worker.scheduled?.(
      {} as ScheduledController,
      workerEnv({ ...resolvedVars('staging'), PROVIDER_MODE: 'mock' }, context),
    );

    expect(spies.mockFetch).toHaveBeenCalledTimes(1);
    expect(spies.sequencedPublish).toHaveBeenCalledTimes(1);
  });
});

let batch: Batch;

beforeAll(async () => {
  batch = await syntheticBatch();
});

async function ingestResponse(
  env: Env,
  post: Request,
): Promise<{ status: number; data: Json; bodyUsed: boolean }> {
  const response = await worker.fetch(post, env);
  const json = (await response.json()) as { data?: Json };
  return {
    status: response.status,
    data: json.data ?? {},
    bodyUsed: post.bodyUsed,
  };
}

describe('the committed production variables cannot ingest', () => {
  it('refuses a valid, authenticated submission before reading it', async () => {
    const context = await ingestContext();
    context.storage.writeLog.length = 0;
    const spies = publicationSpies();
    const env = workerEnv(resolvedVars('production'), context);
    expect(env.SEASON_BATCH_INGEST).toBeUndefined();

    const answer = await ingestResponse(
      env,
      adminPost(INGEST, submissionFor(batch, SEED_VERSION)),
    );

    expect(answer).toEqual({
      status: 409,
      data: {
        outcome: 'refused',
        stage: 'admission',
        reason: 'ingest-disabled',
      },
      bodyUsed: false,
    });
    expect(spies.guardedPublish).not.toHaveBeenCalled();
    expect(context.storage.writeLog).toEqual([]);
  });

  it('refuses even with the flag and a reachable sequencer added by hand', async () => {
    const context = await ingestContext();
    context.storage.writeLog.length = 0;
    const spies = publicationSpies();
    const env = workerEnv(
      {
        ...resolvedVars('production'),
        SEASON_BATCH_INGEST: '2026',
        SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      },
      context,
    );

    const answer = await ingestResponse(
      env,
      adminPost(INGEST, submissionFor(batch, SEED_VERSION)),
    );

    expect(answer).toEqual({
      status: 409,
      data: {
        outcome: 'refused',
        stage: 'admission',
        reason: 'environment-not-permitted',
      },
      bodyUsed: false,
    });
    expect(spies.guardedPublish).not.toHaveBeenCalled();
    expect(context.storage.writeLog).toEqual([]);
  });
});

describe('the committed staging ingest stays authenticated and guarded', () => {
  it('refuses a missing, wrong or unconfigured token with 401 before reading the body', async () => {
    const context = await ingestContext();
    context.storage.writeLog.length = 0;
    const env = workerEnv(resolvedVars('staging'), context);
    const body = submissionFor(batch, SEED_VERSION);

    for (const [token, target] of [
      ['', env],
      ['wrong-token', env],
      [ADMIN_TOKEN, { ...env, ADMIN_TOKEN: undefined }],
    ] as const) {
      const post = adminPost(INGEST, body, token);
      const response = await worker.fetch(post, target);
      expect(response.status, token).toBe(401);
      expect(post.bodyUsed, token).toBe(false);
    }
    expect(context.storage.writeLog).toEqual([]);
  });

  it('publishes a reviewed batch through the guarded sequencer only, and refuses its resend as stale', async () => {
    const context = await ingestContext();
    const spies = publicationSpies();
    const env = workerEnv(resolvedVars('staging'), context);

    const first = await ingestResponse(
      env,
      adminPost(INGEST, submissionFor(batch, SEED_VERSION)),
    );
    expect(first.status).toBe(200);
    expect(first.data.publication).toMatchObject({
      status: 'applied',
      previousVersion: SEED_VERSION,
    });
    expect(spies.guardedPublish).toHaveBeenCalledTimes(1);
    expect(spies.guardedPublish.mock.calls[0]?.[1]).toEqual({
      expectedActiveVersion: SEED_VERSION,
    });
    expect(spies.legacyPublish).not.toHaveBeenCalled();
    expect(spies.sequencedPublish).not.toHaveBeenCalled();
    expect(spies.mockFetch).not.toHaveBeenCalled();
    const committed = (first.data.publication as Json).version;
    expect(await context.coordinator.readAuthority(SEASON)).toMatchObject({
      activeVersion: committed,
    });

    // The same body again: the active release is no longer the one it was
    // reviewed against, so the guard refuses it before anything is written.
    const writes = context.storage.writeLog.length;
    const resend = await ingestResponse(
      env,
      adminPost(INGEST, submissionFor(batch, SEED_VERSION)),
    );
    expect(resend.status).toBe(409);
    expect(resend.data.publication).toMatchObject({
      status: 'rejected',
      reason: 'guard-predecessor-stale',
    });
    expect(context.storage.writeLog).toHaveLength(writes);
    expect(await context.coordinator.readAuthority(SEASON)).toMatchObject({
      activeVersion: committed,
    });
  });

  it('cannot roll the first ingested release back to the release it replaced', async () => {
    // The predecessor stands in for live staging's mock release: it carries
    // fewer classified rounds than the batch, as mock round 12 does against a
    // real capture. D14 refuses any rollback that drops a classified round.
    const context = await ingestContext();
    const env = workerEnv(resolvedVars('staging'), context);
    const first = await ingestResponse(
      env,
      adminPost(INGEST, submissionFor(batch, SEED_VERSION)),
    );
    expect(first.status).toBe(200);
    const committed = (first.data.publication as Json).version;
    const writes = context.storage.writeLog.length;

    const response = await worker.fetch(
      adminPost('/internal/admin/rollback', { version: SEED_VERSION }),
      env,
    );

    expect(response.status).toBe(409);
    expect(((await response.json()) as { data: Json }).data).toMatchObject({
      status: 'rejected',
      reason: 'guard-round-coverage-regression',
    });
    expect(context.storage.writeLog).toHaveLength(writes);
    expect(await context.coordinator.readAuthority(SEASON)).toMatchObject({
      activeVersion: committed,
    });
  });

  it('refuses without a reachable sequencer, never falling back to the legacy publisher', async () => {
    const context = await ingestContext();
    context.storage.writeLog.length = 0;
    const spies = publicationSpies();
    const env = {
      ...workerEnv(resolvedVars('staging'), context),
      __SEASON_PUBLICATION_SEQUENCER: undefined,
    } as Env;

    const answer = await ingestResponse(
      env,
      adminPost(INGEST, submissionFor(batch, SEED_VERSION)),
    );

    expect(answer).toEqual({
      status: 409,
      data: {
        outcome: 'refused',
        stage: 'admission',
        reason: 'authority-not-sequenced',
      },
      bodyUsed: false,
    });
    expect(spies.legacyPublish).not.toHaveBeenCalled();
    expect(context.storage.writeLog).toEqual([]);
  });
});
