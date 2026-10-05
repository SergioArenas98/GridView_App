/**
 * The reconciliation ledger's transactional storage (G9 storage foundation,
 * runtime activation decision O-6).
 *
 * Every operation is **one** synchronous storage transaction. A refusal is
 * raised as a `LedgerRefusal` inside the transaction and caught outside it, so
 * every write the operation had made is discarded: a failed operation changes
 * no record, whichever check it failed.
 *
 * What the store enforces, and nothing more:
 *
 * - **Season leases with fencing.** One held, unexpired lease per season. Each
 *   acquisition hands out the next fencing token, which only ever grows, and
 *   every write presents it. A released, expired or superseded token commits
 *   nothing.
 * - **Conditional updates.** Every record write names the storage version it
 *   read; a stale version is refused, so no caller overwrites a newer record.
 * - **The global backlog capacity of 60**, counted inside the same
 *   transaction across every season, with no eviction.
 * - **An append-only, bounded superseded-revision history.** An insertion
 *   beyond the capacity is refused; an eviction is refused as a rewrite; and
 *   no transient, staged or competing slot may hold a superseded revision.
 * - **`publishedRevision` is a cache of the authoritative release.** An
 *   ordinary commit can never change it; only `reconcilePublishedRevisions`,
 *   which is handed the authoritative release's revisions, writes it.
 * - **A strictly increasing release-wide ordering input** per season (O-13).
 * - **D2.5, the staged slot is immutable.** A commit can never clear or change
 *   a staged or competing correction, write a disposition, or remove a
 *   backlog entry, and a backlog entry is inserted only together with the
 *   staged slot it holds. Only `dispose` (T12) releases either.
 * - **Review tracking belongs to verification.** A commit can never create a
 *   competing correction, write a verification record, or change the
 *   candidate slot of a staged record. Only `verify` (T11-T11c) does, so only
 *   an explicit operator verification can lock a record for review.
 * - **Operator state belongs to operators.** A commit can never set, change
 *   or clear a hold or the last operator action, and can set a durable block
 *   but never change or clear one. Only `operate` does.
 * - **No reservation through a stop.** A commit that reserves a publication
 *   while a hold or durable block is set is refused, whatever its caller
 *   decided.
 *
 * What it deliberately does not do: any §10.4.1 transition other than T11-T12,
 * corroboration, settling, due-work planning, publishability or no-change
 * decision, or choosing an ordering input. Those compute the records a caller
 * commits here; the store only refuses an ordering input that does not move
 * forward. The operator transitions are pure (`operator.ts`) and run here
 * only because each needs checks one transaction must make atomically.
 *
 * The object's own clock is the only time source for leases and entry times.
 */

import { systemClock, type Clock } from '../../../runtime/clock';
import type { SequencerHost } from '../../../publication/sequencer/store';
import {
  BACKLOG_CAPACITY,
  LEASE_TTL_MS,
  LEDGER_SCHEMA_VERSION,
  SUPERSEDED_REVISION_CAPACITY,
  type BacklogEntry,
  type ClassificationRecord,
  type LeaseAcquisition,
  type LeaseRecord,
  type LeaseRelease,
  type LeaseToken,
  type LedgerCommitOutcome,
  type LedgerReadOutcome,
  type LedgerRejection,
  type LedgerRejectionReason,
  type OperatorTransitionOutcome,
  type PublishedReconciliation,
  type PublishedReconciliationOutcome,
  type SeasonRecord,
  type Versioned,
} from './model';
import {
  applyDisposition,
  applyOperatorAction,
  emptySeasonRecord,
  seasonAfterDisposition,
} from './operator';
import {
  LedgerRefusal,
  backlogKey,
  expired,
  readBacklog,
  readClassification,
  readClassifications,
  readLease,
  readSeasonRecord,
  readSnapshot,
  refuse,
  type Store,
} from './reads';
import { ledgerKeys } from './records';
import {
  decodeCommitRequest,
  decodeDispositionRequest,
  decodeLeaseToken,
  decodeOperatorActionRequest,
  decodeReconciliationRequest,
  decodeSeasonRequest,
  decodeVerificationRequest,
} from './requests';
import { applyOperatorVerification } from './verification';

