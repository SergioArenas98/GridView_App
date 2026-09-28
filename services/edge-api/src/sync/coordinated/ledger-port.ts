/**
 * The G9 reconciliation ledger seam (ADR 0020 implementation obligation 3).
 *
 * A coordinated run needs the ledger before it may plan anything: the ledger
 * holds the run lease, the per-round review state and the due times that
 * decide which requests a run makes.
 *
 * **The storage protocol is defined; nothing binds it.** The operations below
 * are the storage foundation (C1): transactional reads, fenced season leases,
 * conditional commits, the global backlog capacity and reconciliation of the
 * published-revision cache from the authoritative release. They are
 * implemented by `ReconciliationLedgerStore` (`ledger/store.ts`) and reached
 * either in process (`LocalReconciliationLedger`) or through the
 * `ReconciliationLedger` Durable Object client. What to write - §10.4.1
 * transitions, corroboration, settling, due-work planning and the
 * publishability decision - is the pure policy in `policy/`. Only the
 * injected observation orchestration in `observation/` commits its records
 * through this port, and no Worker run reaches it. The no-change decision
 * does not exist.
 *
 * No binding, variable or test hook supplies a ledger to the runtime, so
 * `resolveReconciliationLedger` always answers `null`. Every coordinated run,
 * scheduled or manual, is therefore refused as `ledger-unbound` before any
 * provider request.
 */

import type {
  LeaseAcquisition,
  LeaseRelease,
  LeaseToken,
  LedgerCommitOutcome,
  LedgerCommitRequest,
  LedgerReadOutcome,
  PublishedReconciliationOutcome,
  PublishedReconciliationRequest,
} from './ledger/model';

export interface ReconciliationLedgerPort {
  /** Brands the seam. */
  readonly ledger: 'reconciliation';

  /** One season's ledger state. Takes no lease and writes nothing. */
  readSeason(season: number): Promise<LedgerReadOutcome>;

  /**
   * Takes the season's lease, with the next fencing token, when no valid
   * lease is held, and answers the season's state in the same transaction.
   */
  acquireLease(season: number): Promise<LeaseAcquisition>;

  /** Gives the lease back. Only the current, unsuperseded token may. */
  releaseLease(lease: LeaseToken): Promise<LeaseRelease>;

  /** Applies every conditional write in the request, or none of them. */
  commit(request: LedgerCommitRequest): Promise<LedgerCommitOutcome>;

  /**
   * Replaces the season's cached published revisions with the authoritative
   * release's. The only writer of `publishedRevision`.
   */
  reconcilePublishedRevisions(
    request: PublishedReconciliationRequest,
  ): Promise<PublishedReconciliationOutcome>;
}

/**
 * Always `null`: no ledger is bound. It reads no binding and no test hook,
 * because this change declares neither.
 */
export function resolveReconciliationLedger(): ReconciliationLedgerPort | null {
  return null;
}
