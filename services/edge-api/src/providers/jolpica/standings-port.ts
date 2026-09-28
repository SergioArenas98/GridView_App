/**
 * The Jolpica standings port: the `driver-standings` and
 * `constructor-standings` resources behind the coordination seam, and
 * deliberately the **only** two resources it answers.
 *
 * **Dormant.** Nothing in production composition constructs, registers,
 * imports or bundles this. `src/index.ts` cannot reach it, `PROVIDER_MODE`
 * still admits exactly `mock | none`, `SynchronizationService` is unchanged,
 * and no binding, secret, route, cron or Wrangler variable enables it. Its
 * dormancy is proven by composition and dependency boundaries (ADR 0022
 * amendment A9), exactly like the other Jolpica ports.
 *
 * **It owns no transport of its own.** Every outbound request goes through the
 * hardened boundary (`providers/http/provider-http-client.ts`), which pins the
 * origin, forces `GET`, sends the identifying `User-Agent`, forwards no
 * cookies, credentials or authorization, reserves limiter capacity before
 * sending, refuses redirects and enforces the timeout, content-type and
 * response-size caps. The client is injected, so no real network function can
 * be reached from here.
 *
 * **Scope.** One request per call, chosen by the requested kind:
 *
 * - `driver-standings`: `GET /ergast/f1/{season}/driverstandings/?limit=100`
 * - `constructor-standings`:
 *   `GET /ergast/f1/{season}/constructorstandings/?limit=100`
 *
 * Every other resource is refused as `resource-unsupported` before any
 * capacity is reserved, any request is built, any transport runs and any
 * attempt is counted. One request, one attempt, no retry and no second page.
 *
 * **What it produces** is one normalized standings table (ADR 0023 amendment
 * A3) and, beside it, the internal round the provider bound that table to
 * (A3.5). The round is never part of a public standing: season assembly reads
 * it to publish the tables only when both describe the latest classified race
 * round, and withholds the whole season otherwise. An empty table (S-9) is a
 * valid candidate here; assembly admits it only while no race is classified,
 * and the D14 round-coverage guard is what stops a season with no classified
 * round from replacing one that has them.
 */

import type { Logger } from '../../logging/logger';
import type {
  CoordinatedPayload,
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
  normalizeConstructorStandings,
  normalizeDriverStandings,
  type StandingsNormalization,
} from './standings-normalizer';
import {
  decodeConstructorStandings,
  decodeDriverStandings,
  type DecodedConstructorStanding,
  type DecodedDriverStanding,
  type StandingsDecodeProblem,
} from './standings-payload';

/**
 * The page size this port requests, sent explicitly rather than relying on the
 * upstream default of 30.
 *
 * On these endpoints `total` counts standing rows; 2026 has 23 driver and 11
 * constructor rows, so one page covers either with room to spare. A response
 * whose metadata says more rows exist than were returned fails closed rather
 * than being truncated or paged.
 */
export const standingsPageLimit = 100;

/** The two resource kinds this port answers. */
type StandingsKind = 'driver-standings' | 'constructor-standings';

/** The documented Ergast-compatible paths the hardened boundary pins. */
const standingsPaths: Readonly<
  Record<StandingsKind, (season: number) => string>
> = {
  'driver-standings': (season) => `/ergast/f1/${season}/driverstandings/`,
  'constructor-standings': (season) =>
    `/ergast/f1/${season}/constructorstandings/`,
};

export interface JolpicaStandingsPortOptions {
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

/** One decoded response, tagged with the kind it answers. */
type Decoded =
  | {
      readonly ok: true;
      readonly kind: 'driver-standings';
      readonly round: number | null;
      readonly rows: readonly DecodedDriverStanding[];
    }
  | {
      readonly ok: true;
      readonly kind: 'constructor-standings';
      readonly round: number | null;
      readonly rows: readonly DecodedConstructorStanding[];
    }
  | { readonly ok: false; readonly problem: StandingsDecodeProblem };

/** A normalized table as a payload, or why it could not be produced. */
type Table =
  | { readonly ok: true; readonly payload: CoordinatedPayload }
  | Exclude<StandingsNormalization<unknown>, { readonly ok: true }>;

export class JolpicaStandingsPort implements ProviderResourcePort {
  readonly sourceId: CoordinatedSourceId = 'jolpica';

