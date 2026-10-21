/**
 * The G5 due-work planner over synthetic ledger snapshots: bootstrap, run
 * kinds, no-work ticks, dense offsets, missed-check collapse, daily
 * termination, full backfill, future-round exclusion, limiter deferral and
 * manual force.
 */

import { describe, expect, it } from 'vitest';

import {
  isCoordinatedResource,
  type CoordinatedResource,
} from '../../../../src/providers/coordination';
import type { ClassificationRecord } from '../../../../src/sync/coordinated/ledger';
import {
  checkTime,
  planRun,
  type RunPlan,
  type RunTrigger,
} from '../../../../src/sync/coordinated/policy';
import {
  ANCHOR,
  DAY,
  HOUR,
  anchorOf,
  classification,
  deepFreeze,
  plus,
  quietSeason,
  rev,
  seasonRecord,
  snapshotOf,
  weeklyCalendar,
} from './support';

const FAR = '2027-06-01T00:00:00.000Z';
const calendar = [anchorOf(1, ANCHOR)];

function plan(
  now: Date,
  parts: Parameters<typeof snapshotOf>[0],
  trigger: RunTrigger = 'scheduled',
): RunPlan {
  return planRun({ now, snapshot: deepFreeze(snapshotOf(parts)), trigger });
}

function checksOf(result: RunPlan) {
  return result.kind === 'publication'
    ? result.checks.map((check) =>
        check.check === 'cadence'
          ? `${check.round}:cadence:${check.slot}`
          : `${check.round}:${check.check}`,
      )
    : [];
}

function record(
  round: number,
  overrides: Partial<Record<keyof ClassificationRecord, unknown>> = {},
  anchor = ANCHOR,
): ClassificationRecord {
  return classification(round, { anchor, nextDueAt: null, ...overrides });
}

const accepted = (
  overrides: Partial<Record<keyof ClassificationRecord, unknown>> = {},
) => ({
  contentRevision: rev('A'),
  provenance: 'reconciled',
  reviewState: 'unsettled',
  consecutiveConfirmations: 1,
  ...overrides,
});

/** Settled at the +24h check, slot 12. */
const settledFields = {
  ...accepted(),
  checkIndex: 12,
  reviewState: 'settled',
  terminalReason: 'settled',
  settledAt: checkTime(ANCHOR, 12).toISOString(),
};

const MINUTE = HOUR / 60;

describe('bootstrap', () => {
  it.each(['scheduled', 'manual'] as const)(
    'observes only the calendar when none has been observed (%s)',
    (trigger) => {
      for (const season of [null, seasonRecord()]) {
        const result = plan(plus(ANCHOR, 3 * DAY), { season }, trigger);
        expect(result).toMatchObject({
          kind: 'observation',
          bootstrap: true,
          refresh: ['calendar'],
          resources: [{ kind: 'season-calendar', season: 2026 }],
          providerRequests: 1,
          advancesSchedule: trigger === 'scheduled',
        });
      }
    },
  );

  it('waits for the calendar cadence after a failed bootstrap, unless forced', () => {
    const failedAt = new Date('2026-09-01T00:17:00.000Z');
    const season = seasonRecord({
      refresh: {
        ...seasonRecord().refresh,
        calendar: {
          observedRevision: null,
          lastAttemptedAt: failedAt.toISOString(),
          lastSuccessAt: null,
          nextDueAt: plus(failedAt, 6 * HOUR).toISOString(),
        },
      },
    });

    for (const hours of [1, 5]) {
      expect(plan(plus(failedAt, hours * HOUR), { season })).toMatchObject({
        kind: 'nothing-due',
        reason: 'no-work',
        providerRequests: 0,
      });
      expect(
        plan(plus(failedAt, hours * HOUR), { season }, 'manual'),
      ).toMatchObject({
        kind: 'observation',
        bootstrap: true,
      });
    }
    expect(plan(plus(failedAt, 6 * HOUR), { season })).toMatchObject({
      kind: 'observation',
      bootstrap: true,
      providerRequests: 1,
    });
  });

  it('publishes the season-level resources next, even with no race yet (six requests)', () => {
    const season = seasonRecord({
      calendarAnchors: calendar,
      refresh: {
        ...seasonRecord().refresh,
        calendar: {
          observedRevision: rev('calendar'),
          lastAttemptedAt: '2026-09-01T00:17:00.000Z',
          lastSuccessAt: '2026-09-01T00:17:00.000Z',
          nextDueAt: '2026-09-01T06:17:00.000Z',
        },
      },
    });
    const result = plan(new Date('2026-09-01T01:17:00.000Z'), { season });

    expect(result).toMatchObject({
      kind: 'publication',
      checks: [],
      refresh: [
        'calendar',
        'circuits',
        'participants',
        'driver-standings',
        'constructor-standings',
      ],
      providerRequests: 6,
    });
    expect(result.resources.map((resource) => resource.kind)).toEqual([
      'season-calendar',
      'season-circuits',
      'season-participants',
      'driver-standings',
      'constructor-standings',
    ]);
  });
});

