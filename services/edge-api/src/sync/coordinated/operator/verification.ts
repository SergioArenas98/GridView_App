/**
 * Operator verification of one staged correction (Provider Evaluation
 * §10.4.1 T11-T11c; operator disposition decision pack A6; OD-7; PR-E3).
 *
 * An explicit, per-record, human-initiated check: never a timer, a cron, the
 * sweep or a run. One call, in this order:
 *
 * 0. Compose the coordinated runtime through the run's own gate. A refused
 *    composition has built nothing that could send a request, and the ledger
 *    is not read.
 *
 * Then under the season's fenced lease, which is released on every path:
 *
 * 1. Take the lease. A lease someone else holds means a run or another
 *    operator action is in progress: nothing is read or sent.
 * 2. Check the target in the snapshot the lease was granted with, before any
 *    capacity is reserved: a resent operation ID is answered from the ledger
 *    and sends nothing; then the record must hold exactly the staged revision
 *    the operator named, with its backlog entry, must not be locked for
 *    review (T11d), and its round must have reached the earliest time it may
 *    be asked for (`anchor + 5h`, the planner's own eligibility rule).
 * 3. Make **one** classification request through the composed runtime's
 *    coordinator, port, client, pacer and limiter (`requestClassification`).
 *    No retry.
 * 4. Record what it produced through the ledger's `verify` operation, which
 *    re-checks the lease, the record version, the staged target, the backlog
 *    entry and the replay in the same transaction as its one write
 *    (`../ledger/verification.ts`). A limiter deferral records only the retry
 *    instant; a request that never left GridView, or a coordinator defect,
 *    records nothing.
 *
 * Then, outside the lease, the OD-7 comparison with the published document
 * (`comparison.ts`), for a fresh valid result only.
 *
 * It never publishes, disposes of a correction, clears a hold or a block, or
 * changes an accepted or published revision; it writes no season record, no
 * backlog entry and no Workers KV.
 */

import type { SeasonPublicationSequencerPort } from '../../../publication/sequencer/port';
import type { Clock } from '../../../runtime/clock';
import type { SnapshotStorage } from '../../../storage/types';
import { classificationRevision } from '../classification-revision';
import {
  composeCoordinatedRuntime,
  requestClassification,
  type ClassificationRequestRefusal,
  type CoordinatedRuntime,
  type CoordinatedRuntimeDependencies,
  type CoordinatedUnavailableReason,
} from '../composition';
import type {
  ClassificationMarker,
  ClassificationRecord,
  LeaseToken,
  LedgerRejectionReason,
  LedgerSnapshot,
  OperationId,
  ReviewState,
  RevisionHash,
  VerificationObservation,
  VerificationTransition,
  Versioned,
} from '../ledger/model';
import {
  verificationMatch,
  verificationRefusal,
  type VerificationMatch,
} from '../ledger/verification';
import type { ReconciliationLedgerPort } from '../ledger-port';
import { isEligible } from '../policy/cadence';
import { OPERATOR_AUTH_METHOD } from './actions';
import {
  compareWithPublished,
  comparisonUnavailable,
  type PublishedComparison,
} from './comparison';
import { releaseSeasonLease, type LeaseReleaseResult } from './lease';

export interface VerificationCommand {
  readonly season: number;
  readonly round: number;
  readonly operationId: OperationId;
  /** The staged revision the operator read from the inspection. */
  readonly expectedStagedRevision: RevisionHash;
}

export interface VerificationDependencies {
  /**
   * The gated dependencies a coordinated run composes from, with the ledger
   * the operator route resolved.
   */
  readonly runtime: CoordinatedRuntimeDependencies & {
    readonly ledger: ReconciliationLedgerPort;
  };
  /**
   * The authority the published comparison base is read from: the
   * sequencer's port, or `null` when the authority is not a sequencer.
   */
  readonly sequencer: SeasonPublicationSequencerPort | null;
  readonly storage: SnapshotStorage;
}

