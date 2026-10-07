/**
 * The publication half's pure rules, one at a time: the candidate digest
 * (O-12), the ordering input (O-13), curated metadata (O-14), the next-due
 * decision for every way a run can end, the store's ordering refusal, the
 * planner's drift trigger and the resolution of an unfinished publication.
 */

import { describe, expect, it } from 'vitest';

import {
  publicationReasons,
  type PublicationReason,
  type PublicationResult,
} from '../../../../src/publication/publisher';
import { MemorySnapshotStorage } from '../../../../src/storage/local';
import type { StoredSnapshot } from '../../../../src/storage/types';
import {
  publicationBlockReasons,
  type ClassificationRecord,
  type LedgerSnapshot,
  type SeasonRecord,
} from '../../../../src/sync/coordinated/ledger';
import {
  PUBLICATION_RETRY_MS,
  candidateDigest,
  curatedSeasonMetadata,
  nextOrderingInput,
  notApplied,
  recoverUnfinishedPublication,
  settleSeasonRecord,
  withheldByPolicy,
  withheldCandidate,
  type CandidateGap,
  type SettlementDecision,
} from '../../../../src/sync/coordinated/outcome';
import {
  planRun,
  releaseDrifted,
} from '../../../../src/sync/coordinated/policy';
import { FixedClock } from '../../../../src/runtime/clock';
import { generatedSet } from '../../../publication/sequenced/support';
import {
  classification,
  commitRequest,
  ledgerFixture,
  lease,
  rev,
  seasonRecord,
  write,
} from '../ledger/support';
import { anchorOf, quietSeason, snapshotOf } from '../policy/support';

const NOW = new Date('2026-09-28T10:17:00.000Z');
const at = (millis: number) => new Date(NOW.getTime() + millis).toISOString();

describe('the candidate digest (O-12)', () => {
  async function documents(
    generatedAt: string,
    overrides: { sourceUpdatedAt?: string; version?: string } = {},
  ): Promise<StoredSnapshot[]> {
    const set = await generatedSet(
      new FixedClock(new Date(generatedAt)),
      overrides.version ?? 'label-1',
      {
        sourceUpdatedAt:
          overrides.sourceUpdatedAt ?? '2026-07-01T00:00:00.000Z',
      },
    );
    return set.documents;
  }

  it('ignores generation time, source ordering, the release label and document order', async () => {
    const first = await documents('2026-07-20T12:00:00.000Z');
    const second = await documents('2026-08-01T00:00:00.000Z', {
      sourceUpdatedAt: '2026-07-31T00:00:00.000Z',
      version: 'label-2',
    });
    const digest = await candidateDigest(first);
    expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await candidateDigest(second)).toBe(digest);
    expect(await candidateDigest([...first].reverse())).toBe(digest);
  });

  it('changes with public content, and with a document gained or lost', async () => {
    const base = await documents('2026-07-20T12:00:00.000Z');
    const digest = await candidateDigest(base);
    const changed = base.map((document) =>
      document.documentName === 'season'
        ? {
            ...document,
            data: { ...(document.data as object), label: 'Another label' },
          }
        : document,
    );
    expect(await candidateDigest(changed)).not.toBe(digest);
    expect(await candidateDigest(base.slice(1))).not.toBe(digest);
  });
});

describe('the release-wide ordering input (O-13)', () => {
  it('is the observation instant when the clock moved forward', () => {
    expect(nextOrderingInput(NOW, null)).toBe(NOW.toISOString());
    expect(nextOrderingInput(NOW, at(-1))).toBe(NOW.toISOString());
  });

  it('is one millisecond past the last when the clock repeated or went backwards', () => {
    expect(nextOrderingInput(NOW, NOW.toISOString())).toBe(at(1));
    expect(nextOrderingInput(NOW, at(60_000))).toBe(at(60_001));
  });

  it('is refused by the store unless it strictly increases', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    const stored = seasonRecord({ lastOrderingInput: at(0) });
    expect(
      (
        await fixture.ledger.commit(
          commitRequest(token, { seasonRecord: write(stored) }),
        )
      ).outcome,
    ).toBe('committed');
    // Lowered or cleared: refused, and nothing changes.
    for (const lastOrderingInput of [at(-1), null]) {
      expect(
        await fixture.ledger.commit(
          commitRequest(token, {
            seasonRecord: write(seasonRecord({ lastOrderingInput }), 1),
          }),
        ),
      ).toEqual({ outcome: 'rejected', reason: 'ordering-input-regression' });
    }
    // Unchanged is not a reservation, so another write of the record may
    // carry it.
    expect(
      (
        await fixture.ledger.commit(
          commitRequest(token, {
            seasonRecord: write(
              seasonRecord({
                lastOrderingInput: at(0),
                publicationDueAt: at(5),
              }),
              1,
            ),
          }),
        )
      ).outcome,
    ).toBe('committed');
    expect(
      (
        await fixture.ledger.commit(
          commitRequest(token, {
            seasonRecord: write(seasonRecord({ lastOrderingInput: at(1) }), 2),
          }),
        )
      ).outcome,
    ).toBe('committed');
  });
});

