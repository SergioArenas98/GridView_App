/**
 * The sequencer's durable storage layout, its transactional port, and the
 * validated codecs every read passes through
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D2, D3, D9).
 *
 * ## Why the state is not one serialized value
 *
 * ADR 0025 D9 records a capacity obligation rather than assuming it away: "one
 * atomic write" is a requirement about transactional indivisibility, not a
 * licence to serialize an arbitrarily large per-key map into a single oversized
 * value. This layout therefore stores **one bounded record per key**, under two
 * fixed prefixes, and the constant-size per-season values in one small record
 * beside them. A release-sized manifest becomes a release-sized number of small
 * rows, updated together inside one transaction, never one growing blob.
 *
 * ## Why the port is synchronous
 *
 * The authoritative transition must be one atomic storage-level operation with
 * no separately-awaited step in the middle. SQLite-backed Durable Object
 * storage provides exactly that: `ctx.storage.transactionSync(callback)` runs a
 * **synchronous** callback inside a transaction and rolls it back if the
 * callback throws, and `ctx.storage.kv` is its synchronous key-value API. A
 * synchronous port makes an accidental `await` inside the critical section a
 * compile error rather than a review question.
 *
 * The port is deliberately narrower than `DurableObjectState`: the real Durable
 * Object storage is structurally assignable to it, and an in-memory
 * implementation can supply the same semantics - including rollback - without a
 * Workers runtime.
 */

import type {
  AuthorityRecord,
  CutoverState,
  OperationKind,
  OperationPhase,
  OperationRecord,
  PendingCleanupRecord,
  PerKeyState,
} from './model';
import { cutoverStates, operationPhases, isOperationKind } from './model';
import { canonicalInstant } from '../canonical/instant';
import type { SnapshotDocumentName } from '../../storage/types';

/** The synchronous key-value surface one transaction operates over. */
export interface SequencerRecordStore {
  get(key: string): unknown;
  put(key: string, value: unknown): void;
  delete(key: string): void;
  /** Every entry whose key starts with `prefix`, in unspecified order. */
  list(prefix: string): Iterable<readonly [string, unknown]>;
}

/**
 * The transactional host the sequencer runs against.
 *
 * `transactionSync` must apply every write its callback performs atomically,
 * and must discard all of them if the callback throws.
 */
export interface SequencerHost {
  transactionSync<T>(run: (store: SequencerRecordStore) => T): T;
}

/** The per-season authority record. */
export const authorityStorageKey = 'authority';
/** The current operation record. Only ever one. */
export const operationStorageKey = 'operation';
/**
 * The single pending-cleanup record (D5). Present only while a retired
 * operation's orphaned candidate is still awaiting external deletion and its
 * acknowledgement; at most one exists at any time.
 */
export const pendingCleanupStorageKey = 'pending-cleanup';
/** Prefix for the committed per-key revision/observation records. */
export const committedKeyPrefix = 'committed/';
/** Prefix for the prepared candidate's per-key records. */
export const preparedKeyPrefix = 'prepared/';

/**
 * The largest manifest one operation may carry.
 *
 * Far above the largest release this codebase supports (a full season's
 * calendar, results, registries, standings and detail routes is on the order of
 * a hundred documents). It exists so a malformed or hostile caller cannot make
 * one transaction unbounded, not as a limit real publication approaches.
 */
export const maximumManifestSize = 2000;

/** `sha256:<64 hex>`, the shape `snapshotRevision` produces. */
const revisionPattern = /^sha256:[0-9a-f]{64}$/;

export function isSnapshotRevision(value: unknown): value is string {
  return typeof value === 'string' && revisionPattern.test(value);
}

/**
 * A bounded opaque identifier: an operation token, or a migration fingerprint.
 *
 * Length- and charset-bounded because both reach durable state and one of them
 * reaches structured logs. Neither is ever a storage key or a stored value.
 */
const opaqueIdentifierPattern = /^[A-Za-z0-9._:-]{1,128}$/;

export function isOpaqueIdentifier(value: unknown): value is string {
  return typeof value === 'string' && opaqueIdentifierPattern.test(value);
}

/**
 * A release version identifier: bounded, and free of the `:` that would break
 * `parseVersionFromSnapshotKey`'s `snapshot:{season}:{version}:` boundary.
 */
const versionPattern = /^[A-Za-z0-9._-]{1,128}$/;

export function isVersionIdentifier(value: unknown): value is string {
  return typeof value === 'string' && versionPattern.test(value);
}

export function isSeason(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1900 &&
    value <= 9999
  );
}

