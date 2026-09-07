/**
 * Total runtime decoders for every response the Durable Object transport can
 * return
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D1, D9).
 *
 * The client reaches the object across a stub boundary, so a response is
 * untrusted bytes until it is decoded - a version-skewed object, a partial
 * body, a wrong nested type or an unknown reason code can all arrive with a
 * permitted `outcome` discriminant. Casting on the discriminant alone (the
 * defect this module replaces) let `{ "outcome": "committed" }` become a
 * successful `FinalizeOutcome` with no `result` and no `replayed`.
 *
 * Each decoder validates **the complete selected variant** - every required
 * field, every nested structure, every array member - against the repository's
 * own bounded validators and closed reason arrays, and returns `null` for
 * anything it cannot fully account for. The client maps that `null` to the
 * method's existing bounded fail-closed outcome, so a malformed response can
 * never read as `committed`, `prepared`, `authorized`, `activated` or
 * authoritative.
 */

import { maximumOperationEpoch } from './candidate-version';
import {
  cancelRejectionReasons,
  cleanupRefusalReasons,
  cutoverRejectionReasons,
  finalizeRejectionReasons,
  isOperationKind,
  prepareRejectionReasons,
  type CancelOutcome,
  type CleanupAuthorization,
  type CommittedResult,
  type CutoverActivationOutcome,
  type CutoverSeedOutcome,
  type FinalizeOutcome,
  type PerKeyState,
  type PrepareOutcome,
  type SeasonAuthority,
} from './model';
import {
  isDocumentName,
  isInstant,
  isOpaqueIdentifier,
  isSnapshotRevision,
  isVersionIdentifier,
  maximumManifestSize,
} from './store';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A safe positive operation epoch, inside the range `prepare` can allocate. */
function isOperationEpoch(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= maximumOperationEpoch
  );
}

function isNullableVersion(value: unknown): value is string | null {
  return value === null || isVersionIdentifier(value);
}

function inClosedSet<T extends string>(
  value: unknown,
  set: readonly T[],
): value is T {
  return (
    typeof value === 'string' && (set as readonly string[]).includes(value)
  );
}

function decodePerKeyStateArray(value: unknown): PerKeyState[] | null {
  if (!Array.isArray(value) || value.length > maximumManifestSize) return null;
  const states: PerKeyState[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    if (!isDocumentName(entry.documentName)) return null;
    if (!isSnapshotRevision(entry.revision)) return null;
    if (!isInstant(entry.observedAt)) return null;
    states.push({
      documentName: entry.documentName,
      revision: entry.revision,
      observedAt: entry.observedAt,
    });
  }
  return states;
}

function decodeCommittedResult(value: unknown): CommittedResult | null {
  if (!isRecord(value)) return null;
  if (!isVersionIdentifier(value.activeVersion)) return null;
  if (!isNullableVersion(value.previousVersion)) return null;
  if (!isOperationKind(value.operationKind)) return null;
  if (!isInstant(value.committedAt)) return null;
  return {
    activeVersion: value.activeVersion,
    previousVersion: value.previousVersion,
    operationKind: value.operationKind,
    committedAt: value.committedAt,
  };
}

/**
 * `uninitialized`, `seeded` and `unavailable` are **never authoritative**;
 * only `active` is, and only when it says so. A response whose `authoritative`
 * flag disagrees with its own `cutoverState` is rejected outright rather than
 * trusted in either direction.
 */
export function decodeSeasonAuthority(value: unknown): SeasonAuthority | null {
  if (!isRecord(value)) return null;
  switch (value.cutoverState) {
    case 'uninitialized':
      return value.authoritative === false
        ? { cutoverState: 'uninitialized', authoritative: false }
        : null;
    case 'unavailable':
      return value.authoritative === false
        ? { cutoverState: 'unavailable', authoritative: false }
        : null;
    case 'seeded':
    case 'active': {
      const authoritative = value.cutoverState === 'active';
      if (value.authoritative !== authoritative) return null;
      if (!isNullableVersion(value.activeVersion)) return null;
      if (!isNullableVersion(value.previousVersion)) return null;
      if (
        value.cutoverFingerprint !== null &&
        !isOpaqueIdentifier(value.cutoverFingerprint)
      ) {
        return null;
      }
      return {
        cutoverState: value.cutoverState,
        authoritative,
        activeVersion: value.activeVersion,
        previousVersion: value.previousVersion,
        cutoverFingerprint: value.cutoverFingerprint,
      };
    }
    default:
      return null;
  }
}

