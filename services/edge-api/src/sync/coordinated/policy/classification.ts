/**
 * The §10.4.1 settling state machine for one race classification resource
 * (ADR 0020 §2 D2.1-D2.9, §3 I1-I5, §4; Provider Evaluation §10.4.1).
 *
 * `applyClassificationCheck` is pure: it takes the stored record, one check
 * and its outcome, and answers the next record and the closed events the step
 * raised. It reads no clock, storage, network or publication state.
 *
 * Three kinds of check reach a record:
 *
 * - **cadence**: a scheduled check for a due slot (§10.4.1 cadence). The only
 *   check that advances `checkIndex`, counts a confirmation on an unsettled
 *   record, corroborates a pending revision there (D2.1), or settles.
 * - **reread**: the O-3 full-backfill reread of a recorded round with no slot
 *   due. On a settled record it is the slow path (T8-T10, I4). On an unsettled
 *   record it is not a reconciliation check and changes no review state.
 * - **manual**: an operator's forced publication run (O-8). It may make a first
 *   write, and nothing else on the review axis: it advances no slot, counts no
 *   confirmation, corroborates nothing and stages nothing.
 *
 * Fixed rules, whatever the kind:
 *
 * - A staged or review-locked record takes no transition from any run:
 *   T11-T11c run only inside an explicit operator verification, through the
 *   ledger's own `verify` operation (`../ledger/verification.ts`), and T11d is
 *   refused before any request.
 * - A failed check (T6) changes no revision, confirmation count, candidate,
 *   slot or review state. A deferred or cancelled check was not attempted and
 *   changes nothing but the recorded limiter deferral.
 * - A superseded revision is never accepted again (D2.2, T5).
 * - Revisions are compared for equality only, never ordered (D2.4).
 * - Only reconciled observations exist; a provisional payload has no input
 *   form, so D2.3 (T7) cannot arise.
 */

import {
  LEDGER_SCHEMA_VERSION,
  MAXIMUM_CONSECUTIVE_CONFIRMATIONS,
  MAXIMUM_UNSTABLE_SIGHTINGS,
  SUPERSEDED_REVISION_CAPACITY,
  type CalendarAnchor,
  type ClassificationMarker,
  type ClassificationRecord,
  type LedgerInstant,
  type RevisionHash,
} from '../ledger/model';
import {
  FINAL_CHECK_SLOT,
  SETTLING_CONFIRMATIONS,
  SETTLING_FIRST_SLOT,
  nextCheckAt,
} from './cadence';
import {
  policyEvent,
  type PolicyEvent,
  type PolicyEventCategory,
} from './events';

/** What one planned request produced. Closed; never a payload. */
export type CheckOutcome =
  | { readonly status: 'observed'; readonly revision: RevisionHash }
  | { readonly status: 'failed' }
  | { readonly status: 'deferred'; readonly retryAt: LedgerInstant }
  | { readonly status: 'not-attempted' };

export type ClassificationCheck =
  | { readonly kind: 'cadence'; readonly slot: number }
  | { readonly kind: 'reread' }
  | { readonly kind: 'manual' };

export interface ClassificationStepInput {
  readonly check: ClassificationCheck;
  readonly outcome: CheckOutcome;
  readonly now: Date;
  /** Whether the global operator backlog can take one more entry. */
  readonly backlogAvailable: boolean;
}

export interface ClassificationStep {
  readonly record: ClassificationRecord;
  readonly events: readonly PolicyEvent[];
  /** The staged revision to enter in the operator backlog, if any. */
  readonly backlogInsertion: RevisionHash | null;
}

