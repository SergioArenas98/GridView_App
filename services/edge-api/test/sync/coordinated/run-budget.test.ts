/**
 * The run budget's constants and its two gates, alone (RB-1 to RB-3, RB-5).
 * The entry-point tests drive the same budget through the Worker.
 */

import { describe, expect, it, vi } from 'vitest';

import { LEASE_TTL_MS } from '../../../src/sync/coordinated/ledger/model';
import {
  COORDINATION_DEADLINE_MS,
  INTENT_DEADLINE_MS,
  PUBLICATION_LEASE_RESERVE_MS,
  intentGateOpen,
  startRunBudget,
  type RunBudgetTimer,
} from '../../../src/sync/coordinated/run-budget';

/** The Cron Trigger wall-clock limit (Workers limits, read 2026-10-06). */
const CRON_WALL_MS = 15 * 60 * 1000;
const T0 = new Date('2026-03-01T17:17:00.000Z');
const at = (millis: number) => new Date(T0.getTime() + millis);

function recordingTimer() {
  const armed: { delay: number; expire: () => void }[] = [];
  let disarms = 0;
  const timer: RunBudgetTimer = (delay, expire) => {
    armed.push({ delay, expire });
    return () => {
      disarms += 1;
    };
  };
  return { timer, armed, disarms: () => disarms };
}

describe('the run budget constants', () => {
  it('are the owner values, and fit inside the lease and the cron wall', () => {
    expect([
      COORDINATION_DEADLINE_MS,
      INTENT_DEADLINE_MS,
      PUBLICATION_LEASE_RESERVE_MS,
    ]).toEqual([240_000, 300_000, 300_000]);
    expect(COORDINATION_DEADLINE_MS).toBeLessThan(INTENT_DEADLINE_MS);
    // A run that commits intent at its last instant still holds the reserve.
    expect(
      INTENT_DEADLINE_MS + PUBLICATION_LEASE_RESERVE_MS,
    ).toBeLessThanOrEqual(LEASE_TTL_MS);
    expect(LEASE_TTL_MS).toBeLessThan(CRON_WALL_MS);
  });
});

describe('the coordination deadline', () => {
  it('arms one timer at the deadline, which aborts the run signal', () => {
    const { timer, armed } = recordingTimer();
    const budget = startRunBudget({ startedAt: T0, timer });

    expect(armed.map(({ delay }) => delay)).toEqual([COORDINATION_DEADLINE_MS]);
    expect(budget.signal.aborted).toBe(false);
    armed[0]!.expire();
    expect(budget.signal.aborted).toBe(true);
  });

  it('begins coordination cancelled at or after the deadline, on the clock it is given', () => {
    const early = startRunBudget({
      startedAt: T0,
      timer: recordingTimer().timer,
    });
    early.enterCoordination(at(COORDINATION_DEADLINE_MS - 1));
    expect(early.signal.aborted).toBe(false);

    const late = startRunBudget({
      startedAt: T0,
      timer: recordingTimer().timer,
    });
    late.enterCoordination(at(COORDINATION_DEADLINE_MS));
    expect(late.signal.aborted).toBe(true);
  });

  it('links a caller signal, before and after it starts, and unlinks it when disarmed', () => {
    const before = new AbortController();
    before.abort();
    expect(
      startRunBudget({
        startedAt: T0,
        timer: recordingTimer().timer,
        linked: before.signal,
      }).signal.aborted,
    ).toBe(true);

    const during = new AbortController();
    const linked = startRunBudget({
      startedAt: T0,
      timer: recordingTimer().timer,
      linked: during.signal,
    });
    during.abort();
    expect(linked.signal.aborted).toBe(true);

    const after = new AbortController();
    const disarmed = startRunBudget({
      startedAt: T0,
      timer: recordingTimer().timer,
      linked: after.signal,
    });
    disarmed.disarm();
    disarmed.disarm();
    after.abort();
    expect(disarmed.signal.aborted).toBe(false);
  });

  it('disarms its timer once', () => {
    const { timer, disarms } = recordingTimer();
    const budget = startRunBudget({ startedAt: T0, timer });
    budget.disarm();
    budget.disarm();
    expect(disarms()).toBe(1);
  });

  it('times the deadline with a real timer by default', () => {
    vi.useFakeTimers();
    try {
      const budget = startRunBudget({ startedAt: T0 });
      vi.advanceTimersByTime(COORDINATION_DEADLINE_MS - 1);
      expect(budget.signal.aborted).toBe(false);
      vi.advanceTimersByTime(1);
      expect(budget.signal.aborted).toBe(true);

      const disarmed = startRunBudget({ startedAt: T0 });
      disarmed.disarm();
      vi.advanceTimersByTime(COORDINATION_DEADLINE_MS);
      expect(disarmed.signal.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the intent gate', () => {
  const lease = at(10 * 60 * 1000).toISOString();

  it('is open up to the intent deadline, inclusive', () => {
    expect(intentGateOpen(T0, at(INTENT_DEADLINE_MS), lease)).toBe(true);
    // Under a lease that a skewed ledger clock still reports as long.
    const long = at(60 * 60 * 1000).toISOString();
    expect(intentGateOpen(T0, at(INTENT_DEADLINE_MS + 1), long)).toBe(false);
  });

  it('needs the full reserve left on the lease, inclusive', () => {
    const acquiredLate = at(LEASE_TTL_MS - 10_000).toISOString();
    const edge = Date.parse(acquiredLate) - PUBLICATION_LEASE_RESERVE_MS;
    expect(intentGateOpen(T0, new Date(edge), acquiredLate)).toBe(true);
    expect(intentGateOpen(T0, new Date(edge + 1), acquiredLate)).toBe(false);
  });
});
