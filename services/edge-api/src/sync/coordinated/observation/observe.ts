/**
 * The observation half of coordinated runtime orchestration (decision pack
 * §6.6 steps 1-5; PR-C3).
 *
 * **Internal, injected and not connected.** No Worker module imports this
 * package. `runCoordinatedSync` does not call it, `resolveReconciliationLedger`
 * still answers `null`, and every scheduled and manual coordinated run is
 * still refused as `ledger-unbound` before any provider request. It is reached
 * only by a caller that hands it every dependency, which today means tests
 * with a local ledger and a local transport.
 *
 * One call is one run for one season:
 *
 * 1. Compose the runtime through the existing gate. A refused composition has
 *    built nothing that could send a request.
 * 2. Acquire the season's fenced lease. A lease someone else holds means a run
 *    is in progress: nothing is read from the authority and nothing is sent.
 * 3. Read the sequenced authority and the active release's classification
 *    revisions, and reconcile them into the ledger's `publishedRevision`
 *    cache. The planner then reads the reconciled snapshot.
 * 4. Ask the C2 planner what is due. **Nothing due sends nothing.**
 * 5. Execute that one plan through the single coordinator, which reaches
 *    Jolpica only through the one routing port, the hardened HTTP client, the
 *    per-run pacer and the global limiter the composition built.
 * 6. Map what each request produced onto the C2 policy, and commit the
 *    resulting records in one conditional ledger transaction under the lease.
 * 7. Release the lease, whatever happened after it was acquired.
 *
 * **No publication.** Nothing here calls the guarded publication command, the
 * bridge or the sequencer's write path, creates a release
 * or acts on the policy's publishability decision. The no-change gate (O-12),
 * the ordering input (O-13), publication metadata (O-14), the publication
 * outcome commit and runtime activation are the next slice. A scheduled
 * publication run's observation commit clears `publicationDueAt` exactly as
 * the C2 policy computes it (§6.6 step 5); re-setting it when the candidate is
 * not applied belongs to that outcome commit (step 9).
 *
 * Every refusal after the lease is acquired fails closed: a lease that has
 * expired, an authority that cannot answer, a coordination defect, a malformed
 * selection and a refused or uncertain commit all leave the ledger's records
 * as they were and publish nothing.
 */

import type { Logger } from '../../../logging/logger';
import type { SeasonPublicationSequencerPort } from '../../../publication/sequencer/port';
import type { SnapshotStorage } from '../../../storage/types';
import {
  composeCoordinatedRuntime,
  type CoordinatedRuntime,
  type CoordinatedRuntimeDependencies,
  type CoordinatedUnavailableReason,
} from '../composition';
import type {
  LeaseGrant,
  LeaseToken,
  LedgerCommitRequest,
  LedgerRejectionReason,
  LedgerSnapshot,
} from '../ledger/model';
import {
  countPolicyEvents,
  planRun,
  recordRunObservations,
  type PolicyEventCategory,
  type RunPlan,
  type RunTrigger,
} from '../policy';
import { observationOutcomes } from './outcomes';
import { publishedReadRefusals, readPublishedRevisions } from './published';

export const COORDINATED_OBSERVATION_OPERATION = 'sync.coordinated.observation';

/** Where a failed run stopped. */
export const observationStages = [
  'lease',
  'authority',
  'reconciliation',
  'coordination',
  'observation',
  'commit',
] as const;
export type ObservationStage = (typeof observationStages)[number];

/** Why a run failed closed. A closed set, safe for logs. */
export const observationFailures = [
  ...publishedReadRefusals,
  'ledger-unavailable',
  'ledger-rejected',
  'ledger-uncertain',
  'lease-expired',
  'coordination-rejected',
  'coordination-defect',
  'selection-malformed',
] as const;
export type ObservationFailure = (typeof observationFailures)[number];

export type LeaseReleaseResult = 'released' | 'refused' | 'unavailable';

export interface CoordinatedObservationRequest {
  readonly season: number;
  readonly trigger: RunTrigger;
  /** Caller cancellation, handed to the coordinator. */
  readonly signal?: AbortSignal;
}

export interface CoordinatedObservationDependencies extends CoordinatedRuntimeDependencies {
  /** The sequencer the authority and its active release are read from. */
  readonly sequencer: SeasonPublicationSequencerPort;
  /** Where the active release's documents are read from. */
  readonly storage: SnapshotStorage;
}

interface RunFields {
  readonly season: number;
  readonly trigger: RunTrigger;
}

