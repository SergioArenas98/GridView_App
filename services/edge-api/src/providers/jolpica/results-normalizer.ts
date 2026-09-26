/**
 * Turns one decoded Jolpica race classification into the normalized public
 * `RaceResult`.
 *
 * This is the **identity boundary**. The event, every driver and every
 * constructor are resolved through the curated mapping registry only; nothing
 * is derived, minted, folded or guessed from a provider value (ADR 0022 D2, D4,
 * D5). An unresolved identity fails the **whole** resource, and no row is ever
 * dropped from an otherwise accepted one (ADR 0022 D10).
 *
 * It applies the curator decisions recorded in ADR 0023 amendment A2:
 *
 * - **C-1** - a decoded classification is `final`.
 * - **C-2** - the structured status governs a `Lapped` row displayed as `R`:
 *   classified, `lapped`, with its numeric position.
 * - **C-3** - `lapsBehind` is `winnerLaps - laps` for classified lapped rows
 *   only, and is always a positive integer (the decoder refuses anything else).
 * - **C-4** - a classified retirement keeps its position and is `dnf`, with no
 *   time and no gap.
 * - **C-6** - the grid slot is the provider's positive slot or `null`.
 * - **C-7** - the fastest-lap time is the exact parsed value or `null`.
 * - **C-8** - every temporal gap is `null`, and `gapText` is never copied.
 *
 * **What it deliberately does not produce.** No `DriverSeasonEntry`, no
 * `ConstructorSeasonEntry`, no participation span and no `hasResults` value:
 * participation is derived by season assembly from selected classifications
 * (ADR 0026 D3-D7, D11), and `hasResults` is assembly-owned (ADR 0022 A7).
 */

import type { FinishStatus } from '../../contract/enums';
import {
  canonicalGrandPrixId,
  canonicalRaceResultId,
} from '../../contract/identity';
import type { RaceResult, RaceResultEntry } from '../../contract/types';
import type {
  ProviderMappingFailure,
  ProviderMappingRegistry,
} from '../mappings';
import { maxReportedMappingFailures } from './calendar-normalizer';
import type {
  DecodedRaceResult,
  DecodedResultRow,
  ResultRowClass,
} from './results-payload';
import { classifiedRowClasses } from './results-payload';

/** Why a resolved classification still could not be normalized. Closed. */
export type ResultsNormalizationProblem =
  /**
   * Two distinct provider driver identities resolved to one canonical driver.
   * One classification holding a driver twice is a contradictory resource,
   * not two rows to merge.
   */
  | 'duplicate-canonical-driver'
  /**
   * The document states fastest-lap blocks but no rank-1 lap, so it names no
   * session fastest lap it could be attributed to.
   */
  | 'fastest-lap-unattributed';

export type ResultsNormalization =
  | { readonly ok: true; readonly result: RaceResult }
  | {
      readonly ok: false;
      readonly kind: 'mapping';
      readonly failures: readonly ProviderMappingFailure[];
    }
  | {
      readonly ok: false;
      readonly kind: 'contradiction';
      readonly problem: ResultsNormalizationProblem;
    };

/** The contract status each approved row class carries. Total over the table. */
const finishStatuses: Record<ResultRowClass, FinishStatus> = {
  finished: 'finished',
  lapped: 'lapped',
  'lapped-display-retired': 'lapped',
  'retired-classified': 'dnf',
  retired: 'dnf',
  'did-not-start': 'dns',
};

interface ResolvedRow {
  readonly row: DecodedResultRow;
  readonly driverId: string;
  readonly constructorId: string;
}

/**
 * Resolves and normalizes one complete race classification for `season`.
 *
 * Every identity is attempted even after the first failure, so an operator
 * sees the bounded set to curate rather than one at a time - but no partial
 * result is ever produced.
 */