describe('ticks with nothing due', () => {
  it('make no provider request at all', () => {
    const result = plan(plus(ANCHOR, -2 * DAY), {
      season: quietSeason(calendar, FAR),
    });

    expect(result).toEqual({
      kind: 'nothing-due',
      season: 2026,
      trigger: 'scheduled',
      reason: 'no-work',
      resources: [],
      providerRequests: 0,
    });
  });

  it('stay quiet after every round has settled and nothing else is due', () => {
    const result = plan(plus(ANCHOR, 30 * DAY), {
      season: quietSeason(calendar, FAR),
      classifications: [record(1, settledFields)],
    });
    expect(result.kind).toBe('nothing-due');
  });
});

describe('observation runs', () => {
  it('request only the due season-level resources and never a round', () => {
    const due = plus(ANCHOR, -DAY).toISOString();
    const season = quietSeason(calendar, FAR, {
      refresh: {
        ...quietSeason(calendar, FAR).refresh,
        calendar: {
          ...quietSeason(calendar, FAR).refresh.calendar,
          nextDueAt: due,
        },
        'driver-standings': {
          ...quietSeason(calendar, FAR).refresh['driver-standings'],
          nextDueAt: due,
        },
      },
    });
    const result = plan(plus(ANCHOR, -DAY), { season });

    expect(result).toMatchObject({
      kind: 'observation',
      bootstrap: false,
      refresh: ['calendar', 'driver-standings'],
      providerRequests: 2,
    });
    expect(result.resources).toEqual([
      { kind: 'season-calendar', season: 2026 },
      { kind: 'driver-standings', season: 2026 },
    ]);
  });
});

describe('publication runs', () => {
  it('follow a due publication left by an observation run', () => {
    const now = plus(ANCHOR, -DAY);
    const result = plan(now, {
      season: quietSeason(calendar, FAR, {
        publicationDueAt: now.toISOString(),
      }),
    });
    expect(result.kind).toBe('publication');
  });

  it('follow the weekly circuits and participants refresh, rereading every accepted round', () => {
    const season = quietSeason(calendar, FAR);
    const weekly = {
      ...season,
      refresh: {
        ...season.refresh,
        participants: {
          ...season.refresh.participants,
          nextDueAt: '2026-11-01T00:00:00.000Z',
        },
      },
    };
    const result = plan(new Date('2026-11-01T00:17:00.000Z'), {
      season: weekly,
      classifications: [record(1, settledFields)],
    });

    expect(checksOf(result)).toEqual(['1:reread']);
    expect(result.providerRequests).toBe(7);
  });
});

