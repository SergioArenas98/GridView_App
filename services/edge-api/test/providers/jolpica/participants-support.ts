/**
 * Fixtures and doubles for the Jolpica season-participants port tests.
 *
 * **Nothing here is a preserved provider response.** Every envelope is built
 * from synthetic values or from provider identities already committed to the
 * curated mapping file. The complete 2026 projection is rebuilt from
 * `content/seasons/2026/provider-mappings.development.json` at test time. A row
 * carries only its identity unless a test deliberately adds synthetic
 * descriptive fields to prove they are ignored, and those fields are obviously
 * invented. No real name, number, code, date or nationality appears anywhere.
 *
 * **Nothing here can reach the network.** The limiters and transports are
 * in-memory doubles. The transport answers a scripted sequence of steps, one
 * per request, so a test can prove which request was sent and which never was.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  ProviderHttpClient,
  type ProviderHttpClientOptions,
  type ProviderHttpResult,
  type ProviderRequest,
  type ProviderTransport,
} from '../../../src/providers/http/provider-http-client';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from '../../../src/providers/http/provider-rate-limiter';
import type { RealProviderSourceId } from '../../../src/providers/http/reservation-engine';
import {
  JolpicaParticipantsPort,
  type CuratedParticipants,
} from '../../../src/providers/jolpica';
import {
  buildProviderMappingRegistry,
  curatedRegistries,
  providerMappingRegistry,
  type CanonicalRegistries,
  type ProviderMappingRegistry,
} from '../../../src/providers/mappings';
import { LIMIT, SEASON, type TransportRecord } from './support';

const repoRoot = join(__dirname, '..', '..', '..', '..', '..');

export const DRIVERS_URL = `https://api.jolpi.ca/ergast/f1/${SEASON}/drivers/?limit=${LIMIT}`;
export const CONSTRUCTORS_URL = `https://api.jolpi.ca/ergast/f1/${SEASON}/constructors/?limit=${LIMIT}`;
export const RETRY_AT = '2026-07-20T12:00:30.000Z';

export interface EnvelopeOptions {
  readonly season?: unknown;
  readonly limit?: unknown;
  readonly offset?: unknown;
  /** Defaults to the number of rows supplied. */
  readonly total?: unknown;
}

function envelopeFor(
  table: 'DriverTable' | 'ConstructorTable',
  collection: 'Drivers' | 'Constructors',
  rows: unknown,
  options: EnvelopeOptions,
): Record<string, unknown> {
  const has = (key: keyof EnvelopeOptions) => key in options;
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
      [table]: {
        season: has('season') ? options.season : String(SEASON),
        [collection]: rows,
      },
    },
  };
}

/** The `/{season}/drivers/` envelope. */
export function driversEnvelope(
  rows: unknown,
  options: EnvelopeOptions = {},
): Record<string, unknown> {
  return envelopeFor('DriverTable', 'Drivers', rows, options);
}

/** The `/{season}/constructors/` envelope. */
export function constructorsEnvelope(
  rows: unknown,
  options: EnvelopeOptions = {},
): Record<string, unknown> {
  return envelopeFor('ConstructorTable', 'Constructors', rows, options);
}

/**
 * Synthetic descriptive fields shaped like the ones Jolpica publishes beside
 * `driverId`. Every value is obviously invented and deliberately conflicts
 * with the curated registry, so a leak into canonical output is unmistakable.
 */
export const syntheticDriverDescription: Readonly<Record<string, unknown>> = {
  permanentNumber: '99',
  code: 'ZZZ',
  url: 'https://example.invalid/synthetic-driver',
  givenName: 'Synthetic Provider Given',
  familyName: 'Synthetic Provider Family',
  dateOfBirth: '1900-01-01',
  nationality: 'Synthetic Provider Nationality',
};

/** The same, for a constructor row. */
export const syntheticConstructorDescription: Readonly<
  Record<string, unknown>
> = {
  url: 'https://example.invalid/synthetic-constructor',
  name: 'Synthetic Provider Constructor Name',
  nationality: 'Synthetic Provider Nationality',
};

/** Every synthetic marker above, for leak assertions. */
export const syntheticMarkers: readonly string[] = [
  'Synthetic Provider',
  'example.invalid',
  'ZZZ',
  '1900-01-01',
];

