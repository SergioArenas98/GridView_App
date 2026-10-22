/**
 * The §10.4.1 classification cadence and the season-level refresh cadences,
 * as pure arithmetic over explicit instants (ADR 0020 §4; Provider Evaluation
 * §10.4, §10.4.1, §11.2), on the polling schedule of ADR 0028 D5.
 *
 * A race classification has at most 25 cadence checks, numbered by slot:
 *
 * - slots 1-10, the **initial window**: hourly, from `anchor` + 1 h 30 min to
 *   `anchor` + 10 h 30 min. Slot 1 is the start of polling, not evidence that
 *   the race has finished: a delayed start, a long race and a late source all
 *   answer "no result yet", and the next slot asks again;
 * - slots 11-12, the **back-off**: `anchor` + 15 and 24 hours;
 * - slots 13-25, the daily checks: `anchor` + 2 to 14 days. Slot 25, at
 *   `anchor + 14 days`, is the ceiling at which the resource settles on
 *   deadline.
 *
 * Not every round takes every slot. A round with no accepted result, or with
 * a differing revision pending, takes **every** slot, so the window asks for
 * it on each hourly tick. A round whose accepted result has nothing pending
 * takes only the **confirmation** slots - 5 and 9 (`anchor` + 5 h 30 min and
 * + 9 h 30 min) and every slot from 11 on - so a published result is not
 * re-read hourly, and it still settles at `+24h`.
 *
 * The anchor is Jolpica's scheduled race **start**, never a first-publication
 * time, so the ceiling is fixed when the race is scheduled. A race the
 * calendar moves while nothing has been observed for it is scheduled again
 * from its new start (`rescheduledClassificationRecord`). Nothing here reads
 * a wall clock: every function takes the instant it reasons about.
 */

import type {
  CalendarAnchor,
  ClassificationRecord,
  LedgerInstant,
} from '../ledger/model';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * The first check, after the scheduled start. The first hourly tick at or
 * after it is the first time a round is asked for.
 */
export const FIRST_CHECK_OFFSET_MS = 90 * MINUTE_MS;

/** The hourly checks of the initial window: slots 1-10. */
export const INITIAL_WINDOW_CHECKS = 10;

/** The back-off checks after the window, in hours after the anchor. */
export const BACKOFF_CHECK_OFFSET_HOURS = [15, 24] as const;

/** The window slots a round whose accepted result has nothing pending takes. */
export const WINDOW_CONFIRMATION_SLOTS: readonly number[] = [5, 9];

/** The deadline ceiling, in days after the anchor (ADR 0020 N4 tunable). */
export const CEILING_DAYS = 14;

/** Slot 25: 10 window checks, 2 back-off checks and 13 daily checks. */
export const FINAL_CHECK_SLOT =
  INITIAL_WINDOW_CHECKS +
  BACKOFF_CHECK_OFFSET_HOURS.length +
  (CEILING_DAYS - 1);

/** The `+24h` check: the settling predicate is never evaluated before it. */
export const SETTLING_FIRST_SLOT =
  INITIAL_WINDOW_CHECKS + BACKOFF_CHECK_OFFSET_HOURS.length;

/** Consecutive checks returning the accepted revision that settle it. */
export const SETTLING_CONFIRMATIONS = 3;

/** How long before a round may be asked for at all: its first check. */
export const ELIGIBILITY_OFFSET_MS = FIRST_CHECK_OFFSET_MS;

/** The slots a round takes: `every` slot, or only the `confirmation` ones. */
export type SlotSet = 'every' | 'confirmation';

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
  if (slot <= INITIAL_WINDOW_CHECKS) {
    return FIRST_CHECK_OFFSET_MS + (slot - 1) * HOUR_MS;
  }
  if (slot <= SETTLING_FIRST_SLOT) {
    const backoff = slot - INITIAL_WINDOW_CHECKS - 1;
    return BACKOFF_CHECK_OFFSET_HOURS[backoff]! * HOUR_MS;
  }
  // Slot 13 is day 2, slot 25 is day 14.
  return (slot - SETTLING_FIRST_SLOT + 1) * DAY_MS;
}

/** Whether a round whose accepted result has nothing pending takes `slot`. */
export function isConfirmationSlot(slot: number): boolean {
  return (
    slot > INITIAL_WINDOW_CHECKS || WINDOW_CONFIRMATION_SLOTS.includes(slot)
  );
}

/**
 * The slots a round takes now: every slot while it has no accepted result or
 * has a differing revision pending, otherwise the confirmation slots.
 */
export function slotSetFor(
  record: Pick<
    ClassificationRecord,
    'contentRevision' | 'candidateRevision'
  > | null,
): SlotSet {
  return record === null ||
    record.contentRevision === null ||
    record.candidateRevision !== null
    ? 'every'
    : 'confirmation';
}

function takes(slot: number, slots: SlotSet): boolean {
  return slots === 'every' || isConfirmationSlot(slot);
}

/** When cadence slot `slot` (1-25) falls due for an anchor. */
export function checkTime(anchor: LedgerInstant, slot: number): Date {
  if (!Number.isInteger(slot) || slot < 1 || slot > FINAL_CHECK_SLOT) {
    throw new RangeError('A cadence slot is an integer from 1 to 25.');
  }
  return new Date(Date.parse(anchor) + offsetMs(slot));
}

/**
 * The latest slot in `slots` whose time has come, or 0 before the first.
 * Missed slots collapse into this one: a late run makes one current check,
 * never a burst.
 */
export function currentSlot(
  anchor: LedgerInstant,
  now: Date,
  slots: SlotSet = 'every',
): number {
  let slot = 0;
  for (let next = 1; next <= FINAL_CHECK_SLOT; next += 1) {
    if (checkTime(anchor, next).getTime() > now.getTime()) break;
    if (takes(next, slots)) slot = next;
  }
  return slot;
}

/**
 * The first slot in `slots` after `checkIndex`, as an instant, or `null`
 * after the last.
 */
export function nextCheckAt(
  anchor: LedgerInstant,
  checkIndex: number,
  slots: SlotSet = 'every',
): LedgerInstant | null {
  for (let next = checkIndex + 1; next <= FINAL_CHECK_SLOT; next += 1) {
    if (takes(next, slots)) return checkTime(anchor, next).toISOString();
  }
  return null;
}

/**
 * A round may be planned only once its first check is due: `anchor` + 1 h
 * 30 min. Before then no race can have a result, and an empty result
 * withholds a run.
 */
export function isEligible(anchor: LedgerInstant, now: Date): boolean {
  return Date.parse(anchor) + ELIGIBILITY_OFFSET_MS <= now.getTime();
}

/**
 * The manual season-batch fallback's capture rule (ADR 0025 D12, PR #73): a
 * capture carries every round whose race started at least five hours before
 * it. It is the runtime's former first check, deliberately left unchanged by
 * ADR 0028 D5 so that a committed batch still reconverts byte for byte; the
 * runtime itself now asks from `anchor` + 1 h 30 min (`isEligible`).
 */
export const BATCH_CAPTURE_OFFSET_MS = 5 * HOUR_MS;

/** Whether a batch captured at `observedAt` must carry this round. */
export function isBatchCaptureEligible(
  anchor: LedgerInstant,
  observedAt: Date,
): boolean {
  return Date.parse(anchor) + BATCH_CAPTURE_OFFSET_MS <= observedAt.getTime();
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
