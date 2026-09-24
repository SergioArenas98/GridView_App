/**
 * The Jolpica season-circuits port: the second resource behind the
 * coordination seam, and deliberately the **only** resource it answers.
 *
 * **Dormant.** Nothing in production composition constructs, registers,
 * imports or bundles this. `src/index.ts` cannot reach it, `PROVIDER_MODE`
 * still admits exactly `mock | none`, `SynchronizationService` is unchanged,
 * and no binding, secret, route, cron or Wrangler variable enables it. Its
 * dormancy is proven by composition and dependency boundaries (ADR 0022
 * amendment A9), exactly like the calendar port beside it.
 *
 * **It owns no transport of its own.** Every outbound request goes through the
 * hardened boundary (`providers/http/provider-http-client.ts`), which pins the
 * origin, forces `GET`, sends the identifying `User-Agent`, forwards no
 * cookies, credentials or authorization, reserves limiter capacity before
 * sending, and enforces the timeout, redirect, content-type and response-size
 * caps. The client is injected, so no real network function can be reached
 * from here.
 *
 * **Scope.** Season circuits only. Every other coordinated resource is refused
 * as `resource-unsupported` before any capacity is reserved, any request is
 * built, any transport runs and any attempt is counted. The calendar port is a
 * separate class and is not changed by this one.
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
import { normalizeSeasonCircuits } from './circuits-normalizer';
import {
  decodeSeasonCircuits,
  type CircuitsDecodeResult,
} from './circuits-payload';
import { curatedCircuits, type CuratedCircuits } from './curated-circuits';

/**
 * The page size this resource requests, sent explicitly rather than relying
 * on the upstream default of 30 (Provider Evaluation §8.7, M10).
 *
 * 100 is the documented cap. The 2026 season recorded 24 circuit rows (§8.4),
 * so one page covers it with room to spare; a response whose metadata says more
 * rows exist than were returned fails closed rather than being truncated.
 */
export const circuitsPageLimit = 100;

/** The documented Ergast-compatible path the hardened boundary pins. */
const circuitsPathFor = (season: number): string =>
  `/ergast/f1/${season}/circuits/`;

export interface JolpicaCircuitsPortOptions {
  /** The hardened outbound boundary. Injected; never defaulted to `fetch`. */
  readonly client: ProviderHttpClient;
  readonly logger: Logger;
  /** Defaults to the process-wide curated registry. */
  readonly registry?: ProviderMappingRegistry;
  /** Defaults to the committed curated circuit registry. */
  readonly circuits?: CuratedCircuits;
  /**
   * Correlation tokens for transport attempts. An adapter-generated token,
   * never a URL, key or provider value, and never logged.
   */
  readonly reference?: () => string;
}

export class JolpicaCircuitsPort implements ProviderResourcePort {
  readonly sourceId: CoordinatedSourceId = 'jolpica';

  private readonly client: ProviderHttpClient;
  private readonly logger: Logger;
  private readonly registry: ProviderMappingRegistry;
  private readonly circuits: CuratedCircuits;
  private readonly reference: () => string;
  private sequence = 0;

  constructor(options: JolpicaCircuitsPortOptions) {
    this.client = options.client;
    this.logger = options.logger;
    this.registry = options.registry ?? providerMappingRegistry();
    this.circuits = options.circuits ?? curatedCircuits();
    this.reference =
      options.reference ?? (() => `jolpica-circuits-${++this.sequence}`);
  }

  async fetchResource(
    request: ProviderResourceRequest,
  ): Promise<ProviderResourceOutcome> {
    // Capability first. An unsupported resource reserves no capacity, builds
    // no request, runs no transport and creates no attempt.
    if (request.resource.kind !== 'season-circuits') {
      return { outcome: 'not-attempted', reason: 'resource-unsupported' };
    }

    // Cancellation before anything is reserved, so a cancelled caller never
    // reaches the limiter.
    if (request.signal?.aborted) {
      return { outcome: 'not-attempted', reason: 'cancelled' };
    }

    const season = request.resource.season;
    const result = await this.client.getJson({
      sourceId: 'jolpica',
      path: circuitsPathFor(season),
      // The season comes from the requested resource, never from a constant.
      query: { limit: circuitsPageLimit },
      signal: request.signal,
    });

    if (!result.ok) return this.transportFailure(result);

    const attempt: ProviderTransportAttempt = {
      reference: this.reference(),
      outcome: 'successful',
    };

    // `result.data` is `unknown`, so the interface permits a value that throws
    // when it is merely read. The port stays total for what its interface
    // allows: a throw here would discard a request the provider did answer.
    let decoded: CircuitsDecodeResult;
    try {
      decoded = decodeSeasonCircuits(result.data, season, circuitsPageLimit);
    } catch {
      // The raw error is provider-derived and unbounded, so it is dropped.
      decoded = { ok: false, problem: 'envelope' };
    }
    if (!decoded.ok) {
      return this.invalidPayload(attempt, season, decoded.problem);
    }

    let normalized: ReturnType<typeof normalizeSeasonCircuits>;
    try {
      normalized = normalizeSeasonCircuits(
        decoded.circuits,
        season,
        this.registry,
        this.circuits,
      );
    } catch {
      // Normalization reads only values this module built and curated
      // content, so this is not expected; but an escaped exception would
      // discard an answered attempt, so it is contained the same way.
      return this.invalidPayload(attempt, season, 'normalization');
    }

    if (!normalized.ok) {
      if (normalized.kind === 'mapping') {
        // The mapping boundary raises its own bounded signal. The outcome
        // carries nothing about the identity that failed.
        for (const failure of normalized.failures) {
          this.logger.error(providerMappingFailureEvent(failure));
        }
        return { outcome: 'mapping-failure', attempts: [attempt] };
      }
      if (normalized.problem === 'curated-circuit-missing') {
        // A resolved identity with no curated content is GridView's own gap,
        // not the provider's: it is contained as an unresolved identity.
        this.logger.error({
          operation: 'provider.circuits.curated_content_missing',
          providerSourceId: 'jolpica',
          providerRequestAttempted: true,
          season,
          failureCategory: normalized.problem,
        });
        return { outcome: 'mapping-failure', attempts: [attempt] };
      }
      return this.invalidPayload(attempt, season, normalized.problem);
    }

    return {
      outcome: 'candidate',
      attempts: [attempt],
      payload: { kind: 'season-circuits', circuits: normalized.circuits },
    };
  }

  /**
   * A response that was read and could not be normalized. It stays an
   * attempted request, counted once, never selected. Only a bounded closed
   * code is logged: no provider value, key or body fragment.
   */
  private invalidPayload(
    attempt: ProviderTransportAttempt,
    season: number,
    failureCategory: string,
  ): ProviderResourceOutcome {
    this.logger.warn({
      operation: 'provider.circuits.invalid_payload',
      providerSourceId: 'jolpica',
      providerRequestAttempted: true,
      season,
      failureCategory,
    });
    return {
      outcome: 'failed',
      attempts: [attempt],
      reason: 'invalid-payload',
    };
  }

  /**
   * Maps one hardened-boundary failure into the existing closed taxonomy, on
   * exactly the calendar port's terms (pinned by a parity test).
   *
   * `requestAttempted` is the boundary's own statement about whether anything
   * left GridView, and it alone decides between `not-attempted` and an
   * attempted failure.
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
