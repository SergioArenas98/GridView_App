/**
 * The observation orchestration over the real C2 policy, the real C1 store,
 * the real composition (limiter, pacer, hardened client, routing port and
 * coordinator) and the real local sequencer. Only the transport, the limiter
 * double and the clock are synthetic. Every run builds a fresh ledger client
 * over one durable host, so each run restarts from committed state.
 *
 * Each case pins exactly what was reserved, what was sent and what the ledger
 * changed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { minimumReservationSpacingMillis } from '../../../../src/providers/http/reservation-pacer';
import { LEASE_TTL_MS } from '../../../../src/sync/coordinated/ledger';
import { checkTime } from '../../../../src/sync/coordinated/policy';
import {
  DAY,
  HOUR,
  ObservationHarness,
  PRE_SEASON,
  SEASON,
  anchorOf,
  changedFields,
  paths,
  seasonPaths,
  paced,
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

const iso = (millis: number) => new Date(millis).toISOString();

/**
 * The mock baseline the sequencer is seeded from classifies round 12, so
 * every candidate these observation cases build is refused by the D14 guard
 * and held for an operator: nothing is published. Publishing is exercised in
 * `../outcome/`.
 */
const SEED = 'v-seed-legacy';
const refusedByD14 = {
  outcome: 'not-applied',
  publicationStatus: 'rejected',
  reason: 'guard-round-coverage-regression',
  publishCalls: 1,
  next: 'blocked',
} as const;
const later = (at: string, millis: number) => iso(Date.parse(at) + millis);

/** Bootstrap and the first season-level publication run, both pre-season. */
async function startedSeason(): Promise<ObservationHarness> {
  const harness = await ObservationHarness.create();
  await harness.run(PRE_SEASON);
  await harness.run(later(PRE_SEASON, HOUR));
  return harness;
}

/** Round 1 accepted as variant A at its first slot. */
async function firstWrite(): Promise<ObservationHarness> {
  const harness = await startedSeason();
  harness.server.results.set(1, 'A');
  await harness.run(tickAfter(1, 5));
  return harness;
}

describe('the first calendar bootstrap', () => {
  it('asks for the calendar alone and records its anchors, making a publication due', async () => {
    const harness = await ObservationHarness.create();

    const run = await harness.run(PRE_SEASON);

    expect(run.outcome).toEqual({
      season: SEASON,
      trigger: 'scheduled',
      status: 'observed',
      plan: 'observation',
      coordination: 'completed',
      providerRequests: 1,
      committed: true,
      events: { 'refresh.first-observation': 1 },
      publication: 'not-attempted',
      leaseRelease: 'released',
    });
    expect(run.requests).toEqual([paths.calendar]);
    expect(run.reservations).toBe(1);

    const snapshot = await harness.snapshot();
    expect(snapshot.classifications).toEqual([]);
    expect(snapshot.backlog.count).toBe(0);
    const season = snapshot.seasonRecord!.record;
    expect(season.calendarAnchors).toHaveLength(23);
    expect(season.calendarAnchors![0]).toEqual({
      round: 1,
      anchor: anchorOf(1).toISOString(),
      anchorKind: 'date-time',
    });
    expect(season.calendarAnchors![22]!.anchor).toBe(
      anchorOf(23).toISOString(),
    );
    expect(season.publicationDueAt).toBe(PRE_SEASON);
    expect(season.refresh.calendar).toEqual({
      observedRevision: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      lastAttemptedAt: PRE_SEASON,
      lastSuccessAt: PRE_SEASON,
      nextDueAt: later(PRE_SEASON, 6 * HOUR),
    });
    for (const resource of [
      'circuits',
      'participants',
      'driver-standings',
      'constructor-standings',
    ] as const) {
      expect(season.refresh[resource]).toEqual({
        observedRevision: null,
        lastAttemptedAt: null,
        lastSuccessAt: null,
        nextDueAt: null,
      });
    }
    // The published-revision cache was reconciled from the authority first.
    expect(snapshot.published).toEqual({
      schemaVersion: 1,
      kind: 'published-reconciliation',
      season: SEASON,
      activeVersion: 'v-seed-legacy',
      reconciledAt: PRE_SEASON,
    });
    expect(harness.publishGuarded).not.toHaveBeenCalled();
  });

  it('then serves the due publication with the six season-level requests', async () => {
    const harness = await ObservationHarness.create();
    await harness.run(PRE_SEASON);

    const at = later(PRE_SEASON, HOUR);
    const run = await harness.run(at);

    expect(run.outcome).toMatchObject({
      status: 'observed',
      plan: 'publication',
      providerRequests: 6,
      events: { 'refresh.first-observation': 4, 'refresh.unchanged': 1 },
      publication: refusedByD14,
    });
    expect(run.requests).toEqual(seasonPaths);
    expect(run.reservations).toBe(6);
    const season = await harness.season();
    // Observed once the sixth response arrived, not when the run was planned.
    const observed = paced(at, 6);
    expect(season.publicationDueAt).toBeNull();
    expect(season.refresh.circuits.lastAttemptedAt).toBe(observed);
    expect(season.refresh.circuits.nextDueAt).toBe(later(observed, 7 * DAY));
    expect(season.refresh.participants.nextDueAt).toBe(
      later(observed, 7 * DAY),
    );
    // Pre-season, standings are weekly.
    expect(season.refresh['driver-standings'].nextDueAt).toBe(
      later(observed, 7 * DAY),
    );
    // One guarded publication, refused: held for an operator, not retried.
    expect(run.publishCalls).toBe(1);
    expect(harness.activeVersion()).toBe(SEED);
    expect(season.publicationDisposition).toEqual({
      state: 'blocked',
      since: expect.any(String),
      reason: 'guard-round-coverage-regression',
    });
  });
});

