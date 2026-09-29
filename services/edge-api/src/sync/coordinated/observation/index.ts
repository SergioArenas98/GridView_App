/**
 * Coordinated runtime orchestration: the observation half (PR-C3), which
 * hands a publication plan to the publication half in `../outcome/` (PR-C4)
 * under the same lease.
 *
 * **Implemented, injected and not connected.** No Worker module imports this
 * package, `resolveReconciliationLedger` still answers `null`, and every
 * coordinated run still stops at `ledger-unbound` with zero provider requests.
 */

export * from './observe';
export * from './outcomes';
export * from './published';
export * from './revisions';
