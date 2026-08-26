/**
 * The closed coordination result taxonomy: what one source contributed for one
 * resource, what was selected for that resource, and what a whole run did.
 *
 * Three rules shape every type here:
 *
 * - **Partial is a first-class result, not an error.** One resource failing
 *   must not hide the resources that succeeded, and a healthy subset must not
 *   conceal a failure. Both are represented, both are inspectable.
 * - **Attribution is exact.** A failure stays attached to the source and the
 *   resource it belongs to. Nothing is aggregated into an anonymous "some
 *   things failed".
 * - **Every reason is a bounded closed enum member.** These values reach
 *   structured logs, so no provider-controlled string can ever occupy one.
 */

import type { ProviderRequestMetrics } from '../provider-metrics';
import type { SyncJobCategory } from '../../storage/types';
import type { AttemptedFailureReason, NotAttemptedReason } from './port';
import { resourceKey } from './resource';
import type { CoordinatedPayload, CoordinatedResource } from './resource';
import type { CoordinatedSourceId, SourceRole } from './source-policy';

/**
 * Failures the **coordinator** attributes to itself rather than to a provider.
 *
 * None of them is a provider attempt outcome, and none of them may be
 * classified as one: a malformed adapter answer is a GridView-side defect, an
 * unresolved identity is the mapping boundary failing closed, and an invariant
 * violation is a coordination bug.
 */
export const coordinationFailureReasons = [
  /** The adapter's answer was not a well-formed outcome for this request. */
  'malformed-outcome',
  /**
   * The adapter threw instead of answering.
   *
   * Deliberately **not** counted as a provider attempt. A throw is evidence of
   * an adapter defect, not evidence that a request left GridView, and
   * inventing an attempt would write a provider failure timestamp for
   * something the provider may never have seen. This under-reports rather than
   * over-reports, which is safe here because pacing authority belongs to the
   * Durable Object reservation ledger - it already holds any slot a real
   * request consumed - and these counts are reporting, not admission control.
   */
  'adapter-error',
  /**
   * A provider identity did not resolve. The mapping boundary owns its own
   * bounded signal; this reason exists only to attribute the containment.
   */
  'mapping-unresolved',
  /** A coordination invariant was violated. Fail closed, never publish. */
  'coordination-invariant',
] as const;

export type CoordinationFailureReason =
  (typeof coordinationFailureReasons)[number];

/** Every reason a contribution can carry. Closed, bounded, log-safe. */
export type CoordinationOutcomeReason =
  NotAttemptedReason | AttemptedFailureReason | CoordinationFailureReason;

/**
 * The coarse status of one source's contribution.
 *
 * `deferred` is kept distinct from `skipped` because the two are operationally
 * different: a deferral is the global limiter pacing GridView and carries a
 * `retryAt`, while a skip is a policy or capability decision that no amount of
 * waiting changes. Neither is an attempt.
 */
export type ContributionStatus =
  'candidate' | 'skipped' | 'deferred' | 'failed';

/** What exactly one source did for exactly one resource. */
export interface SourceContribution {
  readonly source: CoordinatedSourceId;
  readonly role: SourceRole;
  readonly resource: CoordinatedResource;
  readonly jobCategory: SyncJobCategory;
  readonly status: ContributionStatus;
  /** Whether a request actually left GridView for this contribution. */
  readonly attempted: boolean;
  readonly reason: CoordinationOutcomeReason | null;
  /** Local pacing hint: when GridView's own limiter says capacity returns. */
  readonly retryAt: string | null;
  /** Upstream 429 instruction, already parsed to an absolute UTC instant. */
  readonly retryAfter: string | null;
  /** Present only for `candidate`. Never a partially validated payload. */
  readonly payload: CoordinatedPayload | null;
}

/**
 * The coordinated answer for one resource.
 *
 * `unavailable` is a complete, valid answer meaning **no usable candidate
 * exists**. It is what preserves last-known-good: nothing is published, the
 * previous release keeps serving, and the diagnostic contributions explain
 * why.
 */
export type ResourceSelection =
  | {
      readonly outcome: 'selected';
      readonly source: CoordinatedSourceId;
      readonly role: SourceRole;
      readonly payload: CoordinatedPayload;
    }
  | {
      readonly outcome: 'unavailable';
      readonly reason: 'no-usable-candidate';
    };

export interface ResourceCoordination {
  readonly resource: CoordinatedResource;
  readonly jobCategory: SyncJobCategory;
  readonly selection: ResourceSelection;
  /**
   * Every source considered for this resource, in the fixed declared source
   * order - never completion order. A diagnostic contribution is retained even
   * when another source won, so a provisional deferral is still visible behind
   * a reconciled success.
   */
  readonly contributions: readonly SourceContribution[];
}

/** Why a plan was rejected before anything was executed. */
export const planProblems = [
  /** The same logical resource appeared more than once. */
  'duplicate-resource',
  /** An entry was not a valid resource identity. */
  'invalid-resource',
  /** An entry named a season other than the run's season. */
  'season-mismatch',
] as const;

export type PlanProblem = (typeof planProblems)[number];

export interface CoordinationCounts {
  readonly planned: number;
  readonly selected: number;
  readonly unavailable: number;
  /** Contributions for which a request left GridView. */
  readonly attempted: number;
  /** Contributions for which nothing left GridView. */
  readonly notAttempted: number;
}

/**
 * The whole-run result.
 *
 * `status` is never `completed` for a cancelled or rejected run, so a caller
 * cannot read a partial run as a success. Publication reads this field first.
 */
export interface CoordinationRun {
  readonly season: number;
  readonly status: 'completed' | 'cancelled' | 'plan-rejected';
  readonly planProblem: PlanProblem | null;
  readonly resources: readonly ResourceCoordination[];
  /**
   * Operation-scoped provider accounting, in the existing Phase 9B-1 shape.
   *
   * `lifetime` here is the run's own total - the run owns its ledger, so the
   * two coincide and no cross-run subtraction is involved. `bySource` and
   * `byJobCategory` are attributed exactly, and one transport request serving
   * several resources is counted once.
   */
  readonly accounting: ProviderRequestMetrics;
  readonly counts: CoordinationCounts;
}

/** The coordinated answer for one resource, or `undefined` if unplanned. */
export function coordinationFor(
  run: CoordinationRun,
  resource: CoordinatedResource,
): ResourceCoordination | undefined {
  const wanted = resourceKey(resource);
  return run.resources.find(
    (candidate) => resourceKey(candidate.resource) === wanted,
  );
}
