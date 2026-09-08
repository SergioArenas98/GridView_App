/**
 * The season publication sequencer's state machine
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D2, D4, D5, D9, D12).
 *
 * One instance owns one season. Every authoritative decision it takes happens
 * inside **one** synchronous transaction over its own durable storage, with
 * every read the decision depends on and every write it performs in that same
 * transaction - never a sequence of separately-awaited operations with a gap
 * between them.
 *
 * ## What this component is not
 *
 * It never generates provider data, never validates a document body, never
 * stores a complete snapshot payload, and **never performs any Workers KV
 * I/O** - not inside the authoritative transaction and not outside it. It
 * authorizes orphan cleanup; it does not delete anything. It accepts an
 * already-validated cutover seed; it does not read legacy pointers to build
 * one.
 *
 * ## The guarantee's precise boundary
 *
 * `finalize` compares the manifest commitment a caller attests to against the
 * one `prepare` durably recorded for that exact epoch. That proves the caller's
 * attestation names the same manifest the operation was admitted against. It is
 * **not** an inspection of Workers KV: this component cannot observe whether
 * the writes happened, so a false-but-matching attestation is indistinguishable
 * to it from a true one. Producing an attestation only after every planned
 * write has actually succeeded is a `SnapshotPublisher` obligation, enforced by
 * that component's own tests, and is never described here as something this
 * component checks.
 *
 * **This component has no production caller and no runtime binding.**
 */

import {
  candidateVersionForEpoch,
  maximumOperationEpoch,
  randomOpaqueVersionComponent,
  type OpaqueVersionComponent,
} from './candidate-version';
import { isManifestCommitment } from './manifest-commitment';
import {
  type AuthorityRecord,
  type CancelOutcome,
  type CleanupAcknowledgement,
  type CleanupAuthorization,
  type CleanupRequest,
  type CommittedResult,
  type CutoverActivationOutcome,
  type CutoverActivationRequest,
  type CutoverSeed,
  type CutoverSeedOutcome,
  type FinalizeOutcome,
  type FinalizeRequest,
  type OperationIdentity,
  type OperationRecord,
  type PendingCleanupRecord,
  type PrepareOutcome,
  type PrepareRequest,
  type SeasonAuthority,
} from './model';
import {
  clearOperationRecord,
  clearPendingCleanupRecord,
  clearPerKeyState,
  committedKeyPrefix,
  isOpaqueIdentifier,
  isSeason,
  preparedKeyPrefix,
  putPerKeyState,
  readAuthorityRecord,
  readOperationRecord,
  readPendingCleanupRecord,
  readPerKeyState,
  writeAuthorityRecord,
  writeOperationRecord,
  writePendingCleanupRecord,
  type DurableRead,
  type SequencerHost,
  type SequencerRecordStore,
} from './store';
import {
  assignObservationTimestamps,
  highestInstant,
  isExpired,
  isOperationIdentity,
  parseCleanupRequest,
  validateCutoverSeed,
  validatePrepareRequest,
  seedMatchesCommittedState,
} from './rules';
import { systemClock, type Clock } from '../../runtime/clock';
import { boundedInstant, compareInstants } from '../canonical/instant';

/**
 * How long a prepared operation stays finalizable.
 *
 * Expiry never authorizes a pointer transition. It only narrows what counts as
 * "the current prepared operation" for admission of a *new* one, so a dead
 * caller cannot block a season forever. Fifteen minutes is comfortably longer
 * than a full release's document write phase and short enough that an abandoned
 * operation clears without operator action.
 */
export const defaultPreparationTtlMs = 15 * 60 * 1000;

/** Source of caller-facing operation tokens. Injected so tests stay exact. */
export type OperationTokenSource = () => string;

export const randomOperationToken: OperationTokenSource = () =>
  crypto.randomUUID();

export interface SequencerOptions {
  readonly clock?: Clock;
  readonly preparationTtlMs?: number;
  readonly token?: OperationTokenSource;
  readonly opaqueVersionComponent?: OpaqueVersionComponent;
}

export class SeasonPublicationCoordinator {
  private readonly clock: Clock;
  private readonly preparationTtlMs: number;
  private readonly token: OperationTokenSource;
  private readonly opaqueVersionComponent: OpaqueVersionComponent;

