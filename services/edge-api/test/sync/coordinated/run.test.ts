/**
 * The coordinated sync entry point: the manual/scheduled run kinds (O-8), the
 * gate in front of the orchestration, and the one delegation behind it.
 *
 * With no ledger - every environment - or any other dependency missing, the
 * gate refuses before anything is composed, leased, reserved or sent. With
 * every dependency present, the run is exactly one call of the §6.6
 * orchestration. The Worker-level behaviour is in `entry-points/`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { composeCoordinatedRuntime } from '../../../src/sync/coordinated/composition';
import { resolveReconciliationLedger } from '../../../src/sync/coordinated/ledger-port';
import { observeCoordinatedSeason } from '../../../src/sync/coordinated/observation';
import {
  coordinatedRunKind,
  runCoordinatedSync,
  type CoordinatedSyncDependencies,
} from '../../../src/sync/coordinated/run';
import { FIRST_PUBLICATION, MINUTE, later } from './entry-points/support';
import { ObservationHarness, PRE_SEASON, SEASON } from './observation/support';

vi.mock('../../../src/sync/coordinated/composition', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../src/sync/coordinated/composition')
    >();
  return {
    ...actual,
    composeCoordinatedRuntime: vi.fn(actual.composeCoordinatedRuntime),
  };
});
vi.mock('../../../src/sync/coordinated/observation', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../src/sync/coordinated/observation')
    >();
  return {
    ...actual,
    observeCoordinatedSeason: vi.fn(actual.observeCoordinatedSeason),
  };
});

const compose = vi.mocked(composeCoordinatedRuntime);
const observe = vi.mocked(observeCoordinatedSeason);

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  compose.mockClear();
  observe.mockClear();
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  expect(globalFetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

/** The harness's dependencies, as the Worker hands them to the entry. */
function dependencies(
  harness: ObservationHarness,
  overrides: Partial<CoordinatedSyncDependencies> = {},
): CoordinatedSyncDependencies {
  return { ...harness.dependencies(), ...overrides };
}

function traffic(harness: ObservationHarness) {
  return {
    requests: harness.server.requests.length,
    reservations: harness.limiter.reservations.length,
    publishes: harness.publishGuarded.mock.calls.length,
  };
}

describe('coordinated run kinds (O-8)', () => {
  it('makes a manual run a forced publication run that never advances the schedule', () => {
    expect(coordinatedRunKind('manual')).toEqual({
      trigger: 'manual',
      forcedPublication: true,
      advancesSchedule: false,
    });
    expect(coordinatedRunKind('scheduled')).toEqual({
      trigger: 'scheduled',
      forcedPublication: false,
      advancesSchedule: true,
    });
    expect(Object.isFrozen(coordinatedRunKind('manual'))).toBe(true);
  });
});

describe('the gate in front of the orchestration', () => {
  it('refuses both triggers as ledger-unbound with the resolver for an environment with no ledger binding', async () => {
    const harness = await ObservationHarness.create();
    expect(resolveReconciliationLedger({})).toBeNull();

    for (const trigger of ['scheduled', 'manual'] as const) {
      const outcome = await runCoordinatedSync(
        { season: SEASON, trigger },
        dependencies(harness, { ledger: resolveReconciliationLedger({}) }),
      );
      expect(outcome).toEqual({
        status: 'coordinated-runtime-unavailable',
        season: SEASON,
        run: coordinatedRunKind(trigger),
        reasons: ['ledger-unbound'],
        providerRequests: 0,
      });
    }
    expect(compose).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
    expect(traffic(harness)).toEqual({
      requests: 0,
      reservations: 0,
      publishes: 0,
    });
    expect(harness.host.committedKeys()).toEqual([]);
    expect(
      harness.logger.events.map((event) => [
        event.operation,
        event.syncTrigger,
        event.coordinationMissingDependencies,
      ]),
    ).toEqual([
      ['sync.coordinated.withheld', 'scheduled', ['ledger-unbound']],
      ['sync.coordinated.withheld', 'manual', ['ledger-unbound']],
    ]);
  });

  it('reports every missing dependency, and refuses a missing sequencer under a sequencer authority', async () => {
    const harness = await ObservationHarness.create();

    const nothing = await runCoordinatedSync(
      { season: SEASON, trigger: 'manual' },
      dependencies(harness, {
        limiter: null,
        authorityMode: 'legacy',
        guarded: null,
        purgeOrigin: null,
        ledger: null,
        sequencer: null,
      }),
    );
    const noSequencer = await runCoordinatedSync(
      { season: SEASON, trigger: 'manual' },
      dependencies(harness, { sequencer: null }),
    );

    expect(nothing).toMatchObject({
      reasons: [
        'limiter-unbound',
        'authority-not-sequencer',
        'purge-origin-missing',
        'ledger-unbound',
      ],
    });
    expect(noSequencer).toMatchObject({
      status: 'coordinated-runtime-unavailable',
      reasons: ['authority-not-sequencer'],
    });
    expect(compose).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
    expect(traffic(harness).reservations).toBe(0);
  });

  it('still reads a bound ledger for attention on a refused scheduled run, never on a manual one', async () => {
    const harness = await ObservationHarness.create({ seed: 'unclassified' });
    await harness.run(PRE_SEASON);
    await harness.run(FIRST_PUBLICATION);
    observe.mockClear();
    harness.clock.set(later(FIRST_PUBLICATION, MINUTE));
    const before = traffic(harness);

    for (const trigger of ['scheduled', 'manual'] as const) {
      harness.ledgerCalls.length = 0;
      await runCoordinatedSync(
        { season: SEASON, trigger },
        dependencies(harness, { limiter: null }),
      );
      expect(harness.ledgerCalls, trigger).toEqual(
        trigger === 'scheduled' ? ['readSeason'] : [],
      );
    }
    expect(observe).not.toHaveBeenCalled();
    expect(traffic(harness)).toEqual(before);
  });
});

describe('the orchestration behind the gate', () => {
  it('is exactly one call of the §6.6 orchestration, answered with the run kind', async () => {
    const harness = await ObservationHarness.create();
    harness.clock.set(PRE_SEASON);
    const deps = dependencies(harness);
    const controller = new AbortController();

    const outcome = await runCoordinatedSync(
      { season: SEASON, trigger: 'scheduled', signal: controller.signal },
      deps,
    );

    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe.mock.calls[0]).toEqual([
      { season: SEASON, trigger: 'scheduled', signal: controller.signal },
      deps,
    ]);
    const { season, trigger, ...result } = (await observe.mock.results[0]!
      .value) as Record<string, unknown>;
    expect([season, trigger]).toEqual([SEASON, 'scheduled']);
    expect(outcome).toEqual({
      ...result,
      season: SEASON,
      run: coordinatedRunKind('scheduled'),
    });
    expect(outcome).toMatchObject({
      status: 'observed',
      plan: 'observation',
      providerRequests: 1,
    });
    // The orchestration wrote the run's line; the entry wrote none of its own.
    expect(
      harness.logger.events
        .filter((event) => event.operation.startsWith('sync.coordinated'))
        .map((event) => event.operation),
    ).toEqual(['sync.coordinated.observation']);
  });
});
