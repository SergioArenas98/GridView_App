/**
 * The per-run composition of the coordinated runtime.
 *
 * This is the **only** runtime module outside `src/providers/jolpica/` and
 * `src/providers/coordination/` that imports either package by value. The
 * orchestration in `observation/` imports only types from the coordination
 * package, which the build erases. The dormancy tests pin that as an exact
 * allow-list.
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
 *   by wiring. It is registered behind the coordination package's
 *   `recordLateAnswers` pass-through, which only notes which resources it
 *   answered after the run's signal had aborted (`answeredAfterCancellation`),
 *   so a late answer is never accepted;
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
import type { DiscoverySession } from '../../identity/discovery/persist';
import {
  assertIdentityRunContext,
  CatalogAdmissionError,
  type IdentityRunContext,
  type IdentityContextConfiguration,
} from '../../identity/catalog/run-context';
import { bundledIdentityContent } from '../../identity/catalog/bundled-context';
import { pinnedDriverProfiles } from '../../identity/catalog/closure-profiles';
import {
  inventoryPolicyForContext,
  strictInventoryPolicy,
} from '../../identity/inventory/model';
import type { Logger } from '../../logging/logger';
import type { PublicationAuthority } from '../../publication/authority';
import type { GuardedPublicationCommands } from '../../publication/commands';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  attemptedFailureReasons,
  coordinationFor,
  recordLateAnswers,
  type CoordinatedPayload,
  type CoordinatedResource,
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
  calendarPageLimit,
  calendarPathFor,
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
 * The coordinator's per-resource lookup, for the orchestration's mapping of a
 * run onto the policy (`observation/outcomes.ts`). Re-exported here so this
 * module stays the only runtime module that imports either package by value.
 */
export { coordinationFor };

/**
 * The calendar port's exact request, for the staging-only one-GET comparison
 * (`calendar-single-get.ts`), re-exported for the same reason.
 */
export { calendarPageLimit, calendarPathFor };

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
  readonly identity?: IdentityContextConfiguration;
  readonly discovery?: DiscoverySession;
  readonly discoveryFactory?: (
    context: IdentityRunContext,
  ) => Promise<DiscoverySession | null>;
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
  /**
   * Whether the routing port answered for `resource` only after the run's
   * signal had aborted (RB-4 as amended, 2026-10-06). Such an answer - a
   * request aborted in flight, or a response that arrived late - is a
   * cancelled observation for the ledger policy, whatever it carried. Its
   * request still counts in the run's accounting: it was sent.
   */
  answeredAfterCancellation(resource: CoordinatedResource): boolean;
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

export function composeCoordinatedTransport(
  dependencies: CoordinatedRuntimeDependencies,
):
  | {
      kind: 'unavailable';
      reasons: readonly [
        CoordinatedUnavailableReason,
        ...CoordinatedUnavailableReason[],
      ];
    }
  | {
      kind: 'composed';
      runtime: Pick<CoordinatedRuntime, 'client' | 'limiter'>;
    } {
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
  return { kind: 'composed' as const, runtime: { client, limiter: pacer } };
}

export function composeCoordinatedRuntime(
  dependencies: CoordinatedRuntimeDependencies,
  context?: IdentityRunContext,
): CoordinatedRuntimeComposition {
  const transport = composeCoordinatedTransport(dependencies);
  if (transport.kind === 'unavailable') return transport;
  if (context) assertIdentityRunContext(context);
  if (context?.authority === 'runtime' && context.pin === null)
    throw new CatalogAdmissionError('catalog-invalid');
  if (
    dependencies.identity?.mode === 'runtime' &&
    context?.authority !== 'runtime'
  )
    throw new CatalogAdmissionError('catalog-invalid');
  if (
    context?.authority === 'runtime' &&
    dependencies.identity?.installationId !== context.installationId
  )
    throw new CatalogAdmissionError('catalog-invalid');
  if (
    !context &&
    dependencies.identity &&
    dependencies.identity.mode !== 'bundled'
  )
    throw new CatalogAdmissionError('catalog-invalid');
  // One inventory policy for the whole run, derived from the admitted context
  // and handed to the participants port, the coordinator and assembly, so
  // each validates against the trusted value rather than a payload's own
  // claim. The configuration that selected it and the context whose durable
  // pin recorded it must agree exactly: a context admitted under another
  // policy, a legacy direct composition under the optional policy, or any
  // unknown value is refused, never mapped onto strict.
  const configured = dependencies.identity?.inventoryMode ?? 'strict';
  if (configured !== 'strict' && configured !== 'optional-drivers')
    throw new CatalogAdmissionError('catalog-invalid');
  if (configured === 'optional-drivers' && !context)
    throw new CatalogAdmissionError('catalog-invalid');
  let inventoryPolicy = strictInventoryPolicy;
  try {
    if (context) inventoryPolicy = inventoryPolicyForContext(context);
  } catch {
    throw new CatalogAdmissionError('catalog-invalid');
  }
  if (inventoryPolicy.mode !== configured)
    throw new CatalogAdmissionError('catalog-invalid');
  const { client, limiter: pacer } = transport.runtime;
  const { guarded, ledger, logger } = dependencies;
  if (!guarded || !ledger)
    throw new TypeError('Coordinated dependencies are incomplete.');
  // Legacy direct composition is explicitly bundled. Operational executions
  // supply the complete admitted context after lease/recovery/planning.
  const bundled = context ? null : bundledIdentityContent();
  const registry = context?.registry ?? bundled!.registry;
  const participants = context?.participants ?? bundled!.participants;
  const circuits = context?.circuits ?? bundled!.circuits;
  const eventNames =
    context?.events ?? new Map(bundled!.events.map((e) => [e.id, e.name]));
  const ports: JolpicaResourcePorts = Object.freeze({
    calendar: new JolpicaCalendarPort({
      registry,
      eventNames,
      client,
      logger,
      discovery: dependencies.discovery,
    }),
    circuits: new JolpicaCircuitsPort({
      registry,
      circuits,
      client,
      logger,
      discovery: dependencies.discovery,
    }),
    participants: new JolpicaParticipantsPort({
      registry,
      participants,
      client,
      logger,
      discovery: dependencies.discovery,
      inventoryPolicy,
    }),
    results: new JolpicaResultsPort({
      registry,
      client,
      logger,
      discovery: dependencies.discovery,
    }),
    standings: new JolpicaStandingsPort({
      registry,
      client,
      logger,
      discovery: dependencies.discovery,
    }),
  });
  const port = new JolpicaResourcePort(ports);
  const answers = recordLateAnswers(port);
  const coordinator = new MultiSourceCoordinator({
    ports: [answers.port],
    logger,
    maxConcurrentOperations: 1,
    inventoryPolicy,
  });
  const publication = new CoordinatedSeasonPublication({
    commands: guarded,
    logger,
    // U10: assembly closes required identities over this run's pinned
    // profiles under the same policy. Legacy direct composition has none.
    ...(context
      ? {
          identity: Object.freeze({
            policy: inventoryPolicy,
            profiles: pinnedDriverProfiles(context),
          }),
        }
      : {}),
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
      answeredAfterCancellation: answers.answeredAfterAbort,
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
