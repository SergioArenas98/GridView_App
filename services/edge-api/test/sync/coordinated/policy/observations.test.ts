/**
 * One run's observations as one C1 commit, and the O-5(a) publishability
 * decision, over the real store: failure, cancellation, the backlog cap,
 * stale revisions, the observation-to-publication handoff, full backfill,
 * manual runs and the closed event set.
 */

import { describe, expect, it } from 'vitest';

import {
  BACKLOG_CAPACITY,
  type ClassificationRecord,
  type LeaseToken,
} from '../../../../src/sync/coordinated/ledger';
import {
  checkTime,
  planRun,
  policyEventCategories,
  recordRunObservations,
  type CheckOutcome,
  type RunPlan,
} from '../../../../src/sync/coordinated/policy';
import {
  OTHER_SEASON,
  commitRequest,
  stagedClassification,
  write,
} from '../ledger/support';
import {
  ANCHOR,
  DAY,
  HOUR,
  SEASON,
  Simulation,
  anchorOf,
  classification,
  failed,
  observed,
  plus,
  quietSeason,
  rev,
  tickAtOrAfter,
  weeklyCalendar,
} from './support';

const A = rev('A');
const B = rev('B');
const allObserved = {
  calendar: {
    status: 'observed' as const,
    revision: rev('calendar-1'),
    anchors: [],
  },
  circuits: observed(rev('circuits-1')),
  participants: observed(rev('participants-1')),
  'driver-standings': observed(rev('driver-standings-1')),
  'constructor-standings': observed(rev('constructor-standings-1')),
};

describe('a failed or cancelled request', () => {
  it('withholds the whole season candidate, while every executed observation is recorded', async () => {
    const calendar = [
      anchorOf(1, ANCHOR),
      anchorOf(2, plus(ANCHOR, 3 * HOUR).toISOString()),
    ];
    const simulation = new Simulation(calendar)
      .script(1, () => observed(A))
      .script(2, () => failed);
    await simulation.tick(plus(ANCHOR, -DAY));
    const tick = await simulation.tick(tickAtOrAfter(plus(ANCHOR, 8 * HOUR)));

    expect(tick.result!.decision).toEqual({
      publishable: false,
      reasons: ['classification-unavailable'],
    });
    expect(simulation.record(1)).toMatchObject({
      contentRevision: A,
      checkIndex: 1,
    });
    expect(simulation.record(2)).toMatchObject({
      contentRevision: null,
      checkIndex: 1,
    });
    expect(simulation.record(1)!.publishedRevision).toBeNull();
  });

  it('leaves unexecuted operations unattempted: no slot consumed, no record created', async () => {
    const simulation = new Simulation([anchorOf(1, ANCHOR)]);
    await simulation.tick(plus(ANCHOR, -DAY));
    const read = await simulation.fixture.ledger.acquireLease(SEASON);
    if (read.outcome !== 'acquired') throw new Error('lease refused');
    const now = tickAtOrAfter(plus(ANCHOR, 5 * HOUR));
    const plan = planRun({
      now,
      snapshot: read.snapshot,
      trigger: 'scheduled',
    });
    if (plan.kind === 'nothing-due') throw new Error('expected work');

    // Cancelled after the calendar: nothing else ran.
    const result = recordRunObservations({
      lease: { season: SEASON, fence: read.lease.fence },
      snapshot: read.snapshot,
      plan,
      now,
      seasonOutcomes: { calendar: allObserved.calendar },
      classificationOutcomes: new Map(),
    });

    expect(result.request.classifications).toEqual([]);
    expect(result.decision).toEqual({
      publishable: false,
      reasons: ['classification-unavailable', 'season-resource-unavailable'],
    });
    const season = result.request.seasonRecord!.record;
    const before = read.snapshot.seasonRecord!.record;
    expect(season.refresh.participants).toEqual(before.refresh.participants);
    expect(season.refresh.calendar.lastSuccessAt).toBe(now.toISOString());
  });
});

