/**
 * The reconciliation policy's operational events (ADR 0020 D2.7-D2.9).
 *
 * An event is a closed category and nothing else: no season, round, revision,
 * instant, provider value or payload. The set is fixed here, so a log line
 * built from events is bounded by construction. What the event concerns is
 * already in the ledger record the same decision wrote.
 *
 * Correspondence with the Provider Evaluation §10.4.1 event names:
 *
 * | Category | §10.4.1 event |
 * |---|---|
 * | `classification.first-write` | `reconciled.published` (T0) |
 * | `classification.overwrite` | `reconciled.overwrite` (T3, D2.7) |
 * | `classification.staged-correction` | `reconciled.staged_correction` (T9, D2.8) |
 * | `classification.staged-uncorroborated` | `reconciled.staged_correction` at the ceiling |
 * | `classification.backlog-capacity-exceeded` | `reconciled.backlog_capacity_exceeded` |
 * | `classification.settled` | `reconciled.settled` |
 * | `classification.settled-on-deadline` | `reconciled.settled_on_deadline` |
 * | `classification.rejected-superseded` | `reconciled.rejected_superseded` (T5) |
 * | `classification.unstable-source` | `reconciled.unstable_source` |
 *
 * The rest are this policy's own bookkeeping categories.
 */

export const policyEventCategories = [
  'classification.backlog-capacity-exceeded',
  'classification.backlog-held',
  'classification.check-deferred',
  'classification.check-failed',
  'classification.check-not-attempted',
  'classification.confirmed',
  'classification.first-write',
  'classification.never-reconciled',
  'classification.observation-not-applied',
  'classification.overwrite',
  'classification.pending-discarded',
  'classification.pending-observed',
  'classification.pending-replaced',
  'classification.rejected-superseded',
  'classification.revision-history-capacity',
  'classification.settled',
  'classification.settled-on-deadline',
  'classification.staged-correction',
  'classification.staged-uncorroborated',
  'classification.unstable-source',
  'refresh.deferred',
  'refresh.failed',
  'refresh.first-observation',
  'refresh.not-attempted',
  'refresh.overwrite',
  'refresh.unchanged',
] as const;

export type PolicyEventCategory = (typeof policyEventCategories)[number];

export interface PolicyEvent {
  readonly category: PolicyEventCategory;
}

export function policyEvent(category: PolicyEventCategory): PolicyEvent {
  return { category };
}

/**
 * Bounded log fields for a set of events: a count per category that occurred,
 * in the fixed category order. At most one key per category.
 */
export function countPolicyEvents(
  events: readonly PolicyEvent[],
): Readonly<Partial<Record<PolicyEventCategory, number>>> {
  const counts: Partial<Record<PolicyEventCategory, number>> = {};
  for (const category of policyEventCategories) {
    const count = events.filter((event) => event.category === category).length;
    if (count > 0) counts[category] = count;
  }
  return counts;
}
