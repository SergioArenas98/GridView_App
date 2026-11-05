/**
 * One-request egress identity probe against Jolpica F1's `GET /test/`
 * (Cloudflare-to-Jolpica 429 investigation, 2026-11-05).
 *
 * Jolpica's own source (`jolpica_api/views.py`, added 2024-04-28 together
 * with its client-IP middleware) answers `/test/` with the request's
 * `REMOTE_ADDR` **after** `client_ip_middleware` has replaced it with the last
 * `X-Forwarded-For` entry - the value its anonymous throttles key on - plus
 * the raw `X-Forwarded-For`, whether its own `2/10s` non-blocking `test`
 * counter is over, the user, the deployed version and a server timestamp. It
 * is not part of the documented API and does not touch the `ergast` throttle
 * group.
 *
 * What this module returns is closed: an address is echoed only when it is
 * the address Cloudflare documents for cross-zone Worker subrequests or lies
 * inside Cloudflare's `2a06:98c0::/29`; any other address - which could be a
 * cached answer to somebody else - is reported by class only.
 */

import type { ProviderHttpClient } from '../../providers/http/provider-http-client';
import {
  composeCoordinatedRuntime,
  type CoordinatedRuntimeDependencies,
  type CoordinatedUnavailableReason,
} from './composition';

/** The only path the probe requests. */
export const jolpicaEgressIdentityPath = '/test/';

/**
 * Cloudflare: "In cross-zone subrequests from one Cloudflare zone to another
 * Cloudflare zone, the CF-Connecting-IP value will be set to the Worker client
 * IP address '2a06:98c0:3600::103'".
 */
export const documentedWorkerAddress = '2a06:98c0:3600::103';

/** A server timestamp further from GridView's clock than this is not fresh. */
export const freshnessToleranceSeconds = 300;

/**
 * `cf-cache-status` values whose body Cloudflare fetched from the origin for
 * this request. `HIT`, `STALE`, `UPDATING` and `REVALIDATED` serve a cached
 * body (Cloudflare, "Cloudflare cache responses"), which may be an earlier
 * caller's; an absent or unknown status is not trusted either.
 */
export const originServedCacheStatuses: ReadonlySet<string> = new Set([
  'DYNAMIC',
  'MISS',
  'EXPIRED',
  'BYPASS',
]);

export type EgressAddressClass =
  /** Exactly the documented Worker address. */
  | 'documented-worker-address'
  /** In the same /64 (django-ratelimit's default IPv6 key mask). */
  | 'worker-prefix'
  /** Elsewhere in Cloudflare's 2a06:98c0::/29. */
  | 'cloudflare-range'
  | 'other-ipv6'
  | 'other-ipv4'
  | 'invalid'
  | 'absent';

export interface EgressAddressFact {
  readonly class: EgressAddressClass;
  /** Present only for the three Cloudflare classes. */
  readonly value?: string;
}

export type EgressIdentityResult =
  | {
      readonly outcome: 'observed';
      /** Jolpica's `REMOTE_ADDR` after its middleware: the throttle key. */
      readonly remoteAddress: EgressAddressFact;
      readonly forwardedFor: {
        readonly hops: number;
        readonly classes: readonly EgressAddressClass[];
      };
      /** Whether `REMOTE_ADDR` equals the last `X-Forwarded-For` entry. */
      readonly remoteIsLastForwarded: boolean;
      /** The `/test/` view's own `2/10s` counter; not the ergast throttles. */
      readonly testCounterOver: boolean | null;
      readonly anonymous: boolean | null;
      readonly version: string | null;
      /** Server timestamp minus GridView's clock, read as UTC. */
      readonly timestampSkewSeconds: number | null;
      /** Origin-served for this request (`originServedCacheStatuses`) with a current timestamp. */
      readonly fresh: boolean;
      readonly cacheStatus: string;
    }
  | {
      /** A 200 whose body is not the `/test/` shape. */
      readonly outcome: 'unrecognised';
      readonly cacheStatus: string;
    }
  | {
      /** Nothing left GridView: a limiter deferral (an active hold) or failure. */
      readonly outcome: 'not-sent';
      readonly reason: string;
      readonly retryAt?: string;
    }
  | {
      readonly outcome: 'failed';
      readonly reason: string;
      readonly status?: number;
      readonly retryAfter?: string;
    }
  | {
      /** The coordinated runtime did not compose: nothing was sent. */
      readonly outcome: 'coordinated-runtime-unavailable';
      readonly reasons: readonly CoordinatedUnavailableReason[];
    };

/** Eight 16-bit groups, or `null` when not a plain IPv6 literal. */
export function ipv6Groups(literal: string): number[] | null {
  const text = literal.trim().toLowerCase();
  if (!/^[0-9a-f:]{2,39}$/.test(text)) return null;
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string): number[] | null => {
    if (part === '') return [];
    const groups = part.split(':');
    const values: number[] = [];
    for (const group of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      values.push(Number.parseInt(group, 16));
    }
    return values;
  };
  const head = parse(halves[0] ?? '');
  const tail = halves.length === 2 ? parse(halves[1] ?? '') : [];
  if (!head || !tail) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const missing = 8 - head.length - tail.length;
  if (missing < 1) return null;
  return [...head, ...new Array<number>(missing).fill(0), ...tail];
}

const ipv4Pattern =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