export function normalizeRaceResults(
  race: DecodedRaceResult,
  season: number,
  registry: ProviderMappingRegistry,
): ResultsNormalization {
  const failures: ProviderMappingFailure[] = [];
  const addFailure = (failure: ProviderMappingFailure): void => {
    if (failures.length < maxReportedMappingFailures) failures.push(failure);
  };

  // The event is resolved from the response's own locator, never from the
  // request alone: the locator carries the round, so an answer for another
  // round cannot resolve to the requested event.
  const event = registry.resolve({
    season,
    source: 'jolpica',
    entity: 'event',
    providerField: 'eventLocator',
    providerValue: {
      round: race.round,
      raceName: race.raceName,
      circuitId: race.circuitId,
    },
  });
  if (event.outcome === 'unresolved') addFailure(event.failure);

  const resolved: ResolvedRow[] = [];
  for (const row of race.rows) {
    const driver = registry.resolve({
      season,
      source: 'jolpica',
      entity: 'driver',
      providerField: 'driverId',
      providerValue: row.driverId,
    });
    const constructor = registry.resolve({
      season,
      source: 'jolpica',
      entity: 'constructor',
      providerField: 'constructorId',
      providerValue: row.constructorId,
    });
    if (driver.outcome === 'unresolved') addFailure(driver.failure);
    if (constructor.outcome === 'unresolved') addFailure(constructor.failure);
    if (driver.outcome === 'resolved' && constructor.outcome === 'resolved') {
      resolved.push({
        row,
        driverId: driver.gridviewId,
        constructorId: constructor.gridviewId,
      });
    }
  }
  if (failures.length > 0 || event.outcome === 'unresolved') {
    return { ok: false, kind: 'mapping', failures };
  }

  const seen = new Set<string>();
  for (const entry of resolved) {
    if (seen.has(entry.driverId)) {
      return {
        ok: false,
        kind: 'contradiction',
        problem: 'duplicate-canonical-driver',
      };
    }
    seen.add(entry.driverId);
  }

  const fastest = resolved.filter((entry) => entry.row.fastestLap?.rank === 1);
  const anyFastestLapBlock = resolved.some(
    (entry) => entry.row.fastestLap !== null,
  );
  // Ranks are unique (the decoder refuses a repeat), so at most one row holds
  // rank 1. Blocks with no rank-1 lap cannot say who set the fastest lap.
  const fastestEntry = fastest[0];
  if (anyFastestLapBlock && fastestEntry === undefined) {
    return {
      ok: false,
      kind: 'contradiction',
      problem: 'fastest-lap-unattributed',
    };
  }

  // The decoder guarantees the `finished` row at position 1 exists.
  const winner = race.rows.find(
    (row) => row.position === 1,
  ) as DecodedResultRow;
  const grandPrixId = canonicalGrandPrixId(season, event.gridviewId);

  return {
    ok: true,
    result: {
      id: canonicalRaceResultId(grandPrixId, 'race'),
      season,
      round: race.round,
      grandPrixId,
      sessionType: 'race',
      // C-1: a curator decision on Jolpica's reconciled role, not a finality
      // marker carried by the payload.
      status: 'final',
      entries: resolved.map((entry) =>
        normalizedEntry(entry, winner, anyFastestLapBlock),
      ),
      fastestLap:
        fastestEntry === undefined || fastestEntry.row.fastestLap === null
          ? null
          : {
              driverId: fastestEntry.driverId,
              timeMillis: fastestEntry.row.fastestLap.timeMillis,
              lap: fastestEntry.row.fastestLap.lap,
            },
    },
  };
}

function normalizedEntry(
  entry: ResolvedRow,
  winner: DecodedResultRow,
  anyFastestLapBlock: boolean,
): RaceResultEntry {
  const { row } = entry;
  const classified = classifiedRowClasses.has(row.rowClass);
  const lapped =
    row.rowClass === 'lapped' || row.rowClass === 'lapped-display-retired';
  return {
    driverId: entry.driverId,
    constructorId: entry.constructorId,
    position: classified ? row.position : null,
    gridPosition: row.grid,
    points: row.points,
    status: finishStatuses[row.rowClass],
    laps: row.laps,
    // Only the winner's elapsed time is published. Every other row's provider
    // time is a car's own total over its own laps, and is never turned into a
    // gap (C-3, C-4, C-8).
    elapsedTimeMillis: row === winner ? row.elapsedMillis : null,
    gapToLeaderMillis: null,
    lapsBehind: lapped ? winner.laps - row.laps : null,
    // With no fastest-lap block anywhere, the document says nothing about who
    // set it, so no row is told it did not.
    fastestLap: anyFastestLapBlock ? row.fastestLap?.rank === 1 : null,
    dnfReason: null,
    gapText: null,
  };
}
