/**
 * Strict runtime decoding for every value the reconciliation ledger stores,
 * accepts or answers.
 *
 * Every decoder is closed: an object must carry exactly the model's keys, every
 * string must match a bounded shape (a `sha256:` revision, a canonical UTC
 * instant, a version identifier or a closed state), and every number must be a
 * bounded safe integer. There is no free-form string anywhere in the model, so
 * no provider body, normalized payload, name, URL, header or credential can be
 * stored, whatever a caller sends.
 *
 * Decoders return fresh objects built field by field, never the input, so a
 * caller cannot retain a reference into what the ledger stores.
 */

import {
  isSeason,
  isSnapshotRevision,
  isVersionIdentifier,
} from '../../../publication/sequencer/store';
import {
  LEDGER_SCHEMA_VERSION,
  MAXIMUM_CHECK_INDEX,
  MAXIMUM_COMMIT_WRITES,
  MAXIMUM_CONSECUTIVE_CONFIRMATIONS,
  MAXIMUM_ROUND,
  MAXIMUM_UNSTABLE_SIGHTINGS,
  SUPERSEDED_REVISION_CAPACITY,
  anchorKinds,
  classificationMarkers,
  provenanceStates,
  refreshResources,
  reviewStates,
  terminalReasons,
  type AuthoritativeRevision,
  type BacklogEntry,
  type BacklogReference,
  type ClassificationMarker,
  type ClassificationRecord,
  type ConditionalWrite,
  type CorrectionSlot,
  type LeaseRecord,
  type LeaseToken,
  type LedgerCommitRequest,
  type LedgerRejectionReason,
  type PublishedReconciliation,
  type PublishedReconciliationRequest,
  type RefreshRecord,
  type RefreshResource,
  type SeasonRecord,
  type Versioned,
} from './model';

/** Storage keys. Every key is derived from a decoded record, never from input text. */
export const ledgerKeys = {
  season: (season: number) => `season:${season}`,
  lease: (season: number) => `lease:${season}`,
  published: (season: number) => `published:${season}`,
  classificationPrefix: (season: number) => `classification:${season}:`,
  classification: (season: number, round: number) =>
    `classification:${season}:${round}`,
  backlogPrefix: 'backlog:',
  // One entry per classification resource: the capacity counts resources.
  backlog: (season: number, round: number) => `backlog:${season}:${round}`,
} as const;

const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** A canonical UTC instant, exactly as `toISOString` spells it. */
export function isLedgerInstant(value: unknown): value is string {
  if (typeof value !== 'string' || !instantPattern.test(value)) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
}

export function isRound(value: unknown): value is number {
  return isBoundedInteger(value, 1, MAXIMUM_ROUND);
}

export function isFence(value: unknown): value is number {
  return isBoundedInteger(value, 1, Number.MAX_SAFE_INTEGER);
}

export function isBoundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Exactly these own keys: nothing missing, nothing extra. */
function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const own = Object.keys(value);
  return (
    own.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

export function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === 'string' && (values as readonly string[]).includes(value)
  );
}

function isInstantOrNull(value: unknown): value is string | null {
  return value === null || isLedgerInstant(value);
}

function isRevisionOrNull(value: unknown): value is string | null {
  return value === null || isSnapshotRevision(value);
}

/** A decoding result that says why a record was refused. */
export type Decoding<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: LedgerRejectionReason };

function refused<T>(reason: LedgerRejectionReason): Decoding<T> {
  return { ok: false, reason };
}

function accepted<T>(value: T): Decoding<T> {
  return { ok: true, value };
}

const correctionKeys = ['revision', 'firstSeenAt', 'uncorroborated'] as const;

function decodeCorrection(value: unknown): CorrectionSlot | null | 'invalid' {
  if (value === null) return null;
  if (!isObject(value) || !hasExactKeys(value, correctionKeys)) {
    return 'invalid';
  }
  if (
    !isSnapshotRevision(value.revision) ||
    !isLedgerInstant(value.firstSeenAt) ||
    typeof value.uncorroborated !== 'boolean'
  ) {
    return 'invalid';
  }
  return {
    revision: value.revision,
    firstSeenAt: value.firstSeenAt,
    uncorroborated: value.uncorroborated,
  };
}

/** Sorted in `classificationMarkers` order, each at most once. */
function decodeMarkers(value: unknown): ClassificationMarker[] | null {
  if (!Array.isArray(value) || value.length > classificationMarkers.length) {
    return null;
  }
  const markers: ClassificationMarker[] = [];
  let previous = -1;
  for (const marker of value) {
    if (!isOneOf(classificationMarkers, marker)) return null;
    const index = classificationMarkers.indexOf(marker);
    if (index <= previous) return null;
    previous = index;
    markers.push(marker);
  }
  return markers;
}

/**
 * Append-only, unique, bounded. An over-long history is reported as its own
 * reason, because it is the capacity refusal ADR 0020 D2.2 relies on.
 */
