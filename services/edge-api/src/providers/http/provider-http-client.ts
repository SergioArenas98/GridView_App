import type { Logger } from '../../logging/logger';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from './provider-rate-limiter';
import type {
  LimitingWindow,
  RealProviderSourceId,
} from './reservation-engine';

/**
 * The single hardened boundary through which every future real provider
 * request must pass (gap G7).
 *
 * No adapter exists yet and nothing calls this with a real transport, so no
 * GridView request reaches Jolpica or OpenF1. What this closes is the seam: a
 * future adapter cannot call global `fetch`, cannot choose an origin, and
 * cannot skip pacing, because the only way out is through here.
 */

/**
 * Chosen engineering constants. Tunable only while preserving the security
 * invariants they exist to enforce (bounded wait, bounded memory).
 */
export const providerRequestTimeoutMillis = 10_000;
export const providerMaxResponseBytes = 2 * 1024 * 1024; // 2 MiB

/**
 * Upper bound on a `Retry-After` delta. Anything beyond a year is not a usable
 * instruction, and accepting an arbitrary integer lets a provider-controlled
 * header build an unrepresentable `Date`.
 */
export const maxRetryAfterSeconds = 366 * 24 * 60 * 60;

/**
 * Jolpica requires a stable identifying `User-Agent`. Held as one reviewed
 * constant rather than assembled from a runtime string, so it cannot drift or
 * leak host detail.
 */
export const gridViewUserAgent =
  'GridView/1.0 (+https://github.com/SergioArenas98/GridView_App)';

interface ProviderEndpoint {
  readonly origin: string;
  /** Documented API prefix; a path must sit inside it. */
  readonly pathPrefix: string;
  /** Only Jolpica documents a mandatory identifying User-Agent. */
  readonly sendUserAgent: boolean;
}

const providerEndpoints: Record<RealProviderSourceId, ProviderEndpoint> = {
  jolpica: {
    origin: 'https://api.jolpi.ca',
    pathPrefix: '/ergast/f1/',
    sendUserAgent: true,
  },
  openf1: {
    origin: 'https://api.openf1.org',
    pathPrefix: '/v1/',
    sendUserAgent: false,
  },
};

export function providerEndpointFor(
  sourceId: RealProviderSourceId,
): ProviderEndpoint {
  return providerEndpoints[sourceId];
}

export type ProviderHttpFailureKind =
  /** GridView declined to send. No request was attempted. */
  | 'rate-limit-deferred'
  /** The limiter could not decide. Fail closed; no request was attempted. */
  | 'limiter-unavailable'
  /** The caller's request could not be built safely. Nothing was attempted. */
  | 'invalid-request'
  | 'timeout'
  | 'cancelled'
  | 'network'
  | 'redirect-rejected'
  | 'invalid-content-type'
  | 'response-too-large'
  | 'malformed-json'
  | 'provider-http-error'
  /** Upstream answered 429 *after* a request was attempted. */
  | 'provider-rate-limited';

export interface ProviderHttpSuccess<T> {
  readonly ok: true;
  readonly sourceId: RealProviderSourceId;
  readonly status: number;
  readonly data: T;
  /** Always true: a success implies a request left GridView. */
  readonly requestAttempted: true;
}

export interface ProviderHttpFailure {
  readonly ok: false;
  readonly sourceId: RealProviderSourceId;
  readonly kind: ProviderHttpFailureKind;
  /**
   * Whether a request actually left GridView. This is what separates a local
   * deferral from a provider failure for accounting purposes.
   */
  readonly requestAttempted: boolean;
  readonly status?: number;
  /** Local pacing: when the limiter says capacity returns. */
  readonly retryAt?: string;
  readonly limitingWindows?: readonly LimitingWindow[];
  /** Upstream instruction parsed from a 429 `Retry-After`, when present. */
  readonly retryAfter?: string;
}

export type ProviderHttpResult<T> =
  ProviderHttpSuccess<T> | ProviderHttpFailure;

