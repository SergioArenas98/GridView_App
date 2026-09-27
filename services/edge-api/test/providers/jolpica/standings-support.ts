/**
 * Fixtures and doubles for the Jolpica standings port tests.
 *
 * **Nothing here is a preserved provider response**, and no captured row is
 * copied. Every envelope is a small synthetic table whose *shape* is traceable
 * to the 2026 standings capture (ADR 0023 amendment A3 cites it by SHA-256):
 * the `StandingsTable` / `StandingsLists` nesting with the round stated twice,
 * `position` and `positionText` as equal strings, points and wins as strings,
 * a driver row's `Constructors` list, and equal points at distinct positions.
 * Every position, points and wins value is invented. Provider identities are
 * read from the committed curated mapping file, and the synthetic descriptive
 * fields beside them are obviously fake.
 *
 * **Nothing here can reach the network.** The limiter and transport are the
 * in-memory scripted doubles the participants tests use.
 */

import { CapturingLogger } from '../../../src/logging/logger';
import type { RealProviderSourceId } from '../../../src/providers/http/reservation-engine';
import { JolpicaStandingsPort } from '../../../src/providers/jolpica';
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
  type CuratedMapping,
  type ReservationStep,
  type TransportStep,
} from './participants-support';
import { LIMIT, SEASON, type TransportRecord } from './support';

/** The round every synthetic table is bound to. Invented; never published. */
export const STANDINGS_ROUND = '9';

export const driverStandingsUrl = (season: number = SEASON): string =>
  `https://api.jolpi.ca/ergast/f1/${season}/driverstandings/?limit=${LIMIT}`;
export const constructorStandingsUrl = (season: number = SEASON): string =>
  `https://api.jolpi.ca/ergast/f1/${season}/constructorstandings/?limit=${LIMIT}`;

/**
 * Synthetic descriptive fields shaped like the ones Jolpica publishes beside
 * the identities. Every value is obviously invented, so a leak is unmistakable.
 */
export const syntheticStandingsMarkers: readonly string[] = [
  'Synthetic Provider',
  'example.invalid',
  'ZZZ',
  '1900-01-01',
  '999',
];

function driverObject(driverId: unknown): Record<string, unknown> {
  return {
    driverId,
    permanentNumber: '999',
    code: 'ZZZ',
    url: 'https://example.invalid/synthetic-driver',
    givenName: 'Synthetic Provider Given',
    familyName: 'Synthetic Provider Family',
    dateOfBirth: '1900-01-01',
    nationality: 'Synthetic Provider Nationality',
  };
}

function constructorObject(constructorId: unknown): Record<string, unknown> {
  return {
    constructorId,
    url: 'https://example.invalid/synthetic-constructor',
    name: 'Synthetic Provider Constructor',
    nationality: 'Synthetic Provider Nationality',
  };
}

export interface StandingFixture {
  readonly position: unknown;
  /** Defaults to `position`. */
  readonly positionText?: unknown;
  readonly points: unknown;
  readonly wins: unknown;
}

/** One provider driver standing row. `constructorIds` become `Constructors`. */
export function driverStandingRow(
  driverId: unknown,
  constructorIds: readonly unknown[],
  facts: StandingFixture,
): Record<string, unknown> {
  return {
    position: facts.position,
    positionText: 'positionText' in facts ? facts.positionText : facts.position,
    points: facts.points,
    wins: facts.wins,
    Driver: driverObject(driverId),
    Constructors: constructorIds.map(constructorObject),
  };
}

/** One provider constructor standing row. */
export function constructorStandingRow(
  constructorId: unknown,
  facts: StandingFixture,
): Record<string, unknown> {
  return {
    position: facts.position,
    positionText: 'positionText' in facts ? facts.positionText : facts.position,
    points: facts.points,
    wins: facts.wins,
    Constructor: constructorObject(constructorId),
  };
}

const drivers = (): readonly CuratedMapping[] => curatedDriverMappings();
const constructors = (): readonly CuratedMapping[] =>
  curatedConstructorMappings();

function mappingAt(
  list: readonly CuratedMapping[],
  index: number,
): CuratedMapping {
  const mapping = list[index];
  if (mapping === undefined) throw new Error(`no curated mapping ${index}`);
  return mapping;
}

/** The curated driver mapping at `index`. */
export const driverMapping = (index: number): CuratedMapping =>
  mappingAt(drivers(), index);
/** The curated constructor mapping at `index`. */
export const constructorMapping = (index: number): CuratedMapping =>
  mappingAt(constructors(), index);

/** The curated constructor mapping whose canonical ID is `gridviewId`. */
export function constructorMappingFor(gridviewId: string): CuratedMapping {
  const mapping = constructors().find(
    (entry) => entry.gridviewId === gridviewId,
  );
  if (mapping === undefined) throw new Error(`no curated ${gridviewId}`);
  return mapping;
}

