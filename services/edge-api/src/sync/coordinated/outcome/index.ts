/**
 * The publication half of coordinated runtime orchestration (PR-C4): the
 * publishability decision, the no-change gate (O-12), the ordering input
 * (O-13), curated metadata (O-14), one guarded publication and the outcome
 * commit, plus the resolution of a publication a previous run left
 * unfinished.
 *
 * **Wired, and unbound.** Only the orchestration in `observation/` calls it,
 * and only the coordinated sync entry point calls that, behind a gate that
 * needs every dependency. `resolveReconciliationLedger` answers `null` in
 * every committed environment, so every coordinated run there stops at that
 * gate as `ledger-unbound`, with zero provider requests and no publication.
 */

export * from './decisions';
export * from './digest';
export * from './metadata';
export * from './ordering';
export * from './publish';
export * from './recovery';
