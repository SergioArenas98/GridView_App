/**
 * The committed `RECONCILIATION_LEDGER` binding: declared for staging only,
 * as Wrangler itself resolves `wrangler.toml`, and inert under the committed
 * `mock` and `none` provider modes even where a ledger namespace is bound.
 *
 * Committed is not deployed. `unstable_readConfig` only reads the file:
 * nothing here deploys, provisions or contacts Cloudflare, and nothing can
 * reach a provider.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unstable_readConfig } from 'wrangler';

import worker, { type Env } from '../../src/index';
import { MemoryCachePurgeAdapter } from '../../src/cache/purge';
import { CapturingLogger } from '../../src/logging/logger';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from '../../src/providers/http/provider-rate-limiter';
import { SequencedPublicationService } from '../../src/publication/sequenced/service';
import { MemorySnapshotStorage } from '../../src/storage/local';
import type { LedgerNamespace } from '../../src/sync/coordinated/ledger';
import { resolveReconciliationLedger } from '../../src/sync/coordinated/ledger-port';
import { SynchronizationService } from '../../src/sync/sync-service';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import { ADMIN_TOKEN, OP, call, paths } from '../admin/reconciliation-support';
import { SEASON, sequencedContext } from '../publication/sequenced/support';

const configPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'wrangler.toml',
);

/** The configuration Wrangler resolves for one environment (`''` = top level). */
function resolved(environment: '' | 'staging' | 'production') {
  return unstable_readConfig(
    { config: configPath, env: environment === '' ? undefined : environment },
    { hideWarnings: true },
  );
}

const sqlite = { type: 'durable-object', storage: 'sqlite' } as const;
const topLevelExports = {
  ProviderRateLimiter: sqlite,
  SeasonPublicationSequencer: sqlite,
};

function bindingNames(config: ReturnType<typeof resolved>): string[] {
  return config.durable_objects.bindings.map(
    (binding: { readonly name: string }) => binding.name,
  );
}

describe('the committed reconciliation-ledger declaration, as Wrangler resolves it', () => {
  it('registers the class and binds RECONCILIATION_LEDGER in staging, with no migration', () => {
    const staging = resolved('staging');
    expect(staging.exports).toEqual({
      ...topLevelExports,
      ReconciliationLedger: sqlite,
    });
    expect(staging.durable_objects.bindings).toEqual([
      { name: 'PROVIDER_RATE_LIMITER', class_name: 'ProviderRateLimiter' },
      {
        name: 'SEASON_PUBLICATION_SEQUENCER',
        class_name: 'SeasonPublicationSequencer',
      },
      { name: 'RECONCILIATION_LEDGER', class_name: 'ReconciliationLedger' },
    ]);
    expect(staging.migrations).toEqual([]);
  });

  it('restates the two top-level registrations in staging unchanged', () => {
    // A named environment's `exports` table replaces the top-level one, so
    // staging must carry both existing classes exactly as declared above it.
    const restated = Object.fromEntries(
      Object.entries(resolved('staging').exports).filter(
        ([name]) => name !== 'ReconciliationLedger',
      ),
    );
    expect(restated).toEqual(resolved('').exports);
    expect(resolved('').exports).toEqual(topLevelExports);
  });

  it('leaves development and production without the class or the binding', () => {
    for (const environment of ['', 'production'] as const) {
      const config = resolved(environment);
      expect(config.exports, environment).toEqual(topLevelExports);
      expect(bindingNames(config), environment).toEqual([
        'PROVIDER_RATE_LIMITER',
      ]);
      expect(config.migrations, environment).toEqual([]);
    }
  });

  it('keeps staging on mock, production on none and the cron unchanged', () => {
    const staging = resolved('staging');
    const production = resolved('production');
    expect(staging.vars.PROVIDER_MODE).toBe('mock');
    expect(production.vars).toEqual({
      ENVIRONMENT: 'production',
      PROVIDER_MODE: 'none',
    });
    expect(resolved('').vars).toEqual({ ENVIRONMENT: 'development' });
    expect(staging.triggers.crons).toEqual(['17 3 * * *']);
    expect(production.triggers.crons).toBeUndefined();
    expect(resolved('').triggers.crons).toBeUndefined();
  });

  it('fails closed where the binding is not declared', () => {
    // A namespace for every binding each environment declares, as a
    // deployment of it would carry.
    const boundEnv = (environment: '' | 'staging' | 'production') =>
      Object.fromEntries(
        bindingNames(resolved(environment)).map((name) => [
          name,
          countingNamespace(),
        ]),
      ) as Pick<Env, 'RECONCILIATION_LEDGER'>;
    expect(resolveReconciliationLedger(boundEnv(''))).toBeNull();
    expect(resolveReconciliationLedger(boundEnv('production'))).toBeNull();
    // Only staging's declared bindings give the resolver a ledger.
    expect(resolveReconciliationLedger(boundEnv('staging'))).not.toBeNull();
  });
});

class CountingLimiter implements ProviderRateLimiterClient {
  calls = 0;
  async reserve(
    sourceId: Parameters<ProviderRateLimiterClient['reserve']>[0],
  ): Promise<ReservationOutcome> {
    this.calls += 1;
    return { outcome: 'allowed', sourceId, headroom: [] };
  }
}