function decodeSupersededRevisions(value: unknown): Decoding<string[]> {
  if (!Array.isArray(value)) return refused('invalid-record');
  if (value.length > SUPERSEDED_REVISION_CAPACITY) {
    return refused('revision-history-capacity');
  }
  const revisions: string[] = [];
  for (const revision of value) {
    if (!isSnapshotRevision(revision) || revisions.includes(revision)) {
      return refused('invalid-record');
    }
    revisions.push(revision);
  }
  return accepted(revisions);
}

const classificationKeys = [
  'schemaVersion',
  'kind',
  'season',
  'round',
  'sessionType',
  'anchor',
  'anchorKind',
  'checkIndex',
  'lastAttemptedAt',
  'lastSuccessfulObservationAt',
  'nextDueAt',
  'limiterDeferralUntil',
  'publishedRevision',
  'candidateRevision',
  'candidateFirstSeenAt',
  'consecutiveConfirmations',
  'provenance',
  'reviewState',
  'markers',
  'stagedCorrection',
  'competingCorrection',
  'supersededRevisions',
  'sourceObservedAt',
  'settledAt',
  'terminalReason',
  'lastSweptAt',
  'lastPriorityAttemptAt',
  'unstableSightings',
] as const;

export function decodeClassificationRecord(
  value: unknown,
): Decoding<ClassificationRecord> {
  if (!isObject(value) || !hasExactKeys(value, classificationKeys)) {
    return refused('invalid-record');
  }
  const superseded = decodeSupersededRevisions(value.supersededRevisions);
  if (!superseded.ok) return refused(superseded.reason);
  const markers = decodeMarkers(value.markers);
  const staged = decodeCorrection(value.stagedCorrection);
  const competing = decodeCorrection(value.competingCorrection);
  if (
    value.schemaVersion !== LEDGER_SCHEMA_VERSION ||
    value.kind !== 'classification' ||
    !isSeason(value.season) ||
    !isRound(value.round) ||
    value.sessionType !== 'race' ||
    !isLedgerInstant(value.anchor) ||
    !isOneOf(anchorKinds, value.anchorKind) ||
    !isBoundedInteger(value.checkIndex, 0, MAXIMUM_CHECK_INDEX) ||
    !isInstantOrNull(value.lastAttemptedAt) ||
    !isInstantOrNull(value.lastSuccessfulObservationAt) ||
    !isInstantOrNull(value.nextDueAt) ||
    !isInstantOrNull(value.limiterDeferralUntil) ||
    !isRevisionOrNull(value.publishedRevision) ||
    !isRevisionOrNull(value.candidateRevision) ||
    !isInstantOrNull(value.candidateFirstSeenAt) ||
    // A transient candidate is its revision and when it was first seen,
    // together or not at all.
    (value.candidateRevision === null) !==
      (value.candidateFirstSeenAt === null) ||
    !isBoundedInteger(
      value.consecutiveConfirmations,
      0,
      MAXIMUM_CONSECUTIVE_CONFIRMATIONS,
    ) ||
    !isOneOf(provenanceStates, value.provenance) ||
    !isOneOf(reviewStates, value.reviewState) ||
    markers === null ||
    staged === 'invalid' ||
    competing === 'invalid' ||
    !isInstantOrNull(value.sourceObservedAt) ||
    !isInstantOrNull(value.settledAt) ||
    !(
      value.terminalReason === null ||
      isOneOf(terminalReasons, value.terminalReason)
    ) ||
    !isInstantOrNull(value.lastSweptAt) ||
    !isInstantOrNull(value.lastPriorityAttemptAt) ||
    !isBoundedInteger(value.unstableSightings, 0, MAXIMUM_UNSTABLE_SIGHTINGS)
  ) {
    return refused('invalid-record');
  }
  return accepted({
    schemaVersion: LEDGER_SCHEMA_VERSION,
    kind: 'classification',
    season: value.season,
    round: value.round,
    sessionType: 'race',
    anchor: value.anchor,
    anchorKind: value.anchorKind,
    checkIndex: value.checkIndex,
    lastAttemptedAt: value.lastAttemptedAt,
    lastSuccessfulObservationAt: value.lastSuccessfulObservationAt,
    nextDueAt: value.nextDueAt,
    limiterDeferralUntil: value.limiterDeferralUntil,
    publishedRevision: value.publishedRevision,
    candidateRevision: value.candidateRevision,
    candidateFirstSeenAt: value.candidateFirstSeenAt,
    consecutiveConfirmations: value.consecutiveConfirmations,
    provenance: value.provenance,
    reviewState: value.reviewState,
    markers,
    stagedCorrection: staged,
    competingCorrection: competing,
    supersededRevisions: superseded.value,
    sourceObservedAt: value.sourceObservedAt,
    settledAt: value.settledAt,
    terminalReason: value.terminalReason,
    lastSweptAt: value.lastSweptAt,
    lastPriorityAttemptAt: value.lastPriorityAttemptAt,
    unstableSightings: value.unstableSightings,
  });
}

const refreshKeys = [
  'observedRevision',
  'lastAttemptedAt',
  'lastSuccessAt',
  'nextDueAt',
] as const;