describe('a tick with nothing due', () => {
  it('makes zero provider requests and changes no observation state', async () => {
    const harness = await startedSeason();
    const before = harness.observationState();

    const at = later(PRE_SEASON, 2 * HOUR);
    const run = await harness.run(at);

    expect(run.outcome).toEqual({
      season: SEASON,
      trigger: 'scheduled',
      status: 'nothing-due',
      reason: 'no-work',
      providerRequests: 0,
      leaseRelease: 'released',
    });
    expect(run.requests).toEqual([]);
    expect(run.reservations).toBe(0);
    expect(harness.observationState()).toBe(before);
    // The authority was still read and reconciled before planning.
    expect((await harness.snapshot()).published?.reconciledAt).toBe(at);
  });
});

describe('a due season-level refresh', () => {
  it('asks only for the calendar and advances only its record', async () => {
    const harness = await startedSeason();
    const before = await harness.season();

    // Six hours after the calendar was last observed, it is the only thing
    // due. One request, so nothing is paced and the run observes at `at`.
    const at = before.refresh.calendar.nextDueAt!;
    expect(at).toBe(later(paced(later(PRE_SEASON, HOUR), 6), 6 * HOUR));
    const run = await harness.run(at);

    expect(run.outcome).toMatchObject({
      status: 'observed',
      plan: 'observation',
      providerRequests: 1,
      events: { 'refresh.unchanged': 1 },
    });
    expect(run.requests).toEqual([paths.calendar]);
    expect(run.reservations).toBe(1);
    const after = await harness.season();
    expect(changedFields(before, after)).toEqual(['refresh']);
    expect(changedFields(before.refresh, after.refresh)).toEqual(['calendar']);
    expect(after.refresh.calendar).toEqual({
      ...before.refresh.calendar,
      lastAttemptedAt: at,
      lastSuccessAt: at,
      nextDueAt: later(at, 6 * HOUR),
    });
    expect(after.publicationDueAt).toBeNull();
  });
});

describe('a first classification', () => {
  it('reads the round at its first slot and accepts it with one confirmation (T0)', async () => {
    const harness = await startedSeason();
    harness.server.results.set(1, 'A');
    const at = tickAfter(1, 5);

    const run = await harness.run(at);

    expect(run.outcome).toMatchObject({
      status: 'observed',
      plan: 'publication',
      providerRequests: 7,
      events: { 'classification.first-write': 1 },
      publication: refusedByD14,
    });
    expect(run.requests).toEqual([...seasonPaths, paths.results(1)]);
    expect(run.reservations).toBe(7);
    const record = await harness.record(1);
    // Observed once the seventh response arrived, not when the run was planned.
    const observed = paced(at, 7);
    expect(record).toMatchObject({
      checkIndex: 1,
      lastAttemptedAt: observed,
      lastSuccessfulObservationAt: observed,
      nextDueAt: checkTime(anchorOf(1).toISOString(), 2).toISOString(),
      contentRevision: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      consecutiveConfirmations: 1,
      provenance: 'reconciled',
      reviewState: 'unsettled',
      markers: [],
      sourceObservedAt: observed,
    });
    // No other round is eligible yet, so none is recorded.
    expect((await harness.snapshot()).classifications).toHaveLength(1);
    expect(run.publishCalls).toBe(1);
    expect(harness.activeVersion()).toBe(SEED);
  });
});

