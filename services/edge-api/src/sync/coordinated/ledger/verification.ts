/**
 * The operator verification transitions (Provider Evaluation §10.4.1
 * T11-T11c, with T5 and T6; operator disposition decision pack A6; PR-E3).
 *
 * A verification is an explicit, per-record, human-initiated check of one
 * staged classification resource: one provider request, then this pure step,
 * applied by the store's `verify` operation in the same transaction as the
 * lease fence, the record version, the staged target, the backlog entry and
 * the operation-ID replay check. Never a timer, a cron, the sweep or a run.
 *
 * What it may write, and nothing else:
 *
 * - the candidate slot (`candidateRevision`, `candidateFirstSeenAt`): set,
 *   replaced or cleared (T11, T11c, T5);
 * - the competing slot, from empty to the corroborated candidate (T11b). This
 *   is the **only** writer of a competing correction, and so of the review
 *   lock: `commit` refuses to create one;
 * - `consecutiveConfirmations`, reset by T5 only;
 * - the attempt accounting every check records (`lastAttemptedAt`,
 *   `lastSuccessfulObservationAt`, `limiterDeferralUntil`);
 * - the markers, recomputed, and `lastVerification`.
 *
 * It never touches the staged slot, the accepted (`contentRevision`) or
 * published revision, the superseded history, the backlog, the season record
 * - so no hold, durable block or disposition - and it publishes nothing.
 * Disposition stays T12 alone: verification informs an operator and never
 * decides for them.
 *
 * Revisions are compared for equality only (D2.4). The order is the §10.4.1
 * evaluation order: a review-locked record first (T11d, refused), then a
 * superseded revision (T5), then the identical cases, then a candidate.
 */

import {
  classificationMarkers,
  type ClassificationMarker,
  type ClassificationRecord,
  type LedgerInstant,
  type RevisionHash,
  type VerificationRequest,
  type VerificationTransition,
} from './model';

/** Which revision of the record an observation matched. Closed. */
export const verificationMatches = [
  'superseded',
  'accepted',
  'staged',
  'candidate',
  'other',
] as const;
export type VerificationMatch = (typeof verificationMatches)[number];

export type VerificationStep =
  | {
      readonly kind: 'applied';
      readonly record: ClassificationRecord;
      /** `null` for a deferral, which is not a completed verification. */
      readonly transition: VerificationTransition | null;
    }
  | {
      readonly kind: 'refused';
      readonly reason: 'operator-precondition-failed' | 'review-locked';
    };

/**
 * Why a record cannot be verified against `stagedRevision`, or `null` when
 * it can: it holds exactly that staged revision and no competing one.
 */
export function verificationRefusal(
  record: ClassificationRecord | null,
  stagedRevision: RevisionHash,
): 'operator-precondition-failed' | 'review-locked' | null {
  if (record === null || record.stagedCorrection === null) {
    return 'operator-precondition-failed';
  }
  if (record.stagedCorrection.revision !== stagedRevision) {
    return 'operator-precondition-failed';
  }
  // T11d: two corroborated entries already wait; a verification could only
  // report, so it is refused before any request is spent on it.
  return record.competingCorrection === null ? null : 'review-locked';
}

/** The revision of `record` that `observed` is, in evaluation order. */
export function verificationMatch(
  record: ClassificationRecord,
  observed: RevisionHash,
): VerificationMatch {
  if (record.supersededRevisions.includes(observed)) return 'superseded';
  if (observed === record.contentRevision) return 'accepted';
  if (observed === record.stagedCorrection?.revision) return 'staged';
  if (observed === record.candidateRevision) return 'candidate';
  return 'other';
}

export function applyOperatorVerification(
  record: ClassificationRecord,
  request: VerificationRequest,
  at: LedgerInstant,
): VerificationStep {
  const refusal = verificationRefusal(record, request.expected.stagedRevision);
  if (refusal !== null) return { kind: 'refused', reason: refusal };

  const observation = request.observation;
  if (observation.status === 'deferred') {
    // Not attempted: the existing deferral rule, and nothing else.
    return {
      kind: 'applied',
      record: { ...record, limiterDeferralUntil: observation.retryAt },
      transition: null,
    };
  }

  const attempted: ClassificationRecord = {
    ...record,
    lastAttemptedAt: at,
    limiterDeferralUntil: null,
  };
  const step =
    observation.status === 'failed'
      ? { fields: {}, transition: 'check-failed' as const }
      : observed(record, observation.revision, at);
  const next: ClassificationRecord = {
    ...attempted,
    ...(observation.status === 'observed'
      ? { lastSuccessfulObservationAt: at }
      : {}),
    ...step.fields,
  };
  return {
    kind: 'applied',
    record: {
      ...next,
      markers: markersOf(next),
      lastVerification: {
        operationId: request.operationId,
        at,
        authMethod: request.authMethod,
        stagedRevision: request.expected.stagedRevision,
        transition: step.transition,
      },
    },
    transition: step.transition,
  };
}

interface ObservedStep {
  readonly fields: Partial<ClassificationRecord>;
  readonly transition: VerificationTransition;
}

const noCandidate = {
  candidateRevision: null,
  candidateFirstSeenAt: null,
} as const;

function observed(
  record: ClassificationRecord,
  revision: RevisionHash,
  at: LedgerInstant,
): ObservedStep {
  const pending = record.candidateRevision !== null;
  switch (verificationMatch(record, revision)) {
    case 'superseded':
      // T5: never tracked, and it breaks any candidate's consecutive run.
      return {
        fields: { ...noCandidate, consecutiveConfirmations: 0 },
        transition: 'superseded-rejected',
      };
    case 'accepted':
    case 'staged':
      // T11, or T11c when a candidate failed to reappear.
      return pending
        ? { fields: noCandidate, transition: 'candidate-discarded' }
        : {
            fields: {},
            transition:
              revision === record.contentRevision
                ? 'accepted-seen'
                : 'staged-seen',
          };
    case 'candidate':
      // T11b: the second sighting, on a later verification.
      return {
        fields: {
          ...noCandidate,
          competingCorrection: {
            revision,
            firstSeenAt: record.candidateFirstSeenAt!,
            uncorroborated: false,
          },
        },
        transition: 'candidate-corroborated',
      };
    case 'other':
      // T11, or T11c's replacement: one sighting never stages anything.
      return {
        fields: { candidateRevision: revision, candidateFirstSeenAt: at },
        transition: pending ? 'candidate-replaced' : 'candidate-observed',
      };
  }
}

/** The review-axis markers, in `classificationMarkers` order. */
function markersOf(record: ClassificationRecord): ClassificationMarker[] {
  const present: Record<ClassificationMarker, boolean> = {
    pending: record.candidateRevision !== null,
    review_locked: record.competingCorrection !== null,
    staged: record.stagedCorrection !== null,
  };
  return classificationMarkers.filter((marker) => present[marker]);
}
