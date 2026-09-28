/**
 * What each planned request produced, in the C2 policy's closed vocabulary
 * (decision pack §6.6 step 5; §11 failure model).
 *
 * One rule decides everything here: **only a completed request is a check**.
 *
 * - A selected candidate is `observed`, under the revision `revisions.ts`
 *   computes for it.
 * - A request that was sent and failed - an upstream error, a timeout, a
 *   `429`, an invalid payload, an unresolved identity - is `failed`: the
 *   policy records the attempt and changes no revision, count or review
 *   state (T6).
 * - A limiter deferral is `deferred` with its `retryAt`, and nothing else.
 *   A cancellation, a limiter that could not answer, or a resource that was
 *   never reached is `not-attempted`. Neither counts as a check. That includes
 *   a multi-request execution interrupted by one of them after an earlier
 *   request of the same execution was sent: the execution did not complete.
 *
 * A coordinator-side defect - an adapter that threw, a malformed answer, a
 * violated invariant, a missing coordination - and a selected payload that
 * cannot be hashed or anchored are not provider outcomes at all. The whole
 * mapping is refused, and the run commits nothing.
 */

import {
  attemptedFailureReasons,
  coordinationFor,
  type CoordinatedResource,
  type CoordinationRun,
  type ResourceCoordination,
  type SourceContribution,
} from '../../../providers/coordination';
import type { RefreshResource } from '../ledger/model';
import type {
  CalendarOutcome,
  CheckOutcome,
  PlannedResource,
  SeasonOutcomes,
} from '../policy';
import {
  calendarAnchorsOf,
  classificationRevision,
  refreshRevision,
} from './revisions';

export type ObservationMapping =
  | {
      readonly kind: 'mapped';
      readonly seasonOutcomes: SeasonOutcomes;
      /** By round. */
      readonly classificationOutcomes: ReadonlyMap<number, CheckOutcome>;
    }
  | {
      readonly kind: 'refused';
      readonly reason: 'coordination-defect' | 'selection-malformed';
    };

const refreshResourceOf: Readonly<
  Partial<Record<PlannedResource['kind'], RefreshResource>>
> = {
  'season-calendar': 'calendar',
  'season-circuits': 'circuits',
  'season-participants': 'participants',
  'driver-standings': 'driver-standings',
  'constructor-standings': 'constructor-standings',
};

const notAttempted: CheckOutcome = { status: 'not-attempted' };
const failed: CheckOutcome = { status: 'failed' };

/** A limiter deferral, if its `retryAt` is an instant; otherwise not attempted. */
function deferral(retryAt: string | null): CheckOutcome {
  const at = retryAt === null ? Number.NaN : Date.parse(retryAt);
  return Number.isNaN(at)
    ? notAttempted
    : { status: 'deferred', retryAt: new Date(at).toISOString() };
}

/** The outcome of an unselected Jolpica contribution, or `null` for a defect. */
function unselectedOutcome(
  contribution: SourceContribution,
): CheckOutcome | null {
  switch (contribution.status) {
    case 'deferred':
      return deferral(contribution.retryAt);
    case 'skipped':
      // Nothing left GridView: cancelled, limiter unavailable, or refused by
      // policy before any request.
      return notAttempted;
    case 'interrupted':
      return contribution.reason === 'rate-limit-deferred'
        ? deferral(contribution.retryAt)
        : notAttempted;
    case 'failed':
      if (!contribution.attempted) return null;
      if (contribution.reason === 'mapping-unresolved') return failed;
      return (attemptedFailureReasons as readonly unknown[]).includes(
        contribution.reason,
      )
        ? failed
        : null;
    case 'candidate':
      // A candidate that was not selected cannot happen with one source.
      return null;
  }
}

type ResourceOutcome =
  | {
      readonly kind: 'outcome';
      readonly outcome: CheckOutcome | CalendarOutcome;
    }
  | {
      readonly kind: 'refused';
      readonly reason: 'coordination-defect' | 'selection-malformed';
    };

async function outcomeOf(
  resource: PlannedResource,
  coordination: ResourceCoordination,
): Promise<ResourceOutcome> {
  const selection = coordination.selection;
  if (selection.outcome === 'unavailable') {
    const jolpica = coordination.contributions.filter(
      (contribution) => contribution.source === 'jolpica',
    );
    const outcome =
      jolpica.length === 1 ? unselectedOutcome(jolpica[0]!) : null;
    return outcome === null
      ? { kind: 'refused', reason: 'coordination-defect' }
      : { kind: 'outcome', outcome };
  }
  if (selection.source !== 'jolpica') {
    return { kind: 'refused', reason: 'coordination-defect' };
  }
  const payload = selection.payload;
  const malformed = { kind: 'refused', reason: 'selection-malformed' } as const;
  if (resource.kind === 'session-classification') {
    if (
      payload.kind !== 'session-classification' ||
      payload.result.round !== resource.round ||
      payload.result.season !== resource.season
    ) {
      return malformed;
    }
    return {
      kind: 'outcome',
      outcome: {
        status: 'observed',
        revision: await classificationRevision(payload.result),
      },
    };
  }
  const revision = await refreshRevision(payload);
  if (revision === null || payload.kind !== resource.kind) return malformed;
  if (resource.kind !== 'season-calendar') {
    return { kind: 'outcome', outcome: { status: 'observed', revision } };
  }
  const anchors = calendarAnchorsOf(payload, resource.season);
  return anchors === null
    ? malformed
    : { kind: 'outcome', outcome: { status: 'observed', revision, anchors } };
}

/** Maps one coordination run onto the outcomes of the plan it executed. */
export async function observationOutcomes(
  resources: readonly PlannedResource[],
  run: CoordinationRun,
): Promise<ObservationMapping> {
  const season: Partial<
    Record<RefreshResource, CheckOutcome | CalendarOutcome>
  > = {};
  const classifications = new Map<number, CheckOutcome>();
  for (const resource of resources) {
    const coordination = coordinationFor(run, resource as CoordinatedResource);
    if (coordination === undefined) {
      return { kind: 'refused', reason: 'coordination-defect' };
    }
    const mapped = await outcomeOf(resource, coordination);
    if (mapped.kind === 'refused') return mapped;
    if (resource.kind === 'session-classification') {
      classifications.set(resource.round, mapped.outcome as CheckOutcome);
    } else {
      season[refreshResourceOf[resource.kind]!] = mapped.outcome;
    }
  }
  return {
    kind: 'mapped',
    seasonOutcomes: season as SeasonOutcomes,
    classificationOutcomes: classifications,
  };
}
