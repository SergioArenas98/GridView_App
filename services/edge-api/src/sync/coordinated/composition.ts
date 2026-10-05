/**
 * The per-run composition of the coordinated runtime.
 *
 * This is the **only** runtime module outside `src/providers/jolpica/` and
 * `src/providers/coordination/` that imports either package. The dormancy
 * tests pin that as an exact allow-list.
 *
 * Composition is gated. `composeCoordinatedRuntime` checks every required
 * dependency first, and only when all of them are present does it construct
 * anything. Otherwise it returns the closed list of what is missing, having
 * built no pacer, client, transport, port, coordinator or bridge. A refused
 * composition therefore makes no provider request, because nothing that could
 * make one exists.
 *
 * A composed runtime is, for one run:
 *
 * - one `PacedReservationClient` over the one limiter client (O-11);
 * - one hardened `ProviderHttpClient` over that pacer, with an explicit
 *   transport, shared by all five Jolpica ports;
 * - one `JolpicaResourcePort`, the coordinator's single registration for
 *   source `jolpica`. **No OpenF1 port is registered** and no provisional
 *   session-end bound is passed, so OpenF1 stays locked by policy and absent
 *   by wiring;
 * - one `MultiSourceCoordinator` at concurrency 1;
 * - one `CoordinatedSeasonPublication` bridge over the guarded sequenced
 *   publication the caller supplies. The bridge has no legacy fallback, and
 *   the D14-D16 guard stays inside the sequenced service.
 *
 * Nothing survives the run. Every object is built per call.
 *
 * `requestClassification` is the one request an operator verification makes
 * (T11-T11c; PR-E3): a one-resource plan through the same coordinator, port,
 * client, pacer and limiter. It lives here because this is the only module
 * that may read the coordinator's typed answer, and it hands back only the
 * selected `RaceResult` or a closed outcome - never a provider type.
 */

import type { RaceResult } from '../../contract/types';
import type { Logger } from '../../logging/logger';
import type { PublicationAuthority } from '../../publication/authority';
import type { GuardedPublicationCommands } from '../../publication/commands';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  attemptedFailureReasons,
  coordinationFor,
  type CoordinatedPayload,
  type SourceContribution,
} from '../../providers/coordination';
import {
  ProviderHttpClient,
  type ProviderTransport,
} from '../../providers/http/provider-http-client';
import type { ProviderRateLimiterClient } from '../../providers/http/provider-rate-limiter';
import {
  PacedReservationClient,
  type PacerSleep,
} from '../../providers/http/reservation-pacer';
import {
  JolpicaCalendarPort,
  JolpicaCircuitsPort,
  JolpicaParticipantsPort,
  JolpicaResourcePort,
  JolpicaResultsPort,
  JolpicaStandingsPort,
  type JolpicaResourcePorts,
} from '../../providers/jolpica';
import type { Clock } from '../../runtime/clock';
import type { ReconciliationLedgerPort } from './ledger-port';

/**
 * Why a coordinated run cannot start, in the fixed order they are checked.
 * Every missing dependency is reported, not only the first.
 */
export const coordinatedUnavailableReasons = [
  /** No `PROVIDER_RATE_LIMITER` binding: nothing could pace a request. */
  'limiter-unbound',
  /** The publication authority is not a reachable sequencer. */
  'authority-not-sequencer',
  /** No origin to delete published cache entries under. */
  'purge-origin-missing',
  /** No reconciliation ledger (G9). Always true in this change. */
  'ledger-unbound',
] as const;

export type CoordinatedUnavailableReason =
  (typeof coordinatedUnavailableReasons)[number];

export interface CoordinatedRuntimeDependencies {
  /** The limiter client, or `null` when no limiter is bound. */
  readonly limiter: ProviderRateLimiterClient | null;
  /** The resolved publication authority mode. */
  readonly authorityMode: PublicationAuthority['mode'];
  /**
   * The guarded sequenced publication, present exactly when the authority is
   * a reachable sequencer and a purge origin exists.
   */
  readonly guarded: GuardedPublicationCommands | null;
  readonly purgeOrigin: string | null;
  readonly ledger: ReconciliationLedgerPort | null;
  /**
   * The outbound transport. Defaults to the runtime `fetch`, bound only after
   * every gate has passed.
   */
  readonly transport?: ProviderTransport;
  /** How the pacer waits. Defaults to a timer. */
  readonly sleep?: PacerSleep;
  readonly logger: Logger;
  readonly clock: Clock;
}

