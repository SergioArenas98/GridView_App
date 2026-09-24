/**
 * The Jolpica season-participants port: the third resource behind the
 * coordination seam, the first that needs **two** provider requests, and
 * deliberately the **only** resource it answers.
 *
 * **Dormant.** Nothing in production composition constructs, registers,
 * imports or bundles this. `src/index.ts` cannot reach it, `PROVIDER_MODE`
 * still admits exactly `mock | none`, `SynchronizationService` is unchanged,
 * and no binding, secret, route, cron or Wrangler variable enables it. Its
 * dormancy is proven by composition and dependency boundaries (ADR 0022
 * amendment A9), exactly like the calendar and circuits ports beside it.
 *
 * **It owns no transport of its own.** Every outbound request goes through the
 * hardened boundary (`providers/http/provider-http-client.ts`), which pins the
 * origin, forces `GET`, sends the identifying `User-Agent`, forwards no
 * cookies, credentials or authorization, reserves limiter capacity before
 * sending, refuses redirects and enforces the timeout, content-type and
 * response-size caps. The client is injected, so no real network function can
 * be reached from here.
 *
 * **Two requests, one atomic resource** (ADR 0026 D2, D13; ADR 0023 A1):
 *
 * 1. `GET /ergast/f1/{season}/drivers/?limit=100`
 * 2. `GET /ergast/f1/{season}/constructors/?limit=100`
 *
 * Strictly sequential and fail fast. The constructors request is never begun
 * unless the drivers request was answered, decoded and fully resolved. The
 * result is both identity lists or nothing: no partial payload, no row reused
 * from an earlier run, no retry and no second page. Every request that
 * reached transport is reported in order in `attempts`; a step refused before
 * transport is never an attempt. An execution stopped between the two
 * requests by cancellation or the limiter is `interrupted`, carrying the
 * drivers attempt that really happened.
 *
 * **What it produces** is the identity inventory plus one
 * `ConstructorSeasonEntry` per constructor, with `driverEntries` empty (ADR
 * 0026 D10, D11; see `participants-normalizer.ts`). It makes no race-result
 * request and derives no participation.
 */

import type { Logger } from '../../logging/logger';
import type {
  CoordinatedSourceId,
  InterruptionReason,
  ProviderResourceOutcome,
  ProviderResourcePort,
  ProviderResourceRequest,
  ProviderTransportAttempt,
  ProviderTransportAttempts,
} from '../coordination';
import {
  buildProviderUrl,
  type ProviderHttpClient,
  type ProviderHttpFailure,
} from '../http/provider-http-client';
import {
  providerMappingFailureEvent,
  providerMappingRegistry,
  type ProviderMappingRegistry,
} from '../mappings';
import type { ProviderAttemptOutcome } from '../provider-metrics';
import {
  curatedParticipants,
  type CuratedParticipants,
} from './curated-participants';
import {
  constructorSeasonEntries,
  normalizeSeasonConstructors,
  normalizeSeasonDrivers,
  type IdentityNormalization,
} from './participants-normalizer';
import {
  decodeSeasonConstructors,
  decodeSeasonDrivers,
  type ParticipantsDecodeProblem,
} from './participants-payload';

/**
 * The page size both requests send, explicitly, rather than relying on the
 * upstream default of 30 (ADR 0026 D13; Provider Evaluation §8.7, M10).
 *
 * 100 is the documented cap. A response whose metadata says more rows exist
 * than were returned fails closed rather than being truncated or paged.
 */
export const participantsPageLimit = 100;

/** The documented Ergast-compatible paths the hardened boundary pins. */
const driversPathFor = (season: number): string =>
  `/ergast/f1/${season}/drivers/`;
const constructorsPathFor = (season: number): string =>
  `/ergast/f1/${season}/constructors/`;

/** Which of the two requests a bounded log line is about. */
type ParticipantsEndpoint = 'drivers' | 'constructors';

