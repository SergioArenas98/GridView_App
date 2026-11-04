/**
 * Which committed environments declare the `RECONCILIATION_LEDGER` binding
 * and register the `ReconciliationLedger` class, as Wrangler itself resolves
 * `wrangler.toml`: staging (release gate AU-4, step 1) and the isolated
 * demonstration Worker (`[env.e2e]`, gate AU-3), and no other. Development
 * and production keep the two top-level registrations, and production keeps
 * `none` and no ledger until its own gate (AU-7).
 *
 * Staging's ledger was declared once before, on 2026-10-06, and removed the
 * next day under the no-cost requirement; AU-4 declares it again. Creating
 * the class in a deployment blocks `wrangler rollback` to every earlier
 * version, so the restated top-level registrations must stay exactly as they
 * were.
 *
 * The documented fallback to manual batches (`PROVIDER_MODE = "none"` with
 * the ledger kept) and production's `none` stay inert even where a ledger
 * namespace is bound.
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
const ledgerExports = { ...topLevelExports, ReconciliationLedger: sqlite };
const ledgerBindings = [
  { name: 'PROVIDER_RATE_LIMITER', class_name: 'ProviderRateLimiter' },
  {
    name: 'SEASON_PUBLICATION_SEQUENCER',
    class_name: 'SeasonPublicationSequencer',
  },
  { name: 'RECONCILIATION_LEDGER', class_name: 'ReconciliationLedger' },
];

function bindingNames(config: ReturnType<typeof resolved>): string[] {
  return config.durable_objects.bindings.map(
    (binding: { readonly name: string }) => binding.name,
  );
}

describe('the committed configuration declares the reconciliation ledger in staging and the demonstration Worker only, as Wrangler resolves it', () => {
  it('resolves staging to the three registrations and bindings, the ledger included, with no migration', () => {
    const staging = resolved('staging');
    expect(staging.exports).toEqual(ledgerExports);
    expect(staging.durable_objects.bindings).toEqual(ledgerBindings);
    expect(staging.migrations).toEqual([]);
  });

  it('restates the two top-level registrations in staging unchanged', () => {
    // A named environment's `exports` table replaces the top-level one, so
    // staging must carry both classes its 2026-09-12 deployment created
    // exactly as declared above it; dropping one would need a deletion.
    const restated = Object.fromEntries(
      Object.entries(resolved('staging').exports).filter(
        ([name]) => name !== 'ReconciliationLedger',
      ),
    );
    expect(restated).toEqual(resolved('').exports);
    expect(resolved('').exports).toEqual(topLevelExports);
  });

  it('gives only staging and the demonstration Worker an exports table of their own', () => {
    expect(
      [...rawConfig.matchAll(/^\[env\.([a-z0-9]+)\.exports/gm)].map(
        (match) => match[1],
      ),
    ).toEqual(['staging', 'staging', 'staging', 'e2e', 'e2e', 'e2e']);
  });

  it('leaves development without the season binding, and production with the same two as before', () => {
    const development = resolved('');
    expect(development.exports).toEqual(topLevelExports);
    expect(bindingNames(development)).toEqual(['PROVIDER_RATE_LIMITER']);
    expect(development.migrations).toEqual([]);
    // Production genesis (release plan W1) binds the sequencer too, and
    // inherits the top-level exports; its ledger is gate AU-7's change.
    const production = resolved('production');
    expect(production.exports).toEqual(topLevelExports);
    expect(bindingNames(production)).toEqual([
      'PROVIDER_RATE_LIMITER',
      'SEASON_PUBLICATION_SEQUENCER',
    ]);
    expect(production.migrations).toEqual([]);
  });

  it('keeps staging on the batch path (none), production on none, and schedules nothing anywhere', () => {
    const staging = resolved('staging');
    const production = resolved('production');
    // The GitHub Actions batch path (2026-11-04) returned staging to `none`;
    // the ledger stays bound, so `coordinated` needs only the mode again.
    expect(staging.vars.PROVIDER_MODE).toBe('none');
    expect(production.vars.PROVIDER_MODE).toBe('none');
    expect(JSON.stringify(production.vars)).not.toMatch(/RECONCILIATION/);
    expect(resolved('').vars).toEqual({ ENVIRONMENT: 'development' });
    // Explicitly empty: the hourly schedule is AU-4 step 3, its own change.
    expect(staging.triggers.crons).toEqual([]);
    expect(production.triggers.crons).toEqual([]);
    expect(resolved('e2e').triggers.crons).toEqual([]);
    expect(resolved('').triggers.crons).toBeUndefined();
  });

  it('resolves the demonstration Worker to the same three registrations and bindings', () => {
    const demonstration = resolved('e2e');
    expect(demonstration.exports).toEqual(ledgerExports);
    expect(demonstration.durable_objects.bindings).toEqual(ledgerBindings);
    expect(demonstration.migrations).toEqual([]);
  });

  it('resolves a ledger from the declared bindings of staging and the demonstration Worker, and fails closed elsewhere', () => {
    // A namespace for every binding each environment declares, as a
    // deployment of it would carry.
    const boundEnv = (environment: '' | 'staging' | 'production' | 'e2e') =>
      Object.fromEntries(
        bindingNames(resolved(environment)).map((name) => [
          name,
          countingNamespace(),
        ]),
      ) as Pick<Env, 'RECONCILIATION_LEDGER'>;
    for (const environment of ['', 'production'] as const) {
      expect(
        resolveReconciliationLedger(boundEnv(environment)),
        environment,
      ).toBeNull();
    }
    for (const environment of ['staging', 'e2e'] as const) {
      expect(
        resolveReconciliationLedger(boundEnv(environment)),
        environment,
      ).not.toBeNull();
    }
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

/**
 * The variables of each `none` deployment the ledger can sit beside:
 * production as committed, and staging's documented fallback to manual
 * batches, which keeps the ledger binding and changes only the mode.
 */
const noneDeployments: readonly [string, () => Partial<Env>][] = [
  ['production', () => committedVars('production')],
  [
    "staging's fallback to manual batches",
    () => ({ ...committedVars('staging'), PROVIDER_MODE: 'none' }),
  ],
];

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
 * A `none` Worker beside a bound ledger: production should a later change
 * bind one before its mode, and staging after falling back to manual batches.
 * Neither may reach it.
 */
describe('the none provider mode with a bound RECONCILIATION_LEDGER namespace', () => {
  it.each(noneDeployments)(
    '%s never looks the ledger up, requests a provider or publishes through the coordinated path',
    async (_name, vars) => {
      // Both select the sequencer authority, so each Worker reads season 2026
      // from an active in-process sequencer: as live staging does, and as
      // production will once genesis and its first batch have committed.
      const ctx = await sequencedContext({ cutover: 'active' });
      const namespace = countingNamespace();
      const limiter = new CountingLimiter();
      let transportCalls = 0;
      const logger = new CapturingLogger();
      const env: Env = {
        ...vars(),
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