/** What the lease-held part of a verification runs with, once composed. */
interface Composed {
  readonly ledger: ReconciliationLedgerPort;
  readonly runtime: CoordinatedRuntime;
  readonly sequencer: SeasonPublicationSequencerPort;
  readonly storage: SnapshotStorage;
  readonly clock: Clock;
}

/** Why a verification was refused before any request. Closed. */
export const verificationPreconditions = [
  /** The operation ID already named a verification of another target. */
  'operation-id-reused',
  /** No record, or nothing staged on it. */
  'not-staged',
  /** Something else is staged now: the operator's target is stale. */
  'staged-revision-mismatch',
  /** No backlog entry holds the staged revision. */
  'backlog-entry-missing',
  /** A competing correction is already held (T11d). */
  'review-locked',
  /** The round's first check is not due yet (`anchor + 5h`). */
  'not-eligible',
  /** The lease expired before the request could be sent. */
  'lease-expired',
] as const;
export type VerificationPrecondition =
  (typeof verificationPreconditions)[number];

/** The review state a verification leaves. Revisions are not repeated. */
export interface VerifiedRecord {
  readonly recordVersion: number;
  readonly reviewState: ReviewState;
  readonly markers: readonly ClassificationMarker[];
}

/** What one verification did. Closed, and safe to log without its comparison. */
export type VerificationResult =
  | {
      /**
       * Recorded. `provider-failed` is T6: the request failed and only the
       * attempt was recorded. `already-applied` is a resent operation ID:
       * nothing was sent or written, and the recorded transition is repeated.
       */
      readonly status: 'verified' | 'provider-failed' | 'already-applied';
      readonly transition: VerificationTransition;
      /** Which revision the observation matched; `null` when none was made. */
      readonly match: VerificationMatch | null;
      readonly record: VerifiedRecord;
      readonly comparison: PublishedComparison;
      readonly providerRequests: number;
      readonly leaseRelease: LeaseReleaseResult;
    }
  | {
      /** The limiter deferred the request; only its retry time is recorded. */
      readonly status: 'deferred';
      readonly retryAt: string;
      readonly providerRequests: number;
      readonly leaseRelease: LeaseReleaseResult;
    }
  | {
      /**
       * Nothing recorded: the request never left GridView (`not-attempted`),
       * or the coordinator's answer was not a provider outcome.
       */
      readonly status: 'not-attempted' | 'observation-refused';
      readonly reason: ClassificationRequestRefusal | null;
      readonly providerRequests: number;
      readonly leaseRelease: LeaseReleaseResult;
    }
  | {
      readonly status: 'precondition-failed';
      readonly reason: VerificationPrecondition;
      readonly providerRequests: 0;
      readonly leaseRelease: LeaseReleaseResult;
    }
  | {
      /** A run or another operator action holds the season's lease. */
      readonly status: 'run-in-progress';
      readonly providerRequests: 0;
    }
  | {
      /** The runtime did not compose: nothing was read or built. */
      readonly status: 'coordinated-runtime-unavailable';
      readonly reasons: readonly CoordinatedUnavailableReason[];
      readonly providerRequests: 0;
    }
  | {
      /** The ledger refused; nothing was written. */
      readonly status: 'refused';
      readonly reason: LedgerRejectionReason;
      readonly providerRequests: number;
      readonly leaseRelease: LeaseReleaseResult | null;
    }
  | {
      /** The ledger could not be reached: nothing is known to be written. */
      readonly status: 'ledger-unavailable';
      readonly providerRequests: number;
      readonly leaseRelease: LeaseReleaseResult | null;
    }
  | {
      /**
       * The write's answer was lost: it may have committed. Resending the
       * same operation ID settles it without a second request when it did.
       */
      readonly status: 'outcome-unknown';
      readonly providerRequests: number;
      readonly leaseRelease: LeaseReleaseResult;
    };