  private readonly client: ProviderHttpClient;
  private readonly logger: Logger;
  private readonly registry: ProviderMappingRegistry;
  private readonly reference: () => string;
  private sequence = 0;

  constructor(options: JolpicaStandingsPortOptions) {
    this.client = options.client;
    this.logger = options.logger;
    this.registry = options.registry ?? providerMappingRegistry();
    this.reference =
      options.reference ?? (() => `jolpica-standings-${++this.sequence}`);
  }

  async fetchResource(
    request: ProviderResourceRequest,
  ): Promise<ProviderResourceOutcome> {
    const resource = request.resource;
    // Capability first. An unsupported resource reserves no capacity, builds
    // no request, runs no transport and creates no attempt.
    if (
      resource.kind !== 'driver-standings' &&
      resource.kind !== 'constructor-standings'
    ) {
      return { outcome: 'not-attempted', reason: 'resource-unsupported' };
    }

    // Cancellation before anything is reserved, so a cancelled caller never
    // reaches the limiter.
    if (request.signal?.aborted) {
      return { outcome: 'not-attempted', reason: 'cancelled' };
    }

    // The season comes from the requested resource, never a constant.
    const { kind, season } = resource;
    const result = await this.client.getJson({
      sourceId: 'jolpica',
      path: standingsPaths[kind](season),
      query: { limit: standingsPageLimit },
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
    let decoded: Decoded;
    try {
      decoded = decode(kind, season, result.data);
    } catch {
      decoded = { ok: false, problem: 'envelope' };
    }
    if (!decoded.ok) {
      return this.invalidPayload(kind, season, attempt, decoded.problem);
    }

    let table: Table;
    try {
      table = this.normalize(decoded, season);
    } catch {
      return this.invalidPayload(kind, season, attempt, 'normalization');
    }

    if (table.ok) {
      return {
        outcome: 'candidate',
        attempts: [attempt],
        payload: table.payload,
      };
    }
    if (table.kind === 'mapping') {
      // The mapping boundary raises its own bounded signal. The outcome
      // carries nothing about the identity that failed.
      for (const failure of table.failures) {
        this.logger.error(providerMappingFailureEvent(failure));
      }
      return { outcome: 'mapping-failure', attempts: [attempt] };
    }
    return this.invalidPayload(kind, season, attempt, table.problem);
  }

  /**
   * Resolves one decoded table and wraps it as the requested payload, with the
   * provider's round carried exactly as decoded.
   */
  private normalize(
    decoded: Extract<Decoded, { readonly ok: true }>,
    season: number,
  ): Table {
    if (decoded.kind === 'driver-standings') {
      const table = normalizeDriverStandings(
        decoded.rows,
        season,
        this.registry,
      );
      return table.ok
        ? {
            ok: true,
            payload: {
              kind: decoded.kind,
              round: decoded.round,
              standings: table.standings,
            },
          }
        : table;
    }
    const table = normalizeConstructorStandings(
      decoded.rows,
      season,
      this.registry,
    );
    return table.ok
      ? {
          ok: true,
          payload: {
            kind: decoded.kind,
            round: decoded.round,
            standings: table.standings,
          },
        }
      : table;
  }

  /**
   * A response that was read and could not be normalized. It stays an
   * attempted request, counted once, never selected. Only a bounded closed
   * code and the bounded resource kind are logged: no provider value, key or
   * body fragment.
   */
  private invalidPayload(
    kind: StandingsKind,
    season: number,
    attempt: ProviderTransportAttempt,
    problem: string,
  ): ProviderResourceOutcome {
    this.logger.warn({
      operation: 'provider.standings.invalid_payload',
      providerSourceId: 'jolpica',
      providerRequestAttempted: true,
      coordinationResource: kind,
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
   * the other Jolpica ports' terms. `requestAttempted` is the boundary's own
   * statement about whether anything left GridView.
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

/** Decodes one response for exactly the requested kind. */
function decode(kind: StandingsKind, season: number, body: unknown): Decoded {
  if (kind === 'driver-standings') {
    const decoded = decodeDriverStandings(body, season, standingsPageLimit);
    return decoded.ok
      ? { ok: true, kind, round: decoded.round, rows: decoded.rows }
      : decoded;
  }
  const decoded = decodeConstructorStandings(body, season, standingsPageLimit);
  return decoded.ok
    ? { ok: true, kind, round: decoded.round, rows: decoded.rows }
    : decoded;
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
