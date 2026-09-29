/**
 * Every way a run can fail after it could have sent a request fails closed:
 * the observation state the ledger holds is byte-for-byte unchanged, nothing
 * is published, the lease is given back when one was taken, and the next
 * clean run proceeds from the committed state as if the failed run had never
 * happened.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SeasonPublicationSequencerPort } from '../../../../src/publication/sequencer/port';
import type { SnapshotStorage } from '../../../../src/storage/types';
import { LEASE_TTL_MS } from '../../../../src/sync/coordinated/ledger';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import {
  observeCoordinatedSeason,
  type CoordinatedObservationOutcome,
} from '../../../../src/sync/coordinated/observation';
import {
  HOUR,
  ObservationHarness,
  PRE_SEASON,
  SEASON,
  paths,
  seasonPaths,
  tickAfter,
} from './support';

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

const later = (at: string, millis: number) =>
  new Date(Date.parse(at) + millis).toISOString();

/** Bootstrapped, with the first season-level publication run served. */
async function startedSeason(): Promise<ObservationHarness> {
  const harness = await ObservationHarness.create();
  await harness.run(PRE_SEASON);
  await harness.run(later(PRE_SEASON, HOUR));
  // The setup's own pre-season publication attempt (refused by the D14 guard
  // against the mock baseline) is not what these cases measure.
  harness.publishGuarded.mockClear();
  return harness;
}

/** A tick at which round 1's first check and six season requests are due. */
const FIRST_CHECK = tickAfter(1, 5);
/** Still before round 1's second slot, and after any lease a failed run left. */
const RETRY = later(FIRST_CHECK, 30 * 60 * 1000);
const firstCheckRequests = [...seasonPaths, paths.results(1)];

/** `target` with some methods replaced; the rest still reach `target`. */
function overriding<T extends object>(target: T, methods: Partial<T>): T {
  return Object.assign(Object.create(target) as T, methods);
}

function failure(
  stage: string,
  reason: string,
  providerRequests: number,
  ledgerRejection: string | null = null,
  leaseRelease: string | null = 'released',
): CoordinatedObservationOutcome {
  return {
    season: SEASON,
    trigger: 'scheduled',
    status: 'failed',
    stage,
    failure: reason,
    ledgerRejection,
    providerRequests,
    leaseRelease,
  } as CoordinatedObservationOutcome;
}

/**
 * Asserts the failed run changed no observation state and published
 * nothing, then that a clean retry makes exactly the requests the failed run
 * was due to make.
 */
async function expectCleanRetry(
  harness: ObservationHarness,
  before: string,
  at: string,
  requests: readonly string[],
): Promise<void> {
  expect(harness.observationState()).toBe(before);
  expect(harness.publishGuarded).not.toHaveBeenCalled();
  const retry = await harness.run(at);
  expect(retry.outcome.status).toBe('observed');
  expect(retry.requests).toEqual(requests);
}

describe('a refused composition', () => {
  it('builds nothing, takes no lease and makes no request', async () => {
    const harness = await ObservationHarness.create();

    const run = await harness.run(PRE_SEASON, { ledger: null });

    expect(run.outcome).toEqual({
      season: SEASON,
      trigger: 'scheduled',
      status: 'coordinated-runtime-unavailable',
      reasons: ['ledger-unbound'],
      providerRequests: 0,
    });
    expect(run.requests).toEqual([]);
    expect(run.reservations).toBe(0);
    expect(harness.host.committedKeys()).toEqual([]);
  });
});

