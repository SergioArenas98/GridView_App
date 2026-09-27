/**
 * The published-revision cache is reconciled from the authoritative release,
 * and only from it. The ledger never refuses the authority's value, so it
 * cannot become a second publication authority.
 */

import { describe, expect, it } from 'vitest';

import {
  SEASON,
  START,
  classification,
  commitRequest,
  committedBytes,
  lease,
  ledgerFixture,
  rev,
  write,
} from './support';

async function seeded(rounds: number[], superseded: string[] = []) {
  const fixture = ledgerFixture();
  const token = await lease(fixture);
  const outcome = await fixture.ledger.commit(
    commitRequest(token, {
      classifications: rounds.map((round) =>
        write(classification(round, { supersededRevisions: superseded })),
      ),
    }),
  );
  expect(outcome.outcome).toBe('committed');
  return { fixture, token };
}

describe('reconciling from the authoritative release', () => {
  it('sets every record to the release revision, or none when the release has none', async () => {
    const { fixture, token } = await seeded([1, 2, 3]);

    const outcome = await fixture.ledger.reconcilePublishedRevisions({
      lease: token,
      activeVersion: 'v-release-1',
      revisions: [
        { round: 1, revision: rev('r1') },
        { round: 2, revision: rev('r2') },
        { round: 7, revision: rev('r7') },
      ],
    });

    expect(outcome.outcome).toBe('reconciled');
    if (outcome.outcome !== 'reconciled') return;
    expect(
      outcome.snapshot.classifications.map((entry) => [
        entry.record.round,
        entry.record.publishedRevision,
        entry.version,
      ]),
    ).toEqual([
      [1, rev('r1'), 2],
      [2, rev('r2'), 2],
      // Unchanged (null to null): no version bump.
      [3, null, 1],
    ]);
    expect(outcome.unrecordedRounds).toEqual([7]);
    expect(outcome.snapshot.published).toEqual({
      schemaVersion: 1,
      kind: 'published-reconciliation',
      season: SEASON,
      activeVersion: 'v-release-1',
      reconciledAt: START,
    });
  });

  it('follows the authority after a rollback, even to a revision the ledger superseded', async () => {
    const { fixture, token } = await seeded([1], [rev('older')]);
    await fixture.ledger.reconcilePublishedRevisions({
      lease: token,
      activeVersion: 'v-2',
      revisions: [{ round: 1, revision: rev('newer') }],
    });

    const outcome = await fixture.ledger.reconcilePublishedRevisions({
      lease: token,
      activeVersion: 'v-1',
      revisions: [{ round: 1, revision: rev('older') }],
    });
    expect(
      outcome.outcome === 'reconciled' &&
        outcome.snapshot.classifications[0]!.record.publishedRevision,
    ).toBe(rev('older'));
    // And a round the rolled-back release does not classify has none.
    const cleared = await fixture.ledger.reconcilePublishedRevisions({
      lease: token,
      activeVersion: 'v-0',
      revisions: [],
    });
    expect(
      cleared.outcome === 'reconciled' &&
        cleared.snapshot.classifications[0]!.record.publishedRevision,
    ).toBeNull();
  });

  it('keeps the reconciled value through later ordinary commits', async () => {
    const { fixture, token } = await seeded([1]);
    await fixture.ledger.reconcilePublishedRevisions({
      lease: token,
      activeVersion: 'v-1',
      revisions: [{ round: 1, revision: rev('r1') }],
    });

    // A commit that carries the reconciled value unchanged is accepted...
    expect(
      (
        await fixture.ledger.commit(
          commitRequest(token, {
            classifications: [
              write(
                classification(1, {
                  publishedRevision: rev('r1'),
                  checkIndex: 1,
                }),
                2,
              ),
            ],
          }),
        )
      ).outcome,
    ).toBe('committed');
    // ...and one that drops or replaces it is refused.
    for (const publishedRevision of [null, rev('other')]) {
      expect(
        await fixture.ledger.commit(
          commitRequest(token, {
            classifications: [
              write(classification(1, { publishedRevision }), 3),
            ],
          }),
        ),
      ).toEqual({
        outcome: 'rejected',
        reason: 'published-revision-not-reconciled',
      });
    }
  });

  it('refuses a malformed or duplicate release description, changing nothing', async () => {
    const { fixture, token } = await seeded([1]);
    const before = committedBytes(fixture.host);

    for (const [request, reason] of [
      [
        { lease: token, activeVersion: 'v:1', revisions: [] },
        'invalid-request',
      ],
      [
        {
          lease: token,
          activeVersion: 'v-1',
          revisions: [{ round: 1, revision: 'https://example.invalid' }],
        },
        'invalid-request',
      ],
      [
        {
          lease: token,
          activeVersion: 'v-1',
          revisions: [
            { round: 1, revision: rev('a') },
            { round: 1, revision: rev('b') },
          ],
        },
        'duplicate-record',
      ],
      [
        { lease: token, activeVersion: 'v-1', revisions: [], documents: [] },
        'invalid-request',
      ],
    ] as const) {
      expect(fixture.store.reconcilePublishedRevisions(request)).toEqual({
        outcome: 'rejected',
        reason,
      });
    }
    expect(committedBytes(fixture.host)).toBe(before);
  });
});
