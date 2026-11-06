/**
 * The staging season-batch ingest configuration (decision pack 2026-10-07
 * PR-4, DP-6(b)), as Wrangler itself resolves `wrangler.toml`, driven through
 * the real Worker entry points.
 *
 * `env.staging` sets `SEASON_BATCH_INGEST = "2026"` and an explicit empty
 * cron list. Since release gate AU-4 it selects `PROVIDER_MODE =
 * "coordinated"` and binds the reconciliation ledger
 * (`staging-automatic-updates.test.ts` drives that path); the `none` it
 * committed from 2026-10-13 is now its documented fallback to manual
 * batches, a deploy that changes only the mode. Production's own
 * configuration (release plan W1) is pinned in
 * `production-worker-config.test.ts`. This file proves five things about the
 * resolved configuration:
 *
 * - staging schedules nothing, and says so explicitly: Wrangler replaces a
 *   Worker's schedules only when `crons` is set, so an empty list removes the
 *   live one where an absent key would leave it;
 * - the committed staging ingest refuses every batch under `coordinated`,
 *   before reading it, so there is never a second provider budget;
 * - under the fallback, no scheduled run and no manual whole-season sync can
 *   build or publish a mock candidate;
 * - production cannot ingest without its own genesis control;
 * - under the fallback, the staging ingest still needs `ADMIN_TOKEN` and
 *   still publishes only through the guarded sequencer, bound to the
 *   reviewed active release.
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
  reanchored,
  rehashDocuments,
  SEASON,
  SEED_VERSION,
  submissionFor,
  syntheticBatch,
  type Batch,
  type Json,
} from '../ingest/support';
import {
  STAGING_CRONS,
  STAGING_CRONS_LINE,
  withoutStaging,
} from './demonstration-environment';

const configPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'wrangler.toml',
);

const ADMIN_TOKEN = 'local-test-token';
const INGEST = '/internal/admin/season/ingest';
const SYNC = '/internal/admin/sync/full';

type Environment = '' | 'staging' | 'production' | 'e2e';

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

/**
 * Staging's documented fallback to manual batches: the committed variables
 * with `PROVIDER_MODE = "none"`, the ledger binding kept.
 */
function fallbackVars(): Partial<Env> {
  return { ...resolvedVars('staging'), PROVIDER_MODE: 'none' };
}

function bindingNames(environment: Environment): string[] {
  return resolved(environment).durable_objects.bindings.map(
    (binding: { readonly name: string }) => binding.name,
  );
}

