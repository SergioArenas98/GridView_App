/**
 * The vocabulary of the season publication sequencer: its durable model, its
 * caller-facing requests, and every bounded outcome and reason code it can
 * produce
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D2, D4, D5, D9, D11, D12).
 *
 * Every reason is a member of a closed union, never a free string and never
 * derived from an exception. These values reach structured logs, so nothing
 * here may carry a storage key, a document body, a provider payload, a secret
 * or a stack.
 */

import type { SnapshotDocumentName } from '../../storage/types';

/**
 * What kind of operation a candidate is. Durable, logged, and never inferred
 * after the fact from other fields.
 *
 * The distinction exists for exactly one purpose: ordinary publication's
 * source-ordering staleness rejection is evaluated only for
 * `ordinary-publication`. A rollback republishes a historical release, whose
 * ordering input is expected to be older than or equal to what is currently
 * committed, so evaluating that predicate would make rollback unexecutable.
 * Admission for a rollback comes from the authenticated operator request that
 * reached the caller, which is a different authorization boundary.
 */
export const operationKinds = [
  'ordinary-publication',
  'rollback-republication',
] as const;

export type OperationKind = (typeof operationKinds)[number];

export function isOperationKind(value: unknown): value is OperationKind {
  return operationKinds.includes(value as OperationKind);
}

/**
 * The durable phase of the current operation record.
 *
 * There are exactly two operation-carrying states, `prepared` and `committed`.
 * **There is no durable `committing` state**: `finalize` performs one atomic
 * `prepared -> committed` transition, and a genuinely atomic transition has no
 * externally observable intermediate for a restart to resume into.
 *
 * `cancelled` is terminal for its epoch and is the only phase orphan cleanup
 * may be authorized from. `recovery-required` is a defensive terminal state for
 * a durable record that cannot be reconciled with any defined transition; it is
 * never reached by an ambiguous external write, because this design has none in
 * its commit path.
 */
export const operationPhases = [
  'prepared',
  'committed',
  'cancelled',
  'recovery-required',
] as const;

export type OperationPhase = (typeof operationPhases)[number];

/**
 * Which authority is declared authoritative for this season.
 *
 * `uninitialized` - the migration procedure has never touched this season.
 * Legacy Workers KV pointers are the sole authority and the sequencer holds no
 * seed at all.
 *
 * `seeded` - a complete seed is committed for a specific migration fingerprint.
 * The sequencer can already answer lookups, but it is **not yet** the
 * authoritative switch: legacy pointer state remains the declared authority and
 * this season's mutators stay paused. This is a *pre-activation* state, and
 * must never be conflated with a post-activation fallback to legacy pointers,
 * which the design forbids outright.
 *
 * `active` - authority has switched. The sequencer is authoritative and this
 * season's publication and rollback mutators are admitted.
 */
export const cutoverStates = ['uninitialized', 'seeded', 'active'] as const;

export type CutoverState = (typeof cutoverStates)[number];

/** One key's committed or prepared revision/observation pair. */
export interface PerKeyState {
  readonly documentName: SnapshotDocumentName;
  /** `sha256:<64 hex>`, as produced by `snapshotRevision`. */
  readonly revision: string;
  /** RFC 3339 `date-time`, the value baked into `meta.sourceUpdatedAt`. */
  readonly observedAt: string;
}

/** One key's candidate revision, as supplied to `prepare`. */
export interface PerKeyRevision {
  readonly documentName: SnapshotDocumentName;
  readonly revision: string;
}

/**
 * The per-season authority record.
 *
 * Every field here is constant-size and independent of document count. The
 * per-key maps live in their own bounded records beside it, never serialized
 * into this one.
 */