export interface JolpicaParticipantsPortOptions {
  /** The hardened outbound boundary. Injected; never defaulted to `fetch`. */
  readonly client: ProviderHttpClient;
  readonly logger: Logger;
  /** Defaults to the process-wide curated registry. */
  readonly registry?: ProviderMappingRegistry;
  /** Defaults to the committed curated driver and constructor registries. */
  readonly participants?: CuratedParticipants;
  /**
   * Correlation tokens for transport attempts, one per request. An
   * adapter-generated token, never a URL, key or provider value, and never
   * logged.
   */
  readonly reference?: () => string;
}

/** One decoded page: its identity rows, or a bounded decode problem. */
type DecodeStep<R> =
  | { readonly ok: true; readonly rows: R }
  | { readonly ok: false; readonly problem: ParticipantsDecodeProblem };

/** A step of the sequence either continues with a value or ends the resource. */
type Step<T> =
  | { readonly done: false; readonly value: T }
  | { readonly done: true; readonly outcome: ProviderResourceOutcome };

export class JolpicaParticipantsPort implements ProviderResourcePort {
  readonly sourceId: CoordinatedSourceId = 'jolpica';

  private readonly client: ProviderHttpClient;
  private readonly logger: Logger;
  private readonly registry: ProviderMappingRegistry;
  private readonly participants: CuratedParticipants;
  private readonly reference: () => string;
  private sequence = 0;

  constructor(options: JolpicaParticipantsPortOptions) {
    this.client = options.client;
    this.logger = options.logger;
    this.registry = options.registry ?? providerMappingRegistry();
    this.participants = options.participants ?? curatedParticipants();
    this.reference =
      options.reference ?? (() => `jolpica-participants-${++this.sequence}`);
  }

  async fetchResource(
    request: ProviderResourceRequest,
  ): Promise<ProviderResourceOutcome> {
    // Capability first. An unsupported resource reserves no capacity, builds
    // no request, runs no transport and creates no attempt.
    if (request.resource.kind !== 'season-participants') {
      return { outcome: 'not-attempted', reason: 'resource-unsupported' };
    }

    // Cancellation before anything is reserved, so a cancelled caller never
    // reaches the limiter.
    if (request.signal?.aborted) {
      return { outcome: 'not-attempted', reason: 'cancelled' };
    }

    // The season comes from the requested resource, never from a constant.
    const season = request.resource.season;
    const query = { limit: participantsPageLimit };

    // Both requests are proven buildable before the first is sent, so the
    // boundary's own `invalid-request` refusal - the adapter's defect, reported
    // as `resource-unsupported` exactly as the other ports do - can only ever
    // happen with nothing attempted, never between the two requests.
    if (
      buildProviderUrl('jolpica', driversPathFor(season), query) === null ||
      buildProviderUrl('jolpica', constructorsPathFor(season), query) === null
    ) {
      return { outcome: 'not-attempted', reason: 'resource-unsupported' };
    }

    // Request 1: the driver identity list.
    const driversResult = await this.client.getJson({
      sourceId: 'jolpica',
      path: driversPathFor(season),
      query,
      signal: request.signal,
    });
    if (!driversResult.ok) return this.transportFailure(driversResult, []);
    const driversAttempts: ProviderTransportAttempts = [this.successful()];

    const drivers = this.normalize(
      'drivers',
      season,
      driversAttempts,
      () => {
        const decoded = decodeSeasonDrivers(
          driversResult.data,
          season,
          participantsPageLimit,
        );
        return decoded.ok ? { ok: true, rows: decoded.drivers } : decoded;
      },
      (rows) =>
        normalizeSeasonDrivers(rows, season, this.registry, this.participants),
    );
    // A drivers response that is invalid or unresolved ends the resource
    // here: the constructors request is never begun.
    if (drivers.done) return drivers.outcome;

    // Cancelled between the two requests. The drivers request happened and is
    // reported; the constructors request never left and is not an attempt.
    if (request.signal?.aborted) {
      return this.interrupted(driversAttempts, 'cancelled');
    }

    // Request 2: the constructor identity list.
    const constructorsResult = await this.client.getJson({
      sourceId: 'jolpica',
      path: constructorsPathFor(season),
      query,
      signal: request.signal,
    });
    if (!constructorsResult.ok) {
      return this.transportFailure(constructorsResult, driversAttempts);
    }
    const attempts: ProviderTransportAttempts = [
      ...driversAttempts,
      this.successful(),
    ];

    const constructors = this.normalize(
      'constructors',
      season,
      attempts,
      () => {
        const decoded = decodeSeasonConstructors(
          constructorsResult.data,
          season,
          participantsPageLimit,
        );
        return decoded.ok ? { ok: true, rows: decoded.constructors } : decoded;
      },
      (rows) =>
        normalizeSeasonConstructors(
          rows,
          season,
          this.registry,
          this.participants,
        ),
    );
    if (constructors.done) return constructors.outcome;

    return {
      outcome: 'candidate',
      attempts,
      payload: {
        kind: 'season-participants',
        drivers: drivers.value,
        constructors: constructors.value,
        // Participation spans are assembly-owned (ADR 0026 D3, D11). Empty is
        // the accepted state of this contribution, not a placeholder.
        driverEntries: [],
        constructorEntries: constructorSeasonEntries(
          season,
          constructors.value,
        ),
      },
    };
  }

