/**
 * Fixtures and doubles for the Jolpica calendar adapter tests.
 *
 * **Nothing here is a preserved provider response.** Every envelope is built
 * from synthetic values, from provider values already committed to the curated
 * mapping file, or from values deliberately fabricated because the exact real
 * data is irrelevant to what is being proved. No coordinate, Wikipedia URL,
 * locality or country field appears anywhere, and the 23-row projection is
 * rebuilt from `content/seasons/2026/provider-mappings.development.json` at
 * test time, so these tests depend on committed repository data and never on
 * a private evidence directory or on machine state.
 *
 * **Nothing here can reach the network.** The transport is a local function
 * that returns a `Response` built in memory; a test that made a real request
 * would have to replace it explicitly.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CapturingLogger } from '../../../src/logging/logger';
import { ProviderHttpClient } from '../../../src/providers/http/provider-http-client';
import type {
  ProviderHttpClientOptions,
  ProviderHttpResult,
  ProviderRequest,
  ProviderTransport,
} from '../../../src/providers/http/provider-http-client';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from '../../../src/providers/http/provider-rate-limiter';
import type { RealProviderSourceId } from '../../../src/providers/http/reservation-engine';
import {
  buildProviderMappingRegistry,
  curatedMappingDocuments,
  curatedRegistries,
  providerMappingRegistry,
} from '../../../src/providers/mappings';
import { JolpicaCalendarPort } from '../../../src/providers/jolpica';

export const SEASON = 2026;
export const LIMIT = 100;

const repoRoot = join(__dirname, '..', '..', '..', '..', '..');

/** One Jolpica session block, as the endpoint publishes it. */
export interface BlockFixture {
  readonly date: string;
  readonly time?: string;
}

export interface RaceFixture {
  readonly round: string;
  readonly raceName: string;
  readonly circuitId: string;
  readonly date: string;
  readonly time?: string;
  readonly blocks?: Readonly<Record<string, BlockFixture | unknown>>;
  /** Extra upstream fields, used only to prove they never leak. */
  readonly extra?: Readonly<Record<string, unknown>>;
  readonly season?: string;
}

/**
 * Builds one race object.
 *
 * Only the fields a test needs are present. `Circuit` carries `circuitId` and
 * nothing else: the descriptive fields Jolpica publishes beside it are
 * unapproved content and are deliberately absent from every fixture.
 */
export function race(fixture: RaceFixture): Record<string, unknown> {
  return {
    season: fixture.season ?? String(SEASON),
    round: fixture.round,
    raceName: fixture.raceName,
    Circuit: { circuitId: fixture.circuitId },
    date: fixture.date,
    ...(fixture.time === undefined ? {} : { time: fixture.time }),
    ...(fixture.blocks ?? {}),
    ...(fixture.extra ?? {}),
  };
}

export interface EnvelopeOptions {
  readonly season?: string;
  readonly limit?: string;
  readonly offset?: string;
  /** Defaults to the number of races supplied. */
  readonly total?: string;
}

/** Builds the Ergast-compatible envelope Jolpica answers with. */
export function envelope(
  races: readonly unknown[],
  options: EnvelopeOptions = {},
): Record<string, unknown> {
  return {
    MRData: {
      limit: options.limit ?? String(LIMIT),
      offset: options.offset ?? '0',
      total: options.total ?? String(races.length),
      RaceTable: {
        season: options.season ?? String(SEASON),
        Races: races,
      },
    },
  };
}

/** A normal, non-sprint weekend. Three practices, qualifying and the race. */
export const standardWeekend: RaceFixture = {
  round: '1',
  raceName: 'Australian Grand Prix',
  circuitId: 'albert_park',
  date: '2026-03-08',
  time: '04:00:00Z',
  blocks: {
    FirstPractice: { date: '2026-03-06', time: '01:30:00Z' },
    SecondPractice: { date: '2026-03-06', time: '05:00:00Z' },
    ThirdPractice: { date: '2026-03-07', time: '01:30:00Z' },
    Qualifying: { date: '2026-03-07', time: '05:00:00Z' },
  },
};

/**
 * A sprint weekend: one practice, sprint qualifying, the sprint, qualifying
 * and the race, with the second and third practice blocks absent exactly as
 * the endpoint omits them (Provider Evaluation §8.4).
 */
