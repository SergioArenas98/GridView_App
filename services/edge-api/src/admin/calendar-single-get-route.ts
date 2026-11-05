/**
 * The staging-only operator route for one Jolpica season-calendar GET
 * (Cloudflare-to-Jolpica comparison, 2026-11-05).
 *
 * ```
 * POST /internal/admin/provider/jolpica/calendar-once?season=YYYY
 * ```
 *
 * It sits under `/internal/admin/`, so `handleAdminRequest` has already
 * enforced `ADMIN_TOKEN`. It is not in the public OpenAPI document. Each call
 * sends at most one `GET https://api.jolpi.ca/ergast/f1/{season}/races/?limit=100`
 * - the first request of every coordinated run - composed through the
 * coordinated runtime's own gate, and then stops: no other resource, no
 * classification, and it alters no ledger, release, pointer, cache, KV or
 * public data, so it can never continue into a run or publish. The one state
 * it can change is the provider rate limiter's, exactly as any run's request
 * does: the reservation is counted, an active upstream hold defers it
 * (nothing is sent), and a `429` persists the limiter object's upstream hold
 * (at least 60 s, longer under `Retry-After`) as intended, so no later
 * Jolpica request - this route's, a probe's or a run's - is sent before it
 * ends. Its answer and its log line carry closed facts only
 * (`sync/coordinated/calendar-single-get.ts`).
 *
 * Refused with `404`, before anything is composed, outside staging or when
 * the Worker is not in `coordinated` mode.
 */

import { jsonResponse } from '../http/envelope';
import type { Logger } from '../logging/logger';
import { getCalendarOnceUnderComposition } from '../sync/coordinated/calendar-single-get';
import type { CoordinatedRuntimeDependencies } from '../sync/coordinated/composition';

export const calendarSingleGetPath =
  '/internal/admin/provider/jolpica/calendar-once';

export interface CalendarSingleGetContext {
  /** `ENVIRONMENT` as configured; only `staging` is served. */
  readonly environment: string | undefined;
  readonly coordinated: boolean;
  /** The coordinated runtime's gated dependencies; resolving them built nothing. */
  readonly dependencies: CoordinatedRuntimeDependencies;
  readonly logger: Logger;
  readonly requestId: string;
}

function refusal(
  status: number,
  code: string,
  message: string,
  requestId: string,
  headers: Record<string, string> = {},
): Response {
  return jsonResponse(
    { error: { code, message, requestId } },
    status,
    requestId,
    {
      'Cache-Control': 'no-store',
      ...headers,
    },
  );
}

export async function handleCalendarSingleGetRequest(
  request: Request,
  url: URL,
  context: CalendarSingleGetContext,
): Promise<Response> {
  const { requestId } = context;
  if (request.method !== 'POST') {
    return refusal(
      405,
      'METHOD_NOT_ALLOWED',
      'The requested method is not allowed.',
      requestId,
      { Allow: 'POST' },
    );
  }
  if (context.environment !== 'staging' || !context.coordinated) {
    return refusal(404, 'NOT_FOUND', 'Not found.', requestId);
  }
  const raw = url.searchParams.get('season');
  if (
    raw === null ||
    !/^\d{4}$/.test(raw) ||
    [...url.searchParams.keys()].some((key) => key !== 'season')
  ) {
    return refusal(400, 'INVALID_PARAMETER', 'invalid-season', requestId);
  }
  const season = Number(raw);

  const result = await getCalendarOnceUnderComposition(
    context.dependencies,
    season,
  );

  context.logger.info({
    operation: 'provider.calendar_single_get',
    providerSourceId: 'jolpica',
    season,
    providerSingleGetOutcome: result.outcome,
    ...(result.outcome === 'answered'
      ? { status: result.status, providerCacheStatus: result.cacheStatus }
      : {}),
    ...(result.outcome === 'refused' ? { status: 429 } : {}),
  });

  return jsonResponse(
    { data: result, requestId },
    result.outcome === 'coordinated-runtime-unavailable' ? 503 : 200,
    requestId,
    { 'Cache-Control': 'no-store' },
  );
}