export interface AuthorityRecord {
  readonly season: number;
  readonly cutoverState: CutoverState;
  readonly activeVersion: string | null;
  readonly previousVersion: string | null;
  /**
   * The `sourceOrderingInput` belonging to the **currently active release**.
   * Replaced only by a successful `prepared -> committed` transition; never
   * advanced by a prepare, a cancellation, an expiry or a supersession. It is
   * deliberately not a history and not a monotonic high-water mark: a rollback
   * commits its own historical value and this field moves backward with it.
   */
  readonly committedSourceOrderingInput: string | null;
  /**
   * A durable, monotonically non-decreasing **assignment floor** - at least the
   * greatest `snapshotObservedAt` this sequencer has itself committed for any
   * key this season, and possibly higher after a conservative migration seed.
   * Never retired or lowered when a key leaves the active inventory, which is
   * what gives a later restoration of that key a floor to clear.
   */
  readonly seasonSnapshotObservedAtHighWaterMark: string | null;
  /** The highest `operationEpoch` ever allocated for this season. */
  readonly lastOperationEpoch: number;
  /** The migration identity that produced the current seeded/active state. */
  readonly cutoverFingerprint: string | null;
}

/**
 * The complete current operation record - the sole restart-recovery source of
 * truth, and the only record `finalize` reads from.
 *
 * Every value `finalize` verifies or commits is here, because a restart between
 * `prepare` and `finalize` must not leave the sequencer remembering only *that*
 * something was prepared rather than *what*.
 *
 * Only the **current** record is retained, plus - separately - at most one
 * constant-size {@link PendingCleanupRecord}. That is why the recorded-result
 * replay guarantee is bounded to while this record is current: past that, a
 * retired epoch resolves to the `superseded` outcome instead. An unbounded map
 * of retired results would reintroduce exactly the unbounded per-operation
 * history the capacity argument refuses.
 */
export interface OperationRecord {
  readonly epoch: number;
  readonly token: string;
  readonly operationKind: OperationKind;
  readonly phase: OperationPhase;
  readonly priorVersion: string | null;
  /** Allocated by `prepare`. Never supplied by a caller. */
  readonly candidateVersion: string;
  readonly sourceOrderingInput: string;
  readonly expectedManifestCommitment: string;
  readonly preparedAt: string;
  readonly deadline: string;
  /** Present only while `phase === 'committed'`. Replayed verbatim. */
  readonly committedResult: CommittedResult | null;
}

/**
 * The one bounded, constant-size record that keeps a retired operation's
 * orphaned candidate collectable after a later `prepare` has displaced it
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D5).
 *
 * A `prepare` that replaces an expired or cancelled operation would otherwise
 * overwrite the sole durable fact its (possibly partially written) candidate
 * needs for cleanup authorization. Instead the retiring operation's identity is
 * moved here, in the same atomic transaction that installs the new operation,
 * so `authorizeCleanup` can still name it and `acknowledgeCleanup` can retire
 * it once the external deletion has succeeded or its absence is confirmed.
 *
 * There is **at most one** of these. If the slot is occupied when another
 * operation would need retiring, `prepare` applies explicit backpressure
 * (`pending-cleanup-required`) rather than overwriting it or leaking a second
 * orphan - so a repeated crash/expiry cycle can never grow this state. No
 * operation token is stored here: the epoch is retired and terminal, the
 * candidate version belongs to exactly that epoch for its whole existence
 * (D3), and a retired epoch's token can no longer authorize `finalize`.
 */
export interface PendingCleanupRecord {
  readonly operationEpoch: number;
  readonly candidateVersion: string;
  /** RFC 3339 `date-time`, the clock reading when the operation was retired. */
  readonly retiredAt: string;
}

/** The bounded result a committed operation replays for its own identity. */
export interface CommittedResult {
  readonly activeVersion: string;
  readonly previousVersion: string | null;
  readonly operationKind: OperationKind;
  readonly committedAt: string;
}

