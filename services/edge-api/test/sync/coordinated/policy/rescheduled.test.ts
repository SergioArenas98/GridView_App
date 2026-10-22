/**
 * A race the calendar moves after its round was first asked for: the
 * cadence follows Jolpica's scheduled start (Evaluation §10.4), so a round
 * with nothing observed yet is re-anchored on the moved start, while a round
 * with a result accepted or pending keeps the anchor its result was read
 * against.
 */

import { describe, expect, it } from 'vitest';

import type { ClassificationRecord } from '../../../../src/sync/coordinated/ledger';
import {
  planRun,
  rescheduledClassificationRecord,
  type RunPlan,
} from '../../../../src/sync/coordinated/policy';
import {
  ANCHOR,
  DAY,
  HOUR,
  Simulation,
  anchorOf,
  cadenceSlots,
  classification,
  deepFreeze,
  failed,
  observed,
  plus,
  quietSeason,
  rev,
  snapshotOf,
} from './support';

const A = rev('A');
const FAR = '2027-06-01T00:00:00.000Z';

function checksOf(result: RunPlan): string[] {
  return result.kind === 'publication'
    ? result.checks.map((check) =>
        check.check === 'cadence'
          ? `${check.round}:cadence:${check.slot}`
          : `${check.round}:${check.check}`,
      )
    : [];
}

function planAt(
  now: Date,
  start: string,
  record: ClassificationRecord,
): RunPlan {
  return planRun({
    now,
    snapshot: deepFreeze(
      snapshotOf({
        season: quietSeason([anchorOf(1, start)], FAR),
        classifications: [record],
      }),
    ),
    trigger: 'scheduled',
  });
}

/** Round 1 checked through its window at `ANCHOR`, nothing ever seen. */
const unanswered = (overrides: Partial<ClassificationRecord> = {}) =>
  classification(1, {
    anchor: ANCHOR,
    checkIndex: 10,
    nextDueAt: plus(ANCHOR, 15 * HOUR).toISOString(),
    ...overrides,
  });

/** The first tick that accepted round 1's result. */
function firstWriteAt(simulation: Simulation): string | undefined {
  return simulation.ticks
    .find((tick) =>
      tick.result?.events.some(
        (event) => event.category === 'classification.first-write',
      ),
    )
    ?.now.toISOString();
}

function rescheduledEvents(simulation: Simulation): number {
  return simulation.ticks.reduce(
    (total, tick) =>
      total +
      (tick.result?.events.filter(
        (event) => event.category === 'classification.rescheduled',
      ).length ?? 0),
    0,
  );
}

describe('a race moved after its first check', () => {
  it('is not asked for again before its new start + 1 h 30 min', () => {
    const moved = plus(ANCHOR, 3 * DAY).toISOString();
    // Day 2 of the old cadence: without the move, slot 13 is due.
    expect(
      checksOf(planAt(plus(ANCHOR, 2 * DAY + HOUR), moved, unanswered())),
    ).toEqual([]);
    expect(
      checksOf(planAt(plus(moved, 2 * HOUR), moved, unanswered())),
    ).toEqual(['1:cadence:1']);
  });

  it('restarts its cadence from the new start, and its result is published as on time', async () => {
    const moved = plus(ANCHOR, 3 * DAY);
    const simulation = new Simulation([anchorOf(1, ANCHOR)]).script(1, (now) =>
      now.getTime() >= plus(moved, 2 * HOUR).getTime() ? observed(A) : failed,
    );
    await simulation.tick(plus(ANCHOR, -DAY));
    await simulation.run(plus(ANCHOR, HOUR), plus(ANCHOR, 12 * HOUR));
    expect(simulation.record(1)).toMatchObject({
      anchor: ANCHOR,
      checkIndex: 10,
    });

    simulation.calendar = [anchorOf(1, moved.toISOString())];
    const after = await simulation.run(
      plus(ANCHOR, 12 * HOUR),
      plus(moved, 4 * HOUR),
    );

    // The old anchor's + 15 h check runs on the calendar it planned from;
    // that run observes the move, and the round waits for its new start.
    expect(cadenceSlots(after, 1)).toEqual([11, 1, 2]);
    expect(firstWriteAt(simulation)).toBe(
      plus(moved, 3 * HOUR + 17 * (HOUR / 60)).toISOString(),
    );
    expect(simulation.record(1)).toMatchObject({
      anchor: moved.toISOString(),
      checkIndex: 2,
      contentRevision: A,
      terminalReason: null,
    });
    expect(rescheduledEvents(simulation)).toBe(1);
  });

  it('is asked for again after its first ceiling when the race was moved beyond it', async () => {
    const moved = plus(ANCHOR, 16 * DAY);
    const simulation = new Simulation([anchorOf(1, ANCHOR)]).script(1, (now) =>
      now.getTime() >= plus(moved, 2 * HOUR).getTime() ? observed(A) : failed,
    );
    await simulation.tick(plus(ANCHOR, -DAY));
    await simulation.run(plus(ANCHOR, HOUR), plus(ANCHOR, 15 * DAY));
    expect(simulation.record(1)?.terminalReason).toBe(
      'never-reconciled-abandoned',
    );

    simulation.calendar = [anchorOf(1, moved.toISOString())];
    await simulation.run(plus(ANCHOR, 15 * DAY), plus(moved, 4 * HOUR));

    expect(firstWriteAt(simulation)).toBe(
      plus(moved, 3 * HOUR + 17 * (HOUR / 60)).toISOString(),
    );
    expect(simulation.record(1)).toMatchObject({
      anchor: moved.toISOString(),
      contentRevision: A,
      terminalReason: null,
    });
  });

  it('follows every later move until a result is observed', async () => {
    const first = plus(ANCHOR, 3 * DAY);
    const second = plus(ANCHOR, 5 * DAY);
    const simulation = new Simulation([anchorOf(1, ANCHOR)]).script(1, (now) =>
      now.getTime() >= plus(second, 2 * HOUR).getTime() ? observed(A) : failed,
    );
    await simulation.tick(plus(ANCHOR, -DAY));
    await simulation.run(plus(ANCHOR, HOUR), plus(ANCHOR, 12 * HOUR));

    simulation.calendar = [anchorOf(1, first.toISOString())];
    await simulation.run(plus(ANCHOR, 12 * HOUR), plus(first, 4 * HOUR));
    expect(simulation.record(1)).toMatchObject({
      anchor: first.toISOString(),
      contentRevision: null,
    });

    // Moved again before anything was observed: it restarts once more.
    simulation.calendar = [anchorOf(1, second.toISOString())];
    const after = await simulation.run(
      plus(first, 4 * HOUR),
      plus(second, 4 * HOUR),
    );

    expect(cadenceSlots(after, 1)).toEqual([3, 1, 2]);
    expect(firstWriteAt(simulation)).toBe(
      plus(second, 3 * HOUR + 17 * (HOUR / 60)).toISOString(),
    );
    expect(simulation.record(1)).toMatchObject({
      anchor: second.toISOString(),
      contentRevision: A,
    });
    expect(rescheduledEvents(simulation)).toBe(2);
  });

  describe('once its new ceiling has passed', () => {
    const abandoned = () =>
      unanswered({
        checkIndex: 25,
        nextDueAt: null,
        terminalReason: 'never-reconciled-abandoned',
      });
    const now = plus(ANCHOR, 15 * DAY);

    it('is not revived, so a calendar alternating between old starts asks nothing', () => {
      const behind = plus(ANCHOR, 12 * HOUR).toISOString();
      expect(checksOf(planAt(now, behind, abandoned()))).toEqual([]);
      expect(checksOf(planAt(now, ANCHOR, abandoned()))).toEqual([]);
    });

    it('is revived while the new ceiling is ahead', () => {
      const ahead = plus(ANCHOR, 2 * DAY).toISOString();
      expect(checksOf(planAt(now, ahead, abandoned()))).toEqual([
        '1:cadence:24',
      ]);
    });
  });
});