  /**
   * Decodes and normalizes one answered response.
   *
   * `data` is `unknown`, so the interface permits a value that throws when it
   * is merely read, and normalization reads injected content. The port stays
   * total for what its interface allows: a throw here would discard requests
   * the provider did answer, so every exception is contained as the bounded
   * invalid-payload outcome, with every attempt so far still reported.
   */
  private normalize<R, T>(
    endpoint: ParticipantsEndpoint,
    season: number,
    attempts: ProviderTransportAttempts,
    decode: () => DecodeStep<R>,
    normalize: (rows: R) => IdentityNormalization<T>,
  ): Step<readonly T[]> {
    let decoded: DecodeStep<R>;
    try {
      decoded = decode();
    } catch {
      // The raw error is provider-derived and unbounded, so it is dropped.
      decoded = { ok: false, problem: 'envelope' };
    }
    if (!decoded.ok) {
      return this.invalidPayload(endpoint, season, attempts, decoded.problem);
    }

    let normalized: IdentityNormalization<T>;
    try {
      normalized = normalize(decoded.rows);
    } catch {
      return this.invalidPayload(endpoint, season, attempts, 'normalization');
    }

    if (normalized.ok) return { done: false, value: normalized.identities };
    if (normalized.kind === 'mapping') {
      // The mapping boundary raises its own bounded signal. The outcome
      // carries nothing about the identity that failed.
      for (const failure of normalized.failures) {
        this.logger.error(providerMappingFailureEvent(failure));
      }
      return { done: true, outcome: { outcome: 'mapping-failure', attempts } };
    }
    if (
      normalized.problem === 'curated-driver-missing' ||
      normalized.problem === 'curated-constructor-missing'
    ) {
      // A resolved identity with no curated content is GridView's own gap,
      // not the provider's: it is contained as an unresolved identity.
      this.logger.error({
        operation: 'provider.participants.curated_content_missing',
        providerSourceId: 'jolpica',
        providerRequestAttempted: true,
        season,
        failureCategory: normalized.problem,
      });
      return { done: true, outcome: { outcome: 'mapping-failure', attempts } };
    }
    return this.invalidPayload(endpoint, season, attempts, normalized.problem);
  }

