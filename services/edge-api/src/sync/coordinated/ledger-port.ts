/**
 * The G9 reconciliation ledger seam (ADR 0020 implementation obligation 3).
 *
 * A coordinated run needs the ledger before it may plan anything: the ledger
 * holds the run lease, the per-round review state and the due times that
 * decide which requests a run makes.
 *
 * **The storage protocol is defined; nothing uses it.** The operations below
 * are the storage foundation (C1): transactional reads, fenced season leases,
 * conditional commits, the global backlog capacity and reconciliation of the
 * published-revision cache from the authoritative release. They are
 * implemented by `ReconciliationLedgerStore` (`ledger/store.ts`) and reached
 * either in process (`LocalReconciliationLedger`) or through the
 * `ReconciliationLedger` Durable Object client. What to write - §10.4.1
 * transitions, corroboration, settling, due-work planning and the
 * publishability decision - is the pure policy in `policy/`. Only the
 * orchestration in `observation/` and `outcome/` commits through this port:
 * observations, the ordering-input reservation and the publication outcome.
 * The Worker's scheduled handler and `POST /internal/admin/sync/full` reach
 * that orchestration only through `runCoordinatedSync`, whose gate needs a
 * ledger first. The operator transitions (`operate`, `dispose`; PR-E1,
 * `verify`; PR-E3, and `rotateVerifications`; PR-E4) are reached only by the
 * admin reconciliation routes (PR-E2 to PR-E4), which also read the season to
 * inspect it.
 *
 * `resolveReconciliationLedger` reads one optional Durable Object binding,
 * `RECONCILIATION_LEDGER`, and fails closed: without a usable namespace there
 * it answers `null`. **Only `env.staging` declares that binding** in
 * `wrangler.toml`, and only under `PROVIDER_MODE = "mock"`; development and
 * production declare none, and no test hook supplies a ledger. Without a
 * bound namespace every coordinated run, scheduled or manual, is refused as
 * `ledger-unbound` at the entry point's gate - wired, but unbound - before
 * any lease, limiter reservation, provider request or publication write, and
 * every operator route and the coordinated rollback are refused as
 * `ledger-unbound` before reading anything. Outside `coordinated` mode none
 * of them reads the ledger, bound or not.
 */

import type { Env } from '../../config/environment';
import type {
  DispositionRequest,
  LeaseAcquisition,
  LeaseRelease,
  LeaseToken,
  LedgerCommitOutcome,
  LedgerCommitRequest,
  LedgerReadOutcome,
  OperatorActionRequest,
  OperatorTransitionOutcome,
  PublishedReconciliationOutcome,
  PublishedReconciliationRequest,
  VerificationRequest,
  VerificationRotationRequest,
} from './ledger/model';
import { ledgerClientFor } from './ledger/durable-object';

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

  /**
   * A season-level operator action: hold, release the hold, or clear a
   * durable block. The only writer of the hold. Reached by the hold,
   * release-hold and clear-block admin routes.
   */
  operate(request: OperatorActionRequest): Promise<OperatorTransitionOutcome>;

  /**
   * T12: disposes of one staged correction. The only operation that clears a
   * staged slot or releases a backlog entry. Reached by the disposition
   * admin route.
   */
  dispose(request: DispositionRequest): Promise<OperatorTransitionOutcome>;

  /**
   * T11-T11c: records one operator verification of one staged correction.
   * The only operation that creates a competing correction, and so the
   * review lock. Reached by the verification admin route (PR-E3).
   */
  verify(request: VerificationRequest): Promise<OperatorTransitionOutcome>;

  /**
   * PR-E4: clears one round's full verification history into the next
   * generation, under an operator hold, for the history the operator
   * archived. The only writer of the generation. Reached by the
   * verification-rotation admin route.
   */
  rotateVerifications(
    request: VerificationRotationRequest,
  ): Promise<OperatorTransitionOutcome>;
}

/**
 * The ledger client for the running environment's `RECONCILIATION_LEDGER`
 * binding, or `null` when it is absent or is not a Durable Object namespace.
 *
 * It reads that binding and nothing else: no provider mode, no test hook. A
 * bound namespace activates nothing by itself - every coordinated path still
 * needs `PROVIDER_MODE=coordinated` and its other gated dependencies - and
 * resolving it performs no lookup. Binding availability is
 * environment-specific (see `docs/technical/GridView_Environments.md`).
 */
export function resolveReconciliationLedger(
  env: Pick<Env, 'RECONCILIATION_LEDGER'>,
): ReconciliationLedgerPort | null {
  return ledgerClientFor(env.RECONCILIATION_LEDGER);
}
