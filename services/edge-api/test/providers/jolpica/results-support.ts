/**
 * Fixtures and doubles for the Jolpica race-results port tests.
 *
 * **Nothing here is a preserved provider response**, and no captured row is
 * copied. Every envelope is a small synthetic classification whose *shapes*
 * are traceable to the 2026 rounds 1-14 capture (ADR 0023 amendment A2 cites
 * it by SHA-256): the six `status` / `positionText` pairs, a `Time` block with
 * `millis` and display text, an empty `time` on a classified retirement, and a
 * `FastestLap` block whose time is `m:ss.sss` text with no millis. Every value -
 * laps, points, times, grid slots, positions - is invented. Provider identities
 * and the event locator are read from the committed curated mapping file, and
 * the synthetic descriptive fields beside them are obviously fake.
 *
 * **Nothing here can reach the network.** The limiter and transport are the
 * in-memory scripted doubles the participants tests use.
 */

import { CapturingLogger } from '../../../src/logging/logger';
import type { RealProviderSourceId } from '../../../src/providers/http/reservation-engine';
import { JolpicaResultsPort } from '../../../src/providers/jolpica';
import {
  providerMappingRegistry,
  type ProviderMappingRegistry,
} from '../../../src/providers/mappings';
import {
  SeamedClient,
  curatedConstructorMappings,
  curatedDriverMappings,
  scriptedLimiter,
  scriptedTransport,
  type ReservationStep,
  type TransportStep,
} from './participants-support';
import {
  LIMIT,
  SEASON,
  curatedEventLocators,
  type TransportRecord,
} from './support';

export const ROUND = 1;

export const resultsUrl = (round: number = ROUND): string =>
  `https://api.jolpi.ca/ergast/f1/${SEASON}/${round}/results/?limit=${LIMIT}`;

/** The curated locator of `round`, read from committed content. */
export function locatorFor(round: number = ROUND) {
  const locator = curatedEventLocators().find((entry) => entry.round === round);
  if (locator === undefined) throw new Error(`no curated locator ${round}`);
  return locator;
}

/** The provider identities of the first `count` curated drivers. */
export function providerDrivers(count: number): readonly string[] {
  return curatedDriverMappings()
    .slice(0, count)
    .map((mapping) => mapping.providerValue);
}

/** The provider identities of the curated constructors. */
export function providerConstructors(): readonly string[] {
  return curatedConstructorMappings().map((mapping) => mapping.providerValue);
}

/** The canonical id of a curated driver, by provider identity. */
export function canonicalDriver(providerValue: string): string {
  const mapping = curatedDriverMappings().find(
    (entry) => entry.providerValue === providerValue,
  );
  if (mapping === undefined) throw new Error('unmapped fixture driver');
  return mapping.gridviewId;
}

/**
 * Synthetic descriptive fields shaped like the ones Jolpica publishes beside
 * the identities. Every value is obviously invented, so a leak is unmistakable.
 */
export const syntheticResultMarkers: readonly string[] = [
  'Synthetic Provider',
  'example.invalid',
  'ZZZ',
];

export interface RowFixture {
  readonly driverId: unknown;
  readonly constructorId: unknown;
  readonly position: unknown;
  readonly positionText: unknown;
  readonly status: unknown;
  readonly points?: unknown;
  readonly grid?: unknown;
  readonly laps: unknown;
  /** `undefined` omits the block. */
  readonly Time?: unknown;
  /** `undefined` omits the block. */
  readonly FastestLap?: unknown;
}

