/**
 * The production Worker configuration (release plan W1-W3, submission path A:
 * Workers Paid; gate AU-7), as Wrangler itself resolves `wrangler.toml`,
 * driven through the real Worker entry points.
 *
 * `env.production` selects the sequencer authority, the `genesis:2026`
 * control, the coordinated runtime over the Jolpica proxy (AU-7) with the
 * hourly schedule, keeps the guarded season-batch ingest for 2026 as the
 * fallback, binds its four Durable Objects and its W2 KV namespace, and
 * persists Worker lines only. This file proves that the resolved
 * configuration:
 *
 * - schedules exactly the hourly minute-17 tick, and staging minute 47;
 * - resolves the proxy transport only with its secret, and refuses the
 *   ingest under the committed mode (`provider-mode-coordinated`);
 * - fails closed while the KV binding is missing;
 * - under the fallback `PROVIDER_MODE = "none"` (how production was born on
 *   2026-11-23): serves no season before genesis, nor between genesis and the
 *   first reviewed batch, and serves the season only once that batch commits;
 *   refuses the staging seed and activation, and every provider-driven sync;
 * - leaves staging's publication controls as they were.
 *
 * `unstable_readConfig` only reads the file. Nothing here deploys, provisions
 * or contacts Cloudflare; every sequencer is in process, every storage in
 * memory and every batch synthetic.
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
import {
  resolveJolpicaTransport,
  resolveRuntimeConfig,
} from '../../src/config/environment';
import { resolveStorage } from '../../src/storage/factory';
import { CapturingLogger } from '../../src/logging/logger';
import { SnapshotPublisher } from '../../src/publication/publisher';
import { SequencedPublicationService } from '../../src/publication/sequenced/service';
import {
  LocalSeasonPublicationSequencer,
  MemorySequencerHost,
  SeasonPublicationCoordinator,
} from '../../src/publication/sequencer';
import { FixedClock } from '../../src/runtime/clock';
import { MemorySnapshotStorage } from '../../src/storage/local';
import { syncStateKey } from '../../src/storage/keys';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import { identityConfiguration } from '../../src/identity/catalog/run-context';
import { submissionFor, syntheticBatch, type Batch } from '../ingest/support';
import { checkpointFor } from '../publication/cutover/support';

const configPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'wrangler.toml',
);

const SEASON = 2026;
const NOW = '2026-07-20T12:00:00.000Z';
const ADMIN_TOKEN = 'local-test-token';
const IDENTITY = 'gridview-production-2026-genesis-01';
const STAGING_KV_ID = '1d0fb55486a745a1ad12e03d9f04942b';
const DEMONSTRATION_KV_ID = 'f8970084eef14b6a8e24db521d015df3';
// `gridview-snapshots-production`, created in release plan W2.
const PRODUCTION_KV_ID = 'd76328b37da343db92d927142c072593';

function resolved(environment: 'staging' | 'production' | 'e2e') {
  return unstable_readConfig(
    { config: configPath, env: environment },
    { hideWarnings: true },
  );
}

/** The resolved variables of one environment, as the Worker receives them. */
/** Production's identity installation (U11 P4); never staging's or E2E's. */
const PRODUCTION_INSTALLATION = '98f14de8-d974-423a-bb78-dafe6251164a';

/**
 * U11 P4: production commits runtime catalog authority with the optional
 * inventory, which needs the catalog binding and an activated catalog; the
 * runtime ingest path is exercised end to end by the identity integration
 * tests. The genesis and ingest mechanics below are authority-independent and
 * run, as before P4, under explicit bundled authority with no inventory
 * variable (a bundled catalog cannot select it).
 */
function preCatalogMechanics(vars: Partial<Env>): Partial<Env> {
  return {
    ...Object.fromEntries(
      Object.entries(vars).filter(
        ([name]) => name !== 'IDENTITY_INVENTORY_MODE',
      ),
    ),
    IDENTITY_CATALOG_MODE: 'bundled',
  };
}