export function driverRow(
  driverId: unknown,
  extra: Readonly<Record<string, unknown>> = syntheticDriverDescription,
): Record<string, unknown> {
  return { driverId, ...extra };
}

export function constructorRow(
  constructorId: unknown,
  extra: Readonly<Record<string, unknown>> = syntheticConstructorDescription,
): Record<string, unknown> {
  return { constructorId, ...extra };
}

/** One curated 2026 mapping, read from committed content. */
export interface CuratedMapping {
  readonly providerValue: string;
  readonly gridviewId: string;
}

interface MappingRecord {
  readonly source: string;
  readonly entity: string;
  readonly providerField: string;
  readonly providerValue: unknown;
  readonly gridviewId: string;
}

/** The committed 2026 mapping document, parsed fresh on every call. */
export function mappingDocument(): Record<string, unknown> & {
  mappings: MappingRecord[];
} {
  const path = join(
    repoRoot,
    'content',
    'seasons',
    '2026',
    'provider-mappings.development.json',
  );
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown> & {
    mappings: MappingRecord[];
  };
}

function curatedMappings(
  entity: 'driver' | 'constructor',
): readonly CuratedMapping[] {
  const field = entity === 'driver' ? 'driverId' : 'constructorId';
  return mappingDocument()
    .mappings.filter(
      (mapping) =>
        mapping.source === 'jolpica' &&
        mapping.entity === entity &&
        mapping.providerField === field,
    )
    .map(({ providerValue, gridviewId }) => ({
      providerValue: providerValue as string,
      gridviewId,
    }));
}

export const curatedDriverMappings = (): readonly CuratedMapping[] =>
  curatedMappings('driver');
export const curatedConstructorMappings = (): readonly CuratedMapping[] =>
  curatedMappings('constructor');

/** A curated registry document's rows, read from committed content. */
export function registryRows(
  entity: 'drivers' | 'constructors',
): readonly Record<string, unknown>[] {
  const path = join(repoRoot, 'content', 'registries', `${entity}.mock.json`);
  return (
    JSON.parse(readFileSync(path, 'utf8')) as Record<
      string,
      Record<string, unknown>[]
    >
  )[entity] as Record<string, unknown>[];
}

/** Every curated 2026 driver as a provider row, with synthetic descriptions. */
export function fullSeasonDriverRows(): Record<string, unknown>[] {
  return curatedDriverMappings().map((mapping) =>
    driverRow(mapping.providerValue),
  );
}

/** Every curated 2026 constructor as a provider row, with synthetic descriptions. */
export function fullSeasonConstructorRows(): Record<string, unknown>[] {
  return curatedConstructorMappings().map((mapping) =>
    constructorRow(mapping.providerValue),
  );
}

/**
 * A registry built from an edited copy of the committed mapping document.
 * `edit` receives a fresh copy, so committed content is never touched.
 */
export function editedRegistry(
  edit: (document: ReturnType<typeof mappingDocument>) => unknown,
  canonical: CanonicalRegistries = curatedRegistries(),
): ProviderMappingRegistry {
  const document = mappingDocument();
  const edited = edit(document) ?? document;
  return buildProviderMappingRegistry([edited], canonical);
}

/** One scripted transport answer. */
export type TransportStep =
  | { readonly kind: 'json'; readonly body: unknown }
  | { readonly kind: 'network' }
  | { readonly kind: 'rate-limited'; readonly retryAfterSeconds: number }
  | { readonly kind: 'status'; readonly status: number };

export interface ScriptedTransport {
  readonly transport: ProviderTransport;
  readonly calls: readonly TransportRecord[];
}

/**
 * A transport that answers request `n` with step `n`. A request beyond the
 * script fails the test by throwing, so a third request can never be answered
 * as if it were expected.
 */
