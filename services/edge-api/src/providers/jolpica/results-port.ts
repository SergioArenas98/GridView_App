/**
 * The Jolpica race-results port: the race `session-classification` resource
 * behind the coordination seam, and deliberately the **only** resource it
 * answers.
 *
 * **Dormant.** Nothing in production composition constructs, registers,
 * imports or bundles this. `src/index.ts` cannot reach it, `PROVIDER_MODE`
 * still admits exactly `mock | none`, `SynchronizationService` is unchanged,
 * and no binding, secret, route, cron or Wrangler variable enables it. Its
 * dormancy is proven by composition and dependency boundaries (ADR 0022
 * amendment A9), exactly like the calendar, circuits and participants ports.
 *
 * **It owns no transport of its own.** Every outbound request goes through the
 * hardened boundary (`providers/http/provider-http-client.ts`), which pins the
 * origin, forces `GET`, sends the identifying `User-Agent`, forwards no
 * cookies, credentials or authorization, reserves limiter capacity before
 * sending, refuses redirects and enforces the timeout, content-type and
 * response-size caps. The client is injected, so no real network function can
 * be reached from here.
 *
 * **Scope.** The race classification of one round only:
 * `GET /ergast/f1/{season}/{round}/results/?limit=100`. Every other resource,
 * and every other session type - qualifying, sprint, sprint qualifying - is
 * refused as `resource-unsupported` before any capacity is reserved, any
 * request is built, any transport runs and any attempt is counted. One
 * request, one attempt, no retry and no second page.
 *
 * **What it produces** is one normalized `RaceResult` (ADR 0023 amendment A2).
 * It creates no participation span and no season entry, derives no
 * `hasResults` and never reads another round (ADR 0026 D11).
 */

import type { Logger } from '../../logging/logger';
import type {
  CoordinatedSourceId,
  ProviderResourceOutcome,
  ProviderResourcePort,
  ProviderResourceRequest,
  ProviderTransportAttempt,
} from '../coordination';
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
import {
  normalizeRaceResults,
  type ResultsNormalization,
} from './results-normalizer';
import { decodeRaceResults, type ResultsDecodeResult } from './results-payload';

/**
 * The page size this port requests, sent explicitly rather than relying on an
 * upstream default that could change under us.
 *
 * On this endpoint `total` counts result rows; a race has 22 in 2026, so one
 * page covers it with room to spare. A response whose metadata says more rows
 * exist than were returned fails closed rather than being truncated or paged.
 */
export const resultsPageLimit = 100;

/** The documented Ergast-compatible path the hardened boundary pins. */
const resultsPathFor = (season: number, round: number): string =>
  `/ergast/f1/${season}/${round}/results/`;

export interface JolpicaResultsPortOptions {
  /** The hardened outbound boundary. Injected; never defaulted to `fetch`. */
  readonly client: ProviderHttpClient;
  readonly logger: Logger;
  /** Defaults to the process-wide curated registry. */
  readonly registry?: ProviderMappingRegistry;
  /**
   * Correlation tokens for transport attempts. An adapter-generated token,
   * never a URL, key or provider value, and never logged.
   */
  readonly reference?: () => string;
}

export class JolpicaResultsPort implements ProviderResourcePort {
  readonly sourceId: CoordinatedSourceId = 'jolpica';

  private readonly client: ProviderHttpClient;
  private readonly logger: Logger;
  private readonly registry: ProviderMappingRegistry;
  private readonly reference: () => string;
  private sequence = 0;

  constructor(options: JolpicaResultsPortOptions) {
    this.client = options.client;
    this.logger = options.logger;
    this.registry = options.registry ?? providerMappingRegistry();
    this.reference =
      options.reference ?? (() => `jolpica-results-${++this.sequence}`);
  }