describe('curated season metadata (O-14)', () => {
  it('reads the curated dataset version, the attribution record and the label', () => {
    expect(curatedSeasonMetadata(2026)).toEqual({
      contentVersion: '2026.10.07.1',
      mediaVersion: null,
      attributionVersion: 'data-sources-v1',
      seasonLabel: '2026 FIA Formula One World Championship',
    });
  });

  it('is absent for a season with no curated record, never guessed', () => {
    expect(curatedSeasonMetadata(2025)).toBeNull();
  });

  const record = {
    kind: 'season-metadata',
    season: 2026,
    datasetVersion: '2026.09.29.1',
    seasonLabel: null,
  };
  const attribution = {
    kind: 'data-source-attribution',
    version: 'data-sources-v2',
  };

  it('carries a null label and a later attribution version exactly', () => {
    expect(curatedSeasonMetadata(2026, [record], attribution)).toEqual({
      contentVersion: '2026.09.29.1',
      mediaVersion: null,
      attributionVersion: 'data-sources-v2',
      seasonLabel: null,
    });
  });

  it.each([
    ['a duplicated record', [record, record], attribution],
    [
      'a malformed dataset version',
      [{ ...record, datasetVersion: 'v1' }],
      attribution,
    ],
    ['an empty label', [{ ...record, seasonLabel: '' }], attribution],
    [
      'an over-long label',
      [{ ...record, seasonLabel: 'x'.repeat(121) }],
      attribution,
    ],
    [
      'a malformed attribution version',
      [record],
      { ...attribution, version: '1' },
    ],
    ['no attribution record', [record], null],
  ])('refuses %s', (_name, records, source) => {
    expect(curatedSeasonMetadata(2026, records, source)).toBeNull();
  });
});