/** The record fields a classification observation may change. */
const observedFields = ['lastAttemptedAt', 'lastSuccessfulObservationAt'];

describe('corroboration of an unsettled change (D2.1)', () => {
  it('holds one sighting pending, accepts the second consecutive one and settles at +24h', async () => {
    const harness = await firstWrite();
    const accepted = (await harness.record(1))!.contentRevision!;

    harness.server.results.set(1, 'B');
    const sightedAt = tickAfter(1, 9);
    const before = await harness.record(1);
    const sighting = await harness.run(sightedAt);
    const pending = await harness.record(1);

    expect(sighting.requests).toEqual([...seasonPaths, paths.results(1)]);
    expect(sighting.reservations).toBe(7);
    expect(sighting.outcome).toMatchObject({
      events: { 'classification.pending-observed': 1 },
    });
    expect(changedFields(before, pending)).toEqual([
      'candidateFirstSeenAt',
      'candidateRevision',
      'checkIndex',
      'consecutiveConfirmations',
      ...observedFields,
      'markers',
      'nextDueAt',
    ]);
    expect(pending).toMatchObject({
      contentRevision: accepted,
      candidateFirstSeenAt: paced(sightedAt, 7),
      consecutiveConfirmations: 0,
      checkIndex: 2,
      markers: ['pending'],
    });
    const candidate = pending!.candidateRevision!;
    expect(candidate).not.toBe(accepted);

    const corroboration = await harness.run(tickAfter(1, 15));
    expect(corroboration.requests).toEqual([...seasonPaths, paths.results(1)]);
    expect(corroboration.outcome).toMatchObject({
      events: { 'classification.overwrite': 1 },
    });
    expect(await harness.record(1)).toMatchObject({
      contentRevision: candidate,
      supersededRevisions: [accepted],
      // The revision was first observed at the sighting, not now.
      sourceObservedAt: paced(sightedAt, 7),
      consecutiveConfirmations: 2,
      candidateRevision: null,
      checkIndex: 3,
      markers: [],
      reviewState: 'unsettled',
    });

    const settling = await harness.run(tickAfter(1, 24));
    expect(settling.outcome).toMatchObject({
      events: { 'classification.confirmed': 1, 'classification.settled': 1 },
    });
    expect(await harness.record(1)).toMatchObject({
      contentRevision: candidate,
      consecutiveConfirmations: 3,
      checkIndex: 4,
      reviewState: 'settled',
      terminalReason: 'settled',
      nextDueAt: null,
    });
    // Publication was attempted and refused at every publication run.
    expect(harness.activeVersion()).toBe(SEED);
  });
});

describe('an unstable source (T4, T5)', () => {
  it('a third revision replaces a pending one, and a superseded revision is never accepted again', async () => {
    const harness = await firstWrite();
    const first = (await harness.record(1))!.contentRevision!;

    harness.server.results.set(1, 'B');
    await harness.run(tickAfter(1, 9));
    const pendingB = (await harness.record(1))!.candidateRevision!;

    harness.server.results.set(1, 'C');
    const replaced = await harness.run(tickAfter(1, 15));
    expect(replaced.outcome).toMatchObject({
      events: { 'classification.pending-replaced': 1 },
    });
    const pendingC = await harness.record(1);
    expect(pendingC).toMatchObject({
      contentRevision: first,
      consecutiveConfirmations: 0,
      unstableSightings: 1,
    });
    expect(pendingC!.candidateRevision).not.toBe(pendingB);

    const corroborated = await harness.run(tickAfter(1, 24));
    expect(corroborated.outcome).toMatchObject({
      events: { 'classification.overwrite': 1 },
    });
    expect(await harness.record(1)).toMatchObject({
      contentRevision: pendingC!.candidateRevision,
      supersededRevisions: [first],
    });

    // The first revision returns: rejected, however it is served.
    harness.server.results.set(1, 'A');
    const returned = await harness.run(tickAfter(1, 48));
    expect(returned.requests).toEqual([...seasonPaths, paths.results(1)]);
    expect(returned.outcome).toMatchObject({
      events: { 'classification.rejected-superseded': 1 },
    });
    expect(await harness.record(1)).toMatchObject({
      contentRevision: pendingC!.candidateRevision,
      candidateRevision: null,
      consecutiveConfirmations: 0,
      supersededRevisions: [first],
      checkIndex: 5,
      reviewState: 'unsettled',
    });
  });
});

