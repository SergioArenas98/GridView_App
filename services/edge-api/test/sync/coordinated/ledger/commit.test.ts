/**
 * Conditional commits: versioned compare-and-set, the append-only revision
 * history, the published-revision cache rule, all-or-nothing application and
 * storage restart.
 */

import { describe, expect, it } from 'vitest';

import type { SequencerRecordStore } from '../../../../src/publication/sequencer/store';
import {
  SUPERSEDED_REVISION_CAPACITY,
  ledgerKeys,
  type LedgerCommitOutcome,
} from '../../../../src/sync/coordinated/ledger';
import {
  SEASON,
  classification,
  commitRequest,
  committedBytes,
  lease,
  ledgerFixture,
  rev,
  seasonRecord,
  write,
} from './support';

function committed(outcome: LedgerCommitOutcome) {
  if (outcome.outcome !== 'committed') {
    throw new Error(`commit refused: ${JSON.stringify(outcome)}`);
  }
  return outcome.snapshot;
}

const history = (count: number, prefix = 'old') =>
  Array.from({ length: count }, (_, index) => rev(`${prefix}-${index}`));

describe('conditional updates', () => {
  it('creates at version 1 and advances one version per write', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);

    const first = committed(
      await fixture.ledger.commit(
        commitRequest(token, {
          seasonRecord: write(seasonRecord()),
          classifications: [write(classification(2)), write(classification(1))],
        }),
      ),
    );
    expect(first.seasonRecord?.version).toBe(1);
    expect(
      first.classifications.map((entry) => [entry.record.round, entry.version]),
    ).toEqual([
      [1, 1],
      [2, 1],
    ]);

    const second = committed(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [write(classification(1, { checkIndex: 1 }), 1)],
        }),
      ),
    );
    expect(second.classifications[0]).toEqual({
      version: 2,
      record: classification(1, { checkIndex: 1 }),
    });
  });

  it('refuses a create over an existing record and a write naming a stale version', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await fixture.ledger.commit(
      commitRequest(token, {
        seasonRecord: write(seasonRecord()),
        classifications: [write(classification(1))],
      }),
    );
    await fixture.ledger.commit(
      commitRequest(token, {
        classifications: [write(classification(1, { checkIndex: 1 }), 1)],
      }),
    );
    const before = committedBytes(fixture.host);

    for (const request of [
      commitRequest(token, { classifications: [write(classification(1))] }),
      commitRequest(token, {
        classifications: [write(classification(1, { checkIndex: 2 }), 1)],
      }),
      commitRequest(token, {
        classifications: [write(classification(1, { checkIndex: 2 }), 3)],
      }),
      commitRequest(token, {
        classifications: [write(classification(5, { checkIndex: 2 }), 1)],
      }),
      commitRequest(token, { seasonRecord: write(seasonRecord()) }),
      commitRequest(token, { seasonRecord: write(seasonRecord(), 2) }),
    ]) {
      expect(await fixture.ledger.commit(request)).toEqual({
        outcome: 'rejected',
        reason: 'version-conflict',
      });
      expect(committedBytes(fixture.host)).toBe(before);
    }
  });

  it('never lets a writer overwrite a newer version it did not read', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    const created = committed(
      await fixture.ledger.commit(
        commitRequest(token, { classifications: [write(classification(1))] }),
      ),
    );
    const readVersion = created.classifications[0]!.version;

    // One write lands on the version both read...
    committed(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [
            write(classification(1, { checkIndex: 1 }), readVersion),
          ],
        }),
      ),
    );
    // ...and the other, based on the same read, is refused.
    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [
            write(classification(1, { checkIndex: 9 }), readVersion),
          ],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'version-conflict' });
    const read = await fixture.ledger.readSeason(SEASON);
    expect(
      read.outcome === 'read' &&
        read.snapshot.classifications[0]!.record.checkIndex,
    ).toBe(1);
  });
});