export interface ProviderRequest {
  readonly sourceId: RealProviderSourceId;
  /** Relative path inside the source's documented prefix. Never an origin. */
  readonly path: string;
  readonly query?: Readonly<Record<string, string | number | boolean>>;
  /** Caller cancellation. Distinct from the internal timeout. */
  readonly signal?: AbortSignal;
}

/**
 * Injected transport. Required rather than defaulted to global `fetch`, so a
 * real network call can only ever come from an explicit production wiring and
 * every test necessarily supplies a fake.
 */
export type ProviderTransport = (request: Request) => Promise<Response>;

const jsonContentType = /^application\/(?:[\w.+-]+\+)?json$/i;

/** Accepts `application/json` and `application/*+json`, with parameters. */
export function isAcceptedJsonContentType(value: string | null): boolean {
  if (!value) return false;
  const [mediaType] = value.split(';');
  if (!mediaType) return false;
  return jsonContentType.test(mediaType.trim());
}

/**
 * Parses `Retry-After` in both delta-seconds and HTTP-date form.
 *
 * At the exact boundary an expired instruction is not active, matching
 * `retryAfterActive` in the quota model. A missing or malformed value returns
 * `null`: GridView never invents a provider instruction.
 */
export function parseRetryAfter(value: string | null, at: Date): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    // A provider-controlled header must never produce an unrepresentable date.
    // Without this bound `new Date(...).toISOString()` throws `RangeError`, and
    // because this runs inside the request try-block that throw would be
    // swallowed and the 429 silently reclassified as a network failure.
    if (seconds > maxRetryAfterSeconds) return null;
    const time = at.getTime() + seconds * 1000;
    if (!Number.isFinite(time)) return null;
    return new Date(time).toISOString();
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  if (parsed <= at.getTime()) return null;
  return new Date(parsed).toISOString();
}

/**
 * Builds the absolute URL from the fixed origin plus a validated relative
 * path and structured query.
 *
 * The caller never supplies an origin. Anything that would resolve outside the
 * selected source's origin and documented prefix is rejected before any
 * network work: absolute URLs, protocol-relative input, credentials,
 * fragments, unexpected ports, alternative or lookalike hosts, and traversal.
 */