describe('a failed attempted check (T6)', () => {
  it('records the attempt and consumes the slot, but accepts nothing and resets nothing', async () => {
    const harness = await firstWrite();
    harness.server.results.set(1, 'B');
    await harness.run(tickAfter(1, 9));
    const pending = await harness.record(1);

    harness.server.results.delete(1);
    const at = tickAfter(1, 15);
    const run = await harness.run(at);
    const after = await harness.record(1);

    // The failed request was sent: it is a request and a check.
    expect(run.requests).toEqual([...seasonPaths, paths.results(1)]);
    expect(run.reservations).toBe(7);
    expect(run.outcome).toMatchObject({
      status: 'observed',
      providerRequests: 7,
      events: { 'classification.check-failed': 1 },
    });
    expect(changedFields(pending, after)).toEqual([
      'checkIndex',
      'lastAttemptedAt',
      'nextDueAt',
    ]);
    expect(after).toMatchObject({
      lastAttemptedAt: paced(at, 7),
      checkIndex: 3,
      contentRevision: pending!.contentRevision,
      candidateRevision: pending!.candidateRevision,
      consecutiveConfirmations: pending!.consecutiveConfirmations,
    });

    // The pending revision survives the failure and is corroborated next.
    harness.server.results.set(1, 'B');
    await harness.run(tickAfter(1, 24));
    expect(await harness.record(1)).toMatchObject({
      contentRevision: pending!.candidateRevision,
      consecutiveConfirmations: 2,
    });
  });
});

/** Round 1 accepted as B by corroboration, then settled at +24h. */
async function settledOnB(): Promise<ObservationHarness> {
  const harness = await firstWrite();
  harness.server.results.set(1, 'B');
  await harness.run(tickAfter(1, 9));
  await harness.run(tickAfter(1, 15));
  await harness.run(tickAfter(1, 24));
  return harness;
}

describe('a late correction to a settled round (D2.5, D2.8)', () => {
  it('is sighted by a reread, then staged for review and never accepted', async () => {
    const harness = await settledOnB();
    const settled = await harness.record(1);
    expect(settled?.reviewState).toBe('settled');

    harness.server.results.set(1, 'C');
    harness.server.results.set(2, 'A');
    const sightedAt = tickAfter(2, 5);
    const sighting = await harness.run(sightedAt);
    const sighted = await harness.record(1);

    // Round 1 is reread by the round 2 publication run: one request each.
    expect(sighting.requests).toEqual([
      ...seasonPaths,
      paths.results(1),
      paths.results(2),
    ]);
    expect(sighting.reservations).toBe(8);
    expect(sighting.outcome).toMatchObject({
      events: {
        'classification.first-write': 1,
        'classification.pending-observed': 1,
      },
    });
    expect(changedFields(settled, sighted)).toEqual([
      'candidateFirstSeenAt',
      'candidateRevision',
      'consecutiveConfirmations',
      'lastAttemptedAt',
      'lastPriorityAttemptAt',
      'lastSuccessfulObservationAt',
      'lastSweptAt',
      'markers',
    ]);
    expect(sighted).toMatchObject({
      contentRevision: settled!.contentRevision,
      checkIndex: settled!.checkIndex,
      markers: ['pending'],
    });

    const stagedAt = tickAfter(2, 9);
    const staging = await harness.run(stagedAt);
    const staged = await harness.record(1);
    expect(staging.requests).toEqual([
      ...seasonPaths,
      paths.results(1),
      paths.results(2),
    ]);
    expect(staging.outcome).toMatchObject({
      events: { 'classification.staged-correction': 1 },
    });
    expect(staged).toMatchObject({
      contentRevision: settled!.contentRevision,
      candidateRevision: null,
      stagedCorrection: {
        revision: sighted!.candidateRevision,
        firstSeenAt: paced(sightedAt, 8),
        uncorroborated: false,
      },
      markers: ['staged'],
      reviewState: 'settled',
    });
    expect((await harness.snapshot()).backlog).toEqual({
      count: 1,
      capacity: 60,
      entries: [
        {
          schemaVersion: 1,
          kind: 'backlog-entry',
          season: SEASON,
          round: 1,
          revision: sighted!.candidateRevision,
          // The ledger's own clock at commit: after 8 reservations paced
          // 260 ms apart.
          enteredAt: later(stagedAt, 7 * minimumReservationSpacingMillis),
        },
      ],
    });
    // The staged correction withholds the season for an operator (O-5(a)).
    expect(harness.activeVersion()).toBe(SEED);
    expect((await harness.season()).publicationDisposition).toMatchObject({
      state: 'blocked',
      reason: 'classification-staged',
    });
  });
});