/** The storage host: SQLite-backed Durable Object storage, or its in-memory double. */
export type LedgerHost = SequencerHost;

export interface LedgerStoreOptions {
  readonly clock?: Clock;
}

export class ReconciliationLedgerStore {
  private readonly clock: Clock;

  constructor(
    private readonly host: LedgerHost,
    options: LedgerStoreOptions = {},
  ) {
    this.clock = options.clock ?? systemClock;
  }

  /** One season's ledger state. Needs no lease and writes nothing. */
  readSeason(payload: unknown): LedgerReadOutcome {
    return this.transact((store) => {
      const season = decodeSeasonRequest(payload);
      if (season === null) refuse('invalid-request');
      return {
        outcome: 'read',
        snapshot: readSnapshot(store, season, this.now()),
      };
    });
  }

  /**
   * Takes the season's lease if nobody holds a valid one, and answers the
   * season's state in the same transaction.
   */
  acquireLease(payload: unknown): LeaseAcquisition {
    return this.transact((store) => {
      const season = decodeSeasonRequest(payload);
      if (season === null) refuse('invalid-request');
      const now = this.now();
      const current = readLease(store, season);
      if (
        current !== null &&
        current.state === 'held' &&
        !expired(current, now)
      ) {
        refuse('lease-held');
      }
      const previousFence = current?.fence ?? 0;
      if (previousFence >= Number.MAX_SAFE_INTEGER) refuse('fence-exhausted');

      const lease: LeaseRecord = {
        schemaVersion: LEDGER_SCHEMA_VERSION,
        kind: 'lease',
        season,
        fence: previousFence + 1,
        state: 'held',
        acquiredAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + LEASE_TTL_MS).toISOString(),
      };
      store.put(ledgerKeys.lease(season), lease);
      return {
        outcome: 'acquired',
        lease: { season, fence: lease.fence, expiresAt: lease.expiresAt },
        snapshot: readSnapshot(store, season, now),
      };
    });
  }

  /**
   * Gives the lease back. Only the current, unexpired token may - the same
   * fence check every write runs - and releasing never rewinds the fence. An
   * expired lease needs no release: it already admits the next acquisition.
   */
  releaseLease(payload: unknown): LeaseRelease {
    return this.transact((store) => {
      const token = decodeLeaseToken(payload);
      if (token === null) refuse('invalid-request');
      const current = requireLease(store, token, this.now());
      store.put(ledgerKeys.lease(token.season), {
        ...current,
        state: 'released',
      } satisfies LeaseRecord);
      return { outcome: 'released' };
    });
  }

  /**
   * Applies every conditional write in the request, or none of them.
   *
   * The checks run in a fixed order - lease, versions, operator state, the
   * published-revision cache, the revision history, the staged slots, then
   * the backlog - and the first failure refuses the whole request.
   */
  commit(payload: unknown): LedgerCommitOutcome {
    return this.transact((store) => {
      const decoded = decodeCommitRequest(payload);
      if (!decoded.ok) refuse(decoded.reason);
      const request = decoded.value;
      const season = request.lease.season;
      const now = this.now();
      requireLease(store, request.lease, now);

      const seasonWrite = request.seasonRecord;
      const storedSeason =
        seasonWrite === null ? null : readSeasonRecord(store, season);
      if (
        seasonWrite !== null &&
        seasonWrite.expectedVersion !== (storedSeason?.version ?? 0)
      ) {
        refuse('version-conflict');
      }
      if (seasonWrite !== null) {
        checkOrderingInput(
          storedSeason?.record.lastOrderingInput ?? null,
          seasonWrite.record.lastOrderingInput,
        );
        checkOperatorState(storedSeason?.record ?? null, seasonWrite.record);
      }

      const stored = new Map<number, Versioned<ClassificationRecord> | null>();
      for (const write of request.classifications) {
        const current = readClassification(store, season, write.record.round);
        if (write.expectedVersion !== (current?.version ?? 0)) {
          refuse('version-conflict');
        }
        stored.set(write.record.round, current);
      }
      for (const write of request.classifications) {
        checkClassificationWrite(
          stored.get(write.record.round) ?? null,
          write.record,
        );
      }

      // D2.5: only T12 (`dispose`) releases a backlog entry.
      if (request.backlogRemovals.length > 0) {
        refuse('staged-correction-immutable');
      }
      const backlog = readBacklog(store);
      const existing = new Set(backlog.map(backlogKey));
      const inserted = new Map(
        request.backlogInsertions.map((entry) => [entry.round, entry.revision]),
      );
      for (const insertion of request.backlogInsertions) {
        // One entry per resource, whatever revision a second one names.
        if (existing.has(ledgerKeys.backlog(season, insertion.round))) {
          refuse('backlog-duplicate');
        }
        if (!stored.has(insertion.round)) refuse('backlog-orphan');
      }
      for (const write of request.classifications) {
        // A staged slot and its backlog entry are entered together, or not
        // at all, so the capacity counts exactly the corrections held.
        const before = stored.get(write.record.round)?.record ?? null;
        const staged = write.record.stagedCorrection;
        const entry = inserted.get(write.record.round);
        const staging = before?.stagedCorrection == null && staged !== null;
        if (staging ? entry !== staged.revision : entry !== undefined) {
          refuse('backlog-staged-mismatch');
        }
      }
      const count = backlog.length + request.backlogInsertions.length;
      if (count > BACKLOG_CAPACITY) refuse('backlog-capacity-exceeded');

      // Every check passed. Only now is anything written.
      if (seasonWrite !== null) {
        store.put(ledgerKeys.season(season), {
          version: (storedSeason?.version ?? 0) + 1,
          record: seasonWrite.record,
        });
      }
      for (const write of request.classifications) {
        store.put(ledgerKeys.classification(season, write.record.round), {
          version: write.expectedVersion + 1,
          record: write.record,
        });
      }
      const enteredAt = now.toISOString();
      for (const insertion of request.backlogInsertions) {
        store.put(ledgerKeys.backlog(season, insertion.round), {
          schemaVersion: LEDGER_SCHEMA_VERSION,
          kind: 'backlog-entry',
          season,
          round: insertion.round,
          revision: insertion.revision,
          enteredAt,
        } satisfies BacklogEntry);
      }
      return {
        outcome: 'committed',
        snapshot: readSnapshot(store, season, now),
      };
    });
  }

  /**
   * One season-level operator action - hold, release the hold, or clear a
   * durable block - fenced by the lease and conditional on the season record
   * version the operator inspected.
   *
   * A resent operation ID is answered `already-applied` and writes nothing,
   * even after the version moved on; the same ID for another action is
   * refused. Only the most recent action is remembered, so an ID resent after
   * a later action fails its version check instead: it never applies twice.
   */
  operate(payload: unknown): OperatorTransitionOutcome {
    return this.transact((store) => {
      const decoded = decodeOperatorActionRequest(payload);
      if (!decoded.ok) refuse(decoded.reason);
      const request = decoded.value;
      const season = request.lease.season;
      const now = this.now();
      requireLease(store, request.lease, now);

      const stored = readSeasonRecord(store, season);
      const last = stored?.record.lastOperatorAction ?? null;
      if (last !== null && last.operationId === request.operationId) {
        if (last.action !== request.action) refuse('operation-id-reused');
        return {
          outcome: 'already-applied',
          snapshot: readSnapshot(store, season, now),
        };
      }
      if (request.expectedVersion !== (stored?.version ?? 0)) {
        refuse('version-conflict');
      }
      const next = applyOperatorAction(
        stored?.record ?? emptySeasonRecord(season),
        request,
        now.toISOString(),
      );
      if (next === null) refuse('operator-precondition-failed');
      store.put(ledgerKeys.season(season), {
        version: (stored?.version ?? 0) + 1,
        record: next,
      });
      return { outcome: 'applied', snapshot: readSnapshot(store, season, now) };
    });
  }

  /**
   * T12: disposes of one staged correction, releases its backlog entry and,
   * when no other round of the season still waits for review, lifts the
   * season's transient review block - all in one transaction, or nothing.
   *
   * The only operation that may clear a staged or competing correction or
   * remove a backlog entry. It sends nothing and publishes nothing. A resent
   * operation ID is answered as `operate` answers one.
   */
  dispose(payload: unknown): OperatorTransitionOutcome {
    return this.transact((store) => {
      const decoded = decodeDispositionRequest(payload);
      if (!decoded.ok) refuse(decoded.reason);
      const request = decoded.value;
      const season = request.lease.season;
      const now = this.now();
      requireLease(store, request.lease, now);

      const stored = readClassification(store, season, request.round);
      if (stored === null) refuse('operator-precondition-failed');
      const last = stored.record.lastDisposition;
      if (last !== null && last.operationId === request.operationId) {
        if (last.action !== request.action) refuse('operation-id-reused');
        return {
          outcome: 'already-applied',
          snapshot: readSnapshot(store, season, now),
        };
      }
      if (request.expected.recordVersion !== stored.version) {
        refuse('version-conflict');
      }
      const at = now.toISOString();
      const next = applyDisposition(stored.record, request, at);
      if (next === null) refuse('operator-precondition-failed');
      const entry = readBacklog(store).find(
        (candidate) =>
          candidate.season === season && candidate.round === request.round,
      );
      if (entry?.revision !== request.expected.stagedRevision) {
        refuse('backlog-entry-missing');
      }
      if (next.supersededRevisions.length > SUPERSEDED_REVISION_CAPACITY) {
        refuse('revision-history-capacity');
      }
      checkHistory(stored, next);

      const storedSeason = readSeasonRecord(store, season);
      const remaining = readClassifications(store, season)
        .map(({ record }) => record)
        .filter((record) => record.round !== request.round);
      const seasonNext = seasonAfterDisposition(
        storedSeason?.record ?? null,
        remaining,
        at,
      );

      store.put(ledgerKeys.classification(season, request.round), {
        version: stored.version + 1,
        record: next,
      });
      store.delete(ledgerKeys.backlog(season, request.round));
      if (seasonNext !== null) {
        store.put(ledgerKeys.season(season), {
          version: storedSeason!.version + 1,
          record: seasonNext,
        });
      }
      return { outcome: 'applied', snapshot: readSnapshot(store, season, now) };
    });
  }

  /**
   * T11-T11c: one operator verification of one staged correction, against
   * the staged revision the operator named and the record version they read.
   *
   * It writes that classification record and nothing else: no season record,
   * no backlog entry, and never the staged slot, the accepted or published
   * revision or the history (`verification.ts`). A deferral records only the
   * limiter's retry instant and no verification. A resent operation ID is
   * answered `already-applied` and writes nothing, so one response is never
   * counted as two sightings; the same ID for another target is refused.
   */
  verify(payload: unknown): OperatorTransitionOutcome {
    return this.transact((store) => {
      const decoded = decodeVerificationRequest(payload);
      if (!decoded.ok) refuse(decoded.reason);
      const request = decoded.value;
      const season = request.lease.season;
      const now = this.now();
      requireLease(store, request.lease, now);

      const stored = readClassification(store, season, request.round);
      if (stored === null) refuse('operator-precondition-failed');
      const last = stored.record.lastVerification;
      if (last !== null && last.operationId === request.operationId) {
        if (last.stagedRevision !== request.expected.stagedRevision) {
          refuse('operation-id-reused');
        }
        return {
          outcome: 'already-applied',
          snapshot: readSnapshot(store, season, now),
        };
      }
      if (request.expected.recordVersion !== stored.version) {
        refuse('version-conflict');
      }
      const step = applyOperatorVerification(
        stored.record,
        request,
        now.toISOString(),
      );
      if (step.kind === 'refused') refuse(step.reason);
      const entry = readBacklog(store).find(
        (candidate) =>
          candidate.season === season && candidate.round === request.round,
      );
      if (entry?.revision !== request.expected.stagedRevision) {
        refuse('backlog-entry-missing');
      }
      checkHistory(stored, step.record);

      store.put(ledgerKeys.classification(season, request.round), {
        version: stored.version + 1,
        record: step.record,
      });
      return { outcome: 'applied', snapshot: readSnapshot(store, season, now) };
    });
  }

  /**
   * Replaces the season's cached published revisions with the authoritative
   * release's, and records which release they came from.
   *
   * Every classification record follows the authority: a round the release
   * classifies takes that revision, and a round it does not classify has none.
   * The ledger never refuses the authority's value, so it cannot become a
   * second publication authority. Rounds the release classifies but the ledger
   * holds no record for are reported, not invented.
   */
  reconcilePublishedRevisions(
    payload: unknown,
  ): PublishedReconciliationOutcome {
    return this.transact((store) => {
      const decoded = decodeReconciliationRequest(payload);
      if (!decoded.ok) refuse(decoded.reason);
      const request = decoded.value;
      const season = request.lease.season;
      const now = this.now();
      requireLease(store, request.lease, now);

      const authoritative = new Map(
        request.revisions.map((entry) => [entry.round, entry.revision]),
      );
      const records = readClassifications(store, season);
      for (const { version, record } of records) {
        const revision = authoritative.get(record.round) ?? null;
        if (revision === record.publishedRevision) continue;
        store.put(ledgerKeys.classification(season, record.round), {
          version: version + 1,
          record: { ...record, publishedRevision: revision },
        });
      }
      store.put(ledgerKeys.published(season), {
        schemaVersion: LEDGER_SCHEMA_VERSION,
        kind: 'published-reconciliation',
        season,
        activeVersion: request.activeVersion,
        reconciledAt: now.toISOString(),
      } satisfies PublishedReconciliation);

      const recorded = new Set(records.map(({ record }) => record.round));
      return {
        outcome: 'reconciled',
        snapshot: readSnapshot(store, season, now),
        unrecordedRounds: [...authoritative.keys()]
          .filter((round) => !recorded.has(round))
          .sort((left, right) => left - right),
      };
    });
  }

  private now(): Date {
    const now = this.clock.now();
    if (Number.isNaN(now.getTime())) {
      // Never a decision: the operation fails as unavailable, not refused.
      throw new RangeError('The ledger clock returned an invalid instant.');
    }
    return now;
  }

  private transact<T>(run: (store: Store) => T): T | LedgerRejection {
    try {
      return this.host.transactionSync(run);
    } catch (error) {
      if (error instanceof LedgerRefusal) {
        return { outcome: 'rejected', reason: error.reason };
      }
      throw error;
    }
  }
}

