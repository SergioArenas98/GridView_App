/**
 * Shared fixtures for the reconciliation ledger storage tests.
 *
 * Every ledger here runs over the in-memory transactional host, with a clock
 * the test moves explicitly. Nothing contacts Cloudflare or a provider.
 */

import { createHash } from 'node:crypto';

import { MemorySequencerHost } from '../../../../src/publication/sequencer/hosts';
import {
  LEDGER_SCHEMA_VERSION,
  LocalReconciliationLedger,
  ReconciliationLedgerStore,
  type ClassificationRecord,
  type ConditionalWrite,
  type LeaseToken,
  type LedgerCommitRequest,
  type SeasonRecord,
} from '../../../../src/sync/coordinated/ledger';
import { MutableClock } from '../../../publication/sequencer/support';

export const SEASON = 2026;
export const OTHER_SEASON = 2025;
export const START = '2026-09-27T12:00:00.000Z';

/** A deterministic `sha256:` revision for a seed. */
export function rev(seed: string): string {
  return `sha256:${createHash('sha256').update(seed).digest('hex')}`;
}

export function classification(
  round: number,
  overrides: Partial<Record<keyof ClassificationRecord, unknown>> = {},
  season = SEASON,
): ClassificationRecord {
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    kind: 'classification',
    season,
    round,
    sessionType: 'race',
    anchor: '2026-03-08T04:00:00.000Z',
    anchorKind: 'date-time',
    checkIndex: 0,
    lastAttemptedAt: null,
    lastSuccessfulObservationAt: null,
    nextDueAt: '2026-03-08T09:00:00.000Z',
    limiterDeferralUntil: null,
    publishedRevision: null,
    candidateRevision: null,
    candidateFirstSeenAt: null,
    consecutiveConfirmations: 0,
    provenance: 'absent',
    reviewState: 'absent',
    markers: [],
    stagedCorrection: null,
    competingCorrection: null,
    supersededRevisions: [],
    sourceObservedAt: null,
    settledAt: null,
    terminalReason: null,
    lastSweptAt: null,
    lastPriorityAttemptAt: null,
    unstableSightings: 0,
    ...overrides,
  } as ClassificationRecord;
}

const emptyRefresh = {
  observedRevision: null,
  lastAttemptedAt: null,
  lastSuccessAt: null,
  nextDueAt: null,
};

export function seasonRecord(
  overrides: Partial<Record<keyof SeasonRecord, unknown>> = {},
  season = SEASON,
): SeasonRecord {
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    kind: 'season',
    season,
    refresh: {
      calendar: { ...emptyRefresh },
      circuits: { ...emptyRefresh },
      'constructor-standings': { ...emptyRefresh },
      'driver-standings': { ...emptyRefresh },
      participants: { ...emptyRefresh },
    },
    publicationDueAt: null,
    ...overrides,
  } as SeasonRecord;
}

export function write<T>(record: T, expectedVersion = 0): ConditionalWrite<T> {
  return { expectedVersion, record };
}

/** A commit request with nothing in it but the lease. */
export function commitRequest(
  lease: LeaseToken,
  parts: Partial<Omit<LedgerCommitRequest, 'lease'>> = {},
): LedgerCommitRequest {
  return {
    lease,
    seasonRecord: null,
    classifications: [],
    backlogInsertions: [],
    backlogRemovals: [],
    ...parts,
  };
}

export interface LedgerFixture {
  readonly host: MemorySequencerHost;
  readonly clock: MutableClock;
  readonly store: ReconciliationLedgerStore;
  readonly ledger: LocalReconciliationLedger;
}

export function ledgerFixture(
  host: MemorySequencerHost = new MemorySequencerHost(),
  clock: MutableClock = new MutableClock(new Date(START)),
): LedgerFixture {
  const store = new ReconciliationLedgerStore(host, { clock });
  return { host, clock, store, ledger: new LocalReconciliationLedger(store) };
}

/** Acquires a lease, failing the test if it is refused. */
export async function lease(
  fixture: LedgerFixture,
  season = SEASON,
): Promise<LeaseToken> {
  const outcome = await fixture.ledger.acquireLease(season);
  if (outcome.outcome !== 'acquired') {
    throw new Error(`lease refused: ${JSON.stringify(outcome)}`);
  }
  return { season: outcome.lease.season, fence: outcome.lease.fence };
}

/** Every committed key and value, serialized, for byte-for-byte comparison. */
export function committedBytes(host: MemorySequencerHost): string {
  return JSON.stringify(
    host.committedKeys().map((key) => [key, host.peek(key)]),
  );
}