describe('race classification checks', () => {
  const season = quietSeason(calendar, FAR);

  it('are never planned before anchor + 1 h 30 min, even for a race in progress', () => {
    for (const trigger of ['scheduled', 'manual'] as const) {
      const result = plan(plus(ANCHOR, 90 * MINUTE - 1), { season }, trigger);
      expect(checksOf(result)).toEqual([]);
    }
    expect(checksOf(plan(plus(ANCHOR, 90 * MINUTE), { season }))).toEqual([
      '1:cadence:1',
    ]);
  });

  /**
   * Plans the minute-17 ticks from `fromHour` to `toHour` after the race
   * start, each run consuming the slot it served, and answers when a check
   * fell due. `fields` is what the record holds besides its slot.
   */
  function dueTicks(
    fields: Partial<Record<keyof ClassificationRecord, unknown>> | null,
    fromHour: number,
    toHour: number,
    checkIndex = 0,
  ): string[] {
    const due: string[] = [];
    let served = checkIndex;
    for (let hour = fromHour; hour <= toHour; hour += 1) {
      const records =
        fields === null && served === 0
          ? []
          : [record(1, { ...(fields ?? {}), checkIndex: served })];
      const checks = checksOf(
        plan(plus(ANCHOR, hour * HOUR + 17 * MINUTE), {
          season,
          classifications: records,
        }),
      );
      const cadence = checks.find((check) => check.includes('cadence'));
      if (cadence === undefined) continue;
      due.push(`+${hour}h17:${cadence}`);
      served = Number(cadence.split(':')[2]);
    }
    return due;
  }

  it('ask for a missing result on every hourly tick of the window, then back off', () => {
    // No result yet: the record holds no accepted revision.
    expect(dueTicks(null, 0, 30)).toEqual([
      '+2h17:1:cadence:1',
      '+3h17:1:cadence:2',
      '+4h17:1:cadence:3',
      '+5h17:1:cadence:4',
      '+6h17:1:cadence:5',
      '+7h17:1:cadence:6',
      '+8h17:1:cadence:7',
      '+9h17:1:cadence:8',
      '+10h17:1:cadence:9',
      '+11h17:1:cadence:10',
      '+15h17:1:cadence:11',
      '+24h17:1:cadence:12',
    ]);
  });

  it('confirm an accepted result only at +5 h 30 min, +9 h 30 min, +15 h and +24 h', () => {
    // Accepted at slot 1, on the +2h17 tick.
    expect(dueTicks(accepted(), 3, 30, 1)).toEqual([
      '+6h17:1:cadence:5',
      '+10h17:1:cadence:9',
      '+15h17:1:cadence:11',
      '+24h17:1:cadence:12',
    ]);
  });

  it('ask hourly again while a differing revision is pending', () => {
    const pending = accepted({ candidateRevision: rev('B') });
    expect(dueTicks(pending, 7, 9, 5)).toEqual([
      '+7h17:1:cadence:6',
      '+8h17:1:cadence:7',
      '+9h17:1:cadence:8',
    ]);
  });

  it('collapse every missed slot into one current check, with no catch-up burst', () => {
    const result = plan(plus(ANCHOR, 6 * DAY + 2 * HOUR), {
      season,
      classifications: [record(1, { ...accepted(), checkIndex: 1 })],
    });
    // Slots 5-16 were missed; one check serves slot 17 (day 6).
    expect(checksOf(result)).toEqual(['1:cadence:17']);
  });

  it('continue daily only while unsettled, and stop at the ceiling', () => {
    const unsettledDay3 = plan(plus(ANCHOR, 3 * DAY), {
      season,
      classifications: [record(1, { ...accepted(), checkIndex: 13 })],
    });
    expect(checksOf(unsettledDay3)).toEqual(['1:cadence:14']);

    const settledDay3 = plan(plus(ANCHOR, 3 * DAY), {
      season,
      classifications: [record(1, settledFields)],
    });
    expect(settledDay3.kind).toBe('nothing-due');

    const afterCeiling = plan(plus(ANCHOR, 40 * DAY), {
      season,
      classifications: [
        record(1, {
          ...accepted(),
          checkIndex: 25,
          terminalReason: 'settled-on-deadline',
          reviewState: 'settled',
        }),
      ],
    });
    expect(afterCeiling.kind).toBe('nothing-due');
  });

  it('drop a never-reconciled round from scheduled runs after the ceiling', () => {
    const result = plan(plus(ANCHOR, 20 * DAY), {
      season: quietSeason(calendar, FAR, {
        publicationDueAt: plus(ANCHOR, 20 * DAY).toISOString(),
      }),
      classifications: [
        record(1, {
          checkIndex: 25,
          terminalReason: 'never-reconciled-abandoned',
        }),
      ],
    });
    expect(result.kind).toBe('publication');
    expect(checksOf(result)).toEqual([]);
  });

  it('schedule from the record anchor once a round is recorded', () => {
    const moved = quietSeason(
      [anchorOf(1, plus(ANCHOR, 7 * DAY).toISOString())],
      FAR,
    );
    const result = plan(plus(ANCHOR, 9 * HOUR), {
      season: moved,
      classifications: [record(1, { ...accepted(), checkIndex: 1 })],
    });
    expect(checksOf(result)).toEqual(['1:cadence:5']);
  });
});

