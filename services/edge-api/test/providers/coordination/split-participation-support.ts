/**
 * A synthetic, authored season with a real-shaped mid-season split.
 *
 * It mirrors the **shape** ADR 0026 records for 2026 (its 2026-09-26 note):
 * `liam-lawson` races for `racing-bulls` through round 11 and for `red-bull`
 * from round 12, `yuki-tsunoda` joins `racing-bulls` at round 12 and
 * `isack-hadjar`'s `red-bull` span ends at round 11. Nothing here is provider
 * data: no captured response or bulk copy of its rows is used, the rows are
 * written by hand, and no span is derived from anything - the spans are
 * authored next to the rows so both integrity directions can be exercised.
 *
 * The calendar reuses the mock provider's five events (their identities and
 * sessions are unchanged) at rounds 1, 11, 12, 13 and 14. Rounds 1 and 11-13
 * carry a final race classification; round 14 is unclassified. The rounds in
 * between are simply absent from this calendar: round accounting (ADR 0026 D4)
 * belongs to span derivation, which does not exist yet.
 */

import {
  canonicalDriverSeasonEntryId,
  canonicalRaceResultId,
} from '../../../src/contract/identity';
import type {
  DriverSeasonEntry,
  RaceResult,
  RaceResultEntry,
} from '../../../src/contract/types';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import { seasonFixture, SEASON } from './support';

/** The rounds the synthetic calendar uses, in calendar order. */
export const SPLIT_ROUNDS = [1, 11, 12, 13, 14] as const;
/** The rounds that carry a final race classification. */
export const SPLIT_CLASSIFIED_ROUNDS = [1, 11, 12, 13] as const;

/** One authored span, carrying its ADR 0026 D7 identity. */
export function splitEntry(
  driverId: string,
  constructorId: string,
  startRound: number | null,
  endRound: number | null,
): DriverSeasonEntry {
  return {
    id: canonicalDriverSeasonEntryId(SEASON, driverId, startRound),
    season: SEASON,
    driverId,
    constructorId,
    raceNumber: null,
    role: 'race',
    shortCode: null,
    startRound,
    endRound,
  };
}

/** The authored spans, in the order a source would list them. */
export function splitDriverEntries(): DriverSeasonEntry[] {
  return [
    splitEntry('max-verstappen', 'red-bull', null, null),
    splitEntry('isack-hadjar', 'red-bull', null, 11),
    splitEntry('liam-lawson', 'racing-bulls', null, 11),
    splitEntry('liam-lawson', 'red-bull', 12, null),
    splitEntry('yuki-tsunoda', 'racing-bulls', 12, null),
  ];
}

/** Who raced for whom in one classified round of the synthetic season. */
function lineupFor(round: number): readonly [string, string][] {
  return round <= 11
    ? [
        ['max-verstappen', 'red-bull'],
        ['liam-lawson', 'racing-bulls'],
        ['isack-hadjar', 'red-bull'],
      ]
    : [
        ['max-verstappen', 'red-bull'],
        ['liam-lawson', 'red-bull'],
        ['yuki-tsunoda', 'racing-bulls'],
      ];
}

/** One hand-written classified row. Only the participation fields matter. */
export function splitRow(
  driverId: string,
  constructorId: string,
  position: number,
): RaceResultEntry {
  return {
    driverId,
    constructorId,
    position,
    gridPosition: position,
    points: null,
    status: 'finished',
    laps: null,
    elapsedTimeMillis: null,
    gapToLeaderMillis: null,
    lapsBehind: null,
    fastestLap: null,
    dnfReason: null,
    gapText: null,
  };
}

/**
 * The synthetic split season. Every relation `validateSeasonReferences` knows
 * holds on it; tests break exactly one thing at a time.
 */
export async function splitSeasonFixture(): Promise<ProviderSeasonSource> {
  const base = await seasonFixture();
  if (base.calendar.length !== SPLIT_ROUNDS.length) {
    throw new Error('fixture gap: the mock calendar changed size');
  }
  const classified = new Set<number>(SPLIT_CLASSIFIED_ROUNDS);
  const calendar = base.calendar.map((event, index) => {
    const round = SPLIT_ROUNDS[index]!;
    return {
      ...event,
      round,
      status: classified.has(round) ? ('completed' as const) : event.status,
      hasResults: classified.has(round),
    };
  });
  const results: RaceResult[] = calendar.map((event) => ({
    id: canonicalRaceResultId(event.id, 'race'),
    season: SEASON,
    round: event.round,
    grandPrixId: event.id,
    sessionType: 'race',
    status: event.hasResults ? 'final' : 'unavailable',
    entries: event.hasResults
      ? lineupFor(event.round).map(([driverId, constructorId], index) =>
          splitRow(driverId, constructorId, index + 1),
        )
      : [],
    fastestLap: null,
  }));
  return {
    ...base,
    calendar,
    results,
    driverEntries: splitDriverEntries(),
  };
}

/** A copy of `source` with its driver entries replaced. */
export function withDriverEntries(
  source: ProviderSeasonSource,
  driverEntries: readonly DriverSeasonEntry[],
): ProviderSeasonSource {
  return { ...source, driverEntries: [...driverEntries] };
}

/** A copy of `source` with the rows of one round's race classification mapped. */
export function withRoundRows(
  source: ProviderSeasonSource,
  round: number,
  map: (entries: readonly RaceResultEntry[]) => RaceResultEntry[],
): ProviderSeasonSource {
  return {
    ...source,
    results: source.results.map((result) =>
      result.round === round && result.sessionType === 'race'
        ? { ...result, entries: map(result.entries) }
        : result,
    ),
  };
}
