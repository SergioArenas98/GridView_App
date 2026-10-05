/**
 * The ledger store's reads and its refusal, shared by every operation in
 * `store.ts`. Every stored value is decoded; anything else is corruption, and
 * is refused inside the transaction as `state-corrupt`, so a caller can never
 * act on a record the model does not describe.
 */

import type { SequencerRecordStore } from '../../../publication/sequencer/store';
import {
  BACKLOG_CAPACITY,
  type BacklogEntry,
  type ClassificationRecord,
  type LeaseRecord,
  type LedgerRejectionReason,
  type LedgerSnapshot,
  type PublishedReconciliation,
  type SeasonRecord,
  type Versioned,
} from './model';
import {
  decodeBacklogEntry,
  decodeClassificationRecord,
  decodeLeaseRecord,
  decodePublishedReconciliation,
  decodeSeasonRecord,
  decodeVersioned,
  ledgerKeys,
} from './records';

export type Store = SequencerRecordStore;

/** A refusal raised inside a transaction, so the transaction rolls back. */
export class LedgerRefusal extends Error {
  constructor(readonly reason: LedgerRejectionReason) {
    super(reason);
  }
}

export function refuse(reason: LedgerRejectionReason): never {
  throw new LedgerRefusal(reason);
}

export function expired(lease: LeaseRecord, now: Date): boolean {
  return now.getTime() >= Date.parse(lease.expiresAt);
}

export function readLease(store: Store, season: number): LeaseRecord | null {
  const raw = store.get(ledgerKeys.lease(season));
  if (raw === undefined) return null;
  const lease = decodeLeaseRecord(raw);
  if (lease === null || lease.season !== season) refuse('state-corrupt');
  return lease;
}

export function readSeasonRecord(
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

export function readClassification(
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

export function readClassifications(
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

export function readPublished(
  store: Store,
  season: number,
): PublishedReconciliation | null {
  const raw = store.get(ledgerKeys.published(season));
  if (raw === undefined) return null;
  const decoded = decodePublishedReconciliation(raw);
  if (decoded === null || decoded.season !== season) refuse('state-corrupt');
  return decoded;
}

export function backlogKey(entry: BacklogEntry): string {
  return ledgerKeys.backlog(entry.season, entry.round);
}

/** Every backlog entry, across every season. */
export function readBacklog(store: Store): BacklogEntry[] {
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

export function readSnapshot(
  store: Store,
  season: number,
  now: Date,
): LedgerSnapshot {
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
