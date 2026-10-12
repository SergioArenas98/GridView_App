import type { GrandPrix } from '../contract/types';

/**
 * Where each event of a season stands at one reference instant, for the
 * season-level summaries the generator derives (Home and `Season.currentRound`).
 *
 * The rule mirrors the client's shared chronology
 * (`lib/features/shared/domain/relevant_event.dart`) and ADR 0022 A9:
 *
 * - An event is **settled** when its status is authoritatively `completed` or
 *   assembly found a classified race result for it (`hasResults`, A7).
 *   Settling never rewrites the status: an `unknown` event stays `unknown`.
 * - An **authoritative** status (anything but `unknown`) keeps the rule the
 *   generator always applied: every event that is not settled is still part
 *   of the season ahead, whatever the clock says.
 * - An `unknown` status (A6) is placed by explicit chronology only: the race
 *   session's own UTC start instant; failing that, the published weekend
 *   dates; failing both, its position after the last event known to be
 *   behind the reference instant. No date, time or status is manufactured,
 *   and elapsed time never makes an event completed.
 */
export interface SeasonChronology {
  /**
   * Events still ahead or in progress, in delivered (round) order. The first
   * is the next race; the generator never re-sorts it.
   */
  ahead: GrandPrix[];
  /** The last event, in delivered order, with a result or a completed status. */
  latestSettled: GrandPrix | null;
  /** The event Home features: next race, else latest settled, else none. */
  featured: GrandPrix | null;
}

export function resolveSeasonChronology(
  events: readonly GrandPrix[],
  referenceInstant: string,
): SeasonChronology {
  const at = Date.parse(referenceInstant);
  const today = new Date(at).toISOString().slice(0, 10);
  const horizon = horizonRound(events, at, today);
  const ahead = events.filter(
    (event) =>
      !isSettled(event) &&
      (event.status !== 'unknown' || isAhead(event, at, today, horizon)),
  );
  const latestSettled = events.filter(isSettled).at(-1) ?? null;
  return {
    ahead,
    latestSettled,
    featured: ahead[0] ?? latestSettled ?? authoritativeLast(events),
  };
}

/** Whether an event has a classified race result or an authoritative completion. */
export function isSettled(event: GrandPrix): boolean {
  return event.status === 'completed' || event.hasResults;
}

/**
 * The explicit UTC start instant, in epoch milliseconds, of the event's race
 * session, or `null` when the event carries no timed race session.
 */
export function raceStartOf(event: GrandPrix): number | null {
  for (const session of event.sessions) {
    if (session.type !== 'race' || session.status === 'cancelled') continue;
    if (session.startTime === null) continue;
    const instant = Date.parse(session.startTime);
    if (!Number.isNaN(instant)) return instant;
  }
  return null;
}

function isAhead(
  event: GrandPrix,
  at: number,
  today: string,
  horizon: number,
): boolean {
  const raceStart = raceStartOf(event);
  if (raceStart !== null) return raceStart > at;
  const lastDay = calendarDate(event.endDate) ?? calendarDate(event.startDate);
  if (lastDay !== null) return lastDay >= today;
  return event.round > horizon;
}

/**
 * The highest round already behind the reference instant: settled, or with an
 * explicit race start or published last day before it. An event without any
 * chronology of its own is only placed ahead when it follows this round.
 */
function horizonRound(
  events: readonly GrandPrix[],
  at: number,
  today: string,
): number {
  let horizon = 0;
  for (const event of events) {
    if (isSettled(event) || isBehind(event, at, today)) {
      horizon = Math.max(horizon, event.round);
    }
  }
  return horizon;
}

function isBehind(event: GrandPrix, at: number, today: string): boolean {
  const raceStart = raceStartOf(event);
  if (raceStart !== null) return raceStart <= at;
  const lastDay = calendarDate(event.endDate) ?? calendarDate(event.startDate);
  return lastDay !== null && lastDay < today;
}

/**
 * The generator's historical end-of-season fallback, kept for authoritative
 * statuses only: an `unknown` final event is never featured on elapsed time.
 */
function authoritativeLast(events: readonly GrandPrix[]): GrandPrix | null {
  const last = events.at(-1);
  return last !== undefined && last.status !== 'unknown' ? last : null;
}

function calendarDate(value: string | null): string | null {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
