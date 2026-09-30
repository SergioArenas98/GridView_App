/**
 * Drives one ledger store directly, without a stub boundary.
 *
 * This is what makes the port testable end to end in the repository's
 * plain-Node runner. It adds no authority of its own: every decision is taken
 * inside the store's transaction. A storage failure is reported as
 * `unavailable`, which is exact here - the in-process transaction threw, so
 * none of its writes applied.
 */

import type { ReconciliationLedgerPort } from '../ledger-port';
import type {
  DispositionRequest,
  LeaseAcquisition,
  LeaseRelease,
  LeaseToken,
  LedgerCommitOutcome,
  LedgerCommitRequest,
  LedgerReadOutcome,
  LedgerUnavailable,
  OperatorActionRequest,
  OperatorTransitionOutcome,
  PublishedReconciliationOutcome,
  PublishedReconciliationRequest,
} from './model';
import type { ReconciliationLedgerStore } from './store';

export class LocalReconciliationLedger implements ReconciliationLedgerPort {
  readonly ledger = 'reconciliation' as const;

  constructor(private readonly store: ReconciliationLedgerStore) {}

  async readSeason(season: number): Promise<LedgerReadOutcome> {
    return guarded(() => this.store.readSeason({ season }));
  }

  async acquireLease(season: number): Promise<LeaseAcquisition> {
    return guarded(() => this.store.acquireLease({ season }));
  }

  async releaseLease(lease: LeaseToken): Promise<LeaseRelease> {
    return guarded(() => this.store.releaseLease(lease));
  }

  async commit(request: LedgerCommitRequest): Promise<LedgerCommitOutcome> {
    return guarded(() => this.store.commit(request));
  }

  async reconcilePublishedRevisions(
    request: PublishedReconciliationRequest,
  ): Promise<PublishedReconciliationOutcome> {
    return guarded(() => this.store.reconcilePublishedRevisions(request));
  }

  async operate(
    request: OperatorActionRequest,
  ): Promise<OperatorTransitionOutcome> {
    return guarded(() => this.store.operate(request));
  }

  async dispose(
    request: DispositionRequest,
  ): Promise<OperatorTransitionOutcome> {
    return guarded(() => this.store.dispose(request));
  }
}

function guarded<T>(run: () => T): T | LedgerUnavailable {
  try {
    return run();
  } catch {
    return { outcome: 'unavailable' };
  }
}