/** One provider result row, with synthetic descriptive fields beside it. */
export function resultRow(fixture: RowFixture): Record<string, unknown> {
  const row: Record<string, unknown> = {
    number: '999',
    position: fixture.position,
    positionText: fixture.positionText,
    points: 'points' in fixture ? fixture.points : '0',
    Driver: {
      driverId: fixture.driverId,
      code: 'ZZZ',
      url: 'https://example.invalid/synthetic-driver',
      givenName: 'Synthetic Provider Given',
      familyName: 'Synthetic Provider Family',
    },
    Constructor: {
      constructorId: fixture.constructorId,
      url: 'https://example.invalid/synthetic-constructor',
      name: 'Synthetic Provider Constructor',
    },
    laps: fixture.laps,
    status: fixture.status,
  };
  if ('grid' in fixture) {
    if (fixture.grid !== undefined) row.grid = fixture.grid;
  } else {
    row.grid = String(fixture.position);
  }
  if (fixture.Time !== undefined) row.Time = fixture.Time;
  if (fixture.FastestLap !== undefined) row.FastestLap = fixture.FastestLap;
  return row;
}

export const WINNER_LAPS = 50;
export const WINNER_MILLIS = 5_400_000;

/**
 * The synthetic classification every case starts from: eight rows, one of
 * each observed shape, in provider order.
 *
 * | pos | shape                                   | expected              |
 * |-----|-----------------------------------------|-----------------------|
 * | 1   | Finished / 1, winner, FastestLap rank 2 | finished, elapsed     |
 * | 2   | Finished / 2, same lap, rank 1          | finished, fastest lap |
 * | 3   | Lapped / 3, one lap down                | lapped, 1 behind      |
 * | 4   | Lapped / R (C-2), no Time               | lapped, 9 behind      |
 * | 5   | Retired / 5 (C-4), empty `time`         | dnf, position kept    |
 * | 6   | Retired / R, FastestLap without time    | dnf, unclassified     |
 * | 7   | Did not start / W, positive grid        | dns, grid kept        |
 * | 8   | Did not start / W, grid 0               | dns, grid null        |
 */
export function baseRows(): Record<string, unknown>[] {
  const drivers = providerDrivers(8);
  const constructors = providerConstructors();
  const identity = (index: number) => ({
    driverId: drivers[index],
    constructorId: constructors[Math.floor(index / 2)],
  });
  return [
    resultRow({
      ...identity(0),
      position: '1',
      positionText: '1',
      status: 'Finished',
      points: '25',
      grid: '3',
      laps: String(WINNER_LAPS),
      Time: { millis: String(WINNER_MILLIS), time: '1:30:00.000' },
      FastestLap: { rank: '2', lap: '40', Time: { time: '1:21.500' } },
    }),
    resultRow({
      ...identity(1),
      position: '2',
      positionText: '2',
      status: 'Finished',
      points: '18',
      grid: '1',
      laps: String(WINNER_LAPS),
      Time: { millis: String(WINNER_MILLIS + 4_321), time: '+4.321' },
      FastestLap: { rank: '1', lap: '44', Time: { time: '1:20.987' } },
    }),
    resultRow({
      ...identity(2),
      position: '3',
      positionText: '3',
      status: 'Lapped',
      points: '15',
      grid: '2',
      laps: String(WINNER_LAPS - 1),
      Time: { millis: String(WINNER_MILLIS + 2_000), time: '+2.000' },
      FastestLap: { rank: '3', lap: '30', Time: { time: '1:22.000' } },
    }),
    resultRow({
      ...identity(3),
      position: '4',
      positionText: 'R',
      status: 'Lapped',
      points: '12',
      grid: '4',
      laps: String(WINNER_LAPS - 9),
      FastestLap: { rank: '4', lap: '12', Time: { time: '1:23.000' } },
    }),
    resultRow({
      ...identity(4),
      position: '5',
      positionText: '5',
      status: 'Retired',
      points: '0',
      grid: '5',
      laps: String(WINNER_LAPS - 3),
      Time: { millis: String(WINNER_MILLIS - 60_000), time: '' },
      FastestLap: { rank: '5', lap: '20', Time: { time: '1:24.000' } },
    }),
    resultRow({
      ...identity(5),
      position: '6',
      positionText: 'R',
      status: 'Retired',
      points: '0',
      grid: '6',
      laps: '10',
      FastestLap: { rank: '6', lap: '5' },
    }),
    resultRow({
      ...identity(6),
      position: '7',
      positionText: 'W',
      status: 'Did not start',
      grid: '7',
      laps: '0',
    }),
    resultRow({
      ...identity(7),
      position: '8',
      positionText: 'W',
      status: 'Did not start',
      grid: '0',
      laps: '0',
    }),
  ];
}

