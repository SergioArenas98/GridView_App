/**
 * The Jolpica season-calendar port: the first adapter behind the coordination
 * seam, and deliberately the **only** resource it answers.
 *
 * **Dormant.** Nothing in production composition constructs, registers,
 * imports or bundles this. `src/index.ts` cannot reach it, `PROVIDER_MODE`
 * still admits exactly `mock | none`, `SynchronizationService` is unchanged,
 * and no binding, secret, route, cron or Wrangler variable enables it. Its
 * dormancy is proven by composition and dependency boundaries rather than by
 * a neutral file name (ADR 0022 amendment A9), which is why this file is
 * honestly called what it is.
 *
 * **It owns no transport of its own.** Every outbound request goes through the
 * hardened boundary (`providers/http/provider-http-client.ts`), which pins the
 * origin, forces `GET`, sends the identifying `User-Agent`, forwards no
 * cookies, credentials or authorization, reserves limiter capacity before
 * sending, and enforces the timeout, redirect, content-type and response-size
 * caps. This adapter never calls global `fetch`, never builds a second client
 * and never names an origin: the client is injected, so a test necessarily
 * supplies a fake and no real network function can be reached from here.
 *
 * **Scope.** Season calendar only. Every other coordinated resource is
 * refused as `resource-unsupported` before any capacity is reserved, any
 * request is built, any transport runs and any attempt is counted. Participant
 * pagination, event schedules, classifications, standings and the A7
 * assembly-owned `hasResults` correction all belong to later slices.
 */

import type { Logger } from '../../logging/logger';
import type {
  ProviderResourceOutcome,
  ProviderResourcePort,
  ProviderResourceRequest,
  ProviderTransportAttempt,
} from '../coordination';
import type { CoordinatedSourceId } from '../coordination';
import type {
  ProviderHttpClient,
  ProviderHttpFailure,
} from '../http/provider-http-client';
import {
  providerMappingFailureEvent,
  providerMappingRegistry,
  type ProviderMappingRegistry,
} from '../mappings';
import type { ProviderAttemptOutcome } from '../provider-metrics';
import { decodeSeasonCalendar } from './calendar-payload';
import { normalizeSeasonCalendar } from './calendar-normalizer';
import { curatedEventNames, type CuratedEventNames } from './curated-events';

/**
 * The page size this slice requests, sent explicitly rather than relying on an
 * upstream default that could change under us.
 *
 * The 2026 calendar is 23 rows (Provider Evaluation §8.8), so one page covers
 * it with room to spare. A response whose metadata says more rows exist than
 * were returned fails closed rather than publishing a truncated calendar.
 */
export const calendarPageLimit = 100;

/** The documented Ergast-compatible path prefix the hardened boundary pins. */
const calendarPathFor = (season: number): string =>
  `/ergast/f1/${season}/races/`;

export interface JolpicaCalendarPortOptions {
  /** The hardened outbound boundary. Injected; never defaulted to `fetch`. */
  readonly client: ProviderHttpClient;
  readonly logger: Logger;
  /** Defaults to the process-wide curated registry. */
  readonly registry?: ProviderMappingRegistry;
  readonly eventNames?: CuratedEventNames;
  /**
   * Correlation tokens for transport attempts. Injected so a test can pin
   * them; it is an adapter-generated token, never a URL, key or provider
   * value, and it is never logged.
   */
  readonly reference?: () => string;
}

export class JolpicaCalendarPort implements ProviderResourcePort {
  readonly sourceId: CoordinatedSourceId = 'jolpica';

  private readonly client: ProviderHttpClient;
  private readonly logger: Logger;
  private readonly registry: ProviderMappingRegistry;
  private readonly eventNames: CuratedEventNames;
  private readonly reference: () => string;
  private sequence = 0;

  constructor(options: JolpicaCalendarPortOptions) {
    this.client = options.client;
    this.logger = options.logger;
    this.registry = options.registry ?? providerMappingRegistry();
    this.eventNames = options.eventNames ?? curatedEventNames();
    this.reference =
      options.reference ?? (() => `jolpica-calendar-${++this.sequence}`);
  }

