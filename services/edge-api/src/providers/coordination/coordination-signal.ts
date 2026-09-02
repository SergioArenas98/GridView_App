/**
 * Bounded structured signals for a coordination run.
 *
 * Every field below is a closed enum member, an integer, a boolean or an
 * already-validated ISO instant. **No provider payload, response body, URL,
 * query, header, storage key, object id, transport reference, exception or
 * public snapshot body may ever reach a coordination log line.**
 *
 * A mapping failure is deliberately *not* re-reported here. The Phase 9B-3
 * mapping boundary raises its own bounded event with the diagnostic detail an
 * operator needs; duplicating it would emit the same provider value twice, in
 * two vocabularies, from two layers.
 */

import type { LogEvent } from '../../logging/logger';
import type {
  CoordinationRun,
  ResourceCoordination,
  SourceContribution,
} from './outcome';

export const COORDINATION_CONTRIBUTION_OPERATION =
  'provider.coordination.contribution';
export const COORDINATION_SELECTION_OPERATION =
  'provider.coordination.selection';
export const COORDINATION_RUN_OPERATION = 'provider.coordination.completed';

/** One source's contribution to one resource. */
export function contributionEvent(contribution: SourceContribution): LogEvent {
  const event: LogEvent = {
    operation: COORDINATION_CONTRIBUTION_OPERATION,
    season: contribution.resource.season,
    providerSourceId: contribution.source,
    providerSourceRole: contribution.role,
    coordinationResource: contribution.resource.kind,
    jobCategory: contribution.jobCategory,
    coordinationStatus: contribution.status,
    providerRequestAttempted: contribution.attempted,
  };
  if (contribution.reason !== null) {
    event.failureCategory = contribution.reason;
  }
  // Only ever a validated absolute instant, and only when one was actually
  // supplied. It is carried as data: nothing in this phase schedules on it.
  if (contribution.retryAt !== null) {
    event.providerRetryAt = contribution.retryAt;
  }
  if (contribution.retryAfter !== null) {
    event.providerRetryAfter = contribution.retryAfter;
  }
  return event;
}

/** The coordinated decision for one resource. */
export function selectionEvent(coordination: ResourceCoordination): LogEvent {
  const event: LogEvent = {
    operation: COORDINATION_SELECTION_OPERATION,
    season: coordination.resource.season,
    coordinationResource: coordination.resource.kind,
    jobCategory: coordination.jobCategory,
    coordinationOutcome: coordination.selection.outcome,
  };
  if (coordination.selection.outcome === 'selected') {
    event.providerSourceId = coordination.selection.source;
    event.providerSourceRole = coordination.selection.role;
  } else {
    event.failureCategory = coordination.selection.reason;
  }
  return event;
}

/** Aggregate counts for one run. Integers and closed enum members only. */
export function runEvent(run: CoordinationRun): LogEvent {
  const event: LogEvent = {
    operation: COORDINATION_RUN_OPERATION,
    season: run.season,
    coordinationStatus: run.status,
    coordinationPlanned: run.counts.planned,
    coordinationSelected: run.counts.selected,
    coordinationUnavailable: run.counts.unavailable,
    providerOperationCallCount: run.accounting.lifetime.total,
    coordinationNotAttempted: run.counts.notAttempted,
  };
  if (run.planProblem !== null) event.failureCategory = run.planProblem;
  return event;
}
