/**
 * Ordering and selection over a season's driver participation spans.
 *
 * A driver may hold several `DriverSeasonEntry` rows in one season: a
 * mid-season move or a return is a new span, never a mutation of the earlier
 * one (GridView_Domain_Model.md §6.7, ADR 0026 D5). Two questions follow, and
 * each has exactly one answer here so the season Drivers collection and the
 * driver detail can never disagree about them:
 *
 * - **Transport order.** Every span is published as its own row. Drivers keep
 *   the repository's primary order - the position of their first entry - and a
 *   driver's spans follow one another chronologically.
 * - **The current span.** Driver detail is singular: it carries the open span
 *   (`endRound === null`) when there is one, otherwise the span with the latest
 *   effective start.
 *
 * A null `startRound` is the start of the season's observed scope (ADR 0026
 * D6), so it sorts before every numbered round. Nothing here validates spans:
 * inverted, overlapping or ambiguous spans are refused by `driver-entry-span`
 * before publication, and selection throws rather than guessing if one ever
 * reaches it.
 */

import type { DriverSeasonEntry } from './types';

/** The span's effective start: a null start is the season start. */
function effectiveStart(entry: DriverSeasonEntry): number {
  return entry.startRound ?? Number.NEGATIVE_INFINITY;
}

/** Chronological order of two spans by their effective start. */
function byEffectiveStart(
  left: DriverSeasonEntry,
  right: DriverSeasonEntry,
): number {
  const a = effectiveStart(left);
  const b = effectiveStart(right);
  return a === b ? 0 : a < b ? -1 : 1;
}

/**
 * A season's entries in transport order: drivers in the order of their first
 * entry, each driver's spans chronologically.
 *
 * Every entry is kept - nothing is grouped, merged or dropped - so a driver with
 * two spans appears twice. The result is a new array; the input is untouched.
 */
export function orderSeasonDriverEntries(
  entries: readonly DriverSeasonEntry[],
): DriverSeasonEntry[] {
  const firstIndex = new Map<string, number>();
  entries.forEach((entry, index) => {
    if (!firstIndex.has(entry.driverId)) firstIndex.set(entry.driverId, index);
  });
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (left, right) =>
        firstIndex.get(left.entry.driverId)! -
          firstIndex.get(right.entry.driverId)! ||
        byEffectiveStart(left.entry, right.entry) ||
        left.index - right.index,
    )
    .map(({ entry }) => entry);
}

/**
 * The one span driver detail reports for `driverId`, or `null` when the driver
 * has no span in the season.
 *
 * 1. The unique open span (`endRound === null`).
 * 2. Otherwise the span with the latest effective start.
 *
 * The answer never depends on the order of `entries`. Two open spans, or two
 * closed spans sharing the latest start, have no single answer; the overlap
 * rule already refuses both, so reaching either here is a defect and throws
 * instead of publishing an arbitrary pick.
 */
export function selectCurrentDriverEntry(
  entries: readonly DriverSeasonEntry[],
  driverId: string,
): DriverSeasonEntry | null {
  const spans = entries.filter((entry) => entry.driverId === driverId);
  if (spans.length === 0) return null;
  const open = spans.filter((entry) => entry.endRound === null);
  if (open.length > 1) {
    throw new Error('Ambiguous current driver season entry: two open spans.');
  }
  if (open.length === 1) return open[0]!;
  const latest = [...spans].sort(byEffectiveStart);
  const last = latest.at(-1)!;
  const previous = latest.at(-2);
  if (previous !== undefined && byEffectiveStart(previous, last) === 0) {
    throw new Error(
      'Ambiguous current driver season entry: two spans share a start.',
    );
  }
  return last;
}
