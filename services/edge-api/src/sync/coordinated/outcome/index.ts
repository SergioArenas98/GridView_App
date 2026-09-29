/**
 * The publication half of coordinated runtime orchestration (PR-C4): the
 * publishability decision, the no-change gate (O-12), the ordering input
 * (O-13), curated metadata (O-14), one guarded publication and the outcome
 * commit, plus the resolution of a publication a previous run left
 * unfinished.
 *
 * **Implemented, injected and not connected.** Only the injected
 * orchestration in `observation/` calls it. No Worker module imports either,
 * `resolveReconciliationLedger` still answers `null`, and every coordinated
 * run still stops at `ledger-unbound` with zero provider requests.
 */

export * from './decisions';
export * from './digest';
export * from './metadata';
export * from './ordering';
export * from './publish';
export * from './recovery';