  constructor(
    private readonly host: SequencerHost,
    options: SequencerOptions = {},
  ) {
    this.clock = options.clock ?? systemClock;
    this.preparationTtlMs = options.preparationTtlMs ?? defaultPreparationTtlMs;
    this.token = options.token ?? randomOperationToken;
    this.opaqueVersionComponent =
      options.opaqueVersionComponent ?? randomOpaqueVersionComponent;
  }

  /**
   * What this season's authority currently is.
   *
   * The three cutover states produce three different answers and are never
   * conflated: `uninitialized` reports no seed at all, `seeded` reports the
   * seeded pair while declaring itself **not** authoritative, and only `active`
   * reports `authoritative: true`. A corrupt durable record, or a season this
   * object does not own, reports `unavailable` and is likewise never
   * authoritative.
   */
  readAuthority(season: number): SeasonAuthority {
    return this.host.transactionSync((store) => {
      const authority = readAuthorityRecord(store);
      if (authority.kind === 'corrupt') {
        return { cutoverState: 'unavailable', authoritative: false } as const;
      }
      if (
        authority.kind === 'missing' ||
        authority.value.cutoverState === 'uninitialized'
      ) {
        return { cutoverState: 'uninitialized', authoritative: false } as const;
      }
      const record = authority.value;
      if (record.season !== season) {
        // One object owns one season. It never answers for another.
        return { cutoverState: 'unavailable', authoritative: false } as const;
      }
      const { activeVersion, cutoverFingerprint } = record;
      if (activeVersion === null || cutoverFingerprint === null) {
        // A seeded/active record must carry both. The durable codec already
        // rejects one that lost either as corrupt; this is the fail-closed
        // path if that ever slips through, never a partial authority answer.
        return { cutoverState: 'unavailable', authoritative: false } as const;
      }
      return {
        cutoverState: record.cutoverState as 'seeded' | 'active',
        authoritative: record.cutoverState === 'active',
        activeVersion,
        previousVersion: record.previousVersion,
        cutoverFingerprint,
      } as const;
    });
  }

