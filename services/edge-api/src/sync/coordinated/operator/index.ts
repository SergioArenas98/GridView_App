/**
 * The operator path's code that is not storage (PR-E1): the hold-gated
 * coordinated rollback (OD-3) and the backlog levels (OD-8).
 *
 * **Dormant.** Nothing imports it: the operator routes and the attention line
 * are later work (PR-E2), and `resolveReconciliationLedger` still answers
 * `null` in every environment.
 */

export * from './attention';
export * from './rollback';