export function scriptedTransport(
  steps: readonly TransportStep[],
): ScriptedTransport {
  const calls: TransportRecord[] = [];
  const transport: ProviderTransport = async (request) => {
    const index = calls.length;
    calls.push(describe(request));
    const step = steps[index];
    if (step === undefined) {
      throw new Error(`unexpected request ${index + 1}`);
    }
    switch (step.kind) {
      case 'json':
        return new Response(JSON.stringify(step.body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      case 'network':
        throw new TypeError('network');
      case 'rate-limited':
        return new Response('', {
          status: 429,
          headers: { 'Retry-After': String(step.retryAfterSeconds) },
        });
      case 'status':
        return new Response('', { status: step.status });
    }
  };
  return { transport, calls };
}

/** The complete, valid two-response script for the 2026 fixture. */
export function completeScript(): TransportStep[] {
  return [
    { kind: 'json', body: driversEnvelope(fullSeasonDriverRows()) },
    { kind: 'json', body: constructorsEnvelope(fullSeasonConstructorRows()) },
  ];
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

/** One scripted limiter answer. `abort` cancels the caller mid-reservation. */
export type ReservationStep =
  'allowed' | 'deferred' | 'unavailable' | { readonly abort: AbortController };

export interface ScriptedLimiter {
  readonly limiter: ProviderRateLimiterClient;
  /** One entry per reservation, in order. */
  readonly reservations: readonly RealProviderSourceId[];
}

/** A limiter that answers reservation `n` with step `n` (default: allowed). */
export function scriptedLimiter(
  steps: readonly ReservationStep[] = [],
): ScriptedLimiter {
  const reservations: RealProviderSourceId[] = [];
  const limiter: ProviderRateLimiterClient = {
    async reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome> {
      const step = steps[reservations.length] ?? 'allowed';
      reservations.push(sourceId);
      if (step === 'deferred') {
        return {
          outcome: 'deferred',
          sourceId,
          retryAt: RETRY_AT,
          limitingWindows: [],
          headroom: [],
        };
      }
      if (step === 'unavailable') {
        return {
          outcome: 'unavailable',
          sourceId,
          reason: 'limiter-unreachable',
        };
      }
      if (typeof step === 'object') step.abort.abort();
      return { outcome: 'allowed', sourceId, headroom: [] };
    },
  };
  return { limiter, reservations };
}

/**
 * The real client with two optional seams: the decoded body of a successful
 * response `n` can be substituted - the one way to hand the port a value
 * `JSON.parse` can never produce, such as a throwing accessor - and a hook can
 * run after response `n` has been returned, which is how a test cancels the
 * caller *between* the two requests. The limiter, the transport and every
 * response check still run exactly once, unchanged.
 */
class SeamedClient extends ProviderHttpClient {
  private index = 0;

  constructor(
    options: ProviderHttpClientOptions,
    private readonly data: ((index: number) => unknown) | undefined,
    private readonly after: ((index: number) => void) | undefined,
  ) {
    super(options);
  }

  override async getJson<T = unknown>(
    request: ProviderRequest,
  ): Promise<ProviderHttpResult<T>> {
    const index = this.index;
    this.index += 1;
    const result = await super.getJson<T>(request);
    this.after?.(index);
    if (!result.ok || this.data === undefined) return result;
    const substituted = this.data(index);
    return substituted === undefined
      ? result
      : { ...result, data: substituted as T };
  }
}

export interface ParticipantsHarness {
  readonly port: JolpicaParticipantsPort;
  readonly logger: CapturingLogger;
  readonly calls: readonly TransportRecord[];
  readonly reservations: readonly RealProviderSourceId[];
}

export interface ParticipantsHarnessOptions {
  readonly steps?: readonly TransportStep[];
  readonly limiter?: readonly ReservationStep[];
  readonly registry?: ProviderMappingRegistry;
  readonly participants?: CuratedParticipants;
  /** Substitutes the decoded body of successful response `n` (0-based). */
  readonly successData?: (index: number) => unknown;
  /** Runs after response `n` (0-based) has been produced. */
  readonly afterResponse?: (index: number) => void;
}

/** Builds the participants port over fakes only. No binding, no network. */
export function participantsHarness(
  options: ParticipantsHarnessOptions = {},
): ParticipantsHarness {
  const scripted = scriptedTransport(options.steps ?? completeScript());
  const limiter = scriptedLimiter(options.limiter ?? []);
  const logger = new CapturingLogger();
  const client = new SeamedClient(
    { transport: scripted.transport, limiter: limiter.limiter, logger },
    options.successData,
    options.afterResponse,
  );
  const port = new JolpicaParticipantsPort({
    client,
    logger,
    registry: options.registry ?? providerMappingRegistry(),
    ...(options.participants ? { participants: options.participants } : {}),
  });
  return {
    port,
    logger,
    calls: scripted.calls,
    reservations: limiter.reservations,
  };
}
