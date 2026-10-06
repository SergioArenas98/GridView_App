/**
 * The bounded value shapes every ledger decoder is built from: canonical
 * instants, bounded integers, closed keys, closed states and operation IDs.
 *
 * They live apart from `records.ts` so that a decoder module can use them
 * without importing the records that, in turn, use it. `records.ts`
 * re-exports them for every existing caller.
 */

import { isSnapshotRevision } from '../../../publication/sequencer/store';
import { MAXIMUM_ROUND, type LedgerRejectionReason } from './model';

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

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Exactly these own keys: nothing missing, nothing extra. */
export function hasExactKeys(
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

export function isInstantOrNull(value: unknown): value is string | null {
  return value === null || isLedgerInstant(value);
}

export function isRevisionOrNull(value: unknown): value is string | null {
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

const operationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** A lowercase UUID v4: bounded, and never a name or a credential. */
export function isOperationId(value: unknown): value is string {
  return typeof value === 'string' && operationIdPattern.test(value);
}