/** A record for a round no check has reached yet. */
export function newClassificationRecord(
  season: number,
  anchor: CalendarAnchor,
): ClassificationRecord {
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    kind: 'classification',
    season,
    round: anchor.round,
    sessionType: 'race',
    anchor: anchor.anchor,
    anchorKind: anchor.anchorKind,
    checkIndex: 0,
    lastAttemptedAt: null,
    lastSuccessfulObservationAt: null,
    nextDueAt: nextCheckAt(anchor.anchor, 0),
    limiterDeferralUntil: null,
    publishedRevision: null,
    contentRevision: null,
    candidateRevision: null,
    candidateFirstSeenAt: null,
    consecutiveConfirmations: 0,
    provenance: 'absent',
    reviewState: 'absent',
    markers: [],
    stagedCorrection: null,
    competingCorrection: null,
    supersededRevisions: [],
    sourceObservedAt: null,
    settledAt: null,
    terminalReason: null,
    lastSweptAt: null,
    lastPriorityAttemptAt: null,
    unstableSightings: 0,
    lastDisposition: null,
    verifications: [],
  };
}

/** Held for an operator: T11-T11d are unreachable from any run. */
export function isInOperatorBacklog(record: ClassificationRecord): boolean {
  return (
    record.stagedCorrection !== null || record.competingCorrection !== null
  );
}

/** Mutable working state for one step; the result is frozen into a record. */
interface Step {
  record: ClassificationRecord;
  readonly events: PolicyEvent[];
  insertion: RevisionHash | null;
  backlogAvailable: boolean;
}

function raise(step: Step, category: PolicyEventCategory): void {
  step.events.push(policyEvent(category));
}

function update(step: Step, fields: Partial<ClassificationRecord>): void {
  step.record = { ...step.record, ...fields };
}

export function applyClassificationCheck(
  current: ClassificationRecord,
  input: ClassificationStepInput,
): ClassificationStep {
  const at = input.now.toISOString();
  const step: Step = {
    record: current,
    events: [],
    insertion: null,
    backlogAvailable: input.backlogAvailable,
  };
  const { outcome, check } = input;

  if (outcome.status === 'not-attempted') {
    raise(step, 'classification.check-not-attempted');
    return finish(step);
  }
  if (outcome.status === 'deferred') {
    // Not attempted: no slot is consumed and no review state changes.
    update(step, { limiterDeferralUntil: outcome.retryAt });
    raise(step, 'classification.check-deferred');
    return finish(step);
  }

  update(step, { lastAttemptedAt: at, limiterDeferralUntil: null });
  const settledBefore = current.reviewState === 'settled';
  if (settledBefore && check.kind === 'reread') {
    // The slow path's scheduling keys advance on every attempt, success or
    // failure, so a failing resource cannot hold its place (§10.4.1).
    update(step, { lastSweptAt: at });
    if (current.candidateRevision !== null) {
      update(step, { lastPriorityAttemptAt: at });
    }
  }

  if (outcome.status === 'failed') {
    raise(step, 'classification.check-failed');
  } else {
    update(step, { lastSuccessfulObservationAt: at });
    observe(step, check, outcome.revision, at);
  }

  if (check.kind === 'cadence') {
    advanceCadence(step, check.slot, outcome.status === 'observed', at);
  }
  return finish(step);
}

function observe(
  step: Step,
  check: ClassificationCheck,
  observed: RevisionHash,
  at: LedgerInstant,
): void {
  const record = step.record;
  if (isInOperatorBacklog(record)) {
    raise(step, 'classification.backlog-held');
    return;
  }
  if (record.contentRevision === null) {
    // T0: a first valid write needs no corroboration. A manual first write is
    // not a check, so it counts no confirmation.
    update(step, {
      contentRevision: observed,
      provenance: 'reconciled',
      reviewState: 'unsettled',
      consecutiveConfirmations: check.kind === 'cadence' ? 1 : 0,
      sourceObservedAt: at,
    });
    raise(step, 'classification.first-write');
    if (record.terminalReason === 'never-reconciled-abandoned') {
      // A first result after the ceiling has no check left: it settles on
      // deadline at once and joins the slow path, as at day 14.
      update(step, { terminalReason: null });
      settle(step, 'settled-on-deadline', at);
      raise(step, 'classification.settled-on-deadline');
    }
    return;
  }
  if (check.kind === 'manual') {
    if (observed !== record.contentRevision) {
      raise(step, 'classification.observation-not-applied');
    }
    return;
  }
  if (record.reviewState === 'settled') {
    observeSettled(step, observed, at);
    return;
  }
  if (check.kind === 'reread') {
    // Between cadence slots an unsettled record is read only because the
    // candidate needs it; that read is not a reconciliation check.
    if (observed !== record.contentRevision) {
      raise(step, 'classification.observation-not-applied');
    }
    return;
  }
  observeUnsettled(step, observed, at);
}