describe('the operator backlog capacity', () => {
  async function fullBacklogBut(room: number) {
    const simulation = new Simulation([
      anchorOf(1, ANCHOR),
      anchorOf(2, ANCHOR),
    ]);
    const { ledger, clock } = simulation.fixture;
    clock.set('2026-11-20T00:17:00.000Z');
    const other = await ledger.acquireLease(OTHER_SEASON);
    if (other.outcome !== 'acquired') throw new Error('lease refused');
    const occupied = BACKLOG_CAPACITY - room;
    await ledger.commit(
      commitRequest(
        { season: OTHER_SEASON, fence: other.lease.fence },
        {
          classifications: Array.from({ length: occupied }, (_, index) =>
            write(
              stagedClassification(
                index + 1,
                rev(`other-${index}`),
                OTHER_SEASON,
              ),
            ),
          ),
          backlogInsertions: Array.from({ length: occupied }, (_, index) => ({
            round: index + 1,
            revision: rev(`other-${index}`),
          })),
        },
      ),
    );
    const own = await ledger.acquireLease(SEASON);
    if (own.outcome !== 'acquired') throw new Error('lease refused');
    const token: LeaseToken = { season: SEASON, fence: own.lease.fence };
    const settledPending = (round: number): ClassificationRecord =>
      classification(round, {
        anchor: ANCHOR,
        checkIndex: 4,
        nextDueAt: null,
        contentRevision: A,
        provenance: 'reconciled',
        reviewState: 'settled',
        terminalReason: 'settled',
        settledAt: checkTime(ANCHOR, 4).toISOString(),
        candidateRevision: B,
        candidateFirstSeenAt: '2026-11-10T00:17:00.000Z',
        markers: ['pending'],
      });
    await ledger.commit(
      commitRequest(token, {
        seasonRecord: write(
          quietSeason(simulation.calendar, '2027-01-01T00:00:00.000Z', {
            publicationDueAt: '2026-11-20T00:00:00.000Z',
          }),
        ),
        classifications: [write(settledPending(1)), write(settledPending(2))],
      }),
    );
    const read = await ledger.readSeason(SEASON);
    if (read.outcome !== 'read') throw new Error('read refused');
    return { simulation, token, snapshot: read.snapshot };
  }

  async function stageBoth(room: number) {
    const { simulation, token, snapshot } = await fullBacklogBut(room);
    const now = new Date('2026-11-20T00:17:00.000Z');
    const plan = planRun({ now, snapshot, trigger: 'scheduled' });
    const result = recordRunObservations({
      lease: token,
      snapshot,
      plan: plan as Exclude<RunPlan, { kind: 'nothing-due' }>,
      now,
      seasonOutcomes: allObserved,
      classificationOutcomes: new Map([
        [1, observed(B)],
        [2, observed(B)],
      ]),
    });
    simulation.fixture.clock.set(now.toISOString());
    const committed = await simulation.fixture.ledger.commit(result.request);
    return { result, committed };
  }

  it('lets the earliest round take the last free entry and fails the other closed', async () => {
    const { result, committed } = await stageBoth(1);

    expect(result.request.backlogInsertions).toEqual([
      { round: 1, revision: B },
    ]);
    expect(result.events.map((event) => event.category)).toEqual(
      expect.arrayContaining([
        'classification.staged-correction',
        'classification.backlog-capacity-exceeded',
      ]),
    );
    expect(committed.outcome).toBe('committed');
    if (committed.outcome !== 'committed') return;
    expect(committed.snapshot.backlog.count).toBe(BACKLOG_CAPACITY);
    const round2 = committed.snapshot.classifications[1]!.record;
    expect(round2.stagedCorrection).toBeNull();
    expect(round2.candidateRevision).toBe(B);
    expect(round2.contentRevision).toBe(A);
    expect(result.decision).toEqual({
      publishable: false,
      reasons: ['classification-pending', 'classification-staged'],
    });
  });

  it('stages nothing at all when it is already full, and evicts nothing', async () => {
    const { result, committed } = await stageBoth(0);

    expect(result.request.backlogInsertions).toEqual([]);
    expect(committed.outcome).toBe('committed');
    if (committed.outcome !== 'committed') return;
    expect(committed.snapshot.backlog.count).toBe(BACKLOG_CAPACITY);
    expect(
      committed.snapshot.classifications.map(
        ({ record }) => record.contentRevision,
      ),
    ).toEqual([A, A]);
  });
});