describe('full backfill', () => {
  const season23 = weeklyCalendar(23, '2026-03-08T04:00:00.000Z');
  const now = new Date('2026-06-21T12:17:00.000Z');

  it('selects every eligible round of an unrecorded season and nothing in the future', () => {
    const result = plan(now, { season: quietSeason(season23, FAR) });
    const eligible = season23.filter(
      (entry) => Date.parse(entry.anchor) + 90 * MINUTE <= now.getTime(),
    );

    expect(eligible).toHaveLength(16);
    expect(result.kind).toBe('publication');
    if (result.kind !== 'publication') return;
    expect(result.checks.map((check) => check.round)).toEqual(
      eligible.map((entry) => entry.round),
    );
    // Rounds past their ceiling are served at slot 25; the newest is in its
    // hourly window (+8 h 17 min: slot 7).
    expect(checksOf(result).slice(0, 2)).toEqual([
      '1:cadence:25',
      '2:cadence:25',
    ]);
    expect(checksOf(result).slice(13)).toEqual([
      '14:cadence:25',
      '15:cadence:18',
      '16:cadence:7',
    ]);
    expect(result.providerRequests).toBe(6 + 16);
    expect(
      result.resources.filter(
        (resource) => resource.kind === 'session-classification',
      ),
    ).toHaveLength(16);
  });

  it('keeps rereading every accepted round alongside the due ones (O-3)', () => {
    const recorded = season23
      .slice(0, 15)
      .map((entry) =>
        record(entry.round, { ...settledFields, checkIndex: 25 }, entry.anchor),
      );
    const newest = season23[15]!;
    const result = plan(plus(newest.anchor, 9 * HOUR), {
      season: quietSeason(season23, FAR),
      classifications: [
        ...recorded,
        record(16, { ...accepted(), checkIndex: 1 }, newest.anchor),
      ],
    });

    expect(checksOf(result)).toEqual([
      ...recorded.map((entry) => `${entry.round}:reread`),
      '16:cadence:5',
    ]);
    expect(result.providerRequests).toBe(22);
  });
});

describe('the limiter deferral', () => {
  const season = quietSeason(calendar, FAR);
  const until = plus(ANCHOR, 9 * HOUR + 30 * 60 * 1000).toISOString();
  const deferred = [
    record(1, { ...accepted(), checkIndex: 1, limiterDeferralUntil: until }),
  ];

  it('withholds scheduled work until it passes, with no request', () => {
    const result = plan(plus(ANCHOR, 9 * HOUR + 17 * 60 * 1000), {
      season,
      classifications: deferred,
    });
    expect(result).toMatchObject({
      kind: 'nothing-due',
      reason: 'limiter-deferred',
      providerRequests: 0,
    });
    expect(
      checksOf(plan(new Date(until), { season, classifications: deferred })),
    ).toEqual(['1:cadence:9']);
  });

  it('does not stop a manual run, which the limiter itself still paces', () => {
    const result = plan(
      plus(ANCHOR, 9 * HOUR + 17 * 60 * 1000),
      { season, classifications: deferred },
      'manual',
    );
    expect(result.kind).toBe('publication');
  });
});

describe('manual force (O-8)', () => {
  const season23 = weeklyCalendar(23, '2026-03-08T04:00:00.000Z');
  const now = new Date('2026-06-21T12:17:00.000Z');

  it('selects every eligible round, consumes no slot and advances no schedule', () => {
    const result = plan(
      now,
      {
        season: quietSeason(season23, FAR),
        classifications: [
          record(1, settledFields, season23[0]!.anchor),
          record(
            2,
            { checkIndex: 25, terminalReason: 'never-reconciled-abandoned' },
            season23[1]!.anchor,
          ),
        ],
      },
      'manual',
    );

    expect(result).toMatchObject({
      kind: 'publication',
      advancesSchedule: false,
      trigger: 'manual',
    });
    expect(checksOf(result)).toEqual(
      Array.from({ length: 16 }, (_, index) => `${index + 1}:manual`),
    );
  });

  it('cannot name a round: the plan depends only on the instant and the ledger', () => {
    const snapshot = deepFreeze(
      snapshotOf({ season: quietSeason(season23, FAR) }),
    );
    const input = { now, snapshot, trigger: 'manual' as const, rounds: [23] };
    expect(planRun(input)).toEqual(
      planRun({ now, snapshot, trigger: 'manual' }),
    );
  });
});

describe('planned resources', () => {
  it('are exactly the coordinator resources a run would request', () => {
    const result = plan(new Date('2026-06-21T12:17:00.000Z'), {
      season: quietSeason(weeklyCalendar(23, '2026-03-08T04:00:00.000Z'), FAR),
    });
    const resources: readonly CoordinatedResource[] = result.resources;

    expect(resources.length).toBe(5 + 16);
    for (const resource of resources) {
      expect(isCoordinatedResource(resource)).toBe(true);
    }
  });
});

describe('determinism', () => {
  it('answers the same plan for the same instant and ledger, and mutates neither', () => {
    const snapshot = deepFreeze(
      snapshotOf({
        season: quietSeason(
          weeklyCalendar(23, '2026-03-08T04:00:00.000Z'),
          FAR,
        ),
        classifications: [record(1, settledFields, '2026-03-08T04:00:00.000Z')],
      }),
    );
    const now = new Date('2026-06-21T12:17:00.000Z');
    const first = planRun({ now, snapshot, trigger: 'scheduled' });

    expect(planRun({ now, snapshot, trigger: 'scheduled' })).toEqual(first);
    expect(now.toISOString()).toBe('2026-06-21T12:17:00.000Z');
  });
});