function decodeRefresh(value: unknown): RefreshRecord | null {
  if (!isObject(value) || !hasExactKeys(value, refreshKeys)) return null;
  if (
    !isRevisionOrNull(value.observedRevision) ||
    !isInstantOrNull(value.lastAttemptedAt) ||
    !isInstantOrNull(value.lastSuccessAt) ||
    !isInstantOrNull(value.nextDueAt)
  ) {
    return null;
  }
  return {
    observedRevision: value.observedRevision,
    lastAttemptedAt: value.lastAttemptedAt,
    lastSuccessAt: value.lastSuccessAt,
    nextDueAt: value.nextDueAt,
  };
}

const seasonKeys = [
  'schemaVersion',
  'kind',
  'season',
  'refresh',
  'publicationDueAt',
] as const;

export function decodeSeasonRecord(value: unknown): Decoding<SeasonRecord> {
  if (!isObject(value) || !hasExactKeys(value, seasonKeys)) {
    return refused('invalid-record');
  }
  if (
    value.schemaVersion !== LEDGER_SCHEMA_VERSION ||
    value.kind !== 'season' ||
    !isSeason(value.season) ||
    !isInstantOrNull(value.publicationDueAt) ||
    !isObject(value.refresh) ||
    !hasExactKeys(value.refresh, refreshResources)
  ) {
    return refused('invalid-record');
  }
  const refresh = {} as Record<RefreshResource, RefreshRecord>;
  for (const resource of refreshResources) {
    const decoded = decodeRefresh(value.refresh[resource]);
    if (decoded === null) return refused('invalid-record');
    refresh[resource] = decoded;
  }
  return accepted({
    schemaVersion: LEDGER_SCHEMA_VERSION,
    kind: 'season',
    season: value.season,
    refresh,
    publicationDueAt: value.publicationDueAt,
  });
}

const backlogKeys = [
  'schemaVersion',
  'kind',
  'season',
  'round',
  'revision',
  'enteredAt',
] as const;

export function decodeBacklogEntry(value: unknown): BacklogEntry | null {
  if (!isObject(value) || !hasExactKeys(value, backlogKeys)) return null;
  if (
    value.schemaVersion !== LEDGER_SCHEMA_VERSION ||
    value.kind !== 'backlog-entry' ||
    !isSeason(value.season) ||
    !isRound(value.round) ||
    !isSnapshotRevision(value.revision) ||
    !isLedgerInstant(value.enteredAt)
  ) {
    return null;
  }
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    kind: 'backlog-entry',
    season: value.season,
    round: value.round,
    revision: value.revision,
    enteredAt: value.enteredAt,
  };
}

const publishedKeys = [
  'schemaVersion',
  'kind',
  'season',
  'activeVersion',
  'reconciledAt',
] as const;

export function decodePublishedReconciliation(
  value: unknown,
): PublishedReconciliation | null {
  if (!isObject(value) || !hasExactKeys(value, publishedKeys)) return null;
  if (
    value.schemaVersion !== LEDGER_SCHEMA_VERSION ||
    value.kind !== 'published-reconciliation' ||
    !isSeason(value.season) ||
    !isVersionIdentifier(value.activeVersion) ||
    !isLedgerInstant(value.reconciledAt)
  ) {
    return null;
  }
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    kind: 'published-reconciliation',
    season: value.season,
    activeVersion: value.activeVersion,
    reconciledAt: value.reconciledAt,
  };
}

const leaseKeys = [
  'schemaVersion',
  'kind',
  'season',
  'fence',
  'state',
  'acquiredAt',
  'expiresAt',
] as const;

export function decodeLeaseRecord(value: unknown): LeaseRecord | null {
  if (!isObject(value) || !hasExactKeys(value, leaseKeys)) return null;
  if (
    value.schemaVersion !== LEDGER_SCHEMA_VERSION ||
    value.kind !== 'lease' ||
    !isSeason(value.season) ||
    !isFence(value.fence) ||
    !(value.state === 'held' || value.state === 'released') ||
    !isLedgerInstant(value.acquiredAt) ||
    !isLedgerInstant(value.expiresAt) ||
    Date.parse(value.expiresAt) <= Date.parse(value.acquiredAt)
  ) {
    return null;
  }
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    kind: 'lease',
    season: value.season,
    fence: value.fence,
    state: value.state,
    acquiredAt: value.acquiredAt,
    expiresAt: value.expiresAt,
  };
}

const versionedKeys = ['version', 'record'] as const;

/** A stored record with its positive storage version. */
export function decodeVersioned<T>(
  value: unknown,
  decodeRecord: (record: unknown) => Decoding<T>,
): Versioned<T> | null {
  if (!isObject(value) || !hasExactKeys(value, versionedKeys)) return null;
  if (!isBoundedInteger(value.version, 1, Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  const record = decodeRecord(value.record);
  return record.ok ? { version: value.version, record: record.value } : null;
}

// --- Requests -------------------------------------------------------------

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

export { isObject as isLedgerObject, hasExactKeys as hasExactLedgerKeys };