/**
 * The synthetic driver table every case starts from: five rows in provider
 * order.
 *
 * | pos | constructors listed        | points | wins | expected constructorId |
 * |-----|----------------------------|--------|------|------------------------|
 * | 1   | constructor 0              | 120    | 3    | constructor 0          |
 * | 2   | constructor 1, constructor 0 | 64   | 1    | `null` (S-3)           |
 * | 3   | constructor 1              | 40     | 0    | constructor 1          |
 * | 4   | constructor 2              | 7      | 0    | constructor 2          |
 * | 5   | constructor 2              | 7      | 0    | constructor 2          |
 *
 * Rows 4 and 5 hold equal points at distinct positions, as observed.
 */
export function baseDriverRows(): Record<string, unknown>[] {
  const c = (index: number) => constructorMapping(index).providerValue;
  const d = (index: number) => driverMapping(index).providerValue;
  return [
    driverStandingRow(d(0), [c(0)], {
      position: '1',
      points: '120',
      wins: '3',
    }),
    driverStandingRow(d(1), [c(1), c(0)], {
      position: '2',
      points: '64',
      wins: '1',
    }),
    driverStandingRow(d(2), [c(1)], { position: '3', points: '40', wins: '0' }),
    driverStandingRow(d(3), [c(2)], { position: '4', points: '7', wins: '0' }),
    driverStandingRow(d(4), [c(2)], { position: '5', points: '7', wins: '0' }),
  ];
}

/** The synthetic constructor table: four rows in provider order. */
export function baseConstructorRows(): Record<string, unknown>[] {
  const c = (index: number) => constructorMapping(index).providerValue;
  return [
    constructorStandingRow(c(0), { position: '1', points: '150', wins: '3' }),
    constructorStandingRow(c(1), { position: '2', points: '90', wins: '1' }),
    constructorStandingRow(c(2), { position: '3', points: '14', wins: '0' }),
    constructorStandingRow(c(3), { position: '4', points: '0', wins: '0' }),
  ];
}

export interface StandingsEnvelopeOptions {
  readonly season?: unknown;
  readonly round?: unknown;
  readonly listSeason?: unknown;
  readonly listRound?: unknown;
  readonly limit?: unknown;
  readonly offset?: unknown;
  /** Defaults to the number of rows supplied. */
  readonly total?: unknown;
  /** Replaces the whole `StandingsLists` value. */
  readonly lists?: unknown;
  /** Extra fields on the one standings list, used to prove they are ignored. */
  readonly listExtra?: Readonly<Record<string, unknown>>;
}

type ListKey = 'DriverStandings' | 'ConstructorStandings';

function standingsEnvelope(
  listKey: ListKey,
  rows: unknown,
  options: StandingsEnvelopeOptions,
): Record<string, unknown> {
  const has = (key: keyof StandingsEnvelopeOptions) => key in options;
  const list = {
    season: has('listSeason') ? options.listSeason : String(SEASON),
    round: has('listRound') ? options.listRound : STANDINGS_ROUND,
    [listKey]: rows,
    ...(options.listExtra ?? {}),
  };
  const table: Record<string, unknown> = {
    season: has('season') ? options.season : String(SEASON),
    StandingsLists: has('lists') ? options.lists : [list],
  };
  if (!has('round') || options.round !== undefined) {
    table.round = has('round') ? options.round : STANDINGS_ROUND;
  }
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
      StandingsTable: table,
    },
  };
}

/** The `/{season}/driverstandings/` envelope. */
export const driverStandingsEnvelope = (
  rows: unknown,
  options: StandingsEnvelopeOptions = {},
): Record<string, unknown> =>
  standingsEnvelope('DriverStandings', rows, options);

/** The `/{season}/constructorstandings/` envelope. */
export const constructorStandingsEnvelope = (
  rows: unknown,
  options: StandingsEnvelopeOptions = {},
): Record<string, unknown> =>
  standingsEnvelope('ConstructorStandings', rows, options);

/**
 * The one empty shape S-9 accepts: no standings list, a complete page and
 * `total "0"`. **Unverified** - no such response has been observed.
 */
export const emptyStandingsEnvelope = (
  listKey: ListKey,
  options: StandingsEnvelopeOptions = {},
): Record<string, unknown> =>
  standingsEnvelope(listKey, [], { lists: [], total: '0', ...options });

export interface StandingsHarness {
  readonly port: JolpicaStandingsPort;
  readonly logger: CapturingLogger;
  readonly calls: readonly TransportRecord[];
  readonly reservations: readonly RealProviderSourceId[];
}

export interface StandingsHarnessOptions {
  readonly steps?: readonly TransportStep[];
  readonly limiter?: readonly ReservationStep[];
  readonly registry?: ProviderMappingRegistry;
  /** Substitutes the decoded body of the successful response. */
  readonly successData?: () => unknown;
}

/** Builds the standings port over fakes only. No binding, no network. */
export function standingsHarness(
  options: StandingsHarnessOptions = {},
): StandingsHarness {
  const scripted = scriptedTransport(
    options.steps ?? [
      { kind: 'json', body: driverStandingsEnvelope(baseDriverRows()) },
    ],
  );
  const limiter = scriptedLimiter(options.limiter ?? []);
  const logger = new CapturingLogger();
  const substitute = options.successData;
  const client = new SeamedClient(
    { transport: scripted.transport, limiter: limiter.limiter, logger },
    substitute === undefined ? undefined : () => substitute(),
    undefined,
  );
  const port = new JolpicaStandingsPort({
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
