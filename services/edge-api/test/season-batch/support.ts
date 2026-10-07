/**
 * Recorded capture fixtures for the season-batch generator.
 *
 * Every body is one of the synthetic Jolpica envelopes the port and
 * coordinated-runtime tests already use, built from committed curated content
 * only. No provider response, private capture or credential is read or
 * written, and nothing here can send a request.
 */

import { createHash } from 'node:crypto';

import {
  circuitsEnvelope,
  fullSeasonCircuitRows,
} from '../providers/jolpica/circuits-support';
import {
  constructorsEnvelope,
  driversEnvelope,
  fullSeasonConstructorRows,
  fullSeasonDriverRows,
} from '../providers/jolpica/participants-support';
import {
  baseRows,
  locatorFor,
  resultsEnvelope,
} from '../providers/jolpica/results-support';
import {
  baseConstructorRows,
  baseDriverRows,
  constructorStandingsEnvelope,
  driverStandingsEnvelope,
  emptyStandingsEnvelope,
} from '../providers/jolpica/standings-support';
import { envelope, fullSeasonRaces } from '../providers/jolpica/support';

export const SEASON = 2026;
export const BASE = `https://api.jolpi.ca/ergast/f1/${SEASON}`;

/**
 * The fixture calendar anchors round `r` at 12:00 UTC on 1 March plus
 * `r - 1` weeks; this instant is 24 hours after round 3, so exactly rounds
 * 1-3 are eligible (anchor + 5 h).
 */
export const OBSERVED_AT = '2026-03-16T12:00:00.000Z';
export const ROUNDS: readonly number[] = [1, 2, 3];
export const COMMIT = 'a'.repeat(40);

export const urls = {
  calendar: `${BASE}/races/?limit=100`,
  circuits: `${BASE}/circuits/?limit=100`,
  drivers: `${BASE}/drivers/?limit=100`,
  constructors: `${BASE}/constructors/?limit=100`,
  driverStandings: `${BASE}/driverstandings/?limit=100`,
  constructorStandings: `${BASE}/constructorstandings/?limit=100`,
  results: (round: number) => `${BASE}/${round}/results/?limit=100`,
} as const;

export interface FixtureResponse {
  readonly url: string;
  readonly file: string;
  status: number;
  contentType: string;
  body: Uint8Array;
}

export interface FixtureCapture {
  season: number;
  observedAt: string;
  classificationRounds: number[];
  responses: FixtureResponse[];
}

function json(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function resultsBody(round: number): unknown {
  const locator = locatorFor(round);
  return resultsEnvelope(baseRows(), {
    round: String(round),
    raceRound: String(round),
    raceName: locator.raceName,
    circuitId: locator.circuitId,
  });
}

function standings(round: number | null): {
  driver: unknown;
  constructor: unknown;
} {
  if (round === null) {
    return {
      driver: emptyStandingsEnvelope('DriverStandings', { round: undefined }),
      constructor: emptyStandingsEnvelope('ConstructorStandings', {
        round: undefined,
      }),
    };
  }
  const value = String(round);
  return {
    driver: driverStandingsEnvelope(baseDriverRows(), {
      round: value,
      listRound: value,
    }),
    constructor: constructorStandingsEnvelope(baseConstructorRows(), {
      round: value,
      listRound: value,
    }),
  };
}

/**
 * A complete, consistent capture: six season-level responses and one race
 * classification per round in `rounds`, with standings bound to the last.
 */
export function fixtureCapture(
  rounds: readonly number[] = ROUNDS,
  observedAt: string = OBSERVED_AT,
): FixtureCapture {
  const table = standings(
    rounds.length === 0 ? null : rounds[rounds.length - 1]!,
  );
  const response = (
    url: string,
    file: string,
    body: unknown,
  ): FixtureResponse => ({
    url,
    file,
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: json(body),
  });
  return {
    season: SEASON,
    observedAt,
    classificationRounds: [...rounds],
    responses: [
      response(urls.calendar, 'calendar.json', envelope(fullSeasonRaces())),
      response(
        urls.circuits,
        'circuits.json',
        circuitsEnvelope(fullSeasonCircuitRows()),
      ),
      response(
        urls.drivers,
        'drivers.json',
        driversEnvelope(fullSeasonDriverRows()),
      ),
      response(
        urls.constructors,
        'constructors.json',
        constructorsEnvelope(fullSeasonConstructorRows()),
      ),
      response(urls.driverStandings, 'driver-standings.json', table.driver),
      response(
        urls.constructorStandings,
        'constructor-standings.json',
        table.constructor,
      ),
      ...rounds.map((round) =>
        response(
          urls.results(round),
          `results-${String(round).padStart(2, '0')}.json`,
          resultsBody(round),
        ),
      ),
    ],
  };
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** The `capture.json` value and the body files a capture directory holds. */
export function captureFiles(capture: FixtureCapture): {
  manifest: Record<string, unknown>;
  bodies: Map<string, Uint8Array>;
} {
  return {
    manifest: {
      kind: 'gridview-jolpica-capture',
      schemaVersion: 1,
      season: capture.season,
      observedAt: capture.observedAt,
      classificationRounds: capture.classificationRounds,
      responses: capture.responses.map((entry) => ({
        url: entry.url,
        status: entry.status,
        contentType: entry.contentType,
        file: entry.file,
        byteLength: entry.body.byteLength,
        sha256: sha256(entry.body),
      })),
    },
    bodies: new Map(capture.responses.map((entry) => [entry.file, entry.body])),
  };
}

/** Generator input for a capture, with fixed provenance. */
export function inputFor(capture: FixtureCapture = fixtureCapture()) {
  const { manifest, bodies } = captureFiles(capture);
  return {
    capture: manifest,
    bodies,
    provenance: { gitCommit: COMMIT, treeClean: true },
  };
}
