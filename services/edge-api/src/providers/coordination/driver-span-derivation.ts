/**
 * Driver participation spans, derived by season assembly from the race
 * classifications it selected (ADR 0026 D3-D8, D11).
 *
 * **Assembly owns this, not a port.** The participants port contributes
 * identities and constructor entries only, and an empty `driverEntries`
 * (ADR 0026 D11). Spans are rebuilt here, from scratch, from the exact rows
 * assembly publishes as race classifications, so published participation and
 * published results cannot disagree (D5).
 *
 * **Pure and total.** Nothing is read from a clock, a calendar status, a
 * standings table, an identity list, an earlier publication or a provider
 * payload, and no input is mutated. The same selected classifications always
 * give the same entries in the same order, whatever order their rows arrive
 * in.
 *
 * **Fail closed on round accounting (D4).** A calendar round at or before the
 * latest selected classified race round that is not itself a selected
 * classified race round is *unaccounted*: its result is missing, unavailable
 * or unknown, and no accepted curated cancellation record exists to skip it.
 * Deriving across it would bridge an unobserved round, so no entry is derived
 * at all and the unaccounted rounds are reported instead. Rounds after that
 * latest round are future: they never close a span. The authoritative
 * snapshot's half of the coverage horizon (D14) is not read here; that guard
 * is a separate, unimplemented publication prerequisite (D12 item 10).
 */

import { canonicalDriverSeasonEntryId } from '../../contract/identity';
import type { DriverSeasonEntry, RaceResult } from '../../contract/types';
import { isClassifiedResult } from './season-integrity';

export type DriverSpanDerivation =
  | { readonly outcome: 'derived'; readonly entries: DriverSeasonEntry[] }
  | {
      readonly outcome: 'unaccounted-rounds';
      /** Ascending calendar rounds that would otherwise be bridged. */
      readonly rounds: readonly number[];
    };

/** Code-unit order, never locale order, so the result is platform-stable. */
function compareText(left: string, right: string): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

/**
 * Derives the complete `driverEntries` collection for one season.
 *
 * Only a **race** classification whose status is `final` or `provisional`
 * (`isClassifiedResult`, the same classified-round set the integrity relations
 * use) is an observation. Every row of it is a participation fact, whatever its
 * finishing status, including a `Did not start` row (D3). Sprint, qualifying
 * and unavailable classifications contribute nothing.
 *
 * A span is a maximal run of consecutive classified rounds in which one driver
 * is observed for one constructor (D5):
 *
 * - a constructor change ends one run and starts another (rule 3);
 * - an absence at a later classified round ends the run at the driver's
 *   previous observed round (rule 4);
 * - a return starts a new run, even for the same constructor (rule 5).
 *
 * Contradictory input is not repaired: two constructors for one driver in one
 * round produce two overlapping runs, which the `driver-entry-span` and
 * `result-entry-span` relations then refuse (D5 rule 9).
 *
 * Field policy (D6-D8): `startRound` is null when the run begins at the
 * season's first classified round, else that run's first round; `endRound` is
 * null when the run reaches the latest classified round, whatever the calendar
 * says, else that run's last round. `id` follows D7, `role` is `race`, and
 * `raceNumber` and `shortCode` are null.
 *
 * Order: `driverId`, then start round, then `constructorId` (the last only
 * breaks the tie contradictory input creates), all in code-unit order.
 */
export function deriveDriverSeasonEntries(
  season: number,
  calendarRounds: readonly number[],
  classifications: readonly RaceResult[],
): DriverSpanDerivation {
  const observed = classifications.filter(
    (result) =>
      result.sessionType === 'race' && isClassifiedResult(result.status),
  );
  const rounds = [...new Set(observed.map((result) => result.round))].sort(
    (left, right) => left - right,
  );
  if (rounds.length === 0) return { outcome: 'derived', entries: [] };

  const firstRound = rounds[0]!;
  const latestRound = rounds.at(-1)!;
  const classified = new Set(rounds);
  const unaccounted = [...new Set(calendarRounds)]
    .filter((round) => round <= latestRound && !classified.has(round))
    .sort((left, right) => left - right);
  if (unaccounted.length > 0) {
    return { outcome: 'unaccounted-rounds', rounds: unaccounted };
  }

  // One set of observed rounds per (driver, constructor) seat. A `Map` keyed
  // by the pair, never by a joined string, so no separator can be ambiguous.
  const seats = new Map<string, Map<string, Set<number>>>();
  for (const result of observed) {
    for (const row of result.entries) {
      const byConstructor =
        seats.get(row.driverId) ?? new Map<string, Set<number>>();
      const seen = byConstructor.get(row.constructorId) ?? new Set<number>();
      seen.add(result.round);
      byConstructor.set(row.constructorId, seen);
      seats.set(row.driverId, byConstructor);
    }
  }

  const spans: {
    driverId: string;
    constructorId: string;
    start: number;
    end: number;
  }[] = [];
  for (const [driverId, byConstructor] of seats) {
    for (const [constructorId, seen] of byConstructor) {
      let start: number | null = null;
      let end = 0;
      // Walk the accounted classified rounds, not the integers between them:
      // continuity is adjacency in that sequence (D5 rule 2), and the check
      // above guarantees no calendar round inside it is unobserved.
      for (const round of rounds) {
        if (seen.has(round)) {
          start ??= round;
          end = round;
        } else if (start !== null) {
          spans.push({ driverId, constructorId, start, end });
          start = null;
        }
      }
      if (start !== null) spans.push({ driverId, constructorId, start, end });
    }
  }

  spans.sort(
    (left, right) =>
      compareText(left.driverId, right.driverId) ||
      left.start - right.start ||
      compareText(left.constructorId, right.constructorId),
  );

  const entries = spans.map((span): DriverSeasonEntry => {
    const startRound = span.start === firstRound ? null : span.start;
    return {
      id: canonicalDriverSeasonEntryId(season, span.driverId, startRound),
      season,
      driverId: span.driverId,
      constructorId: span.constructorId,
      raceNumber: null,
      role: 'race',
      shortCode: null,
      startRound,
      endRound: span.end === latestRound ? null : span.end,
    };
  });
  return { outcome: 'derived', entries };
}
