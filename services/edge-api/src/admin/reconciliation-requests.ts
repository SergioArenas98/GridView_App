/**
 * Strict decoding of the reconciliation operator requests (PR-E2).
 *
 * Every request is decoded completely before the ledger is reached. A body
 * has closed keys: an unknown, missing or ill-typed field refuses the whole
 * request, because an operator action must never be taken on a field the
 * route silently ignored. Every accepted value is bounded - a season, a
 * version counter, a round, a closed action, a lowercase UUID v4 and
 * `sha256:` revision hashes - so a refusal names only the closed problem,
 * never the value.
 */

import { isSeason, isSnapshotRevision } from '../publication/sequencer/store';
import {
  dispositionActions,
  type SeasonOperatorAction,
} from '../sync/coordinated/ledger/model';
import {
  hasExactLedgerKeys as hasExactKeys,
  isBoundedInteger,
  isLedgerObject as isObject,
  isOneOf,
  isOperationId,
  isRound,
} from '../sync/coordinated/ledger/records';
import type {
  DispositionCommand,
  SeasonActionCommand,
  VerificationCommand,
  VerificationRotationCommand,
} from '../sync/coordinated/operator';

/** The largest body any operator route reads. Far above every valid one. */
export const MAXIMUM_OPERATOR_BODY_CHARACTERS = 2048;

/** Why a request was refused before anything was read. Closed. */
export type OperatorRequestProblem =
  | 'invalid-season'
  | 'invalid-round'
  | 'invalid-body'
  | 'body-too-large'
  /** A rotation whose `historyArchived` is `false` (PR-E4). */
  | 'history-archive-not-acknowledged';

export type Decoded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: OperatorRequestProblem };

const invalid = (problem: OperatorRequestProblem) =>
  ({ ok: false, problem }) as const;

/** `?season=YYYY` and nothing else. */
export function decodeInspectionQuery(url: URL): Decoded<number> {
  const keys = [...url.searchParams.keys()];
  const raw = url.searchParams.get('season');
  if (
    keys.length !== 1 ||
    raw === null ||
    !/^\d{4}$/.test(raw) ||
    !isSeason(Number(raw))
  ) {
    return invalid('invalid-season');
  }
  return { ok: true, value: Number(raw) };
}

/**
 * `?season=YYYY&round=N` and nothing else: the read-only verification history
 * of one round (PR-E4).
 */
export function decodeHistoryQuery(
  url: URL,
): Decoded<{ readonly season: number; readonly round: number }> {
  const keys = [...url.searchParams.keys()].sort();
  const season = url.searchParams.get('season');
  const round = url.searchParams.get('round');
  if (
    keys.length !== 2 ||
    keys[0] !== 'round' ||
    keys[1] !== 'season' ||
    season === null ||
    !/^\d{4}$/.test(season) ||
    !isSeason(Number(season))
  ) {
    return invalid('invalid-season');
  }
  if (
    round === null ||
    !/^[1-9]\d{0,2}$/.test(round) ||
    !isRound(Number(round))
  ) {
    return invalid('invalid-round');
  }
  return { ok: true, value: { season: Number(season), round: Number(round) } };
}

/** The request body as JSON, bounded, or the closed reason it is not. */
export async function readOperatorBody(
  request: Request,
): Promise<Decoded<unknown>> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return invalid('invalid-body');
  }
  if (text.length > MAXIMUM_OPERATOR_BODY_CHARACTERS) {
    return invalid('body-too-large');
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return invalid('invalid-body');
  }
}

const seasonActionKeys = [
  'season',
  'expectedSeasonRecordVersion',
  'operationId',
] as const;

/** `{season, expectedSeasonRecordVersion, operationId}` for one action. */
export function decodeSeasonAction(
  body: unknown,
  action: SeasonOperatorAction,
): Decoded<SeasonActionCommand> {
  if (
    !isObject(body) ||
    !hasExactKeys(body, seasonActionKeys) ||
    !isSeason(body.season) ||
    !isBoundedInteger(
      body.expectedSeasonRecordVersion,
      0,
      Number.MAX_SAFE_INTEGER - 1,
    ) ||
    !isOperationId(body.operationId)
  ) {
    return invalid('invalid-body');
  }
  return {
    ok: true,
    value: {
      season: body.season,
      action,
      operationId: body.operationId,
      expectedVersion: body.expectedSeasonRecordVersion,
    },
  };
}