describe('a scheduled cadence check and an O-3 reread stay distinct', () => {
  it('a reread of an unsettled round applies nothing; the next cadence check does', async () => {
    const harness = await startedSeason();
    harness.server.results.set(1, 'A');
    // Missed slots collapse: the first check of round 1 is its day-7 slot.
    await harness.run(tickAfter(1, 7 * 24));
    const first = await harness.record(1);
    expect(first).toMatchObject({
      checkIndex: 10,
      consecutiveConfirmations: 1,
    });

    harness.server.results.set(1, 'B');
    harness.server.results.set(2, 'A');
    const reread = await harness.run(tickAfter(2, 5));
    expect(reread.requests).toEqual([
      ...seasonPaths,
      paths.results(1),
      paths.results(2),
    ]);
    expect(reread.outcome).toMatchObject({
      events: {
        'classification.observation-not-applied': 1,
        'classification.first-write': 1,
      },
    });
    expect(changedFields(first, await harness.record(1))).toEqual(
      observedFields,
    );

    const cadence = await harness.run(tickAfter(1, 8 * 24));
    expect(cadence.outcome).toMatchObject({
      events: { 'classification.pending-observed': 1 },
    });
    expect(await harness.record(1)).toMatchObject({
      checkIndex: 11,
      markers: ['pending'],
    });
  });

  it('a manual run reads every eligible round but moves no due time and counts no confirmation (O-8)', async () => {
    const harness = await firstWrite();
    const season = await harness.season();
    const record = await harness.record(1);

    const run = await harness.run(tickAfter(1, 6), { trigger: 'manual' });

    expect(run.outcome).toMatchObject({
      trigger: 'manual',
      status: 'observed',
      plan: 'publication',
      events: { 'refresh.unchanged': 5 },
    });
    expect(run.requests).toEqual([...seasonPaths, paths.results(1)]);
    expect(changedFields(record, await harness.record(1))).toEqual(
      observedFields,
    );
    const after = await harness.season();
    for (const resource of Object.keys(season.refresh) as Array<
      keyof typeof season.refresh
    >) {
      expect(after.refresh[resource].nextDueAt).toBe(
        season.refresh[resource].nextDueAt,
      );
    }
    expect(after.publicationDueAt).toBe(season.publicationDueAt);
  });
});

