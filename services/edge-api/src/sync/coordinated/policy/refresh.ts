/**
 * Season-level refresh state (runtime activation decision O-4).
 *
 * The calendar, circuits, participants and both standings are **refresh
 * resources**: an identical revision is idempotent (D2.6), a differing one
 * overwrites and raises the overwrite event (D2.7), and nothing corroborates
 * or settles. A failed request records the attempt and nothing else; a
 * deferred or cancelled one records nothing.
 *
 * Due times advance only on a run that advances the schedule, never on a
 * manual run (O-8). Everything here is pure: the instant is an input.
 */

import {
  LEDGER_SCHEMA_VERSION,
  refreshResources,
  type CalendarAnchor,
  type RefreshRecord,
  type RefreshResource,
  type SeasonRecord,
} from '../ledger/model';
import { REFRESH_INTERVAL_MS, standingsIntervalMs } from './cadence';
import type { CheckOutcome } from './classification';
import { policyEvent, type PolicyEvent } from './events';

/** The calendar is the one refresh resource that carries more than a revision. */
export type CalendarOutcome =
  | {
      readonly status: 'observed';
      readonly revision: string;
      readonly anchors: readonly CalendarAnchor[];
    }
  | Exclude<CheckOutcome, { readonly status: 'observed' }>;

export type SeasonOutcomes = Readonly<
  Partial<Record<Exclude<RefreshResource, 'calendar'>, CheckOutcome>> & {
    readonly calendar?: CalendarOutcome;
  }
>;

export interface SeasonStepInput {
  readonly season: number;
  readonly outcomes: SeasonOutcomes;
  readonly now: Date;
  readonly runKind: 'observation' | 'publication';
  /** False for a manual run: it moves no due time (O-8). */
  readonly advancesSchedule: boolean;
}

export interface SeasonStep {
  readonly record: SeasonRecord;
  readonly events: readonly PolicyEvent[];
}

const emptyRefresh: RefreshRecord = {
  observedRevision: null,
  lastAttemptedAt: null,
  lastSuccessAt: null,
  nextDueAt: null,
};

export function newSeasonRecord(season: number): SeasonRecord {
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    kind: 'season',
    season,
    refresh: {
      calendar: emptyRefresh,
      circuits: emptyRefresh,
      'constructor-standings': emptyRefresh,
      'driver-standings': emptyRefresh,
      participants: emptyRefresh,
    },
    publicationDueAt: null,
    calendarAnchors: null,
    lastOrderingInput: null,
    lastPublication: null,
    publicationDisposition: null,
    operatorHold: null,
    durableBlock: null,
    lastOperatorAction: null,
  };
}

function intervalMs(
  resource: RefreshResource,
  anchors: readonly CalendarAnchor[] | null,
  now: Date,
): number {
  switch (resource) {
    case 'calendar':
      return REFRESH_INTERVAL_MS.calendar;
    case 'circuits':
      return REFRESH_INTERVAL_MS.circuits;
    case 'participants':
      return REFRESH_INTERVAL_MS.participants;
    case 'driver-standings':
    case 'constructor-standings':
      return standingsIntervalMs(anchors, now);
  }
}

/** Anchors sorted by round, as the record requires. */
function sortedAnchors(
  anchors: readonly CalendarAnchor[],
): readonly CalendarAnchor[] {
  return [...anchors]
    .map((entry) => ({ ...entry }))
    .sort((left, right) => left.round - right.round);
}

export function applySeasonObservations(
  current: SeasonRecord | null,
  input: SeasonStepInput,
): SeasonStep {
  const at = input.now.toISOString();
  const previous = current ?? newSeasonRecord(input.season);
  const events: PolicyEvent[] = [];
  const calendar = input.outcomes.calendar;
  const calendarAnchors =
    calendar?.status === 'observed'
      ? sortedAnchors(calendar.anchors)
      : previous.calendarAnchors;

  let changed = false;
  const refresh = { ...previous.refresh };
  for (const resource of refreshResources) {
    const outcome = input.outcomes[resource];
    if (outcome === undefined) continue;
    const before = previous.refresh[resource];
    if (outcome.status === 'not-attempted' || outcome.status === 'deferred') {
      events.push(
        policyEvent(
          outcome.status === 'deferred'
            ? 'refresh.deferred'
            : 'refresh.not-attempted',
        ),
      );
      continue;
    }
    const nextDueAt = input.advancesSchedule
      ? new Date(
          input.now.getTime() +
            intervalMs(resource, calendarAnchors, input.now),
        ).toISOString()
      : before.nextDueAt;
    if (outcome.status === 'failed') {
      refresh[resource] = { ...before, lastAttemptedAt: at, nextDueAt };
      events.push(policyEvent('refresh.failed'));
      continue;
    }
    if (before.observedRevision === null) {
      events.push(policyEvent('refresh.first-observation'));
      changed = true;
    } else if (before.observedRevision !== outcome.revision) {
      events.push(policyEvent('refresh.overwrite'));
      changed = true;
    } else {
      events.push(policyEvent('refresh.unchanged'));
    }
    refresh[resource] = {
      observedRevision: outcome.revision,
      lastAttemptedAt: at,
      lastSuccessAt: at,
      nextDueAt,
    };
  }

  return {
    record: {
      ...previous,
      refresh,
      calendarAnchors,
      publicationDueAt: nextPublicationDue(previous, input, changed, at),
    },
    events,
  };
}

/**
 * An observation run never publishes: a changed season-level revision makes
 * a publication due at the next tick. A scheduled publication run serves the
 * due publication. A manual run moves neither (O-8).
 */
function nextPublicationDue(
  previous: SeasonRecord,
  input: SeasonStepInput,
  changed: boolean,
  at: string,
): string | null {
  if (!input.advancesSchedule) return previous.publicationDueAt;
  if (input.runKind === 'publication') return null;
  if (!changed) return previous.publicationDueAt;
  return previous.publicationDueAt ?? at;
}
