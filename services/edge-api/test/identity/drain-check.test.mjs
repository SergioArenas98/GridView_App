import { describe, expect, it } from 'vitest';
import {
  evaluateDrain,
  freshness,
  notObservable,
} from '../../scripts/identity/drain-check.mjs';

const now = Date.parse('2026-12-01T12:00:00.000Z');
const drained = () => ({
  cutover: {
    state: 'active',
    authoritative: true,
    admissionClosed: false,
    activeVersion: 'pm1-x',
  },
  sync: {
    sync: {
      lastStartedAt: '2026-11-30T10:00:00.000Z',
      lastCompletedAt: '2026-11-30T10:01:00.000Z',
      lastFailedAt: null,
    },
  },
  inspect: {
    operatorHold: { since: '2026-12-01T11:00:00.000Z', operationId: 'op' },
    durableBlock: null,
    publicationDisposition: null,
    lease: { state: 'released', expiresAt: '2026-11-30T10:11:00.000Z' },
    backlog: { entries: [] },
    rounds: [{ round: 1, stagedCorrection: null, competingCorrection: null }],
  },
});
const failing = (state) =>
  evaluateDrain(state, now)
    .checks.filter((c) => !c.ok)
    .map((c) => c.name);

describe('U11 drain check', () => {
  it('reports drained only when every observable condition holds', () => {
    const r = evaluateDrain(drained(), now);
    expect(r.drained).toBe(true);
    expect(r.notObservable).toEqual(notObservable);
    expect(r.notObservable.length).toBeGreaterThan(0);
  });

  it('requires an applied operator hold', () => {
    const s = drained();
    s.inspect.operatorHold = null;
    expect(failing(s)).toEqual(['operator-hold-applied']);
  });

  it('refuses a publishing or blocked disposition and a durable block', () => {
    const s = drained();
    s.inspect.publicationDisposition = { state: 'publishing', since: 'x' };
    s.inspect.durableBlock = { reason: 'r', since: 'x' };
    expect(failing(s)).toEqual([
      'no-durable-block',
      'no-publication-disposition',
    ]);
  });

  it('accepts an expired lease and refuses a live one', () => {
    const s = drained();
    s.inspect.lease = { state: 'held', expiresAt: '2026-12-01T11:59:00.000Z' };
    expect(failing(s)).toEqual([]);
    s.inspect.lease = { state: 'held', expiresAt: '2026-12-01T12:05:00.000Z' };
    expect(failing(s)).toEqual(['lease-released-or-expired']);
  });

  it('refuses backlog entries, pending corrections and a run in progress', () => {
    const s = drained();
    s.inspect.backlog.entries = [{ round: 18 }];
    s.inspect.rounds[0].stagedCorrection = { revision: 'r' };
    s.sync.sync.lastStartedAt = '2026-12-01T11:30:00.000Z';
    expect(failing(s)).toEqual([
      'backlog-empty',
      'no-pending-corrections',
      'no-sync-in-progress',
    ]);
  });

  it('refuses a sequencer that is not active and authoritative', () => {
    const s = drained();
    s.cutover.admissionClosed = true;
    expect(failing(s)).toEqual(['sequencer-authoritative']);
  });

  it('never reads a missing lease, rounds or sync section as drained', () => {
    for (const mutate of [
      (s) => delete s.inspect.lease,
      (s) => delete s.inspect.rounds,
      (s) => delete s.sync.sync,
    ]) {
      const s = drained();
      mutate(s);
      expect(evaluateDrain(s, now).drained).toBe(false);
    }
  });

  it('requires the three reads to be coherent and recent', () => {
    const t = '2026-12-01T11:58:00.000Z';
    expect(freshness([t, t, '2026-12-01T11:58:30.000Z'], now).ok).toBe(true);
    expect(freshness([t, t, '2026-12-01T11:55:00.000Z'], now).ok).toBe(false);
    expect(
      freshness(
        [
          '2026-12-01T11:40:00.000Z',
          '2026-12-01T11:40:00.000Z',
          '2026-12-01T11:40:01.000Z',
        ],
        now,
      ).ok,
    ).toBe(false);
    expect(freshness([t, t, 'not-a-time'], now).ok).toBe(false);
  });
});
