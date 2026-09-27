/**
 * Fixtures for the D14/D15 participation-guard tests: normalized
 * `grand-prix:{round}:results` documents built directly, so each test states
 * exactly the rounds and facts it means. Nothing here reads storage, a
 * sequencer or a provider.
 */

import type { ResultStatus } from '../../../src/contract/enums';
import type { RaceResult, RaceResultEntry } from '../../../src/contract/types';
import type {
  SnapshotDocumentName,
  StoredSnapshot,
} from '../../../src/storage/types';

export const SEASON = 2026;

/** One complete normalized result row. Only the two IDs are guard inputs. */
export function entry(
  driverId: string,
  constructorId: string,
  position: number | null = null,
): RaceResultEntry {
  return {
    driverId,
    constructorId,
    position,
    gridPosition: position,
    points: position === null ? null : Math.max(0, 26 - position),
    status: 'finished',
    laps: 53,
    elapsedTimeMillis: null,
    gapToLeaderMillis: null,
    lapsBehind: null,
    fastestLap: false,
    dnfReason: null,
    gapText: null,
  };
}

export function raceResult(
  round: number,
  status: ResultStatus,
  entries: readonly RaceResultEntry[],
  overrides: Partial<RaceResult> = {},
): RaceResult {
  const grandPrixId = `2026-round-${round}-grand-prix`;
  return {
    id: `${grandPrixId}-race-results`,
    season: SEASON,
    round,
    grandPrixId,
    sessionType: 'race',
    status,
    entries: [...entries],
    fastestLap: null,
    ...overrides,
  };
}

export function stored(documentName: string, data: unknown): StoredSnapshot {
  return {
    data,
    meta: {
      apiVersion: '1',
      schemaVersion: 1,
      generatedAt: '2026-07-20T12:00:00.000Z',
      sourceUpdatedAt: '2026-07-20T00:00:00.000Z',
      staleAfter: '2026-07-21T12:00:00.000Z',
      contentVersion: '2026.07.20.1',
      season: SEASON,
    },
    documentName: documentName as SnapshotDocumentName,
    resourceIdentity: `v1:${SEASON}:${documentName}`,
  };
}

/** A classified (`final`) round with one row per `[driver, constructor]`. */
export function classifiedRound(
  round: number,
  facts: readonly (readonly [string, string])[],
  status: ResultStatus = 'final',
): StoredSnapshot {
  return stored(
    `grand-prix:${round}:results`,
    raceResult(
      round,
      status,
      facts.map(([driver, constructor], index) =>
        entry(driver, constructor, index + 1),
      ),
    ),
  );
}

/** A round whose race has not produced a classification. */
export function unavailableRound(round: number): StoredSnapshot {
  return stored(
    `grand-prix:${round}:results`,
    raceResult(round, 'unavailable', []),
  );
}

/** A non-results document every release carries; never a guard input. */
export function calendarDocument(): StoredSnapshot {
  return stored('calendar', { items: [] });
}

export const ROUND_ONE: readonly (readonly [string, string])[] = [
  ['max-verstappen', 'red-bull'],
  ['lando-norris', 'mclaren'],
  ['oscar-piastri', 'mclaren'],
];

export const ROUND_TWO: readonly (readonly [string, string])[] = [
  ['charles-leclerc', 'ferrari'],
  ['lewis-hamilton', 'ferrari'],
];