describe('lease fencing', () => {
  it('a concurrent run finds the lease held and sends nothing', async () => {
    const harness = await startedSeason();
    harness.server.results.set(1, 'A');
    let concurrent: CoordinatedObservationOutcome | null = null;
    harness.server.onRequest = (path) => {
      if (path !== paths.circuits || concurrent !== null) return;
      void observeCoordinatedSeason(
        { season: SEASON, trigger: 'manual' },
        harness.dependencies(),
      ).then((outcome) => {
        concurrent = outcome;
      });
    };

    const run = await harness.run(FIRST_CHECK);
    await vi.waitFor(() => expect(concurrent).not.toBeNull());

    expect(concurrent).toEqual({
      season: SEASON,
      trigger: 'manual',
      status: 'run-in-progress',
      providerRequests: 0,
    });
    // Nothing the concurrent run did reached the limiter or the transport:
    // every request and reservation in the window is the first run's own.
    expect(run.requests).toEqual(firstCheckRequests);
    expect(run.reservations).toBe(firstCheckRequests.length);
    expect(run.outcome).toMatchObject({ status: 'observed' });
  });

  it('a lease superseded during the run commits nothing', async () => {
    const harness = await startedSeason();
    harness.server.results.set(1, 'A');
    const before = harness.observationState();
    harness.server.onRequest = (path) => {
      if (path !== paths.results(1)) return;
      // The run outlives its lease, and another run takes the season.
      harness.clock.advance(LEASE_TTL_MS);
      void harness.freshLedger().acquireLease(SEASON);
    };

    const run = await harness.run(FIRST_CHECK);

    expect(run.requests).toEqual(firstCheckRequests);
    expect(run.outcome).toEqual(
      failure('commit', 'ledger-rejected', 7, 'lease-superseded', 'refused'),
    );
    harness.server.onRequest = () => {};
    // After the other run's lease has expired too.
    await expectCleanRetry(harness, before, RETRY, firstCheckRequests);
  });

  it('a lease that expires during the run commits nothing', async () => {
    const harness = await startedSeason();
    harness.server.results.set(1, 'A');
    const before = harness.observationState();
    harness.server.onRequest = (path) => {
      if (path === paths.results(1)) harness.clock.advance(LEASE_TTL_MS);
    };

    const run = await harness.run(FIRST_CHECK);

    expect(run.outcome).toEqual(
      failure('commit', 'ledger-rejected', 7, 'lease-expired', 'refused'),
    );
    harness.server.onRequest = () => {};
    await expectCleanRetry(harness, before, RETRY, firstCheckRequests);
  });

  it('a lease that expired before coordination sends no request at all', async () => {
    const harness = await startedSeason();
    const before = harness.observationState();
    const base = harness.freshLedger();
    // The reconciliation answers after the lease has run out.
    const slow = overriding<ReconciliationLedgerPort>(base, {
      reconcilePublishedRevisions: async (request) => {
        const outcome = await base.reconcilePublishedRevisions(request);
        harness.clock.advance(LEASE_TTL_MS);
        return outcome;
      },
    });

    const run = await harness.run(FIRST_CHECK, { ledger: slow });

    expect(run.outcome).toEqual(
      failure('coordination', 'lease-expired', 0, null, 'refused'),
    );
    expect(run.requests).toEqual([]);
    expect(run.reservations).toBe(0);
    harness.server.results.set(1, 'A');
    await expectCleanRetry(harness, before, RETRY, firstCheckRequests);
  });
});

describe('an authority that cannot be trusted', () => {
  const cases: readonly [
    string,
    (harness: ObservationHarness) => {
      sequencer?: SeasonPublicationSequencerPort;
      storage?: SnapshotStorage;
    },
    string,
  ][] = [
    [
      'a sequencer that throws',
      (harness) => ({
        sequencer: overriding(harness.sequencer, {
          readAuthority: async () => {
            throw new Error('unreachable');
          },
        }),
      }),
      'authority-unavailable',
    ],
    [
      'a sequencer that cannot answer',
      (harness) => ({
        sequencer: overriding(harness.sequencer, {
          readAuthority: async () => ({
            cutoverState: 'unavailable',
            authoritative: false,
          }),
        }),
      }),
      'authority-unavailable',
    ],
    [
      'a season that is not authoritative',
      (harness) => ({
        sequencer: overriding(harness.sequencer, {
          readAuthority: async () => ({
            cutoverState: 'uninitialized',
            authoritative: false,
          }),
        }),
      }),
      'authority-not-authoritative',
    ],
    [
      'an active release whose results cannot be read',
      (harness) => ({
        storage: overriding(harness.storage, {
          readVersionedDocument: async () => null,
        }),
      }),
      'published-release-unavailable',
    ],
  ];

  for (const [name, override, reason] of cases) {
    it(`${name}: no plan and no request`, async () => {
      const harness = await startedSeason();
      harness.server.results.set(1, 'A');
      const before = harness.observationState();
      const beforeBytes = JSON.stringify(
        harness.host.peek(`published:${SEASON}`),
      );

      const run = await harness.run(FIRST_CHECK, override(harness));

      expect(run.outcome).toEqual(failure('authority', reason, 0));
      expect(run.requests).toEqual([]);
      expect(run.reservations).toBe(0);
      // The published-revision cache is never reconciled from a refusal.
      expect(JSON.stringify(harness.host.peek(`published:${SEASON}`))).toBe(
        beforeBytes,
      );
      await expectCleanRetry(harness, before, RETRY, firstCheckRequests);
    });
  }

  it('a seeded but not activated season is refused', async () => {
    const harness = await ObservationHarness.create('seeded');

    const run = await harness.run(PRE_SEASON);

    expect(run.outcome).toEqual(
      failure('authority', 'authority-not-authoritative', 0),
    );
    expect(run.requests).toEqual([]);
    expect(harness.host.committedKeys()).toEqual([`lease:${SEASON}`]);
  });
});

