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
  ledgerKeys,
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
    contentRevision: null,
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
    lastDisposition: null,
    verifications: [],
    ...overrides,
  } as ClassificationRecord;
}

/**
 * A settled record holding a staged correction of `revision`: the only kind
 * of record a backlog entry may be inserted with (D2.5).
 */
export function stagedClassification(
  round: number,
  revision: string,
  season = SEASON,
  overrides: Partial<Record<keyof ClassificationRecord, unknown>> = {},
): ClassificationRecord {
  return classification(
    round,
    {
      contentRevision: rev(`content-${round}`),
      provenance: 'reconciled',
      reviewState: 'settled',
      terminalReason: 'settled',
      settledAt: '2026-03-22T04:00:00.000Z',
      nextDueAt: null,
      markers: ['staged'],
      stagedCorrection: {
        revision,
        firstSeenAt: '2026-04-01T04:00:00.000Z',
        uncorroborated: false,
      },
      ...overrides,
    },
    season,
  );
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
    calendarAnchors: null,
    lastOrderingInput: null,
    lastPublication: null,
    publicationDisposition: null,
    operatorHold: null,
    durableBlock: null,
    lastOperatorAction: null,
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

/**
 * Writes `record` straight into storage at `version`, bypassing the store.
 *
 * Only for a state that only the `verify` operation can reach - a competing
 * correction, which `commit` refuses to create - so a test of something else
 * (a disposition, an inspection) does not depend on verification. The
 * verification tests reach it through `verify` itself.
 */
export function plantClassification(
  host: MemorySequencerHost,
  record: ClassificationRecord,
  version = 1,
): void {
  host.transactionSync((store) =>
    store.put(ledgerKeys.classification(record.season, record.round), {
      version,
      record,
    }),
  );
}

/** Every committed key and value, serialized, for byte-for-byte comparison. */
export function committedBytes(host: MemorySequencerHost): string {
  return JSON.stringify(
    host.committedKeys().map((key) => [key, host.peek(key)]),
  );
}
