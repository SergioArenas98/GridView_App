/**
 * Strict runtime decoding for every value the reconciliation ledger stores.
 * The requests it accepts are decoded in `requests.ts`, with these rules.
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
  MAXIMUM_CONSECUTIVE_CONFIRMATIONS,
  MAXIMUM_ROUND,
  MAXIMUM_UNSTABLE_SIGHTINGS,
  SUPERSEDED_REVISION_CAPACITY,
  anchorKinds,
  classificationMarkers,
  dispositionActions,
  durableBlockReasons,
  operatorAuthMethods,
  provenanceStates,
  publicationBlockReasons,
  refreshResources,
  reviewStates,
  seasonOperatorActions,
  terminalReasons,
  verificationTransitions,
  type LastPublication,
  type PublicationDisposition,
  type BacklogEntry,
  type CalendarAnchor,
  type ClassificationMarker,
  type ClassificationRecord,
  type CorrectionSlot,
  type DispositionRecord,
  type DurableBlock,
  type LeaseRecord,
  type LedgerRejectionReason,
  type OperatorActionRecord,
  type OperatorHold,
  type PublishedReconciliation,
  type RefreshRecord,
  type RefreshResource,
  type SeasonRecord,
  type VerificationRecord,
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

export function refused<T>(reason: LedgerRejectionReason): Decoding<T> {
  return { ok: false, reason };
}

export function accepted<T>(value: T): Decoding<T> {
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

const operationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** A lowercase UUID v4: bounded, and never a name or a credential. */
export function isOperationId(value: unknown): value is string {
  return typeof value === 'string' && operationIdPattern.test(value);
}

const dispositionKeys = [
  'operationId',
  'action',
  'at',
  'authMethod',
  'stagedRevision',
] as const;

function decodeDispositionRecord(
  value: unknown,
): DispositionRecord | null | 'invalid' {
  if (value === null) return null;
  if (!isObject(value) || !hasExactKeys(value, dispositionKeys)) {
    return 'invalid';
  }
  if (
    !isOperationId(value.operationId) ||
    !isOneOf(dispositionActions, value.action) ||
    !isLedgerInstant(value.at) ||
    !isOneOf(operatorAuthMethods, value.authMethod) ||
    !isSnapshotRevision(value.stagedRevision)
  ) {
    return 'invalid';
  }
  return {
    operationId: value.operationId,
    action: value.action,
    at: value.at,
    authMethod: value.authMethod,
    stagedRevision: value.stagedRevision,
  };
}

const verificationKeys = [
  'operationId',
  'at',
  'authMethod',
  'stagedRevision',
  'transition',
] as const;

