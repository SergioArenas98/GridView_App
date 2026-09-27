/**
 * Synthetic clocks, calendars, ledger snapshots and a tick simulator for the
 * reconciliation policy and planner tests.
 *
 * The simulator drives the pure planner and policy over the real C1 store, in
 * memory, on the planned hourly cadence (minute 17, decision O-7). Every
 * provider answer is scripted; nothing contacts a provider or Cloudflare.
 */

import type {
  CalendarAnchor,
  ClassificationRecord,
  LedgerSnapshot,
  RefreshResource,
  SeasonRecord,
  Versioned,
} from '../../../../src/sync/coordinated/ledger';
import {
  planRun,
  recordRunObservations,
  type CheckOutcome,
  type RunObservationResult,
  type RunPlan,
  type RunTrigger,
  type SeasonOutcomes,
} from '../../../../src/sync/coordinated/policy';
import {
  SEASON,
  classification,
  ledgerFixture,
  rev,
  seasonRecord,
  type LedgerFixture,
} from '../ledger/support';

export { SEASON, classification, rev, seasonRecord };

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** A race start: Sunday 2026-10-04 at 13:00 UTC. */
export const ANCHOR = '2026-10-04T13:00:00.000Z';

export function anchorOf(
  round: number,
  anchor: string,
  anchorKind: CalendarAnchor['anchorKind'] = 'date-time',
): CalendarAnchor {
  return { round, anchor, anchorKind };
}

export function plus(instant: string | Date, millis: number): Date {
  const base =
    typeof instant === 'string' ? Date.parse(instant) : instant.getTime();
  return new Date(base + millis);
}

/** The first hourly tick at minute 17 at or after `instant`. */
export function tickAtOrAfter(instant: Date): Date {
  const tick = new Date(instant.getTime());
  tick.setUTCMinutes(17, 0, 0);
  if (tick.getTime() < instant.getTime()) {
    tick.setUTCHours(tick.getUTCHours() + 1);
  }
  return tick;
}

/** A calendar of `count` weekly races, round 1 at `first`. */
export function weeklyCalendar(count: number, first: string): CalendarAnchor[] {
  return Array.from({ length: count }, (_, index) =>
    anchorOf(index + 1, plus(first, index * 7 * DAY).toISOString()),
  );
}

const futureRefresh = (dueAt: string) => ({
  observedRevision: rev('observed'),
  lastAttemptedAt: '2026-01-01T00:00:00.000Z',
  lastSuccessAt: '2026-01-01T00:00:00.000Z',
  nextDueAt: dueAt,
});

/**
 * A season record whose calendar is observed and whose every refresh is due
 * only at `dueAt`, so a test turns on exactly the work it means to.
 */
export function quietSeason(
  calendar: readonly CalendarAnchor[],
  dueAt: string,
  overrides: Partial<Record<keyof SeasonRecord, unknown>> = {},
): SeasonRecord {
  return seasonRecord({
    calendarAnchors: calendar,
    refresh: {
      calendar: futureRefresh(dueAt),
      circuits: futureRefresh(dueAt),
      'constructor-standings': futureRefresh(dueAt),
      'driver-standings': futureRefresh(dueAt),
      participants: futureRefresh(dueAt),
    },
    ...overrides,
  });
}

export function versioned<T>(record: T, version = 1): Versioned<T> {
  return { version, record };
}

/** A synthetic snapshot, as the store would answer it. */
export function snapshotOf(
  parts: {
    season?: SeasonRecord | null;
    classifications?: readonly ClassificationRecord[];
    backlogCount?: number;
  } = {},
): LedgerSnapshot {
  return {
    season: SEASON,
    seasonRecord: parts.season ? versioned(parts.season) : null,
    classifications: [...(parts.classifications ?? [])]
      .sort((left, right) => left.round - right.round)
      .map((record) => versioned(record)),
    published: null,
    lease: null,
    backlog: { count: parts.backlogCount ?? 0, capacity: 60, entries: [] },
  };
}

/** Deep-freezes a value, so a test proves the code under it never mutates. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

export const observed = (revision: string): CheckOutcome => ({
  status: 'observed',
  revision,
});
export const failed: CheckOutcome = { status: 'failed' };

/** Answers one round's classification at an instant. */
export type RoundScript = (now: Date) => CheckOutcome;