  /**
   * Admits a candidate, allocates its identity and assigns its per-key
   * observation timestamps - all in one authoritative transition.
   *
   * The destination version is **allocated here**, never supplied: a caller
   * that could name its own destination could name one a retired epoch already
   * owns, which is exactly the reuse orphan cleanup must be able to rule out
   * structurally rather than by convention.
   *
   * **A retry allocates nothing.** While a live prepared operation exists, no
   * `prepare` call allocates an epoch, a token or a version: it is refused with
   * `operation-in-progress` and the live operation's bounded identity. Only
   * once that operation is finalized, cancelled or expired does a genuinely new
   * `prepare` allocate a new epoch - and therefore, necessarily, a different
   * candidate version.
   */
  prepare(request: PrepareRequest): PrepareOutcome {
    const validation = validatePrepareRequest(request);
    if (validation !== null) {
      return { outcome: 'rejected', reason: validation };
    }
    return this.host.transactionSync((store): PrepareOutcome => {
      const authority = readAuthorityRecord(store);
      if (authority.kind === 'corrupt') {
        return { outcome: 'rejected', reason: 'state-corrupt' };
      }
      if (
        authority.kind === 'missing' ||
        authority.value.cutoverState !== 'active'
      ) {
        // Mutators stay paused until this season's authority has switched.
        // `seeded` is a pre-activation state in which legacy pointers remain
        // the declared authority, not a state this sequencer may publish from.
        return { outcome: 'rejected', reason: 'authority-not-active' };
      }
      const current = authority.value;
      if (current.season !== request.season) {
        return { outcome: 'rejected', reason: 'season-mismatch' };
      }

      const operation = readOperationRecord(store);
      if (operation.kind === 'corrupt') {
        return { outcome: 'rejected', reason: 'state-corrupt' };
      }
      const now = this.clock.now();
      const nowInstant = boundedInstant(now);
      if (nowInstant === null) {
        // A clock with no usable four-digit RFC 3339 spelling fails closed
        // here, before any durable write, rather than throwing deeper in
        // assignment or writing an extended-year timestamp into storage.
        return { outcome: 'rejected', reason: 'state-corrupt' };
      }
      const deadlineInstant = boundedInstant(
        new Date(now.getTime() + this.preparationTtlMs),
      );
      if (deadlineInstant === null) {
        // The clock is valid, but `now + ttl` leaves the representable year
        // range. Nothing is written.
        return { outcome: 'rejected', reason: 'timestamp-space-exhausted' };
      }
      let stagedRetirement: PendingCleanupRecord | null = null;
      if (operation.kind === 'value') {
        const live = operation.value;
        if (live.phase === 'recovery-required') {
          return { outcome: 'rejected', reason: 'state-corrupt' };
        }
        if (live.phase === 'prepared' && !isExpired(live, now)) {
          return {
            outcome: 'rejected',
            reason: 'operation-in-progress',
            liveOperation: {
              operationEpoch: live.epoch,
              candidateVersion: live.candidateVersion,
            },
          };
        }
        // The outgoing record is about to be displaced. If it is cancelled, or
        // a prepared record that has expired, its candidate may already carry
        // partial Workers KV writes and must stay collectable - so its identity
        // is moved into the single pending-cleanup slot in the same atomic
        // write, never silently overwritten (D5).
        const retirable =
          live.phase === 'cancelled' ||
          (live.phase === 'prepared' && isExpired(live, now));
        const orphaned =
          retirable &&
          live.candidateVersion !== current.activeVersion &&
          live.candidateVersion !== current.previousVersion;
        if (orphaned) {
          const pending = readPendingCleanupRecord(store);
          if (pending.kind === 'corrupt') {
            return { outcome: 'rejected', reason: 'state-corrupt' };
          }
          if (pending.kind === 'value') {
            // The slot already holds an earlier orphan. Backpressure, rather
            // than overwrite it or leak a second uncollectable version.
            return {
              outcome: 'rejected',
              reason: 'pending-cleanup-required',
              pendingCleanup: {
                operationEpoch: pending.value.operationEpoch,
                candidateVersion: pending.value.candidateVersion,
              },
            };
          }
          stagedRetirement = {
            operationEpoch: live.epoch,
            candidateVersion: live.candidateVersion,
            retiredAt: nowInstant,
          };
        }
      }

      if (
        request.operationKind === 'ordinary-publication' &&
        current.committedSourceOrderingInput !== null &&
        compareInstants(
          request.sourceOrderingInput,
          current.committedSourceOrderingInput,
        ) === -1
      ) {
        // Exactly as strict as the pre-sequencer implementation: only strictly
        // older is rejected, now by canonical comparison rather than
        // `Date.parse` so a leap-second or high-precision ordering value is
        // ordered rather than turned into `NaN`. Equality has always been
        // admissible, because two
        // consecutive genuinely-changed candidates may legitimately share one
        // ordering value - neither adopted source publishes a recency signal
        // finer than this field carries - and per-key revision comparison is
        // what actually detects whether content changed.
        return { outcome: 'rejected', reason: 'older-source-ordering-input' };
      }

      const epoch = current.lastOperationEpoch + 1;
      if (epoch > maximumOperationEpoch) {
        return { outcome: 'rejected', reason: 'epoch-space-exhausted' };
      }

      const committed = readPerKeyState(store, committedKeyPrefix);
      if (committed.kind === 'corrupt') {
        return { outcome: 'rejected', reason: 'state-corrupt' };
      }
      const assignment = assignObservationTimestamps(
        request.perKeyRevisions,
        committed.kind === 'value' ? committed.value : [],
        current.seasonSnapshotObservedAtHighWaterMark,
        now,
      );
      if (assignment.kind === 'rejected') {
        // A non-finite/extended-year clock (`state-corrupt`) or an exhausted
        // assignment floor (`timestamp-space-exhausted`), returned - never
        // thrown - with no durable write.
        return { outcome: 'rejected', reason: assignment.reason };
      }
      const assignedTimestamps = assignment.states;

      const candidateVersion = candidateVersionForEpoch(
        epoch,
        this.opaqueVersionComponent,
      );
      const record: OperationRecord = {
        epoch,
        token: this.token(),
        operationKind: request.operationKind,
        phase: 'prepared',
        priorVersion: current.activeVersion,
        candidateVersion,
        sourceOrderingInput: request.sourceOrderingInput,
        expectedManifestCommitment: request.expectedManifestCommitment,
        preparedAt: nowInstant,
        deadline: deadlineInstant,
        committedResult: null,
      };

      // Retiring the old epoch and installing the new one is one write, never
      // two: a window between them is exactly the ambiguity this design exists
      // to remove.
      clearPerKeyState(store, preparedKeyPrefix);
      for (const state of assignedTimestamps) {
        putPerKeyState(store, preparedKeyPrefix, state);
      }
      if (stagedRetirement !== null) {
        writePendingCleanupRecord(store, stagedRetirement);
      }
      writeOperationRecord(store, record);
      writeAuthorityRecord(store, { ...current, lastOperationEpoch: epoch });

      return {
        outcome: 'prepared',
        operationEpoch: epoch,
        operationToken: record.token,
        candidateVersion,
        assignedTimestamps,
        deadline: record.deadline,
        ...(stagedRetirement !== null
          ? {
              retiredCleanup: {
                operationEpoch: stagedRetirement.operationEpoch,
                candidateVersion: stagedRetirement.candidateVersion,
              },
            }
          : {}),
      };
    });
  }

