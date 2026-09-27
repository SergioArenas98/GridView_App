/**
 * Season leases: acquisition, contention, bounded expiry and fencing. A
 * released, expired or superseded token can commit neither an observation
 * write nor a published-revision reconciliation.
 */

import { describe, expect, it } from 'vitest';

import {
  LEASE_TTL_MS,
  ledgerKeys,
} from '../../../../src/sync/coordinated/ledger';
import {
  OTHER_SEASON,
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

const observation = (fence: number) =>
  commitRequest(
    { season: SEASON, fence },
    { classifications: [write(classification(1))] },
  );

const reconciliation = (fence: number) => ({
  lease: { season: SEASON, fence },
  activeVersion: 'v-authoritative',
  revisions: [{ round: 1, revision: rev('published') }],
});

describe('acquisition', () => {
  it('grants the first lease with fence 1, a bounded expiry and the season state', async () => {
    const fixture = ledgerFixture();
    const outcome = await fixture.ledger.acquireLease(SEASON);

    expect(outcome).toEqual({
      outcome: 'acquired',
      lease: {
        season: SEASON,
        fence: 1,
        expiresAt: new Date(Date.parse(START) + LEASE_TTL_MS).toISOString(),
      },
      snapshot: {
        season: SEASON,
        seasonRecord: null,
        classifications: [],
        published: null,
        lease: {
          fence: 1,
          state: 'held',
          expiresAt: '2026-09-27T12:10:00.000Z',
        },
        backlog: { count: 0, capacity: 60, entries: [] },
      },
    });
    expect(LEASE_TTL_MS).toBe(10 * 60 * 1000);
  });

  it('refuses a second caller while the lease is valid, and changes nothing', async () => {
    const fixture = ledgerFixture();
    await lease(fixture);
    const before = committedBytes(fixture.host);

    fixture.clock.advance(LEASE_TTL_MS - 1);
    expect(await fixture.ledger.acquireLease(SEASON)).toEqual({
      outcome: 'rejected',
      reason: 'lease-held',
    });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('keeps seasons independent', async () => {
    const fixture = ledgerFixture();
    expect(await lease(fixture, SEASON)).toEqual({ season: SEASON, fence: 1 });
    expect(await lease(fixture, OTHER_SEASON)).toEqual({
      season: OTHER_SEASON,
      fence: 1,
    });
  });

  it('lets exactly one of two concurrent callers hold the lease', async () => {
    const fixture = ledgerFixture();
    const outcomes = await Promise.all([
      fixture.ledger.acquireLease(SEASON),
      fixture.ledger.acquireLease(SEASON),
    ]);
    expect(outcomes.map((outcome) => outcome.outcome).sort()).toEqual([
      'acquired',
      'rejected',
    ]);
  });
});

describe('expiry', () => {
  it('lets another caller take an expired lease, with the next fence', async () => {
    const fixture = ledgerFixture();
    await lease(fixture);
    fixture.clock.advance(LEASE_TTL_MS);

    const read = await fixture.ledger.readSeason(SEASON);
    expect(read.outcome === 'read' && read.snapshot.lease?.state).toBe(
      'expired',
    );
    expect(await lease(fixture)).toEqual({ season: SEASON, fence: 2 });
  });

  it('refuses a commit and a reconciliation from an expired lease nobody retook', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    fixture.clock.advance(LEASE_TTL_MS);
    const before = committedBytes(fixture.host);

    expect(await fixture.ledger.commit(observation(token.fence))).toEqual({
      outcome: 'rejected',
      reason: 'lease-expired',
    });
    expect(
      await fixture.ledger.reconcilePublishedRevisions(
        reconciliation(token.fence),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'lease-expired' });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('still accepts the holder one millisecond before expiry', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    fixture.clock.advance(LEASE_TTL_MS - 1);
    expect(
      (await fixture.ledger.commit(observation(token.fence))).outcome,
    ).toBe('committed');
  });
});

describe('fencing', () => {
  it('refuses the stale holder once another caller holds a newer fence', async () => {
    const fixture = ledgerFixture();
    const stale = await lease(fixture);
    fixture.clock.advance(LEASE_TTL_MS);
    const current = await lease(fixture);
    const before = committedBytes(fixture.host);

    expect(await fixture.ledger.commit(observation(stale.fence))).toEqual({
      outcome: 'rejected',
      reason: 'lease-superseded',
    });
    expect(
      await fixture.ledger.reconcilePublishedRevisions(
        reconciliation(stale.fence),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'lease-superseded' });
    expect(await fixture.ledger.releaseLease(stale)).toEqual({
      outcome: 'rejected',
      reason: 'lease-superseded',
    });
    expect(committedBytes(fixture.host)).toBe(before);

    // The current holder is unaffected.
    expect(
      (await fixture.ledger.commit(observation(current.fence))).outcome,
    ).toBe('committed');
  });

  it('refuses a released token, and never hands its fence out again', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    expect(await fixture.ledger.releaseLease(token)).toEqual({
      outcome: 'released',
    });

    expect(await fixture.ledger.commit(observation(token.fence))).toEqual({
      outcome: 'rejected',
      reason: 'lease-not-held',
    });
    expect(await fixture.ledger.releaseLease(token)).toEqual({
      outcome: 'rejected',
      reason: 'lease-not-held',
    });
    // Released is free immediately, and the fence only grows.
    expect(await lease(fixture)).toEqual({ season: SEASON, fence: 2 });
  });

  it('refuses a token that was never issued', async () => {
    const fixture = ledgerFixture();
    expect(await fixture.ledger.commit(observation(1))).toEqual({
      outcome: 'rejected',
      reason: 'lease-not-held',
    });
    await lease(fixture);
    expect(await fixture.ledger.commit(observation(2))).toEqual({
      outcome: 'rejected',
      reason: 'lease-not-held',
    });
    // Another season's lease authorizes nothing here.
    const other = await lease(fixture, OTHER_SEASON);
    expect(
      await fixture.ledger.commit(
        commitRequest(other, {
          classifications: [write(classification(1))],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'invalid-request' });
  });

  it('refuses to issue a fence past the safe-integer bound', async () => {
    const fixture = ledgerFixture();
    fixture.host.poke(ledgerKeys.lease(SEASON), {
      schemaVersion: 1,
      kind: 'lease',
      season: SEASON,
      fence: Number.MAX_SAFE_INTEGER,
      state: 'released',
      acquiredAt: '2026-09-27T11:00:00.000Z',
      expiresAt: '2026-09-27T11:10:00.000Z',
    });
    const before = committedBytes(fixture.host);

    expect(await fixture.ledger.acquireLease(SEASON)).toEqual({
      outcome: 'rejected',
      reason: 'fence-exhausted',
    });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('treats a corrupt lease record as corruption, never as free', async () => {
    const fixture = ledgerFixture();
    fixture.host.poke(ledgerKeys.lease(SEASON), { fence: 1, state: 'held' });
    const before = committedBytes(fixture.host);

    expect(await fixture.ledger.acquireLease(SEASON)).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
    expect(await fixture.ledger.commit(observation(1))).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
    expect(committedBytes(fixture.host)).toBe(before);
  });
});

describe('restart', () => {
  it('keeps the lease, its fence and its expiry across a storage restart', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    const restarted = ledgerFixture(fixture.host.restart(), fixture.clock);

    expect(await restarted.ledger.acquireLease(SEASON)).toEqual({
      outcome: 'rejected',
      reason: 'lease-held',
    });
    expect(
      (await restarted.ledger.commit(observation(token.fence))).outcome,
    ).toBe('committed');

    fixture.clock.advance(LEASE_TTL_MS);
    expect(await lease(restarted)).toEqual({ season: SEASON, fence: 2 });
  });
});
