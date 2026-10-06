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
 * - the markers, recomputed, and one appended `verifications` entry.
 *
 * Every completed verification of the current generation is kept, at most
 * `MAXIMUM_VERIFICATIONS` per resource and never evicted, so an operation ID
 * resent later within its generation - however many verifications came after
 * it, and on whichever round - is recognized and never counted as a second
 * sighting (`recordedVerification`). A request formed against another
 * generation is refused before anything else (`verification-generation-
 * mismatch`), so a resend from before a rotation is never executed either.
 *
 * Rotation (PR-E4, `rotationRefusal` and `rotatedRecord`) is the one way out
 * of a full history: under an operator hold, for a full history the operator
 * archived (named by `verificationHistoryDigest`), it clears the history,
 * raises the generation by one and records a bounded receipt. It writes
 * nothing else.
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
  MAXIMUM_VERIFICATIONS,
  classificationMarkers,
  type ClassificationMarker,
  type ClassificationRecord,
  type LedgerInstant,
  type LedgerRejectionReason,
  type OperationId,
  type RevisionHash,
  type VerificationRecord,
  type VerificationRequest,
  type VerificationRotationRequest,
  type VerificationTransition,
  type Versioned,
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
      readonly reason: VerificationRefusal;
    };

export type VerificationRefusal =
  | 'operator-precondition-failed'
  | 'review-locked'
  | 'verification-history-full';

/**
 * The verification an operation ID already recorded in a season, on
 * whichever round, or `null` when it names none.
 */
export function recordedVerification(
  records: readonly ClassificationRecord[],
  operationId: OperationId,
): {
  readonly round: number;
  readonly verification: VerificationRecord;
} | null {
  for (const record of records) {
    const verification = record.verifications.find(
      (entry) => entry.operationId === operationId,
    );
    if (verification !== undefined) {
      return { round: record.round, verification };
    }
  }
  return null;
}

/** A round's verification generation: 0 for a round with no record yet. */
export function verificationGenerationOf(
  record: ClassificationRecord | null,
): number {
  return record?.verificationGeneration ?? 0;
}

/**
 * The round whose last rotation used `operationId`, or `null`. Only the
 * latest rotation of each round is remembered: the receipt is one slot.
 */
export function rotationRound(
  records: readonly ClassificationRecord[],
  operationId: OperationId,
): number | null {
  return (
    records.find(
      (record) => record.lastVerificationReset?.operationId === operationId,
    )?.round ?? null
  );
}

/**
 * A verification history in its canonical form: every entry built field by
 * field in a fixed key order, oldest first. This is exactly what the
 * read-only history route answers as `entries`.
 */
export function canonicalVerificationHistory(
  verifications: readonly VerificationRecord[],
): VerificationRecord[] {
  return verifications.map((entry) => ({
    operationId: entry.operationId,
    at: entry.at,
    authMethod: entry.authMethod,
    stagedRevision: entry.stagedRevision,
    transition: entry.transition,
  }));
}

/**
 * `sha256:` and the lowercase hex SHA-256 of the UTF-8 compact JSON of the
 * canonical history: what an operator recomputes from an archived answer's
 * `entries` (`JSON.stringify(entries)`), and what a rotation must name.
 */
export async function verificationHistoryDigest(
  verifications: readonly VerificationRecord[],
): Promise<RevisionHash> {
  const bytes = new TextEncoder().encode(
    JSON.stringify(canonicalVerificationHistory(verifications)),
  );
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Why a stored record cannot be rotated as `request` asks, or `null` when it
 * can, in this order: the generation, the record version, the archived
 * digest, the operator hold, the review lock (T12 resolves it first), a full
 * history, and a generation that can still be raised.
 *
 * `historyDigest` is the digest of the stored history, or `null` when the
 * history changed after it was hashed.
 */
export function rotationRefusal(
  stored: Versioned<ClassificationRecord>,
  request: VerificationRotationRequest,
  historyDigest: RevisionHash | null,
  held: boolean,
): LedgerRejectionReason | null {
  const record = stored.record;
  const expected = request.expected;
  if (expected.verificationGeneration !== record.verificationGeneration) {
    return 'verification-generation-mismatch';
  }
  if (expected.recordVersion !== stored.version) return 'version-conflict';
  if (historyDigest === null || historyDigest !== expected.historyDigest) {
    return 'verification-history-digest-mismatch';
  }
  if (!held) return 'operator-hold-required';
  if (record.competingCorrection !== null) return 'review-locked';
  if (record.verifications.length < MAXIMUM_VERIFICATIONS) {
    return 'verification-history-not-full';
  }
  return record.verificationGeneration < Number.MAX_SAFE_INTEGER
    ? null
    : 'verification-generation-exhausted';
}

/**
 * The record a rotation leaves: an empty history, the next generation and
 * its receipt. Every other field - the staged, candidate and competing
 * slots, the attempt accounting, the accepted, published and superseded
 * revisions and the disposition - is kept exactly.
 */
export function rotatedRecord(
  record: ClassificationRecord,
  request: VerificationRotationRequest,
  at: LedgerInstant,
): ClassificationRecord {
  return {
    ...record,
    verifications: [],
    verificationGeneration: record.verificationGeneration + 1,
    lastVerificationReset: {
      operationId: request.operationId,
      at,
      authMethod: request.authMethod,
      fromGeneration: record.verificationGeneration,
      clearedCount: record.verifications.length,
      clearedDigest: request.expected.historyDigest,
    },
  };
}

/**
 * Why a record cannot be verified against `stagedRevision`, or `null` when
 * it can: it holds exactly that staged revision, no competing one, and room
 * for one more verification.
 */
export function verificationRefusal(
  record: ClassificationRecord | null,
  stagedRevision: RevisionHash,
): VerificationRefusal | null {
  if (record === null || record.stagedCorrection === null) {
    return 'operator-precondition-failed';
  }
  if (record.stagedCorrection.revision !== stagedRevision) {
    return 'operator-precondition-failed';
  }
  // T11d: two corroborated entries already wait; a verification could only
  // report, so it is refused before any request is spent on it.
  if (record.competingCorrection !== null) return 'review-locked';
  return record.verifications.length < MAXIMUM_VERIFICATIONS
    ? null
    : 'verification-history-full';
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
      verifications: [
        ...record.verifications,
        {
          operationId: request.operationId,
          at,
          authMethod: request.authMethod,
          stagedRevision: request.expected.stagedRevision,
          transition: step.transition,
        },
      ],
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
