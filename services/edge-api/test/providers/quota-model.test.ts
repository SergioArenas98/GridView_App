import { describe, expect, it } from 'vitest';

import {
  burstSaturationStreakCap,
  emptyQuotaState,
  evaluateWarningLevel,
  hasRepeatedBurstSaturation,
  recordProviderAttempt,
  sustainedWarningThresholds,
} from '../../src/providers/quota-model';
import type { ProviderSourceId } from '../../src/providers/provider-source';
import type { QuotaState, QuotaWindowState } from '../../src/storage/types';

const at = new Date('2026-07-20T12:00:00.000Z');

function sustained(limit: number, remaining: number): QuotaWindowState {
  return {
    window: 'hour',
    windowClass: 'sustained',
    limit,
    durationSeconds: 3600,
    used: limit - remaining,
    remaining,
    windowStartedAt: at.toISOString(),
    resetsAt: new Date(at.getTime() + 3_600_000).toISOString(),
    saturationStreak: 0,
  };
}

function stateWith(
  windows: QuotaWindowState[],
  sourceId: ProviderSourceId = 'jolpica',
): QuotaState {
  return { ...emptyQuotaState(sourceId, at), windows };
}

describe('sustained-window warning boundaries', () => {
  it('uses the documented 30 / 15 / 5 percent remaining thresholds', () => {
    expect(sustainedWarningThresholds).toEqual({
      warning: 0.3,
      high: 0.15,
      critical: 0.05,
    });

    // Limit 100 makes each boundary an exact integer remaining count.
    expect(evaluateWarningLevel(stateWith([sustained(100, 31)]))).toBe(
      'normal',
    );
    expect(evaluateWarningLevel(stateWith([sustained(100, 30)]))).toBe(
      'warning',
    );
    expect(evaluateWarningLevel(stateWith([sustained(100, 16)]))).toBe(
      'warning',
    );
    expect(evaluateWarningLevel(stateWith([sustained(100, 15)]))).toBe('high');
    expect(evaluateWarningLevel(stateWith([sustained(100, 6)]))).toBe('high');
    expect(evaluateWarningLevel(stateWith([sustained(100, 5)]))).toBe(
      'critical',
    );
    expect(evaluateWarningLevel(stateWith([sustained(100, 0)]))).toBe(
      'critical',
    );
  });

  it('lets the most severe window decide when several are configured', () => {
    const level = evaluateWarningLevel(
      stateWith([sustained(100, 90), sustained(100, 4)]),
    );

    expect(level).toBe('critical');
  });
});

describe('burst-window saturation', () => {
  it('does not let one normally saturated burst window look like sustained exhaustion', () => {
    // Jolpica publishes 4 requests/second. Saturating one second while the
    // hour is nearly untouched is the batch behaviour the source permits.
    let state: QuotaState | null = null;
    for (let index = 0; index < 4; index += 1) {
      state = recordProviderAttempt(state, 'jolpica', {
        at,
        outcome: 'successful',
        jobCategories: ['standings'],
      });
    }

    const burst = state!.windows.find(
      (window) => window.windowClass === 'burst',
    );
    expect(burst?.remaining).toBe(0);
    expect(burst?.saturationStreak).toBe(1);
    expect(hasRepeatedBurstSaturation(state!)).toBe(false);
    // The sustained hour still has 496 of 500 left, so nothing escalates.
    expect(state!.warningLevel).toBe('normal');
  });

  it('keeps repeated burst saturation observable', () => {
    let state: QuotaState | null = null;
    let clock = at;
    for (let second = 0; second < 2; second += 1) {
      for (let index = 0; index < 4; index += 1) {
        state = recordProviderAttempt(state, 'jolpica', {
          at: clock,
          outcome: 'successful',
          jobCategories: ['standings'],
        });
      }
      clock = new Date(clock.getTime() + 1000);
    }

    const burst = state!.windows.find(
      (window) => window.windowClass === 'burst',
    );
    expect(burst?.saturationStreak).toBe(2);
    expect(hasRepeatedBurstSaturation(state!)).toBe(true);
    expect(state!.warningLevel).toBe('warning');
  });

  it('breaks the streak when a burst window passes without saturating', () => {
    let state: QuotaState | null = null;
    let clock = at;
    for (let index = 0; index < 4; index += 1) {
      state = recordProviderAttempt(state, 'jolpica', {
        at: clock,
        outcome: 'successful',
        jobCategories: ['standings'],
      });
    }
    // Two later seconds, each with a single request: neither saturates.
    for (let second = 5; second < 7; second += 1) {
      clock = new Date(at.getTime() + second * 1000);
      state = recordProviderAttempt(state, 'jolpica', {
        at: clock,
        outcome: 'successful',
        jobCategories: ['standings'],
      });
    }

    const burst = state!.windows.find(
      (window) => window.windowClass === 'burst',
    );
    expect(burst?.saturationStreak).toBe(0);
    expect(hasRepeatedBurstSaturation(state!)).toBe(false);
  });
});