const dispositionKeys = [
  'season',
  'round',
  'action',
  'operationId',
  'expected',
] as const;
const expectedKeys = [
  'recordVersion',
  'contentRevision',
  'stagedRevision',
  'competingRevision',
] as const;

/**
 * `{season, round, action, operationId, expected}`, where `expected` names
 * exactly the record the operator inspected: its version and its accepted,
 * staged and competing revisions (`null` when there is no competing one).
 */
export function decodeDisposition(body: unknown): Decoded<DispositionCommand> {
  if (!isObject(body) || !hasExactKeys(body, dispositionKeys)) {
    return invalid('invalid-body');
  }
  const expected = body.expected;
  if (
    !isSeason(body.season) ||
    !isRound(body.round) ||
    !isOneOf(dispositionActions, body.action) ||
    !isOperationId(body.operationId) ||
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
    return invalid('invalid-body');
  }
  return {
    ok: true,
    value: {
      season: body.season,
      round: body.round,
      action: body.action,
      operationId: body.operationId,
      expected: {
        recordVersion: expected.recordVersion,
        contentRevision: expected.contentRevision,
        stagedRevision: expected.stagedRevision,
        competingRevision: expected.competingRevision,
      },
    },
  };
}

const verificationKeys = [
  'season',
  'round',
  'operationId',
  'expectedStagedRevision',
  'expectedVerificationGeneration',
] as const;

/**
 * `{season, round, operationId, expectedStagedRevision,
 * expectedVerificationGeneration}` for one operator verification (PR-E3,
 * amended by PR-E4), where both expected values are the round's staged
 * revision and verification generation from one inspection.
 */
export function decodeVerification(
  body: unknown,
): Decoded<VerificationCommand> {
  if (
    !isObject(body) ||
    !hasExactKeys(body, verificationKeys) ||
    !isSeason(body.season) ||
    !isRound(body.round) ||
    !isOperationId(body.operationId) ||
    !isSnapshotRevision(body.expectedStagedRevision) ||
    !isBoundedInteger(
      body.expectedVerificationGeneration,
      0,
      Number.MAX_SAFE_INTEGER,
    )
  ) {
    return invalid('invalid-body');
  }
  return {
    ok: true,
    value: {
      season: body.season,
      round: body.round,
      operationId: body.operationId,
      expectedStagedRevision: body.expectedStagedRevision,
      expectedVerificationGeneration: body.expectedVerificationGeneration,
    },
  };
}

const rotationKeys = [
  'season',
  'round',
  'operationId',
  'expected',
  'historyArchived',
] as const;
const rotationExpectedKeys = [
  'recordVersion',
  'verificationGeneration',
  'historyDigest',
] as const;

/**
 * `{season, round, operationId, expected: {recordVersion,
 * verificationGeneration, historyDigest}, historyArchived}` for one rotation
 * of a full verification history (PR-E4). `expected` is copied from the
 * read-only history answer the operator archived, and `historyArchived` must
 * be `true`: the operator's explicit statement that it was archived
 * privately. `false` is refused as its own problem.
 */
export function decodeVerificationRotation(
  body: unknown,
): Decoded<VerificationRotationCommand> {
  if (!isObject(body) || !hasExactKeys(body, rotationKeys)) {
    return invalid('invalid-body');
  }
  const expected = body.expected;
  if (
    !isSeason(body.season) ||
    !isRound(body.round) ||
    !isOperationId(body.operationId) ||
    typeof body.historyArchived !== 'boolean' ||
    !isObject(expected) ||
    !hasExactKeys(expected, rotationExpectedKeys) ||
    !isBoundedInteger(expected.recordVersion, 1, Number.MAX_SAFE_INTEGER - 1) ||
    !isBoundedInteger(
      expected.verificationGeneration,
      0,
      Number.MAX_SAFE_INTEGER,
    ) ||
    !isSnapshotRevision(expected.historyDigest)
  ) {
    return invalid('invalid-body');
  }
  if (!body.historyArchived) return invalid('history-archive-not-acknowledged');
  return {
    ok: true,
    value: {
      season: body.season,
      round: body.round,
      operationId: body.operationId,
      expected: {
        recordVersion: expected.recordVersion,
        verificationGeneration: expected.verificationGeneration,
        historyDigest: expected.historyDigest,
      },
    },
  };
}
