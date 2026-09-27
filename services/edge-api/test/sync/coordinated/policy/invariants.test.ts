/**
 * ADR 0020 §3 I1-I5, each shown on its own by driving the planner and policy
 * over the real C1 store on hourly minute-17 ticks, with scripted Jolpica
 * answers. Nothing here contacts a provider.
 */

import { describe, expect, it } from 'vitest';

import { checkTime } from '../../../../src/sync/coordinated/policy';
import {
  ANCHOR,
  DAY,
  HOUR,
  Simulation,
  anchorOf,
  cadenceSlots,
  failed,
  observed,
  plus,
  rev,
  tickAtOrAfter,
  type RoundScript,
  type TickResult,
} from './support';

const A = rev('A');
const B = rev('B');

/** Answers `before` until `from`, then `after`. */
function switching(
  from: Date,
  before: RoundScript,
  after: RoundScript,
): RoundScript {
  return (now) => (now.getTime() < from.getTime() ? before(now) : after(now));
}
const always =
  (outcome: ReturnType<RoundScript>): RoundScript =>
  () =>
    outcome;
const slotTick = (slot: number) => tickAtOrAfter(checkTime(ANCHOR, slot));

/** Bootstraps the calendar and the season-level resources two days ahead. */
async function started(script: RoundScript): Promise<Simulation> {
  const simulation = new Simulation([anchorOf(1, ANCHOR)]).script(1, script);
  await simulation.run(plus(ANCHOR, -2 * DAY), plus(ANCHOR, -2 * DAY + HOUR));
  return simulation;
}

/** Ticks only at each cadence slot, the minimum a scheduled cron must serve. */
async function atSlots(
  simulation: Simulation,
  last = 17,
): Promise<TickResult[]> {
  const ticks: TickResult[] = [];
  for (let slot = 1; slot <= last; slot += 1) {
    ticks.push(await simulation.tick(slotTick(slot)));
  }
  return ticks;
}

function publishedTicks(ticks: readonly TickResult[]) {
  return ticks.filter((tick) => tick.result?.decision.publishable === true);
}

describe('I1: corroboration is reachable', () => {
  /** No result before `slot - 1`, the first result there, a change from `slot`. */
  const changingAt = (slot: number): RoundScript =>
    switching(
      checkTime(ANCHOR, slot - 1),
      always(failed),
      switching(
        checkTime(ANCHOR, slot),
        always(observed(A)),
        always(observed(B)),
      ),
    );

  it.each([2, 9, 16])(
    'a revision first seen at unsettled slot %i has a next check, where it is confirmed',
    async (slot) => {
      const simulation = await started(changingAt(slot));
      const ticks = await atSlots(simulation, slot + 1);
      const sighted = simulation.record(1, ticks[slot - 1]!.snapshot)!;
      const applied = simulation.record(1, ticks[slot]!.snapshot)!;

      expect(sighted.reviewState).toBe('unsettled');
      expect(sighted.candidateRevision).toBe(B);
      expect(sighted.nextDueAt).toBe(checkTime(ANCHOR, slot + 1).toISOString());
      expect(applied.contentRevision).toBe(B);
      expect(applied.supersededRevisions).toEqual([A]);
    },
  );

  it('a revision first seen at the ceiling is staged for an operator, not lost', async () => {
    const simulation = await started(changingAt(17));
    await atSlots(simulation);
    const record = simulation.record(1)!;

    expect(record.contentRevision).toBe(A);
    expect(record.stagedCorrection).toMatchObject({
      revision: B,
      uncorroborated: true,
    });
    expect(simulation.ticks.at(-1)!.snapshot.backlog.entries).toHaveLength(1);
  });

  it('a late change to a settled round has a next read on the slow path', async () => {
    const simulation = await started(
      switching(
        plus(ANCHOR, 10 * DAY),
        always(observed(A)),
        always(observed(B)),
      ),
    );
    const ticks = await simulation.run(
      plus(ANCHOR, -DAY),
      plus(ANCHOR, 30 * DAY),
    );
    const sighted = ticks.find(
      (tick) => simulation.record(1, tick.snapshot)?.candidateRevision === B,
    )!;
    const staged = ticks.find(
      (tick) => simulation.record(1, tick.snapshot)?.stagedCorrection !== null,
    )!;

    expect(staged.now.getTime() - sighted.now.getTime()).toBeLessThanOrEqual(
      7 * DAY + HOUR,
    );
  });
});