  async fetchResource(
    request: ProviderResourceRequest,
  ): Promise<ProviderResourceOutcome> {
    // Capability first, and before everything else. An unsupported resource
    // reserves no capacity, builds no request, runs no transport and creates
    // no attempt - so it can never be miscounted as one.
    if (request.resource.kind !== 'season-calendar') {
      return { outcome: 'not-attempted', reason: 'resource-unsupported' };
    }

    // Cancellation before anything is reserved. The hardened boundary checks
    // this too, but doing it here means a cancelled caller never even reaches
    // the limiter, and the two agree that nothing was attempted.
    if (request.signal?.aborted) {
      return { outcome: 'not-attempted', reason: 'cancelled' };
    }

    const season = request.resource.season;
    const result = await this.client.getJson({
      sourceId: 'jolpica',
      path: calendarPathFor(season),
      // The season comes from the requested resource, never from a constant.
      query: { limit: calendarPageLimit },
      signal: request.signal,
    });

    if (!result.ok) return this.transportFailure(result);

    const attempt: ProviderTransportAttempt = {
      reference: this.reference(),
      outcome: 'successful',
    };

    const decoded = decodeSeasonCalendar(
      result.data,
      season,
      calendarPageLimit,
    );
    if (!decoded.ok) {
      // The response was read and could not be normalized under the adapter's
      // rules. It stays an attempted request, counted once, never selected.
      this.logger.warn({
        operation: 'provider.calendar.invalid_payload',
        providerSourceId: 'jolpica',
        providerRequestAttempted: true,
        season,
        // A bounded closed code. No provider value, key or body fragment.
        failureCategory: decoded.problem,
      });
      return { outcome: 'failed', attempt, reason: 'invalid-payload' };
    }

    const normalized = normalizeSeasonCalendar(
      decoded.races,
      season,
      this.registry,
      this.eventNames,
    );
    if (!normalized.ok) {
      // The mapping boundary raises its own bounded signal here; the outcome
      // carries nothing about the identity that failed, because the
      // coordinator must contain the failure rather than re-report it.
      for (const failure of normalized.failures) {
        this.logger.error(providerMappingFailureEvent(failure));
      }
      return { outcome: 'mapping-failure', attempt };
    }

    return {
      outcome: 'candidate',
      attempt,
      payload: { kind: 'season-calendar', events: normalized.events },
    };
  }

  /**
   * Maps one hardened-boundary failure into the existing closed taxonomy.
   *
   * `requestAttempted` is the boundary's own statement about whether anything
   * left GridView, and it is what decides between a `not-attempted` outcome
   * and an attempted failure. Nothing is re-derived from the failure kind, so
   * the adapter can never contradict the transport layer about a request it
   * did not make itself. No raw provider value or body is carried across.
   */
  private transportFailure(
    failure: ProviderHttpFailure,
  ): ProviderResourceOutcome {
    if (!failure.requestAttempted) {
      return {
        outcome: 'not-attempted',
        reason: notAttemptedReasonFor(failure.kind),
        ...(failure.retryAt ? { retryAt: failure.retryAt } : {}),
      };
    }

    const attempt: ProviderTransportAttempt = {
      reference: this.reference(),
      outcome: attemptOutcomeFor(failure.kind),
    };
    if (failure.kind === 'provider-rate-limited') {
      return {
        outcome: 'failed',
        attempt,
        reason: 'provider-rate-limited',
        ...(failure.retryAfter ? { retryAfter: failure.retryAfter } : {}),
      };
    }
    // Every remaining attempted kind is a transport-level failure of a request
    // that did leave. There is no retry here and none anywhere in this
    // adapter: pacing and scheduling belong to G5, not to a port.
    return { outcome: 'failed', attempt, reason: 'provider-unavailable' };
  }
}

/**
 * The not-attempted reason for a boundary failure that sent nothing.
 *
 * `invalid-request` is the adapter's own defect - a path or query this module
 * built that the boundary refused - and it is reported as `resource-
 * unsupported` rather than invented into a provider or limiter condition: no
 * request was made, no capacity was consumed, and nothing about the provider
 * is known.
 */
function notAttemptedReasonFor(
  kind: ProviderHttpFailure['kind'],
):
  | 'rate-limit-deferred'
  | 'limiter-unavailable'
  | 'cancelled'
  | 'resource-unsupported' {
  switch (kind) {
    case 'rate-limit-deferred':
      return 'rate-limit-deferred';
    case 'limiter-unavailable':
      return 'limiter-unavailable';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'resource-unsupported';
  }
}

/**
 * How an attempted failure ended at the transport layer.
 *
 * The pairings match `attemptOutcomesForFailureReason` exactly: a `429` is the
 * rate-limited attempt it was, a transport that did not complete is `failed`,
 * and GridView's own policy rejecting a response that *arrived* is still a
 * `successful` attempt, because the request left and was answered.
 */
function attemptOutcomeFor(
  kind: ProviderHttpFailure['kind'],
): ProviderAttemptOutcome {
  switch (kind) {
    case 'provider-rate-limited':
      return 'rate-limited';
    case 'invalid-content-type':
    case 'response-too-large':
    case 'malformed-json':
      return 'successful';
    default:
      return 'failed';
  }
}