describe('the next-due decision for every ending', () => {
  const result = (
    status: PublicationResult['status'],
    reason: PublicationReason | null,
  ): PublicationResult => ({
    status,
    season: 2026,
    version: 'pm1-0000000000001-00000001',
    previousVersion: null,
    reason,
    cachePurgeOk: true,
    cachePurge: 'not-required',
    pointerMaintenance: 'not-required',
    purgedUrls: [],
  });

  const blocking: readonly PublicationReason[] = [
    'guard-round-coverage-regression',
    'guard-participation-fact-removed',
    'guard-constructor-replaced',
    'guard-candidate-invalid',
    'guard-predecessor-invalid',
    'guard-authority-not-sequenced',
    'contract-validation',
  ];

  it('holds every guard, season and candidate refusal for an operator', () => {
    for (const reason of blocking) {
      expect(notApplied(result('rejected', reason))).toEqual({
        decision: 'blocked',
        reason,
      });
    }
  });

  it('keeps the reservation when the sequencer could not say whether it committed', () => {
    expect(
      notApplied(result('failed', 'sequencer-authority-unavailable')),
    ).toEqual({ decision: 'resolve' });
  });

  it('retries every other failure, including an older ordering input', () => {
    const retried = publicationReasons.filter(
      (reason) =>
        !blocking.includes(reason) &&
        reason !== 'sequencer-authority-unavailable',
    );
    expect(retried).toContain('older-source-updated-at');
    expect(retried).toContain('guard-predecessor-stale');
    for (const reason of retried) {
      expect(notApplied(result('failed', reason))).toEqual({
        decision: 'retry',
      });
    }
    expect(notApplied(result('failed', null))).toEqual({ decision: 'retry' });
  });

  it('names only closed block reasons the ledger can store', () => {
    for (const reason of blocking) {
      expect(publicationBlockReasons).toContain(reason);
    }
  });

  it('holds an unresolvable candidate, and retries a provider-shaped gap', () => {
    const gaps: Record<CandidateGap, SettlementDecision> = {
      'run-not-completed': { decision: 'retry' },
      'resource-unavailable': { decision: 'retry' },
      'missing-required-resource': { decision: 'retry' },
      'missing-round-classification': { decision: 'retry' },
      'standings-round-incoherent': { decision: 'retry' },
      'inconsistent-references': {
        decision: 'blocked',
        reason: 'inconsistent-references',
      },
      'generation-failed': { decision: 'blocked', reason: 'generation-failed' },
    };
    for (const [gap, decision] of Object.entries(gaps)) {
      expect(withheldCandidate(gap as CandidateGap)).toEqual(decision);
    }
  });

  it('holds a staged or locked record, waits for cadence, and retries a transient read', () => {
    expect(
      withheldByPolicy(['classification-pending', 'classification-staged'], []),
    ).toEqual({ decision: 'blocked', reason: 'classification-staged' });
    expect(withheldByPolicy(['classification-review-locked'], [])).toEqual({
      decision: 'blocked',
      reason: 'classification-review-locked',
    });
    expect(
      withheldByPolicy(
        ['classification-pending', 'classification-unaccepted'],
        [],
      ),
    ).toEqual({ decision: 'cadence', records: [] });
    expect(
      withheldByPolicy(
        ['classification-pending', 'season-resource-unavailable'],
        [],
      ),
    ).toEqual({ decision: 'retry' });
  });
});

