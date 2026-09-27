/**
 * The G5 event-aware due-work planner (decision pack §5.2, §6.3; runtime
 * activation decisions O-3, O-7 and O-8).
 *
 * `planRun` is deterministic and pure: the same instant and ledger snapshot
 * always give the same plan. It reads no clock, sends nothing and writes
 * nothing. A plan is one of:
 *
 * - **nothing due**: no provider request at all;
 * - **an observation run**: only the due season-level resources among the
 *   calendar and both standings. It never publishes; a changed revision makes
 *   a publication due at the next tick;
 * - **a publication run**: the five season-level resources (six requests) and
 *   one race classification per selected round.
 *
 * Rounds and anchors come from the ledger's **last observed** calendar, never
 * from a calendar read in the same run. With no observed calendar the only
 * possible plan is a bootstrap calendar observation.
 *
 * A round is never planned before `anchor + 5h`, whatever the trigger. The
 * selected rounds are every round with a recorded (accepted) classification,
 * plus every round with a cadence check due now (O-3). Missed checks collapse
 * into one current check; there is no catch-up burst.
 *
 * A manual run is a forced publication run over every eligible round (O-8). It
 * follows the same eligibility, cannot name a round, ignores the limiter's
 * deferral (the limiter itself still decides) and consumes no due slot.
 *
 * Planning target only (O-7): the eventual cron is hourly at minute 17. The
 * planner does not depend on the cron; the committed cron is unchanged.
 */

import type {
  CalendarAnchor,
  ClassificationRecord,
  LedgerSnapshot,
  RefreshResource,
} from '../ledger/model';
import { currentSlot, isEligible } from './cadence';

export type RunTrigger = 'scheduled' | 'manual';

type SeasonResourceKind =
  | 'season-calendar'
  | 'season-circuits'
  | 'season-participants'
  | 'driver-standings'
  | 'constructor-standings';

/**
 * One planned request, spelled in the coordinator's resource vocabulary so it
 * is structurally a `CoordinatedResource`. Declared here rather than imported,
 * so the policy depends on no provider module.
 */
export type PlannedResource =
  | { readonly kind: SeasonResourceKind; readonly season: number }
  | {
      readonly kind: 'session-classification';
      readonly season: number;
      readonly round: number;
      readonly sessionType: 'race';
    };

export type PlannedCheck =
  | {
      readonly round: number;
      readonly anchor: CalendarAnchor;
      readonly check: 'cadence';
      readonly slot: number;
    }
  | {
      readonly round: number;
      readonly anchor: CalendarAnchor;
      readonly check: 'reread' | 'manual';
    };

export type RunPlan =
  | {
      readonly kind: 'nothing-due';
      readonly season: number;
      readonly trigger: RunTrigger;
      readonly reason: 'no-work' | 'limiter-deferred';
      readonly resources: readonly [];
      readonly providerRequests: 0;
    }
  | {
      readonly kind: 'observation';
      readonly season: number;
      readonly trigger: RunTrigger;
      readonly advancesSchedule: boolean;
      /** No calendar has been observed: this run observes only it. */
      readonly bootstrap: boolean;
      readonly refresh: readonly RefreshResource[];
      readonly resources: readonly PlannedResource[];
      readonly providerRequests: number;
    }
  | {
      readonly kind: 'publication';
      readonly season: number;
      readonly trigger: RunTrigger;
      readonly advancesSchedule: boolean;
      readonly refresh: readonly RefreshResource[];
      readonly checks: readonly PlannedCheck[];
      readonly resources: readonly PlannedResource[];
      readonly providerRequests: number;
    };

export interface PlanInput {
  readonly now: Date;
  readonly snapshot: LedgerSnapshot;
  readonly trigger: RunTrigger;
}

/** Every publication run observes all five, in this order. */
const publicationRefresh: readonly RefreshResource[] = [
  'calendar',
  'circuits',
  'participants',
  'driver-standings',
  'constructor-standings',
];

/** Observation runs carry only these, and only when due. */
const observationRefresh: readonly RefreshResource[] = [
  'calendar',
  'driver-standings',
  'constructor-standings',
];

/** Refresh resources whose due time makes a publication run (§6.1). */
const publicationTriggers: readonly RefreshResource[] = [
  'circuits',
  'participants',
];

/** Modelled requests per resource: participants is drivers + constructors. */
const requestsPer: Readonly<Record<RefreshResource, number>> = {
  calendar: 1,
  circuits: 1,
  participants: 2,
  'driver-standings': 1,
  'constructor-standings': 1,
};

const resourceKinds: Readonly<Record<RefreshResource, SeasonResourceKind>> = {
  calendar: 'season-calendar',
  circuits: 'season-circuits',
  participants: 'season-participants',
  'driver-standings': 'driver-standings',
  'constructor-standings': 'constructor-standings',
};

