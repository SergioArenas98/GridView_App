/**
 * Coordinated runtime orchestration: the observation half (PR-C3), which
 * hands a publication plan to the publication half in `../outcome/` (PR-C4)
 * under the same lease.
 *
 * **Wired, and unbound.** Only the coordinated sync entry point
 * (`../run.ts`) imports this package, behind a gate that needs every
 * dependency. `resolveReconciliationLedger` answers `null` in every committed
 * environment, so every coordinated run there stops at that gate as
 * `ledger-unbound`, with zero provider requests.
 */

export * from './observe';
export * from './outcomes';
export * from './published';
export * from './revisions';
