/**
 * The pure rules the coordinator applies inside its transactions: bounded input
 * validation, the two-case per-key timestamp assignment, the high-water-mark
 * advance, deadline evaluation and cutover-seed equality
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D4, D5, D12).
 *
 * None of them reads or writes storage. Keeping them here means each is
 * separately readable and separately testable, and it keeps the coordinator
 * itself to the transitions it owns.
 */

import type {
  AuthorityRecord,
  CutoverRejectionReason,
  CutoverSeed,
  OperationIdentity,
  OperationRecord,
  PerKeyRevision,
  PerKeyState,
  PrepareRejectionReason,
  PrepareRequest,
} from './model';
import { isOperationKind } from './model';
import { isManifestCommitment } from './manifest-commitment';
import {
  isDocumentName,
  isInstant,
  isOpaqueIdentifier,
  isSeason,
  isSnapshotRevision,
  isVersionIdentifier,
  maximumManifestSize,
} from './store';
import {
  boundedInstant,
  canonicalInstant,
  compareInstants,
  instantPlusMillisecond,
} from '../canonical/instant';

/**
 * The result of per-key timestamp assignment.
 *
 * `rejected` is returned - never thrown - when the clock reading cannot be
 * spelled inside the accepted four-digit RFC 3339 domain (`state-corrupt`, an
 * unusable clock) or when advancing the assignment floor by one millisecond
 * would leave that domain (`timestamp-space-exhausted`, a valid clock against
 * an exhausted timestamp space). The coordinator maps either straight to a
 * bounded `prepare` rejection with no durable write.
 */
export type TimestampAssignment =
  | { readonly kind: 'assigned'; readonly states: PerKeyState[] }
  | {
      readonly kind: 'rejected';
      readonly reason: 'state-corrupt' | 'timestamp-space-exhausted';
    };

/**
 * The two-case per-key assignment rule.
 *
 * - **Currently active and unchanged** - the key keeps its committed
 *   timestamp. No timestamp changes merely because some *other* key in the same
 *   candidate changed.
 * - **Changed, new, or restored** - a fresh activation, assigned
 *   `max(now, highWaterMark + 1 ms)`. A key with no currently active revision
 *   is unconditionally in this case: its own pre-withdrawal value was retired
 *   with its per-key state by design, and comparing against it would be
 *   comparing against something the design does not retain.
 *
 * Every fresh activation in one call receives the **same** value. Nothing in
 * the public contract requires distinct values across keys published together,
 * and the pre-existing rule already produced this outcome whenever several keys
 * changed at the same instant.
 */
export function assignObservationTimestamps(
  candidate: readonly PerKeyRevision[],
  committed: readonly PerKeyState[],
  highWaterMark: string | null,
  now: Date,
): TimestampAssignment {
  // The single bounded conversion for the clock reading: a non-finite or
  // extended-year `Date` fails closed here, before any durable write, rather
  // than throwing at `toISOString()` deeper in the assignment.
  const nowInstant = boundedInstant(now);
  if (nowInstant === null) {
    return { kind: 'rejected', reason: 'state-corrupt' };
  }
  const active = new Map(
    committed.map((state) => [state.documentName as string, state]),
  );
  // `max(now, highWaterMark + 1 ms)`, computed without `Date.parse`: when `now`
  // is already strictly past the floor it is the answer unchanged (identical to
  // the previous `Date`-only behaviour); otherwise the floor is advanced by
  // exactly one millisecond through the total, leap-second-aware helper, so a
  // leap-second or sub-millisecond floor can never wedge the assignment. When
  // that step would leave the representable year range the assignment fails
  // closed rather than writing an unusable value.
  let fresh: string;
  if (highWaterMark === null) {
    fresh = nowInstant;
  } else {
    const order = compareInstants(nowInstant, highWaterMark);
    if (order === null) {
      return { kind: 'rejected', reason: 'state-corrupt' };
    }
    if (order === 1) {
      fresh = nowInstant;
    } else {
      const bumped = instantPlusMillisecond(highWaterMark);
      if (bumped === null) {
        return { kind: 'rejected', reason: 'timestamp-space-exhausted' };
      }
      fresh = bumped;
    }
  }
  return {
    kind: 'assigned',
    states: candidate.map((entry) => {
      const current = active.get(entry.documentName);
      const unchanged =
        current !== undefined && current.revision === entry.revision;
      return {
        documentName: entry.documentName,
        revision: entry.revision,
        observedAt: unchanged ? current.observedAt : fresh,
      };
    }),
  };
}