describe('all or nothing', () => {
  it('applies no write when the last one in a request conflicts', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await fixture.ledger.commit(
      commitRequest(token, { classifications: [write(classification(3))] }),
    );
    const before = committedBytes(fixture.host);

    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          seasonRecord: write(seasonRecord()),
          classifications: [
            write(classification(1)),
            write(classification(2)),
            write(classification(3)),
          ],
          backlogInsertions: [{ round: 1, revision: rev('staged') }],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'version-conflict' });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('discards every write when storage fails partway through a commit', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    const before = committedBytes(fixture.host);

    // Fail the second storage write inside the transaction.
    const host = fixture.host;
    const original = host.transactionSync.bind(host);
    let puts = 0;
    host.transactionSync = <T>(run: (store: SequencerRecordStore) => T): T =>
      original((store) =>
        run({
          ...store,
          put: (key, value) => {
            puts += 1;
            if (puts === 2) throw new Error('storage write failed');
            store.put(key, value);
          },
        }),
      );

    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [write(classification(1)), write(classification(2))],
        }),
      ),
    ).toEqual({ outcome: 'unavailable' });
    expect(puts).toBe(2);
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('reports an invalid clock as unavailable and writes nothing', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    const before = committedBytes(fixture.host);
    fixture.clock.set('not a date');

    expect(
      await fixture.ledger.commit(
        commitRequest(token, { classifications: [write(classification(1))] }),
      ),
    ).toEqual({ outcome: 'unavailable' });
    expect(committedBytes(fixture.host)).toBe(before);
  });
});

describe('the superseded-revision history', () => {
  async function withRecord(superseded: string[]) {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    committed(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [
            write(classification(1, { supersededRevisions: superseded })),
          ],
        }),
      ),
    );
    return { fixture, token };
  }

  it('appends up to its capacity', async () => {
    const { fixture, token } = await withRecord(
      history(SUPERSEDED_REVISION_CAPACITY - 1),
    );
    const snapshot = committed(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [
            write(
              classification(1, {
                supersededRevisions: history(SUPERSEDED_REVISION_CAPACITY),
              }),
              1,
            ),
          ],
        }),
      ),
    );
    expect(
      snapshot.classifications[0]!.record.supersededRevisions,
    ).toHaveLength(SUPERSEDED_REVISION_CAPACITY);
  });

  it('refuses an insertion past its capacity, and never evicts to make room', async () => {
    const { fixture, token } = await withRecord(
      history(SUPERSEDED_REVISION_CAPACITY),
    );
    const before = committedBytes(fixture.host);

    // Past the capacity.
    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [
            write(
              classification(1, {
                supersededRevisions: [
                  ...history(SUPERSEDED_REVISION_CAPACITY),
                  rev('newest'),
                ],
              }),
              1,
            ),
          ],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'revision-history-capacity' });
    // FIFO eviction of the oldest to fit the newest.
    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [
            write(
              classification(1, {
                supersededRevisions: [
                  ...history(SUPERSEDED_REVISION_CAPACITY).slice(1),
                  rev('newest'),
                ],
              }),
              1,
            ),
          ],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'revision-history-rewrite' });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('refuses dropping, reordering or replacing a stored revision', async () => {
    const { fixture, token } = await withRecord(history(3));
    const before = committedBytes(fixture.host);
    const [a, b, c] = history(3) as [string, string, string];

    for (const rewritten of [[a, b], [b, a, c], [a, b, rev('other')], []]) {
      expect(
        await fixture.ledger.commit(
          commitRequest(token, {
            classifications: [
              write(classification(1, { supersededRevisions: rewritten }), 1),
            ],
          }),
        ),
      ).toEqual({ outcome: 'rejected', reason: 'revision-history-rewrite' });
    }
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('never lets an evicted-then-forgotten revision be applied again', async () => {
    const { fixture, token } = await withRecord(
      history(SUPERSEDED_REVISION_CAPACITY),
    );
    const oldest = history(1)[0]!;
    const before = committedBytes(fixture.host);

    // The only way to forget it is eviction, which is refused; and while it is
    // remembered, no slot may hold it.
    for (const overrides of [
      {
        candidateRevision: oldest,
        candidateFirstSeenAt: '2026-09-27T12:00:00.000Z',
      },
      {
        stagedCorrection: {
          revision: oldest,
          firstSeenAt: '2026-09-27T12:00:00.000Z',
          uncorroborated: true,
        },
      },
      {
        competingCorrection: {
          revision: oldest,
          firstSeenAt: '2026-09-27T12:00:00.000Z',
          uncorroborated: true,
        },
      },
    ]) {
      expect(
        await fixture.ledger.commit(
          commitRequest(token, {
            classifications: [
              write(
                classification(1, {
                  supersededRevisions: history(SUPERSEDED_REVISION_CAPACITY),
                  ...overrides,
                }),
                1,
              ),
            ],
          }),
        ),
      ).toEqual({
        outcome: 'rejected',
        reason: 'superseded-revision-reapplied',
      });
    }
    expect(committedBytes(fixture.host)).toBe(before);
  });
});

