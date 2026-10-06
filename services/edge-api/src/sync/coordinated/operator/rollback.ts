/**
 * The coordinated-mode rollback prerequisite (OD-3): a rollback of a season
 * the coordinated runtime publishes runs **only while an operator holds the
 * season**, and under the season's lease.
 *
 * Without the hold, the next tick would see the authority serve a release
 * other than the one the runtime last recorded, and republish (drift). With
 * it, nothing publishes until the operator releases the hold, which is
 * consent to resume. The lease serializes the rollback with runs and with
 * operator actions, so none of them interleaves with it.
 *
 * The rollback itself is the existing one, handed in unchanged: in sequencer
 * mode the ADR 0025 D8 republication, through the ADR 0026 D14/D15 guard, the
 * prepare CAS and finalize. **Nothing here exempts it from the guard** - a
 * target that drops a classified round or a participation fact is refused
 * there, and the hold stays.
 *
 * `POST /internal/admin/rollback` calls it in coordinated mode only (PR-E2).
 * `resolveReconciliationLedger` answers `null` in every committed
 * environment, so there the route refuses before this is reached.
 */

import type { PublicationResult } from '../../../publication/publisher';
import type { Clock } from '../../../runtime/clock';
import type { LeaseToken, LedgerRejectionReason } from '../ledger/model';
import type { ReconciliationLedgerPort } from '../ledger-port';
import {
  releaseSeasonLease as release,
  type LeaseReleaseResult,
} from './lease';

export interface HeldRollbackRequest {
  readonly season: number;
  /** The release to roll back to; the existing default when absent. */
  readonly targetVersion?: string;
}

export interface HeldRollbackDependencies {
  readonly ledger: ReconciliationLedgerPort;
  readonly clock: Clock;
  /** The existing rollback command, unchanged. */
  readonly rollback: (
    season: number,
    targetVersion?: string,
  ) => Promise<PublicationResult>;
}

export type HeldRollbackOutcome =
  | {
      /** A run or another operator action holds the season's lease. */
      readonly status: 'run-in-progress';
      readonly rollbackCalls: 0;
    }
  | {
      /** The ledger could not be reached, or refused the lease. */
      readonly status: 'ledger-unavailable';
      readonly ledgerRejection: LedgerRejectionReason | null;
      readonly rollbackCalls: 0;
    }
  | {
      /** No operator hold: refused before the rollback was reached. */
      readonly status: 'not-held';
      readonly rollbackCalls: 0;
      readonly leaseRelease: LeaseReleaseResult;
    }
  | {
      /** The lease expired before the rollback could start under it. */
      readonly status: 'lease-expired';
      readonly rollbackCalls: 0;
      readonly leaseRelease: LeaseReleaseResult;
    }
  | {
      /** Held: the rollback ran once. `result` says whether it applied. */
      readonly status: 'attempted';
      readonly result: PublicationResult;
      readonly rollbackCalls: 1;
      readonly leaseRelease: LeaseReleaseResult;
    };

export async function rollbackUnderHold(
  request: HeldRollbackRequest,
  dependencies: HeldRollbackDependencies,
): Promise<HeldRollbackOutcome> {
  const { ledger } = dependencies;
  const acquired = await ledger.acquireLease(request.season);
  if (acquired.outcome !== 'acquired') {
    if (acquired.outcome === 'rejected' && acquired.reason === 'lease-held') {
      return { status: 'run-in-progress', rollbackCalls: 0 };
    }
    return {
      status: 'ledger-unavailable',
      ledgerRejection: acquired.outcome === 'rejected' ? acquired.reason : null,
      rollbackCalls: 0,
    };
  }
  const lease: LeaseToken = {
    season: acquired.lease.season,
    fence: acquired.lease.fence,
  };

  const held = acquired.snapshot.seasonRecord?.record.operatorHold ?? null;
  if (held === null) {
    return {
      status: 'not-held',
      rollbackCalls: 0,
      leaseRelease: await release(ledger, lease),
    };
  }
  if (
    Date.parse(acquired.lease.expiresAt) <= dependencies.clock.now().getTime()
  ) {
    return {
      status: 'lease-expired',
      rollbackCalls: 0,
      leaseRelease: await release(ledger, lease),
    };
  }

  let result: PublicationResult;
  try {
    result =
      request.targetVersion === undefined
        ? await dependencies.rollback(request.season)
        : await dependencies.rollback(request.season, request.targetVersion);
  } catch (error) {
    // Released on every path, including a rollback that throws.
    await release(ledger, lease);
    throw error;
  }
  return {
    status: 'attempted',
    result,
    rollbackCalls: 1,
    leaseRelease: await release(ledger, lease),
  };
}