export const sprintWeekend: RaceFixture = {
  round: '2',
  raceName: 'Chinese Grand Prix',
  circuitId: 'shanghai',
  date: '2026-03-15',
  time: '07:00:00Z',
  blocks: {
    FirstPractice: { date: '2026-03-13', time: '03:30:00Z' },
    SprintQualifying: { date: '2026-03-13', time: '07:30:00Z' },
    Sprint: { date: '2026-03-14', time: '03:00:00Z' },
    Qualifying: { date: '2026-03-14', time: '07:00:00Z' },
  },
};

/** The curated 2026 event locators, read from committed repository content. */
export interface CuratedLocator {
  readonly round: number;
  readonly raceName: string;
  readonly circuitId: string;
}

export function curatedEventLocators(): readonly CuratedLocator[] {
  const path = join(
    repoRoot,
    'content',
    'seasons',
    '2026',
    'provider-mappings.development.json',
  );
  const document = JSON.parse(readFileSync(path, 'utf8')) as {
    mappings: readonly {
      entity: string;
      providerField: string;
      providerValue: unknown;
    }[];
  };
  return document.mappings
    .filter(
      (mapping) =>
        mapping.entity === 'event' && mapping.providerField === 'eventLocator',
    )
    .map((mapping) => mapping.providerValue as CuratedLocator)
    .slice()
    .sort((left, right) => left.round - right.round);
}

/**
 * The complete 23-row calendar, as a **minimal projection** of the curated
 * locators rather than a copy of any real response.
 *
 * Dates are fabricated from the round number: they are irrelevant to what the
 * 23-row cases prove (identity resolution across the whole season), and
 * inventing them keeps the real observed schedule out of the repository.
 *
 * `blocksByRound` attaches session blocks to named rounds. Which rounds are
 * sprint rounds in 2026 is **not** recorded in this repository, and inventing
 * an answer here would put an unevidenced schedule into a fixture. So the
 * caller states the shape it wants to classify, and every unnamed round keeps
 * the no-blocks projection.
 */
export function fullSeasonRaces(
  blocksByRound: Readonly<
    Record<number, Readonly<Record<string, BlockFixture | unknown>>>
  > = {},
): readonly Record<string, unknown>[] {
  return curatedEventLocators().map((locator) =>
    race({
      round: String(locator.round),
      raceName: locator.raceName,
      circuitId: locator.circuitId,
      date: fabricatedDate(locator.round),
      time: '12:00:00Z',
      blocks: blocksByRound[locator.round],
    }),
  );
}

/** A deterministic, obviously synthetic date: one round per week in 2026. */
function fabricatedDate(round: number): string {
  const start = Date.UTC(2026, 2, 1);
  const day = new Date(start + (round - 1) * 7 * 24 * 60 * 60 * 1000);
  return day.toISOString().slice(0, 10);
}

/** A limiter that always grants capacity, with no windows and no state. */
export const allowingLimiter: ProviderRateLimiterClient = {
  async reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome> {
    return { outcome: 'allowed', sourceId, headroom: [] };
  },
};

export interface CountingLimiter {
  readonly limiter: ProviderRateLimiterClient;
  /** One entry per reservation, in order. */
  readonly reservations: readonly RealProviderSourceId[];
}

/** A limiter that grants capacity and records how often it was asked. */
export function countingLimiter(): CountingLimiter {
  const reservations: RealProviderSourceId[] = [];
  const limiter: ProviderRateLimiterClient = {
    async reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome> {
      reservations.push(sourceId);
      return { outcome: 'allowed', sourceId, headroom: [] };
    },
  };
  return { limiter, reservations };
}

/** A limiter that always defers, so nothing may leave GridView. */
export function deferringLimiter(retryAt: string): ProviderRateLimiterClient {
  return {
    async reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome> {
      return {
        outcome: 'deferred',
        sourceId,
        retryAt,
        limitingWindows: [],
        headroom: [],
      };
    },
  };
}

/** A limiter that cannot answer. The boundary must then fail closed. */
export const unavailableLimiter: ProviderRateLimiterClient = {
  async reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome> {
    return { outcome: 'unavailable', sourceId, reason: 'limiter-unreachable' };
  },
};