  /**
   * The one and only authoritative state transition this design has.
   *
   * A successful commit writes `activeVersion`, `previousVersion`,
   * `committedSourceOrderingInput`, the per-key committed state, the high-water
   * mark and the phase change **together**, in one atomic storage write. No
   * Workers KV pointer write occurs here, and no Workers KV I/O of any kind
   * happens inside this transaction.
   */
  finalize(request: FinalizeRequest): FinalizeOutcome {
    if (!isOperationIdentity(request)) {
      return { outcome: 'rejected', reason: 'malformed-identity' };
    }
    if (
      !isManifestCommitment(request.completionAttestation?.manifestCommitment)
    ) {
      return { outcome: 'rejected', reason: 'malformed-identity' };
    }
    return this.host.transactionSync((store): FinalizeOutcome => {
      const context = this.resolveActive(store, request.season);
      if (context.kind !== 'active') {
        return { outcome: 'rejected', reason: context.reason };
      }
      const authority = context.authority;
      const operation = readOperationRecord(store);
      if (operation.kind === 'corrupt') {
        return { outcome: 'rejected', reason: 'state-corrupt' };
      }
      if (operation.kind === 'missing') {
        return {
          outcome: 'rejected',
          reason:
            request.operationEpoch > authority.lastOperationEpoch
              ? 'unknown-epoch'
              : 'no-current-operation',
        };
      }

      const record = operation.value;
      if (request.operationEpoch > record.epoch) {
        // An epoch this season never allocated is never treated as prior state.
        return { outcome: 'rejected', reason: 'unknown-epoch' };
      }
      if (request.operationEpoch < record.epoch) {
        // Terminal, and deliberately silent about whether the retired
        // candidate committed before it was superseded: the record that would
        // have answered that is gone.
        return {
          outcome: 'superseded',
          currentOperationEpoch: record.epoch,
          activeVersion: authority.activeVersion,
          previousVersion: authority.previousVersion,
        };
      }
      if (request.operationToken !== record.token) {
        // The current operation exists and this caller is not its holder. That
        // is an invalid identity, not a supersession.
        return { outcome: 'rejected', reason: 'stale-identity' };
      }

      if (record.phase === 'committed' && record.committedResult !== null) {
        return {
          outcome: 'committed',
          result: record.committedResult,
          replayed: true,
        };
      }
      if (record.phase !== 'prepared') {
        return { outcome: 'rejected', reason: 'operation-not-prepared' };
      }
      const now = this.clock.now();
      const nowInstant = boundedInstant(now);
      if (nowInstant === null) {
        // A clock with no usable four-digit RFC 3339 spelling: fail closed with
        // no transition, exactly as a non-finite one already did.
        return { outcome: 'rejected', reason: 'state-corrupt' };
      }
      if (isExpired(record, now)) {
        return { outcome: 'rejected', reason: 'preparation-expired' };
      }
      if (
        request.completionAttestation.manifestCommitment !==
        record.expectedManifestCommitment
      ) {
        return { outcome: 'rejected', reason: 'manifest-commitment-mismatch' };
      }

      const prepared = readPerKeyState(store, preparedKeyPrefix);
      if (prepared.kind === 'corrupt') {
        return { outcome: 'rejected', reason: 'state-corrupt' };
      }
      const assigned = prepared.kind === 'value' ? prepared.value : [];
      const result: CommittedResult = {
        activeVersion: record.candidateVersion,
        previousVersion: authority.activeVersion,
        operationKind: record.operationKind,
        committedAt: nowInstant,
      };

      // Per-key state for a key no longer named in the incoming manifest is
      // retired here. The season-wide high-water mark is not: it is never
      // lowered or removed merely because a key left the active inventory,
      // which is what gives that key a floor to clear if it is ever restored.
      clearPerKeyState(store, committedKeyPrefix);
      for (const state of assigned) {
        putPerKeyState(store, committedKeyPrefix, state);
      }
      clearPerKeyState(store, preparedKeyPrefix);
      writeAuthorityRecord(store, {
        ...authority,
        activeVersion: result.activeVersion,
        previousVersion: result.previousVersion,
        committedSourceOrderingInput: record.sourceOrderingInput,
        seasonSnapshotObservedAtHighWaterMark: highestInstant([
          authority.seasonSnapshotObservedAtHighWaterMark,
          ...assigned.map((state) => state.observedAt),
        ]),
      });
      writeOperationRecord(store, {
        ...record,
        phase: 'committed',
        committedResult: result,
      });

      return { outcome: 'committed', result, replayed: false };
    });
  }

