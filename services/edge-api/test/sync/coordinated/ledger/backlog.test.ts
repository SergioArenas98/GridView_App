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
  write,
  type LedgerFixture,
} from './support';

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
        write(classification(round, {}, token.season)),
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
          classifications: [write(classification(26))],
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
            write(classification(round)),
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
              write(classification(round)),
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
          classifications: [write(classification(61))],
          backlogInsertions: [{ round: 61, revision: rev('newer') }],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'backlog-capacity-exceeded' });
    // Age deletes nothing either.
    expect(entries()).toEqual(kept);
  });

  it('releases capacity only through an explicit removal', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await fill(fixture, token, 60, 'full');

    // Disposing of one resource frees the slot another resource takes, in
    // the same commit, netting to the capacity.
    expect(
      (
        await fixture.ledger.commit(
          commitRequest(token, {
            classifications: [write(classification(61))],
            backlogRemovals: [{ round: 1, revision: rev('full-1') }],
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
              write(classification(round)),
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

  it('refuses a duplicate entry, a missing removal and an orphan, changing nothing', async () => {
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
    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          backlogRemovals: [{ round: 1, revision: rev('never-entered') }],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'backlog-entry-missing' });
    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          backlogRemovals: [{ round: 2, revision: rev('one-1') }],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'backlog-entry-missing' });
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

  it('cannot be removed under another season lease', async () => {
    const fixture = ledgerFixture();
    const current = await lease(fixture, SEASON);
    const other = await lease(fixture, OTHER_SEASON);
    await fill(fixture, current, 1, 'current');
    const before = committedBytes(fixture.host);

    expect(
      await fixture.ledger.commit(
        commitRequest(other, {
          backlogRemovals: [{ round: 1, revision: rev('current-1') }],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'backlog-entry-missing' });
    expect(committedBytes(fixture.host)).toBe(before);
  });
});
