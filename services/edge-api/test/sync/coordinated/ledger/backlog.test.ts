/**
 * The operator-review backlog: a global capacity of 60 across seasons,
 * enforced atomically, with no eviction (ADR 0020 §4, obligation 2).
 */

import { describe, expect, it } from 'vitest';

import {
  BACKLOG_CAPACITY,
  LEDGER_SCHEMA_VERSION,
  ledgerKeys,
  type LeaseToken,
} from '../../../../src/sync/coordinated/ledger';
import {
  OTHER_SEASON,
  SEASON,
  classification,
  commitRequest,
  committedBytes,
  lease,
  ledgerFixture,
  rev,
  stagedClassification,
  write,
  type LedgerFixture,
} from './support';

const OPERATION = '4f7c1e2a-9b3d-4c5e-8f6a-1b2c3d4e5f60';

/** Inserts `count` entries for `season`, one classification round each. */
async function fill(
  fixture: LedgerFixture,
  token: LeaseToken,
  count: number,
  label: string,
) {
  const rounds = Array.from({ length: count }, (_, index) => index + 1);
  const outcome = await fixture.ledger.commit(
    commitRequest(token, {
      classifications: rounds.map((round) =>
        write(
          stagedClassification(round, rev(`${label}-${round}`), token.season),
        ),
      ),
      backlogInsertions: rounds.map((round) => ({
        round,
        revision: rev(`${label}-${round}`),
      })),
    }),
  );
  expect(outcome.outcome).toBe('committed');
}

describe('the global backlog capacity', () => {
  it('is 60', () => {
    expect(BACKLOG_CAPACITY).toBe(60);
  });

  it('counts entries across seasons and refuses the sixty-first', async () => {
    const fixture = ledgerFixture();
    const current = await lease(fixture, SEASON);
    const other = await lease(fixture, OTHER_SEASON);
    await fill(fixture, other, 35, 'other');
    await fill(fixture, current, 25, 'current');
    const before = committedBytes(fixture.host);

    const read = await fixture.ledger.readSeason(SEASON);
    expect(read.outcome === 'read' && read.snapshot.backlog.count).toBe(60);
    expect(
      read.outcome === 'read' && read.snapshot.backlog.entries,
    ).toHaveLength(25);

    // A new classification and its entry arrive together: neither is written.
    expect(
      await fixture.ledger.commit(
        commitRequest(current, {
          classifications: [
            write(stagedClassification(26, rev('sixty-first'))),
          ],
          backlogInsertions: [{ round: 26, revision: rev('sixty-first') }],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'backlog-capacity-exceeded' });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('refuses a batch that would cross the capacity, applying none of it', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await fill(fixture, token, 58, 'first');
    const before = committedBytes(fixture.host);

    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [59, 60, 61].map((round) =>
            write(stagedClassification(round, rev(`staged-${round}`))),
          ),
          backlogInsertions: [59, 60, 61].map((round) => ({
            round,
            revision: rev(`staged-${round}`),
          })),
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'backlog-capacity-exceeded' });
    expect(committedBytes(fixture.host)).toBe(before);

    // Exactly up to the capacity is admitted.
    expect(
      (
        await fixture.ledger.commit(
          commitRequest(token, {
            classifications: [59, 60].map((round) =>
              write(stagedClassification(round, rev(`staged-${round}`))),
            ),
            backlogInsertions: [59, 60].map((round) => ({
              round,
              revision: rev(`staged-${round}`),
            })),
          }),
        )
      ).outcome,
    ).toBe('committed');
  });

  it('never evicts: a refused insertion leaves every existing entry in place', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await fill(fixture, token, 60, 'full');
    const entries = () =>
      fixture.host.committedKeys().filter((key) => key.startsWith('backlog:'));
    const kept = entries();

    fixture.clock.advance(365 * 24 * 60 * 60 * 1000);
    const renewed = await lease(fixture);
    expect(
      await fixture.ledger.commit(
        commitRequest(renewed, {
          classifications: [write(stagedClassification(61, rev('newer')))],
          backlogInsertions: [{ round: 61, revision: rev('newer') }],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'backlog-capacity-exceeded' });
    // Age deletes nothing either.
    expect(entries()).toEqual(kept);
  });

  it('releases capacity only through a T12 disposition, never a commit', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await fill(fixture, token, 60, 'full');
    const before = committedBytes(fixture.host);

    // An ordinary commit cannot remove an entry, even to make room (D2.5).
    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [write(stagedClassification(61, rev('next')))],
          backlogRemovals: [{ round: 1, revision: rev('full-1') }],
          backlogInsertions: [{ round: 61, revision: rev('next') }],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'staged-correction-immutable' });
    expect(committedBytes(fixture.host)).toBe(before);

    // Disposing of one resource frees exactly one slot, which another takes.
    const disposed = await fixture.ledger.dispose({
      lease: token,
      round: 1,
      action: 'retain-published',
      operationId: OPERATION,
      authMethod: 'shared-admin-token',
      expected: {
        recordVersion: 1,
        contentRevision: rev('content-1'),
        stagedRevision: rev('full-1'),
        competingRevision: null,
      },
    });
    expect(
      disposed.outcome === 'applied' && disposed.snapshot.backlog.count,
    ).toBe(59);
    expect(
      (
        await fixture.ledger.commit(
          commitRequest(token, {
            classifications: [write(stagedClassification(61, rev('next')))],
            backlogInsertions: [{ round: 61, revision: rev('next') }],
          }),
        )
      ).outcome,
    ).toBe('committed');
    const read = await fixture.ledger.readSeason(SEASON);
    expect(read.outcome === 'read' && read.snapshot.backlog.count).toBe(60);
  });

  it('treats storage holding more than the capacity as corruption', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await fill(fixture, token, 60, 'full');
    fixture.host.poke(ledgerKeys.backlog(SEASON, 61), {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      kind: 'backlog-entry',
      season: SEASON,
      round: 61,
      revision: rev('smuggled'),
      enteredAt: '2026-09-27T12:00:00.000Z',
    });
    expect(await fixture.ledger.readSeason(SEASON)).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
  });
});