describe('a stale revision (D2.2) under full backfill', () => {
  it('is never applied again, and withholds the season while the source serves it', async () => {
    let answer = A;
    const simulation = new Simulation([anchorOf(1, ANCHOR)]).script(1, () =>
      observed(answer),
    );
    await simulation.tick(plus(ANCHOR, -DAY));
    await simulation.tick(tickAtOrAfter(checkTime(ANCHOR, 1)));
    answer = B;
    await simulation.tick(tickAtOrAfter(checkTime(ANCHOR, 2)));
    const applied = await simulation.tick(tickAtOrAfter(checkTime(ANCHOR, 3)));
    expect(applied.result!.decision).toMatchObject({ publishable: true });

    answer = A;
    for (const slot of [4, 5, 6]) {
      const stale = await simulation.tick(
        tickAtOrAfter(checkTime(ANCHOR, slot)),
      );
      expect(stale.result!.decision).toEqual({
        publishable: false,
        reasons: ['classification-superseded'],
      });
    }
    expect(simulation.record(1)).toMatchObject({
      contentRevision: B,
      publishedRevision: B,
      supersededRevisions: [A],
    });
  });

  it('identical observations are idempotent across runs', async () => {
    const simulation = new Simulation([anchorOf(1, ANCHOR)]).script(1, () =>
      observed(A),
    );
    await simulation.tick(plus(ANCHOR, -DAY));
    await simulation.tick(tickAtOrAfter(checkTime(ANCHOR, 1)));
    const firstObservedAt = simulation.record(1)!.sourceObservedAt;
    await simulation.tick(tickAtOrAfter(checkTime(ANCHOR, 2)));

    expect(simulation.record(1)).toMatchObject({
      contentRevision: A,
      sourceObservedAt: firstObservedAt,
      consecutiveConfirmations: 2,
    });
  });
});

describe('observation runs', () => {
  it('never publish; a changed standings revision makes the next tick a publication run', async () => {
    const simulation = new Simulation([anchorOf(1, ANCHOR)]).script(1, () =>
      observed(A),
    );
    await simulation.run(plus(ANCHOR, -3 * DAY), plus(ANCHOR, 2 * DAY));
    const changeAt = plus(ANCHOR, 3 * DAY + 20 * 60 * 1000);
    simulation.seasonRevision = (resource, now) =>
      observed(
        rev(
          `${resource}-${resource.endsWith('standings') && now >= changeAt ? 2 : 1}`,
        ),
      );
    const ticks = await simulation.run(changeAt, plus(changeAt, 2 * DAY));
    const observation = ticks.find(
      (tick) =>
        tick.plan.kind === 'observation' &&
        tick.plan.refresh.includes('driver-standings'),
    )!;
    const next = ticks[ticks.indexOf(observation) + 1]!;

    expect(observation.result!.decision).toEqual({
      publishable: false,
      reasons: ['not-a-publication-run'],
    });
    expect(observation.snapshot.seasonRecord!.record.publicationDueAt).toBe(
      observation.now.toISOString(),
    );
    expect(next.plan.kind).toBe('publication');
    expect(next.result!.decision).toMatchObject({ publishable: true });
    expect(next.snapshot.seasonRecord!.record.publicationDueAt).toBeNull();
  });
});

describe('a failing bootstrap', () => {
  it('asks for the calendar once per six hours, not on every tick', async () => {
    const simulation = new Simulation([anchorOf(1, ANCHOR)]);
    simulation.seasonRevision = () => failed;
    const start = plus(ANCHOR, -3 * DAY);
    const ticks = await simulation.run(start, plus(start, DAY - 1));

    expect(ticks).toHaveLength(24);
    expect(
      ticks.filter((tick) => tick.plan.kind === 'observation'),
    ).toHaveLength(4);
    expect(
      ticks.every((tick) =>
        tick.plan.kind === 'observation'
          ? tick.plan.bootstrap
          : tick.plan.kind === 'nothing-due',
      ),
    ).toBe(true);
  });
});

