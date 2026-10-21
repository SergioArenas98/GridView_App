/**
 * The controlled provider source of the automatic-updates staging
 * demonstration (ADR 0028 D10; release gate AU-3).
 *
 * In an isolated staging-class Worker, the coordinated runtime's Jolpica
 * transport can answer from **controlled documents in the Worker's own KV
 * namespace** instead of the network. Every other part of the path is
 * unchanged: the ports build their exact Jolpica URLs, the hardened client
 * reserves through the global limiter and validates every response, and the
 * orchestration, guard and sequencer decide as they do against Jolpica. So a
 * newly available result can be shown reaching the app with no live
 * provider request, no capture and no submission.
 *
 * **Time-aware.** Each document holds versions with the instant each becomes
 * what "Jolpica" serves, so one load before the demonstration plays a whole
 * race weekend - the result appearing, a correction - without anyone acting
 * during it.
 *
 * **Fenced.** `CONTROLLED_PROVIDER_SOURCE = "kv"` is admitted only in
 * `staging` with `PROVIDER_MODE = "coordinated"`; anything else is a
 * configuration error, and production can never select it
 * (`resolveControlledProviderSource`). Only URLs under the Jolpica origin and
 * path the hardened client pins are answered; a key that is absent answers
 * `404`, and a stored document that is not exactly this shape answers `503`,
 * so a mistake fails the run closed instead of publishing.
 *
 * Key: `__controlled-source/v1/jolpica` + the request's path and query, for
 * example `__controlled-source/v1/jolpica/ergast/f1/2026/races/?limit=100`.
 */

import {
  ConfigurationError,
  type EnvironmentName,
  type ProviderMode,
} from '../../config/environment';
import {
  providerEndpointFor,
  type ProviderTransport,
} from '../http/provider-http-client';

export const CONTROLLED_SOURCE_KEY_PREFIX = '__controlled-source/v1/jolpica';

/** The one Jolpica endpoint the hardened boundary pins; never restated. */
const jolpica = providerEndpointFor('jolpica');

/** At most this many versions per document, so a read stays bounded. */
export const MAX_CONTROLLED_VERSIONS = 32;

export interface ControlledVersion {
  /** From this instant on, this version is what the source serves. */
  readonly from: string;
  /** The HTTP status served: 200, or a failure to rehearse. */
  readonly status: number;
  readonly body: unknown;
}

export interface ControlledDocument {
  readonly schemaVersion: 1;
  /** Sorted by `from`, strictly increasing. */
  readonly versions: readonly ControlledVersion[];
}

/** Which controlled source a Worker selects: none, or its own KV. */
export type ControlledProviderSource = 'none' | 'kv';

/**
 * Resolves `CONTROLLED_PROVIDER_SOURCE`, failing closed on anything that is
 * not exactly unset or `kv` in a coordinated staging Worker.
 */
export function resolveControlledProviderSource(
  value: string | undefined,
  environment: EnvironmentName,
  providerMode: ProviderMode,
): ControlledProviderSource {
  if (value === undefined || value === '') return 'none';
  if (value !== 'kv') {
    throw new ConfigurationError('Unknown CONTROLLED_PROVIDER_SOURCE.');
  }
  if (environment !== 'staging' || providerMode !== 'coordinated') {
    throw new ConfigurationError(
      'A controlled provider source is admitted only in a coordinated staging Worker.',
    );
  }
  return 'kv';
}

/** The KV key for `url`, or `null` for any URL outside the Jolpica path. */
export function controlledSourceKey(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== jolpica.origin) return null;
  if (!parsed.pathname.startsWith(jolpica.pathPrefix)) return null;
  if (parsed.username !== '' || parsed.password !== '' || parsed.hash !== '') {
    return null;
  }
  return `${CONTROLLED_SOURCE_KEY_PREFIX}${parsed.pathname}${parsed.search}`;
}

/** The stored value, if it is exactly a controlled document. */
export function decodeControlledDocument(
  value: unknown,
): ControlledDocument | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== 'schemaVersion,versions') {
    return null;
  }
  if (record.schemaVersion !== 1 || !Array.isArray(record.versions)) {
    return null;
  }
  const versions = record.versions as unknown[];
  if (versions.length === 0 || versions.length > MAX_CONTROLLED_VERSIONS) {
    return null;
  }
  let previous = Number.NEGATIVE_INFINITY;
  for (const version of versions) {
    if (typeof version !== 'object' || version === null) return null;
    const entry = version as Record<string, unknown>;
    if (Object.keys(entry).sort().join(',') !== 'body,from,status') return null;
    if (typeof entry.from !== 'string') return null;
    const from = Date.parse(entry.from);
    if (Number.isNaN(from) || new Date(from).toISOString() !== entry.from) {
      return null;
    }
    if (from <= previous) return null;
    previous = from;
    if (
      typeof entry.status !== 'number' ||
      !Number.isInteger(entry.status) ||
      entry.status < 200 ||
      entry.status > 599
    ) {
      return null;
    }
  }
  return value as ControlledDocument;
}

/** The version in force at `now`, or `null` before the first. */
export function versionAt(
  document: ControlledDocument,
  now: Date,
): ControlledVersion | null {
  let current: ControlledVersion | null = null;
  for (const version of document.versions) {
    if (Date.parse(version.from) <= now.getTime()) current = version;
  }
  return current;
}

/** The read the transport needs from a KV namespace. */
export interface ControlledSourceStore {
  get(key: string, type: 'json'): Promise<unknown>;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

/**
 * A provider transport answering from `store`. It reads one key per request
 * and never reaches the network.
 */
export function controlledSourceTransport(
  store: ControlledSourceStore,
  now: () => Date,
): ProviderTransport {
  return async (request) => {
    const key = controlledSourceKey(request.url);
    if (key === null || request.method !== 'GET') {
      return new Response('{}', { status: 404, headers: jsonHeaders });
    }
    let stored: unknown;
    try {
      stored = await store.get(key, 'json');
    } catch {
      return new Response('{}', { status: 503, headers: jsonHeaders });
    }
    if (stored === null || stored === undefined) {
      return new Response('{}', { status: 404, headers: jsonHeaders });
    }
    const document = decodeControlledDocument(stored);
    if (document === null) {
      return new Response('{}', { status: 503, headers: jsonHeaders });
    }
    const version = versionAt(document, now());
    if (version === null) {
      return new Response('{}', { status: 404, headers: jsonHeaders });
    }
    return new Response(JSON.stringify(version.body), {
      status: version.status,
      headers: jsonHeaders,
    });
  };
}