describe('the resolved configuration', () => {
  it('sets exactly SEASON_BATCH_INGEST "2026" and PROVIDER_MODE "coordinated" in staging', () => {
    expect(resolved('staging').vars).toEqual({
      ENVIRONMENT: 'staging',
      PROVIDER_MODE: 'coordinated',
      PUBLIC_BASE_URL: 'https://gridview-api-staging.sejuma18.workers.dev',
      SEASON_PUBLICATION_CUTOVER_CONTROL: 'activate:2026',
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_BATCH_INGEST: '2026',
    });
    // Assigned only in staging and production (W1), never in development.
    expect(rawConfig.match(/^\s*SEASON_BATCH_INGEST\s*=/gm)).toHaveLength(2);
    expect(resolved('production').vars).toMatchObject({
      SEASON_BATCH_INGEST: '2026',
    });
    // No environment commits the mock provider any more, and staging reads
    // Jolpica from the network, never from a controlled source.
    expect(rawConfig).not.toMatch(/^\s*PROVIDER_MODE\s*=\s*"mock"/m);
    expect(resolved('staging').vars).not.toHaveProperty(
      'CONTROLLED_PROVIDER_SOURCE',
    );
  });

  it('resolves staging to the coordinated mode under the unchanged sequencer and activation phase', () => {
    const config = resolveRuntimeConfig(resolvedVars('staging'));
    expect(config.environment).toBe('staging');
    expect(config.providerMode).toBe('coordinated');
    expect(config.publicationAuthorityMode).toBe('sequencer');
    expect(config.publicationCutoverControl).toEqual({
      kind: 'activate',
      season: 2026,
    });
  });

  it('leaves the development variables unchanged', () => {
    expect(resolved('').vars).toEqual({ ENVIRONMENT: 'development' });
  });

  it('schedules staging hourly, gives production and the demonstration Worker an explicitly empty cron list and leaves development unscheduled', () => {
    // Explicit, never absent: `wrangler deploy` PUTs the schedules only when
    // `crons` is set, so an absent key would silently keep whatever is live.
    // Staging's hourly cron is AU-4 step 3; it is live only after its own
    // triggers deploy.
    expect(resolved('staging').triggers).toEqual({ crons: STAGING_CRONS });
    expect(rawConfig).toContain(
      `[env.staging.triggers]\n${STAGING_CRONS_LINE}\n`,
    );
    expect(withoutStaging(rawConfig)).not.toMatch(/^\s*crons\s*=\s*\[\s*"/m);
    // Production (W1) schedules nothing, explicitly too. Development declared
    // no trigger before and still does not.
    expect(resolved('production').triggers).toEqual({ crons: [] });
    // The demonstration Worker ran hourly for AU-3 until it passed and is
    // unscheduled again.
    expect(resolved('e2e').triggers).toEqual({ crons: [] });
    expect(resolved('').triggers.crons).toBeUndefined();
    expect(rawConfig.match(/^\[[^\]]*triggers\]$/gm)).toEqual([
      '[env.staging.triggers]',
      '[env.production.triggers]',
      '[env.e2e.triggers]',
    ]);
  });

  it('adds only the ledger to the staging bindings, and leaves development and production without it', () => {
    expect(bindingNames('staging')).toEqual([
      'PROVIDER_RATE_LIMITER',
      'SEASON_PUBLICATION_SEQUENCER',
      'RECONCILIATION_LEDGER',
    ]);
    expect(Object.keys(resolved('staging').exports)).toEqual([
      'ProviderRateLimiter',
      'SeasonPublicationSequencer',
      'ReconciliationLedger',
    ]);
    expect(bindingNames('')).toEqual(['PROVIDER_RATE_LIMITER']);
    expect(bindingNames('production')).toEqual([
      'PROVIDER_RATE_LIMITER',
      'SEASON_PUBLICATION_SEQUENCER',
    ]);
    for (const environment of ['', 'production'] as const) {
      expect(Object.keys(resolved(environment).exports), environment).toEqual([
        'ProviderRateLimiter',
        'SeasonPublicationSequencer',
      ]);
    }
    for (const environment of ['', 'staging', 'production'] as const) {
      const config = resolved(environment);
      expect(config.migrations, environment).toEqual([]);
      expect(JSON.stringify(config.vars), environment).not.toMatch(
        /RECONCILIATION/,
      );
    }
    expect(resolved('staging').kv_namespaces).toEqual([
      { binding: 'GRIDVIEW_DATA', id: '1d0fb55486a745a1ad12e03d9f04942b' },
    ]);
    // Production binds its own namespace (release plan W2).
    expect(resolved('production').kv_namespaces).toEqual([
      { binding: 'GRIDVIEW_DATA', id: 'd76328b37da343db92d927142c072593' },
    ]);
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

describe("staging's fallback variables cannot publish mock data", () => {
  // The fallback schedules nothing either. The handler is still exercised: a
  // trigger left in place would invoke it.
  it('a scheduled run, if one is invoked, builds no provider, publishes nothing and writes only its sync state', async () => {
    const context = await ingestContext();
    const before = await context.coordinator.readAuthority(SEASON);
    context.storage.writeLog.length = 0;
    const logger = new CapturingLogger();
    const spies = publicationSpies();

    await worker.scheduled?.(
      {} as ScheduledController,
      workerEnv(fallbackVars(), context, logger),
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
        workerEnv(fallbackVars(), context),
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

  it('is sensitive: the same run under the Stage A value mock does build and publish a mock candidate', async () => {
    const context = await ingestContext();
    const spies = publicationSpies();

    await worker.scheduled?.(
      {} as ScheduledController,
      workerEnv({ ...fallbackVars(), PROVIDER_MODE: 'mock' }, context),
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

describe('the committed production ingest needs its genesis control', () => {
  // Production commits the flag, the sequencer and `genesis:2026` (W1). The
  // ingest admits production only under a `genesis:` control naming the same
  // season, so removing or replacing that control closes it again.
  it.each([
    ['without a control', undefined],
    ['under the staging activation phase', 'activate:2026'],
  ] as const)(
    'refuses a valid, authenticated submission %s, before reading it',
    async (_label, control) => {
      const context = await ingestContext();
      context.storage.writeLog.length = 0;
      const spies = publicationSpies();
      const env = workerEnv(
        {
          ...resolvedVars('production'),
          SEASON_PUBLICATION_CUTOVER_CONTROL: control,
        },
        context,
      );
      expect(env.SEASON_BATCH_INGEST).toBe('2026');

      const answer = await ingestResponse(
        env,
        adminPost(INGEST, submissionFor(batch, SEED_VERSION)),
      );

      expect(answer).toEqual({
        status: 409,
        data: {
          outcome: 'refused',
          stage: 'admission',
          reason: 'genesis-control-required',
        },
        bodyUsed: false,
      });
      expect(spies.guardedPublish).not.toHaveBeenCalled();
      expect(context.storage.writeLog).toEqual([]);
    },
  );
});

describe('the committed staging ingest under the coordinated mode', () => {
  it('refuses a valid, authenticated submission as provider-mode-coordinated, before reading it', async () => {
    const context = await ingestContext();
    const before = await context.coordinator.readAuthority(SEASON);
    context.storage.writeLog.length = 0;
    const spies = publicationSpies();
    const env = workerEnv(resolvedVars('staging'), context);
    expect(env.PROVIDER_MODE).toBe('coordinated');

    const answer = await ingestResponse(
      env,
      adminPost(INGEST, submissionFor(batch, SEED_VERSION)),
    );

    expect(answer).toEqual({
      status: 409,
      data: {
        outcome: 'refused',
        stage: 'admission',
        reason: 'provider-mode-coordinated',
      },
      bodyUsed: false,
    });
    expect(spies.guardedPublish).not.toHaveBeenCalled();
    expect(context.storage.writeLog).toEqual([]);
    expect(await context.coordinator.readAuthority(SEASON)).toEqual(before);
  });

  it('is sensitive: the fallback to none admits the same submission', async () => {
    const context = await ingestContext();
    const answer = await ingestResponse(
      workerEnv(fallbackVars(), context),
      adminPost(INGEST, submissionFor(batch, SEED_VERSION)),
    );
    expect(answer.status).toBe(200);
  });
});

/**
 * A reconciliation ledger namespace that records every call and answers none,
 * so a test can show that a Worker with it bound never used it.
 */
function recordingLedger(): {
  readonly calls: string[];
  readonly namespace: DurableObjectNamespace;
} {
  const calls: string[] = [];
  const refuse = (name: string) => (): never => {
    calls.push(name);
    throw new Error(`the ledger was used: ${name}`);
  };
  const namespace = {
    idFromName: refuse('idFromName'),
    idFromString: refuse('idFromString'),
    newUniqueId: refuse('newUniqueId'),
    get: refuse('get'),
    getByName: refuse('getByName'),
    jurisdiction: refuse('jurisdiction'),
  } as unknown as DurableObjectNamespace;
  return { calls, namespace };
}

/**
 * `batch` as the generator wrote it before `data-sources-v3`: credited
 * `data-sources-v2` throughout, every digest consistent, so only a check of
 * the attribution version can refuse it.
 */
function creditedV2(fresh: Batch): Batch {
  const rewrite = (value: Json): Json =>
    JSON.parse(
      JSON.stringify(value).replaceAll('data-sources-v3', 'data-sources-v2'),
    ) as Json;
  const manifest = rewrite(fresh.manifest);
  const artifact = rewrite(fresh.artifact);
  rehashDocuments(manifest, artifact);
  return reanchored(manifest, artifact);
}

describe('the forward fallback to manual batches, the ledger kept', () => {
  // AU-4's recovery (`docs/release/automatic-updates.md` §8.3): once a deploy
  // has created the ledger class, staging returns to manual batches only by a
  // forward deploy of `PROVIDER_MODE = "none"` that keeps the ledger's exports
  // and binding. The bound ledger must change nothing there, and a batch
  // generated before `data-sources-v3` must be regenerated.
  function fallbackEnv(
    context: SequencedContext,
    ledger: DurableObjectNamespace,
    logger = new CapturingLogger(),
  ): Env {
    return {
      ...workerEnv(fallbackVars(), context, logger),
      RECONCILIATION_LEDGER: ledger,
    };
  }

  it('publishes a current batch, and runs nothing automatic, without using the bound ledger', async () => {
    const context = await ingestContext();
    const ledger = recordingLedger();
    const logger = new CapturingLogger();
    const env = fallbackEnv(context, ledger.namespace, logger);
    expect(env.PROVIDER_MODE).toBe('none');

    const ingested = await ingestResponse(
      env,
      adminPost(INGEST, submissionFor(batch, SEED_VERSION)),
    );
    expect(ingested.status).toBe(200);
    expect(ingested.data.publication).toMatchObject({ status: 'applied' });
    const committed = (ingested.data.publication as Json).version;

    await worker.scheduled?.({} as ScheduledController, env);
    const manual = await worker.fetch(adminPost(SYNC, {}), env);
    expect(((await manual.json()) as { data: Json }).data).toMatchObject({
      status: 'failed',
      failureCategory: 'provider-unavailable',
      providerCallCount: 0,
    });

    expect(ledger.calls).toEqual([]);
    expect(globalFetch).not.toHaveBeenCalled();
    expect(
      logger.events.find((event) => event.operation === 'sync.failed'),
    ).toMatchObject({ failureCategory: 'provider-unavailable' });
    expect(await context.coordinator.readAuthority(SEASON)).toMatchObject({
      activeVersion: committed,
    });
  });

  it('refuses a batch generated under data-sources-v2 until it is regenerated', async () => {
    const context = await ingestContext();
    const ledger = recordingLedger();
    const env = fallbackEnv(context, ledger.namespace);
    const stale = creditedV2(batch);
    expect(stale.artifact).not.toEqual(batch.artifact);
    context.storage.writeLog.length = 0;

    const refused = await ingestResponse(
      env,
      adminPost(INGEST, submissionFor(stale, SEED_VERSION)),
    );
    // The release's attribution version is checked against this Worker's
    // curated metadata before the credit itself, so that check refuses it.
    expect(refused).toMatchObject({
      status: 422,
      data: {
        outcome: 'refused',
        stage: 'verification',
        reason: 'curated-metadata-mismatch',
      },
    });
    expect(context.storage.writeLog).toEqual([]);

    const regenerated = await ingestResponse(
      env,
      adminPost(INGEST, submissionFor(batch, SEED_VERSION)),
    );
    expect(regenerated.status).toBe(200);
    expect(ledger.calls).toEqual([]);
  });
});

describe("the staging ingest stays authenticated and guarded (committed token check; the fallback's publication)", () => {
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
    const env = workerEnv(fallbackVars(), context);

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
    const env = workerEnv(fallbackVars(), context);
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
      ...workerEnv(fallbackVars(), context),
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
