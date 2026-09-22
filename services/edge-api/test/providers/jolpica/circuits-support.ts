/**
 * Fixtures and doubles for the Jolpica season-circuits port tests.
 *
 * **Nothing here is a preserved provider response.** Every envelope is built
 * from synthetic values or from provider values already committed to the
 * curated mapping file. The complete 2026 projection is rebuilt from
 * `content/seasons/2026/provider-mappings.development.json` at test time, and
 * a circuit row carries only `circuitId` unless a test deliberately adds a
 * synthetic descriptive field to prove it is ignored. No real name, locality,
 * country or coordinate appears anywhere.
 *
 * **Nothing here can reach the network.** The limiters and transports are the
 * calendar tests' in-memory doubles, reused unchanged.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CapturingLogger } from '../../../src/logging/logger';
import { ProviderHttpClient } from '../../../src/providers/http/provider-http-client';
import type {
  ProviderHttpClientOptions,
  ProviderHttpResult,
  ProviderRequest,
} from '../../../src/providers/http/provider-http-client';
import type { ProviderRateLimiterClient } from '../../../src/providers/http/provider-rate-limiter';
import {
  JolpicaCircuitsPort,
  type CuratedCircuits,
} from '../../../src/providers/jolpica';
import {
  buildProviderMappingRegistry,
  curatedRegistries,
  providerMappingRegistry,
  type ProviderMappingRegistry,
} from '../../../src/providers/mappings';
import {
  LIMIT,
  SEASON,
  allowingLimiter,
  jsonTransport,
  type RecordingTransport,
  type TransportRecord,
} from './support';

const repoRoot = join(__dirname, '..', '..', '..', '..', '..');

export interface CircuitsEnvelopeOptions {
  readonly season?: unknown;
  readonly limit?: unknown;
  readonly offset?: unknown;
  /** Defaults to the number of rows supplied. */
  readonly total?: unknown;
}

/** Builds the Ergast-compatible envelope Jolpica answers with. */
export function circuitsEnvelope(
  rows: readonly unknown[],
  options: CircuitsEnvelopeOptions = {},
): Record<string, unknown> {
  const has = (key: keyof CircuitsEnvelopeOptions) => key in options;
  return {
    MRData: {
      limit: has('limit') ? options.limit : String(LIMIT),
      offset: has('offset') ? options.offset : '0',
      total: has('total') ? options.total : String(rows.length),
      CircuitTable: {
        season: has('season') ? options.season : String(SEASON),
        Circuits: rows,
      },
    },
  };
}

/** One circuit row: the identity, plus any synthetic field a test adds. */
export function circuitRow(
  circuitId: unknown,
  extra: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return { circuitId, ...extra };
}

/**
 * Synthetic descriptive fields, shaped like the ones Jolpica publishes beside
 * `circuitId`. Every value is obviously invented so a leak is unmistakable.
 */
export const syntheticDescription: Readonly<Record<string, unknown>> = {
  url: 'https://example.invalid/synthetic-circuit',
  circuitName: 'Synthetic Provider Circuit Name',
  Location: {
    lat: '12.3456',
    long: '65.4321',
    locality: 'Synthetic Provider Locality',
    country: 'Synthetic Provider Country',
  },
};

/** One curated 2026 circuit mapping, read from committed content. */
export interface CuratedCircuitMapping {
  readonly providerValue: string;
  readonly gridviewId: string;
}

export function curatedCircuitMappings(): readonly CuratedCircuitMapping[] {
  const path = join(
    repoRoot,
    'content',
    'seasons',
    '2026',
    'provider-mappings.development.json',
  );
  const document = JSON.parse(readFileSync(path, 'utf8')) as {
    mappings: readonly {
      source: string;
      entity: string;
      providerField: string;
      providerValue: string;
      gridviewId: string;
    }[];
  };
  return document.mappings
    .filter(
      (mapping) =>
        mapping.source === 'jolpica' &&
        mapping.entity === 'circuit' &&
        mapping.providerField === 'circuitId',
    )
    .map(({ providerValue, gridviewId }) => ({ providerValue, gridviewId }));
}

/** The curated circuit registry rows, read from committed content. */
export function curatedRegistryRows(): readonly Record<string, unknown>[] {
  const path = join(repoRoot, 'content', 'registries', 'circuits.mock.json');
  return (
    JSON.parse(readFileSync(path, 'utf8')) as {
      circuits: Record<string, unknown>[];
    }
  ).circuits;
}

/** Every curated 2026 circuit, as a minimal projection: identities only. */
export function fullSeasonCircuitRows(): readonly Record<string, unknown>[] {
  return curatedCircuitMappings().map((mapping) =>
    circuitRow(mapping.providerValue),
  );
}

/**
 * The real client, with the decoded body of a **successful** response replaced
 * by an arbitrary value - the one way to hand the port a value `JSON.parse`
 * can never produce, such as a non-finite number or a throwing accessor. The
 * limiter, the transport and every response check still run exactly once.
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

export interface CircuitsHarness {
  readonly port: JolpicaCircuitsPort;
  readonly logger: CapturingLogger;
  readonly calls: readonly TransportRecord[];
}

export interface CircuitsHarnessOptions {
  readonly transport?: RecordingTransport;
  readonly limiter?: ProviderRateLimiterClient;
  /** Replaces the curated mapping registry. */
  readonly registry?: ProviderMappingRegistry;
  /** Replaces every mapping with none, for the unmapped-identity cases. */
  readonly emptyRegistry?: boolean;
  /** Replaces the curated circuit content. */
  readonly circuits?: CuratedCircuits;
  /** Substitutes the decoded body the client hands the port on success. */
  readonly successData?: () => unknown;
}

/** Builds the circuits port over fakes only. No binding, no network, no clock. */
export function circuitsHarness(
  options: CircuitsHarnessOptions = {},
): CircuitsHarness {
  const recording = options.transport ?? jsonTransport(circuitsEnvelope([]));
  const logger = new CapturingLogger();
  const clientOptions = {
    transport: recording.transport,
    limiter: options.limiter ?? allowingLimiter,
    logger,
  };
  const client = options.successData
    ? new SubstitutedDataClient(clientOptions, options.successData)
    : new ProviderHttpClient(clientOptions);
  const registry =
    options.registry ??
    (options.emptyRegistry
      ? buildProviderMappingRegistry([], curatedRegistries())
      : providerMappingRegistry());
  const port = new JolpicaCircuitsPort({
    client,
    logger,
    registry,
    ...(options.circuits ? { circuits: options.circuits } : {}),
  });
  return { port, logger, calls: recording.calls };
}