/** Shared by both paths: T5 and the identical case (T1, or T10's first half). */
function observeCommon(step: Step, observed: RevisionHash): boolean {
  const record = step.record;
  if (record.supersededRevisions.includes(observed)) {
    // T5. A superseded revision is never re-applied, however often it
    // returns, and it breaks any pending revision's consecutive run.
    update(step, {
      consecutiveConfirmations: 0,
      candidateRevision: null,
      candidateFirstSeenAt: null,
    });
    raise(step, 'classification.rejected-superseded');
    return true;
  }
  if (observed === record.contentRevision) {
    // T1: idempotent. No content change and `sourceObservedAt` stays put
    // (D2.6); a pending revision that failed to reappear is discarded.
    if (record.candidateRevision !== null) {
      raise(step, 'classification.pending-discarded');
    }
    update(step, {
      consecutiveConfirmations: Math.min(
        record.consecutiveConfirmations + 1,
        MAXIMUM_CONSECUTIVE_CONFIRMATIONS,
      ),
      candidateRevision: null,
      candidateFirstSeenAt: null,
      unstableSightings: 0,
    });
    raise(step, 'classification.confirmed');
    return true;
  }
  return false;
}

function observeUnsettled(
  step: Step,
  observed: RevisionHash,
  at: LedgerInstant,
): void {
  if (observeCommon(step, observed)) return;
  const record = step.record;
  if (record.candidateRevision === null) {
    // T2: one sighting is never enough (D2.1).
    update(step, {
      candidateRevision: observed,
      candidateFirstSeenAt: at,
      consecutiveConfirmations: 0,
    });
    raise(step, 'classification.pending-observed');
    return;
  }
  if (observed === record.candidateRevision) {
    corroborateUnsettled(step);
    return;
  }
  replaceCandidate(step, observed, at);
}

/** T3: the second consecutive sighting replaces an unsettled revision. */
function corroborateUnsettled(step: Step): void {
  const record = step.record;
  const history = record.supersededRevisions;
  if (history.length >= SUPERSEDED_REVISION_CAPACITY) {
    // The history cannot grow, and forgetting a revision could let it be
    // applied again (D2.2). Fail closed: the candidate stays pending.
    raise(step, 'classification.revision-history-capacity');
    return;
  }
  update(step, {
    supersededRevisions: [...history, record.contentRevision!],
    contentRevision: record.candidateRevision,
    // The revision was first observed at T2, not now.
    sourceObservedAt: record.candidateFirstSeenAt,
    consecutiveConfirmations: 2,
    candidateRevision: null,
    candidateFirstSeenAt: null,
    unstableSightings: 0,
  });
  raise(step, 'classification.overwrite');
}

/** T4 / T10: a third revision replaces an uncorroborated one. */
function replaceCandidate(
  step: Step,
  observed: RevisionHash,
  at: LedgerInstant,
): void {
  const sightings = Math.min(
    step.record.unstableSightings + 1,
    MAXIMUM_UNSTABLE_SIGHTINGS,
  );
  if (
    sightings === MAXIMUM_UNSTABLE_SIGHTINGS &&
    step.record.unstableSightings < MAXIMUM_UNSTABLE_SIGHTINGS
  ) {
    raise(step, 'classification.unstable-source');
  }
  update(step, {
    candidateRevision: observed,
    candidateFirstSeenAt: at,
    consecutiveConfirmations: 0,
    unstableSightings: sightings,
  });
  raise(step, 'classification.pending-replaced');
}