  /**
   * A response that was read and could not be normalized. Every request so far
   * stays attempted, counted once, never selected. Only a bounded closed code
   * naming the endpoint and the problem is logged: no provider value, key or
   * body fragment.
   */
  private invalidPayload(
    endpoint: ParticipantsEndpoint,
    season: number,
    attempts: ProviderTransportAttempts,
    problem: string,
  ): Step<never> {
    this.logger.warn({
      operation: 'provider.participants.invalid_payload',
      providerSourceId: 'jolpica',
      providerRequestAttempted: true,
      season,
      failureCategory: `${endpoint}-${problem}`,
    });
    return {
      done: true,
      outcome: { outcome: 'failed', attempts, reason: 'invalid-payload' },
    };
  }

  /** An execution stopped before its next request. Never selectable. */
  private interrupted(
    attempts: ProviderTransportAttempts,
    reason: InterruptionReason,
    retryAt?: string,
  ): ProviderResourceOutcome {
    return {
      outcome: 'interrupted',
      attempts,
      reason,
      ...(retryAt ? { retryAt } : {}),
    };
  }

  private successful(): ProviderTransportAttempt {
    return { reference: this.reference(), outcome: 'successful' };
  }

  /**
   * Maps one hardened-boundary failure into the closed taxonomy.
   *
   * `requestAttempted` is the boundary's own statement about whether anything
   * left GridView, and it alone decides whether this request is an attempt.
   * `earlier` holds every request of this execution already answered:
   *
   * - nothing sent now and nothing earlier: `not-attempted`, on exactly the
   *   other ports' terms;
   * - nothing sent now after earlier requests: `interrupted`, carrying them;
   * - sent now: an attempted failure whose final attempt is this request.
   */
  private transportFailure(
    failure: ProviderHttpFailure,
    earlier: readonly ProviderTransportAttempt[],
  ): ProviderResourceOutcome {
    const [first, ...rest] = earlier;
    if (!failure.requestAttempted) {
      if (first === undefined) {
        return {
          outcome: 'not-attempted',
          reason: notAttemptedReasonFor(failure.kind),
          ...(failure.retryAt ? { retryAt: failure.retryAt } : {}),
        };
      }
      const interruption = interruptionReasonFor(failure.kind);
      if (interruption !== null) {
        return this.interrupted(
          [first, ...rest],
          interruption,
          failure.retryAt,
        );
      }
      // `invalid-request` after an answered request. Unreachable: both paths
      // were proven buildable before the first request, and the boundary's
      // builder is a pure function of them. Answered without inventing an
      // attempt and without discarding the ones that happened: the execution
      // failed on GridView's own policy after an answered request, which is
      // what `provider-unavailable` over a `successful` final attempt means.
      return {
        outcome: 'failed',
        attempts: [first, ...rest],
        reason: 'provider-unavailable',
      };
    }

    const attempt: ProviderTransportAttempt = {
      reference: this.reference(),
      outcome: attemptOutcomeFor(failure.kind),
    };
    const attempts: ProviderTransportAttempts =
      first === undefined ? [attempt] : [first, ...rest, attempt];
    if (failure.kind === 'provider-rate-limited') {
      return {
        outcome: 'failed',
        attempts,
        reason: 'provider-rate-limited',
        ...(failure.retryAfter ? { retryAfter: failure.retryAfter } : {}),
      };
    }
    // No retry here and none anywhere in this adapter: pacing and scheduling
    // belong to G5, not to a port.
    return { outcome: 'failed', attempts, reason: 'provider-unavailable' };
  }
}

/**
 * The not-attempted reason for a boundary failure that sent nothing, on
 * exactly the calendar and circuits ports' terms. `invalid-request` is the
 * adapter's own defect and is reported as `resource-unsupported` rather than
 * invented into a provider condition.
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
 * The interruption a boundary refusal between two requests represents, or
 * `null` when the refusal is not one ADR 0023 A1 admits.
 */
function interruptionReasonFor(
  kind: ProviderHttpFailure['kind'],
): InterruptionReason | null {
  switch (kind) {
    case 'rate-limit-deferred':
      return 'rate-limit-deferred';
    case 'limiter-unavailable':
      return 'limiter-unavailable';
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
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