/**
 * A burst window contributes at most ONE saturation event, and the streak
 * counts saturation across *consecutive* windows only
 * (GridView_Backend_Scheme.md §16.1: "alert on repeated saturation, not on a
 * single saturated second").
 */
describe('burst saturation counts windows, not calls', () => {
  const burstOf = (state: QuotaState) =>
    state.windows.find((window) => window.windowClass === 'burst');

  function fire(
    state: QuotaState | null,
    sourceId: ProviderSourceId,
    secondOffset: number,
  ): QuotaState {
    return recordProviderAttempt(state, sourceId, {
      at: new Date(at.getTime() + secondOffset * 1000),
      outcome: 'successful',
      jobCategories: ['standings'],
    });
  }

  function saturate(
    state: QuotaState | null,
    sourceId: ProviderSourceId,
    secondOffset: number,
    limit: number,
  ): QuotaState {
    let next = state;
    for (let index = 0; index < limit; index += 1) {
      next = fire(next, sourceId, secondOffset);
    }
    return next!;
  }

  it('records one saturation event for one filled OpenF1 second', () => {
    // OpenF1 publishes 3 requests/second.
    const state = saturate(null, 'openf1', 0, 3);

    expect(burstOf(state)?.remaining).toBe(0);
    expect(burstOf(state)?.saturationStreak).toBe(1);
    expect(hasRepeatedBurstSaturation(state)).toBe(false);
    expect(state.warningLevel).toBe('normal');
  });

  it('does not turn extra calls in the same second into a second window', () => {
    let state = saturate(null, 'openf1', 0, 3);
    // Four more attempts inside the very same second.
    for (let index = 0; index < 4; index += 1) {
      state = fire(state, 'openf1', 0);
    }

    expect(burstOf(state)?.used).toBe(7);
    expect(burstOf(state)?.saturationStreak).toBe(1);
    expect(hasRepeatedBurstSaturation(state)).toBe(false);
    expect(state.warningLevel).toBe('normal');
  });

  it('reaches a streak of 2 when the immediately following second saturates', () => {
    let state = saturate(null, 'openf1', 0, 3);
    state = saturate(state, 'openf1', 1, 3);

    expect(burstOf(state)?.saturationStreak).toBe(2);
    expect(hasRepeatedBurstSaturation(state)).toBe(true);
    expect(state.warningLevel).toBe('warning');
  });

  it('breaks the sequence on an intervening second with light traffic', () => {
    let state = saturate(null, 'openf1', 0, 3);
    state = fire(state, 'openf1', 1); // second 1: one request, not saturated
    state = fire(state, 'openf1', 2); // second 2: rolls second 1 over

    expect(burstOf(state)?.saturationStreak).toBe(0);
    expect(hasRepeatedBurstSaturation(state)).toBe(false);
  });

  it('breaks the sequence on intervening seconds with no traffic at all', () => {
    let state = saturate(null, 'openf1', 0, 3);
    expect(burstOf(state)?.saturationStreak).toBe(1);

    // Seconds 1-9 pass with no requests, then second 10 saturates. Those are
    // not consecutive saturated windows, so this must not read as repeated.
    state = saturate(state, 'openf1', 10, 3);

    expect(burstOf(state)?.saturationStreak).toBe(1);
    expect(hasRepeatedBurstSaturation(state)).toBe(false);
    expect(state.warningLevel).toBe('normal');
  });

  it('starts again at 1 after a break', () => {
    let state = saturate(null, 'openf1', 0, 3);
    state = fire(state, 'openf1', 1); // break
    state = saturate(state, 'openf1', 2, 3);

    expect(burstOf(state)?.saturationStreak).toBe(1);
    expect(hasRepeatedBurstSaturation(state)).toBe(false);
  });

  it('applies the same semantics to the Jolpica four-request burst window', () => {
    // One filled second: one event.
    let state = saturate(null, 'jolpica', 0, 4);
    expect(burstOf(state)?.saturationStreak).toBe(1);
    state = fire(state, 'jolpica', 0);
    expect(burstOf(state)?.saturationStreak).toBe(1);

    // Immediately following second: streak 2 and observable.
    state = saturate(state, 'jolpica', 1, 4);
    expect(burstOf(state)?.saturationStreak).toBe(2);
    expect(hasRepeatedBurstSaturation(state)).toBe(true);
    expect(state.warningLevel).toBe('warning');

    // A gap of empty seconds breaks it.
    state = saturate(state, 'jolpica', 20, 4);
    expect(burstOf(state)?.saturationStreak).toBe(1);
    expect(hasRepeatedBurstSaturation(state)).toBe(false);
  });

  it('keeps the streak bounded by the documented cap', () => {
    let state: QuotaState | null = null;
    for (let second = 0; second < burstSaturationStreakCap + 5; second += 1) {
      state = saturate(state, 'openf1', second, 3);
    }

    expect(burstOf(state!)?.saturationStreak).toBe(burstSaturationStreakCap);
  });

  it('still reports critical for a rate-limit rejection during saturation', () => {
    let state = saturate(null, 'openf1', 0, 3);
    state = recordProviderAttempt(state, 'openf1', {
      at,
      outcome: 'rate-limited',
      jobCategories: ['standings'],
      retryAfter: '2026-07-20T12:00:30.000Z',
    });

    expect(state.warningLevel).toBe('critical');
    expect(state.retryAfter).toBe('2026-07-20T12:00:30.000Z');
  });
});