export interface CoordinatedRuntime {
  readonly limiter: PacedReservationClient;
  readonly client: ProviderHttpClient;
  readonly ports: JolpicaResourcePorts;
  readonly port: JolpicaResourcePort;
  readonly coordinator: MultiSourceCoordinator;
  readonly publication: CoordinatedSeasonPublication;
  readonly ledger: ReconciliationLedgerPort;
}

export type CoordinatedRuntimeComposition =
  | {
      readonly kind: 'unavailable';
      readonly reasons: readonly [
        CoordinatedUnavailableReason,
        ...CoordinatedUnavailableReason[],
      ];
    }
  | { readonly kind: 'composed'; readonly runtime: CoordinatedRuntime };

/** Every missing dependency, in `coordinatedUnavailableReasons` order. */
export function missingCoordinatedDependencies(
  dependencies: CoordinatedRuntimeDependencies,
): CoordinatedUnavailableReason[] {
  const missing: CoordinatedUnavailableReason[] = [];
  if (dependencies.limiter === null) missing.push('limiter-unbound');
  if (
    dependencies.authorityMode !== 'sequencer' ||
    (dependencies.purgeOrigin !== null && dependencies.guarded === null)
  ) {
    missing.push('authority-not-sequencer');
  }
  if (dependencies.purgeOrigin === null) missing.push('purge-origin-missing');
  if (dependencies.ledger === null) missing.push('ledger-unbound');
  return missing;
}

export function composeCoordinatedRuntime(
  dependencies: CoordinatedRuntimeDependencies,
): CoordinatedRuntimeComposition {
  const [first, ...rest] = missingCoordinatedDependencies(dependencies);
  if (first !== undefined) {
    return { kind: 'unavailable', reasons: [first, ...rest] };
  }
  const { limiter, guarded, ledger, logger, clock } = dependencies;
  if (limiter === null || guarded === null || ledger === null) {
    // Unreachable: each is reported as missing above. Kept so the compiler,
    // not a comment, proves nothing below runs without them.
    throw new TypeError('Coordinated dependencies are incomplete.');
  }

  const now = () => clock.now();
  const pacer = new PacedReservationClient({
    limiter,
    now,
    sleep: dependencies.sleep,
  });
  const client = new ProviderHttpClient({
    transport: dependencies.transport ?? ((request) => fetch(request)),
    limiter: pacer,
    logger,
    now,
  });
  const ports: JolpicaResourcePorts = Object.freeze({
    calendar: new JolpicaCalendarPort({ client, logger }),
    circuits: new JolpicaCircuitsPort({ client, logger }),
    participants: new JolpicaParticipantsPort({ client, logger }),
    results: new JolpicaResultsPort({ client, logger }),
    standings: new JolpicaStandingsPort({ client, logger }),
  });
  const port = new JolpicaResourcePort(ports);
  const coordinator = new MultiSourceCoordinator({
    ports: [port],
    logger,
    maxConcurrentOperations: 1,
  });
  const publication = new CoordinatedSeasonPublication({
    commands: guarded,
    logger,
  });

  return {
    kind: 'composed',
    runtime: Object.freeze({
      limiter: pacer,
      client,
      ports,
      port,
      coordinator,
      publication,
      ledger,
    }),
  };
}

/**
 * What one Jolpica contribution that was not selected means for a check, or
 * `null` for a coordinator defect. Only a completed request is a check:
 *
 * - a request that was sent and failed - an upstream error, a timeout, a
 *   `429`, an invalid payload, an unresolved identity - is `failed` (T6);
 * - a limiter deferral is `deferred` with its `retryAt`, and nothing else;
 * - a cancellation, a limiter that could not answer, or a resource that was
 *   never reached is `not-attempted`.
 */
export type UnselectedOutcome =
  | { readonly status: 'failed' }
  | { readonly status: 'deferred'; readonly retryAt: string }
  | { readonly status: 'not-attempted' };