export function isInstant(value: unknown): value is string {
  return typeof value === 'string' && canonicalInstant(value) !== null;
}

/** A document name is any non-empty bounded string. The union is not re-derived here. */
export function isDocumentName(value: unknown): value is SnapshotDocumentName {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * How a durable read resolved.
 *
 * *Missing* and *corrupt* are different facts, exactly as they are for the
 * provider rate limiter's ledger: a genuinely new season starts empty, while a
 * record that exists and cannot be reconciled fails closed and is never
 * repaired, deleted, reset or relabelled by this code.
 */
export type DurableRead<T> =
  | { readonly kind: 'missing' }
  | { readonly kind: 'value'; readonly value: T }
  | { readonly kind: 'corrupt' };

export function readAuthorityRecord(
  store: SequencerRecordStore,
): DurableRead<AuthorityRecord> {
  const raw = store.get(authorityStorageKey);
  if (raw === undefined) return { kind: 'missing' };
  if (!isRecordValue(raw)) return { kind: 'corrupt' };
  if (!isSeason(raw.season)) return { kind: 'corrupt' };
  if (!cutoverStates.includes(raw.cutoverState as CutoverState)) {
    return { kind: 'corrupt' };
  }
  if (!isNullOr(raw.activeVersion, isVersionIdentifier)) {
    return { kind: 'corrupt' };
  }
  if (!isNullOr(raw.previousVersion, isVersionIdentifier)) {
    return { kind: 'corrupt' };
  }
  if (!isNullOr(raw.committedSourceOrderingInput, isInstant)) {
    return { kind: 'corrupt' };
  }
  if (!isNullOr(raw.seasonSnapshotObservedAtHighWaterMark, isInstant)) {
    return { kind: 'corrupt' };
  }
  if (
    typeof raw.lastOperationEpoch !== 'number' ||
    !Number.isSafeInteger(raw.lastOperationEpoch) ||
    raw.lastOperationEpoch < 0
  ) {
    return { kind: 'corrupt' };
  }
  if (!isNullOr(raw.cutoverFingerprint, isOpaqueIdentifier)) {
    return { kind: 'corrupt' };
  }
  return {
    kind: 'value',
    value: {
      season: raw.season,
      cutoverState: raw.cutoverState as CutoverState,
      activeVersion: raw.activeVersion as string | null,
      previousVersion: raw.previousVersion as string | null,
      committedSourceOrderingInput: raw.committedSourceOrderingInput as
        string | null,
      seasonSnapshotObservedAtHighWaterMark:
        raw.seasonSnapshotObservedAtHighWaterMark as string | null,
      lastOperationEpoch: raw.lastOperationEpoch,
      cutoverFingerprint: raw.cutoverFingerprint as string | null,
    },
  };
}

export function writeAuthorityRecord(
  store: SequencerRecordStore,
  record: AuthorityRecord,
): void {
  store.put(authorityStorageKey, record);
}

export function readOperationRecord(
  store: SequencerRecordStore,
): DurableRead<OperationRecord> {
  const raw = store.get(operationStorageKey);
  if (raw === undefined) return { kind: 'missing' };
  if (!isRecordValue(raw)) return { kind: 'corrupt' };
  if (
    typeof raw.epoch !== 'number' ||
    !Number.isSafeInteger(raw.epoch) ||
    raw.epoch < 1
  ) {
    return { kind: 'corrupt' };
  }
  if (!isOpaqueIdentifier(raw.token)) return { kind: 'corrupt' };
  if (!isOperationKind(raw.operationKind)) return { kind: 'corrupt' };
  if (!operationPhases.includes(raw.phase as OperationPhase)) {
    return { kind: 'corrupt' };
  }
  if (!isNullOr(raw.priorVersion, isVersionIdentifier)) {
    return { kind: 'corrupt' };
  }
  if (!isVersionIdentifier(raw.candidateVersion)) return { kind: 'corrupt' };
  if (!isInstant(raw.sourceOrderingInput)) return { kind: 'corrupt' };
  if (!isManifestCommitmentValue(raw.expectedManifestCommitment)) {
    return { kind: 'corrupt' };
  }
  if (!isInstant(raw.preparedAt)) return { kind: 'corrupt' };
  if (!isInstant(raw.deadline)) return { kind: 'corrupt' };
  const committedResult = readCommittedResult(raw.committedResult);
  if (committedResult === 'corrupt') return { kind: 'corrupt' };
  const phase = raw.phase as OperationPhase;
  // A committed record without its recorded result cannot replay, and a
  // non-committed record carrying one describes a transition that never
  // happened. Either is a record no defined transition produces.
  if ((phase === 'committed') !== (committedResult !== null)) {
    return { kind: 'corrupt' };
  }
  return {
    kind: 'value',
    value: {
      epoch: raw.epoch,
      token: raw.token,
      operationKind: raw.operationKind as OperationKind,
      phase,
      priorVersion: raw.priorVersion as string | null,
      candidateVersion: raw.candidateVersion,
      sourceOrderingInput: raw.sourceOrderingInput,
      expectedManifestCommitment: raw.expectedManifestCommitment,
      preparedAt: raw.preparedAt,
      deadline: raw.deadline,
      committedResult,
    },
  };
}

export function writeOperationRecord(
  store: SequencerRecordStore,
  record: OperationRecord,
): void {
  store.put(operationStorageKey, record);
}

/** Retires the current operation record entirely. Used only by an acknowledged
 *  cleanup of a cancelled operation that is still the current record (D5). */
export function clearOperationRecord(store: SequencerRecordStore): void {
  store.delete(operationStorageKey);
}

export function readPendingCleanupRecord(
  store: SequencerRecordStore,
): DurableRead<PendingCleanupRecord> {
  const raw = store.get(pendingCleanupStorageKey);
  if (raw === undefined) return { kind: 'missing' };
  if (!isRecordValue(raw)) return { kind: 'corrupt' };
  if (
    typeof raw.operationEpoch !== 'number' ||
    !Number.isSafeInteger(raw.operationEpoch) ||
    raw.operationEpoch < 1
  ) {
    return { kind: 'corrupt' };
  }
  if (!isVersionIdentifier(raw.candidateVersion)) return { kind: 'corrupt' };
  if (!isInstant(raw.retiredAt)) return { kind: 'corrupt' };
  return {
    kind: 'value',
    value: {
      operationEpoch: raw.operationEpoch,
      candidateVersion: raw.candidateVersion,
      retiredAt: raw.retiredAt,
    },
  };
}

export function writePendingCleanupRecord(
  store: SequencerRecordStore,
  record: PendingCleanupRecord,
): void {
  store.put(pendingCleanupStorageKey, record);
}

export function clearPendingCleanupRecord(store: SequencerRecordStore): void {
  store.delete(pendingCleanupStorageKey);
}

function readCommittedResult(
  raw: unknown,
): OperationRecord['committedResult'] | 'corrupt' {
  if (raw === null || raw === undefined) return null;
  if (!isRecordValue(raw)) return 'corrupt';
  if (!isVersionIdentifier(raw.activeVersion)) return 'corrupt';
  if (!isNullOr(raw.previousVersion, isVersionIdentifier)) return 'corrupt';
  if (!isOperationKind(raw.operationKind)) return 'corrupt';
  if (!isInstant(raw.committedAt)) return 'corrupt';
  return {
    activeVersion: raw.activeVersion,
    previousVersion: raw.previousVersion as string | null,
    operationKind: raw.operationKind,
    committedAt: raw.committedAt,
  };
}

function isManifestCommitmentValue(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
}

/**
 * Reads every per-key record under one prefix.
 *
 * The document name is recovered by removing the fixed leading prefix, so a
 * name containing any character - including the `:` document names already use
 * - round-trips exactly.
 */
export function readPerKeyState(
  store: SequencerRecordStore,
  prefix: string,
): DurableRead<PerKeyState[]> {
  const states: PerKeyState[] = [];
  for (const [key, raw] of store.list(prefix)) {
    const documentName = key.slice(prefix.length);
    if (!isDocumentName(documentName)) return { kind: 'corrupt' };
    if (!isRecordValue(raw)) return { kind: 'corrupt' };
    if (!isSnapshotRevision(raw.revision)) return { kind: 'corrupt' };
    if (!isInstant(raw.observedAt)) return { kind: 'corrupt' };
    states.push({
      documentName,
      revision: raw.revision,
      observedAt: raw.observedAt,
    });
  }
  return { kind: 'value', value: states };
}

export function putPerKeyState(
  store: SequencerRecordStore,
  prefix: string,
  state: PerKeyState,
): void {
  store.put(`${prefix}${state.documentName}`, {
    revision: state.revision,
    observedAt: state.observedAt,
  });
}

export function clearPerKeyState(
  store: SequencerRecordStore,
  prefix: string,
): void {
  for (const [key] of [...store.list(prefix)]) store.delete(key);
}

function isNullOr<T>(
  value: unknown,
  predicate: (candidate: unknown) => candidate is T,
): value is T | null {
  return value === null || predicate(value);
}