describe('the published revision is a cache of the authority', () => {
  it('cannot be set by an ordinary commit, on create or on update', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [
            write(classification(1, { publishedRevision: rev('claimed') })),
          ],
        }),
      ),
    ).toEqual({
      outcome: 'rejected',
      reason: 'published-revision-not-reconciled',
    });

    committed(
      await fixture.ledger.commit(
        commitRequest(token, { classifications: [write(classification(1))] }),
      ),
    );
    const before = committedBytes(fixture.host);
    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [
            write(classification(1, { publishedRevision: rev('claimed') }), 1),
          ],
        }),
      ),
    ).toEqual({
      outcome: 'rejected',
      reason: 'published-revision-not-reconciled',
    });
    expect(committedBytes(fixture.host)).toBe(before);
  });
});

describe('storage restart', () => {
  it('reads back every committed record, version and entry after a restart', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    const snapshot = committed(
      await fixture.ledger.commit(
        commitRequest(token, {
          seasonRecord: write(
            seasonRecord({ publicationDueAt: '2026-09-27T13:17:00.000Z' }),
          ),
          classifications: [
            write(classification(1, { supersededRevisions: history(2) })),
            write(classification(2)),
          ],
          backlogInsertions: [{ round: 2, revision: rev('staged') }],
        }),
      ),
    );

    const restarted = ledgerFixture(fixture.host.restart(), fixture.clock);
    const read = await restarted.ledger.readSeason(SEASON);
    expect(read).toEqual({ outcome: 'read', snapshot });

    // Conditional updates continue from the persisted versions.
    expect(
      (
        await restarted.ledger.commit(
          commitRequest(token, {
            classifications: [write(classification(2, { checkIndex: 1 }), 1)],
          }),
        )
      ).outcome,
    ).toBe('committed');
  });

  it('stores only closed, bounded values under the documented keys', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    committed(
      await fixture.ledger.commit(
        commitRequest(token, {
          seasonRecord: write(seasonRecord()),
          classifications: [write(classification(1))],
          backlogInsertions: [{ round: 1, revision: rev('staged') }],
        }),
      ),
    );
    await fixture.ledger.reconcilePublishedRevisions({
      lease: token,
      activeVersion: 'v-1',
      revisions: [{ round: 1, revision: rev('published') }],
    });

    expect(fixture.host.committedKeys()).toEqual(
      [
        ledgerKeys.backlog(SEASON, 1),
        ledgerKeys.classification(SEASON, 1),
        ledgerKeys.lease(SEASON),
        ledgerKeys.published(SEASON),
        ledgerKeys.season(SEASON),
      ].sort(),
    );
    const bytes = committedBytes(fixture.host);
    for (const forbidden of [
      'http',
      'MRData',
      'Bearer',
      'givenName',
      'headers',
    ]) {
      expect(bytes).not.toContain(forbidden);
    }
  });
});