describe('recording attempts', () => {
  it('counts a failed attempt and a rate-limited attempt against the windows', () => {
    const failed = recordProviderAttempt(null, 'jolpica', {
      at,
      outcome: 'failed',
      jobCategories: ['results'],
    });
    const rateLimited = recordProviderAttempt(failed, 'jolpica', {
      at,
      outcome: 'rate-limited',
      jobCategories: ['results'],
      retryAfter: '2026-07-20T12:01:00.000Z',
    });

    for (const window of rateLimited.windows) {
      expect(window.used).toBe(2);
      expect(window.remaining).toBe(window.limit - 2);
    }
    expect(rateLimited.usageByJobCategory.results).toBe(2);
    expect(rateLimited.lastProviderSuccessAt).toBeNull();
    expect(rateLimited.lastProviderFailureAt).toBe(at.toISOString());
  });

  it('makes a rate-limit rejection critical and preserves Retry-After', () => {
    const state = recordProviderAttempt(null, 'jolpica', {
      at,
      outcome: 'rate-limited',
      jobCategories: ['standings'],
      retryAfter: '2026-07-20T12:05:00.000Z',
    });

    // One request out of 500/hour: nothing about the windows is exhausted, so
    // the critical level comes from the rejection itself.
    expect(state.warningLevel).toBe('critical');
    expect(state.retryAfter).toBe('2026-07-20T12:05:00.000Z');
    expect(
      state.windows.find((window) => window.windowClass === 'sustained')
        ?.remaining,
    ).toBe(499);
  });

  it('rolls a window over once its duration has elapsed', () => {
    const first = recordProviderAttempt(null, 'jolpica', {
      at,
      outcome: 'successful',
      jobCategories: ['profiles'],
    });
    const later = recordProviderAttempt(first, 'jolpica', {
      at: new Date(at.getTime() + 2000),
      outcome: 'successful',
      jobCategories: ['profiles'],
    });

    const burst = later.windows.find(
      (window) => window.windowClass === 'burst',
    );
    const hour = later.windows.find(
      (window) => window.windowClass === 'sustained',
    );
    expect(burst?.used).toBe(1);
    expect(hour?.used).toBe(2);
    expect(later.usageByJobCategory.profiles).toBe(2);
  });

  it('never returns another source state when the stored one disagrees', () => {
    const jolpica = recordProviderAttempt(null, 'jolpica', {
      at,
      outcome: 'successful',
      jobCategories: ['results'],
    });
    // Passing a Jolpica record while recording against OpenF1 must start from
    // a fresh OpenF1 state rather than inherit Jolpica's counters.
    const openf1 = recordProviderAttempt(jolpica, 'openf1', {
      at,
      outcome: 'successful',
      jobCategories: ['results'],
    });

    expect(openf1.sourceId).toBe('openf1');
    expect(
      openf1.windows.map((window) => [window.window, window.limit]),
    ).toEqual([
      ['second', 3],
      ['minute', 30],
    ]);
    expect(openf1.usageByJobCategory.results).toBe(1);
  });

  it('initialises windows from policy when the stored state carries none', () => {
    // This is the shape the mock legacy fallback produces.
    const legacyShaped: QuotaState = {
      ...emptyQuotaState('mock', at),
      windows: [],
      warningLevel: 'normal',
    };

    const next = recordProviderAttempt(legacyShaped, 'mock', {
      at,
      outcome: 'successful',
      jobCategories: ['home-rebuild'],
    });

    expect(next.windows.length).toBeGreaterThan(0);
    expect(next.windows.every((window) => window.used === 1)).toBe(true);
  });
});

describe('empty state', () => {
  it('starts a never-observed source at full capacity with an unknown level', () => {
    const state = emptyQuotaState('openf1', at);

    expect(state.warningLevel).toBe('unknown');
    expect(state.testOnly).toBe(false);
    expect(state.retryAfter).toBeNull();
    expect(state.usageByJobCategory).toEqual({});
    expect(
      state.windows.every((window) => window.remaining === window.limit),
    ).toBe(true);
    expect(state.windows.every((window) => window.saturationStreak === 0)).toBe(
      true,
    );
  });

  it('records window start and reset information for deterministic modelling', () => {
    const state = emptyQuotaState('jolpica', at);
    const hour = state.windows.find((window) => window.window === 'hour');

    expect(hour?.windowStartedAt).toBe('2026-07-20T12:00:00.000Z');
    expect(hour?.resetsAt).toBe('2026-07-20T13:00:00.000Z');
  });
});