/** The slow post-settlement path: T8, T9 and T10. */
function observeSettled(
  step: Step,
  observed: RevisionHash,
  at: LedgerInstant,
): void {
  if (observeCommon(step, observed)) return;
  const record = step.record;
  if (record.candidateRevision === null) {
    // T8: the first sighting of a late change. Nothing is applied.
    update(step, {
      candidateRevision: observed,
      candidateFirstSeenAt: at,
      consecutiveConfirmations: 0,
      lastPriorityAttemptAt: at,
    });
    raise(step, 'classification.pending-observed');
    return;
  }
  if (observed === record.candidateRevision) {
    // T9: corroborated, and settled, so staged for review - never applied.
    stage(step, false, 'classification.staged-correction');
    return;
  }
  replaceCandidate(step, observed, at);
}

/**
 * Moves the pending revision into the immutable staged slot and the operator
 * backlog. At capacity nothing is staged: the revision stays pending, so the
 * season stays withheld, and the capacity event is raised (fail closed).
 */
function stage(
  step: Step,
  uncorroborated: boolean,
  category: PolicyEventCategory,
): void {
  const record = step.record;
  if (!step.backlogAvailable) {
    raise(step, 'classification.backlog-capacity-exceeded');
    return;
  }
  update(step, {
    stagedCorrection: {
      revision: record.candidateRevision!,
      firstSeenAt: record.candidateFirstSeenAt!,
      uncorroborated,
    },
    candidateRevision: null,
    candidateFirstSeenAt: null,
  });
  step.insertion = record.candidateRevision;
  step.backlogAvailable = false;
  raise(step, category);
}

/**
 * Consumes the slot, then evaluates settling. The predicate needs an
 * observation; the ceiling is a time rule and fires at the final slot
 * whatever that check returned.
 */
function advanceCadence(
  step: Step,
  slot: number,
  observed: boolean,
  at: LedgerInstant,
): void {
  update(step, {
    checkIndex: slot,
    nextDueAt: nextCheckAt(step.record.anchor, slot),
  });
  const record = step.record;
  if (record.terminalReason !== null) return;
  if (
    observed &&
    record.reviewState === 'unsettled' &&
    slot >= SETTLING_FIRST_SLOT &&
    record.consecutiveConfirmations >= SETTLING_CONFIRMATIONS &&
    record.candidateRevision === null
  ) {
    settle(step, 'settled', at);
    raise(step, 'classification.settled');
    return;
  }
  if (slot === FINAL_CHECK_SLOT) settleOnDeadline(step, at);
}

function settle(
  step: Step,
  reason: 'settled' | 'settled-on-deadline',
  at: LedgerInstant,
): void {
  // The resource leaves the cadence and joins the slow path behind resources
  // that settled earlier.
  update(step, {
    reviewState: 'settled',
    settledAt: at,
    terminalReason: reason,
    nextDueAt: null,
    lastSweptAt: at,
  });
}

function settleOnDeadline(step: Step, at: LedgerInstant): void {
  if (step.record.contentRevision === null) {
    // Never reconciled by the ceiling: polling stops and it is flagged.
    update(step, {
      terminalReason: 'never-reconciled-abandoned',
      nextDueAt: null,
    });
    raise(step, 'classification.never-reconciled');
    return;
  }
  settle(step, 'settled-on-deadline', at);
  raise(step, 'classification.settled-on-deadline');
  if (step.record.candidateRevision !== null) {
    // Seen once, with no check left: retained for review, never applied.
    stage(step, true, 'classification.staged-uncorroborated');
  }
}

function markersOf(record: ClassificationRecord): ClassificationMarker[] {
  const markers: ClassificationMarker[] = [];
  if (record.candidateRevision !== null) markers.push('pending');
  if (record.competingCorrection !== null) markers.push('review_locked');
  if (record.stagedCorrection !== null) markers.push('staged');
  return markers;
}

function finish(step: Step): ClassificationStep {
  return {
    record: { ...step.record, markers: markersOf(step.record) },
    events: step.events,
    backlogInsertion: step.insertion,
  };
}