  /**
   * Cancels a prepared operation, making its epoch terminal.
   *
   * An expired prepared operation is treated as already cancelled and is
   * durably marked so, which is what lets orphan cleanup be authorized against
   * it. A cancelled epoch never transitions back to `prepared` or `committed`.
   */
  cancel(request: OperationIdentity): CancelOutcome {
    if (!isOperationIdentity(request)) {
      return { outcome: 'rejected', reason: 'malformed-identity' };
    }
    return this.host.transactionSync((store): CancelOutcome => {
      const context = this.resolveActive(store, request.season);
      if (context.kind !== 'active') {
        return { outcome: 'rejected', reason: context.reason };
      }
      const operation = readOperationRecord(store);
      if (operation.kind === 'corrupt') {
        return { outcome: 'rejected', reason: 'state-corrupt' };
      }
      if (operation.kind === 'missing') {
        return {
          outcome: 'rejected',
          reason:
            request.operationEpoch > context.authority.lastOperationEpoch
              ? 'unknown-epoch'
              : 'no-current-operation',
        };
      }
      const record = operation.value;
      if (request.operationEpoch > record.epoch) {
        return { outcome: 'rejected', reason: 'unknown-epoch' };
      }
      if (request.operationEpoch < record.epoch) {
        return { outcome: 'superseded', currentOperationEpoch: record.epoch };
      }
      if (request.operationToken !== record.token) {
        return { outcome: 'rejected', reason: 'stale-identity' };
      }
      if (record.phase === 'committed') {
        return { outcome: 'rejected', reason: 'operation-committed' };
      }
      if (record.phase === 'cancelled') {
        return {
          outcome: 'already-cancelled',
          candidateVersion: record.candidateVersion,
        };
      }
      if (record.phase !== 'prepared') {
        return { outcome: 'rejected', reason: 'state-corrupt' };
      }
      clearPerKeyState(store, preparedKeyPrefix);
      writeOperationRecord(store, { ...record, phase: 'cancelled' });
      return {
        outcome: 'cancelled',
        candidateVersion: record.candidateVersion,
      };
    });
  }

