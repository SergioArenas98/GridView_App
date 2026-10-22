/**
 * No committed environment but the isolated demonstration Worker
 * (`[env.e2e]`, gate AU-3) declares the `RECONCILIATION_LEDGER` binding or
 * registers the `ReconciliationLedger` class, as Wrangler itself resolves
 * `wrangler.toml`. Staging resolves to the two Durable Object registrations
 * and bindings that Stage A deployed on 2026-10-07; the staging-only ledger
 * declaration committed the day before was removed under the no-cost
 * requirement, which parks Stage B. The committed provider mode - `none` in
 * staging (`mock` until the season-batch ingest configuration) and in
 * production - stays inert even where a ledger namespace is bound.
 *
 * `unstable_readConfig` only reads the file:
 * nothing here deploys, provisions or contacts Cloudflare, and nothing can
 * reach a provider.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unstable_readConfig } from 'wrangler';

import rawConfig from '../../wrangler.toml?raw';
import worker, { type Env } from '../../src/index';
import { MemoryCachePurgeAdapter } from '../../src/cache/purge';
import { CapturingLogger } from '../../src/logging/logger';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from '../../src/providers/http/provider-rate-limiter';
import { SequencedPublicationService } from '../../src/publication/sequenced/service';
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
function resolved(environment: '' | 'staging' | 'production' | 'e2e') {
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

describe('the committed configuration declares no reconciliation ledger outside the demonstration Worker, as Wrangler resolves it', () => {
  it('resolves staging to the two Durable Objects Stage A deployed, with no migration', () => {
    const staging = resolved('staging');
    expect(staging.exports).toEqual(topLevelExports);
    expect(staging.durable_objects.bindings).toEqual([
      { name: 'PROVIDER_RATE_LIMITER', class_name: 'ProviderRateLimiter' },
      {
        name: 'SEASON_PUBLICATION_SEQUENCER',
        class_name: 'SeasonPublicationSequencer',
      },
    ]);
    expect(staging.migrations).toEqual([]);
  });

  it('gives staging no exports table of its own, so it inherits the top-level one', () => {
    // A named environment's `exports` table would replace the top-level one;
    // without one, staging resolves to exactly the top-level registrations.
    // Only the demonstration Worker has its own (asserted below).
    expect(
      [...rawConfig.matchAll(/^\[env\.([a-z0-9]+)\.exports/gm)].map(
        (match) => match[1],
      ),
    ).toEqual(['e2e', 'e2e', 'e2e']);
    expect(resolved('staging').exports).toEqual(resolved('').exports);
    expect(resolved('').exports).toEqual(topLevelExports);
  });

  it('leaves development without the season binding, and gives production the same two as staging', () => {
    const development = resolved('');
    expect(development.exports).toEqual(topLevelExports);
    expect(bindingNames(development)).toEqual(['PROVIDER_RATE_LIMITER']);
    expect(development.migrations).toEqual([]);
    // Production genesis (release plan W1) binds the sequencer too, and
    // inherits the top-level exports like staging.
    const production = resolved('production');
    expect(production.exports).toEqual(topLevelExports);
    expect(bindingNames(production)).toEqual([
      'PROVIDER_RATE_LIMITER',
      'SEASON_PUBLICATION_SEQUENCER',
    ]);
    expect(production.migrations).toEqual([]);
  });

  it('keeps staging and production on none, with no scheduled trigger anywhere', () => {
    const staging = resolved('staging');
    const production = resolved('production');
    expect(staging.vars.PROVIDER_MODE).toBe('none');
    expect(production.vars.PROVIDER_MODE).toBe('none');
    expect(JSON.stringify(production.vars)).not.toMatch(/RECONCILIATION/);
    expect(resolved('').vars).toEqual({ ENVIRONMENT: 'development' });
    // Explicitly empty: staging since the season-batch ingest configuration,
    // production since its own configuration (W1).
    expect(staging.triggers.crons).toEqual([]);
    expect(production.triggers.crons).toEqual([]);
    expect(resolved('').triggers.crons).toBeUndefined();
  });

  it('resolves the demonstration Worker to the three registrations and bindings, the ledger included', () => {
    const demonstration = resolved('e2e');
    expect(demonstration.exports).toEqual({
      ...topLevelExports,
      ReconciliationLedger: sqlite,
    });
    expect(bindingNames(demonstration)).toEqual([
      'PROVIDER_RATE_LIMITER',
      'SEASON_PUBLICATION_SEQUENCER',
      'RECONCILIATION_LEDGER',
    ]);
    expect(demonstration.migrations).toEqual([]);
  });

  it('fails closed in every environment but the demonstration Worker, none of which declares the binding', () => {
    // A namespace for every binding each environment declares, as a
    // deployment of it would carry.
    const boundEnv = (environment: '' | 'staging' | 'production' | 'e2e') =>
      Object.fromEntries(
        bindingNames(resolved(environment)).map((name) => [
          name,
          countingNamespace(),
        ]),
      ) as Pick<Env, 'RECONCILIATION_LEDGER'>;
    for (const environment of ['', 'staging', 'production'] as const) {
      expect(
        resolveReconciliationLedger(boundEnv(environment)),
        environment,
      ).toBeNull();
    }
    // The demonstration Worker's bindings carry it, so it resolves there.
    expect(resolveReconciliationLedger(boundEnv('e2e'))).not.toBeNull();
    // The same namespace under the ledger's own name would be resolved, so
    // the nulls above come from the configuration, not from the namespace.
    expect(
      resolveReconciliationLedger({
        RECONCILIATION_LEDGER:
          countingNamespace() as unknown as DurableObjectNamespace,
      }),
    ).not.toBeNull();
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

/**
 * No environment binds the ledger (asserted above). Should a later,
 * separately authorized change bind one, the committed provider modes must
 * still never reach it.
 */
describe('the committed provider modes with a bound RECONCILIATION_LEDGER namespace', () => {
  it.each(['staging', 'production'] as const)(
    'the committed %s variables never look the ledger up, request a provider or publish through the coordinated path',
    async (environment) => {
      // Both select the sequencer authority, so each Worker reads season 2026
      // from an active in-process sequencer: as live staging does, and as
      // production will once genesis and its first batch have committed.
      const ctx = await sequencedContext({ cutover: 'active' });
      const namespace = countingNamespace();
      const limiter = new CountingLimiter();
      let transportCalls = 0;
      const logger = new CapturingLogger();
      const env: Env = {
        ...committedVars(environment),
        ADMIN_TOKEN,
        RECONCILIATION_LEDGER: namespace as unknown as DurableObjectNamespace,
        __LOCAL_STORAGE: ctx.storage,
        __SEASON_PUBLICATION_SEQUENCER: ctx.port,
        __CACHE_PURGER: new MemoryCachePurgeAdapter(),
        __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
        __LOGGER: logger,
        __PROVIDER_RATE_LIMITER: limiter,
        __PROVIDER_TRANSPORT: async () => {
          transportCalls += 1;
          return new Response('{}', { status: 503 });
        },
      } as Env;
      expect(env.PROVIDER_MODE).toBe('none');
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

      // The sync entry points took the whole-season path, the scheduled run
      // and the manual one alike...
      expect(wholeSeason).toHaveBeenCalledTimes(2);
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
