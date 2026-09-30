/**
 * The planner under an operator hold or a durable block (PR-E1; OD-3, OD-5):
 * nothing plans a publication for publication's sake, a manual run sends
 * nothing, and cadence checks and the weekly refreshes still observe.
 */

import { describe, expect, it } from 'vitest';

import type {
  LedgerSnapshot,
  SeasonRecord,
} from '../../../../src/sync/coordinated/ledger';
import {
  checkTime,
  planRun,
  publicationStop,
  releaseDrifted,
  type RunTrigger,
} from '../../../../src/sync/coordinated/policy';
import {
  ANCHOR,
  DAY,
  anchorOf,
  classification,
  deepFreeze,
  plus,
  quietSeason,
  rev,
  snapshotOf,
} from './support';

const FAR = '2027-06-01T00:00:00.000Z';
const calendar = [anchorOf(1, ANCHOR)];
const OPERATION = '0b8e5a52-3c1d-4e6f-9a7b-2c3d4e5f6a7b';

const hold = {
  operatorHold: { since: '2026-10-01T00:00:00.000Z', operationId: OPERATION },
};
const block = {
  durableBlock: {
    since: '2026-10-01T00:00:00.000Z',
    reason: 'classification-superseded',
  },
};
const stops = [
  ['an operator hold', hold],
  ['a durable block', block],
] as const;

const settled = classification(1, {
  anchor: ANCHOR,
  nextDueAt: null,
  checkIndex: 4,
  contentRevision: rev('A'),
  provenance: 'reconciled',
  reviewState: 'settled',
  terminalReason: 'settled',
  settledAt: checkTime(ANCHOR, 4).toISOString(),
});

/** A snapshot whose authority serves `serving`, recorded as `recorded`. */
function drifted(season: SeasonRecord): LedgerSnapshot {
  return {
    ...snapshotOf({ season, classifications: [settled] }),
    published: {
      schemaVersion: 1,
      kind: 'published-reconciliation',
      season: season.season,
      activeVersion: 'v-rolled-back',
      reconciledAt: '2026-10-20T00:00:00.000Z',
    },
  };
}

function planAt(
  now: Date,
  snapshot: LedgerSnapshot,
  trigger: RunTrigger = 'scheduled',
) {
  return planRun({ now, snapshot: deepFreeze(snapshot), trigger });
}

describe('publicationStop', () => {
  it('names the hold first, then a durable block, else nothing', () => {
    expect(publicationStop(null)).toBeNull();
    expect(publicationStop(quietSeason(calendar, FAR))).toBeNull();
    expect(publicationStop(quietSeason(calendar, FAR, hold))).toBe(
      'operator-hold',
    );
    expect(publicationStop(quietSeason(calendar, FAR, block))).toBe(
      'durable-block',
    );
    expect(
      publicationStop(quietSeason(calendar, FAR, { ...hold, ...block })),
    ).toBe('operator-hold');
  });

  it('is independent of the transient disposition', () => {
    // A `blocked` or `publishing` disposition is not a stop, and a stop does
    // not need one.
    for (const publicationDisposition of [
      {
        state: 'blocked',
        since: '2026-10-01T00:00:00.000Z',
        reason: 'classification-staged',
      },
      {
        state: 'publishing',
        since: '2026-10-01T00:00:00.000Z',
        digest: null,
        orderingInput: null,
      },
    ]) {
      expect(
        publicationStop(quietSeason(calendar, FAR, { publicationDisposition })),
      ).toBeNull();
    }
  });
});

describe.each(stops)('a season stopped by %s', (_, stop) => {
  const now = new Date('2026-10-20T00:17:00.000Z');

  it('plans no publication for a due publication alone', () => {
    const season = quietSeason(calendar, FAR, {
      ...stop,
      publicationDueAt: now.toISOString(),
    });
    expect(
      planAt(now, snapshotOf({ season, classifications: [settled] })),
    ).toMatchObject({ kind: 'nothing-due', reason: 'no-work' });
    // The same season, not stopped, would publish.
    expect(
      planAt(
        now,
        snapshotOf({
          season: { ...season, operatorHold: null, durableBlock: null },
          classifications: [settled],
        }),
      ).kind,
    ).toBe('publication');
  });

  it('plans no publication for drift: a rollback made under it stays', () => {
    const season = quietSeason(calendar, FAR, {
      ...stop,
      lastPublication: {
        digest: rev('digest'),
        activeVersion: 'v-published',
        publishedAt: '2026-10-10T00:00:00.000Z',
        confirmedAt: '2026-10-10T00:00:00.000Z',
      },
    });
    expect(releaseDrifted(drifted(season))).toBe(false);
    expect(planAt(now, drifted(season))).toMatchObject({
      kind: 'nothing-due',
    });
    const unstopped = { ...season, operatorHold: null, durableBlock: null };
    expect(releaseDrifted(drifted(unstopped))).toBe(true);
    expect(planAt(now, drifted(unstopped)).kind).toBe('publication');
  });

  it('refuses a manual run before any request', () => {
    const season = quietSeason(calendar, FAR, stop);
    const result = planAt(
      now,
      snapshotOf({ season, classifications: [settled] }),
      'manual',
    );
    expect(result).toEqual({
      kind: 'nothing-due',
      season: season.season,
      trigger: 'manual',
      reason: 'publication-stopped',
      resources: [],
      providerRequests: 0,
    });
  });

  it('still observes at a cadence check, so the ledger follows upstream', () => {
    const season = quietSeason(calendar, FAR, stop);
    const result = planAt(plus(ANCHOR, 5 * 60 * 60 * 1000 + 17 * 60 * 1000), {
      ...snapshotOf({ season }),
    });
    expect(result).toMatchObject({ kind: 'publication' });
    expect(result.providerRequests).toBe(7);
  });

  it('still observes at the weekly refresh, and rereads every accepted round', () => {
    const season = quietSeason(calendar, FAR, stop);
    const weekly = {
      ...season,
      refresh: {
        ...season.refresh,
        circuits: { ...season.refresh.circuits, nextDueAt: now.toISOString() },
      },
    };
    const result = planAt(
      now,
      snapshotOf({ season: weekly, classifications: [settled] }),
    );
    expect(result).toMatchObject({
      kind: 'publication',
      checks: [{ round: 1, check: 'reread' }],
    });
  });

  it('still lets a manual run bootstrap a calendar, which is an observation', () => {
    const season = {
      ...quietSeason(calendar, FAR, stop),
      calendarAnchors: null,
    };
    expect(
      planAt(plus(ANCHOR, -30 * DAY), snapshotOf({ season }), 'manual'),
    ).toMatchObject({ kind: 'observation', bootstrap: true });
  });
});