describe('backlog entries', () => {
  it('holds at most one entry per classification resource, whatever the revision', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await fill(fixture, token, 1, 'one');
    const before = committedBytes(fixture.host);

    // Repeated commits naming new revisions for the same resource cannot
    // take a second slot, so one resource can never exhaust the capacity.
    for (const label of ['second', 'third']) {
      expect(
        await fixture.ledger.commit(
          commitRequest(token, {
            backlogInsertions: [{ round: 1, revision: rev(label) }],
          }),
        ),
      ).toEqual({ outcome: 'rejected', reason: 'backlog-duplicate' });
    }
    expect(committedBytes(fixture.host)).toBe(before);
    const read = await fixture.ledger.readSeason(SEASON);
    expect(read.outcome === 'read' && read.snapshot.backlog.count).toBe(1);

    // The other 59 slots stay available to other resources.
    const others = Array.from({ length: 59 }, (_, index) => index + 2);
    expect(
      (
        await fixture.ledger.commit(
          commitRequest(token, {
            classifications: others.map((round) =>
              write(stagedClassification(round, rev(`other-${round}`))),
            ),
            backlogInsertions: others.map((round) => ({
              round,
              revision: rev(`other-${round}`),
            })),
          }),
        )
      ).outcome,
    ).toBe('committed');
  });

  it('refuses a duplicate entry, any removal and an orphan, changing nothing', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await fill(fixture, token, 1, 'one');
    const before = committedBytes(fixture.host);

    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          backlogInsertions: [{ round: 1, revision: rev('one-1') }],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'backlog-duplicate' });
    // A removal is refused whether or not it names a real entry: only T12
    // releases one.
    for (const removal of [
      { round: 1, revision: rev('one-1') },
      { round: 1, revision: rev('never-entered') },
      { round: 2, revision: rev('one-1') },
    ]) {
      expect(
        await fixture.ledger.commit(
          commitRequest(token, { backlogRemovals: [removal] }),
        ),
      ).toEqual({ outcome: 'rejected', reason: 'staged-correction-immutable' });
    }
    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          backlogInsertions: [{ round: 9, revision: rev('no-record') }],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'backlog-orphan' });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('stamps entries with the ledger clock and lists only the season asked for', async () => {
    const fixture = ledgerFixture();
    const current = await lease(fixture, SEASON);
    const other = await lease(fixture, OTHER_SEASON);
    fixture.clock.set('2026-09-27T12:05:00.000Z');
    await fill(fixture, current, 2, 'current');
    await fill(fixture, other, 1, 'other');

    const read = await fixture.ledger.readSeason(SEASON);
    expect(read.outcome === 'read' && read.snapshot.backlog).toEqual({
      count: 3,
      capacity: 60,
      entries: [1, 2].map((round) => ({
        schemaVersion: 1,
        kind: 'backlog-entry',
        season: SEASON,
        round,
        revision: rev(`current-${round}`),
        enteredAt: '2026-09-27T12:05:00.000Z',
      })),
    });
  });

  it('cannot be disposed of under another season lease', async () => {
    const fixture = ledgerFixture();
    const current = await lease(fixture, SEASON);
    const other = await lease(fixture, OTHER_SEASON);
    await fill(fixture, current, 1, 'current');
    const before = committedBytes(fixture.host);

    // The other season holds no record for the round, so nothing matches.
    expect(
      await fixture.ledger.dispose({
        lease: other,
        round: 1,
        action: 'accept-staged',
        operationId: OPERATION,
        authMethod: 'shared-admin-token',
        expected: {
          recordVersion: 1,
          contentRevision: rev('content-1'),
          stagedRevision: rev('current-1'),
          competingRevision: null,
        },
      }),
    ).toEqual({ outcome: 'rejected', reason: 'operator-precondition-failed' });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('enters an entry only together with the staged slot it holds', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    const before = committedBytes(fixture.host);

    for (const [parts, reason] of [
      // An entry for a record written without a staged slot.
      [
        {
          classifications: [write(classification(1))],
          backlogInsertions: [{ round: 1, revision: rev('staged') }],
        },
        'backlog-staged-mismatch',
      ],
      // An entry naming another revision than the slot.
      [
        {
          classifications: [write(stagedClassification(1, rev('staged')))],
          backlogInsertions: [{ round: 1, revision: rev('other') }],
        },
        'backlog-staged-mismatch',
      ],
      // A staged slot without its entry.
      [
        { classifications: [write(stagedClassification(1, rev('staged')))] },
        'backlog-staged-mismatch',
      ],
      // An entry for a round the request does not write.
      [
        { backlogInsertions: [{ round: 1, revision: rev('staged') }] },
        'backlog-orphan',
      ],
    ] as const) {
      expect(await fixture.ledger.commit(commitRequest(token, parts))).toEqual({
        outcome: 'rejected',
        reason,
      });
    }
    expect(committedBytes(fixture.host)).toBe(before);
  });
});
