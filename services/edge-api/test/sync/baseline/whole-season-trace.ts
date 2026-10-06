/**
 * A deterministic trace of everything the Worker's entry points do in the
 * whole-season modes (`mock`, `none`) and in the configurations that refuse a
 * mode, for one fixed sequence of calls.
 *
 * The trace records, per step: the HTTP answer (status, cache headers and a
 * SHA-256 of the body), the mock provider's request count, the number of
 * storage calls and a digest of their method names in order, every log line
 * (with its wall-clock duration
 * zeroed) and the coordinated traffic counters - limiter reservations,
 * transport calls and global `fetch` calls. Request IDs come from the request
 * header and every `crypto.randomUUID` answer is a counter, so two runs over
 * the same source produce identical traces.
 *
 * `whole-season-trace.json` holds the trace as the baseline source (`192e83d`)
 * produced it, before the coordinated orchestration was connected.
 */

import { createHash } from 'node:crypto';

import { vi } from 'vitest';

import worker, { type Env } from '../../../src/index';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from '../../../src/providers/http/provider-rate-limiter';
import type { MemorySnapshotStorage } from '../../../src/storage/local';
import {
  adminRequest,
  createHarness,
  providerCalls,
  request,
} from '../../support/edge-harness';

/** Every environment and provider-mode combination a configuration can name. */
export const combinations: readonly (readonly [string, string | null])[] = [
  ['development', 'mock'],
  ['development', 'none'],
  ['development', null],
  ['development', 'coordinated'],
  ['staging', 'mock'],
  ['staging', 'none'],
  ['staging', null],
  ['production', 'none'],
  ['production', null],
  ['production', 'mock'],
];

type Step =
  | { readonly kind: 'scheduled' }
  | {
      readonly kind: 'fetch';
      readonly method: string;
      readonly path: string;
      readonly body?: unknown;
      readonly token?: string;
      readonly admin: boolean;
    };