describe('full backfill from an empty ledger', () => {
  it('bootstraps, then publishes every eligible round in one run, settling the old ones on deadline', async () => {
    const calendar = weeklyCalendar(23, '2026-03-08T04:00:00.000Z');
    const simulation = new Simulation(calendar);
    for (const entry of calendar) {
      simulation.script(entry.round, () =>
        observed(rev(`round-${entry.round}`)),
      );
    }
    const bootstrap = await simulation.tick(
      new Date('2026-06-21T11:17:00.000Z'),
    );
    const backfill = await simulation.tick(
      new Date('2026-06-21T12:17:00.000Z'),
    );

    expect(bootstrap.plan).toMatchObject({
      kind: 'observation',
      bootstrap: true,
    });
    expect(backfill.plan.providerRequests).toBe(6 + 16);
    expect(backfill.result!.decision).toMatchObject({ publishable: true });
    const records = backfill.snapshot.classifications.map(
      ({ record }) => record,
    );
    expect(records).toHaveLength(16);
    expect(
      records
        .slice(0, 14)
        .every((record) => record.terminalReason === 'settled-on-deadline'),
    ).toBe(true);
    expect(records[15]).toMatchObject({
      reviewState: 'unsettled',
      checkIndex: 1,
    });
    expect(
      records.every(
        (record) => record.publishedRevision === record.contentRevision,
      ),
    ).toBe(true);
  });
});

describe('a manual run', () => {
  it('records observations but moves no due time', async () => {
    const simulation = new Simulation([anchorOf(1, ANCHOR)]).script(1, () =>
      observed(A),
    );
    await simulation.tick(plus(ANCHOR, -DAY));
    const before = simulation.ticks.at(-1)!.snapshot.seasonRecord!.record;
    const manual = await simulation.tick(plus(ANCHOR, 6 * HOUR), 'manual');
    const after = manual.snapshot.seasonRecord!.record;

    expect(manual.result!.decision).toMatchObject({ publishable: true });
    expect(simulation.record(1)).toMatchObject({
      contentRevision: A,
      checkIndex: 0,
      consecutiveConfirmations: 0,
      nextDueAt: checkTime(ANCHOR, 1).toISOString(),
    });
    for (const resource of ['calendar', 'circuits', 'participants'] as const) {
      expect(after.refresh[resource].nextDueAt).toBe(
        before.refresh[resource].nextDueAt,
      );
    }
    expect(after.publicationDueAt).toBe(before.publicationDueAt);
    // The scheduled cadence still runs its own first check.
    const scheduled = await simulation.tick(
      tickAtOrAfter(plus(ANCHOR, 6 * HOUR)),
    );
    expect(
      scheduled.plan.kind === 'publication' && scheduled.plan.checks,
    ).toEqual([
      expect.objectContaining({ round: 1, check: 'cadence', slot: 1 }),
    ]);
  });
});

describe('the events (D2.9)', () => {
  it('carry only a closed category: no season, round, revision, instant or payload', async () => {
    let call = 0;
    const outcomes: CheckOutcome[] = [
      observed(A),
      observed(B),
      failed,
      observed(B),
      observed(rev('C')),
    ];
    const simulation = new Simulation([anchorOf(1, ANCHOR)]).script(
      1,
      () => outcomes[call++ % outcomes.length]!,
    );
    const ticks = await simulation.run(
      plus(ANCHOR, -DAY),
      plus(ANCHOR, 20 * DAY),
    );
    const events = ticks.flatMap((tick) => tick.result?.events ?? []);

    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(Object.keys(event)).toEqual(['category']);
      expect(policyEventCategories).toContain(event.category);
    }
    expect(JSON.stringify(events)).not.toMatch(/sha256|2026|\d{4}-\d{2}/);
  });
});
