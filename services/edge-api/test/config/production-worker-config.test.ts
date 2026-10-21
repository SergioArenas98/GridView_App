/**
 * The production Worker configuration (release plan W1, submission path A:
 * Workers Paid), as Wrangler itself resolves `wrangler.toml`, driven through
 * the real Worker entry points.
 *
 * `env.production` selects the sequencer authority, the `genesis:2026`
 * control and the guarded season-batch ingest for 2026, binds both Durable
 * Objects, requires `ADMIN_TOKEN`, schedules nothing and turns persisted
 * Workers Logs off. It deliberately declares **no KV binding**: no production
 * namespace exists, and Wrangler 4 would create one on deploy for a binding
 * without an `id`. This file proves that the resolved configuration:
 *
 * - schedules nothing, and says so explicitly;
 * - fails closed while the KV binding is missing;
 * - serves no season before genesis, nor between genesis and the first
 *   reviewed batch, and serves the season only once that batch commits;
 * - refuses the staging seed and activation, and every provider-driven sync;
 * - leaves staging exactly as it was.
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
import { resolveRuntimeConfig } from '../../src/config/environment';
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

function resolved(environment: 'staging' | 'production') {
  return unstable_readConfig(
    { config: configPath, env: environment },
    { hideWarnings: true },
  );
}

/** The resolved variables of one environment, as the Worker receives them. */
function resolvedVars(environment: 'staging' | 'production'): Partial<Env> {
  return Object.fromEntries(
    Object.entries(resolved(environment).vars).map(([name, value]) => [
      name,
      String(value),
    ]),
  );
}

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

  it('sets exactly the genesis, sequencer and ingest variables', () => {
    expect(resolved('production').vars).toEqual({
      ENVIRONMENT: 'production',
      PROVIDER_MODE: 'none',
      PUBLIC_BASE_URL: 'https://gridview-api-production.sejuma18.workers.dev',
      SEASON_PUBLICATION_CUTOVER_CONTROL: 'genesis:2026',
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_BATCH_INGEST: '2026',
    });
    const config = resolveRuntimeConfig(resolvedVars('production'));
    expect(config.environment).toBe('production');
    expect(config.providerMode).toBe('none');
    expect(config.publicationAuthorityMode).toBe('sequencer');
    expect(config.publicationCutoverControl).toEqual({
      kind: 'genesis',
      season: SEASON,
    });
  });

  it('binds both Durable Objects to the existing SQLite exports, with no migrations', () => {
    const production = resolved('production');
    expect(production.durable_objects.bindings).toEqual([
      { name: 'PROVIDER_RATE_LIMITER', class_name: 'ProviderRateLimiter' },
      {
        name: 'SEASON_PUBLICATION_SEQUENCER',
        class_name: 'SeasonPublicationSequencer',
      },
    ]);
    expect(Object.keys(production.exports)).toEqual([
      'ProviderRateLimiter',
      'SeasonPublicationSequencer',
    ]);
    expect(production.migrations).toEqual([]);
    expect(JSON.stringify(production.vars)).not.toMatch(/RECONCILIATION/);
  });

  it('requires ADMIN_TOKEN without committing a value', () => {
    expect(resolved('production').secrets).toEqual({
      required: ['ADMIN_TOKEN'],
    });
    expect(rawConfig).toMatch(
      /^\[env\.production\.secrets\]\nrequired = \["ADMIN_TOKEN"\]$/m,
    );
    expect(rawConfig).not.toContain('Bearer ');
  });

  it('schedules nothing, with an explicitly empty cron list', () => {
    // Empty, not absent: `wrangler deploy` sets the schedules only when
    // `crons` is set.
    expect(resolved('production').triggers).toEqual({ crons: [] });
    expect(rawConfig).toMatch(/^\[env\.production\.triggers\]\ncrons = \[\]$/m);
    expect(rawConfig).not.toMatch(/^\s*crons\s*=\s*\[\s*"/m);
  });

  it('turns persisted Workers Logs off explicitly (D-L fail-safe)', () => {
    // Cloudflare enables observability by default for new Workers, so an
    // absent block would not turn it off.
    expect(resolved('production').observability).toEqual({ enabled: false });
    expect(rawConfig).toMatch(
      /^\[env\.production\.observability\]\nenabled = false$/m,
    );
  });

  it('declares no KV binding until the real namespace id exists (W2)', () => {
    // Wrangler 4 provisions a new namespace on deploy for a KV binding with no
    // id, so a binding without one would create infrastructure. When W2
    // commits the real id, it must be a namespace id and not staging's.
    // The loop is empty until W2; W2 then replaces the `toEqual([])` below.
    const namespaces = resolved('production').kv_namespaces;
    for (const namespace of namespaces) {
      expect(namespace.binding).toBe('GRIDVIEW_DATA');
      expect(namespace.id).toMatch(/^[0-9a-f]{32}$/);
      expect(namespace.id).not.toBe(STAGING_KV_ID);
      expect(namespace.id).not.toMatch(/^(0+|f+|1234.*)$/);
    }
    expect(namespaces).toEqual([]);
    expect(declaredConfig).not.toContain('[[env.production.kv_namespaces]]');
  });

  it('leaves the staging configuration exactly as it was', () => {
    const staging = resolved('staging');
    expect(staging.vars).toEqual({
      ENVIRONMENT: 'staging',
      PROVIDER_MODE: 'none',
      PUBLIC_BASE_URL: 'https://gridview-api-staging.sejuma18.workers.dev',
      SEASON_PUBLICATION_CUTOVER_CONTROL: 'activate:2026',
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_BATCH_INGEST: '2026',
    });
    expect(staging.kv_namespaces).toEqual([
      { binding: 'GRIDVIEW_DATA', id: STAGING_KV_ID },
    ]);
    expect(staging.triggers).toEqual({ crons: [] });
    expect(staging.observability).toEqual({
      enabled: true,
      head_sampling_rate: 1,
      logs: { enabled: true, persist: true, invocation_logs: false },
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
 * A fresh production Worker env carrying the committed variables over an
 * empty in-memory namespace and an in-process sequencer that has never seen
 * the season, as a newly provisioned production would be.
 */
function production() {
  const clock = new FixedClock(new Date(NOW));
  const storage = new MemorySnapshotStorage();
  const port = new LocalSeasonPublicationSequencer(
    new SeasonPublicationCoordinator(new MemorySequencerHost(), { clock }),
  );
  const logger = new CapturingLogger();
  const env = {
    ...resolvedVars('production'),
    ADMIN_TOKEN,
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
    const env = { ...resolvedVars('production'), ADMIN_TOKEN } as Env;
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

describe('the committed production variables before genesis', () => {
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

describe('the committed production variables through genesis and the first batch', () => {
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