/** A ledger namespace that counts every lookup and serves none. */
function countingNamespace(): LedgerNamespace & {
  readonly touched: () => number;
} {
  let touched = 0;
  return {
    touched: () => touched,
    idFromName: (name) => {
      touched += 1;
      return name;
    },
    get: () => {
      touched += 1;
      throw new Error('a whole-season mode must not reach the ledger');
    },
  };
}

/** The committed variables of one environment, as strings. */
function committedVars(environment: 'staging' | 'production'): Partial<Env> {
  return Object.fromEntries(
    Object.entries(resolved(environment).vars).map(([name, value]) => [
      name,
      String(value),
    ]),
  );
}

const seasonAction = {
  season: SEASON,
  expectedSeasonRecordVersion: 0,
  operationId: OP[0],
};

/** Every reconciliation operator route, each with a well-formed request. */
const operatorRoutes: readonly [string, string, unknown?][] = [
  ['GET', paths.inspect(SEASON)],
  ['POST', paths.hold, seasonAction],
  ['POST', paths.releaseHold, seasonAction],
  ['POST', paths.clearBlock, seasonAction],
  [
    'POST',
    paths.disposition,
    {
      season: SEASON,
      round: 3,
      action: 'accept-staged',
      operationId: OP[1],
      expected: {
        recordVersion: 1,
        contentRevision: `sha256:${'a'.repeat(64)}`,
        stagedRevision: `sha256:${'b'.repeat(64)}`,
        competingRevision: null,
      },
    },
  ],
  [
    'POST',
    paths.verification,
    {
      season: SEASON,
      round: 3,
      operationId: OP[2],
      expectedStagedRevision: `sha256:${'b'.repeat(64)}`,
      expectedVerificationGeneration: 0,
    },
  ],
  ['GET', paths.verificationHistory(SEASON, 3)],
  [
    'POST',
    paths.verificationRotation,
    {
      season: SEASON,
      round: 3,
      operationId: OP[3],
      expected: {
        recordVersion: 1,
        verificationGeneration: 0,
        historyDigest: `sha256:${'d'.repeat(64)}`,
      },
      historyArchived: true,
    },
  ],
];

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

describe('the committed provider modes with a bound RECONCILIATION_LEDGER namespace', () => {
  it.each(['staging', 'production'] as const)(
    'the committed %s variables never look the ledger up, request a provider or publish through the coordinated path',
    async (environment) => {
      // Staging selects the sequencer authority, so its Worker reads season
      // 2026 from an active in-process sequencer, as live staging does.
      // Production selects none and reads legacy storage.
      const ctx =
        environment === 'staging'
          ? await sequencedContext({ cutover: 'active' })
          : null;
      const namespace = countingNamespace();
      const limiter = new CountingLimiter();
      let transportCalls = 0;
      const logger = new CapturingLogger();
      const env: Env = {
        ...committedVars(environment),
        ADMIN_TOKEN,
        RECONCILIATION_LEDGER: namespace as unknown as DurableObjectNamespace,
        __LOCAL_STORAGE: ctx?.storage ?? new MemorySnapshotStorage(),
        ...(ctx ? { __SEASON_PUBLICATION_SEQUENCER: ctx.port } : {}),
        __CACHE_PURGER: new MemoryCachePurgeAdapter(),
        __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
        __LOGGER: logger,
        __PROVIDER_RATE_LIMITER: limiter,
        __PROVIDER_TRANSPORT: async () => {
          transportCalls += 1;
          return new Response('{}', { status: 503 });
        },
      } as Env;
      expect(env.PROVIDER_MODE).toBe(
        environment === 'staging' ? 'mock' : 'none',
      );
      const wholeSeason = vi.spyOn(SynchronizationService.prototype, 'run');
      const guarded = vi.spyOn(
        SequencedPublicationService.prototype,
        'publishGuarded',
      );

      await worker.scheduled?.({} as ScheduledController, env);
      const manual = await call(env, 'POST', '/internal/admin/sync/full');
      expect(manual.status).not.toBe(503);

      for (const [method, path, body] of operatorRoutes) {
        const answer = await call(env, method, path, body);
        expect(answer.status, path).toBe(503);
        // The ledger is bound, so the mode alone refuses, before any read.
        expect(answer.body.data, path).toEqual({
          status: 'reconciliation-unavailable',
          reasons: ['provider-mode-not-coordinated'],
        });
      }

      // The sync entry points took the whole-season path. Production commits
      // no `PUBLIC_BASE_URL`, so its scheduled run stops at configuration,
      // before any synchronization, as it always has...
      if (environment === 'staging') {
        expect(wholeSeason).toHaveBeenCalledTimes(2);
      } else {
        expect(wholeSeason).toHaveBeenCalledTimes(1);
        expect(
          logger.events.filter(
            (event) => event.operation === 'scheduled.failed',
          ),
        ).toHaveLength(1);
      }
      // ...and nothing touched the ledger, a provider or the coordinated path.
      expect(namespace.touched()).toBe(0);
      expect(limiter.calls).toBe(0);
      expect(transportCalls).toBe(0);
      expect(globalFetch).not.toHaveBeenCalled();
      expect(guarded).not.toHaveBeenCalled();
      expect(
        logger.events.filter((event) =>
          event.operation.startsWith('sync.coordinated'),
        ),
      ).toEqual([]);
    },
  );
});