describe('a round that is not re-anchored', () => {
  const moved = plus(ANCHOR, 7 * DAY).toISOString();

  it('keeps the anchor a pending first sighting was read against', () => {
    const pending = unanswered({
      checkIndex: 1,
      candidateRevision: A,
      candidateFirstSeenAt: plus(ANCHOR, 2 * HOUR).toISOString(),
      markers: ['pending'],
    });
    expect(
      rescheduledClassificationRecord(pending, anchorOf(1, moved)),
    ).toBeNull();
    expect(checksOf(planAt(plus(ANCHOR, 3 * HOUR), moved, pending))).toEqual([
      '1:cadence:2',
    ]);
  });

  it('keeps the anchor of an accepted result', () => {
    const accepted = unanswered({
      contentRevision: A,
      provenance: 'reconciled',
      reviewState: 'unsettled',
      consecutiveConfirmations: 1,
    });
    expect(
      rescheduledClassificationRecord(accepted, anchorOf(1, moved)),
    ).toBeNull();
  });

  it('keeps the anchor of a result the authority serves', () => {
    const served = unanswered({ publishedRevision: A });
    expect(
      rescheduledClassificationRecord(served, anchorOf(1, moved)),
    ).toBeNull();
  });

  it.each([
    [
      'a pending first sighting',
      { candidateRevision: A, markers: ['pending' as const] },
    ],
    [
      'an accepted result',
      {
        contentRevision: A,
        provenance: 'reconciled' as const,
        reviewState: 'unsettled' as const,
        consecutiveConfirmations: 1,
      },
    ],
  ])('keeps the original 14-day ceiling of %s', (_label, observedFields) => {
    const record = unanswered({
      checkIndex: 24,
      nextDueAt: plus(ANCHOR, 14 * DAY).toISOString(),
      candidateFirstSeenAt:
        'candidateRevision' in observedFields
          ? plus(ANCHOR, 2 * HOUR).toISOString()
          : null,
      ...observedFields,
    });
    expect(
      checksOf(planAt(plus(ANCHOR, 14 * DAY + HOUR), moved, record)),
    ).toEqual(['1:cadence:25']);
  });

  it('is unchanged when the calendar still names its anchor', () => {
    expect(
      rescheduledClassificationRecord(unanswered(), anchorOf(1, ANCHOR)),
    ).toBeNull();
  });

  it('re-anchors only the cadence of a round with nothing observed', () => {
    const before = deepFreeze(
      unanswered({
        lastAttemptedAt: plus(ANCHOR, 11 * HOUR).toISOString(),
        terminalReason: 'never-reconciled-abandoned',
        nextDueAt: null,
      }),
    );
    const after = rescheduledClassificationRecord(
      before,
      anchorOf(1, moved, 'date-eod'),
    );
    expect(after).toEqual({
      ...before,
      anchor: moved,
      anchorKind: 'date-eod',
      checkIndex: 0,
      nextDueAt: plus(moved, 90 * (HOUR / 60)).toISOString(),
      terminalReason: null,
    });
  });
});