function resolvedVars(environment: 'staging' | 'production'): Partial<Env> {
  return Object.fromEntries(
    Object.entries(resolved(environment).vars).map(([name, value]) => [
      name,
      String(value),
    ]),
  );
}

/**
 * The committed production variables with the documented fallback,
 * `PROVIDER_MODE = "none"`: the configuration genesis and the first batch ran
 * under (f1700b39, 2026-11-23), and the one that re-admits the ingest.
 */
function fallbackVars(): Partial<Env> {
  return { ...resolvedVars('production'), PROVIDER_MODE: 'none' };
}

const PROXY_ORIGIN = 'https://gridviewjol.vps.webdock.cloud';
const PROXY_TEST_TOKEN = 'disposable-proxy-test-token';

/** The TOML's configured lines, with every comment line dropped. */
const declaredConfig = rawConfig
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

describe('the resolved production configuration', () => {
  it('names the Worker and its workers.dev host, with no preview URLs', () => {
    const production = resolved('production');
    expect(production.name).toBe('gridview-api-production');
    expect(production.workers_dev).toBe(true);
    expect(production.preview_urls).toBe(false);
    expect(production.routes ?? []).toEqual([]);
    expect(declaredConfig).not.toMatch(/^account_id\s*=/m);
  });

  it('sets exactly the automatic (AU-7), genesis, sequencer and ingest variables', () => {
    expect(resolved('production').vars).toEqual({
      ENVIRONMENT: 'production',
      PROVIDER_MODE: 'coordinated',
      PUBLIC_BASE_URL: 'https://gridview-api-production.sejuma18.workers.dev',
      JOLPICA_TRANSPORT: 'proxy',
      JOLPICA_PROXY_ORIGIN: PROXY_ORIGIN,
      SEASON_PUBLICATION_CUTOVER_CONTROL: 'genesis:2026',
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_BATCH_INGEST: '2026',
      // U11 P4: production's own identity installation.
      IDENTITY_INSTALLATION_ID: PRODUCTION_INSTALLATION,
      IDENTITY_CATALOG_MODE: 'runtime',
      IDENTITY_DISCOVERY_MODE: 'off',
      IDENTITY_ADMIN_MODE: 'read-only',
      IDENTITY_INVENTORY_MODE: 'optional-drivers',
    });
    const config = resolveRuntimeConfig(resolvedVars('production'));
    expect(config.environment).toBe('production');
    expect(config.providerMode).toBe('coordinated');
    expect(config.publicationAuthorityMode).toBe('sequencer');
    expect(config.publicationCutoverControl).toEqual({
      kind: 'genesis',
      season: SEASON,
    });
  });

  it('binds its four Durable Objects to SQLite exports, with no migrations (U11 P4 adds the ledger and the catalog)', () => {
    const production = resolved('production');
    expect(production.durable_objects.bindings).toEqual([
      { name: 'PROVIDER_RATE_LIMITER', class_name: 'ProviderRateLimiter' },
      {
        name: 'SEASON_PUBLICATION_SEQUENCER',
        class_name: 'SeasonPublicationSequencer',
      },
      { name: 'RECONCILIATION_LEDGER', class_name: 'ReconciliationLedger' },
      { name: 'IDENTITY_CATALOG', class_name: 'IdentityCatalog' },
    ]);
    expect(Object.keys(production.exports)).toEqual([
      'ProviderRateLimiter',
      'SeasonPublicationSequencer',
      'ReconciliationLedger',
      'IdentityCatalog',
    ]);
    for (const value of Object.values(production.exports))
      expect(value).toEqual({ type: 'durable-object', storage: 'sqlite' });
    expect(production.migrations).toEqual([]);
    expect(JSON.stringify(production.vars)).not.toMatch(/RECONCILIATION/);
  });

  it('requires ADMIN_TOKEN, its own reviewer credentials and the proxy token without committing a value', () => {
    expect(resolved('production').secrets).toEqual({
      required: [
        'ADMIN_TOKEN',
        'IDENTITY_REVIEWER_CREDENTIALS',
        'JOLPICA_PROXY_TOKEN',
      ],
    });
    expect(rawConfig).toMatch(
      /^\[env\.production\.secrets\]\nrequired = \["ADMIN_TOKEN", "IDENTITY_REVIEWER_CREDENTIALS", "JOLPICA_PROXY_TOKEN"\]$/m,
    );
    expect(rawConfig).not.toMatch(/^\s*IDENTITY_REVIEWER_CREDENTIALS\s*=/m);
    expect(rawConfig).not.toMatch(/^\s*JOLPICA_PROXY_TOKEN\s*=/m);
  });

  it('resolves the proxy transport only with its secret (AU-7)', () => {
    const vars = resolvedVars('production') as Env;
    expect(() => resolveJolpicaTransport(vars)).toThrow(
      'JOLPICA_PROXY_TOKEN must be a bearer token.',
    );
    expect(
      resolveJolpicaTransport({
        ...vars,
        JOLPICA_PROXY_TOKEN: 'disposable-proxy-test-token',
      }),
    ).toEqual({
      mode: 'proxy',
      origin: PROXY_ORIGIN,
      token: 'disposable-proxy-test-token',
    });
    // Production never names a controlled source.
    expect(vars.CONTROLLED_PROVIDER_SOURCE).toBeUndefined();
  });

  it('resolves runtime authority with the optional inventory only with the deployed catalog binding (U11 P4)', () => {
    const vars = resolvedVars('production');
    expect(PRODUCTION_INSTALLATION).not.toBe(
      'c45d60b8-a723-4b6e-8530-750592af2b94',
    );
    const namespace = { idFromName: () => ({}), get: () => ({}) };
    expect(
      identityConfiguration({ ...vars, IDENTITY_CATALOG: namespace } as never),
    ).toMatchObject({ mode: 'runtime', inventoryMode: 'optional-drivers' });
    expect(() => identityConfiguration(vars as never)).toThrow(
      /requires a catalog binding/,
    );
    expect(rawConfig).not.toContain('Bearer ');
  });

  it('schedules the hourly minute-17 tick (AU-7), and staging minute 47', () => {
    expect(resolved('production').triggers).toEqual({
      crons: ['17 * * * *'],
    });
    expect(rawConfig).toMatch(
      /^\[env\.production\.triggers\]\ncrons = \["17 \* \* \* \*"\]$/m,
    );
    expect(resolved('staging').triggers).toEqual({ crons: [] });
    // Exactly one schedule in the file: production's.
    expect(rawConfig.match(/^\s*crons\s*=\s*\[\s*"/gm)).toHaveLength(1);
  });

  it('persists the Worker lines, never the invocation logs or traces (ADR 0028 D8)', () => {
    // Every sampled run of the automatic path is kept; invocation logs and
    // traces, the platform's per-request records, are never stored. Traces
    // are pinned off rather than left to the dashboard default (PR #82
    // `data-safety.md` section 3.4).
    expect(resolved('production').observability).toEqual({
      enabled: true,
      head_sampling_rate: 1,
      logs: { enabled: true, persist: true, invocation_logs: false },
      traces: { enabled: false },
    });
    expect(rawConfig).toMatch(
      /\[env\.production\.observability\]\nenabled = true\nhead_sampling_rate = 1\n\n\[env\.production\.observability\.logs\]\nenabled = true\npersist = true\ninvocation_logs = false/,
    );
  });

  it('binds only the KV namespace created in W2', () => {
    // Wrangler 4 provisions a new namespace on deploy for a KV binding with no
    // id, so the one binding must carry W2's id, and no other environment's.
    expect(resolved('production').kv_namespaces).toEqual([
      { binding: 'GRIDVIEW_DATA', id: PRODUCTION_KV_ID },
    ]);
    expect(PRODUCTION_KV_ID).toMatch(/^[0-9a-f]{32}$/);
    expect(PRODUCTION_KV_ID).not.toMatch(/^(0+|f+|1234.*)$/);
    expect([STAGING_KV_ID, DEMONSTRATION_KV_ID]).not.toContain(
      PRODUCTION_KV_ID,
    );
    for (const id of [PRODUCTION_KV_ID, STAGING_KV_ID, DEMONSTRATION_KV_ID]) {
      expect(declaredConfig.match(new RegExp(id, 'g'))).toHaveLength(1);
    }
  });

  it('leaves the demonstration Worker bound to its own namespace, unscheduled', () => {
    const demonstration = resolved('e2e');
    expect(demonstration.name).toBe('gridview-api-e2e');
    expect(demonstration.kv_namespaces).toEqual([
      { binding: 'GRIDVIEW_DATA', id: DEMONSTRATION_KV_ID },
    ]);
    expect(demonstration.triggers).toEqual({ crons: [] });
  });

  it('keeps staging publication controls while selecting its temporary proxy', () => {
    const staging = resolved('staging');
    expect(staging.vars).toEqual({
      ENVIRONMENT: 'staging',
      PROVIDER_MODE: 'coordinated',
      PUBLIC_BASE_URL: 'https://gridview-api-staging.sejuma18.workers.dev',
      JOLPICA_TRANSPORT: 'proxy',
      JOLPICA_PROXY_ORIGIN: 'https://gridviewjol.vps.webdock.cloud',
      SEASON_PUBLICATION_CUTOVER_CONTROL: 'activate:2026',
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_BATCH_INGEST: '2026',
      // Identity U11: staging installation, runtime with read-only admin (G5)
      // and the optional-driver inventory (P3, staging only).
      IDENTITY_INSTALLATION_ID: 'c45d60b8-a723-4b6e-8530-750592af2b94',
      IDENTITY_CATALOG_MODE: 'runtime',
      IDENTITY_DISCOVERY_MODE: 'off',
      IDENTITY_ADMIN_MODE: 'read-only',
      IDENTITY_INVENTORY_MODE: 'optional-drivers',
    });
    expect(staging.kv_namespaces).toEqual([
      { binding: 'GRIDVIEW_DATA', id: STAGING_KV_ID },
    ]);
    expect(staging.triggers).toEqual({ crons: [] });
    expect(staging.observability).toEqual({
      enabled: true,
      head_sampling_rate: 1,
      logs: { enabled: true, persist: true, invocation_logs: false },
      traces: { enabled: false },
    });
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

let batch: Batch;

beforeAll(async () => {
  batch = await syntheticBatch();
});

/**
 * A fresh production Worker env carrying the committed variables under the
 * fallback `none` over an empty in-memory namespace and an in-process
 * sequencer that has never seen the season, as production was before genesis.
 */
function production() {
  const clock = new FixedClock(new Date(NOW));
  const storage = new MemorySnapshotStorage();
  const port = new LocalSeasonPublicationSequencer(
    new SeasonPublicationCoordinator(new MemorySequencerHost(), { clock }),
  );
  const logger = new CapturingLogger();
  const env = {
    ...preCatalogMechanics(fallbackVars()),
    ADMIN_TOKEN,
    // Required with the committed proxy transport (AU-7); never a real value.
    JOLPICA_PROXY_TOKEN: PROXY_TEST_TOKEN,
    __LOCAL_STORAGE: storage,
    __SEASON_PUBLICATION_SEQUENCER: port,
    __CLOCK: clock,
    __CACHE_PURGER: new MemoryCachePurgeAdapter(),
    __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
    __LOGGER: logger,
  } as Env;
  return { env, storage, port, logger };
}

function admin(path: string, body: unknown): Request {
  return new Request(`https://api.gridview.local${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function read(path: string, env: Env): Promise<Response> {
  return worker.fetch(new Request(`https://api.gridview.local${path}`), env);
}

const SEASON_PATHS = [
  `/v1/seasons/${SEASON}`,
  `/v1/seasons/${SEASON}/drivers`,
  `/v1/seasons/${SEASON}/standings/drivers`,
  '/v1/seasons/current',
];

/**
 * No season resource is served. Before genesis the season is unknown (`404
 * SEASON_NOT_FOUND`); in genesis the sequencer owns it and has no release
 * (`503 SNAPSHOT_NOT_READY`). `/v1/seasons/current` is `503` in both.
 */
async function expectNoSeasonServed(
  env: Env,
  phase: 'before-genesis' | 'genesis',
): Promise<void> {
  for (const path of SEASON_PATHS) {
    const unknown =
      phase === 'before-genesis' && path !== '/v1/seasons/current';
    const response = await read(path, env);
    expect(response.status, path).toBe(unknown ? 404 : 503);
    expect(await response.json(), path).toMatchObject({
      error: { code: unknown ? 'SEASON_NOT_FOUND' : 'SNAPSHOT_NOT_READY' },
    });
  }
  const status = await read('/v1/status', env);
  expect(status.status).toBe(200);
  expect(await status.json()).toMatchObject({
    data: { environment: 'production', currentSeason: null },
  });
}

function publicationSpies() {
  return {
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

describe('the committed production variables without the KV binding', () => {
  it('fail closed on every route instead of serving or accepting anything', async () => {
    const env = {
      ...preCatalogMechanics(fallbackVars()),
      ADMIN_TOKEN,
    } as Env;
    expect(env.GRIDVIEW_DATA).toBeUndefined();
    // The failure is the missing binding itself, not some other configuration
    // error: the committed variables resolve cleanly (above).
    expect(() => resolveStorage(env)).toThrow(
      'GRIDVIEW_DATA KV binding is required in production.',
    );
    for (const request of [
      new Request('https://api.gridview.local/v1/status'),
      new Request(`https://api.gridview.local/v1/seasons/${SEASON}`),
      admin('/internal/admin/season/ingest', submissionFor(batch, null)),
    ]) {
      const response = await worker.fetch(request, env);
      expect(response.status, request.url).toBe(500);
      expect(await response.text(), request.url).not.toContain('GRIDVIEW_DATA');
    }
    expect(globalFetch).not.toHaveBeenCalled();
  });
});

describe('the committed production variables under the coordinated mode', () => {
  it('refuse a valid, authenticated submission as provider-mode-coordinated, before reading it', async () => {
    const { env, storage, port } = production();
    const committed = { ...env, PROVIDER_MODE: 'coordinated' } as Env;
    const spies = publicationSpies();
    const post = admin(
      '/internal/admin/season/ingest',
      submissionFor(batch, null),
    );
    const response = await worker.fetch(post, committed);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      data: {
        outcome: 'refused',
        stage: 'admission',
        reason: 'provider-mode-coordinated',
      },
    });
    expect(post.bodyUsed).toBe(false);
    expect(spies.guardedPublish).not.toHaveBeenCalled();
    expect(storage.writeLog).toEqual([]);
    expect((await port.readAuthority(SEASON)).cutoverState).toBe(
      'uninitialized',
    );
  });

  it('fail closed on an admin route while the proxy token is missing, echoing nothing', async () => {
    const { env, storage } = production();
    const missing = {
      ...env,
      PROVIDER_MODE: 'coordinated',
      JOLPICA_PROXY_TOKEN: undefined,
    } as Env;
    const response = await worker.fetch(
      admin('/internal/admin/sync/full', {}),
      missing,
    );
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(PROXY_ORIGIN);
    expect(storage.writeLog).toEqual([]);
    expect(globalFetch).not.toHaveBeenCalled();
  });
});

describe('the production fallback variables (none) before genesis', () => {
  it('serve no season', async () => {
    const { env, port } = production();
    await expectNoSeasonServed(env, 'before-genesis');
    expect((await port.readAuthority(SEASON)).cutoverState).toBe(
      'uninitialized',
    );
  });

  it('refuse a first batch without writing', async () => {
    const { env, storage, port } = production();
    const spies = publicationSpies();
    const response = await worker.fetch(
      admin('/internal/admin/season/ingest', submissionFor(batch, null)),
      env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      data: {
        publication: {
          status: 'failed',
          reason: 'guard-authority-not-sequenced',
        },
      },
    });
    expect(spies.legacyPublish).not.toHaveBeenCalled();
    expect(await storage.listVersions(SEASON)).toEqual([]);
    expect((await port.readAuthority(SEASON)).cutoverState).toBe(
      'uninitialized',
    );
  });

  it('refuse the staging seed and activation in the genesis phase', async () => {
    const { env, port } = production();
    for (const [path, body] of [
      [
        '/internal/admin/publication/cutover/seed',
        { checkpoint: checkpointFor() },
      ],
      [
        '/internal/admin/publication/cutover/activate',
        { checkpoint: checkpointFor(), confirmActivation: true },
      ],
    ] as const) {
      const response = await worker.fetch(admin(path, body), env);
      expect(response.status, path).toBe(409);
      expect(await response.json(), path).toMatchObject({
        data: { kind: 'refused', refusal: 'phase-not-permitted' },
      });
    }
    expect((await port.readAuthority(SEASON)).cutoverState).toBe(
      'uninitialized',
    );
  });

  it('build no provider for a scheduled run or a manual sync, and publish nothing', async () => {
    const { env, storage, port, logger } = production();
    const spies = publicationSpies();

    await worker.scheduled?.({} as ScheduledController, env);
    const sync = await worker.fetch(
      admin('/internal/admin/sync/full', {}),
      env,
    );

    expect(((await sync.json()) as { data: unknown }).data).toMatchObject({
      status: 'failed',
      releaseVersion: null,
      failureCategory: 'provider-unavailable',
      providerCallCount: 0,
    });
    expect(spies.legacyPublish).not.toHaveBeenCalled();
    expect(spies.sequencedPublish).not.toHaveBeenCalled();
    expect(spies.guardedPublish).not.toHaveBeenCalled();
    expect(globalFetch).not.toHaveBeenCalled();
    expect(new Set(storage.writeLog)).toEqual(new Set([syncStateKey(SEASON)]));
    expect(await storage.listVersions(SEASON)).toEqual([]);
    expect((await port.readAuthority(SEASON)).cutoverState).toBe(
      'uninitialized',
    );
    expect(
      logger.events.filter((event) =>
        event.operation.startsWith('publication.'),
      ),
    ).toEqual([]);
  });
});

describe('the production fallback variables (none) through genesis and the first batch', () => {
  it('serve the season only once the first reviewed batch commits', async () => {
    const { env, storage, port } = production();

    const genesis = await worker.fetch(
      admin('/internal/admin/publication/cutover/genesis', {
        season: SEASON,
        genesisIdentity: IDENTITY,
        confirmGenesis: true,
      }),
      env,
    );
    expect(genesis.status).toBe(200);
    expect(await port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'genesis',
      activeVersion: null,
    });

    // Between genesis and the first batch, still nothing is served.
    await expectNoSeasonServed(env, 'genesis');

    const first = await worker.fetch(
      admin('/internal/admin/season/ingest', submissionFor(batch, null)),
      env,
    );
    expect(first.status).toBe(200);
    const committed = (
      (await first.json()) as {
        data: { publication: { version: string; previousVersion: null } };
      }
    ).data.publication;
    expect(committed.previousVersion).toBeNull();
    expect(await port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'active',
      activeVersion: committed.version,
      previousVersion: null,
    });
    expect(await storage.listVersions(SEASON)).toEqual([committed.version]);

    for (const path of SEASON_PATHS) {
      expect((await read(path, env)).status, path).toBe(200);
    }
  });

  it('keep the ingest authenticated', async () => {
    const { env, storage } = production();
    for (const [token, target] of [
      ['wrong-token', env],
      [ADMIN_TOKEN, { ...env, ADMIN_TOKEN: undefined }],
    ] as const) {
      const post = new Request(
        'https://api.gridview.local/internal/admin/season/ingest',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submissionFor(batch, null)),
        },
      );
      const response = await worker.fetch(post, target);
      expect(response.status, token).toBe(401);
      expect(post.bodyUsed, token).toBe(false);
    }
    expect(storage.writeLog).toEqual([]);
  });
});