describe('a ledger that refuses or loses the observation commit', () => {
  const answers = [
    [{ outcome: 'unavailable' as const }, 'ledger-unavailable', null],
    [{ outcome: 'uncertain' as const }, 'ledger-uncertain', null],
    [
      { outcome: 'rejected' as const, reason: 'version-conflict' as const },
      'ledger-rejected',
      'version-conflict',
    ],
  ] as const;

  for (const [answer, reason, rejection] of answers) {
    it(`${reason}: commits nothing and the next run repeats the same work`, async () => {
      const harness = await startedSeason();
      harness.server.results.set(1, 'A');
      const before = harness.observationState();
      const base = harness.freshLedger();
      const refusing = overriding<ReconciliationLedgerPort>(base, {
        commit: async () => answer,
      });

      const run = await harness.run(FIRST_CHECK, { ledger: refusing });

      expect(run.requests).toEqual(firstCheckRequests);
      expect(run.outcome).toEqual(failure('commit', reason, 7, rejection));
      await expectCleanRetry(harness, before, RETRY, firstCheckRequests);
    });
  }

  it('a lease that cannot be acquired: no read, no request, nothing to release', async () => {
    const harness = await startedSeason();
    const base = harness.freshLedger();
    const unreachable = overriding<ReconciliationLedgerPort>(base, {
      acquireLease: async () => ({ outcome: 'unavailable' }),
    });
    const readAuthority = vi.spyOn(harness.sequencer, 'readAuthority');

    const run = await harness.run(FIRST_CHECK, { ledger: unreachable });

    expect(run.outcome).toEqual(
      failure('lease', 'ledger-unavailable', 0, null, null),
    );
    expect(run.requests).toEqual([]);
    expect(readAuthority).not.toHaveBeenCalled();
  });

  it('a refused reconciliation: no plan and no request', async () => {
    const harness = await startedSeason();
    const before = harness.observationState();
    const base = harness.freshLedger();
    const refusing = overriding<ReconciliationLedgerPort>(base, {
      reconcilePublishedRevisions: async () => ({
        outcome: 'rejected',
        reason: 'state-corrupt',
      }),
    });

    const run = await harness.run(FIRST_CHECK, { ledger: refusing });

    expect(run.outcome).toEqual(
      failure('reconciliation', 'ledger-rejected', 0, 'state-corrupt'),
    );
    expect(run.requests).toEqual([]);
    harness.server.results.set(1, 'A');
    await expectCleanRetry(harness, before, RETRY, firstCheckRequests);
  });
});

describe('the run log line', () => {
  it('is one bounded line per run with closed values and no provider data', async () => {
    const harness = await startedSeason();
    harness.server.results.set(1, 'A');
    await harness.run(FIRST_CHECK);
    await harness.run(FIRST_CHECK, { ledger: null });

    const lines = harness.logger.events.filter(
      (event) => event.operation === 'sync.coordinated.observation',
    );
    expect(lines).toHaveLength(4);
    // The candidate is refused by the D14 guard against the mock baseline
    // and held for an operator, so the line warns, with closed values only.
    expect(lines[2]).toEqual({
      level: 'warn',
      operation: 'sync.coordinated.observation',
      season: SEASON,
      syncTrigger: 'scheduled',
      coordinationStatus: 'observed',
      providerOperationCallCount: 7,
      coordinationOutcome: 'completed',
      observationPlan: 'publication',
      reconciliationEvents: {
        'classification.first-write': 1,
        // Both standings tables moved from empty to round 1.
        'refresh.overwrite': 2,
        'refresh.unchanged': 3,
      },
      publicationOutcome: 'not-applied',
      publicationNextDue: 'blocked',
      publicationStatus: 'rejected',
      publicationReason: 'guard-round-coverage-regression',
    });
    expect(lines[3]).toMatchObject({
      level: 'warn',
      coordinationStatus: 'coordinated-runtime-unavailable',
      failureCategory: 'coordinated-runtime-unavailable',
      coordinationMissingDependencies: ['ledger-unbound'],
    });
    const serialized = harness.logger.serialized();
    expect(serialized).not.toMatch(
      /sha256:|jolpi\.ca|ergast|results\/|Synthetic/,
    );
    expect(serialized).not.toContain('2026-03-01');
  });
});