  /**
   * Authorizes deletion of one retired operation's orphaned version.
   *
   * The request **names** the operation it wants cleaned up, and only that one
   * is authorized - against exactly one of two bounded places its identity can
   * live: the **current** durable operation record while it is still
   * `cancelled` and current, or the single **pending-cleanup slot** it was
   * moved to when a later `prepare` displaced it (D5). "Recheck the epoch"
   * still means checking the *named* epoch and version, never whichever epoch
   * happens to be current - the pending slot holds exactly one retired
   * identity, not "some terminal epoch".
   *
   * Cleanup is **always refused** for `activeVersion`, `previousVersion`, and
   * the candidate of the current prepared or committed operation.
   *
   * **This never deletes anything.** The external Workers KV deletion happens
   * outside any transaction and remains best-effort, and this design does not
   * claim atomicity between the two - no such cross-product atomicity exists.
   * What makes a delayed deletion safe to act on is structural: a candidate
   * version is owned by exactly one epoch for its whole existence, so no later
   * operation can ever make the named version reachable again.
   *
   * The request arrives in one of two forms (D5). A {@link CurrentCleanupRequest}
   * carries the operation token and is the only form that can authorize cleanup
   * of a **still-current** `cancelled` record. A {@link RetiredCleanupRequest}
   * carries no token and can only ever reach the pending-cleanup slot - which
   * is exactly what a restarted replacement caller, holding only the
   * `RetiredCleanupHandle` a later `prepare` returned, is able to build.
   */
  authorizeCleanup(request: CleanupRequest): CleanupAuthorization {
    const parsed = parseCleanupRequest(request);
    if (parsed === null) {
      return { outcome: 'refused', reason: 'malformed-request' };
    }
    return this.host.transactionSync((store): CleanupAuthorization => {
      const authority = readAuthorityRecord(store);
      if (authority.kind === 'corrupt') {
        return { outcome: 'refused', reason: 'state-corrupt' };
      }
      if (authority.kind === 'missing') {
        return { outcome: 'refused', reason: 'no-current-operation' };
      }
      if (authority.value.season !== parsed.season) {
        return { outcome: 'refused', reason: 'season-mismatch' };
      }
      const operation = readOperationRecord(store);
      if (operation.kind === 'corrupt') {
        return { outcome: 'refused', reason: 'state-corrupt' };
      }
      const pending = readPendingCleanupRecord(store);
      if (pending.kind === 'corrupt') {
        return { outcome: 'refused', reason: 'state-corrupt' };
      }

      const isAuthoritativeVersion = (version: string): boolean =>
        version === authority.value.activeVersion ||
        version === authority.value.previousVersion ||
        (operation.kind === 'value' &&
          operation.value.phase !== 'cancelled' &&
          operation.value.candidateVersion === version);

      // Path 1: the named operation is still the current durable record. This
      // path requires a matching **token**, so a tokenless
      // `RetiredCleanupRequest` can never reach it.
      if (
        parsed.operationToken !== null &&
        operation.kind === 'value' &&
        operation.value.epoch === parsed.operationEpoch &&
        operation.value.token === parsed.operationToken
      ) {
        const record = operation.value;
        if (record.phase !== 'cancelled') {
          return { outcome: 'refused', reason: 'operation-not-cancelled' };
        }
        if (record.candidateVersion !== parsed.candidateVersion) {
          return { outcome: 'refused', reason: 'candidate-version-mismatch' };
        }
        if (isAuthoritativeVersion(parsed.candidateVersion)) {
          return { outcome: 'refused', reason: 'version-is-authoritative' };
        }
        return {
          outcome: 'authorized',
          candidateVersion: record.candidateVersion,
        };
      }

      // Path 2: the named operation was displaced and now sits in the single
      // pending-cleanup slot. Epoch plus candidate version is an exact scope -
      // the version belongs to exactly that epoch for its whole existence, and
      // the epoch is retired and terminal (D3, D5) - and no token is needed or
      // consulted, because none was stored for it.
      if (
        pending.kind === 'value' &&
        pending.value.operationEpoch === parsed.operationEpoch &&
        pending.value.candidateVersion === parsed.candidateVersion
      ) {
        if (isAuthoritativeVersion(parsed.candidateVersion)) {
          return { outcome: 'refused', reason: 'version-is-authoritative' };
        }
        return {
          outcome: 'authorized',
          candidateVersion: pending.value.candidateVersion,
        };
      }

      if (operation.kind === 'missing' && pending.kind === 'missing') {
        return { outcome: 'refused', reason: 'no-current-operation' };
      }
      return { outcome: 'refused', reason: 'identity-not-current' };
    });
  }

