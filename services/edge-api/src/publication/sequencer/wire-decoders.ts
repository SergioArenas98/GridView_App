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
 *
 * Shape alone is not enough: a response can be individually well-typed yet
 * describe a state the protocol cannot produce - a `prepared` outcome whose
 * `candidateVersion` belongs to a different epoch than `operationEpoch`, an
 * empty assignment set, a `seeded`/`active` authority with no active version.
 * Every such **safety-critical cross-field invariant** is checked here too. The
 * one relationship a decoder cannot see - whether the returned assignments
 * correspond to the request that was actually sent - is bound on the client
 * side ({@link prepareAssignmentsMatchRequest}, {@link candidateVersionOwnedBy}),
 * because only the caller holds the originating request. Forward-compatible
 * extra fields are ignored, never rejected.
 */

import {
  epochOfCandidateVersion,
  maximumOperationEpoch,
} from './candidate-version';
import {
  cancelRejectionReasons,
  cleanupAckRejectionReasons,
  cleanupRefusalReasons,
  cutoverRejectionReasons,
  finalizeRejectionReasons,
  isOperationKind,
  prepareRejectionReasons,
  type CancelOutcome,
  type CleanupAcknowledgement,
  type CleanupAuthorization,
  type CommittedResult,
  type CutoverActivationOutcome,
  type CutoverSeed,
  type CutoverSeedOutcome,
  type CutoverSeedRecovery,
  type FinalizeOutcome,
  type PerKeyState,
  type PrepareOutcome,
  type PrepareRequest,
  type RetiredCleanupHandle,
  type SeasonAuthority,
} from './model';
import {
  isDocumentName,
  isInstant,
  isOpaqueIdentifier,
  isSeason,
  isSnapshotRevision,
  isVersionIdentifier,
  maximumManifestSize,
} from './store';
import { seedFloorCoversPerKeyState } from './rules';

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

/**
 * A successful prepare's assignment set: never empty, bounded, and with a
 * unique document name per entry. An empty or duplicate-bearing set is a
 * response the protocol cannot produce.
 */
function decodePerKeyStateArray(value: unknown): PerKeyState[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > maximumManifestSize
  ) {
    return null;
  }
  const states: PerKeyState[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    if (!isDocumentName(entry.documentName)) return null;
    if (seen.has(entry.documentName)) return null;
    seen.add(entry.documentName);
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

/**
 * Whether a candidate version is the one the reserved namespace binds to a
 * given epoch. Exported for the client's request-binding checks, where the
 * originating request supplies the epoch a returned version must belong to.
 */
export function candidateVersionOwnedBy(
  version: string,
  operationEpoch: number,
): boolean {
  return epochOfCandidateVersion(version) === operationEpoch;
}

/**
 * A retired operation's cleanup handle. The candidate version is required, and
 * its encoded epoch must be exactly `operationEpoch` - the two always agree for
 * a genuine handle (D3), so a disagreement is a skewed response.
 */
function decodeRetiredCleanupHandle(
  value: unknown,
): RetiredCleanupHandle | null {
  if (!isRecord(value)) return null;
  if (!isOperationEpoch(value.operationEpoch)) return null;
  if (!isVersionIdentifier(value.candidateVersion)) return null;
  if (!candidateVersionOwnedBy(value.candidateVersion, value.operationEpoch)) {
    return null;
  }
  return {
    operationEpoch: value.operationEpoch,
    candidateVersion: value.candidateVersion,
  };
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
      // A `seeded` or `active` season cannot legitimately exist without both an
      // active version and the fingerprint that produced it - only
      // `previousVersion` is genuinely nullable. A response missing either is
      // an impossible authority record and fails closed.
      if (!isVersionIdentifier(value.activeVersion)) return null;
      if (!isNullableVersion(value.previousVersion)) return null;
      if (!isOpaqueIdentifier(value.cutoverFingerprint)) return null;
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
    // The allocated version is bound to the allocating epoch by construction
    // (D3); a `prepared` response whose two disagree is version-skewed and
    // could steer a caller to write artifacts under an epoch that does not own
    // that version.
    if (
      !candidateVersionOwnedBy(value.candidateVersion, value.operationEpoch)
    ) {
      return null;
    }
    const assignedTimestamps = decodePerKeyStateArray(value.assignedTimestamps);
    if (assignedTimestamps === null) return null;
    if (!isInstant(value.deadline)) return null;
    const base = {
      outcome: 'prepared',
      operationEpoch: value.operationEpoch,
      operationToken: value.operationToken,
      candidateVersion: value.candidateVersion,
      assignedTimestamps,
      deadline: value.deadline,
    } as const;
    if (value.retiredCleanup === undefined) return base;
    // Present only when this prepare displaced a retired operation; it must be
    // fully valid if it is there at all.
    const retiredCleanup = decodeRetiredCleanupHandle(value.retiredCleanup);
    if (retiredCleanup === null) return null;
    return { ...base, retiredCleanup };
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
      if (
        !candidateVersionOwnedBy(live.candidateVersion, live.operationEpoch)
      ) {
        return null;
      }
      return {
        outcome: 'rejected',
        reason: 'operation-in-progress',
        liveOperation: {
          operationEpoch: live.operationEpoch,
          candidateVersion: live.candidateVersion,
        },
      };
    }
    if (value.reason === 'pending-cleanup-required') {
      const pendingCleanup = decodeRetiredCleanupHandle(value.pendingCleanup);
      if (pendingCleanup === null) return null;
      return {
        outcome: 'rejected',
        reason: 'pending-cleanup-required',
        pendingCleanup,
      };
    }
    // `liveOperation` / `pendingCleanup` are not meaningful for any other
    // rejection reason, so they are dropped rather than carried unvalidated.
    return { outcome: 'rejected', reason: value.reason };
  }
  return null;
}