/** Why a token may not act, or `null` when it holds the valid lease. */
function tokenMismatch(
  current: LeaseRecord | null,
  token: LeaseToken,
): LedgerRejectionReason | null {
  if (current === null) return 'lease-not-held';
  if (token.fence < current.fence) return 'lease-superseded';
  // A token from the future was never handed out.
  if (token.fence > current.fence) return 'lease-not-held';
  if (current.state !== 'held') return 'lease-not-held';
  return null;
}

/** The fenced check every mutating operation runs first. */
function requireLease(store: Store, token: LeaseToken, now: Date): LeaseRecord {
  const current = readLease(store, token.season);
  const reason = tokenMismatch(current, token);
  if (reason !== null) refuse(reason);
  if (expired(current!, now)) refuse('lease-expired');
  return current!;
}

/**
 * The season's release-wide ordering input only ever moves strictly forward
 * (O-13). An unchanged value is not a reservation; a lowered, repeated or
 * cleared one is refused, so no two releases the ledger ordered can share or
 * reverse an ordering value, whatever the writer's clock did.
 */
function checkOrderingInput(stored: string | null, next: string | null): void {
  if (next === stored) return;
  if (next === null) refuse('ordering-input-regression');
  if (stored !== null && Date.parse(next) <= Date.parse(stored)) {
    refuse('ordering-input-regression');
  }
}

