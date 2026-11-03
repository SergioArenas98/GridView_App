/**
 * Release gate AU-4 step 1 (`docs/release/automatic-updates.md` §8.3): the
 * committed `[env.staging]` selects the automatic path by itself, as
 * Wrangler resolves it, and still schedules nothing.
 *
 * - The activation delta the AU-3 stage adds to committed staging
 *   (`AUTOMATIC_ACTIVATION_DELTA`) is now part of the committed
 *   configuration: `coordinated`, the ledger class and binding. The cron is
 *   not: it is step 3, its own change.
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

function resolved(environment: 'staging' | 'e2e') {
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
  it('commits the activation delta but the cron', () => {
    const staging = resolved('staging');
    expect(committedVars('staging').PROVIDER_MODE).toBe(
      AUTOMATIC_ACTIVATION_DELTA.PROVIDER_MODE,
    );
    expect(
      staging.durable_objects.bindings.map(
        (binding: { readonly name: string }) => binding.name,
      ),
    ).toContain(AUTOMATIC_ACTIVATION_DELTA.ledgerBinding);
    expect(staging.triggers.crons).toEqual([]);
    expect(staging.triggers.crons).not.toContain(
      AUTOMATIC_ACTIVATION_DELTA.cron,
    );
  });

  it('reads Jolpica from the network: only the demonstration Worker selects a controlled source', () => {
    expect(resolved('staging').vars).not.toHaveProperty(
      'CONTROLLED_PROVIDER_SOURCE',
    );
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
  it('with the ledger bound, bootstrap and publish through the coordinated path', async () => {
    const stage = await AutomaticUpdateStage.create('staging');
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
