/**
 * The operator transitions the store performs itself (PR-E1; OD-2 to OD-5).
 *
 * Every other transition is computed by the pure policy and committed through
 * `commit`. These three are not, because each must be atomic with checks only
 * the store can make in one transaction: the operation-ID replay check, the
 * backlog entry that T12 releases, and whether any other round of the season
 * still waits for review. They are pure here - the instant and the stored
 * records are inputs - and the store refuses anything they refuse.
 *
 * `commit` can never make these changes (see `store.ts`):
 *
 * - **Season actions** set or clear the operator hold, clear a durable block,
 *   and record the last operator action.
 * - **T12** (`dispose`) is the only transition that clears a staged or
 *   competing correction, writes a disposition, or removes a backlog entry
 *   (ADR 0020 D2.5; Provider Evaluation §10.4.1).
 *
 * None of them publishes. A released hold, a cleared block or a disposition
 * only makes publication due; the next run publishes through every guard, and
 * only what upstream then serves.
 */

import {
  LEDGER_SCHEMA_VERSION,
  type ClassificationRecord,
  type DispositionRequest,
  type LedgerInstant,
  type OperatorActionRequest,
  type RefreshRecord,
  type SeasonRecord,
} from './model';

const emptyRefresh: RefreshRecord = {
  observedRevision: null,
  lastAttemptedAt: null,
  lastSuccessAt: null,
  nextDueAt: null,
};

/**
 * The record an operator action creates for a season no run has observed yet,
 * so a hold can be placed before the first coordinated run.
 */
export function emptySeasonRecord(season: number): SeasonRecord {
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    kind: 'season',
    season,
    refresh: {
      calendar: emptyRefresh,
      circuits: emptyRefresh,
      'constructor-standings': emptyRefresh,
      'driver-standings': emptyRefresh,
      participants: emptyRefresh,
    },
    publicationDueAt: null,
    calendarAnchors: null,
    lastOrderingInput: null,
    lastPublication: null,
    publicationDisposition: null,
    operatorHold: null,
    durableBlock: null,
    lastOperatorAction: null,
  };
}

/** Due at `at`, or earlier if it already was. */
function dueBy(current: LedgerInstant | null, at: LedgerInstant): string {
  return current !== null && Date.parse(current) <= Date.parse(at)
    ? current
    : at;
}

/**
 * The season record a season-level action leaves, or `null` when the season
 * is not in the state the action requires.
 *
 * - `hold` needs no hold. It moves no due time: while held, nothing publishes
 *   and the planner ignores the due time.
 * - `release-hold` needs a hold. It is consent to resume automatic
 *   publication, so publication becomes due now.
 * - `clear-block` needs a durable block, and makes publication due now.
 *
 * Neither clears what the other set: a hold and a durable block are
 * independent, and publication stays stopped while either remains.
 */
export function applyOperatorAction(
  record: SeasonRecord,
  request: OperatorActionRequest,
  at: LedgerInstant,
): SeasonRecord | null {
  const lastOperatorAction = {
    operationId: request.operationId,
    action: request.action,
    at,
    authMethod: request.authMethod,
  };
  switch (request.action) {
    case 'hold':
      if (record.operatorHold !== null) return null;
      return {
        ...record,
        operatorHold: { since: at, operationId: request.operationId },
        lastOperatorAction,
      };
    case 'release-hold':
      if (record.operatorHold === null) return null;
      return {
        ...record,
        operatorHold: null,
        publicationDueAt: dueBy(record.publicationDueAt, at),
        lastOperatorAction,
      };
    case 'clear-block':
      if (record.durableBlock === null) return null;
      return {
        ...record,
        durableBlock: null,
        publicationDueAt: dueBy(record.publicationDueAt, at),
        lastOperatorAction,
      };
  }
}

/**
 * The classification record a T12 disposition leaves, or `null` when the
 * stored record is not exactly the state the operator inspected.
 *
 * Every action clears the staged, competing and pending slots and adds
 * exactly one revision to the superseded history:
 *
 * - `accept-staged` / `accept-competing`: the displaced accepted revision.
 *   The chosen one becomes `contentRevision`, observed when it was first
 *   sighted (as T3 uses T2's time).
 * - `retain-published`: the exact staged revision, rejected permanently
 *   (OD-4). A competing revision is cleared, not superseded, so if upstream
 *   serves it again it follows the normal review rules.
 *
 * The history bound and the no-reapplication rule are the store's own
 * checks; this function never evicts anything.
 */
export function applyDisposition(
  record: ClassificationRecord,
  request: DispositionRequest,
  at: LedgerInstant,
): ClassificationRecord | null {
  const staged = record.stagedCorrection;
  const competing = record.competingCorrection;
  const expected = request.expected;
  if (
    staged === null ||
    record.contentRevision === null ||
    record.contentRevision !== expected.contentRevision ||
    staged.revision !== expected.stagedRevision ||
    (competing?.revision ?? null) !== expected.competingRevision
  ) {
    return null;
  }
  const chosen =
    request.action === 'accept-staged'
      ? staged
      : request.action === 'accept-competing'
        ? competing
        : null;
  if (request.action === 'accept-competing' && chosen === null) return null;
  return {
    ...record,
    contentRevision: chosen?.revision ?? record.contentRevision,
    sourceObservedAt: chosen?.firstSeenAt ?? record.sourceObservedAt,
    supersededRevisions: [
      ...record.supersededRevisions,
      chosen === null ? staged.revision : record.contentRevision,
    ],
    candidateRevision: null,
    candidateFirstSeenAt: null,
    stagedCorrection: null,
    competingCorrection: null,
    markers: [],
    unstableSightings: 0,
    lastDisposition: {
      operationId: request.operationId,
      action: request.action,
      at,
      authMethod: request.authMethod,
      stagedRevision: staged.revision,
    },
  };
}

/**
 * The season record after a disposition, or `null` when it is unchanged.
 *
 * Only a transient review block - `classification-staged` or
 * `classification-review-locked` - is lifted, and only once no round of the
 * season still waits for review: publication is then due now. A hold, a
 * durable block, any other block and an unresolved `publishing` slot are
 * left exactly as they were.
 */
export function seasonAfterDisposition(
  record: SeasonRecord | null,
  remaining: readonly ClassificationRecord[],
  at: LedgerInstant,
): SeasonRecord | null {
  const disposition = record?.publicationDisposition ?? null;
  if (
    record === null ||
    disposition?.state !== 'blocked' ||
    (disposition.reason !== 'classification-staged' &&
      disposition.reason !== 'classification-review-locked') ||
    remaining.some(
      (other) =>
        other.stagedCorrection !== null || other.competingCorrection !== null,
    )
  ) {
    return null;
  }
  return {
    ...record,
    publicationDisposition: null,
    publicationDueAt: dueBy(record.publicationDueAt, at),
  };
}