export interface TransportRecord {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly redirect: string;
  readonly hasBody: boolean;
}

export interface RecordingTransport {
  readonly transport: ProviderTransport;
  readonly calls: readonly TransportRecord[];
}

/** A transport that records what it was asked for and answers in memory. */
export function jsonTransport(
  body: unknown,
  init: { status?: number; contentType?: string | null } = {},
): RecordingTransport {
  const calls: TransportRecord[] = [];
  const transport: ProviderTransport = async (request) => {
    calls.push(describe(request));
    const headers = new Headers();
    if (init.contentType !== null) {
      headers.set('Content-Type', init.contentType ?? 'application/json');
    }
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(text, { status: init.status ?? 200, headers });
  };
  return { transport, calls };
}

/** A transport that fails the way a network error does. */
export function failingTransport(): RecordingTransport {
  const calls: TransportRecord[] = [];
  const transport: ProviderTransport = async (request) => {
    calls.push(describe(request));
    throw new TypeError('network');
  };
  return { transport, calls };
}

/** A transport that answers `429` with an upstream retry instruction. */
export function rateLimitedTransport(
  retryAfterSeconds: number,
): RecordingTransport {
  const calls: TransportRecord[] = [];
  const transport: ProviderTransport = async (request) => {
    calls.push(describe(request));
    return new Response('', {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    });
  };
  return { transport, calls };
}

/**
 * A transport that must never run.
 *
 * Used wherever the adapter is required to answer before transport. It fails
 * the test by throwing rather than by returning something a later assertion
 * might accept.
 */
export function forbiddenTransport(): RecordingTransport {
  const calls: TransportRecord[] = [];
  const transport: ProviderTransport = async () => {
    throw new Error('transport must not be invoked');
  };
  return { transport, calls };
}

function describe(request: Request): TransportRecord {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return {
    url: request.url,
    method: request.method,
    headers,
    redirect: request.redirect,
    hasBody: request.body !== null,
  };
}

/**
 * The real client, with the decoded body of a **successful** response replaced
 * by an arbitrary value.
 *
 * The limiter, the transport and every response check still run exactly once,
 * unchanged; only `data` is substituted, and only on success. This is the one
 * way to hand the port a value its `unknown` body type permits but `JSON.parse`
 * can never produce - such as an object with a throwing accessor.
 */
class SubstitutedDataClient extends ProviderHttpClient {
  private readonly data: () => unknown;

  constructor(options: ProviderHttpClientOptions, data: () => unknown) {
    super(options);
    this.data = data;
  }

  override async getJson<T = unknown>(
    request: ProviderRequest,
  ): Promise<ProviderHttpResult<T>> {
    const result = await super.getJson<T>(request);
    if (!result.ok) return result;
    return { ...result, data: this.data() as T };
  }
}

export interface PortHarness {
  readonly port: JolpicaCalendarPort;
  readonly logger: CapturingLogger;
  readonly calls: readonly TransportRecord[];
}

export interface HarnessOptions {
  readonly transport?: RecordingTransport;
  readonly limiter?: ProviderRateLimiterClient;
  /** Replaces the curated registry, for the unmapped-identity cases. */
  readonly emptyRegistry?: boolean;
  /** Substitutes the decoded body the client hands the port on success. */
  readonly successData?: () => unknown;
}

/** Builds the adapter over fakes only. No binding, no network, no clock. */
export function harness(options: HarnessOptions = {}): PortHarness {
  const recording = options.transport ?? jsonTransport(envelope([]));
  const logger = new CapturingLogger();
  const clientOptions = {
    transport: recording.transport,
    limiter: options.limiter ?? allowingLimiter,
    logger,
  };
  const client = options.successData
    ? new SubstitutedDataClient(clientOptions, options.successData)
    : new ProviderHttpClient(clientOptions);
  const port = new JolpicaCalendarPort({
    client,
    logger,
    registry: options.emptyRegistry
      ? buildProviderMappingRegistry([], curatedRegistries())
      : providerMappingRegistry(),
  });
  return { port, logger, calls: recording.calls };
}

/** A registry built from the committed documents, for direct assertions. */
export function realRegistry() {
  return buildProviderMappingRegistry(
    curatedMappingDocuments(),
    curatedRegistries(),
  );
}