type Held = DistributiveOmit<
  Exclude<
    VerificationResult,
    { status: 'run-in-progress' | 'coordinated-runtime-unavailable' }
  >,
  'leaseRelease'
>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** A fresh, valid observation to compare once the lease is released. */
interface Comparable {
  readonly observed: Parameters<typeof compareWithPublished>[0]['observed'];
  readonly acceptedRevision: RevisionHash | null;
}

export async function verifyUnderLease(
  command: VerificationCommand,
  dependencies: VerificationDependencies,
): Promise<VerificationResult> {
  const composition = composeCoordinatedRuntime(dependencies.runtime);
  if (composition.kind === 'unavailable' || dependencies.sequencer === null) {
    return {
      status: 'coordinated-runtime-unavailable',
      reasons:
        composition.kind === 'unavailable'
          ? composition.reasons
          : ['authority-not-sequencer'],
      providerRequests: 0,
    };
  }
  return verifyComposed(command, {
    ledger: composition.runtime.ledger,
    runtime: composition.runtime,
    sequencer: dependencies.sequencer,
    storage: dependencies.storage,
    clock: dependencies.runtime.clock,
  });
}

async function verifyComposed(
  command: VerificationCommand,
  dependencies: Composed,
): Promise<VerificationResult> {
  const { ledger } = dependencies;
  const acquired = await ledger.acquireLease(command.season);
  if (acquired.outcome !== 'acquired') {
    if (acquired.outcome === 'unavailable') {
      return {
        status: 'ledger-unavailable',
        providerRequests: 0,
        leaseRelease: null,
      };
    }
    return acquired.reason === 'lease-held'
      ? { status: 'run-in-progress', providerRequests: 0 }
      : {
          status: 'refused',
          reason: acquired.reason,
          providerRequests: 0,
          leaseRelease: null,
        };
  }
  const lease: LeaseToken = {
    season: acquired.lease.season,
    fence: acquired.lease.fence,
  };

  let held: { readonly result: Held; readonly compare: Comparable | null };
  try {
    held = await underLease(
      command,
      dependencies,
      lease,
      acquired.lease.expiresAt,
      acquired.snapshot,
    );
  } catch (error) {
    // Released on every path, including a transport that throws.
    await releaseSeasonLease(ledger, lease);
    throw error;
  }
  const leaseRelease = await releaseSeasonLease(ledger, lease);
  const result = { ...held.result, leaseRelease } as VerificationResult;
  if (held.compare === null || !('comparison' in result)) return result;
  return {
    ...result,
    comparison: await compareWithPublished({
      sequencer: dependencies.sequencer,
      storage: dependencies.storage,
      season: command.season,
      round: command.round,
      ...held.compare,
    }),
  };
}

