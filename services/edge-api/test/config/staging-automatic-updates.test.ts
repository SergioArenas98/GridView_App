/**
 * Release gates AU-4 (`docs/release/automatic-updates.md` §8.3) and AU-7
 * (§8.4): the committed `[env.staging]` and `[env.production]` select the
 * automatic path by themselves, as Wrangler resolves them, each with its
 * hourly schedule.
 *
 * - The activation delta the AU-3 stage adds to committed staging
 *   (`AUTOMATIC_ACTIVATION_DELTA`) is part of both committed
 *   configurations: `coordinated`, the ledger class and binding, and an
 *   hourly cron: production at the delta's minute 17, staging at minute 47,
 *   so that their paced runs never share the Jolpica proxy at once.
 * - Staging reads Jolpica from the network, never from a controlled source;
 *   only the demonstration Worker does.
 * - With the binding, a scheduled run of the committed variables reaches the
 *   coordinated orchestration and publishes through the guarded sequencer.
 * - A deployment that dropped the binding (the documented way to stop every
 *   coordinated run while keeping the ledger's data) stops at
 *   `ledger-unbound` before any provider request or publication.
 *
 * `unstable_readConfig` only reads the file. Every Jolpica answer is the
 * synthetic season of the port tests, and the global `fetch` throws.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unstable_readConfig } from 'wrangler';

import worker, { type Env } from '../../src/index';
import {
  AUTOMATIC_ACTIVATION_DELTA,
  AutomaticUpdateStage,
  HOUR,
  PRE_SEASON,
  committedVars,
  later,
} from '../e2e/automatic-updates/stage';

const configPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'wrangler.toml',
);

function resolved(environment: 'staging' | 'production' | 'e2e') {
  return unstable_readConfig(
    { config: configPath, env: environment },
    { hideWarnings: true },
  );
}

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  expect(globalFetch).not.toHaveBeenCalled();
});

describe('the committed staging configuration (gate AU-4 step 1)', () => {
  it.each([
    ['staging', ['47 * * * *']],
    ['production', [AUTOMATIC_ACTIVATION_DELTA.cron]],
  ] as const)(
    'commits the activation delta in %s, with its hourly schedule',
    (environment, crons) => {
      const config = resolved(environment);
      expect(config.vars.PROVIDER_MODE).toBe(
        AUTOMATIC_ACTIVATION_DELTA.PROVIDER_MODE,
      );
      expect(
        config.durable_objects.bindings.map(
          (binding: { readonly name: string }) => binding.name,
        ),
      ).toContain(AUTOMATIC_ACTIVATION_DELTA.ledgerBinding);
      expect(config.triggers.crons).toEqual(crons);
    },
  );

  it('reads Jolpica from the network: only the demonstration Worker selects a controlled source', () => {
    for (const environment of ['staging', 'production'] as const) {
      expect(resolved(environment).vars, environment).not.toHaveProperty(
        'CONTROLLED_PROVIDER_SOURCE',
      );
      expect(resolved(environment).vars, environment).toMatchObject({
        JOLPICA_TRANSPORT: 'proxy',
      });
    }
    expect(resolved('e2e').vars).toMatchObject({
      CONTROLLED_PROVIDER_SOURCE: 'kv',
    });
  });

  it('keeps the batch ingest configured, so falling back to none needs only the mode', () => {
    expect(committedVars('staging')).toMatchObject({
      SEASON_BATCH_INGEST: '2026',
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_PUBLICATION_CUTOVER_CONTROL: 'activate:2026',
    });
  });
});

describe('the committed staging variables at run time', () => {
  it('under runtime authority with no catalog bound, every run fails closed before any provider request or publication', async () => {
    const stage = await AutomaticUpdateStage.create('staging', {
      committedAuthority: true,
    });
    expect(stage.env.IDENTITY_CATALOG_MODE).toBe('runtime');
    expect(stage.env.IDENTITY_CATALOG).toBeUndefined();
    const before = stage.activeVersion();

    const first = await stage.tick(PRE_SEASON);
    const second = await stage.tick(later(PRE_SEASON, HOUR));

    expect(first.requests).toEqual([]);
    expect(second.requests).toEqual([]);
    expect(stage.releases()).toHaveLength(0);
    expect(stage.activeVersion()).toBe(before);
  });

  // The coordinated pipeline itself (bootstrap, then publication) under
  // explicit bundled authority; the runtime path with an active catalog is
  // exercised by test/identity/integration/cutover.test.mjs and restore.test.mjs.
  it('with the ledger bound, bootstrap and publish through the coordinated path', async () => {
    const stage = await AutomaticUpdateStage.create('staging');
    expect(stage.env.IDENTITY_CATALOG_MODE).toBe('bundled');
    // The stage's env is the committed variables; the delta it lays over
    // them no longer changes the mode.
    expect(stage.env.PROVIDER_MODE).toBe(
      committedVars('staging').PROVIDER_MODE,
    );
    const before = stage.activeVersion();

    const bootstrap = await stage.tick(PRE_SEASON);
    const publication = await stage.tick(later(PRE_SEASON, HOUR));

    expect(bootstrap.requests.length).toBeGreaterThan(0);
    expect(publication.requests.length).toBeGreaterThan(0);
    expect(stage.releases()).toHaveLength(1);
    expect(stage.activeVersion()).not.toBe(before);
    expect(
      publication.logs.some(
        (event) => event.operation === 'publication.sequencer.committed',
      ),
    ).toBe(true);
  });

  it('without the ledger binding, stop at ledger-unbound before any provider request or publication', async () => {
    const stage = await AutomaticUpdateStage.create('staging');
    const unbound = Object.fromEntries(
      Object.entries(stage.env).filter(
        ([name]) => name !== 'RECONCILIATION_LEDGER',
      ),
    );
    const before = stage.activeVersion();
    stage.clock.set(PRE_SEASON);

    await worker.scheduled?.({} as ScheduledController, unbound as Env);

    expect(stage.harness.server.requests).toEqual([]);
    expect(stage.activeVersion()).toBe(before);
    expect(
      stage.harness.logger.events.find(
        (event) => event.operation === 'sync.coordinated.withheld',
      ),
    ).toMatchObject({
      coordinationMissingDependencies: ['ledger-unbound'],
      providerOperationCallCount: 0,
    });
  });
});