/** Why the sequencer refused a `prepare` call. */
export const prepareRejectionReasons = [
  'season-mismatch',
  'invalid-season',
  'invalid-operation-kind',
  'invalid-per-key-revisions',
  'manifest-too-large',
  'invalid-source-ordering-input',
  'invalid-manifest-commitment',
  'authority-not-active',
  'operation-in-progress',
  'older-source-ordering-input',
  'epoch-space-exhausted',
  /**
   * The assignment floor (`seasonSnapshotObservedAtHighWaterMark + 1 ms`) or a
   * derived deadline would leave the four-digit RFC 3339 year range. The clock
   * is valid; the representable timestamp space is exhausted. Nothing is
   * written. Distinct from `state-corrupt`, which describes an unusable clock or
   * an unreconcilable durable record, not a valid-but-exhausted boundary.
   */
  'timestamp-space-exhausted',
  /**
   * The single pending-cleanup slot is occupied, so another operation cannot
   * be retired until that orphan's cleanup is acknowledged. Carries
   * `pendingCleanup`.
   */
  'pending-cleanup-required',
  'state-corrupt',
] as const;

export type PrepareRejectionReason = (typeof prepareRejectionReasons)[number];

/** Why the sequencer refused a `finalize` call. */
export const finalizeRejectionReasons = [
  'season-mismatch',
  'malformed-identity',
  'unknown-epoch',
  'stale-identity',
  'no-current-operation',
  'operation-not-prepared',
  'preparation-expired',
  'manifest-commitment-mismatch',
  'authority-not-active',
  'state-corrupt',
] as const;

export type FinalizeRejectionReason = (typeof finalizeRejectionReasons)[number];

/** Why the sequencer refused a `cancel` call. */
export const cancelRejectionReasons = [
  'season-mismatch',
  'authority-not-active',
  'malformed-identity',
  'unknown-epoch',
  'stale-identity',
  'no-current-operation',
  'operation-committed',
  'state-corrupt',
] as const;

export type CancelRejectionReason = (typeof cancelRejectionReasons)[number];

/** Why the sequencer refused to authorize orphan cleanup. */
export const cleanupRefusalReasons = [
  'season-mismatch',
  'malformed-request',
  'no-current-operation',
  /** The named epoch/token is not the current durable record. */
  'identity-not-current',
  /** The current record is that identity, but it is not `cancelled`. */
  'operation-not-cancelled',
  /** The named version is not the one that record owns. */
  'candidate-version-mismatch',
  /** The named version is, or may become, authoritative. */
  'version-is-authoritative',
  'state-corrupt',
] as const;

export type CleanupRefusalReason = (typeof cleanupRefusalReasons)[number];

/** Why the sequencer refused a cutover seed or activation. */
export const cutoverRejectionReasons = [
  'season-mismatch',
  'invalid-season',
  'invalid-cutover-fingerprint',
  'invalid-seed',
  'invalid-per-key-revisions',
  'manifest-too-large',
  /** A different seed or fingerprint already exists for this season. */
  'conflicting-cutover-seed',
  /** Activation was attempted against a season that holds no seed. */
  'cutover-not-seeded',
  /** Activation named a fingerprint that is not the seeded one. */
  'cutover-fingerprint-mismatch',
  'state-corrupt',
] as const;

export type CutoverRejectionReason = (typeof cutoverRejectionReasons)[number];

export interface PrepareRequest {
  readonly season: number;
  readonly operationKind: OperationKind;
  readonly perKeyRevisions: readonly PerKeyRevision[];
  readonly sourceOrderingInput: string;
  readonly expectedManifestCommitment: string;
}

/**
 * The bounded identity of a retired operation whose orphaned candidate still
 * needs cleanup: enough for a caller to drive `authorizeCleanup` and
 * `acknowledgeCleanup`, and never the operation token.
 */
export interface RetiredCleanupHandle {
  readonly operationEpoch: number;
  readonly candidateVersion: string;
}