describe('the outcome commit record', () => {
  const publishing: SeasonRecord = seasonRecord({
    publicationDueAt: null,
    publicationDisposition: {
      state: 'publishing',
      since: at(-60_000),
      digest: null,
      orderingInput: null,
    },
  });
  const settle = (
    decision: SettlementDecision,
    advancesSchedule = true,
    record: SeasonRecord = publishing,
  ) =>
    settleSeasonRecord({
      record,
      previous: null,
      decision,
      now: NOW,
      advancesSchedule,
    });

  it('retries in one hour, and a manual run moves no due time (O-8)', () => {
    expect(settle({ decision: 'retry' })).toMatchObject({
      publicationDisposition: null,
      publicationDueAt: at(PUBLICATION_RETRY_MS),
    });
    const due = seasonRecord({ publicationDueAt: at(5) });
    expect(
      settle({ decision: 'retry' }, false, {
        ...due,
        publicationDisposition: null,
      }),
    ).toMatchObject({ publicationDueAt: at(5) });
  });

  it('waits for the earliest next cadence check, never sooner than a retry', () => {
    const records = [
      classification(1, { nextDueAt: at(9 * 60 * 60 * 1000) }),
      classification(2, { nextDueAt: at(4 * 60 * 60 * 1000) }),
      classification(3, { nextDueAt: null }),
    ] as ClassificationRecord[];
    expect(settle({ decision: 'cadence', records }).publicationDueAt).toBe(
      at(4 * 60 * 60 * 1000),
    );
    const soon = [classification(1, { nextDueAt: at(60_000) })];
    expect(
      settle({ decision: 'cadence', records: soon as ClassificationRecord[] })
        .publicationDueAt,
    ).toBe(at(PUBLICATION_RETRY_MS));
    expect(settle({ decision: 'cadence', records: [] }).publicationDueAt).toBe(
      at(PUBLICATION_RETRY_MS),
    );
  });

  it('blocks with no due time, and a persisting block keeps when it began', () => {
    expect(
      settle({ decision: 'blocked', reason: 'classification-staged' }),
    ).toMatchObject({
      publicationDueAt: null,
      publicationDisposition: {
        state: 'blocked',
        since: NOW.toISOString(),
        reason: 'classification-staged',
      },
    });
    const kept = settleSeasonRecord({
      record: publishing,
      previous: {
        state: 'blocked',
        since: at(-86_400_000),
        reason: 'classification-staged',
      },
      decision: { decision: 'blocked', reason: 'classification-staged' },
      now: NOW,
      advancesSchedule: true,
    });
    expect(kept.publicationDisposition).toMatchObject({
      since: at(-86_400_000),
    });
  });

  it('records a publication, and a confirmation keeps when it was published', () => {
    const published = settle({
      decision: 'completed',
      release: { digest: rev('d'), activeVersion: 'pm1-a', published: true },
    });
    expect(published).toMatchObject({
      publicationDisposition: null,
      lastPublication: {
        digest: rev('d'),
        activeVersion: 'pm1-a',
        publishedAt: NOW.toISOString(),
        confirmedAt: NOW.toISOString(),
      },
    });
    const confirmed = settleSeasonRecord({
      record: {
        ...published,
        lastPublication: { ...published.lastPublication!, publishedAt: at(-1) },
      },
      previous: null,
      decision: {
        decision: 'completed',
        release: { digest: rev('d'), activeVersion: 'pm1-a', published: false },
      },
      now: NOW,
      advancesSchedule: true,
    });
    expect(confirmed.lastPublication).toMatchObject({
      publishedAt: at(-1),
      confirmedAt: NOW.toISOString(),
    });
  });

  it('never clears an earlier block on a retry or a cadence wait', () => {
    const held = {
      state: 'blocked',
      since: at(-86_400_000),
      reason: 'guard-participation-fact-removed',
    } as const;
    const records = [
      classification(1, { nextDueAt: at(4 * 60 * 60 * 1000) }),
    ] as ClassificationRecord[];
    for (const decision of [
      { decision: 'retry' },
      { decision: 'cadence', records },
    ] as SettlementDecision[]) {
      // A manual run moves no due time, so the block is the durable state.
      const manual = settleSeasonRecord({
        record: publishing,
        previous: held,
        decision,
        now: NOW,
        advancesSchedule: false,
      });
      expect(manual).toMatchObject({
        publicationDisposition: held,
        publicationDueAt: null,
      });
      // A scheduled run keeps the block and also sets its due time.
      const scheduled = settleSeasonRecord({
        record: publishing,
        previous: held,
        decision,
        now: NOW,
        advancesSchedule: true,
      });
      expect(scheduled.publicationDisposition).toEqual(held);
      expect(scheduled.publicationDueAt).not.toBeNull();
    }
    // A completion does resolve it.
    expect(
      settleSeasonRecord({
        record: publishing,
        previous: held,
        decision: {
          decision: 'completed',
          release: {
            digest: rev('d'),
            activeVersion: 'pm1-a',
            published: true,
          },
        },
        now: NOW,
        advancesSchedule: false,
      }).publicationDisposition,
    ).toBeNull();
  });

  it('leaves the reservation in place for an unknown commit', () => {
    expect(settle({ decision: 'resolve' })).toBe(publishing);
  });

  it('never writes a published revision', () => {
    for (const decision of [
      { decision: 'retry' },
      { decision: 'blocked', reason: 'metadata-unavailable' },
    ] as SettlementDecision[]) {
      expect(Object.keys(settle(decision)).sort()).toEqual(
        Object.keys(publishing).sort(),
      );
    }
  });
});

describe('the drift trigger', () => {
  const recorded = (
    activeVersion: string,
    overrides: Partial<SeasonRecord> = {},
  ): LedgerSnapshot => ({
    ...snapshotOf({
      season: quietSeason(
        [anchorOf(1, '2026-03-01T12:00:00.000Z')],
        '2027-01-01T00:00:00.000Z',
        {
          lastPublication: {
            digest: rev('d'),
            activeVersion: 'pm1-ours',
            publishedAt: '2026-01-01T00:00:00.000Z',
            confirmedAt: '2026-01-01T00:00:00.000Z',
          },
          ...overrides,
        },
      ),
    }),
    published: {
      schemaVersion: 1,
      kind: 'published-reconciliation',
      season: 2026,
      activeVersion,
      reconciledAt: '2026-01-02T00:00:00.000Z',
    },
  });
  const tick = new Date('2026-02-01T00:17:00.000Z');

  it('makes a publication due when the authority serves another release', () => {
    expect(releaseDrifted(recorded('pm1-ours'))).toBe(false);
    expect(releaseDrifted(recorded('pm1-theirs'))).toBe(true);
    expect(
      planRun({
        now: tick,
        snapshot: recorded('pm1-ours'),
        trigger: 'scheduled',
      }).kind,
    ).toBe('nothing-due');
    expect(
      planRun({
        now: tick,
        snapshot: recorded('pm1-theirs'),
        trigger: 'scheduled',
      }).kind,
    ).toBe('publication');
  });

  it('never retries a season held for an operator on drift alone', () => {
    const held = recorded('pm1-theirs', {
      publicationDisposition: {
        state: 'blocked',
        since: '2026-01-01T00:00:00.000Z',
        reason: 'guard-participation-fact-removed',
      },
    });
    expect(releaseDrifted(held)).toBe(false);
    expect(
      planRun({ now: tick, snapshot: held, trigger: 'scheduled' }).kind,
    ).toBe('nothing-due');
  });

  it('has nothing to compare before the first coordinated publication', () => {
    expect(
      releaseDrifted(recorded('pm1-theirs', { lastPublication: null })),
    ).toBe(false);
  });
});

