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
} from '../sync/coordinated/operator';

/** The largest body any operator route reads. Far above every valid one. */
export const MAXIMUM_OPERATOR_BODY_CHARACTERS = 2048;

/** Why a request was refused before anything was read. Closed. */
export type OperatorRequestProblem =
  'invalid-season' | 'invalid-body' | 'body-too-large';

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
] as const;

/**
 * `{season, round, operationId, expectedStagedRevision}` for one operator
 * verification (PR-E3), where `expectedStagedRevision` is the staged revision
 * the operator read from the inspection.
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
    !isSnapshotRevision(body.expectedStagedRevision)
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
    },
  };
}