/** Equality of two decoded values: closed, and built in a fixed key order. */
function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Operator state a commit may not touch. A hold and the last operator action
 * are written only by `operate`. A durable block may be set by a run - the
 * outcome that found the condition - but only `operate` changes or clears it.
 * And no reservation is recorded while either stop is set, so a publication
 * cannot reach the guarded publisher through one.
 */
function checkOperatorState(
  stored: SeasonRecord | null,
  next: SeasonRecord,
): void {
  if (
    !same(next.operatorHold, stored?.operatorHold ?? null) ||
    !same(next.lastOperatorAction, stored?.lastOperatorAction ?? null) ||
    (stored !== null &&
      stored.durableBlock !== null &&
      !same(next.durableBlock, stored.durableBlock))
  ) {
    refuse('operator-state-immutable');
  }
  const disposition = next.publicationDisposition;
  if (
    disposition?.state === 'publishing' &&
    disposition.digest !== null &&
    (next.operatorHold !== null || next.durableBlock !== null)
  ) {
    refuse('publication-stopped');
  }
}

/**
 * The storage-level rules one classification write must satisfy, beyond its
 * schema and version.
 */
function checkClassificationWrite(
  stored: Versioned<ClassificationRecord> | null,
  next: ClassificationRecord,
): void {
  // The published revision is a cache of the authority, written only by
  // reconciliation. A first write starts with none.
  if (next.publishedRevision !== (stored?.record.publishedRevision ?? null)) {
    refuse('published-revision-not-reconciled');
  }
  // D2.5: a staged or competing correction, once held, and the disposition
  // record belong to T12 alone. A competing correction is created only by
  // `verify` (T11b), which also owns a staged record's candidate slot and the
  // verification record: a run can neither lock a record for review nor
  // forge or erase a verification's sighting.
  const before = stored?.record ?? null;
  if (
    (before?.stagedCorrection != null &&
      (!same(next.stagedCorrection, before.stagedCorrection) ||
        next.candidateRevision !== before.candidateRevision ||
        next.candidateFirstSeenAt !== before.candidateFirstSeenAt)) ||
    !same(next.competingCorrection, before?.competingCorrection ?? null) ||
    !same(next.lastDisposition, before?.lastDisposition ?? null) ||
    !same(next.lastVerification, before?.lastVerification ?? null)
  ) {
    refuse('staged-correction-immutable');
  }
  checkHistory(stored, next);
}

/**
 * D2.2, for every writer: the history is append-only, and no slot a later
 * decision could promote holds a superseded revision.
 */
function checkHistory(
  stored: Versioned<ClassificationRecord> | null,
  next: ClassificationRecord,
): void {
  // Append-only: the stored history must survive as the new history's prefix.
  // Dropping, reordering or replacing an entry is refused, never evicted.
  const previous = stored?.record.supersededRevisions ?? [];
  if (
    previous.length > next.supersededRevisions.length ||
    new Set(next.supersededRevisions).size !==
      next.supersededRevisions.length ||
    previous.some(
      (revision, index) => next.supersededRevisions[index] !== revision,
    )
  ) {
    refuse('revision-history-rewrite');
  }
  // A superseded revision is never applied again (ADR 0020 D2.2): neither the
  // accepted content nor any slot a later decision could promote may hold one.
  const superseded = new Set(next.supersededRevisions);
  for (const revision of [
    next.contentRevision,
    next.candidateRevision,
    next.stagedCorrection?.revision ?? null,
    next.competingCorrection?.revision ?? null,
  ]) {
    if (revision !== null && superseded.has(revision)) {
      refuse('superseded-revision-reapplied');
    }
  }
}
