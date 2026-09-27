/**
 * The per-run coordinated runtime composition, driven with synthetic local
 * dependencies only. Nothing here contacts a provider or Cloudflare: the
 * transport is a local function answering from memory, the global `fetch` is
 * replaced by a stub that fails the test if it is reached unexpectedly, and
 * the reconciliation ledger is an in-process store over memory (none can be
 * bound yet).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import type { GuardedPublicationCommands } from '../../../src/publication/commands';
import type {
  CoordinatedResource,
  CoordinationRun,
} from '../../../src/providers/coordination';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from '../../../src/providers/http/provider-rate-limiter';
import type { RealProviderSourceId } from '../../../src/providers/http/reservation-engine';
import {
  composeCoordinatedRuntime,
  coordinatedUnavailableReasons,
  missingCoordinatedDependencies,
  type CoordinatedRuntime,
  type CoordinatedRuntimeDependencies,
} from '../../../src/sync/coordinated/composition';
import { MemorySequencerHost } from '../../../src/publication/sequencer/hosts';
import {
  LocalReconciliationLedger,
  ReconciliationLedgerStore,
} from '../../../src/sync/coordinated/ledger';
import type { ReconciliationLedgerPort } from '../../../src/sync/coordinated/ledger-port';
import { MutableClock } from '../../publication/sequencer/support';

const START = '2026-09-27T12:00:00.000Z';
const SEASON = 2026;
const syntheticLedger: ReconciliationLedgerPort = new LocalReconciliationLedger(
  new ReconciliationLedgerStore(new MemorySequencerHost()),
);

/** Records every reservation, and when it was asked, on the run's clock. */
class CountingLimiter implements ProviderRateLimiterClient {
  readonly asked: { sourceId: RealProviderSourceId; at: number }[] = [];

  constructor(
    private readonly clock: MutableClock,
    private readonly answer: (call: number) => 'allowed' | 'deferred' = () =>
      'allowed',
  ) {}

  async reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome> {
    this.asked.push({ sourceId, at: this.clock.now().getTime() });
    if (this.answer(this.asked.length) === 'deferred') {
      return {
        outcome: 'deferred',
        sourceId,
        retryAt: '2026-09-27T12:00:05.000Z',
        limitingWindows: [],
        headroom: [],
      };
    }
    return { outcome: 'allowed', sourceId, headroom: [] };
  }
}

