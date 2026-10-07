/**
 * The season-batch generator's only transport and only limiter.
 *
 * The transport answers from recorded responses and from nothing else: it
 * never calls `fetch`, opens no socket and resolves no host. A request for a
 * URL that was not recorded, or for one already answered, is refused with a
 * thrown error - which the hardened HTTP client reports as a transport failure
 * - and counted, so the generator can refuse the whole capture with an exact
 * reason instead of a generic unavailable resource.
 *
 * The limiter grants every reservation. Pacing protects a provider from
 * requests, and a replay sends none; the real limiter and pacer stay the only
 * ones any request that reaches a provider can pass through.
 */

import type { ProviderTransport } from '../../src/providers/http/provider-http-client';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from '../../src/providers/http/provider-rate-limiter';
import type { RealProviderSourceId } from '../../src/providers/http/reservation-engine';

/** One response as it was recorded, with its verified body. */
export interface RecordedResponse {
  readonly url: string;
  readonly status: number;
  readonly contentType: string;
  readonly body: Uint8Array;
}

/** What the replay was asked for, by count only. */
export interface ReplayUsage {
  /** Recordings answered exactly once. */
  readonly served: number;
  /** Requests for a URL with no recording. */
  readonly unrecorded: number;
  /** Requests for a recording that had already been answered. */
  readonly repeated: number;
  /** Requests with a method other than `GET`. */
  readonly unexpectedMethod: number;
  /** Recordings never requested. */
  readonly unrequested: number;
}

export interface Replay {
  readonly transport: ProviderTransport;
  usage(): ReplayUsage;
}

export function replayTransport(
  recordings: readonly RecordedResponse[],
): Replay {
  const byUrl = new Map<string, RecordedResponse>();
  for (const recording of recordings) {
    if (byUrl.has(recording.url)) {
      throw new TypeError('A replay holds at most one recording per URL.');
    }
    byUrl.set(recording.url, recording);
  }
  const served = new Set<string>();
  let unrecorded = 0;
  let repeated = 0;
  let unexpectedMethod = 0;

  const transport: ProviderTransport = async (request) => {
    if (request.method !== 'GET') {
      unexpectedMethod += 1;
      throw new TypeError('The replay answers GET requests only.');
    }
    const recording = byUrl.get(request.url);
    if (recording === undefined) {
      unrecorded += 1;
      throw new TypeError('No recording exists for this request.');
    }
    if (served.has(request.url)) {
      repeated += 1;
      throw new TypeError('This recording was already answered.');
    }
    served.add(request.url);
    // A copy, so nothing downstream can alter the verified recording.
    return new Response(recording.body.slice(), {
      status: recording.status,
      headers: {
        'Content-Type': recording.contentType,
        'Content-Length': String(recording.body.byteLength),
      },
    });
  };

  return {
    transport,
    usage: () => ({
      served: served.size,
      unrecorded,
      repeated,
      unexpectedMethod,
      unrequested: byUrl.size - served.size,
    }),
  };
}

/** Grants every reservation: a replay sends nothing to pace. */
export const replayLimiter: ProviderRateLimiterClient = {
  async reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome> {
    return { outcome: 'allowed', sourceId, headroom: [] };
  },
};
