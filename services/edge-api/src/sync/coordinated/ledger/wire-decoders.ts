/**
 * Strict decoding of what the ledger object answers.
 *
 * The client decodes every answer as strictly as storage decodes what it
 * holds: a response that does not describe the requested season, or that
 * carries any value outside the model, is never acted on.
 */

import {
  BACKLOG_CAPACITY,
  MAXIMUM_ROUND,
  ledgerRejectionReasons,
  type BacklogEntry,
  type ClassificationRecord,
  type LeaseGrant,
  type LedgerRejectionReason,
  type LedgerSnapshot,
  type PublishedReconciliation,
  type SeasonRecord,
  type Versioned,
} from './model';
import {
  decodeBacklogEntry,
  decodeClassificationRecord,
  decodePublishedReconciliation,
  decodeSeasonRecord,
  decodeVersioned,
  hasExactLedgerKeys as hasExactKeys,
  isBoundedInteger,
  isFence,
  isLedgerInstant,
  isLedgerObject as isObject,
  isOneOf,
  isRound,
} from './records';

export function isLedgerRejectionReason(
  value: unknown,
): value is LedgerRejectionReason {
  return isOneOf(ledgerRejectionReasons, value);
}

const snapshotKeys = [
  'season',
  'seasonRecord',
  'classifications',
  'published',
  'lease',
  'backlog',
] as const;
const leaseViewKeys = ['fence', 'state', 'expiresAt'] as const;
const backlogViewKeys = ['count', 'capacity', 'entries'] as const;

/**
 * A snapshot as the object answered it, decoded as strictly as storage: a
 * response that does not describe the requested season is never acted on.
 */
export function decodeSnapshot(
  value: unknown,
  season: number,
): LedgerSnapshot | null {
  if (!isObject(value) || !hasExactKeys(value, snapshotKeys)) return null;
  if (value.season !== season) return null;

  let seasonRecord: Versioned<SeasonRecord> | null = null;
  if (value.seasonRecord !== null) {
    seasonRecord = decodeVersioned(value.seasonRecord, decodeSeasonRecord);
    if (seasonRecord === null || seasonRecord.record.season !== season) {
      return null;
    }
  }

  if (
    !Array.isArray(value.classifications) ||
    value.classifications.length > MAXIMUM_ROUND
  ) {
    return null;
  }
  const classifications: Versioned<ClassificationRecord>[] = [];
  let previousRound = 0;
  for (const entry of value.classifications) {
    const decoded = decodeVersioned(entry, decodeClassificationRecord);
    if (
      decoded === null ||
      decoded.record.season !== season ||
      decoded.record.round <= previousRound
    ) {
      return null;
    }
    previousRound = decoded.record.round;
    classifications.push(decoded);
  }

  let published: PublishedReconciliation | null = null;
  if (value.published !== null) {
    published = decodePublishedReconciliation(value.published);
    if (published === null || published.season !== season) return null;
  }

  let lease: LedgerSnapshot['lease'] = null;
  if (value.lease !== null) {
    const view = value.lease;
    if (
      !isObject(view) ||
      !hasExactKeys(view, leaseViewKeys) ||
      !isFence(view.fence) ||
      !isOneOf(['held', 'released', 'expired'] as const, view.state) ||
      !isLedgerInstant(view.expiresAt)
    ) {
      return null;
    }
    lease = { fence: view.fence, state: view.state, expiresAt: view.expiresAt };
  }

  const backlog = value.backlog;
  if (
    !isObject(backlog) ||
    !hasExactKeys(backlog, backlogViewKeys) ||
    !isBoundedInteger(backlog.count, 0, BACKLOG_CAPACITY) ||
    backlog.capacity !== BACKLOG_CAPACITY ||
    !Array.isArray(backlog.entries) ||
    backlog.entries.length > backlog.count
  ) {
    return null;
  }
  const entries: BacklogEntry[] = [];
  for (const entry of backlog.entries) {
    const decoded = decodeBacklogEntry(entry);
    if (
      decoded === null ||
      decoded.season !== season ||
      decoded.round <= (entries.at(-1)?.round ?? 0)
    ) {
      return null;
    }
    entries.push(decoded);
  }

  return {
    season,
    seasonRecord,
    classifications,
    published,
    lease,
    backlog: { count: backlog.count, capacity: BACKLOG_CAPACITY, entries },
  };
}

const grantKeys = ['season', 'fence', 'expiresAt'] as const;

export function decodeLeaseGrant(
  value: unknown,
  season: number,
): LeaseGrant | null {
  if (!isObject(value) || !hasExactKeys(value, grantKeys)) return null;
  if (
    value.season !== season ||
    !isFence(value.fence) ||
    !isLedgerInstant(value.expiresAt)
  ) {
    return null;
  }
  return { season, fence: value.fence, expiresAt: value.expiresAt };
}

export function decodeRounds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length > MAXIMUM_ROUND) return null;
  const rounds: number[] = [];
  for (const round of value) {
    if (!isRound(round) || (rounds.length > 0 && round <= rounds.at(-1)!)) {
      return null;
    }
    rounds.push(round);
  }
  return rounds;
}
