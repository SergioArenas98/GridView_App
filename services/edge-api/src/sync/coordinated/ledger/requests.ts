/**
 * Strict runtime decoding for every request the reconciliation ledger
 * accepts, with the same rules as the records it stores (`records.ts`):
 * closed keys, bounded shapes, and fresh objects built field by field.
 */

import {
  isSeason,
  isSnapshotRevision,
  isVersionIdentifier,
} from '../../../publication/sequencer/store';
import {
  MAXIMUM_COMMIT_WRITES,
  MAXIMUM_ROUND,
  dispositionActions,
  operatorAuthMethods,
  seasonOperatorActions,
  type AuthoritativeRevision,
  type BacklogReference,
  type ClassificationRecord,
  type ConditionalWrite,
  type DispositionRequest,
  type LeaseToken,
  type LedgerCommitRequest,
  type OperatorActionRequest,
  type PublishedReconciliationRequest,
  type SeasonRecord,
} from './model';
import {
  accepted,
  decodeClassificationRecord,
  decodeSeasonRecord,
  hasExactLedgerKeys as hasExactKeys,
  isBoundedInteger,
  isFence,
  isLedgerObject as isObject,
  isOneOf,
  isOperationId,
  isRound,
  refused,
  type Decoding,
} from './records';

const tokenKeys = ['season', 'fence'] as const;

export function decodeLeaseToken(value: unknown): LeaseToken | null {
  if (!isObject(value) || !hasExactKeys(value, tokenKeys)) return null;
  if (!isSeason(value.season) || !isFence(value.fence)) return null;
  return { season: value.season, fence: value.fence };
}

export function decodeSeasonRequest(value: unknown): number | null {
  if (!isObject(value) || !hasExactKeys(value, ['season'])) return null;
  return isSeason(value.season) ? value.season : null;
}

const writeKeys = ['expectedVersion', 'record'] as const;

function decodeWrite<T>(
  value: unknown,
  decodeRecord: (record: unknown) => Decoding<T>,
): Decoding<ConditionalWrite<T>> {
  if (!isObject(value) || !hasExactKeys(value, writeKeys)) {
    return refused('invalid-request');
  }
  if (
    !isBoundedInteger(value.expectedVersion, 0, Number.MAX_SAFE_INTEGER - 1)
  ) {
    return refused('invalid-request');
  }
  const record = decodeRecord(value.record);
  if (!record.ok) return refused(record.reason);
  return accepted({
    expectedVersion: value.expectedVersion,
    record: record.value,
  });
}

const referenceKeys = ['round', 'revision'] as const;

function decodeReferences(value: unknown): BacklogReference[] | null {
  if (!Array.isArray(value) || value.length > MAXIMUM_COMMIT_WRITES) {
    return null;
  }
  const references: BacklogReference[] = [];
  for (const entry of value) {
    if (!isObject(entry) || !hasExactKeys(entry, referenceKeys)) return null;
    if (!isRound(entry.round) || !isSnapshotRevision(entry.revision)) {
      return null;
    }
    references.push({ round: entry.round, revision: entry.revision });
  }
  return references;
}

function hasDuplicates(values: readonly (string | number)[]): boolean {
  return new Set(values).size !== values.length;
}

const commitKeys = [
  'lease',
  'seasonRecord',
  'classifications',
  'backlogInsertions',
  'backlogRemovals',
] as const;

/**
 * A commit request: bounded, closed, one season, and no key written twice.
 * The whole request is refused on the first failure; nothing of it applies.
 */
export function decodeCommitRequest(
  value: unknown,
): Decoding<LedgerCommitRequest> {
  if (!isObject(value) || !hasExactKeys(value, commitKeys)) {
    return refused('invalid-request');
  }
  const lease = decodeLeaseToken(value.lease);
  if (lease === null) return refused('invalid-request');

  let seasonRecord: ConditionalWrite<SeasonRecord> | null = null;
  if (value.seasonRecord !== null) {
    const decoded = decodeWrite(value.seasonRecord, decodeSeasonRecord);
    if (!decoded.ok) return refused(decoded.reason);
    if (decoded.value.record.season !== lease.season) {
      return refused('invalid-request');
    }
    seasonRecord = decoded.value;
  }

  if (
    !Array.isArray(value.classifications) ||
    value.classifications.length > MAXIMUM_COMMIT_WRITES
  ) {
    return refused('invalid-request');
  }
  const classifications: ConditionalWrite<ClassificationRecord>[] = [];
  for (const entry of value.classifications) {
    const decoded = decodeWrite(entry, decodeClassificationRecord);
    if (!decoded.ok) return refused(decoded.reason);
    if (decoded.value.record.season !== lease.season) {
      return refused('invalid-request');
    }
    classifications.push(decoded.value);
  }

  const backlogInsertions = decodeReferences(value.backlogInsertions);
  const backlogRemovals = decodeReferences(value.backlogRemovals);
  if (backlogInsertions === null || backlogRemovals === null) {
    return refused('invalid-request');
  }

  if (
    hasDuplicates(classifications.map((write) => write.record.round)) ||
    // One backlog change per resource per request: a resource is entered,
    // or disposed of, never both at once and never twice.
    hasDuplicates([
      ...backlogInsertions.map((reference) => reference.round),
      ...backlogRemovals.map((reference) => reference.round),
    ])
  ) {
    return refused('duplicate-record');
  }

  return accepted({
    lease,
    seasonRecord,
    classifications,
    backlogInsertions,
    backlogRemovals,
  });
}

