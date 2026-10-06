/**
 * The bounded operator view of one season's reconciliation ledger (PR-E2).
 *
 * Built field by field from a ledger snapshot, never by spreading a record,
 * so a field added to the ledger later never reaches a response unreviewed.
 * It carries only what the ledger itself holds: closed states, counters,
 * canonical UTC instants, release version identifiers, operation IDs and
 * `sha256:` revision hashes. The ledger holds no payload, row, provider
 * identifier or name (ADR 0020 C1), so none can appear here either.
 *
 * The revision hashes are there so an operator can copy the exact `expected`
 * values a disposition must name. The lease fence and the ordering input are
 * left out: no operator action takes either.
 */

import type {
  ClassificationRecord,
  CorrectionSlot,
  VerificationRecord,
  VerificationResetRecord,
  LedgerSnapshot,
  PublicationDisposition,
  RevisionHash,
  SeasonRecord,
  Versioned,
} from '../sync/coordinated/ledger/model';
import { canonicalVerificationHistory } from '../sync/coordinated/ledger/verification';
import { backlogAttention } from '../sync/coordinated/operator';

export function seasonView(snapshot: LedgerSnapshot) {
  const stored = snapshot.seasonRecord;
  const record: SeasonRecord | null = stored?.record ?? null;
  return {
    season: snapshot.season,
    /** What `expectedSeasonRecordVersion` must name; 0 when none exists. */
    seasonRecordVersion: stored?.version ?? 0,
    operatorHold:
      record?.operatorHold == null
        ? null
        : {
            since: record.operatorHold.since,
            operationId: record.operatorHold.operationId,
          },
    durableBlock:
      record?.durableBlock == null
        ? null
        : {
            reason: record.durableBlock.reason,
            since: record.durableBlock.since,
          },
    publicationDisposition: dispositionView(
      record?.publicationDisposition ?? null,
    ),
    publicationDueAt: record?.publicationDueAt ?? null,
    lastPublication:
      record?.lastPublication == null
        ? null
        : {
            activeVersion: record.lastPublication.activeVersion,
            publishedAt: record.lastPublication.publishedAt,
            confirmedAt: record.lastPublication.confirmedAt,
          },
    lastOperatorAction:
      record?.lastOperatorAction == null
        ? null
        : {
            operationId: record.lastOperatorAction.operationId,
            action: record.lastOperatorAction.action,
            at: record.lastOperatorAction.at,
            authMethod: record.lastOperatorAction.authMethod,
          },
  };
}

function dispositionView(disposition: PublicationDisposition | null) {
  if (disposition === null) return null;
  if (disposition.state === 'blocked') {
    return {
      state: disposition.state,
      reason: disposition.reason,
      since: disposition.since,
    };
  }
  return {
    state: disposition.state,
    since: disposition.since,
    /** Whether the unfinished run reserved its ordering input. */
    reserved: disposition.orderingInput !== null,
  };
}

export function backlogView(snapshot: LedgerSnapshot) {
  return {
    /** Global, across every season. */
    count: snapshot.backlog.count,
    capacity: snapshot.backlog.capacity,
    level: backlogAttention(snapshot.backlog.count),
    /** This season's entries. */
    entries: snapshot.backlog.entries.map((entry) => ({
      round: entry.round,
      revision: entry.revision,
      enteredAt: entry.enteredAt,
    })),
  };
}

export function roundView({
  version,
  record,
}: Versioned<ClassificationRecord>) {
  return {
    round: record.round,
    /** What a disposition's `expected.recordVersion` must name. */
    recordVersion: version,
    reviewState: record.reviewState,
    markers: [...record.markers],
    terminalReason: record.terminalReason,
    contentRevision: record.contentRevision,
    publishedRevision: record.publishedRevision,
    candidateRevision: record.candidateRevision,
    stagedCorrection: slotView(record.stagedCorrection),
    competingCorrection: slotView(record.competingCorrection),
    supersededCount: record.supersededRevisions.length,
    lastDisposition:
      record.lastDisposition === null
        ? null
        : {
            operationId: record.lastDisposition.operationId,
            action: record.lastDisposition.action,
            at: record.lastDisposition.at,
            authMethod: record.lastDisposition.authMethod,
            stagedRevision: record.lastDisposition.stagedRevision,
          },
    /**
     * What a verification's `expectedVerificationGeneration` and a rotation's
     * `expected.verificationGeneration` must name (PR-E4).
     */
    verificationGeneration: record.verificationGeneration,
    /** How many verifications this generation recorded, of at most 32. */
    verificationCount: record.verifications.length,
    /** The last completed verification: closed values, no diff. */
    lastVerification: verificationView(record.verifications.at(-1) ?? null),
    /** The last rotation's receipt, or `null` at generation 0. */
    lastVerificationReset: resetView(record.lastVerificationReset),
  };
}

function resetView(reset: VerificationResetRecord | null) {
  return reset === null
    ? null
    : {
        operationId: reset.operationId,
        at: reset.at,
        authMethod: reset.authMethod,
        fromGeneration: reset.fromGeneration,
        toGeneration: reset.fromGeneration + 1,
        clearedCount: reset.clearedCount,
        clearedDigest: reset.clearedDigest,
      };
}

/**
 * One round's whole verification history (PR-E4): what an operator archives
 * privately before a rotation, and the values the rotation must name.
 * `entries` is the canonical history, so `historyDigest` is recomputable
 * from an archived answer as `sha256:` and the hex SHA-256 of
 * `JSON.stringify(entries)`.
 */
export function verificationHistoryView(
  { version, record }: Versioned<ClassificationRecord>,
  historyDigest: RevisionHash,
) {
  return {
    season: record.season,
    round: record.round,
    recordVersion: version,
    verificationGeneration: record.verificationGeneration,
    count: record.verifications.length,
    historyDigest,
    entries: canonicalVerificationHistory(record.verifications),
    lastVerificationReset: resetView(record.lastVerificationReset),
  };
}

/** A rotation's receipt, as the rotation route answers it. */
export function rotationReceipt(record: ClassificationRecord) {
  return resetView(record.lastVerificationReset);
}

function verificationView(verification: VerificationRecord | null) {
  return verification === null
    ? null
    : {
        operationId: verification.operationId,
        at: verification.at,
        authMethod: verification.authMethod,
        stagedRevision: verification.stagedRevision,
        transition: verification.transition,
      };
}

function slotView(slot: CorrectionSlot | null) {
  return slot === null
    ? null
    : {
        revision: slot.revision,
        firstSeenAt: slot.firstSeenAt,
        uncorroborated: slot.uncorroborated,
      };
}

/** The whole inspection: the season, its backlog and every recorded round. */
export function inspectionView(snapshot: LedgerSnapshot) {
  return {
    ...seasonView(snapshot),
    lease:
      snapshot.lease === null
        ? null
        : { state: snapshot.lease.state, expiresAt: snapshot.lease.expiresAt },
    publishedReconciliation:
      snapshot.published === null
        ? null
        : {
            activeVersion: snapshot.published.activeVersion,
            reconciledAt: snapshot.published.reconciledAt,
          },
    backlog: backlogView(snapshot),
    rounds: snapshot.classifications.map(roundView),
  };
}