describe('I2: settlement is reachable from every starting point', () => {
  it.each(Array.from({ length: 17 }, (_, index) => index + 1))(
    'a first result at slot %i settles by the ceiling',
    async (first) => {
      const simulation = await started(
        switching(
          checkTime(ANCHOR, first),
          always(failed),
          always(observed(A)),
        ),
      );
      await atSlots(simulation);
      const record = simulation.record(1)!;
      const settlesAt = first <= 15 ? Math.max(4, first + 2) : 17;

      expect(record.reviewState).toBe('settled');
      expect(record.terminalReason).toBe(
        first <= 15 ? 'settled' : 'settled-on-deadline',
      );
      expect(record.settledAt).toBe(slotTick(settlesAt).toISOString());
      expect(record.contentRevision).toBe(A);
    },
  );

  it('a corroborated change settles after one further identical check from +24h', async () => {
    const simulation = await started(
      switching(checkTime(ANCHOR, 2), always(observed(A)), always(observed(B))),
    );
    await atSlots(simulation, 4);
    const record = simulation.record(1)!;

    expect(record.contentRevision).toBe(B);
    expect(record.terminalReason).toBe('settled');
    expect(record.settledAt).toBe(slotTick(4).toISOString());
  });

  it('a record held pending by alternating revisions still settles at the ceiling', async () => {
    let call = 0;
    const simulation = await started(() =>
      observed(rev(`flapping-${call++ % 2}`)),
    );
    await atSlots(simulation);
    const record = simulation.record(1)!;

    expect(record.terminalReason).toBe('settled-on-deadline');
    expect(record.settledAt).toBe(slotTick(17).toISOString());
  });
});

describe('a failed check between observations (T6)', () => {
  /** Answers per slot, by the slot whose time has most recently come. */
  const bySlot =
    (answers: Record<number, ReturnType<RoundScript>>): RoundScript =>
    (now) => {
      let slot = 0;
      for (let next = 1; next <= 17; next += 1) {
        if (checkTime(ANCHOR, next).getTime() <= now.getTime()) slot = next;
      }
      return answers[slot] ?? failed;
    };

  it('keeps the confirmations it interrupts, so settlement is not delayed', async () => {
    const simulation = await started(
      bySlot({ 1: observed(A), 2: observed(A), 3: failed, 4: observed(A) }),
    );
    await atSlots(simulation, 4);
    const record = simulation.record(1)!;

    expect(record.consecutiveConfirmations).toBe(3);
    expect(record.terminalReason).toBe('settled');
    expect(record.settledAt).toBe(slotTick(4).toISOString());
  });

  it('neither corroborates nor discards a pending revision', async () => {
    const simulation = await started(
      bySlot({ 1: observed(A), 2: observed(B), 3: failed, 4: observed(B) }),
    );
    const ticks = await atSlots(simulation, 4);

    expect(simulation.record(1, ticks[2]!.snapshot)).toMatchObject({
      contentRevision: A,
      candidateRevision: B,
    });
    expect(simulation.record(1)).toMatchObject({
      contentRevision: B,
      supersededRevisions: [A],
    });
  });
});

describe('I3: dense and daily polling terminate', () => {
  it.each([
    ['an ordinary result', always(observed(A)), [1, 2, 3, 4]],
    [
      'a source that never answers',
      always(failed),
      Array.from({ length: 17 }, (_, i) => i + 1),
    ],
  ] as const)(
    '%s is checked on a bounded cadence and then never again',
    async (_label, script, slots) => {
      const simulation = await started(script);
      const ticks = await simulation.run(
        plus(ANCHOR, -DAY),
        plus(ANCHOR, 30 * DAY),
      );

      expect(cadenceSlots(ticks, 1)).toEqual(slots);
      expect(simulation.record(1)!.nextDueAt).toBeNull();
    },
  );

  it('never makes more than 17 cadence checks, whatever the source does', async () => {
    let call = 0;
    const simulation = await started(() =>
      call++ % 3 === 0 ? failed : observed(rev(`noise-${call}`)),
    );
    const ticks = await simulation.run(
      plus(ANCHOR, -DAY),
      plus(ANCHOR, 30 * DAY),
    );

    expect(cadenceSlots(ticks, 1).length).toBeLessThanOrEqual(17);
    expect(simulation.record(1)!.terminalReason).not.toBeNull();
  });
});