const reconciliationKeys = ['lease', 'activeVersion', 'revisions'] as const;

export function decodeReconciliationRequest(
  value: unknown,
): Decoding<PublishedReconciliationRequest> {
  if (!isObject(value) || !hasExactKeys(value, reconciliationKeys)) {
    return refused('invalid-request');
  }
  const lease = decodeLeaseToken(value.lease);
  if (
    lease === null ||
    !isVersionIdentifier(value.activeVersion) ||
    !Array.isArray(value.revisions) ||
    value.revisions.length > MAXIMUM_ROUND
  ) {
    return refused('invalid-request');
  }
  const revisions: AuthoritativeRevision[] = [];
  for (const entry of value.revisions) {
    if (!isObject(entry) || !hasExactKeys(entry, referenceKeys)) {
      return refused('invalid-request');
    }
    if (!isRound(entry.round) || !isSnapshotRevision(entry.revision)) {
      return refused('invalid-request');
    }
    revisions.push({ round: entry.round, revision: entry.revision });
  }
  if (hasDuplicates(revisions.map((entry) => entry.round))) {
    return refused('duplicate-record');
  }
  return accepted({
    lease,
    activeVersion: value.activeVersion,
    revisions,
  });
}

const operatorActionKeys = [
  'lease',
  'action',
  'operationId',
  'authMethod',
  'expectedVersion',
] as const;

/** A season-level operator action (hold, release, clear a durable block). */
export function decodeOperatorActionRequest(
  value: unknown,
): Decoding<OperatorActionRequest> {
  if (!isObject(value) || !hasExactKeys(value, operatorActionKeys)) {
    return refused('invalid-request');
  }
  const lease = decodeLeaseToken(value.lease);
  if (
    lease === null ||
    !isOneOf(seasonOperatorActions, value.action) ||
    !isOperationId(value.operationId) ||
    !isOneOf(operatorAuthMethods, value.authMethod) ||
    !isBoundedInteger(value.expectedVersion, 0, Number.MAX_SAFE_INTEGER - 1)
  ) {
    return refused('invalid-request');
  }
  return accepted({
    lease,
    action: value.action,
    operationId: value.operationId,
    authMethod: value.authMethod,
    expectedVersion: value.expectedVersion,
  });
}

const dispositionKeys = [
  'lease',
  'round',
  'action',
  'operationId',
  'authMethod',
  'expected',
] as const;
const expectedKeys = [
  'recordVersion',
  'contentRevision',
  'stagedRevision',
  'competingRevision',
] as const;

/** A T12 disposition of one staged classification resource. */
export function decodeDispositionRequest(
  value: unknown,
): Decoding<DispositionRequest> {
  if (!isObject(value) || !hasExactKeys(value, dispositionKeys)) {
    return refused('invalid-request');
  }
  const lease = decodeLeaseToken(value.lease);
  const expected = value.expected;
  if (
    lease === null ||
    !isRound(value.round) ||
    !isOneOf(dispositionActions, value.action) ||
    !isOperationId(value.operationId) ||
    !isOneOf(operatorAuthMethods, value.authMethod) ||
    !isObject(expected) ||
    !hasExactKeys(expected, expectedKeys) ||
    !isBoundedInteger(expected.recordVersion, 1, Number.MAX_SAFE_INTEGER - 1) ||
    !isSnapshotRevision(expected.contentRevision) ||
    !isSnapshotRevision(expected.stagedRevision) ||
    !(
      expected.competingRevision === null ||
      isSnapshotRevision(expected.competingRevision)
    )
  ) {
    return refused('invalid-request');
  }
  return accepted({
    lease,
    round: value.round,
    action: value.action,
    operationId: value.operationId,
    authMethod: value.authMethod,
    expected: {
      recordVersion: expected.recordVersion,
      contentRevision: expected.contentRevision,
      stagedRevision: expected.stagedRevision,
      competingRevision: expected.competingRevision,
    },
  });
}