/** A local transport: every request is recorded and answered 503. */
function countingTransport(clock: MutableClock) {
  const requests: { url: URL; at: number }[] = [];
  const transport = async (request: Request): Promise<Response> => {
    requests.push({ url: new URL(request.url), at: clock.now().getTime() });
    clock.advance(20);
    return new Response('{}', {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { requests, transport };
}

const guardedStub: GuardedPublicationCommands = {
  publishGuarded: async () => {
    throw new Error('publication is not exercised here');
  },
};

function dependencies(
  overrides: Partial<CoordinatedRuntimeDependencies> = {},
): CoordinatedRuntimeDependencies {
  // The pacer's sleep must advance the same clock the run reads.
  const clock = overrides.clock ?? new MutableClock(new Date(START));
  if (!(clock instanceof MutableClock)) throw new Error('clock must move');
  return {
    limiter: new CountingLimiter(clock),
    authorityMode: 'sequencer',
    guarded: guardedStub,
    purgeOrigin: 'https://api.gridview.test',
    ledger: syntheticLedger,
    transport: countingTransport(clock).transport,
    sleep: async (millis) => clock.advance(millis),
    logger: new CapturingLogger(),
    clock,
    ...overrides,
  };
}

function composed(
  input: CoordinatedRuntimeDependencies = dependencies(),
): CoordinatedRuntime {
  const composition = composeCoordinatedRuntime(input);
  if (composition.kind !== 'composed') {
    throw new Error(`not composed: ${composition.reasons.join(',')}`);
  }
  return composition.runtime;
}

/** Reads a private field for an identity assertion, and only that. */
function field(target: object, name: string): unknown {
  return (target as Record<string, unknown>)[name];
}

const fullPlan: readonly CoordinatedResource[] = [
  { kind: 'season-calendar', season: SEASON },
  { kind: 'season-circuits', season: SEASON },
  { kind: 'season-participants', season: SEASON },
  { kind: 'driver-standings', season: SEASON },
  { kind: 'constructor-standings', season: SEASON },
  {
    kind: 'session-classification',
    season: SEASON,
    round: 1,
    sessionType: 'race',
  },
  {
    kind: 'session-classification',
    season: SEASON,
    round: 2,
    sessionType: 'race',
  },
];

const globalFetch = vi.fn<typeof fetch>(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('coordinated runtime gating', () => {
  const present = {
    limiter: true,
    sequencer: true,
    purgeOrigin: true,
    ledger: true,
  };
  const cases: readonly [Partial<typeof present>, string[]][] = [
    [{ ledger: false }, ['ledger-unbound']],
    [{ limiter: false }, ['limiter-unbound']],
    [{ sequencer: false }, ['authority-not-sequencer']],
    [{ purgeOrigin: false }, ['purge-origin-missing']],
    [
      { limiter: false, sequencer: false, purgeOrigin: false, ledger: false },
      [
        'limiter-unbound',
        'authority-not-sequencer',
        'purge-origin-missing',
        'ledger-unbound',
      ],
    ],
    [
      { sequencer: false, ledger: false },
      ['authority-not-sequencer', 'ledger-unbound'],
    ],
  ];

  it.each(cases)(
    'refuses %o with exactly %o and constructs nothing',
    (absent, reasons) => {
      const facts = { ...present, ...absent };
      const clock = new MutableClock(new Date(START));
      const limiter = new CountingLimiter(clock);
      const transport = countingTransport(clock);
      const input = dependencies({
        clock,
        limiter: facts.limiter ? limiter : null,
        authorityMode: facts.sequencer ? 'sequencer' : 'legacy',
        guarded: facts.sequencer && facts.purgeOrigin ? guardedStub : null,
        purgeOrigin: facts.purgeOrigin ? 'https://api.gridview.test' : null,
        ledger: facts.ledger ? syntheticLedger : null,
        transport: transport.transport,
      });

      expect(missingCoordinatedDependencies(input)).toEqual(reasons);
      expect(composeCoordinatedRuntime(input)).toEqual({
        kind: 'unavailable',
        reasons,
      });
      expect(limiter.asked).toEqual([]);
      expect(transport.requests).toEqual([]);
      expect(globalFetch).not.toHaveBeenCalled();
    },
  );

  it('reports every reason in the closed, fixed order', () => {
    expect(coordinatedUnavailableReasons).toEqual([
      'limiter-unbound',
      'authority-not-sequencer',
      'purge-origin-missing',
      'ledger-unbound',
    ]);
  });

  it('treats an unreachable sequencer authority as not a sequencer', () => {
    expect(
      missingCoordinatedDependencies(
        dependencies({ authorityMode: 'sequencer-unavailable', guarded: null }),
      ),
    ).toEqual(['authority-not-sequencer']);
    // A sequencer authority whose guarded surface is missing is refused too.
    expect(
      missingCoordinatedDependencies(dependencies({ guarded: null })),
    ).toEqual(['authority-not-sequencer']);
  });
});

describe('a composed coordinated runtime', () => {
  it('shares one hardened client over one pacer over the one limiter across all five ports', () => {
    const input = dependencies();
    const runtime = composed(input);

    for (const [name, port] of Object.entries(runtime.ports)) {
      expect(field(port, 'client'), name).toBe(runtime.client);
    }
    expect(field(runtime.client, 'limiter')).toBe(runtime.limiter);
    expect(field(runtime.limiter, 'limiter')).toBe(input.limiter);
    expect(field(runtime.client, 'transport')).toBe(input.transport);
    // The dispatcher routes to exactly these five port objects.
    expect(field(runtime.port, 'ports')).toEqual(runtime.ports);
  });

  it('registers exactly one port, for jolpica, and none for OpenF1', () => {
    const runtime = composed();
    const registered = field(runtime.coordinator, 'ports') as ReadonlyMap<
      string,
      unknown
    >;

    expect([...registered.keys()]).toEqual(['jolpica']);
    expect(registered.get('jolpica')).toBe(runtime.port);
    expect(registered.has('openf1')).toBe(false);
    // No bound is passed, so OpenF1 is locked by policy as well as unwired.
    expect(field(runtime.coordinator, 'eligibility')).toMatchObject({
      eligible: false,
    });
    expect(field(runtime.coordinator, 'maxConcurrent')).toBe(1);
  });

  it('binds the bridge to the guarded commands it was given, and nothing else', () => {
    const runtime = composed();
    expect(field(runtime.publication, 'commands')).toBe(guardedStub);
    expect(runtime.ledger).toBe(syntheticLedger);
  });

  it('builds new objects for every run', () => {
    const input = dependencies();
    const first = composed(input);
    const second = composed(input);
    expect(second.client).not.toBe(first.client);
    expect(second.limiter).not.toBe(first.limiter);
    expect(second.coordinator).not.toBe(first.coordinator);
  });

  it('sends every request of a full plan through one reservation each, paced, to Jolpica only', async () => {
    const clock = new MutableClock(new Date(START));
    const limiter = new CountingLimiter(clock);
    const transport = countingTransport(clock);
    const runtime = composed(
      dependencies({ clock, limiter, transport: transport.transport }),
    );

    const run: CoordinationRun = await runtime.coordinator.coordinate({
      plan: { season: SEASON, resources: fullPlan },
    });

    // Every request answered 503, so the participants port stops after its
    // first endpoint: 7 requests for 7 resources.
    expect(transport.requests.map((request) => request.url.pathname)).toEqual([
      '/ergast/f1/2026/races/',
      '/ergast/f1/2026/circuits/',
      '/ergast/f1/2026/drivers/',
      '/ergast/f1/2026/driverstandings/',
      '/ergast/f1/2026/constructorstandings/',
      '/ergast/f1/2026/1/results/',
      '/ergast/f1/2026/2/results/',
    ]);
    expect(
      new Set(transport.requests.map((request) => request.url.origin)),
    ).toEqual(new Set(['https://api.jolpi.ca']));
    // One reservation per request, all for jolpica, none for OpenF1.
    expect(limiter.asked).toHaveLength(transport.requests.length);
    expect(new Set(limiter.asked.map((entry) => entry.sourceId))).toEqual(
      new Set(['jolpica']),
    );
    // The one pacer spans every port, so spacing holds across them.
    const at = limiter.asked.map((entry) => entry.at);
    for (let index = 1; index < at.length; index += 1) {
      expect(
        (at[index] as number) - (at[index - 1] as number),
      ).toBeGreaterThanOrEqual(260);
    }
    expect(run.accounting.bySource.jolpica?.total).toBe(7);
    expect(run.accounting.bySource.openf1).toBeUndefined();
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('refuses an unsupported resource before any reservation or request', async () => {
    const clock = new MutableClock(new Date(START));
    const limiter = new CountingLimiter(clock);
    const transport = countingTransport(clock);
    const runtime = composed(
      dependencies({ clock, limiter, transport: transport.transport }),
    );

    for (const resource of [
      { kind: 'event-schedule', season: SEASON, round: 3 },
      {
        kind: 'session-classification',
        season: SEASON,
        round: 3,
        sessionType: 'sprint',
      },
    ] as const) {
      expect(
        await runtime.port.fetchResource({ source: 'jolpica', resource }),
      ).toEqual({ outcome: 'not-attempted', reason: 'resource-unsupported' });
    }
    expect(limiter.asked).toEqual([]);
    expect(transport.requests).toEqual([]);
  });

  it('treats a deferral as final: not attempted, asked once, never retried', async () => {
    const clock = new MutableClock(new Date(START));
    // The second reservation is deferred.
    const limiter = new CountingLimiter(clock, (call) =>
      call === 2 ? 'deferred' : 'allowed',
    );
    const transport = countingTransport(clock);
    const runtime = composed(
      dependencies({ clock, limiter, transport: transport.transport }),
    );

    const calendar = await runtime.port.fetchResource({
      source: 'jolpica',
      resource: { kind: 'season-calendar', season: SEASON },
    });
    const circuits = await runtime.port.fetchResource({
      source: 'jolpica',
      resource: { kind: 'season-circuits', season: SEASON },
    });
    const standings = await runtime.port.fetchResource({
      source: 'jolpica',
      resource: { kind: 'driver-standings', season: SEASON },
    });

    expect(calendar.outcome).toBe('failed');
    expect(circuits).toMatchObject({
      outcome: 'not-attempted',
      reason: 'rate-limit-deferred',
      retryAt: '2026-09-27T12:00:05.000Z',
    });
    expect(standings.outcome).toBe('failed');
    // Three reservations for three resources: the deferred one was asked
    // exactly once and sent nothing.
    expect(limiter.asked).toHaveLength(3);
    expect(transport.requests.map((request) => request.url.pathname)).toEqual([
      '/ergast/f1/2026/races/',
      '/ergast/f1/2026/driverstandings/',
    ]);
  });

  it('defaults to the runtime fetch, still behind one reservation per request', async () => {
    const clock = new MutableClock(new Date(START));
    const limiter = new CountingLimiter(clock);
    globalFetch.mockImplementation(
      async () =>
        new Response('{}', {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const runtime = composed(
      dependencies({ clock, limiter, transport: undefined }),
    );

    await runtime.port.fetchResource({
      source: 'jolpica',
      resource: { kind: 'season-calendar', season: SEASON },
    });

    expect(globalFetch).toHaveBeenCalledTimes(1);
    expect(limiter.asked).toHaveLength(1);
  });
});