export interface ResultsEnvelopeOptions {
  readonly season?: unknown;
  readonly round?: unknown;
  readonly limit?: unknown;
  readonly offset?: unknown;
  /** Defaults to the number of rows supplied. */
  readonly total?: unknown;
  /** Replaces the whole race list. */
  readonly races?: unknown;
  readonly raceSeason?: unknown;
  readonly raceRound?: unknown;
  readonly raceName?: unknown;
  readonly circuitId?: unknown;
}

/** The Ergast-compatible envelope the results endpoint answers with. */
export function resultsEnvelope(
  rows: unknown,
  options: ResultsEnvelopeOptions = {},
): Record<string, unknown> {
  const has = (key: keyof ResultsEnvelopeOptions) => key in options;
  const locator = locatorFor(ROUND);
  const race = {
    season: has('raceSeason') ? options.raceSeason : String(SEASON),
    round: has('raceRound') ? options.raceRound : String(ROUND),
    url: 'https://example.invalid/synthetic-race',
    raceName: has('raceName') ? options.raceName : locator.raceName,
    Circuit: {
      circuitId: has('circuitId') ? options.circuitId : locator.circuitId,
      circuitName: 'Synthetic Provider Circuit',
    },
    date: '1900-01-01',
    time: '00:00:00Z',
    Results: rows,
  };
  return {
    MRData: {
      xmlns: '',
      series: 'f1',
      url: 'https://example.invalid/synthetic-envelope-url',
      limit: has('limit') ? options.limit : String(LIMIT),
      offset: has('offset') ? options.offset : '0',
      total: has('total')
        ? options.total
        : String(Array.isArray(rows) ? rows.length : 0),
      RaceTable: {
        season: has('season') ? options.season : String(SEASON),
        round: has('round') ? options.round : String(ROUND),
        Races: has('races') ? options.races : [race],
      },
    },
  };
}

/** The structurally valid answer for a round with no classification (C-9). */
export function emptyResultsEnvelope(): Record<string, unknown> {
  return resultsEnvelope([], { races: [], total: '0' });
}

export interface ResultsHarness {
  readonly port: JolpicaResultsPort;
  readonly logger: CapturingLogger;
  readonly calls: readonly TransportRecord[];
  readonly reservations: readonly RealProviderSourceId[];
}

export interface ResultsHarnessOptions {
  readonly steps?: readonly TransportStep[];
  readonly limiter?: readonly ReservationStep[];
  readonly registry?: ProviderMappingRegistry;
  /** Substitutes the decoded body of the successful response. */
  readonly successData?: () => unknown;
}

/** Builds the results port over fakes only. No binding, no network. */
export function resultsHarness(
  options: ResultsHarnessOptions = {},
): ResultsHarness {
  const scripted = scriptedTransport(
    options.steps ?? [{ kind: 'json', body: resultsEnvelope(baseRows()) }],
  );
  const limiter = scriptedLimiter(options.limiter ?? []);
  const logger = new CapturingLogger();
  const substitute = options.successData;
  const client = new SeamedClient(
    { transport: scripted.transport, limiter: limiter.limiter, logger },
    substitute === undefined ? undefined : () => substitute(),
    undefined,
  );
  const port = new JolpicaResultsPort({
    client,
    logger,
    registry: options.registry ?? providerMappingRegistry(),
  });
  return {
    port,
    logger,
    calls: scripted.calls,
    reservations: limiter.reservations,
  };
}