export interface TickResult {
  readonly now: Date;
  readonly plan: RunPlan;
  readonly result: RunObservationResult | null;
  readonly snapshot: LedgerSnapshot;
}

/**
 * Runs the planner and policy on the real store. A publishable candidate is
 * treated as applied: the authority's revisions are reconciled into the
 * ledger's cache, as the runtime will once it exists.
 */
export class Simulation {
  readonly fixture: LedgerFixture = ledgerFixture();
  readonly scripts = new Map<number, RoundScript>();
  readonly ticks: TickResult[] = [];
  seasonRevision: (resource: RefreshResource, now: Date) => CheckOutcome = (
    resource,
  ) => observed(rev(`${resource}-1`));
  private releases = 0;

  constructor(public calendar: CalendarAnchor[]) {}

  script(round: number, script: RoundScript): this {
    this.scripts.set(round, script);
    return this;
  }

  async tick(
    now: Date,
    trigger: RunTrigger = 'scheduled',
  ): Promise<TickResult> {
    this.fixture.clock.set(now.toISOString());
    const acquired = await this.fixture.ledger.acquireLease(SEASON);
    if (acquired.outcome !== 'acquired') throw new Error('lease refused');
    const lease = { season: SEASON, fence: acquired.lease.fence };
    const plan = planRun({ now, snapshot: acquired.snapshot, trigger });
    let result: RunObservationResult | null = null;
    if (plan.kind !== 'nothing-due') {
      const seasonOutcomes: Record<string, unknown> = {};
      for (const resource of plan.refresh) {
        const outcome = this.seasonRevision(resource, now);
        seasonOutcomes[resource] =
          resource === 'calendar' && outcome.status === 'observed'
            ? { ...outcome, anchors: this.calendar }
            : outcome;
      }
      const classificationOutcomes = new Map<number, CheckOutcome>();
      if (plan.kind === 'publication') {
        for (const check of plan.checks) {
          const script = this.scripts.get(check.round);
          classificationOutcomes.set(
            check.round,
            script === undefined ? failed : script(now),
          );
        }
      }
      result = recordRunObservations({
        lease,
        snapshot: acquired.snapshot,
        plan,
        now,
        seasonOutcomes: seasonOutcomes as SeasonOutcomes,
        classificationOutcomes,
      });
      const committed = await this.fixture.ledger.commit(result.request);
      if (committed.outcome !== 'committed') {
        throw new Error(`commit refused: ${JSON.stringify(committed)}`);
      }
      if (result.decision.publishable) {
        this.releases += 1;
        await this.fixture.ledger.reconcilePublishedRevisions({
          lease,
          activeVersion: `v-${this.releases}`,
          revisions: result.decision.rounds.map(({ round, revision }) => ({
            round,
            revision,
          })),
        });
      }
    }
    await this.fixture.ledger.releaseLease(lease);
    const read = await this.fixture.ledger.readSeason(SEASON);
    if (read.outcome !== 'read') throw new Error('read refused');
    const tick = { now, plan, result, snapshot: read.snapshot };
    this.ticks.push(tick);
    return tick;
  }

  /** Every hourly tick at minute 17 from `from` up to and including `until`. */
  async run(from: Date, until: Date): Promise<TickResult[]> {
    const ticks: TickResult[] = [];
    for (
      let now = tickAtOrAfter(from);
      now.getTime() <= until.getTime();
      now = plus(now, HOUR)
    ) {
      ticks.push(await this.tick(now));
    }
    return ticks;
  }

  record(
    round: number,
    snapshot?: LedgerSnapshot,
  ): ClassificationRecord | null {
    const source = snapshot ?? this.ticks.at(-1)?.snapshot;
    return (
      source?.classifications.find((entry) => entry.record.round === round)
        ?.record ?? null
    );
  }
}

/** The cadence slots a round was checked at, across the given ticks. */
export function cadenceSlots(
  ticks: readonly TickResult[],
  round: number,
): number[] {
  return ticks.flatMap((tick) =>
    tick.plan.kind === 'publication'
      ? tick.plan.checks
          .filter((check) => check.round === round && check.check === 'cadence')
          .map((check) => (check.check === 'cadence' ? check.slot : 0))
      : [],
  );
}