async function underLease(
  command: VerificationCommand,
  dependencies: Composed,
  lease: LeaseToken,
  leaseExpiresAt: string,
  snapshot: LedgerSnapshot,
): Promise<{ readonly result: Held; readonly compare: Comparable | null }> {
  const stored = snapshot.classifications.find(
    (entry) => entry.record.round === command.round,
  );
  const bare = (result: Held) => ({ result, compare: null });
  const replay = replayed(command, stored);
  if (replay !== null) return bare(replay);
  const precondition = preconditionFailure(
    command,
    stored,
    snapshot,
    dependencies.clock.now(),
    leaseExpiresAt,
  );
  if (precondition !== null) {
    return bare({
      status: 'precondition-failed',
      reason: precondition,
      providerRequests: 0,
    });
  }
  const current = stored!;

  const request = await requestClassification(
    dependencies.runtime,
    command.season,
    command.round,
  );
  const { providerRequests } = request;
  const outcome = request.outcome;
  if (outcome.status === 'not-attempted' || outcome.status === 'refused') {
    return bare({
      status:
        outcome.status === 'refused' ? 'observation-refused' : 'not-attempted',
      reason: outcome.status === 'refused' ? outcome.reason : null,
      providerRequests,
    });
  }
  const observation: VerificationObservation =
    outcome.status === 'observed'
      ? {
          status: 'observed',
          revision: await classificationRevision(outcome.result),
        }
      : outcome;

  const written = await dependencies.ledger.verify({
    lease,
    round: command.round,
    operationId: command.operationId,
    authMethod: OPERATOR_AUTH_METHOD,
    expected: {
      recordVersion: current.version,
      stagedRevision: command.expectedStagedRevision,
    },
    observation,
  });
  switch (written.outcome) {
    case 'rejected':
      return bare({
        status: 'refused',
        reason: written.reason,
        providerRequests,
      });
    case 'unavailable':
      return bare({ status: 'ledger-unavailable', providerRequests });
    case 'uncertain':
      return bare({ status: 'outcome-unknown', providerRequests });
  }
  if (observation.status === 'deferred') {
    return bare({
      status: 'deferred',
      retryAt: observation.retryAt,
      providerRequests,
    });
  }
  const after = written.snapshot.classifications.find(
    (entry) => entry.record.round === command.round,
  );
  const transition = after?.record.lastVerification?.transition;
  if (after === undefined || transition === undefined) {
    // The ledger answered without the record it just wrote.
    return bare({ status: 'outcome-unknown', providerRequests });
  }
  const recorded = {
    transition,
    match:
      observation.status === 'observed'
        ? verificationMatch(current.record, observation.revision)
        : null,
    record: verifiedRecord(after),
    comparison: comparisonUnavailable('no-observation'),
    providerRequests,
  };
  if (written.outcome === 'already-applied') {
    return bare({
      ...recorded,
      status: 'already-applied',
      comparison: comparisonUnavailable('not-repeated'),
    });
  }
  if (outcome.status !== 'observed') {
    return bare({ ...recorded, status: 'provider-failed' });
  }
  return {
    result: { ...recorded, status: 'verified' },
    compare: {
      observed: outcome.result,
      acceptedRevision: current.record.contentRevision,
    },
  };
}

/** A resent operation ID, answered from the ledger without any request. */
function replayed(
  command: VerificationCommand,
  stored: Versioned<ClassificationRecord> | undefined,
): Held | null {
  const last = stored?.record.lastVerification ?? null;
  if (last === null || last.operationId !== command.operationId) return null;
  if (last.stagedRevision !== command.expectedStagedRevision) {
    return {
      status: 'precondition-failed',
      reason: 'operation-id-reused',
      providerRequests: 0,
    };
  }
  return {
    status: 'already-applied',
    transition: last.transition,
    match: null,
    record: verifiedRecord(stored!),
    comparison: comparisonUnavailable('not-repeated'),
    providerRequests: 0,
  };
}

function preconditionFailure(
  command: VerificationCommand,
  stored: Versioned<ClassificationRecord> | undefined,
  snapshot: LedgerSnapshot,
  now: Date,
  leaseExpiresAt: string,
): VerificationPrecondition | null {
  const record = stored?.record ?? null;
  const refusal = verificationRefusal(record, command.expectedStagedRevision);
  if (refusal === 'review-locked') return 'review-locked';
  if (refusal !== null) {
    return record?.stagedCorrection == null
      ? 'not-staged'
      : 'staged-revision-mismatch';
  }
  const entry = snapshot.backlog.entries.find(
    (candidate) => candidate.round === command.round,
  );
  if (entry?.revision !== command.expectedStagedRevision) {
    return 'backlog-entry-missing';
  }
  if (!isEligible(record!.anchor, now)) return 'not-eligible';
  // No request is sent under a lease that can no longer record its answer.
  if (Date.parse(leaseExpiresAt) <= now.getTime()) return 'lease-expired';
  return null;
}

function verifiedRecord(
  entry: Versioned<ClassificationRecord>,
): VerifiedRecord {
  return {
    recordVersion: entry.version,
    reviewState: entry.record.reviewState,
    markers: entry.record.markers,
  };
}