describe('I4: a late correction stays observable through the slow reread path', () => {
  it('rereads the same classification after settlement and stages the change, never applying it', async () => {
    const correctedAt = plus(ANCHOR, 20 * DAY);
    const simulation = await started(
      switching(correctedAt, always(observed(A)), always(observed(B))),
    );
    const ticks = await simulation.run(
      plus(ANCHOR, -DAY),
      plus(ANCHOR, 45 * DAY),
    );

    const rereads = ticks.filter(
      (tick) =>
        tick.plan.kind === 'publication' &&
        tick.plan.checks.some(
          (check) => check.round === 1 && check.check === 'reread',
        ),
    );
    // The weekly season-level refresh rereads the settled round at most a week apart.
    expect(rereads.length).toBeGreaterThan(3);
    for (let index = 1; index < rereads.length; index += 1) {
      const gap =
        rereads[index]!.now.getTime() - rereads[index - 1]!.now.getTime();
      expect(gap).toBeLessThanOrEqual(7 * DAY + HOUR);
    }
    const afterCorrection = rereads.filter((tick) => tick.now >= correctedAt);
    expect(afterCorrection[0]!.result!.decision).toEqual({
      publishable: false,
      reasons: ['classification-pending'],
    });
    expect(afterCorrection[1]!.result!.decision).toEqual({
      publishable: false,
      reasons: ['classification-staged'],
    });
    expect(
      afterCorrection[1]!.result!.events.map((event) => event.category),
    ).toContain('classification.staged-correction');

    const record = simulation.record(1)!;
    expect(record.contentRevision).toBe(A);
    expect(record.publishedRevision).toBe(A);
    expect(record.stagedCorrection?.revision).toBe(B);
    expect(publishedTicks(ticks).every((tick) => tick.now < correctedAt)).toBe(
      true,
    );
  });
});

describe('I5: the ordinary case targets reconciled data within 24 hours', () => {
  it('publishes at the first check after +5h and settles at +24h', async () => {
    const simulation = await started(always(observed(A)));
    const ticks = await simulation.run(
      plus(ANCHOR, -DAY),
      plus(ANCHOR, 2 * DAY),
    );
    const first = publishedTicks(ticks).find(
      (tick) =>
        tick.result!.decision.publishable &&
        tick.result!.decision.rounds.some((entry) => entry.round === 1),
    )!;

    expect(first.now.toISOString()).toBe('2026-10-04T18:17:00.000Z');
    expect(first.now.getTime() - Date.parse(ANCHOR)).toBeLessThan(DAY);
    expect(simulation.record(1)!.publishedRevision).toBe(A);
    expect(simulation.record(1)!.settledAt).toBe('2026-10-05T13:17:00.000Z');
  });

  it('is an objective, not a guarantee: a late source is published when it answers', async () => {
    const simulation = await started(
      switching(plus(ANCHOR, 30 * HOUR), always(failed), always(observed(A))),
    );
    const ticks = await simulation.run(
      plus(ANCHOR, -DAY),
      plus(ANCHOR, 3 * DAY),
    );
    const first = publishedTicks(ticks).find(
      (tick) =>
        tick.result!.decision.publishable &&
        tick.result!.decision.rounds.some((entry) => entry.round === 1),
    )!;

    // The next due check after the source answers is the day-2 check.
    expect(first.now.toISOString()).toBe(slotTick(5).toISOString());
    expect(first.now.getTime() - Date.parse(ANCHOR)).toBeGreaterThan(DAY);
  });
});
