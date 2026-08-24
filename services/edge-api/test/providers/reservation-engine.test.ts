import { describe, expect, it } from 'vitest';

import {
  quotaPolicyFor,
  type ProviderQuotaPolicy,
} from '../../src/providers/provider-source';
import {
  emptyLedger,
  reconcileLedger,
  reserve,
  ReservationSourceMismatchError,
  type RealProviderSourceId,
  type ReservationLedger,
} from '../../src/providers/http/reservation-engine';

const base = Date.parse('2026-07-20T12:00:00.000Z');
const at = (offsetMillis: number) => new Date(base + offsetMillis);

function admit(
  ledger: ReservationLedger,
  sourceId: RealProviderSourceId,
  offsetMillis: number,
): ReservationLedger {
  const decision = reserve(ledger, quotaPolicyFor(sourceId), at(offsetMillis));
  expect(decision.outcome).toBe('allowed');
  return decision.ledger;
}

function fill(
  sourceId: RealProviderSourceId,
  count: number,
  offsetMillis = 0,
): ReservationLedger {
  let ledger = emptyLedger(sourceId);
  for (let index = 0; index < count; index += 1) {
    ledger = admit(ledger, sourceId, offsetMillis);
  }
  return ledger;
}

describe('per-second burst windows', () => {
  it('permits exactly 3 OpenF1 reservations in one second and defers the fourth', () => {
    const ledger = fill('openf1', 3);

    const fourth = reserve(ledger, quotaPolicyFor('openf1'), at(0));

    expect(fourth.outcome).toBe('deferred');
    if (fourth.outcome !== 'deferred') return;
    expect(fourth.limitingWindows.map((w) => w.window)).toEqual(['second']);
    expect(fourth.retryAt).toBe('2026-07-20T12:00:01.000Z');
  });

  it('permits exactly 4 Jolpica reservations in one second and defers the fifth', () => {
    const ledger = fill('jolpica', 4);

    const fifth = reserve(ledger, quotaPolicyFor('jolpica'), at(0));

    expect(fifth.outcome).toBe('deferred');
    if (fifth.outcome !== 'deferred') return;
    expect(fifth.limitingWindows.map((w) => w.window)).toEqual(['second']);
    expect(fifth.retryAt).toBe('2026-07-20T12:00:01.000Z');
  });
});

describe('sustained windows', () => {
  it('permits exactly 30 OpenF1 reservations per sliding minute, even with second capacity', () => {
    // Three per second across ten distinct seconds fills the minute exactly.
    let ledger = emptyLedger('openf1');
    for (let second = 0; second < 10; second += 1) {
      for (let index = 0; index < 3; index += 1) {
        ledger = admit(ledger, 'openf1', second * 1000);
      }
    }
    expect(ledger.timestamps).toHaveLength(30);

    // Second 11 is empty, so the burst window has room; the minute does not.
    const next = reserve(ledger, quotaPolicyFor('openf1'), at(11_000));

    expect(next.outcome).toBe('deferred');
    if (next.outcome !== 'deferred') return;
    expect(next.limitingWindows.map((w) => w.window)).toEqual(['minute']);
    expect(next.headroom.find((w) => w.window === 'second')?.remaining).toBe(3);
    expect(next.headroom.find((w) => w.window === 'minute')?.remaining).toBe(0);
  });

  it('permits exactly 500 Jolpica reservations per sliding hour and defers the next', () => {
    // Four per second across 125 distinct seconds fills the hour exactly.
    let ledger = emptyLedger('jolpica');
    for (let second = 0; second < 125; second += 1) {
      for (let index = 0; index < 4; index += 1) {
        ledger = admit(ledger, 'jolpica', second * 1000);
      }
    }
    expect(ledger.timestamps).toHaveLength(500);

    const next = reserve(ledger, quotaPolicyFor('jolpica'), at(126_000));

    expect(next.outcome).toBe('deferred');
    if (next.outcome !== 'deferred') return;
    expect(next.limitingWindows.map((w) => w.window)).toEqual(['hour']);
    // The first of the 500 expires one hour after it was taken.
    expect(next.retryAt).toBe('2026-07-20T13:00:00.000Z');
  });
});

describe('expiration boundary', () => {
  it('returns capacity exactly at the boundary, not a millisecond later', () => {
    const ledger = fill('openf1', 3);

    // One millisecond before: still full.
    expect(reserve(ledger, quotaPolicyFor('openf1'), at(999)).outcome).toBe(
      'deferred',
    );
    // Exactly at ts + duration the timestamp has expired.
    expect(reserve(ledger, quotaPolicyFor('openf1'), at(1000)).outcome).toBe(
      'allowed',
    );
  });
});

