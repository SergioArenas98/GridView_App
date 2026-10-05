/**
 * Coordinated runtime orchestration for one season (decision pack §6.6): the
 * observation half (steps 1-5; PR-C3) and, for a publication plan, the
 * publication half (steps 6-9; PR-C4, `../outcome/`).
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
 *    A publication run's commit also marks the season `publishing`, so a run
 *    that never records its outcome leaves the publication due, not lost -
 *    unless an operator hold or a durable block stops the season, when there
 *    is nothing to leave due and the mark is not written.
 * 7. For a publication plan only, the publication half, **under the same
 *    lease**: the publishability decision from the committed records, one
 *    prepared candidate, the no-change gate, at most one guarded publication
 *    and the outcome commit with its durable next-due decision.
 * 8. Release the lease, whatever happened after it was acquired.
 * 9. After a **scheduled** run only, read the season once more and write the
 *    level-triggered attention line while it is held, durably blocked or the
 *    review backlog is at its OD-8 levels (`../operator/attention.ts`). This
 *    happens whatever the run did, including `run-in-progress`, `failed`,
 *    `nothing-due` and a refused composition with a ledger still bound, so a
 *    stopped season never goes quiet. Without a ledger there is nothing to
 *    read. A manual run writes none: its operator is already looking.
 *
 * Before planning, a `publishing` slot a previous run left behind is resolved
 * against the authority (`../outcome/recovery.ts`), so a release whose
 * commit answer was lost is recognized rather than published again.
 *
 * Observation plans and nothing-due runs never reach publication: they
 * behave exactly as PR-C3 left them.
 *
 * Every refusal after the lease is acquired fails closed: a lease that has
 * expired, an authority that cannot answer, a coordination defect, a malformed
 * selection and a refused or uncertain commit publish nothing. A failed or
 * uncertain outcome commit after a publication is reported as a failure, with
 * what was published, never as a clean success.
 */

import type { Logger } from '../../../logging/logger';
import type { SeasonPublicationSequencerPort } from '../../../publication/sequencer/port';
import type { SnapshotStorage } from '../../../storage/types';
import {
  publishUnderLease,
  recoverUnfinishedPublication,
  type CuratedSeasonMetadata,
  type PublicationRunResult,
} from '../outcome';
import {
  composeCoordinatedRuntime,
  type CoordinatedRuntime,
  type CoordinatedRuntimeDependencies,
  type CoordinatedUnavailableReason,
} from '../composition';
import { signalAttention } from '../operator/attention';
import type {
  LeaseGrant,
  LeaseToken,
  LedgerCommitRequest,
  LedgerRejectionReason,
  LedgerSnapshot,
  SeasonRecord,
} from '../ledger/model';
import {
  countPolicyEvents,
  planRun,
  publicationStop,
  recordRunObservations,
  type NothingDueReason,
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
  'recovery',
  'coordination',
  'observation',
  'commit',
  'publication',
  'intent',
  'outcome',
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
  /** The curated metadata source. Defaults to the bundled records (O-14). */
  readonly metadata?: (season: number) => CuratedSeasonMetadata | null;
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
      /**
       * Present only when the run failed after reaching the publication half:
       * what it decided or published before the durable write that failed.
       */
      readonly publication?: PublicationRunResult | null;
    }
  | {
      readonly status: 'nothing-due';
      readonly reason: NothingDueReason;
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
      /** `not-attempted` for an observation plan, which never publishes. */
      readonly publication: 'not-attempted' | PublicationRunResult;
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
  const outcome =
    composition.kind === 'unavailable'
      ? logged(dependencies.logger, {
          ...fields,
          status: 'coordinated-runtime-unavailable',
          reasons: composition.reasons,
          providerRequests: 0,
        })
      : await runUnderComposition(
          request,
          dependencies,
          composition.runtime,
          fields,
        );
  // Step 9, against whichever ledger is bound, even when another dependency
  // is missing: a degraded runtime must not silence a stopped season.
  if (request.trigger === 'scheduled' && dependencies.ledger !== null) {
    await signalAttention(
      dependencies.ledger,
      request.season,
      dependencies.logger,
    );
  }
  return outcome;
}