const workerGroups = ipv6Groups(documentedWorkerAddress)!;

export function classifyAddress(value: unknown): EgressAddressFact {
  if (value === undefined || value === null || value === '') {
    return { class: 'absent' };
  }
  if (typeof value !== 'string' || value.length > 64) {
    return { class: 'invalid' };
  }
  const text = value.trim();
  if (ipv4Pattern.test(text)) return { class: 'other-ipv4' };
  const groups = ipv6Groups(text);
  if (!groups) return { class: 'invalid' };
  const canonical = groups.map((group) => group.toString(16)).join(':');
  if (groups.every((group, index) => group === workerGroups[index])) {
    return {
      class: 'documented-worker-address',
      value: documentedWorkerAddress,
    };
  }
  if (
    groups.slice(0, 4).every((group, index) => group === workerGroups[index])
  ) {
    return { class: 'worker-prefix', value: canonical };
  }
  if (groups[0] === 0x2a06 && ((groups[1] ?? 0) & 0xfff8) === 0x98c0) {
    return { class: 'cloudflare-range', value: canonical };
  }
  return { class: 'other-ipv6' };
}

const versionPattern = /^[A-Za-z0-9._+-]{1,40}$/;

/** Django serialises a naive `datetime.now()` as ISO without an offset. */
function skewSeconds(value: unknown, now: Date): number | null {
  if (typeof value !== 'string' || value.length > 40) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/.test(value)) {
    return null;
  }
  const parsed = Date.parse(`${value.slice(0, 23)}Z`);
  if (Number.isNaN(parsed)) return null;
  const skew = Math.round((parsed - now.getTime()) / 1000);
  return Math.max(-86_400, Math.min(86_400, skew));
}

/** Reads the `/test/` body into closed facts; `null` when it is not that shape. */
export function readEgressIdentity(
  data: unknown,
  now: Date,
  cacheStatus: string,
): EgressIdentityResult | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }
  const body = data as Record<string, unknown>;
  if (!('REMOTE_ADDR' in body) || !('HTTP_X_FORWARDED_FOR' in body)) {
    return null;
  }
  const remoteAddress = classifyAddress(body.REMOTE_ADDR);
  const forwarded =
    typeof body.HTTP_X_FORWARDED_FOR === 'string' &&
    body.HTTP_X_FORWARDED_FOR.length <= 512
      ? body.HTTP_X_FORWARDED_FOR.split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry !== '')
      : [];
  const hops = forwarded.slice(0, 10);
  const last = hops.at(-1);
  const skew = skewSeconds(body.timestamp, now);
  return {
    outcome: 'observed',
    remoteAddress,
    forwardedFor: {
      hops: forwarded.length,
      classes: hops.map((entry) => classifyAddress(entry).class),
    },
    remoteIsLastForwarded:
      typeof body.REMOTE_ADDR === 'string' &&
      last !== undefined &&
      body.REMOTE_ADDR.trim() === last,
    testCounterOver:
      typeof body.ratelimited === 'boolean' ? body.ratelimited : null,
    anonymous:
      typeof body.user === 'string' ? body.user === 'AnonymousUser' : null,
    version:
      typeof body.v === 'string' && versionPattern.test(body.v) ? body.v : null,
    timestampSkewSeconds: skew,
    fresh:
      skew !== null &&
      Math.abs(skew) <= freshnessToleranceSeconds &&
      originServedCacheStatuses.has(cacheStatus),
    cacheStatus,
  };
}

/**
 * Sends exactly one `GET https://api.jolpi.ca/test/` through the hardened
 * client: limiter reservation first (an active upstream hold defers it and
 * nothing is sent), a 429 reported and held like any other, never retried.
 */
export async function probeJolpicaEgressIdentity(
  client: ProviderHttpClient,
  now: () => Date,
): Promise<EgressIdentityResult> {
  const result = await client.getJson<unknown>({
    sourceId: 'jolpica',
    path: jolpicaEgressIdentityPath,
  });
  if (!result.ok) {
    if (!result.requestAttempted) {
      return {
        outcome: 'not-sent',
        reason: result.kind,
        ...(result.retryAt ? { retryAt: result.retryAt } : {}),
      };
    }
    return {
      outcome: 'failed',
      reason: result.kind,
      ...(result.status === undefined ? {} : { status: result.status }),
      ...(result.retryAfter ? { retryAfter: result.retryAfter } : {}),
    };
  }
  const cacheStatus = result.cacheStatus ?? 'absent';
  return (
    readEgressIdentity(result.data, now(), cacheStatus) ?? {
      outcome: 'unrecognised',
      cacheStatus,
    }
  );
}

/**
 * The probe through the coordinated runtime's own gate, as an operator
 * verification composes its one request (ADR 0022 A9): the hardened client,
 * the per-run pacer, the limiter object and the transport are the ones a
 * coordinated run would use, and nothing else constructs them.
 */
export async function probeEgressIdentityUnderComposition(
  dependencies: CoordinatedRuntimeDependencies,
): Promise<EgressIdentityResult> {
  const composition = composeCoordinatedRuntime(dependencies);
  if (composition.kind === 'unavailable') {
    return {
      outcome: 'coordinated-runtime-unavailable',
      reasons: composition.reasons,
    };
  }
  return probeJolpicaEgressIdentity(composition.runtime.client, () =>
    dependencies.clock.now(),
  );
}