/** What one run did, before the season and trigger are attached. */
export type CoordinatedObservationResult =
  | {
      readonly status: 'coordinated-runtime-unavailable';
      readonly reasons: readonly CoordinatedUnavailableReason[];
      readonly providerRequests: 0;
    }
  | {
      /** Another run holds the season's lease. */
      readonly status: 'run-in-progress';
      readonly providerRequests: 0;
    }
  | {
      readonly status: 'failed';
      readonly stage: ObservationStage;
      readonly failure: ObservationFailure;
      /** The ledger's own reason, when it refused. */
      readonly ledgerRejection: LedgerRejectionReason | null;
      readonly providerRequests: number;
      /** `null` when no lease was acquired. */
      readonly leaseRelease: LeaseReleaseResult | null;
    }
  | {
      readonly status: 'nothing-due';
      readonly reason: 'no-work' | 'limiter-deferred';
      readonly providerRequests: 0;
      readonly leaseRelease: LeaseReleaseResult;
    }
  | {
      readonly status: 'observed';
      readonly plan: 'observation' | 'publication';
      readonly coordination: 'completed' | 'cancelled';
      readonly providerRequests: number;
      /** Whether the run had anything to write. */
      readonly committed: boolean;
      readonly events: Readonly<Partial<Record<PolicyEventCategory, number>>>;
      /** Always: publication is the next slice. */
      readonly publication: 'not-attempted';
      readonly leaseRelease: LeaseReleaseResult;
    };

export type CoordinatedObservationOutcome = RunFields &
  CoordinatedObservationResult;

type Failure = Extract<CoordinatedObservationResult, { status: 'failed' }>;
/** An outcome decided under the lease, before the lease is released. */
type HeldOutcome = DistributiveOmit<
  Extract<
    CoordinatedObservationResult,
    { status: 'failed' | 'nothing-due' | 'observed' }
  >,
  'leaseRelease'
>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export async function observeCoordinatedSeason(
  request: CoordinatedObservationRequest,
  dependencies: CoordinatedObservationDependencies,
): Promise<CoordinatedObservationOutcome> {
  const fields: RunFields = {
    season: request.season,
    trigger: request.trigger,
  };
  const composition = composeCoordinatedRuntime(dependencies);
  if (composition.kind === 'unavailable') {
    return logged(dependencies.logger, {
      ...fields,
      status: 'coordinated-runtime-unavailable',
      reasons: composition.reasons,
      providerRequests: 0,
    });
  }
  const { runtime } = composition;

  const acquired = await runtime.ledger.acquireLease(request.season);
  if (acquired.outcome !== 'acquired') {
    if (acquired.outcome === 'rejected' && acquired.reason === 'lease-held') {
      return logged(dependencies.logger, {
        ...fields,
        status: 'run-in-progress',
        providerRequests: 0,
      });
    }
    return logged(dependencies.logger, {
      ...fields,
      ...ledgerFailure('lease', acquired, 0),
      leaseRelease: null,
    });
  }

  const lease: LeaseToken = {
    season: acquired.lease.season,
    fence: acquired.lease.fence,
  };
  let held: HeldOutcome;
  try {
    held = await underLease(request, dependencies, runtime, acquired.lease);
  } catch (error) {
    // Released on every path, including a defect that throws.
    await release(runtime, lease);
    throw error;
  }
  const leaseRelease = await release(runtime, lease);
  return logged(dependencies.logger, { ...fields, ...held, leaseRelease });
}

/** Steps 3-6. Everything here runs under the acquired lease. */
async function underLease(
  request: CoordinatedObservationRequest,
  dependencies: CoordinatedObservationDependencies,
  runtime: CoordinatedRuntime,
  grant: LeaseGrant,
): Promise<HeldOutcome> {
  const lease: LeaseToken = { season: grant.season, fence: grant.fence };

  const published = await readPublishedRevisions(
    dependencies.sequencer,
    dependencies.storage,
    request.season,
  );
  if (published.kind === 'refused') {
    return failure('authority', published.reason, null, 0);
  }
  const reconciled = await runtime.ledger.reconcilePublishedRevisions({
    lease,
    activeVersion: published.activeVersion,
    revisions: published.revisions,
  });
  if (reconciled.outcome !== 'reconciled') {
    return ledgerFailure('reconciliation', reconciled, 0);
  }

  const plannedAt = dependencies.clock.now();
  const plan = planRun({
    now: plannedAt,
    snapshot: reconciled.snapshot,
    trigger: request.trigger,
  });
  if (plan.kind === 'nothing-due') {
    return { status: 'nothing-due', reason: plan.reason, providerRequests: 0 };
  }
  if (Date.parse(grant.expiresAt) <= dependencies.clock.now().getTime()) {
    // No request is sent under a lease that can no longer commit.
    return failure('coordination', 'lease-expired', null, 0);
  }

  return observe(request, runtime, lease, reconciled.snapshot, plan, () =>
    dependencies.clock.now(),
  );
}