export function buildProviderUrl(
  sourceId: RealProviderSourceId,
  path: string,
  query?: Readonly<Record<string, string | number | boolean>>,
): URL | null {
  const endpoint = providerEndpoints[sourceId];
  if (typeof path !== 'string' || path.length === 0) return null;
  // Reject anything that is not a plain relative path.
  if (path.includes('\\')) return null;
  if (path.startsWith('//')) return null;
  if (path.includes('#') || path.includes('?')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return null;
  if (!path.startsWith('/')) return null;
  if (path.split('/').includes('..')) return null;
  if (!path.startsWith(endpoint.pathPrefix)) return null;

  let url: URL;
  try {
    url = new URL(path, endpoint.origin);
  } catch {
    return null;
  }
  // Re-verify after resolution: origin, credentials, port and prefix.
  if (url.origin !== endpoint.origin) return null;
  if (url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  if (url.port !== '') return null;
  if (url.hash !== '') return null;
  if (!url.pathname.startsWith(endpoint.pathPrefix)) return null;

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (typeof key !== 'string' || key.length === 0) return null;
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

/**
 * Reads at most `limit` bytes, cancelling the stream as soon as the cap is
 * exceeded. Returns `null` when the body is too large.
 *
 * Streaming is enforced independently of `Content-Length`, so a missing or
 * dishonest header cannot bypass the cap.
 */
async function readBounded(
  response: Response,
  limit: number,
): Promise<string | null> {
  const body = response.body;
  if (!body) return '';
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

async function discard(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Cancelling a already-consumed or errored stream is not itself a failure.
  }
}

export interface ProviderHttpClientOptions {
  readonly transport: ProviderTransport;
  readonly limiter: ProviderRateLimiterClient;
  readonly logger: Logger;
  readonly now?: () => Date;
  readonly timeoutMillis?: number;
  readonly maxResponseBytes?: number;
}

export class ProviderHttpClient {
  private readonly transport: ProviderTransport;
  private readonly limiter: ProviderRateLimiterClient;
  private readonly logger: Logger;
  private readonly now: () => Date;
  private readonly timeoutMillis: number;
  private readonly maxResponseBytes: number;

  constructor(options: ProviderHttpClientOptions) {
    this.transport = options.transport;
    this.limiter = options.limiter;
    this.logger = options.logger;
    this.now = options.now ?? (() => new Date());
    this.timeoutMillis = options.timeoutMillis ?? providerRequestTimeoutMillis;
    this.maxResponseBytes =
      options.maxResponseBytes ?? providerMaxResponseBytes;
  }

  async getJson<T = unknown>(
    request: ProviderRequest,
  ): Promise<ProviderHttpResult<T>> {
    const { sourceId } = request;
    const url = buildProviderUrl(sourceId, request.path, request.query);
    if (!url) {
      // Never log the offending path or query: it is caller-controlled input.
      return this.failure(sourceId, 'invalid-request', false);
    }

    if (request.signal?.aborted) {
      // The caller was already gone before we got here, so there is nothing to
      // acquire capacity for. Reserving first would burn a slot out of the
      // single global per-source budget on behalf of a request that will never
      // be sent - three dead callers would exhaust an OpenF1 second and deny a
      // live one. Checked before the reservation, not after it.
      return this.failure(sourceId, 'cancelled', false);
    }

    const reservation = await this.reserveCapacity(sourceId);
    if (reservation.outcome === 'unavailable') {
      return this.failure(sourceId, 'limiter-unavailable', false);
    }
    if (reservation.outcome === 'deferred') {
      return {
        ok: false,
        sourceId,
        kind: 'rate-limit-deferred',
        requestAttempted: false,
        retryAt: reservation.retryAt,
        limitingWindows: reservation.limitingWindows,
      };
    }

    return this.send<T>(request, url);
  }

  private async reserveCapacity(
    sourceId: RealProviderSourceId,
  ): Promise<ReservationOutcome> {
    let outcome: ReservationOutcome;
    try {
      outcome = await this.limiter.reserve(sourceId);
    } catch {
      outcome = {
        outcome: 'unavailable',
        sourceId,
        reason: 'limiter-unreachable',
      };
    }
    if (outcome.outcome === 'allowed') {
      this.logger.info({
        operation: 'provider.reservation.allowed',
        providerSourceId: sourceId,
        providerRequestAttempted: false,
        providerWindowHeadroom: headroomCounts(outcome.headroom),
      });
    } else if (outcome.outcome === 'deferred') {
      this.logger.info({
        operation: 'provider.reservation.deferred',
        providerSourceId: sourceId,
        providerRequestAttempted: false,
        providerRetryAt: outcome.retryAt,
        providerLimitingWindow: outcome.limitingWindows
          .map((window) => window.window)
          .join(','),
        providerWindowHeadroom: headroomCounts(outcome.headroom),
      });
    } else {
      this.logger.error({
        operation: 'provider.reservation.unavailable',
        providerSourceId: sourceId,
        providerRequestAttempted: false,
        // Bounded enum only: never a stored value, storage key or object id.
        failureCategory: outcome.reason,
      });
    }
    return outcome;
  }

  private async send<T>(
    request: ProviderRequest,
    url: URL,
  ): Promise<ProviderHttpResult<T>> {
    const { sourceId } = request;
    const endpoint = providerEndpoints[sourceId];
    const startedAt = this.now().getTime();

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMillis);
    const onCallerAbort = () => controller.abort();
    if (request.signal?.aborted) {
      // The caller aborted *while the reservation was in flight*, so a slot was
      // already granted. It is deliberately NOT released: keeping it is the
      // conservative choice and avoids a release race. No request leaves
      // GridView, so this is not an attempted provider request.
      //
      // `addEventListener` would never fire for an already-aborted signal, so
      // short-circuiting here also avoids hanging until the internal timeout.
      clearTimeout(timer);
      return {
        ok: false,
        sourceId,
        kind: 'cancelled',
        requestAttempted: false,
      };
    }
    request.signal?.addEventListener('abort', onCallerAbort, { once: true });

    const headers = new Headers({ Accept: 'application/json' });
    if (endpoint.sendUserAgent) {
      headers.set('User-Agent', gridViewUserAgent);
    }

    try {
      // No caller headers, no cookies, no Authorization: neither adopted
      // source authenticates, so nothing may be forwarded.
      const outbound = new Request(url.toString(), {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });
      const response = await this.transport(outbound);

      if (response.status >= 300 && response.status < 400) {
        await discard(response);
        return this.attemptedFailure(
          sourceId,
          'redirect-rejected',
          response.status,
          startedAt,
        );
      }

      if (response.status === 429) {
        const retryAfter = parseRetryAfter(
          response.headers.get('Retry-After'),
          this.now(),
        );
        await discard(response);
        this.logger.warn({
          operation: 'provider.request.rate_limited',
          providerSourceId: sourceId,
          providerRequestAttempted: true,
          status: 429,
          durationMs: this.now().getTime() - startedAt,
          ...(retryAfter ? { providerRetryAfter: retryAfter } : {}),
        });
        return {
          ok: false,
          sourceId,
          kind: 'provider-rate-limited',
          requestAttempted: true,
          status: 429,
          ...(retryAfter ? { retryAfter } : {}),
        };
      }

      if (!response.ok) {
        await discard(response);
        return this.attemptedFailure(
          sourceId,
          'provider-http-error',
          response.status,
          startedAt,
        );
      }

      if (!isAcceptedJsonContentType(response.headers.get('Content-Type'))) {
        await discard(response);
        return this.attemptedFailure(
          sourceId,
          'invalid-content-type',
          response.status,
          startedAt,
        );
      }

      const declared = Number.parseInt(
        response.headers.get('Content-Length') ?? '',
        10,
      );
      if (Number.isFinite(declared) && declared > this.maxResponseBytes) {
        // Trustworthy oversize declaration: reject without reading the body.
        await discard(response);
        return this.attemptedFailure(
          sourceId,
          'response-too-large',
          response.status,
          startedAt,
        );
      }

      const text = await readBounded(response, this.maxResponseBytes);
      if (text === null) {
        return this.attemptedFailure(
          sourceId,
          'response-too-large',
          response.status,
          startedAt,
        );
      }

      let data: T;
      try {
        data = JSON.parse(text) as T;
      } catch {
        // The parser message can quote provider bytes: never surface it.
        return this.attemptedFailure(
          sourceId,
          'malformed-json',
          response.status,
          startedAt,
        );
      }

      this.logger.info({
        operation: 'provider.request.completed',
        providerSourceId: sourceId,
        providerRequestAttempted: true,
        status: response.status,
        durationMs: this.now().getTime() - startedAt,
      });
      return {
        ok: true,
        sourceId,
        status: response.status,
        data,
        requestAttempted: true,
      };
    } catch {
      // A transport rejection is never surfaced or logged: it can embed the
      // URL, provider detail or host information.
      const kind: ProviderHttpFailureKind = timedOut
        ? 'timeout'
        : request.signal?.aborted
          ? 'cancelled'
          : 'network';
      return this.attemptedFailure(sourceId, kind, undefined, startedAt);
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onCallerAbort);
    }
  }

  private attemptedFailure(
    sourceId: RealProviderSourceId,
    kind: ProviderHttpFailureKind,
    status: number | undefined,
    startedAt: number,
  ): ProviderHttpFailure {
    this.logger.warn({
      operation: 'provider.request.failed',
      providerSourceId: sourceId,
      providerRequestAttempted: true,
      failureCategory: kind,
      durationMs: this.now().getTime() - startedAt,
      ...(status === undefined ? {} : { status }),
    });
    return {
      ok: false,
      sourceId,
      kind,
      requestAttempted: true,
      ...(status === undefined ? {} : { status }),
    };
  }

  private failure(
    sourceId: RealProviderSourceId,
    kind: ProviderHttpFailureKind,
    requestAttempted: boolean,
  ): ProviderHttpFailure {
    return { ok: false, sourceId, kind, requestAttempted };
  }
}

/** Bounded integer headroom for structured logs. Never a provider value. */
function headroomCounts(
  headroom: readonly { window: string; remaining: number }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const window of headroom) counts[window.window] = window.remaining;
  return counts;
}