  async fetchResource(
    request: ProviderResourceRequest,
  ): Promise<ProviderResourceOutcome> {
    const resource = request.resource;
    // Capability first. An unsupported resource or session type reserves no
    // capacity, builds no request, runs no transport and creates no attempt.
    if (
      resource.kind !== 'session-classification' ||
      resource.sessionType !== 'race'
    ) {
      return { outcome: 'not-attempted', reason: 'resource-unsupported' };
    }

    // Cancellation before anything is reserved, so a cancelled caller never
    // reaches the limiter.
    if (request.signal?.aborted) {
      return { outcome: 'not-attempted', reason: 'cancelled' };
    }

    // Season and round come from the requested resource, never a constant.
    const { season, round } = resource;
    const result = await this.client.getJson({
      sourceId: 'jolpica',
      path: resultsPathFor(season, round),
      query: { limit: resultsPageLimit },
      signal: request.signal,
    });
    if (!result.ok) return this.transportFailure(result);

    const attempt: ProviderTransportAttempt = {
      reference: this.reference(),
      outcome: 'successful',
    };

    // `result.data` is `unknown`, so the interface permits a value that throws
    // when it is merely read. The request was answered and its attempt is
    // established, so a throw is contained rather than discarding it. The raw
    // error is provider-derived and unbounded, so it is dropped.
    let decoded: ResultsDecodeResult;
    try {
      decoded = decodeRaceResults(result.data, season, round, resultsPageLimit);
    } catch {
      decoded = { ok: false, problem: 'envelope' };
    }
    if (!decoded.ok)
      return this.invalidPayload(season, attempt, decoded.problem);

    if (decoded.race === null) {
      // C-9: a structurally valid answer naming no race. It identifies no
      // event, so no result document can be built from it, and an empty
      // classification is never fabricated. The request was answered, so its
      // attempt stays `successful`.
      this.logger.warn({
        operation: 'provider.results.no_classification',
        providerSourceId: 'jolpica',
        providerRequestAttempted: true,
        season,
      });
      return {
        outcome: 'failed',
        attempts: [attempt],
        reason: 'provider-unavailable',
      };
    }

    let normalized: ResultsNormalization;
    try {
      normalized = normalizeRaceResults(decoded.race, season, this.registry);
    } catch {
      return this.invalidPayload(season, attempt, 'normalization');
    }

    if (normalized.ok) {
      return {
        outcome: 'candidate',
        attempts: [attempt],
        payload: { kind: 'session-classification', result: normalized.result },
      };
    }
    if (normalized.kind === 'mapping') {
      // The mapping boundary raises its own bounded signal. The outcome
      // carries nothing about the identity that failed.
      for (const failure of normalized.failures) {
        this.logger.error(providerMappingFailureEvent(failure));
      }
      return { outcome: 'mapping-failure', attempts: [attempt] };
    }
    return this.invalidPayload(season, attempt, normalized.problem);
  }

  /**
   * A response that was read and could not be normalized. It stays an
   * attempted request, counted once, never selected. Only a bounded closed
   * code is logged: no provider value, key or body fragment.
   */
  private invalidPayload(
    season: number,
    attempt: ProviderTransportAttempt,
    problem: string,
  ): ProviderResourceOutcome {
    this.logger.warn({
      operation: 'provider.results.invalid_payload',
      providerSourceId: 'jolpica',
      providerRequestAttempted: true,
      season,
      failureCategory: problem,
    });
    return {
      outcome: 'failed',
      attempts: [attempt],
      reason: 'invalid-payload',
    };
  }

  /**
   * Maps one hardened-boundary failure into the closed taxonomy, on exactly
   * the calendar and circuits ports' terms. `requestAttempted` is the
   * boundary's own statement about whether anything left GridView.
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
        attempts: [attempt],
        reason: 'provider-rate-limited',
        ...(failure.retryAfter ? { retryAfter: failure.retryAfter } : {}),
      };
    }
    // No retry here and none anywhere in this adapter: pacing and scheduling
    // belong to G5, not to a port.
    return {
      outcome: 'failed',
      attempts: [attempt],
      reason: 'provider-unavailable',
    };
  }
}

/**
 * The not-attempted reason for a boundary failure that sent nothing.
 * `invalid-request` is the adapter's own defect and is reported as
 * `resource-unsupported` rather than invented into a provider condition.
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
 * How an attempted failure ended at the transport layer, matching
 * `attemptOutcomesForFailureReason`: a `429` is rate-limited, a transport that
 * did not complete is `failed`, and GridView's own policy rejecting a response
 * that arrived is still a `successful` attempt.
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