const notAttempted: UnselectedOutcome = { status: 'not-attempted' };
const failed: UnselectedOutcome = { status: 'failed' };

/** A limiter deferral, if its `retryAt` is an instant; otherwise not attempted. */
function deferral(retryAt: string | null): UnselectedOutcome {
  const at = retryAt === null ? Number.NaN : Date.parse(retryAt);
  return Number.isNaN(at)
    ? notAttempted
    : { status: 'deferred', retryAt: new Date(at).toISOString() };
}

export function unselectedJolpicaOutcome(
  contribution: SourceContribution,
): UnselectedOutcome | null {
  switch (contribution.status) {
    case 'deferred':
      return deferral(contribution.retryAt);
    case 'skipped':
      // Nothing left GridView: cancelled, limiter unavailable, or refused by
      // policy before any request.
      return notAttempted;
    case 'interrupted':
      return contribution.reason === 'rate-limit-deferred'
        ? deferral(contribution.retryAt)
        : notAttempted;
    case 'failed':
      if (!contribution.attempted) return null;
      if (contribution.reason === 'mapping-unresolved') return failed;
      return (attemptedFailureReasons as readonly unknown[]).includes(
        contribution.reason,
      )
        ? failed
        : null;
    case 'candidate':
      // A candidate that was not selected cannot happen with one source.
      return null;
  }
}

/**
 * The selected classification, when the payload is one and describes exactly
 * the season and round asked for; otherwise `null`, a malformed selection.
 */
export function selectedClassification(
  payload: CoordinatedPayload,
  season: number,
  round: number,
): RaceResult | null {
  return payload.kind === 'session-classification' &&
    payload.result.round === round &&
    payload.result.season === season
    ? payload.result
    : null;
}

/** Why a classification request produced no provider outcome at all. Closed. */
export type ClassificationRequestRefusal =
  'coordination-rejected' | 'coordination-defect' | 'selection-malformed';

export type ClassificationRequestOutcome =
  | { readonly status: 'observed'; readonly result: RaceResult }
  | UnselectedOutcome
  | {
      readonly status: 'refused';
      readonly reason: ClassificationRequestRefusal;
    };

export interface ClassificationRequestResult {
  readonly outcome: ClassificationRequestOutcome;
  /** Requests that left GridView: 0 or 1. */
  readonly providerRequests: number;
}

/**
 * One race classification request for one round (operator verification,
 * T11-T11c). It goes through the runtime's one coordinator, so it reaches
 * Jolpica only through the routing port, the hardened client, the pacer and
 * the global limiter, exactly as a run's request does. The results port makes
 * one attempt, never a retry and never a second page, so this sends at most
 * one request.
 */
export async function requestClassification(
  runtime: CoordinatedRuntime,
  season: number,
  round: number,
): Promise<ClassificationRequestResult> {
  const resource = {
    kind: 'session-classification',
    season,
    round,
    sessionType: 'race',
  } as const;
  const run = await runtime.coordinator.coordinate({
    plan: { season, resources: [resource] },
  });
  const providerRequests = run.accounting.lifetime.total;
  const refused = (reason: ClassificationRequestRefusal) => ({
    outcome: { status: 'refused', reason } as const,
    providerRequests,
  });
  if (run.status === 'plan-rejected') return refused('coordination-rejected');
  if (run.status === 'invariant-violated') {
    return refused('coordination-defect');
  }
  const coordination = coordinationFor(run, resource);
  if (coordination === undefined) return refused('coordination-defect');
  const selection = coordination.selection;
  if (selection.outcome === 'unavailable') {
    const jolpica = coordination.contributions.filter(
      (contribution) => contribution.source === 'jolpica',
    );
    const outcome =
      jolpica.length === 1 ? unselectedJolpicaOutcome(jolpica[0]!) : null;
    return outcome === null
      ? refused('coordination-defect')
      : { outcome, providerRequests };
  }
  if (selection.source !== 'jolpica') return refused('coordination-defect');
  const result = selectedClassification(selection.payload, season, round);
  return result === null
    ? refused('selection-malformed')
    : { outcome: { status: 'observed', result }, providerRequests };
}