export function highestInstant(
  values: readonly (string | null)[],
): string | null {
  let best: string | null = null;
  for (const value of values) {
    if (value === null) continue;
    // Ordered by canonical comparison, not `Date.parse`: a leap-second value is
    // a real instant here, not a `NaN` that gets silently skipped.
    if (canonicalInstant(value) === null) continue;
    if (best === null) {
      best = value;
      continue;
    }
    if (compareInstants(value, best) === 1) best = value;
  }
  return best;
}

export function isExpired(record: OperationRecord, now: Date): boolean {
  const nowInstant = boundedInstant(now);
  // A clock reading with no usable spelling counts as expired: fail closed,
  // never let `finalize` proceed on it.
  if (nowInstant === null) return true;
  const order = compareInstants(nowInstant, record.deadline);
  // An unparseable deadline (only reachable through a corrupt durable record)
  // counts as expired: fail closed, never let `finalize` proceed on it.
  return order === null ? true : order === 1;
}

export function isOperationIdentity(value: {
  season: unknown;
  operationEpoch: unknown;
  operationToken: unknown;
}): value is OperationIdentity {
  return (
    isSeason(value.season) &&
    typeof value.operationEpoch === 'number' &&
    Number.isSafeInteger(value.operationEpoch) &&
    value.operationEpoch >= 1 &&
    isOpaqueIdentifier(value.operationToken)
  );
}

/**
 * One cleanup request, in whichever of its two forms it arrived, reduced to a
 * validated shape the coordinator acts on. `operationToken` is `null` for a
 * pending-slot ({@link RetiredCleanupRequest}) cleanup and a validated string
 * for a current-record ({@link CurrentCleanupRequest}) one; a token that is
 * present but malformed rejects the whole request.
 */
export interface ParsedCleanupRequest {
  readonly season: number;
  readonly operationEpoch: number;
  readonly candidateVersion: string;
  readonly operationToken: string | null;
}

export function parseCleanupRequest(request: {
  season: unknown;
  operationEpoch: unknown;
  candidateVersion: unknown;
  operationToken?: unknown;
}): ParsedCleanupRequest | null {
  if (!isSeason(request.season)) return null;
  if (
    typeof request.operationEpoch !== 'number' ||
    !Number.isSafeInteger(request.operationEpoch) ||
    request.operationEpoch < 1
  ) {
    return null;
  }
  if (!isVersionIdentifier(request.candidateVersion)) return null;
  let operationToken: string | null = null;
  if (request.operationToken !== undefined && request.operationToken !== null) {
    if (!isOpaqueIdentifier(request.operationToken)) return null;
    operationToken = request.operationToken;
  }
  return {
    season: request.season,
    operationEpoch: request.operationEpoch,
    candidateVersion: request.candidateVersion,
    operationToken,
  };
}

