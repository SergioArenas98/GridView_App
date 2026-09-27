/**
 * The §10.4.1 classification cadence and the season-level refresh cadences,
 * as pure arithmetic over explicit instants (ADR 0020 §4; Provider Evaluation
 * §10.4, §10.4.1, §11.2).
 *
 * A race classification has at most 17 cadence checks, numbered by slot:
 *
 * - slots 1-4, the dense checks: `anchor` + 5, 9, 15 and 24 hours;
 * - slots 5-17, the daily checks: `anchor` + 2 to 14 days. Slot 17, at
 *   `anchor + 14 days`, is the ceiling at which the resource settles on
 *   deadline.
 *
 * The anchor is Jolpica's scheduled race **start**, never a first-publication
 * time, so the ceiling is fixed when the race is scheduled. Nothing here reads
 * a wall clock: every function takes the instant it reasons about.
 */

import type { CalendarAnchor, LedgerInstant } from '../ledger/model';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** The dense checks, in hours after the anchor. */
export const DENSE_CHECK_OFFSET_HOURS = [5, 9, 15, 24] as const;

/** The deadline ceiling, in days after the anchor (ADR 0020 N4 tunable). */
export const CEILING_DAYS = 14;

/** Slot 17: 4 dense checks and 13 daily checks, days 2 to 14. */
export const FINAL_CHECK_SLOT =
  DENSE_CHECK_OFFSET_HOURS.length + (CEILING_DAYS - 1);

/** The `+24h` check: the settling predicate is never evaluated before it. */
export const SETTLING_FIRST_SLOT = DENSE_CHECK_OFFSET_HOURS.length;

/** Consecutive checks returning the accepted revision that settle it. */
export const SETTLING_CONFIRMATIONS = 3;

/** How long before a round may be asked for at all: its first check. */
export const ELIGIBILITY_OFFSET_MS = DENSE_CHECK_OFFSET_HOURS[0] * HOUR_MS;

/**
 * Season-level refresh intervals (Evaluation §11.2; decision pack §6.1).
 * Standings are daily while the season runs and weekly outside it.
 */
export const REFRESH_INTERVAL_MS = {
  calendar: 6 * HOUR_MS,
  circuits: 7 * DAY_MS,
  participants: 7 * DAY_MS,
  standingsInSeason: DAY_MS,
  standingsOffSeason: 7 * DAY_MS,
} as const;

function offsetMs(slot: number): number {
  if (slot <= DENSE_CHECK_OFFSET_HOURS.length) {
    return DENSE_CHECK_OFFSET_HOURS[slot - 1]! * HOUR_MS;
  }
  // Slot 5 is day 2, slot 17 is day 14.
  return (slot - DENSE_CHECK_OFFSET_HOURS.length + 1) * DAY_MS;
}

/** When cadence slot `slot` (1-17) falls due for an anchor. */
export function checkTime(anchor: LedgerInstant, slot: number): Date {
  if (!Number.isInteger(slot) || slot < 1 || slot > FINAL_CHECK_SLOT) {
    throw new RangeError('A cadence slot is an integer from 1 to 17.');
  }
  return new Date(Date.parse(anchor) + offsetMs(slot));
}

/**
 * The latest slot whose time has come, or 0 before the first. Missed slots
 * collapse into this one: a late run makes one current check, never a burst.
 */
export function currentSlot(anchor: LedgerInstant, now: Date): number {
  let slot = 0;
  for (let next = 1; next <= FINAL_CHECK_SLOT; next += 1) {
    if (checkTime(anchor, next).getTime() > now.getTime()) break;
    slot = next;
  }
  return slot;
}

/** The slot after `checkIndex`, as an instant, or `null` after the last. */
export function nextCheckAt(
  anchor: LedgerInstant,
  checkIndex: number,
): LedgerInstant | null {
  return checkIndex >= FINAL_CHECK_SLOT
    ? null
    : checkTime(anchor, checkIndex + 1).toISOString();
}

/**
 * A round may be planned only once its first check is due: `anchor + 5h`.
 * Before then Jolpica has no result, and an empty result withholds a run.
 */
export function isEligible(anchor: LedgerInstant, now: Date): boolean {
  return Date.parse(anchor) + ELIGIBILITY_OFFSET_MS <= now.getTime();
}

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const utcTimePattern = /^\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/**
 * The Jolpica anchor for one race (Evaluation §10.4): its `date` and UTC
 * `time`, or its `date` at 23:59:59 UTC when the time is absent. `null` when
 * either half is malformed; nothing else is substituted.
 */
export function calendarAnchor(
  round: number,
  date: string,
  time: string | null,
): CalendarAnchor | null {
  if (!calendarDatePattern.test(date)) return null;
  if (time !== null && !utcTimePattern.test(time)) return null;
  const parsed = Date.parse(`${date}T${time ?? '23:59:59Z'}`);
  if (Number.isNaN(parsed)) return null;
  const anchor = new Date(parsed).toISOString();
  // A rolled-over impossible date (February 30th) is refused, not moved.
  if (anchor.slice(0, 10) !== date) return null;
  return {
    round,
    anchor,
    anchorKind: time === null ? 'date-eod' : 'date-time',
  };
}

/**
 * Standings are refreshed daily from the first race until the final race's
 * ceiling, and weekly otherwise.
 */
export function standingsIntervalMs(
  anchors: readonly CalendarAnchor[] | null,
  now: Date,
): number {
  if (anchors === null || anchors.length === 0) {
    return REFRESH_INTERVAL_MS.standingsOffSeason;
  }
  const first = Math.min(...anchors.map((entry) => Date.parse(entry.anchor)));
  const last = Math.max(...anchors.map((entry) => Date.parse(entry.anchor)));
  const at = now.getTime();
  return at >= first && at <= last + CEILING_DAYS * DAY_MS
    ? REFRESH_INTERVAL_MS.standingsInSeason
    : REFRESH_INTERVAL_MS.standingsOffSeason;
}