describe('resolving an unfinished publication', () => {
  const since = '2026-09-28T09:17:01.300Z';
  const record = (
    digest: string | null,
    orderingInput: string | null,
    publicationDueAt: string | null = null,
  ): SeasonRecord =>
    seasonRecord({
      publicationDueAt,
      publicationDisposition: {
        state: 'publishing',
        since,
        digest,
        orderingInput,
      },
    });
  const storage = async (
    sidecar: unknown | Error,
  ): Promise<MemorySnapshotStorage> => {
    const memory = new MemorySnapshotStorage();
    return Object.assign(Object.create(memory) as MemorySnapshotStorage, {
      readPublicationMetadata: async () => {
        if (sidecar instanceof Error) throw sidecar;
        return sidecar;
      },
    });
  };
  const resolve = async (input: SeasonRecord | null, sidecar: unknown) =>
    recoverUnfinishedPublication({
      record: input,
      activeVersion: 'pm1-active',
      storage: await storage(sidecar),
      now: NOW,
    });
  const sidecarFor = (sourceOrderingInput: string) => ({
    schemaVersion: 1,
    sourceOrderingInput,
  });

  it('does nothing without a publishing slot', async () => {
    expect(await resolve(null, null)).toEqual({ kind: 'none' });
    expect(await resolve(seasonRecord(), null)).toEqual({ kind: 'none' });
  });

  it('makes a publication that never reached the publisher due again', async () => {
    const resolved = await resolve(record(null, null), null);
    expect(resolved).toMatchObject({
      kind: 'resolved',
      resolution: 'not-reached',
      record: { publicationDisposition: null, publicationDueAt: since },
    });
    // An earlier due time is kept.
    const earlier = await resolve(
      record(null, null, '2026-09-28T08:00:00.000Z'),
      null,
    );
    expect(earlier).toMatchObject({
      record: { publicationDueAt: '2026-09-28T08:00:00.000Z' },
    });
  });

  it('recognizes the release whose sidecar carries the reserved ordering input', async () => {
    const resolved = await resolve(
      record(rev('d'), '2026-09-28T09:17:01.300Z'),
      sidecarFor('2026-09-28T09:17:01.300Z'),
    );
    expect(resolved).toMatchObject({
      kind: 'resolved',
      resolution: 'published',
      record: {
        publicationDisposition: null,
        publicationDueAt: null,
        lastPublication: {
          digest: rev('d'),
          activeVersion: 'pm1-active',
          publishedAt: NOW.toISOString(),
          confirmedAt: NOW.toISOString(),
        },
      },
    });
  });

  it('makes the publication due when the serving release is another one', async () => {
    for (const sidecar of [
      sidecarFor('2026-09-28T09:17:01.299Z'),
      null,
      { schemaVersion: 1 },
    ]) {
      expect(
        await resolve(record(rev('d'), '2026-09-28T09:17:01.300Z'), sidecar),
      ).toMatchObject({
        resolution: 'not-published',
        record: { publicationDisposition: null, publicationDueAt: since },
      });
    }
  });

  it('fails closed, keeping the slot, when the sidecar cannot be read', async () => {
    expect(
      await resolve(
        record(rev('d'), '2026-09-28T09:17:01.300Z'),
        new Error('storage down'),
      ),
    ).toEqual({ kind: 'unreadable' });
  });
});