/**
 * Whether a decoded `prepared` response's assignment set corresponds
 * one-to-one to the request that was sent: the same document names, each with
 * the revision the request asked for. A validly shaped assignment set for a
 * *different* manifest is rejected here rather than acted on. The observation
 * timestamps are the sequencer's to assign, so they are not compared.
 */
export function prepareAssignmentsMatchRequest(
  assignments: readonly PerKeyState[],
  request: PrepareRequest,
): boolean {
  if (assignments.length !== request.perKeyRevisions.length) return false;
  const requested = new Map(
    request.perKeyRevisions.map((entry) => [
      entry.documentName as string,
      entry.revision,
    ]),
  );
  if (requested.size !== request.perKeyRevisions.length) return false;
  for (const state of assignments) {
    if (requested.get(state.documentName) !== state.revision) return false;
  }
  return true;
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

export function decodeCleanupAcknowledgement(
  value: unknown,
): CleanupAcknowledgement | null {
  if (!isRecord(value)) return null;
  if (value.outcome === 'acknowledged') return { outcome: 'acknowledged' };
  if (value.outcome === 'rejected') {
    return inClosedSet(value.reason, cleanupAckRejectionReasons)
      ? { outcome: 'rejected', reason: value.reason }
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

/**
 * A complete recovered seed: every field `validateCutoverSeed` requires, plus
 * the cross-field invariant every committed seed holds - its floor is at or
 * above each per-key timestamp it carries.
 */
function decodeCutoverSeed(value: unknown): CutoverSeed | null {
  if (!isRecord(value)) return null;
  if (!isSeason(value.season)) return null;
  if (!isOpaqueIdentifier(value.cutoverFingerprint)) return null;
  if (!isVersionIdentifier(value.activeVersion)) return null;
  if (!isNullableVersion(value.previousVersion)) return null;
  if (!isInstant(value.committedSourceOrderingInput)) return null;
  if (!isInstant(value.seasonSnapshotObservedAtHighWaterMark)) return null;
  const perKeyState = decodePerKeyStateArray(value.perKeyState);
  if (perKeyState === null) return null;
  const seed: CutoverSeed = {
    season: value.season,
    cutoverFingerprint: value.cutoverFingerprint,
    activeVersion: value.activeVersion,
    previousVersion: value.previousVersion,
    committedSourceOrderingInput: value.committedSourceOrderingInput,
    perKeyState,
    seasonSnapshotObservedAtHighWaterMark:
      value.seasonSnapshotObservedAtHighWaterMark,
  };
  return seedFloorCoversPerKeyState(seed) ? seed : null;
}

/**
 * A recovered seed is only ever `seeded` or `active`; `uninitialized` is its
 * own outcome and carries no seed. Binding the seed to the request's season and
 * fingerprint is the client's check, because only the client holds the request.
 */
export function decodeCutoverSeedRecovery(
  value: unknown,
): CutoverSeedRecovery | null {
  if (!isRecord(value)) return null;
  switch (value.outcome) {
    case 'uninitialized':
      return { outcome: 'uninitialized' };
    case 'committed': {
      if (value.cutoverState !== 'seeded' && value.cutoverState !== 'active') {
        return null;
      }
      const seed = decodeCutoverSeed(value.seed);
      return seed === null
        ? null
        : { outcome: 'committed', cutoverState: value.cutoverState, seed };
    }
    case 'rejected':
      return inClosedSet(value.reason, cutoverRejectionReasons)
        ? { outcome: 'rejected', reason: value.reason }
        : null;
    default:
      return null;
  }
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