export type PrepareOutcome =
  | {
      readonly outcome: 'prepared';
      readonly operationEpoch: number;
      readonly operationToken: string;
      readonly candidateVersion: string;
      readonly assignedTimestamps: readonly PerKeyState[];
      readonly deadline: string;
      /**
       * Present only when this `prepare` displaced an expired or cancelled
       * operation whose candidate must still be cleaned up: its identity was
       * moved into the pending-cleanup slot, and this is the replayable handle
       * for it. Absent on the ordinary path.
       */
      readonly retiredCleanup?: RetiredCleanupHandle;
    }
  | {
      readonly outcome: 'rejected';
      readonly reason: PrepareRejectionReason;
      /**
       * Present only for `operation-in-progress`: the live operation's bounded
       * identity, so a caller that lost its response can tell which epoch and
       * version it is waiting on. The **token is never returned** - it is the
       * authorization handle for `finalize`, and only its original holder may
       * present it.
       */
      readonly liveOperation?: {
        readonly operationEpoch: number;
        readonly candidateVersion: string;
      };
      /**
       * Present only for `pending-cleanup-required`: the retired candidate
       * occupying the single pending-cleanup slot, which must be cleaned up and
       * acknowledged before another operation can be retired.
       */
      readonly pendingCleanup?: RetiredCleanupHandle;
    };

/** The identity `finalize` and `cancel` present: epoch **and** token. */
export interface OperationIdentity {
  readonly season: number;
  readonly operationEpoch: number;
  readonly operationToken: string;
}

export interface CompletionAttestation {
  readonly manifestCommitment: string;
}

export type FinalizeRequest = OperationIdentity & {
  readonly completionAttestation: CompletionAttestation;
};

export type FinalizeOutcome =
  | {
      readonly outcome: 'committed';
      readonly result: CommittedResult;
      /** `true` when the recorded result was replayed, nothing re-executed. */
      readonly replayed: boolean;
    }
  | {
      /**
       * Terminal. The operation is obsolete and must not be republished,
       * replayed or retried. It deliberately does **not** reproduce the retired
       * response and does **not** claim whether the retired candidate committed
       * before it was superseded - the record that would have answered that is
       * gone, and inventing an answer would be worse than declining to.
       */
      readonly outcome: 'superseded';
      readonly currentOperationEpoch: number;
      readonly activeVersion: string | null;
      readonly previousVersion: string | null;
    }
  | {
      readonly outcome: 'rejected';
      readonly reason: FinalizeRejectionReason;
    };

export type CancelOutcome =
  | { readonly outcome: 'cancelled'; readonly candidateVersion: string }
  | { readonly outcome: 'already-cancelled'; readonly candidateVersion: string }
  | {
      readonly outcome: 'superseded';
      readonly currentOperationEpoch: number;
    }
  | { readonly outcome: 'rejected'; readonly reason: CancelRejectionReason };

/**
 * Cleanup of an operation that is **still the current durable record** - it is
 * `cancelled` and has not been displaced. It is authorized by its full
 * operation identity: epoch, **token** and version. A token that does not match
 * the current record never authorizes anything.
 */
export type CurrentCleanupRequest = OperationIdentity & {
  readonly candidateVersion: string;
};

/**
 * Cleanup of a displaced orphan sitting in the single pending-cleanup slot. A
 * later `prepare` moved it there and dropped its token in that same atomic
 * write (D5, {@link PendingCleanupRecord}), so it is authorized from
 * `{season, operationEpoch, candidateVersion}` **alone** - exactly what a
 * caller holding only a {@link RetiredCleanupHandle} plus the season can
 * always construct truthfully, including a restarted replacement caller that
 * never saw the retired operation's token.
 *
 * This form can **never** authorize or acknowledge cleanup of a still-current
 * `cancelled` record: that path requires a matching token, which this form
 * does not carry.
 */
export type RetiredCleanupRequest = RetiredCleanupHandle & {
  readonly season: number;
};

/**
 * The two cleanup request forms. They are distinguished structurally by the
 * presence of `operationToken`: a current-record cleanup carries it, a
 * pending-slot cleanup never does.
 */