  /**
   * The idempotent transition a caller drives once its external Workers KV
   * deletion of an authorized cleanup has succeeded, or once it has confirmed
   * the version is already absent (D5).
   *
   * It retires the named identity from whichever bounded place holds it - the
   * current `cancelled` operation record (via a {@link CurrentCleanupRequest},
   * token required), or the single pending-cleanup slot (via either form) -
   * freeing that capacity for the next retirement. Acknowledging the same
   * identity twice, or one an earlier cycle already cleared, is `acknowledged`,
   * not an error. A different identity than the one currently retired is
   * refused, so a stale acknowledgement cannot free the slot for the wrong
   * orphan. It performs no Workers KV I/O.
   */
  acknowledgeCleanup(request: CleanupRequest): CleanupAcknowledgement {
    const parsed = parseCleanupRequest(request);
    if (parsed === null) {
      return { outcome: 'rejected', reason: 'malformed-request' };
    }
    return this.host.transactionSync((store): CleanupAcknowledgement => {
      const authority = readAuthorityRecord(store);
      if (authority.kind === 'corrupt') {
        return { outcome: 'rejected', reason: 'state-corrupt' };
      }
      if (authority.kind === 'missing') {
        return { outcome: 'rejected', reason: 'identity-not-current' };
      }
      if (authority.value.season !== parsed.season) {
        return { outcome: 'rejected', reason: 'season-mismatch' };
      }

      const pending = readPendingCleanupRecord(store);
      if (pending.kind === 'corrupt') {
        return { outcome: 'rejected', reason: 'state-corrupt' };
      }
      if (pending.kind === 'value') {
        if (
          pending.value.operationEpoch === parsed.operationEpoch &&
          pending.value.candidateVersion === parsed.candidateVersion
        ) {
          clearPendingCleanupRecord(store);
          return { outcome: 'acknowledged' };
        }
        // An older identity than the one now staged was already cleared.
        if (parsed.operationEpoch < pending.value.operationEpoch) {
          return { outcome: 'acknowledged' };
        }
        return { outcome: 'rejected', reason: 'identity-not-current' };
      }

      const operation = readOperationRecord(store);
      if (operation.kind === 'corrupt') {
        return { outcome: 'rejected', reason: 'state-corrupt' };
      }
      if (operation.kind === 'missing') {
        // Nothing staged anywhere: an earlier cycle cleared it.
        return { outcome: 'acknowledged' };
      }
      const record = operation.value;
      // The current-record path requires a matching token, so a tokenless
      // `RetiredCleanupRequest` can never retire a still-current cancelled
      // record - only a genuinely displaced orphan from the pending slot above.
      if (
        parsed.operationToken !== null &&
        record.epoch === parsed.operationEpoch &&
        record.token === parsed.operationToken &&
        record.candidateVersion === parsed.candidateVersion &&
        record.phase === 'cancelled'
      ) {
        clearOperationRecord(store);
        return { outcome: 'acknowledged' };
      }
      if (record.epoch > parsed.operationEpoch) {
        // The named epoch is already retired past the current record.
        return { outcome: 'acknowledged' };
      }
      return { outcome: 'rejected', reason: 'identity-not-current' };
    });
  }