/** Steps 2-8, for a composed runtime. */
async function runUnderComposition(
  request: CoordinatedObservationRequest,
  dependencies: CoordinatedObservationDependencies,
  runtime: CoordinatedRuntime,
  fields: RunFields,
): Promise<CoordinatedObservationOutcome> {
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

/** Steps 3-7. Everything here runs under the acquired lease. */
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

  const recovered = await recover(
    dependencies,
    runtime,
    lease,
    reconciled.snapshot,
    published.activeVersion,
  );
  if (recovered.kind === 'failed') return recovered.failure;
  const snapshot = recovered.snapshot;

  const plannedAt = dependencies.clock.now();
  const plan = planRun({
    now: plannedAt,
    snapshot,
    trigger: request.trigger,
  });
  if (plan.kind === 'nothing-due') {
    return { status: 'nothing-due', reason: plan.reason, providerRequests: 0 };
  }
  if (Date.parse(grant.expiresAt) <= dependencies.clock.now().getTime()) {
    // No request is sent under a lease that can no longer commit.
    return failure('coordination', 'lease-expired', null, 0);
  }

  return observe(request, dependencies, runtime, grant, snapshot, plan);
}

/**
 * Resolves a publication a previous run left `publishing`, before planning.
 * A slot that cannot be resolved fails the run before any provider request.
 */
async function recover(
  dependencies: CoordinatedObservationDependencies,
  runtime: CoordinatedRuntime,
  lease: LeaseToken,
  snapshot: LedgerSnapshot,
  activeVersion: string,
): Promise<
  | { readonly kind: 'ready'; readonly snapshot: LedgerSnapshot }
  | { readonly kind: 'failed'; readonly failure: Omit<Failure, 'leaseRelease'> }
> {
  const current = snapshot.seasonRecord;
  const recovery = await recoverUnfinishedPublication({
    record: current?.record ?? null,
    activeVersion,
    storage: dependencies.storage,
    now: dependencies.clock.now(),
  });
  if (recovery.kind === 'none') return { kind: 'ready', snapshot };
  if (recovery.kind === 'unreadable') {
    return {
      kind: 'failed',
      failure: failure('recovery', 'published-release-unavailable', null, 0),
    };
  }
  const outcome = await runtime.ledger.commit({
    lease,
    seasonRecord: {
      expectedVersion: current!.version,
      record: recovery.record,
    },
    classifications: [],
    backlogInsertions: [],
    backlogRemovals: [],
  });
  if (outcome.outcome !== 'committed') {
    return { kind: 'failed', failure: ledgerFailure('recovery', outcome, 0) };
  }
  return { kind: 'ready', snapshot: outcome.snapshot };
}

