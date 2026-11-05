/**
 * One calendar GET to Jolpica, and nothing else (Cloudflare-to-Jolpica
 * comparison, 2026-11-05).
 *
 * The staging Worker's runs of 2026-11-03/04/05 were refused at request 1 to
 * 3, while one GitHub runner sent the same requests without a refusal. To
 * compare the two clients on one identical request, close in time, the
 * Worker must send exactly the season-calendar GET a run sends first -
 * `https://api.jolpi.ca/ergast/f1/{season}/races/?limit=100`, through the same
 * hardened client, pacer, limiter object and transport - and then stop. A
 * manual sync cannot do that: it would go on to 20+ requests, and publish if
 * they all passed.
 *
 * This module therefore never touches the calendar port's normalisation, the
 * coordinator, the ledger, a release, public data or any storage. The provider
 * rate limiter is the exception, by design: the reservation is counted, and a
 * 429 persists the limiter object's upstream hold exactly as a run's would. It returns closed facts
 * only: status, cache status, colo and ray, the race count of a 200, and for
 * a 429 the closed refusal facts and fingerprint. An active upstream hold in
 * the limiter object defers the request (nothing is sent); a 429 is reported
 * and held like any other; nothing is retried.
 */

import {
  buildProviderUrl,
  type ProviderHttpClient,
} from '../../providers/http/provider-http-client';
import type { RefusalFingerprint } from '../../providers/http/refusal-fingerprint';
import {
  calendarPageLimit,
  calendarPathFor,
  composeCoordinatedRuntime,
  type CoordinatedRuntimeDependencies,
  type CoordinatedUnavailableReason,
} from './composition';

/** The one URL this module may request, for the record. */
export function calendarSingleGetUrl(season: number): string {
  const url = buildProviderUrl('jolpica', calendarPathFor(season), {
    limit: calendarPageLimit,
  });
  if (!url) throw new Error('The calendar URL must always build.');
  return url.toString();
}

export type CalendarSingleGetResult =
  | {
      readonly outcome: 'answered';
      readonly url: string;
      readonly startedAt: string;
      readonly status: number;
      readonly cacheStatus: string;
      readonly edgeColo?: string;
      readonly ray?: string;
      /** `MRData.RaceTable.Races.length`, or `null` when not that shape. */
      readonly races: number | null;
    }
  | {
      readonly outcome: 'refused';
      readonly url: string;
      readonly startedAt: string;
      readonly status: 429;
      /** Parsed `Retry-After`, absolute UTC, when the provider sent one. */
      readonly retryAfter?: string;
      readonly refusal: Readonly<Record<string, string>>;
      readonly fingerprint?: RefusalFingerprint;
    }
  | {
      readonly outcome: 'failed';
      readonly url: string;
      readonly startedAt: string;
      readonly reason: string;
      readonly status?: number;
    }
  | {
      /** Nothing left GridView: an upstream hold, a window, or no limiter. */
      readonly outcome: 'not-sent';
      readonly url: string;
      readonly reason: string;
      readonly retryAt?: string;
    }
  | {
      readonly outcome: 'coordinated-runtime-unavailable';
      readonly reasons: readonly CoordinatedUnavailableReason[];
    };

function raceCount(data: unknown): number | null {
  if (typeof data !== 'object' || data === null) return null;
  const races = (data as { MRData?: { RaceTable?: { Races?: unknown } } })
    .MRData?.RaceTable?.Races;
  return Array.isArray(races) ? races.length : null;
}

/** Exactly one season-calendar GET through `client`; never retried. */
export async function getJolpicaCalendarOnce(
  client: ProviderHttpClient,
  season: number,
  now: () => Date,
): Promise<CalendarSingleGetResult> {
  const url = calendarSingleGetUrl(season);
  const startedAt = now().toISOString();
  const result = await client.getJson<unknown>({
    sourceId: 'jolpica',
    path: calendarPathFor(season),
    query: { limit: calendarPageLimit },
  });
  if (result.ok) {
    return {
      outcome: 'answered',
      url,
      startedAt,
      status: result.status,
      cacheStatus: result.cacheStatus ?? 'absent',
      ...(result.edgeColo ? { edgeColo: result.edgeColo } : {}),
      ...(result.ray ? { ray: result.ray } : {}),
      races: raceCount(result.data),
    };
  }
  if (!result.requestAttempted) {
    return {
      outcome: 'not-sent',
      url,
      reason: result.kind,
      ...(result.retryAt ? { retryAt: result.retryAt } : {}),
    };
  }
  if (result.kind === 'provider-rate-limited') {
    return {
      outcome: 'refused',
      url,
      startedAt,
      status: 429,
      ...(result.retryAfter ? { retryAfter: result.retryAfter } : {}),
      refusal: result.refusal?.fields ?? {},
      ...(result.refusal?.fingerprint
        ? { fingerprint: result.refusal.fingerprint }
        : {}),
    };
  }
  return {
    outcome: 'failed',
    url,
    startedAt,
    reason: result.kind,
    ...(result.status === undefined ? {} : { status: result.status }),
  };
}

/**
 * The single GET through the coordinated runtime's own gate (ADR 0022 A9), as
 * the egress identity probe composes its one request: the hardened client,
 * the per-run pacer, the limiter object and the transport are a run's own,
 * and nothing else constructs them.
 */
export async function getCalendarOnceUnderComposition(
  dependencies: CoordinatedRuntimeDependencies,
  season: number,
): Promise<CalendarSingleGetResult> {
  const composition = composeCoordinatedRuntime(dependencies);
  if (composition.kind === 'unavailable') {
    return {
      outcome: 'coordinated-runtime-unavailable',
      reasons: composition.reasons,
    };
  }
  return getJolpicaCalendarOnce(composition.runtime.client, season, () =>
    dependencies.clock.now(),
  );
}