  /**
   * Commits a complete, already validated cutover seed as one atomic write.
   *
   * The seed is supplied by a future migration caller; this component never
   * enumerates or reads legacy Workers KV pointers to build one. After this
   * commit the sequencer can answer lookups for the season immediately, but it
   * is **not yet** authoritative: `seeded` and `active` are separate durable
   * transitions, because a crash between them is a real, distinguishable state
   * this design must define rather than an interval it can wave away.
   */
  seedCutover(seed: CutoverSeed): CutoverSeedOutcome {
    const validation = validateCutoverSeed(seed);
    if (validation !== null) {
      return { outcome: 'rejected', reason: validation };
    }
    return this.host.transactionSync((store): CutoverSeedOutcome => {
      const authority = readAuthorityRecord(store);
      if (authority.kind === 'corrupt') {
        return { outcome: 'rejected', reason: 'state-corrupt' };
      }
      if (
        authority.kind === 'value' &&
        authority.value.cutoverState !== 'uninitialized'
      ) {
        if (authority.value.season !== seed.season) {
          return { outcome: 'rejected', reason: 'season-mismatch' };
        }
        const committed = readPerKeyState(store, committedKeyPrefix);
        if (committed.kind === 'corrupt') {
          return { outcome: 'rejected', reason: 'state-corrupt' };
        }
        if (
          !seedMatchesCommittedState(
            seed,
            authority.value,
            committed.kind === 'value' ? committed.value : [],
          )
        ) {
          // Never silently applied over an existing seed. Resolving a
          // conflicting attempt is an explicit operator decision.
          return { outcome: 'rejected', reason: 'conflicting-cutover-seed' };
        }
        return authority.value.cutoverState === 'active'
          ? { outcome: 'already-active' }
          : { outcome: 'already-seeded' };
      }

      const record: AuthorityRecord = {
        season: seed.season,
        cutoverState: 'seeded',
        activeVersion: seed.activeVersion,
        previousVersion: seed.previousVersion,
        committedSourceOrderingInput: seed.committedSourceOrderingInput,
        seasonSnapshotObservedAtHighWaterMark:
          seed.seasonSnapshotObservedAtHighWaterMark,
        lastOperationEpoch:
          authority.kind === 'value' ? authority.value.lastOperationEpoch : 0,
        cutoverFingerprint: seed.cutoverFingerprint,
      };
      clearPerKeyState(store, committedKeyPrefix);
      clearPerKeyState(store, preparedKeyPrefix);
      for (const state of seed.perKeyState) {
        putPerKeyState(store, committedKeyPrefix, state);
      }
      writeAuthorityRecord(store, record);
      return { outcome: 'seeded' };
    });
  }

  /**
   * The separate, idempotent `seeded -> active` transition that switches this
   * season's authority and resumes its mutators.
   *
   * It requires an activation confirmation bound to the exact seeded migration
   * fingerprint. A missing or mismatched fingerprint is rejected rather than
   * applied: the operator must explicitly abandon, restart or otherwise resolve
   * the seeded attempt, never activate a mismatch.
   */
  activateCutover(request: CutoverActivationRequest): CutoverActivationOutcome {
    if (!isSeason(request.season)) {
      return { outcome: 'rejected', reason: 'invalid-season' };
    }
    if (!isOpaqueIdentifier(request.cutoverFingerprint)) {
      return { outcome: 'rejected', reason: 'invalid-cutover-fingerprint' };
    }
    return this.host.transactionSync((store): CutoverActivationOutcome => {
      const authority = readAuthorityRecord(store);
      if (authority.kind === 'corrupt') {
        return { outcome: 'rejected', reason: 'state-corrupt' };
      }
      if (
        authority.kind === 'missing' ||
        authority.value.cutoverState === 'uninitialized'
      ) {
        return { outcome: 'rejected', reason: 'cutover-not-seeded' };
      }
      const record = authority.value;
      if (record.season !== request.season) {
        return { outcome: 'rejected', reason: 'season-mismatch' };
      }
      if (record.cutoverFingerprint !== request.cutoverFingerprint) {
        return { outcome: 'rejected', reason: 'cutover-fingerprint-mismatch' };
      }
      if (record.cutoverState === 'active') {
        return { outcome: 'already-active' };
      }
      writeAuthorityRecord(store, { ...record, cutoverState: 'active' });
      return { outcome: 'activated' };
    });
  }

  /** The shared "is this season active, and is it this season" precondition. */
  private resolveActive(
    store: SequencerRecordStore,
    season: number,
  ):
    | { kind: 'active'; authority: AuthorityRecord }
    | {
        kind: 'rejected';
        reason: 'state-corrupt' | 'authority-not-active' | 'season-mismatch';
      } {
    const authority: DurableRead<AuthorityRecord> = readAuthorityRecord(store);
    if (authority.kind === 'corrupt') {
      return { kind: 'rejected', reason: 'state-corrupt' };
    }
    if (
      authority.kind === 'missing' ||
      authority.value.cutoverState !== 'active'
    ) {
      return { kind: 'rejected', reason: 'authority-not-active' };
    }
    if (authority.value.season !== season) {
      return { kind: 'rejected', reason: 'season-mismatch' };
    }
    return { kind: 'active', authority: authority.value };
  }
}