async function observe(
  request: CoordinatedObservationRequest,
  dependencies: CoordinatedObservationDependencies,
  runtime: CoordinatedRuntime,
  grant: LeaseGrant,
  snapshot: LedgerSnapshot,
  plan: Exclude<RunPlan, { readonly kind: 'nothing-due' }>,
): Promise<HeldOutcome> {
  const lease: LeaseToken = { season: grant.season, fence: grant.fence };
  const run = await runtime.coordinator.coordinate({
    plan: { season: request.season, resources: plan.resources },
    ...(request.signal ? { signal: request.signal } : {}),
  });
  // The observation instant is taken once every response has arrived, never
  // at planning: what the run records as attempted and observed must not
  // predate the responses it describes. The plan's slots are unaffected.
  const observedAt = dependencies.clock.now();
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
  // A stopped season publishes nothing, so there is no publication to mark
  // unfinished: its hold or block survives the commit as it is either way.
  const stopped =
    publicationStop(snapshot.seasonRecord?.record ?? null) !== null;
  const commitRequest =
    plan.kind === 'publication' && !stopped
      ? markPublishing(result.request, snapshot, observedAt)
      : result.request;

  const committed = hasWrites(commitRequest);
  let after = snapshot;
  if (committed) {
    const outcome = await runtime.ledger.commit(commitRequest);
    if (outcome.outcome !== 'committed') {
      return ledgerFailure('commit', outcome, providerRequests);
    }
    after = outcome.snapshot;
  }
  const events = countPolicyEvents(result.events);
  const observed = {
    status: 'observed',
    plan: plan.kind,
    coordination: run.status,
    providerRequests,
    committed,
    events,
  } as const;
  if (plan.kind === 'observation') {
    return { ...observed, publication: 'not-attempted' };
  }

  const step = await publishUnderLease({
    runtime,
    sequencer: dependencies.sequencer,
    clock: () => dependencies.clock.now(),
    lease,
    leaseExpiresAt: grant.expiresAt,
    plan,
    run,
    seasonOutcomes: mapped.seasonOutcomes,
    classificationOutcomes: mapped.classificationOutcomes,
    committed: after,
    previous: snapshot.seasonRecord?.record.publicationDisposition ?? null,
    capacityExceeded:
      (events['classification.backlog-capacity-exceeded'] ?? 0) > 0,
    observedAt,
    ...(dependencies.metadata ? { metadata: dependencies.metadata } : {}),
  });
  if (step.kind === 'failed') {
    return {
      ...failure(
        step.stage,
        step.failure,
        step.ledgerRejection,
        providerRequests,
      ),
      publication: step.publication,
    };
  }
  return { ...observed, publication: step.publication };
}

/**
 * The season record a publication run's observation commit writes: the
 * policy's record, marked `publishing` until the outcome commit replaces it.
 * A season record exists, because a publication plan needs an observed
 * calendar.
 */
function markPublishing(
  request: LedgerCommitRequest,
  snapshot: LedgerSnapshot,
  observedAt: Date,
): LedgerCommitRequest {
  const stored = snapshot.seasonRecord;
  const record: SeasonRecord | undefined =
    request.seasonRecord?.record ?? stored?.record;
  if (record === undefined) {
    throw new TypeError('A publication plan without a season record.');
  }
  return {
    ...request,
    seasonRecord: {
      expectedVersion: stored?.version ?? 0,
      record: {
        ...record,
        publicationDisposition: {
          state: 'publishing',
          since: observedAt.toISOString(),
          digest: null,
          orderingInput: null,
        },
      },
    },
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
 * categories. No revision, digest, round, instant, provider value or payload.
 * A run that published, confirmed or deliberately withheld with a retry is
 * quiet; a block, a durable block, a stop, a refusal, an unknown commit and
 * every failure warn - including a manual run a stop refused.
 */
function logged(
  logger: Logger,
  outcome: CoordinatedObservationOutcome,
): CoordinatedObservationOutcome {
  const publication =
    outcome.status === 'observed' || outcome.status === 'failed'
      ? (outcome.publication ?? null)
      : null;
  const settled = publication === 'not-attempted' ? null : publication;
  const quiet =
    (outcome.status === 'nothing-due' &&
      outcome.reason !== 'publication-stopped') ||
    (outcome.status === 'observed' &&
      (settled === null ||
        (settled.outcome !== 'not-applied' &&
          settled.next !== 'blocked' &&
          settled.next !== 'durably-blocked' &&
          settled.next !== 'stopped' &&
          settled.next !== 'resolve')));
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
    ...(settled === null ? {} : publicationFields(settled)),
  };
  if (quiet) logger.info(event);
  else logger.warn(event);
  return outcome;
}

function publicationFields(publication: PublicationRunResult) {
  return {
    publicationOutcome: publication.outcome,
    publicationNextDue: publication.next,
    ...(publication.outcome === 'published'
      ? { releaseVersion: publication.releaseVersion }
      : {}),
    ...(publication.outcome === 'not-applied'
      ? { publicationStatus: publication.publicationStatus }
      : {}),
    ...(publication.outcome === 'withheld'
      ? { publicationReason: publication.cause }
      : {}),
    ...((publication.outcome === 'not-applied' ||
      publication.outcome === 'published') &&
    publication.reason !== null
      ? { publicationReason: publication.reason }
      : {}),
  };
}