export function decodePrepareOutcome(value: unknown): PrepareOutcome | null {
  if (!isRecord(value)) return null;
  if (value.outcome === 'prepared') {
    if (!isOperationEpoch(value.operationEpoch)) return null;
    if (!isOpaqueIdentifier(value.operationToken)) return null;
    if (!isVersionIdentifier(value.candidateVersion)) return null;
    const assignedTimestamps = decodePerKeyStateArray(value.assignedTimestamps);
    if (assignedTimestamps === null) return null;
    if (!isInstant(value.deadline)) return null;
    return {
      outcome: 'prepared',
      operationEpoch: value.operationEpoch,
      operationToken: value.operationToken,
      candidateVersion: value.candidateVersion,
      assignedTimestamps,
      deadline: value.deadline,
    };
  }
  if (value.outcome === 'rejected') {
    if (!inClosedSet(value.reason, prepareRejectionReasons)) return null;
    if (value.reason === 'operation-in-progress') {
      // This reason - and only this reason - carries a live operation the
      // caller can wait on; it must be present and fully valid.
      const live = value.liveOperation;
      if (!isRecord(live)) return null;
      if (!isOperationEpoch(live.operationEpoch)) return null;
      if (!isVersionIdentifier(live.candidateVersion)) return null;
      return {
        outcome: 'rejected',
        reason: 'operation-in-progress',
        liveOperation: {
          operationEpoch: live.operationEpoch,
          candidateVersion: live.candidateVersion,
        },
      };
    }
    // `liveOperation` is not meaningful for any other rejection reason, so it
    // is dropped rather than carried through unvalidated.
    return { outcome: 'rejected', reason: value.reason };
  }
  return null;
}

export function decodeFinalizeOutcome(value: unknown): FinalizeOutcome | null {
  if (!isRecord(value)) return null;
  switch (value.outcome) {
    case 'committed': {
      const result = decodeCommittedResult(value.result);
      if (result === null) return null;
      if (typeof value.replayed !== 'boolean') return null;
      return { outcome: 'committed', result, replayed: value.replayed };
    }
    case 'superseded': {
      if (!isOperationEpoch(value.currentOperationEpoch)) return null;
      if (!isNullableVersion(value.activeVersion)) return null;
      if (!isNullableVersion(value.previousVersion)) return null;
      return {
        outcome: 'superseded',
        currentOperationEpoch: value.currentOperationEpoch,
        activeVersion: value.activeVersion,
        previousVersion: value.previousVersion,
      };
    }
    case 'rejected':
      return inClosedSet(value.reason, finalizeRejectionReasons)
        ? { outcome: 'rejected', reason: value.reason }
        : null;
    default:
      return null;
  }
}

export function decodeCancelOutcome(value: unknown): CancelOutcome | null {
  if (!isRecord(value)) return null;
  switch (value.outcome) {
    case 'cancelled':
    case 'already-cancelled':
      return isVersionIdentifier(value.candidateVersion)
        ? { outcome: value.outcome, candidateVersion: value.candidateVersion }
        : null;
    case 'superseded':
      return isOperationEpoch(value.currentOperationEpoch)
        ? {
            outcome: 'superseded',
            currentOperationEpoch: value.currentOperationEpoch,
          }
        : null;
    case 'rejected':
      return inClosedSet(value.reason, cancelRejectionReasons)
        ? { outcome: 'rejected', reason: value.reason }
        : null;
    default:
      return null;
  }
}

export function decodeCleanupAuthorization(
  value: unknown,
): CleanupAuthorization | null {
  if (!isRecord(value)) return null;
  if (value.outcome === 'authorized') {
    return isVersionIdentifier(value.candidateVersion)
      ? { outcome: 'authorized', candidateVersion: value.candidateVersion }
      : null;
  }
  if (value.outcome === 'refused') {
    return inClosedSet(value.reason, cleanupRefusalReasons)
      ? { outcome: 'refused', reason: value.reason }
      : null;
  }
  return null;
}

export function decodeCutoverSeedOutcome(
  value: unknown,
): CutoverSeedOutcome | null {
  if (!isRecord(value)) return null;
  if (
    value.outcome === 'seeded' ||
    value.outcome === 'already-seeded' ||
    value.outcome === 'already-active'
  ) {
    return { outcome: value.outcome };
  }
  if (value.outcome === 'rejected') {
    return inClosedSet(value.reason, cutoverRejectionReasons)
      ? { outcome: 'rejected', reason: value.reason }
      : null;
  }
  return null;
}

export function decodeCutoverActivationOutcome(
  value: unknown,
): CutoverActivationOutcome | null {
  if (!isRecord(value)) return null;
  if (value.outcome === 'activated' || value.outcome === 'already-active') {
    return { outcome: value.outcome };
  }
  if (value.outcome === 'rejected') {
    return inClosedSet(value.reason, cutoverRejectionReasons)
      ? { outcome: 'rejected', reason: value.reason }
      : null;
  }
  return null;
}