describe('a limiter deferral', () => {
  it('is not a check: nothing is sent for it, and only the deferral is recorded', async () => {
    const harness = await firstWrite();
    const record = await harness.record(1);
    const at = tickAfter(1, 9);
    const retryAt = later(at, 90 * 60 * 1000);
    const base = harness.limiter.reservations.length;
    harness.limiter.script = (call) =>
      call === base + 7 ? { deferredUntil: retryAt } : 'allowed';

    const run = await harness.run(at);

    expect(run.reservations).toBe(7);
    expect(run.requests).toEqual(seasonPaths);
    expect(run.outcome).toMatchObject({
      status: 'observed',
      providerRequests: 6,
      events: { 'classification.check-deferred': 1 },
    });
    const deferred = await harness.record(1);
    expect(changedFields(record, deferred)).toEqual(['limiterDeferralUntil']);
    expect(deferred?.limiterDeferralUntil).toBe(retryAt);

    // Before `retryAt` a scheduled tick sends nothing at all.
    const waiting = await harness.run(later(at, HOUR));
    expect(waiting.outcome).toMatchObject({
      status: 'nothing-due',
      reason: 'limiter-deferred',
      providerRequests: 0,
    });
    expect(waiting.requests).toEqual([]);
    expect(waiting.reservations).toBe(0);

    // After it, the same slot is still due: the deferral consumed nothing.
    harness.limiter.script = () => 'allowed';
    const retried = await harness.run(later(at, 2 * HOUR));
    expect(retried.requests).toEqual([...seasonPaths, paths.results(1)]);
    expect(await harness.record(1)).toMatchObject({
      checkIndex: 2,
      consecutiveConfirmations: 2,
      limiterDeferralUntil: null,
    });
  });

  it('interrupting a two-request resource leaves that resource unrecorded', async () => {
    const harness = await firstWrite();
    const season = await harness.season();
    const at = tickAfter(1, 9);
    const base = harness.limiter.reservations.length;
    // Reservation 4 is the constructors request, after drivers was sent.
    harness.limiter.script = (call) =>
      call === base + 4
        ? { deferredUntil: later(at, 30 * 60 * 1000) }
        : 'allowed';

    const run = await harness.run(at);

    expect(run.requests).toEqual([
      paths.calendar,
      paths.circuits,
      paths.drivers,
      paths.driverStandings,
      paths.constructorStandings,
      paths.results(1),
    ]);
    expect(run.reservations).toBe(7);
    expect(run.outcome).toMatchObject({
      providerRequests: 6,
      events: {
        'classification.confirmed': 1,
        'refresh.deferred': 1,
        'refresh.unchanged': 4,
      },
    });
    const after = await harness.season();
    expect(after.refresh.participants).toEqual(season.refresh.participants);
    expect(after.refresh.circuits.lastAttemptedAt).toBe(paced(at, 7));
  });
});

describe('cancellation', () => {
  it('records what completed, and counts nothing it stopped', async () => {
    const harness = await firstWrite();
    const season = await harness.season();
    const record = await harness.record(1);
    const controller = new AbortController();
    harness.server.onRequest = (path) => {
      if (path === paths.circuits) controller.abort();
    };

    const at = tickAfter(1, 9);
    const run = await harness.run(at, { signal: controller.signal });

    expect(run.requests).toEqual([paths.calendar, paths.circuits]);
    expect(run.reservations).toBe(2);
    expect(run.outcome).toMatchObject({
      status: 'observed',
      coordination: 'cancelled',
      providerRequests: 2,
    });
    expect(await harness.record(1)).toEqual(record);
    const after = await harness.season();
    expect(after.refresh.calendar.lastAttemptedAt).toBe(paced(at, 2));
    for (const resource of [
      'participants',
      'driver-standings',
      'constructor-standings',
    ] as const) {
      expect(after.refresh[resource]).toEqual(season.refresh[resource]);
    }
  });
});

describe('restart from committed ledger state', () => {
  it('a new ledger client over the same durable state continues from what was committed', async () => {
    const harness = await firstWrite();
    harness.server.results.set(1, 'B');
    await harness.run(tickAfter(1, 9));
    const committed = harness.observationState();

    // Every run builds a fresh ledger client, store and runtime: nothing but
    // the durable host carries over. The pending sighting is read back from it.
    const pending = await harness.freshLedger().readSeason(SEASON);
    expect(
      pending.outcome === 'read' &&
        pending.snapshot.classifications[0]?.record.markers,
    ).toEqual(['pending']);

    const run = await harness.run(tickAfter(1, 15));

    expect(run.outcome).toMatchObject({
      events: { 'classification.overwrite': 1 },
    });
    expect(harness.observationState()).not.toBe(committed);
    expect(await harness.record(1)).toMatchObject({
      consecutiveConfirmations: 2,
      supersededRevisions: [expect.stringMatching(/^sha256:/)],
    });
  });

  it('a lease left by a crashed run blocks every run until it expires', async () => {
    const harness = await startedSeason();
    const at = later(PRE_SEASON, 7 * HOUR);
    harness.clock.set(at);
    const crashed = await harness.freshLedger().acquireLease(SEASON);
    expect(crashed.outcome).toBe('acquired');
    const before = harness.observationState();

    const blocked = await harness.run(at);
    expect(blocked.outcome).toEqual({
      season: SEASON,
      trigger: 'scheduled',
      status: 'run-in-progress',
      providerRequests: 0,
    });
    expect(blocked.requests).toEqual([]);
    expect(blocked.reservations).toBe(0);
    expect(harness.observationState()).toBe(before);

    const resumed = await harness.run(later(at, LEASE_TTL_MS));
    expect(resumed.outcome).toMatchObject({ status: 'observed' });
    expect(resumed.requests).toEqual([paths.calendar]);
  });
});
