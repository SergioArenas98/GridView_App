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
): PerKeyState[] {
  const active = new Map(
    committed.map((state) => [state.documentName as string, state]),
  );
  const floor = highWaterMark === null ? null : Date.parse(highWaterMark);
  const freshMillis =
    floor === null ? now.getTime() : Math.max(now.getTime(), floor + 1);
  const fresh = new Date(freshMillis).toISOString();
  return candidate.map((entry) => {
    const current = active.get(entry.documentName);
    const unchanged =
      current !== undefined && current.revision === entry.revision;
    return {
      documentName: entry.documentName,
      revision: entry.revision,
      observedAt: unchanged ? current.observedAt : fresh,
    };
  });
}

export function highestInstant(
  values: readonly (string | null)[],
): string | null {
  let best: string | null = null;
  let bestMillis = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value === null) continue;
    const millis = Date.parse(value);
    if (!Number.isFinite(millis)) continue;
    if (millis > bestMillis) {
      bestMillis = millis;
      best = value;
    }
  }
  return best;
}

export function isExpired(record: OperationRecord, now: Date): boolean {
  return now.getTime() > Date.parse(record.deadline);
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