function seasonResources(
  season: number,
  refresh: readonly RefreshResource[],
): PlannedResource[] {
  return refresh.map((resource) => ({ kind: resourceKinds[resource], season }));
}

function modelledRequests(refresh: readonly RefreshResource[]): number {
  return refresh.reduce((total, resource) => total + requestsPer[resource], 0);
}

function isDue(dueAt: string | null, now: Date): boolean {
  return dueAt === null || Date.parse(dueAt) <= now.getTime();
}

/** The slot a scheduled run should serve now, or `null` if none is due. */
export function dueSlot(
  record: ClassificationRecord | null,
  anchor: CalendarAnchor,
  now: Date,
): number | null {
  if (record !== null && record.terminalReason !== null) return null;
  const slot = currentSlot(anchor.anchor, now);
  return slot > (record?.checkIndex ?? 0) ? slot : null;
}

/** The latest limiter deferral any record carries. */
function deferredUntil(snapshot: LedgerSnapshot): number {
  return snapshot.classifications.reduce((latest, { record }) => {
    const until = record.limiterDeferralUntil;
    return until === null ? latest : Math.max(latest, Date.parse(until));
  }, Number.NEGATIVE_INFINITY);
}

/** The anchor a round is scheduled from: its record's, else the calendar's. */
function anchorsByRound(
  calendar: readonly CalendarAnchor[],
  records: ReadonlyMap<number, ClassificationRecord>,
): CalendarAnchor[] {
  const anchors = new Map(calendar.map((entry) => [entry.round, entry]));
  for (const [round, record] of records) {
    anchors.set(round, {
      round,
      anchor: record.anchor,
      anchorKind: record.anchorKind,
    });
  }
  return [...anchors.values()].sort((left, right) => left.round - right.round);
}

function selectChecks(
  input: PlanInput,
  calendar: readonly CalendarAnchor[],
): PlannedCheck[] {
  const records = new Map(
    input.snapshot.classifications.map(({ record }) => [record.round, record]),
  );
  const checks: PlannedCheck[] = [];
  for (const anchor of anchorsByRound(calendar, records)) {
    if (!isEligible(anchor.anchor, input.now)) continue;
    const round = anchor.round;
    if (input.trigger === 'manual') {
      checks.push({ round, anchor, check: 'manual' });
      continue;
    }
    const record = records.get(round) ?? null;
    const slot = dueSlot(record, anchor, input.now);
    if (slot !== null) {
      checks.push({ round, anchor, check: 'cadence', slot });
    } else if (record?.contentRevision != null) {
      checks.push({ round, anchor, check: 'reread' });
    }
  }
  return checks;
}

export function planRun(input: PlanInput): RunPlan {
  const { now, snapshot, trigger } = input;
  const season = snapshot.season;
  const advancesSchedule = trigger === 'scheduled';
  const seasonRecord = snapshot.seasonRecord?.record ?? null;
  const calendar = seasonRecord?.calendarAnchors ?? null;

  if (calendar === null) {
    const refresh: RefreshResource[] = ['calendar'];
    return {
      kind: 'observation',
      season,
      trigger,
      advancesSchedule,
      bootstrap: true,
      refresh,
      resources: seasonResources(season, refresh),
      providerRequests: modelledRequests(refresh),
    };
  }

  if (trigger === 'scheduled' && deferredUntil(snapshot) > now.getTime()) {
    return nothingDue(season, trigger, 'limiter-deferred');
  }

  const checks = selectChecks(input, calendar);
  const refreshDue = (resource: RefreshResource): boolean =>
    isDue(seasonRecord!.refresh[resource].nextDueAt, now);
  const publication =
    trigger === 'manual' ||
    checks.some((check) => check.check === 'cadence') ||
    publicationTriggers.some(refreshDue) ||
    (seasonRecord!.publicationDueAt !== null &&
      isDue(seasonRecord!.publicationDueAt, now));

  if (publication) {
    const resources = [
      ...seasonResources(season, publicationRefresh),
      ...checks.map((check): PlannedResource => ({
        kind: 'session-classification',
        season,
        round: check.round,
        sessionType: 'race',
      })),
    ];
    return {
      kind: 'publication',
      season,
      trigger,
      advancesSchedule,
      refresh: publicationRefresh,
      checks,
      resources,
      providerRequests: modelledRequests(publicationRefresh) + checks.length,
    };
  }

  const refresh = observationRefresh.filter(refreshDue);
  if (refresh.length === 0) return nothingDue(season, trigger, 'no-work');
  return {
    kind: 'observation',
    season,
    trigger,
    advancesSchedule,
    bootstrap: false,
    refresh,
    resources: seasonResources(season, refresh),
    providerRequests: modelledRequests(refresh),
  };
}

function nothingDue(
  season: number,
  trigger: RunTrigger,
  reason: 'no-work' | 'limiter-deferred',
): RunPlan {
  return {
    kind: 'nothing-due',
    season,
    trigger,
    reason,
    resources: [],
    providerRequests: 0,
  };
}
