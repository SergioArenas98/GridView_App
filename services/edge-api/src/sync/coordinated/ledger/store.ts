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
 *
 * What it deliberately does not do: any §10.4.1 transition, corroboration,
 * settling, due-work planning, publishability or no-change decision, or
 * ordering-input assignment. Those compute the records a later change commits
 * here.
 *
 * The object's own clock is the only time source for leases and entry times.
 */

import { systemClock, type Clock } from '../../../runtime/clock';
import type {
  SequencerHost,
  SequencerRecordStore,
} from '../../../publication/sequencer/store';
import {
  BACKLOG_CAPACITY,
  LEASE_TTL_MS,
  LEDGER_SCHEMA_VERSION,
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
  type LedgerSnapshot,
  type PublishedReconciliation,
  type PublishedReconciliationOutcome,
  type SeasonRecord,
  type Versioned,
} from './model';
import {
  decodeBacklogEntry,
  decodeClassificationRecord,
  decodeCommitRequest,
  decodeLeaseRecord,
  decodeLeaseToken,
  decodePublishedReconciliation,
  decodeReconciliationRequest,
  decodeSeasonRecord,
  decodeSeasonRequest,
  decodeVersioned,
  ledgerKeys,
} from './records';

/** The storage host: SQLite-backed Durable Object storage, or its in-memory double. */
export type LedgerHost = SequencerHost;
type Store = SequencerRecordStore;

export interface LedgerStoreOptions {
  readonly clock?: Clock;
}

/** A refusal raised inside a transaction, so the transaction rolls back. */
class LedgerRefusal extends Error {
  constructor(readonly reason: LedgerRejectionReason) {
    super(reason);
  }
}

function refuse(reason: LedgerRejectionReason): never {
  throw new LedgerRefusal(reason);
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
   * The checks run in a fixed order - lease, versions, the published-revision
   * cache, the revision history, then the backlog - and the first failure
   * refuses the whole request.
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

      const backlog = readBacklog(store);
      const existing = new Map(
        backlog.map((entry) => [backlogKey(entry), entry] as const),
      );
      for (const removal of request.backlogRemovals) {
        // A disposition names the resource and the staged revision it
        // disposes of; any other revision does not match the entry.
        const entry = existing.get(ledgerKeys.backlog(season, removal.round));
        if (entry === undefined || entry.revision !== removal.revision) {
          refuse('backlog-entry-missing');
        }
      }
      const written = new Set(
        request.classifications.map((w) => w.record.round),
      );
      for (const insertion of request.backlogInsertions) {
        // One entry per resource, whatever revision a second one names.
        if (existing.has(ledgerKeys.backlog(season, insertion.round))) {
          refuse('backlog-duplicate');
        }
        if (
          !written.has(insertion.round) &&
          readClassification(store, season, insertion.round) === null
        ) {
          refuse('backlog-orphan');
        }
      }
      const count =
        backlog.length -
        request.backlogRemovals.length +
        request.backlogInsertions.length;
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
      for (const removal of request.backlogRemovals) {
        store.delete(ledgerKeys.backlog(season, removal.round));
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

function expired(lease: LeaseRecord, now: Date): boolean {
  return now.getTime() >= Date.parse(lease.expiresAt);
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
  // Append-only: the stored history must survive as the new history's prefix.
  // Dropping, reordering or replacing an entry is refused, never evicted.
  const previous = stored?.record.supersededRevisions ?? [];
  if (
    previous.length > next.supersededRevisions.length ||
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

// --- Reads: every stored value is decoded; anything else is corruption. ---

function readLease(store: Store, season: number): LeaseRecord | null {
  const raw = store.get(ledgerKeys.lease(season));
  if (raw === undefined) return null;
  const lease = decodeLeaseRecord(raw);
  if (lease === null || lease.season !== season) refuse('state-corrupt');
  return lease;
}

function readSeasonRecord(
  store: Store,
  season: number,
): Versioned<SeasonRecord> | null {
  const raw = store.get(ledgerKeys.season(season));
  if (raw === undefined) return null;
  const decoded = decodeVersioned(raw, decodeSeasonRecord);
  if (decoded === null || decoded.record.season !== season) {
    refuse('state-corrupt');
  }
  return decoded;
}

function readClassification(
  store: Store,
  season: number,
  round: number,
): Versioned<ClassificationRecord> | null {
  const raw = store.get(ledgerKeys.classification(season, round));
  if (raw === undefined) return null;
  const decoded = decodeVersioned(raw, decodeClassificationRecord);
  if (
    decoded === null ||
    decoded.record.season !== season ||
    decoded.record.round !== round
  ) {
    refuse('state-corrupt');
  }
  return decoded;
}

function readClassifications(
  store: Store,
  season: number,
): Versioned<ClassificationRecord>[] {
  const records: Versioned<ClassificationRecord>[] = [];
  for (const [key, raw] of store.list(
    ledgerKeys.classificationPrefix(season),
  )) {
    const decoded = decodeVersioned(raw, decodeClassificationRecord);
    if (
      decoded === null ||
      key !== ledgerKeys.classification(season, decoded.record.round) ||
      decoded.record.season !== season
    ) {
      refuse('state-corrupt');
    }
    records.push(decoded);
  }
  return records.sort((left, right) => left.record.round - right.record.round);
}

function readPublished(
  store: Store,
  season: number,
): PublishedReconciliation | null {
  const raw = store.get(ledgerKeys.published(season));
  if (raw === undefined) return null;
  const decoded = decodePublishedReconciliation(raw);
  if (decoded === null || decoded.season !== season) refuse('state-corrupt');
  return decoded;
}

function backlogKey(entry: BacklogEntry): string {
  return ledgerKeys.backlog(entry.season, entry.round);
}

/** Every backlog entry, across every season. */
function readBacklog(store: Store): BacklogEntry[] {
  const entries: BacklogEntry[] = [];
  for (const [key, raw] of store.list(ledgerKeys.backlogPrefix)) {
    const entry = decodeBacklogEntry(raw);
    if (entry === null || key !== backlogKey(entry)) refuse('state-corrupt');
    entries.push(entry);
  }
  // More entries than the capacity can only come from outside this store.
  if (entries.length > BACKLOG_CAPACITY) refuse('state-corrupt');
  return entries;
}

function readSnapshot(store: Store, season: number, now: Date): LedgerSnapshot {
  const lease = readLease(store, season);
  const backlog = readBacklog(store);
  return {
    season,
    seasonRecord: readSeasonRecord(store, season),
    classifications: readClassifications(store, season),
    published: readPublished(store, season),
    lease:
      lease === null
        ? null
        : {
            fence: lease.fence,
            state:
              lease.state === 'held' && expired(lease, now)
                ? 'expired'
                : lease.state,
            expiresAt: lease.expiresAt,
          },
    backlog: {
      count: backlog.length,
      capacity: BACKLOG_CAPACITY,
      entries: backlog
        .filter((entry) => entry.season === season)
        .sort((left, right) => left.round - right.round),
    },
  };
}
