import { describe, expect, it } from 'vitest';

import {
  afterRateLimit,
  decodeState,
  emptyState,
  gate,
  hourlyHeadroom,
  MAXIMUM_HOLD_MS,
  MINIMUM_HOLD_MS,
  planRun,
  stopFor,
  withRequests,
  type AutoUpdateState,
} from '../../scripts/auto-update/reconcile';
import { calendarAnchor } from '../../src/sync/coordinated/policy/cadence';
import { newClassificationRecord } from '../../src/sync/coordinated/policy/classification';

const H = 3_600_000;
const anchor = (round: number) =>
  calendarAnchor(
    round,
    `2026-03-${String(round * 7 - 6).padStart(2, '0')}`,
    '12:00:00Z',
  )!;
const start = (round: number) => Date.parse(anchor(round).anchor);
const rev = (c: string) => `sha256:${c.repeat(64)}`;

function state(overrides: Partial<AutoUpdateState> = {}): AutoUpdateState {
  const anchors = [1, 2, 3].map(anchor);
  const records = [1, 2].map((round) => ({
    ...newClassificationRecord(2026, anchor(round)),
    contentRevision: rev(String(round)),
    publishedRevision: rev(String(round)),
    reviewState: 'unsettled' as const,
  }));
  return {
    ...emptyState(2026, 'c'.repeat(40)),
    anchors,
    records,
    lastFullCaptureAt: new Date(start(2) + 24 * H).toISOString(),
    published: {
      contentDigest: 'd'.repeat(64),
      version: 'pm1-000000000001d-aed72435',
      at: new Date(start(2)).toISOString(),
    },
    ...overrides,
  };
}

describe('state decoding', () => {
  it('round-trips and refuses anything malformed, never resetting', () => {
    const value = JSON.parse(JSON.stringify(state()));
    const decoded = decodeState(value, 'c'.repeat(40));
    expect(decoded.ok).toBe(true);
    expect(decodeState({ ...value, schemaVersion: 2 }, 'c'.repeat(40))).toEqual(
      { ok: false, reason: 'state-version' },
    );
    expect(
      decodeState({ ...value, records: [{ round: 1 }] }, 'c'.repeat(40)),
    ).toEqual({ ok: false, reason: 'state-records' });
    expect(
      decodeState({ ...value, holdUntil: 'soon' }, 'c'.repeat(40)),
    ).toEqual({ ok: false, reason: 'state-hold' });
  });

  it('drops body revisions computed by other code', () => {
    const value = JSON.parse(
      JSON.stringify(
        state({
          bodyRevisions: {
            1: { bodySha256: 'a'.repeat(64), revision: rev('1') },
          },
        }),
      ),
    );
    const same = decodeState(value, 'c'.repeat(40));
    const other = decodeState(value, 'e'.repeat(40));
    expect(same.ok && Object.keys(same.state.bodyRevisions)).toEqual(['1']);
    expect(other.ok && other.state.bodyRevisions).toEqual({});
  });
});

describe('planning', () => {
  it('a missing state stops; bootstrap needs none', () => {
    expect(planRun(null, new Date(start(3)), 'scheduled')).toEqual({
      kind: 'stopped',
      reason: 'state-missing',
    });
    expect(planRun(state(), new Date(start(3)), 'bootstrap')).toEqual({
      kind: 'stopped',
      reason: 'bootstrap-state-exists',
    });
    expect(planRun(null, new Date(start(3)), 'bootstrap')).toMatchObject({
      kind: 'run',
      fullCapture: true,
    });
  });

  it('captures nothing between a race start and + 5 h', () => {
    expect(
      planRun(state(), new Date(start(3) + 2 * H), 'scheduled'),
    ).toMatchObject({ kind: 'idle', reason: 'race-not-batch-eligible:3' });
    expect(
      planRun(state(), new Date(start(3) + 4.9 * H), 'scheduled').kind,
    ).toBe('idle');
  });

  it('from + 5 h a never-sighted round is probed, and no refresh capture runs before it is sighted', () => {
    const plan = planRun(state(), new Date(start(3) + 5.5 * H), 'scheduled');
    expect(plan).toMatchObject({ kind: 'run', fullCapture: false });
    expect(plan.kind === 'run' && plan.due.map((d) => d.round)).toContain(3);
  });

  it('an accepted but unpublished revision is published on the next run', () => {
    const s = state();
    const drifted = {
      ...s,
      records: s.records.map((r) =>
        r.round === 2 ? { ...r, publishedRevision: rev('9') } : r,
      ),
      anchors: s.anchors.slice(0, 2),
    };
    expect(
      planRun(drifted, new Date(start(2) + 30 * H), 'scheduled'),
    ).toMatchObject({
      kind: 'run',
      fullCapture: true,
      reason: 'unpublished-revision',
    });
  });

  it('a hold or a stop sends nothing', () => {
    const now = new Date(start(3) + 30 * H);
    expect(
      planRun(
        afterRateLimit(state(), now, null),
        new Date(now.getTime() + H),
        'scheduled',
      ).kind,
    ).toBe('held');
    expect(
      planRun(
        stopFor(state(), 'staged-correction', [1], now),
        now,
        'scheduled',
      ),
    ).toEqual({ kind: 'stopped', reason: 'staged-correction' });
  });
});