export function validatePrepareRequest(
  request: PrepareRequest,
): PrepareRejectionReason | null {
  if (!isSeason(request.season)) return 'invalid-season';
  if (!isOperationKind(request.operationKind)) return 'invalid-operation-kind';
  if (!isInstant(request.sourceOrderingInput)) {
    return 'invalid-source-ordering-input';
  }
  if (!isManifestCommitment(request.expectedManifestCommitment)) {
    return 'invalid-manifest-commitment';
  }
  const revisions = request.perKeyRevisions;
  if (!Array.isArray(revisions) || revisions.length === 0) {
    return 'invalid-per-key-revisions';
  }
  if (revisions.length > maximumManifestSize) return 'manifest-too-large';
  const seen = new Set<string>();
  for (const entry of revisions) {
    if (!isDocumentName(entry?.documentName)) {
      return 'invalid-per-key-revisions';
    }
    if (!isSnapshotRevision(entry.revision)) {
      return 'invalid-per-key-revisions';
    }
    if (seen.has(entry.documentName)) return 'invalid-per-key-revisions';
    seen.add(entry.documentName);
  }
  return null;
}

export function validateCutoverSeed(
  seed: CutoverSeed,
): CutoverRejectionReason | null {
  if (!isSeason(seed.season)) return 'invalid-season';
  if (!isOpaqueIdentifier(seed.cutoverFingerprint)) {
    return 'invalid-cutover-fingerprint';
  }
  if (!isVersionIdentifier(seed.activeVersion)) return 'invalid-seed';
  if (
    seed.previousVersion !== null &&
    !isVersionIdentifier(seed.previousVersion)
  ) {
    return 'invalid-seed';
  }
  if (!isInstant(seed.committedSourceOrderingInput)) return 'invalid-seed';
  if (!isInstant(seed.seasonSnapshotObservedAtHighWaterMark)) {
    return 'invalid-seed';
  }
  if (!Array.isArray(seed.perKeyState) || seed.perKeyState.length === 0) {
    return 'invalid-per-key-revisions';
  }
  if (seed.perKeyState.length > maximumManifestSize)
    return 'manifest-too-large';
  const seen = new Set<string>();
  for (const state of seed.perKeyState) {
    if (!isDocumentName(state?.documentName)) {
      return 'invalid-per-key-revisions';
    }
    if (!isSnapshotRevision(state.revision)) return 'invalid-per-key-revisions';
    if (!isInstant(state.observedAt)) return 'invalid-per-key-revisions';
    if (seen.has(state.documentName)) return 'invalid-per-key-revisions';
    seen.add(state.documentName);
  }
  return null;
}

/**
 * Whether a seed's high-water mark is at or above every per-key timestamp it
 * carries - true of every seed the migration builds, because each imported
 * timestamp is one of the values the mark is the highest of. A recovered seed
 * that breaks it cannot be one that was committed, and is never trusted.
 */
export function seedFloorCoversPerKeyState(seed: CutoverSeed): boolean {
  return seed.perKeyState.every((state) => {
    const order = compareInstants(
      seed.seasonSnapshotObservedAtHighWaterMark,
      state.observedAt,
    );
    return order === 0 || order === 1;
  });
}

/**
 * Whether a presented seed is byte-for-byte the state already committed.
 *
 * Every field the seed carries is compared, not just the fingerprint: a
 * fingerprint match with a different seed is a conflict, not an idempotent
 * retry.
 */
export function seedMatchesCommittedState(
  seed: CutoverSeed,
  authority: AuthorityRecord,
  committed: readonly PerKeyState[],
): boolean {
  if (authority.cutoverFingerprint !== seed.cutoverFingerprint) return false;
  if (authority.activeVersion !== seed.activeVersion) return false;
  if (authority.previousVersion !== seed.previousVersion) return false;
  if (
    authority.committedSourceOrderingInput !== seed.committedSourceOrderingInput
  ) {
    return false;
  }
  if (
    authority.seasonSnapshotObservedAtHighWaterMark !==
    seed.seasonSnapshotObservedAtHighWaterMark
  ) {
    return false;
  }
  if (committed.length !== seed.perKeyState.length) return false;
  const existing = new Map(
    committed.map((state) => [state.documentName as string, state]),
  );
  return seed.perKeyState.every((state) => {
    const current = existing.get(state.documentName);
    return (
      current !== undefined &&
      current.revision === state.revision &&
      current.observedAt === state.observedAt
    );
  });
}