const admin = (
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Step => ({ kind: 'fetch', method, path, body, token, admin: true });
const read = (path: string): Step => ({
  kind: 'fetch',
  method: 'GET',
  path,
  admin: false,
});

/** The fixed call sequence: every entry point, twice for the sync paths. */
export const steps: readonly Step[] = [
  { kind: 'scheduled' },
  admin('POST', '/internal/admin/sync/full'),
  admin('POST', '/internal/admin/sync/resource', { resource: 'standings' }),
  admin('POST', '/internal/admin/rebuild/home'),
  admin('GET', '/internal/admin/sync/status'),
  admin('GET', '/internal/admin/quota'),
  admin('POST', '/internal/admin/cache/purge'),
  admin('POST', '/internal/admin/rollback'),
  admin('GET', '/internal/admin/reconciliation?season=2026'),
  admin('POST', '/internal/admin/sync/full', undefined, 'wrong-token'),
  admin('POST', '/internal/admin/unknown'),
  read('/v1/status'),
  read('/v1/home?season=2026'),
  read('/v1/seasons/2026'),
  read('/v1/seasons/2026/calendar'),
  read('/v1/seasons/2026/standings/drivers'),
  { kind: 'scheduled' },
  admin('POST', '/internal/admin/sync/full'),
];

export interface StepTrace {
  readonly step: string;
  readonly status: number | null;
  readonly cacheControl: string | null;
  readonly etag: string | null;
  readonly bodySha256: string | null;
  readonly providerCalls: number;
  /** How many storage calls the step made, and a digest of their names in order. */
  readonly storage: { readonly calls: number; readonly sha256: string };
  readonly logs: readonly Record<string, unknown>[];
  readonly reservations: number;
  readonly transport: number;
  readonly fetch: number;
}

class CountingLimiter implements ProviderRateLimiterClient {
  calls = 0;
  async reserve(
    sourceId: Parameters<ProviderRateLimiterClient['reserve']>[0],
  ): Promise<ReservationOutcome> {
    this.calls += 1;
    return { outcome: 'allowed', sourceId, headroom: [] };
  }
}

/** `storage`, with the name of every method called recorded in `calls`. */
function recording(
  storage: MemorySnapshotStorage,
  calls: string[],
): MemorySnapshotStorage {
  return new Proxy(storage, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== 'function' || typeof property !== 'string') {
        return value;
      }
      return (...args: unknown[]) => {
        calls.push(property);
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
}

function digestOf(calls: readonly string[]): StepTrace['storage'] {
  return {
    calls: calls.length,
    sha256: createHash('sha256').update(calls.join('\n')).digest('hex'),
  };
}

/** One step per line, so a difference names the step it is in. */
export function serializeTrace(trace: Record<string, StepTrace[]>): string {
  const combos = Object.entries(trace).map(
    ([key, stepTraces]) =>
      `  ${JSON.stringify(key)}: [\n${stepTraces
        .map((step) => `    ${JSON.stringify(step)}`)
        .join(',\n')}\n  ]`,
  );
  return `{\n${combos.join(',\n')}\n}\n`;
}

/**
 * One combination's trace, from a fresh harness. `extra` adds fields to the
 * Worker's environment - such as a ledger binding, which the traced
 * environments do not carry - and changes nothing else.
 */
export async function traceCombination(
  environment: string,
  providerMode: string | null,
  extra: Partial<Env> = {},
): Promise<StepTrace[]> {
  let uuid = 0;
  const randomUUID = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    uuid += 1;
    const hex = uuid.toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${hex}` as `${string}-${string}-${string}-${string}-${string}`;
  });
  const globalFetch = vi.fn(async () => {
    throw new Error('the global fetch must not be reached');
  });
  vi.stubGlobal('fetch', globalFetch);
  try {
    const harness = createHarness({
      environment,
      providerMode: providerMode ?? 'none',
    });
    const storageCalls: string[] = [];
    const limiter = new CountingLimiter();
    let transportCalls = 0;
    const env: Env = {
      ...harness.env,
      PUBLIC_BASE_URL: 'https://api.gridview.test',
      __LOCAL_STORAGE: recording(harness.storage, storageCalls),
      __PROVIDER_RATE_LIMITER: limiter,
      __PROVIDER_TRANSPORT: async () => {
        transportCalls += 1;
        return new Response('{}', { status: 503 });
      },
      ...extra,
    };
    if (providerMode === null) delete env.PROVIDER_MODE;

    const traces: StepTrace[] = [];
    let index = 0;
    for (const step of steps) {
      index += 1;
      const providerBefore = providerCalls(harness.provider);
      const logsBefore = harness.logger.events.length;
      const storageBefore = storageCalls.length;
      const counters = [
        limiter.calls,
        transportCalls,
        globalFetch.mock.calls.length,
      ];
      let response: Response | null = null;
      if (step.kind === 'scheduled') {
        await worker.scheduled?.({} as ScheduledController, env);
      } else {
        const base = step.admin
          ? adminRequest(step.path, step.token, step.body, step.method)
          : request(step.path, step.method);
        const headers = new Headers(base.headers);
        headers.set('X-Request-ID', `trace-${index}`);
        response = await worker.fetch(new Request(base, { headers }), env);
      }
      const text = response === null ? null : await response.text();
      traces.push({
        step:
          step.kind === 'scheduled'
            ? 'scheduled'
            : `${step.method} ${step.path}${step.token ? ' (unauthorized)' : ''}`,
        status: response?.status ?? null,
        cacheControl: response?.headers.get('Cache-Control') ?? null,
        etag: response?.headers.get('ETag') ?? null,
        bodySha256:
          text === null
            ? null
            : createHash('sha256').update(text).digest('hex'),
        providerCalls: providerCalls(harness.provider) - providerBefore,
        storage: digestOf(storageCalls.slice(storageBefore)),
        logs: harness.logger.events
          .slice(logsBefore)
          .map((event) =>
            'durationMs' in event ? { ...event, durationMs: 0 } : { ...event },
          ),
        reservations: limiter.calls - counters[0]!,
        transport: transportCalls - counters[1]!,
        fetch: globalFetch.mock.calls.length - counters[2]!,
      });
    }
    return traces;
  } finally {
    randomUUID.mockRestore();
    vi.unstubAllGlobals();
  }
}

/** Every combination's trace, keyed `environment/mode`. */
export async function wholeSeasonTrace(
  extra: Partial<Env> = {},
): Promise<Record<string, StepTrace[]>> {
  const trace: Record<string, StepTrace[]> = {};
  for (const [environment, mode] of combinations) {
    trace[`${environment}/${mode ?? 'unset'}`] = await traceCombination(
      environment,
      mode,
      extra,
    );
  }
  return trace;
}

const inspection = 'GET /internal/admin/reconciliation?season=2026';

/**
 * `trace` without the one answer a bound ledger changes: the read-only
 * inspection route (PR-E2) lists `ledger-unbound` among its `503` reasons only
 * while no ledger is resolved, so that reason and the body carrying it are
 * dropped. Every other step is kept as it is.
 */
export function withoutInspectionReasons(
  trace: Record<string, StepTrace[]>,
): Record<string, StepTrace[]> {
  return Object.fromEntries(
    Object.entries(trace).map(([key, steps]) => [
      key,
      steps.map((step) =>
        step.step !== inspection || step.status !== 503
          ? step
          : {
              ...step,
              bodySha256: null,
              logs: step.logs.map((line) => ({
                ...line,
                coordinationMissingDependencies: (
                  (line.coordinationMissingDependencies as string[]) ?? []
                ).filter((reason) => reason !== 'ledger-unbound'),
              })),
            },
      ),
    ]),
  );
}
