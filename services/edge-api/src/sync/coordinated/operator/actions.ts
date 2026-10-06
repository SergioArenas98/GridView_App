/**
 * The operator transitions, each under the season's lease (PR-E2): one
 * season-level action (hold, release the hold, clear a durable block), one
 * T12 disposition of a staged correction, or one rotation of a round's full
 * verification history (PR-E4).
 *
 * Each call takes the season's fenced lease, makes exactly one ledger
 * operation with it, and gives it back on every path. The ledger makes every
 * check itself, in the same transaction as the write: the lease fence, the
 * inspected versions and revisions, the replay of an operation ID, and the
 * state the action requires (`../ledger/operator.ts`). Nothing here decides
 * a transition, so nothing here can admit one the ledger would refuse.
 *
 * Nothing here publishes, reads a provider or writes anything but the
 * ledger. A released hold, a cleared block or a disposition only makes
 * publication due; the next run publishes through every guard. A rotation
 * makes nothing due: it only lets the round be verified again.
 */

import type {
  DispositionAction,
  LeaseToken,
  LedgerRejectionReason,
  LedgerSnapshot,
  OperationId,
  OperatorAuthMethod,
  OperatorTransitionOutcome,
  RevisionHash,
  SeasonOperatorAction,
} from '../ledger/model';
import type { ReconciliationLedgerPort } from '../ledger-port';
import { releaseSeasonLease, type LeaseReleaseResult } from './lease';

/**
 * How every operator action is authenticated today (OD-2): the one shared
 * bearer token. It names a method, never a person, and the token itself is
 * never passed on.
 */
export const OPERATOR_AUTH_METHOD: OperatorAuthMethod = 'shared-admin-token';

export interface SeasonActionCommand {
  readonly season: number;
  readonly action: SeasonOperatorAction;
  readonly operationId: OperationId;
  /** The season record version the operator inspected; 0 for none. */
  readonly expectedVersion: number;
}

export interface DispositionCommand {
  readonly season: number;
  readonly round: number;
  readonly action: DispositionAction;
  readonly operationId: OperationId;
  readonly expected: {
    readonly recordVersion: number;
    readonly contentRevision: RevisionHash;
    readonly stagedRevision: RevisionHash;
    readonly competingRevision: RevisionHash | null;
  };
}

/**
 * One rotation of a round's full verification history (PR-E4). `expected`
 * names the record the operator inspected and the digest of the history
 * they archived from the read-only history route.
 */
export interface VerificationRotationCommand {
  readonly season: number;
  readonly round: number;
  readonly operationId: OperationId;
  readonly expected: {
    readonly recordVersion: number;
    readonly verificationGeneration: number;
    readonly historyDigest: RevisionHash;
  };
}

/** What one operator transition did. Closed, and safe to log. */
export type OperatorActionResult =
  | {
      /** `already-applied`: a resent operation ID; nothing was written. */
      readonly status: 'applied' | 'already-applied';
      readonly snapshot: LedgerSnapshot;
      readonly leaseRelease: LeaseReleaseResult;
    }
  | {
      /** A run or another operator action holds the season's lease. */
      readonly status: 'run-in-progress';
    }
  | {
      /** The ledger refused: nothing was written. */
      readonly status: 'refused';
      readonly reason: LedgerRejectionReason;
      /** `null` when the lease itself was refused. */
      readonly leaseRelease: LeaseReleaseResult | null;
    }
  | {
      /** The ledger could not be reached: nothing is known to be written. */
      readonly status: 'ledger-unavailable';
      readonly leaseRelease: LeaseReleaseResult | null;
    }
  | {
      /**
       * The write's answer was lost: it may have committed. Resending the
       * same operation ID settles it, as `applied` or `already-applied`.
       */
      readonly status: 'outcome-unknown';
      readonly leaseRelease: LeaseReleaseResult;
    };

export function operateUnderLease(
  ledger: ReconciliationLedgerPort,
  command: SeasonActionCommand,
): Promise<OperatorActionResult> {
  return underLease(ledger, command.season, (lease) =>
    ledger.operate({
      lease,
      action: command.action,
      operationId: command.operationId,
      authMethod: OPERATOR_AUTH_METHOD,
      expectedVersion: command.expectedVersion,
    }),
  );
}

export function disposeUnderLease(
  ledger: ReconciliationLedgerPort,
  command: DispositionCommand,
): Promise<OperatorActionResult> {
  return underLease(ledger, command.season, (lease) =>
    ledger.dispose({
      lease,
      round: command.round,
      action: command.action,
      operationId: command.operationId,
      authMethod: OPERATOR_AUTH_METHOD,
      expected: command.expected,
    }),
  );
}

export function rotateUnderLease(
  ledger: ReconciliationLedgerPort,
  command: VerificationRotationCommand,
): Promise<OperatorActionResult> {
  return underLease(ledger, command.season, (lease) =>
    ledger.rotateVerifications({
      lease,
      round: command.round,
      operationId: command.operationId,
      authMethod: OPERATOR_AUTH_METHOD,
      expected: command.expected,
    }),
  );
}

async function underLease(
  ledger: ReconciliationLedgerPort,
  season: number,
  transition: (lease: LeaseToken) => Promise<OperatorTransitionOutcome>,
): Promise<OperatorActionResult> {
  const acquired = await ledger.acquireLease(season);
  if (acquired.outcome !== 'acquired') {
    if (acquired.outcome === 'unavailable') {
      return { status: 'ledger-unavailable', leaseRelease: null };
    }
    return acquired.reason === 'lease-held'
      ? { status: 'run-in-progress' }
      : { status: 'refused', reason: acquired.reason, leaseRelease: null };
  }
  const lease: LeaseToken = {
    season: acquired.lease.season,
    fence: acquired.lease.fence,
  };

  let outcome: OperatorTransitionOutcome;
  try {
    outcome = await transition(lease);
  } catch (error) {
    // Released on every path, including a transport that throws.
    await releaseSeasonLease(ledger, lease);
    throw error;
  }
  const leaseRelease = await releaseSeasonLease(ledger, lease);
  switch (outcome.outcome) {
    case 'applied':
    case 'already-applied':
      return {
        status: outcome.outcome,
        snapshot: outcome.snapshot,
        leaseRelease,
      };
    case 'rejected':
      return { status: 'refused', reason: outcome.reason, leaseRelease };
    case 'unavailable':
      return { status: 'ledger-unavailable', leaseRelease };
    case 'uncertain':
      return { status: 'outcome-unknown', leaseRelease };
  }
}