describe('limits', () => {
  it('a 429 holds 2-24 h, honours a longer Retry-After, never shortens a hold', () => {
    const now = new Date(start(3));
    const at = (s: AutoUpdateState) => Date.parse(s.holdUntil!) - now.getTime();
    expect(at(afterRateLimit(state(), now, null))).toBe(MINIMUM_HOLD_MS);
    expect(
      at(
        afterRateLimit(
          state(),
          now,
          new Date(now.getTime() + 5 * H).toISOString(),
        ),
      ),
    ).toBe(5 * H);
    expect(
      at(
        afterRateLimit(
          state(),
          now,
          new Date(now.getTime() + 100 * H).toISOString(),
        ),
      ),
    ).toBe(MAXIMUM_HOLD_MS);
    const long = afterRateLimit(
      state(),
      now,
      new Date(now.getTime() + 10 * H).toISOString(),
    );
    expect(afterRateLimit(long, now, null).holdUntil).toBe(long.holdUntil);
  });

  it('counts requests in a rolling hour against the published 500', () => {
    const now = new Date(start(3));
    const s = withRequests(
      state(),
      Array.from({ length: 480 }, () => now.toISOString()),
      now,
    );
    expect(hourlyHeadroom(s, now)).toBe(20);
    expect(hourlyHeadroom(s, new Date(now.getTime() + H + 1))).toBe(500);
  });
});

describe('the gate', () => {
  const revisions = (entries: [number, string][]) =>
    new Map(entries.map(([r, c]) => [r, rev(c)]));
  it('publishes only accepted revisions, and nothing unchanged', () => {
    expect(
      gate(
        state(),
        revisions([
          [1, '1'],
          [2, '2'],
        ]),
        'f'.repeat(64),
      ),
    ).toEqual({ kind: 'publish' });
    expect(
      gate(
        state(),
        revisions([
          [1, '1'],
          [2, '2'],
        ]),
        'd'.repeat(64),
      ),
    ).toEqual({ kind: 'unchanged' });
  });

  it('withholds a first result or a change not yet corroborated', () => {
    expect(
      gate(
        state(),
        revisions([
          [1, '1'],
          [2, '2'],
          [3, '3'],
        ]),
        'f'.repeat(64),
      ),
    ).toMatchObject({
      kind: 'withhold',
      reason: 'first-result-pending',
      rounds: [3],
    });
    expect(
      gate(
        state(),
        revisions([
          [1, '1'],
          [2, '7'],
        ]),
        'f'.repeat(64),
      ),
    ).toMatchObject({
      kind: 'withhold',
      reason: 'change-pending',
      rounds: [2],
    });
  });

  it('stops for a human when the batch cannot express the accepted state', () => {
    const s = state();
    const superseded = {
      ...s,
      records: s.records.map((r) =>
        r.round === 2 ? { ...r, supersededRevisions: [rev('7')] } : r,
      ),
    };
    expect(
      gate(
        superseded,
        revisions([
          [1, '1'],
          [2, '7'],
        ]),
        'f'.repeat(64),
      ),
    ).toMatchObject({ kind: 'stop', reason: 'superseded-revision-served' });
    expect(gate(s, revisions([[1, '1']]), 'f'.repeat(64))).toMatchObject({
      kind: 'stop',
      reason: 'accepted-round-missing',
      rounds: [2],
    });
    const staged = {
      ...s,
      records: s.records.map((r) =>
        r.round === 1
          ? {
              ...r,
              stagedCorrection: {
                revision: rev('8'),
                firstSeenAt: new Date(start(1)).toISOString(),
              },
            }
          : r,
      ),
    } as unknown as AutoUpdateState;
    expect(
      gate(
        staged,
        revisions([
          [1, '1'],
          [2, '2'],
        ]),
        'f'.repeat(64),
      ),
    ).toMatchObject({ kind: 'stop', reason: 'staged-correction', rounds: [1] });
  });
});