function decodeVerificationRecord(
  value: unknown,
): VerificationRecord | null | 'invalid' {
  if (value === null) return null;
  if (!isObject(value) || !hasExactKeys(value, verificationKeys)) {
    return 'invalid';
  }
  if (
    !isOperationId(value.operationId) ||
    !isLedgerInstant(value.at) ||
    !isOneOf(operatorAuthMethods, value.authMethod) ||
    !isSnapshotRevision(value.stagedRevision) ||
    !isOneOf(verificationTransitions, value.transition)
  ) {
    return 'invalid';
  }
  return {
    operationId: value.operationId,
    at: value.at,
    authMethod: value.authMethod,
    stagedRevision: value.stagedRevision,
    transition: value.transition,
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
  'contentRevision',
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
  'lastDisposition',
  'lastVerification',
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
  const lastDisposition = decodeDispositionRecord(value.lastDisposition);
  const lastVerification = decodeVerificationRecord(value.lastVerification);
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
    !isRevisionOrNull(value.contentRevision) ||
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
    lastDisposition === 'invalid' ||
    lastVerification === 'invalid' ||
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
    contentRevision: value.contentRevision,
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
    lastDisposition,
    lastVerification,
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
  'calendarAnchors',
  'lastOrderingInput',
  'lastPublication',
  'publicationDisposition',
  'operatorHold',
  'durableBlock',
  'lastOperatorAction',
] as const;

const lastPublicationKeys = [
  'digest',
  'activeVersion',
  'publishedAt',
  'confirmedAt',
] as const;

function decodeLastPublication(
  value: unknown,
): LastPublication | null | 'invalid' {
  if (value === null) return null;
  if (!isObject(value) || !hasExactKeys(value, lastPublicationKeys)) {
    return 'invalid';
  }
  if (
    !isSnapshotRevision(value.digest) ||
    !isVersionIdentifier(value.activeVersion) ||
    !isLedgerInstant(value.publishedAt) ||
    !isLedgerInstant(value.confirmedAt) ||
    Date.parse(value.confirmedAt) < Date.parse(value.publishedAt)
  ) {
    return 'invalid';
  }
  return {
    digest: value.digest,
    activeVersion: value.activeVersion,
    publishedAt: value.publishedAt,
    confirmedAt: value.confirmedAt,
  };
}

const publishingKeys = ['state', 'since', 'digest', 'orderingInput'] as const;
const blockedKeys = ['state', 'since', 'reason'] as const;

function decodeDisposition(
  value: unknown,
): PublicationDisposition | null | 'invalid' {
  if (value === null) return null;
  if (!isObject(value) || !isLedgerInstant(value.since)) return 'invalid';
  if (value.state === 'publishing' && hasExactKeys(value, publishingKeys)) {
    // A reservation is a digest and its ordering input, together or not at all.
    if (
      !isRevisionOrNull(value.digest) ||
      !isInstantOrNull(value.orderingInput) ||
      (value.digest === null) !== (value.orderingInput === null)
    ) {
      return 'invalid';
    }
    return {
      state: 'publishing',
      since: value.since,
      digest: value.digest,
      orderingInput: value.orderingInput,
    };
  }
  if (
    value.state === 'blocked' &&
    hasExactKeys(value, blockedKeys) &&
    isOneOf(publicationBlockReasons, value.reason)
  ) {
    return { state: 'blocked', since: value.since, reason: value.reason };
  }
  return 'invalid';
}

const holdKeys = ['since', 'operationId'] as const;

function decodeHold(value: unknown): OperatorHold | null | 'invalid' {
  if (value === null) return null;
  if (
    !isObject(value) ||
    !hasExactKeys(value, holdKeys) ||
    !isLedgerInstant(value.since) ||
    !isOperationId(value.operationId)
  ) {
    return 'invalid';
  }
  return { since: value.since, operationId: value.operationId };
}

const durableBlockKeys = ['since', 'reason'] as const;

function decodeDurableBlock(value: unknown): DurableBlock | null | 'invalid' {
  if (value === null) return null;
  if (
    !isObject(value) ||
    !hasExactKeys(value, durableBlockKeys) ||
    !isLedgerInstant(value.since) ||
    !isOneOf(durableBlockReasons, value.reason)
  ) {
    return 'invalid';
  }
  return { since: value.since, reason: value.reason };
}

const operatorActionKeys = [
  'operationId',
  'action',
  'at',
  'authMethod',
] as const;

function decodeOperatorAction(
  value: unknown,
): OperatorActionRecord | null | 'invalid' {
  if (value === null) return null;
  if (
    !isObject(value) ||
    !hasExactKeys(value, operatorActionKeys) ||
    !isOperationId(value.operationId) ||
    !isOneOf(seasonOperatorActions, value.action) ||
    !isLedgerInstant(value.at) ||
    !isOneOf(operatorAuthMethods, value.authMethod)
  ) {
    return 'invalid';
  }
  return {
    operationId: value.operationId,
    action: value.action,
    at: value.at,
    authMethod: value.authMethod,
  };
}

const anchorKeys = ['round', 'anchor', 'anchorKind'] as const;

/** Bounded, one entry per round, strictly ascending by round. */
function decodeCalendarAnchors(
  value: unknown,
): CalendarAnchor[] | null | 'invalid' {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > MAXIMUM_ROUND) return 'invalid';
  const anchors: CalendarAnchor[] = [];
  let previousRound = 0;
  for (const entry of value) {
    if (!isObject(entry) || !hasExactKeys(entry, anchorKeys)) return 'invalid';
    if (
      !isRound(entry.round) ||
      entry.round <= previousRound ||
      !isLedgerInstant(entry.anchor) ||
      !isOneOf(anchorKinds, entry.anchorKind)
    ) {
      return 'invalid';
    }
    previousRound = entry.round;
    anchors.push({
      round: entry.round,
      anchor: entry.anchor,
      anchorKind: entry.anchorKind,
    });
  }
  return anchors;
}

export function decodeSeasonRecord(value: unknown): Decoding<SeasonRecord> {
  if (!isObject(value) || !hasExactKeys(value, seasonKeys)) {
    return refused('invalid-record');
  }
  if (
    value.schemaVersion !== LEDGER_SCHEMA_VERSION ||
    value.kind !== 'season' ||
    !isSeason(value.season) ||
    !isInstantOrNull(value.publicationDueAt) ||
    !isInstantOrNull(value.lastOrderingInput) ||
    !isObject(value.refresh) ||
    !hasExactKeys(value.refresh, refreshResources)
  ) {
    return refused('invalid-record');
  }
  const calendarAnchors = decodeCalendarAnchors(value.calendarAnchors);
  const lastPublication = decodeLastPublication(value.lastPublication);
  const publicationDisposition = decodeDisposition(
    value.publicationDisposition,
  );
  const operatorHold = decodeHold(value.operatorHold);
  const durableBlock = decodeDurableBlock(value.durableBlock);
  const lastOperatorAction = decodeOperatorAction(value.lastOperatorAction);
  if (
    calendarAnchors === 'invalid' ||
    lastPublication === 'invalid' ||
    publicationDisposition === 'invalid' ||
    operatorHold === 'invalid' ||
    durableBlock === 'invalid' ||
    lastOperatorAction === 'invalid'
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
    calendarAnchors,
    lastOrderingInput: value.lastOrderingInput,
    lastPublication,
    publicationDisposition,
    operatorHold,
    durableBlock,
    lastOperatorAction,
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

export { isObject as isLedgerObject, hasExactKeys as hasExactLedgerKeys };