export type CleanupRequest = CurrentCleanupRequest | RetiredCleanupRequest;

export type CleanupAuthorization =
  | { readonly outcome: 'authorized'; readonly candidateVersion: string }
  | { readonly outcome: 'refused'; readonly reason: CleanupRefusalReason };

/** Why the sequencer refused to acknowledge a completed cleanup. */
export const cleanupAckRejectionReasons = [
  'malformed-request',
  'season-mismatch',
  /** The named epoch/token/version is neither the current retired record nor
   *  the pending-cleanup slot's, and is not an already-cleared older one. */
  'identity-not-current',
  'state-corrupt',
] as const;

export type CleanupAckRejectionReason =
  (typeof cleanupAckRejectionReasons)[number];

/**
 * The idempotent transition a caller drives after its external Workers KV
 * deletion has succeeded, or after it has confirmed the version is already
 * absent. Retiring the same identity twice, or one already cleared by a later
 * cycle, is `acknowledged`, not an error.
 */
export type CleanupAcknowledgement =
  | { readonly outcome: 'acknowledged' }
  | {
      readonly outcome: 'rejected';
      readonly reason: CleanupAckRejectionReason;
    };

/**
 * A complete, already validated cutover seed, supplied by a future migration
 * caller.
 *
 * The sequencer never enumerates or reads legacy Workers KV pointers to build
 * one. Selecting and validating the checkpoint is the migration runner's job;
 * committing a complete seed atomically, idempotently, and refusing a
 * conflicting one, is this mechanism's.
 */
export interface CutoverSeed {
  readonly season: number;
  readonly cutoverFingerprint: string;
  readonly activeVersion: string;
  /**
   * `null` when the checkpoint named no previous version, or when its
   * best-effort validation failed. A previous version that did not validate is
   * never committed as an authoritative rollback target.
   */
  readonly previousVersion: string | null;
  readonly committedSourceOrderingInput: string;
  readonly perKeyState: readonly PerKeyState[];
  readonly seasonSnapshotObservedAtHighWaterMark: string;
}

export type CutoverSeedOutcome =
  | { readonly outcome: 'seeded' }
  /** The identical seed and fingerprint are already committed. */
  | { readonly outcome: 'already-seeded' }
  /** The identical seed and fingerprint are already committed and active. */
  | { readonly outcome: 'already-active' }
  | {
      readonly outcome: 'rejected';
      readonly reason: CutoverRejectionReason;
    };

export interface CutoverActivationRequest {
  readonly season: number;
  readonly cutoverFingerprint: string;
}

export type CutoverActivationOutcome =
  | { readonly outcome: 'activated' }
  | { readonly outcome: 'already-active' }
  | {
      readonly outcome: 'rejected';
      readonly reason: CutoverRejectionReason;
    };

/**
 * What the sequencer reports about a season's authority.
 *
 * The three cutover states produce three genuinely different answers, and the
 * `authoritative` flag is never true outside `active`. A caller must not infer
 * authority from the mere presence of `activeVersion`: a `seeded` season has
 * one and is still not authoritative.
 */
export type SeasonAuthority =
  | {
      readonly cutoverState: 'uninitialized';
      readonly authoritative: false;
    }
  | {
      /**
       * A `seeded` or `active` season always carries both an `activeVersion`
       * and the `cutoverFingerprint` that produced it - neither state is
       * reachable without them. Only `previousVersion` is genuinely nullable.
       */
      readonly cutoverState: 'seeded' | 'active';
      readonly authoritative: boolean;
      readonly activeVersion: string;
      readonly previousVersion: string | null;
      readonly cutoverFingerprint: string;
    }
  | {
      /**
       * No answer is available: the durable record exists and cannot be
       * reconciled, or this object does not own the season that was asked
       * about. Both are fail-closed, and neither is ever authoritative.
       */
      readonly cutoverState: 'unavailable';
      readonly authoritative: false;
    };
