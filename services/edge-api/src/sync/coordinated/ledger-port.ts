/**
 * The G9 reconciliation ledger seam (ADR 0020 implementation obligation 3).
 *
 * **Interface only, and unbound.** A coordinated run needs the ledger before it
 * may plan anything: the ledger holds the run lease, the event anchors, the
 * per-round review state and the due times that decide which requests a run
 * makes. The ledger's operations are defined together with its implementation
 * and the G5 planner, in a later change.
 *
 * Nothing in this change implements the port. No Durable Object, binding,
 * variable or test hook supplies one, so `resolveReconciliationLedger` always
 * answers `null`. Every coordinated run, scheduled or manual, is therefore
 * refused as `ledger-unbound` before any provider request.
 */

export interface ReconciliationLedgerPort {
  /** Brands the seam. The ledger's operations are not defined yet. */
  readonly ledger: 'reconciliation';
}

/**
 * Always `null`: no ledger can be bound yet. It reads no binding, because
 * none exists to read.
 */
export function resolveReconciliationLedger(): ReconciliationLedgerPort | null {
  return null;
}