async function observe(
  request: CoordinatedObservationRequest,
  runtime: CoordinatedRuntime,
  lease: LeaseToken,
  snapshot: LedgerSnapshot,
  plan: Exclude<RunPlan, { readonly kind: 'nothing-due' }>,
  clock: () => Date,
): Promise<HeldOutcome> {
  const run = await runtime.coordinator.coordinate({
    plan: { season: request.season, resources: plan.resources },
    ...(request.signal ? { signal: request.signal } : {}),
  });
  // The observation instant is taken once every response has arrived, never
  // at planning: what the run records as attempted and observed must not
  // predate the responses it describes. The plan's slots are unaffected.
  const observedAt = clock();
  const providerRequests = run.accounting.lifetime.total;
  if (run.status === 'plan-rejected') {
    return failure(
      'coordination',
      'coordination-rejected',
      null,
      providerRequests,
    );
  }
  if (run.status === 'invariant-violated') {
    return failure(
      'coordination',
      'coordination-defect',
      null,
      providerRequests,
    );
  }

  const mapped = await observationOutcomes(plan.resources, run);
  if (mapped.kind === 'refused') {
    return failure('observation', mapped.reason, null, providerRequests);
  }
  const result = recordRunObservations({
    lease,
    snapshot,
    plan,
    now: observedAt,
    seasonOutcomes: mapped.seasonOutcomes,
    classificationOutcomes: mapped.classificationOutcomes,
  });

  const committed = hasWrites(result.request);
  if (committed) {
    const outcome = await runtime.ledger.commit(result.request);
    if (outcome.outcome !== 'committed') {
      return ledgerFailure('commit', outcome, providerRequests);
    }
  }
  return {
    status: 'observed',
    plan: plan.kind,
    coordination: run.status,
    providerRequests,
    committed,
    events: countPolicyEvents(result.events),
    publication: 'not-attempted',
  };
}

function hasWrites(request: LedgerCommitRequest): boolean {
  return (
    request.seasonRecord !== null ||
    request.classifications.length > 0 ||
    request.backlogInsertions.length > 0 ||
    request.backlogRemovals.length > 0
  );
}

function failure(
  stage: ObservationStage,
  reason: ObservationFailure,
  ledgerRejection: LedgerRejectionReason | null,
  providerRequests: number,
): Omit<Failure, 'leaseRelease'> {
  return {
    status: 'failed',
    stage,
    failure: reason,
    ledgerRejection,
    providerRequests,
  };
}

function ledgerFailure(
  stage: ObservationStage,
  outcome:
    | { readonly outcome: 'rejected'; readonly reason: LedgerRejectionReason }
    | { readonly outcome: 'unavailable' }
    | { readonly outcome: 'uncertain' },
  providerRequests: number,
): Omit<Failure, 'leaseRelease'> {
  switch (outcome.outcome) {
    case 'rejected':
      return failure(
        stage,
        'ledger-rejected',
        outcome.reason,
        providerRequests,
      );
    case 'unavailable':
      return failure(stage, 'ledger-unavailable', null, providerRequests);
    case 'uncertain':
      return failure(stage, 'ledger-uncertain', null, providerRequests);
  }
}

async function release(
  runtime: CoordinatedRuntime,
  lease: LeaseToken,
): Promise<LeaseReleaseResult> {
  try {
    const outcome = await runtime.ledger.releaseLease(lease);
    if (outcome.outcome === 'released') return 'released';
    return outcome.outcome === 'rejected' ? 'refused' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/**
 * One bounded line per run: closed statuses, counts and the fixed event
 * categories. No revision, round, instant, provider value or payload.
 */
function logged(
  logger: Logger,
  outcome: CoordinatedObservationOutcome,
): CoordinatedObservationOutcome {
  const quiet =
    outcome.status === 'observed' || outcome.status === 'nothing-due';
  const event = {
    operation: COORDINATED_OBSERVATION_OPERATION,
    season: outcome.season,
    syncTrigger: outcome.trigger,
    coordinationStatus: outcome.status,
    providerOperationCallCount: outcome.providerRequests,
    ...(outcome.status === 'coordinated-runtime-unavailable'
      ? {
          failureCategory: outcome.status,
          coordinationMissingDependencies: [...outcome.reasons],
        }
      : {}),
    ...(outcome.status === 'run-in-progress'
      ? { failureCategory: outcome.status }
      : {}),
    ...(outcome.status === 'failed'
      ? {
          failureCategory: outcome.failure,
          observationStage: outcome.stage,
          ...(outcome.ledgerRejection === null
            ? {}
            : { ledgerRejection: outcome.ledgerRejection }),
        }
      : {}),
    ...(outcome.status === 'nothing-due'
      ? { coordinationOutcome: outcome.reason }
      : {}),
    ...(outcome.status === 'observed'
      ? {
          coordinationOutcome: outcome.coordination,
          observationPlan: outcome.plan,
          reconciliationEvents: { ...outcome.events },
        }
      : {}),
  };
  if (quiet) logger.info(event);
  else logger.warn(event);
  return outcome;
}