describe('all-or-nothing admission', () => {
  it('counts one reservation against every window of the source', () => {
    const ledger = admit(emptyLedger('jolpica'), 'jolpica', 0);
    const decision = reserve(ledger, quotaPolicyFor('jolpica'), at(0));

    expect(decision.outcome).toBe('allowed');
    if (decision.outcome !== 'allowed') return;
    // The single earlier timestamp is charged to the second and the hour.
    expect(
      decision.headroom.find((w) => w.window === 'second')?.remaining,
    ).toBe(2);
    expect(decision.headroom.find((w) => w.window === 'hour')?.remaining).toBe(
      498,
    );
  });

  it('mutates no window when any window is exhausted', () => {
    const ledger = fill('openf1', 3);
    const before = [...ledger.timestamps];

    const denied = reserve(ledger, quotaPolicyFor('openf1'), at(0));

    expect(denied.outcome).toBe('deferred');
    expect([...denied.ledger.timestamps]).toEqual(before);
    // The original object is untouched too: the engine is pure.
    expect([...ledger.timestamps]).toEqual(before);
  });

  it('reports retryAt as the earliest time every limiting window can admit', () => {
    // Fill the minute across ten seconds, then also saturate second 11.
    let ledger = emptyLedger('openf1');
    for (let second = 0; second < 9; second += 1) {
      for (let index = 0; index < 3; index += 1) {
        ledger = admit(ledger, 'openf1', second * 1000);
      }
    }
    for (let index = 0; index < 3; index += 1) {
      ledger = admit(ledger, 'openf1', 30_000);
    }
    expect(ledger.timestamps).toHaveLength(30);

    const denied = reserve(ledger, quotaPolicyFor('openf1'), at(30_000));

    expect(denied.outcome).toBe('deferred');
    if (denied.outcome !== 'deferred') return;
    // Both windows are limiting; the minute clears later than the second, so
    // the minute's boundary is the answer.
    expect(denied.limitingWindows.map((w) => w.window).sort()).toEqual([
      'minute',
      'second',
    ]);
    expect(denied.retryAt).toBe('2026-07-20T12:01:00.000Z');
    // And at exactly that instant the reservation succeeds.
    expect(
      reserve(ledger, quotaPolicyFor('openf1'), new Date(denied.retryAt))
        .outcome,
    ).toBe('allowed');
  });
});

describe('source isolation', () => {
  it('keeps Jolpica and OpenF1 budgets independent', () => {
    const jolpica = fill('jolpica', 4);

    // Jolpica is saturated for this second; OpenF1 is untouched.
    expect(reserve(jolpica, quotaPolicyFor('jolpica'), at(0)).outcome).toBe(
      'deferred',
    );
    expect(
      reserve(emptyLedger('openf1'), quotaPolicyFor('openf1'), at(0)).outcome,
    ).toBe('allowed');
  });

  it('rejects a mismatched source identity before any mutation', () => {
    const jolpica = fill('jolpica', 1);

    expect(() =>
      reserve(jolpica, quotaPolicyFor('openf1'), at(0)),
    ).toThrowError(ReservationSourceMismatchError);
    expect(() => reconcileLedger(jolpica, 'openf1', at(0))).toThrowError(
      ReservationSourceMismatchError,
    );
    // The ledger is unchanged.
    expect(jolpica.timestamps).toHaveLength(1);
  });

  it('refuses to pace the network-free mock source', () => {
    const ledger = emptyLedger('jolpica');

    expect(() =>
      reserve(
        { ...ledger, sourceId: 'mock' } as unknown as ReservationLedger,
        quotaPolicyFor('mock'),
        at(0),
      ),
    ).toThrowError(ReservationSourceMismatchError);
  });
});

describe('boundedness and policy reconciliation', () => {
  it('prunes expired timestamps and keeps storage bounded by the longest limit', () => {
    let ledger = emptyLedger('openf1');
    for (let second = 0; second < 200; second += 1) {
      const decision = reserve(
        ledger,
        quotaPolicyFor('openf1'),
        at(second * 1000),
      );
      if (decision.outcome === 'allowed') ledger = decision.ledger;
    }

    // The minute is the longest OpenF1 window, so at most its limit survives.
    expect(ledger.timestamps.length).toBeLessThanOrEqual(30);
    const oldest = Math.min(...ledger.timestamps);
    expect(oldest).toBeGreaterThan(base + 199_000 - 60_000);
  });

  it('assumes no daily window for either adopted source', () => {
    for (const sourceId of ['jolpica', 'openf1'] as const) {
      for (const window of quotaPolicyFor(sourceId).windows) {
        expect(window.durationSeconds).toBeLessThan(86_400);
      }
    }
  });

  it('never fabricates reservations when the policy lengthens a window', () => {
    // Three real observations, then a policy whose window is far longer.
    const ledger = fill('openf1', 3);
    const lengthened: ProviderQuotaPolicy = {
      sourceId: 'openf1',
      testOnly: false,
      windows: [
        {
          window: 'hour',
          windowClass: 'sustained',
          limit: 100,
          durationSeconds: 3600,
        },
      ],
    };

    const decision = reserve(ledger, lengthened, at(0));

    expect(decision.outcome).toBe('allowed');
    if (decision.outcome !== 'allowed') return;
    // Exactly the three real timestamps are counted; nothing is invented to
    // "fill" the newly longer window.
    expect(decision.headroom[0]?.remaining).toBe(96);
    expect(decision.ledger.timestamps).toHaveLength(4);
  });

  it('forgets history a shortened window may no longer count', () => {
    let ledger = emptyLedger('jolpica');
    for (let second = 0; second < 3; second += 1) {
      ledger = admit(ledger, 'jolpica', second * 1000);
    }
    const shortened: ProviderQuotaPolicy = {
      sourceId: 'jolpica',
      testOnly: false,
      windows: [
        {
          window: 'second',
          windowClass: 'burst',
          limit: 4,
          durationSeconds: 1,
        },
      ],
    };

    const decision = reserve(ledger, shortened, at(2000));

    expect(decision.outcome).toBe('allowed');
    if (decision.outcome !== 'allowed') return;
    // Only the timestamp inside the one-second horizon survives, plus the new
    // one. Nothing older is retained as authoritative.
    expect(decision.ledger.timestamps).toEqual([base + 2000, base + 2000]);
  });

  it('discards non-finite stored values rather than trusting them', () => {
    const corrupt: ReservationLedger = {
      sourceId: 'openf1',
      timestamps: [Number.NaN, base, Number.POSITIVE_INFINITY],
    };

    const reconciled = reconcileLedger(corrupt, 'openf1', at(0));

    expect(reconciled.timestamps).toEqual([base]);
  });
});
