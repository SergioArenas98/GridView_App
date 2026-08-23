import { describe, expect, it } from 'vitest';

import worker from '../../src/index';
import {
  emptyQuotaState,
  quotaStateChanged,
  hasManualRecoveryCapacity,
  longestSustainedWindow,
  recordProviderAttempt,
  refreshQuotaState,
  retryAfterActive,
} from '../../src/providers/quota-model';
import { quotaPolicyFor } from '../../src/providers/provider-source';
import { calculateDueJobs } from '../../src/sync/scheduler';
import { FixedClock } from '../../src/runtime/clock';
import { quotaKey } from '../../src/storage/keys';
import type { QuotaState } from '../../src/storage/types';
import {
  adminRequest,
  createHarness,
  providerCalls,
  request,
  seedPublishedSnapshot,
  type EdgeHarness,
} from '../support/edge-harness';

/** The harness clock. Everything below is expressed relative to it. */
const now = new Date('2026-07-20T12:00:00.000Z');

function clockAt(iso: string): FixedClock {
  return new FixedClock(new Date(iso));
}

/**
 * A mock state whose sustained (minute) window is exhausted enough to be
 * genuinely critical, started at `startedAt`.
 */
function criticalState(
  startedAt: Date,
  options: { retryAfter?: string | null; remaining?: number } = {},
): QuotaState {
  const base = emptyQuotaState('mock', startedAt);
  return {
    ...base,
    windows: base.windows.map((window) => {
      if (window.windowClass !== 'sustained') return window;
      const remaining = options.remaining ?? 2; // 2/200 = 1% -> critical
      return { ...window, used: window.limit - remaining, remaining };
    }),
    retryAfter: options.retryAfter ?? null,
    lastProviderSuccessAt: '2026-07-20T11:30:00.000Z',
    lastProviderFailureAt: '2026-07-20T11:45:00.000Z',
    usageByJobCategory: { standings: 7 },
    warningLevel: 'critical',
  };
}

async function seedQuota(
  harness: EdgeHarness,
  state: QuotaState,
): Promise<void> {
  await harness.storage.setQuotaState('mock', state);
}

describe('refreshQuotaState is a pure, request-free observation of elapsed time', () => {
  it('keeps a critical level while its sustained window is still current', () => {
    const state = criticalState(now);

    // One second before the minute window resets.
    const refreshed = refreshQuotaState(
      state,
      'mock',
      new Date(now.getTime() + 59_000),
    );

    expect(refreshed.warningLevel).toBe('critical');
    expect(longestSustainedWindow(refreshed)?.remaining).toBe(2);
  });

  it('clears a critical level once the window has reset, at the exact boundary', () => {
    const state = criticalState(now);
    const resetsAt = Date.parse(longestSustainedWindow(state)?.resetsAt ?? '');

    // `at == resetsAt` is the first instant of the new window.
    const refreshed = refreshQuotaState(state, 'mock', new Date(resetsAt));

    expect(refreshed.warningLevel).toBe('normal');
    const sustained = longestSustainedWindow(refreshed);
    expect(sustained?.used).toBe(0);
    expect(sustained?.remaining).toBe(sustained?.limit);
  });

  it('consumes no request and never increments usage', () => {
    const state = criticalState(now);
    const before = state.windows.map((window) => window.used);

    const refreshed = refreshQuotaState(
      state,
      'mock',
      new Date(now.getTime() + 30_000),
    );

    // Same window, so nothing rolled over and nothing was consumed.
    expect(refreshed.windows.map((window) => window.used)).toEqual(before);
    // After a rollover, usage resets to zero - it never grows.
    const rolled = refreshQuotaState(
      state,
      'mock',
      new Date(now.getTime() + 3_600_000),
    );
    for (const window of rolled.windows) {
      expect(window.used).toBe(0);
    }
  });

  it('preserves success and failure timestamps and job usage totals', () => {
    const refreshed = refreshQuotaState(
      criticalState(now),
      'mock',
      new Date(now.getTime() + 3_600_000),
    );

    expect(refreshed.lastProviderSuccessAt).toBe('2026-07-20T11:30:00.000Z');
    expect(refreshed.lastProviderFailureAt).toBe('2026-07-20T11:45:00.000Z');
    expect(refreshed.usageByJobCategory).toEqual({ standings: 7 });
    expect(refreshed.sourceId).toBe('mock');
    expect(refreshed.testOnly).toBe(true);
  });

  it('keeps an active Retry-After and its critical level', () => {
    const state = criticalState(now, {
      retryAfter: '2026-07-20T12:10:00.000Z',
      remaining: 200,
    });

    const refreshed = refreshQuotaState(
      state,
      'mock',
      new Date('2026-07-20T12:05:00.000Z'),
    );

    expect(refreshed.retryAfter).toBe('2026-07-20T12:10:00.000Z');
    expect(refreshed.warningLevel).toBe('critical');
  });

  it('clears an expired Retry-After at the exact boundary', () => {
    const state = criticalState(now, {
      retryAfter: '2026-07-20T12:10:00.000Z',
      remaining: 200,
    });

    // `at == retryAfter` means it is no longer in the future.
    expect(
      retryAfterActive(
        '2026-07-20T12:10:00.000Z',
        new Date('2026-07-20T12:10:00.000Z'),
      ),
    ).toBe(false);
    const refreshed = refreshQuotaState(
      state,
      'mock',
      new Date('2026-07-20T12:10:00.000Z'),
    );

    expect(refreshed.retryAfter).toBeNull();
    expect(refreshed.warningLevel).toBe('normal');
  });

  it('reports no change when nothing has expired, so storage is not rewritten', () => {
    const state = criticalState(now);
    // Inside the same one-second burst window, so nothing rolls over at all.
    const refreshed = refreshQuotaState(
      state,
      'mock',
      new Date(now.getTime() + 500),
    );

    // A new object every time, so identity must never be the change signal.
    expect(refreshed).not.toBe(state);
    expect(quotaStateChanged(state, refreshed)).toBe(false);
    // And a genuine expiry does report a change.
    expect(
      quotaStateChanged(
        state,
        refreshQuotaState(state, 'mock', new Date(now.getTime() + 120_000)),
      ),
    ).toBe(true);
  });

  it('recalculates burst-saturation state across elapsed windows', () => {
    // Saturate the OpenF1 burst window twice in consecutive seconds.
    let state: QuotaState | null = null;
    for (let second = 0; second < 2; second += 1) {
      for (let index = 0; index < 3; index += 1) {
        state = recordProviderAttempt(state, 'openf1', {
          at: new Date(now.getTime() + second * 1000),
          outcome: 'successful',
          jobCategories: ['standings'],
        });
      }
    }
    expect(state!.warningLevel).toBe('warning');

    // Ten quiet seconds later the streak is broken and the warning is gone.
    const refreshed = refreshQuotaState(
      state!,
      'openf1',
      new Date(now.getTime() + 12_000),
    );

    expect(
      refreshed.windows.find((window) => window.windowClass === 'burst')
        ?.saturationStreak,
    ).toBe(0);
    expect(refreshed.warningLevel).toBe('normal');
  });
});

describe('scheduler gates read refreshed state', () => {
  const policy = quotaPolicyFor('mock');

  it('blocks scheduled work while critical is still current', () => {
    const plan = calculateDueJobs(
      clockAt('2026-07-20T12:00:30.000Z'),
      null,
      refreshQuotaState(
        criticalState(now),
        'mock',
        new Date('2026-07-20T12:00:30.000Z'),
      ),
      {},
    );

    expect(plan.dueJobs).toEqual([]);
    expect(plan.reason).toBe('quota-critical-reserved-for-manual-recovery');
  });

  it('allows due scheduled work once the window has reset', () => {
    const plan = calculateDueJobs(
      clockAt('2026-07-20T12:01:00.000Z'),
      null,
      refreshQuotaState(
        criticalState(now),
        'mock',
        new Date('2026-07-20T12:01:00.000Z'),
      ),
      {},
    );

    expect(plan.dueJobs.length).toBeGreaterThan(0);
    expect(plan.reason).toBeNull();
  });

  it('lets a protected manual recovery spend the reserved sustained capacity', () => {
    const state = refreshQuotaState(
      criticalState(now),
      'mock',
      new Date('2026-07-20T12:00:30.000Z'),
    );
    expect(state.warningLevel).toBe('critical');
    expect(hasManualRecoveryCapacity(state)).toBe(true);

    const plan = calculateDueJobs(
      clockAt('2026-07-20T12:00:30.000Z'),
      null,
      state,
      { forceJobs: ['standings'], manualRecovery: true },
    );

    expect(plan.dueJobs).toEqual(['standings']);
    expect(plan.reason).toBeNull();
  });

  it('refuses manual recovery when the reserve is exhausted', () => {
    const state = refreshQuotaState(
      criticalState(now, { remaining: 0 }),
      'mock',
      new Date('2026-07-20T12:00:30.000Z'),
    );
    expect(hasManualRecoveryCapacity(state)).toBe(false);

    const plan = calculateDueJobs(
      clockAt('2026-07-20T12:00:30.000Z'),
      null,
      state,
      { forceJobs: ['standings'], manualRecovery: true },
    );

    expect(plan.dueJobs).toEqual([]);
    expect(plan.reason).toBe('quota-critical-recovery-reserve-exhausted');
  });

  it('blocks manual recovery while Retry-After is active', () => {
    const state = refreshQuotaState(
      criticalState(now, {
        retryAfter: '2026-07-20T12:10:00.000Z',
        remaining: policy.windows[1]!.limit,
      }),
      'mock',
      new Date('2026-07-20T12:05:00.000Z'),
    );

    const plan = calculateDueJobs(
      clockAt('2026-07-20T12:05:00.000Z'),
      null,
      state,
      { forceJobs: ['standings'], manualRecovery: true },
    );

    expect(plan.dueJobs).toEqual([]);
    expect(plan.reason).toBe('retry-after-active');
  });
});

describe('the service refreshes, persists and unblocks end to end', () => {
  it('keeps a scheduled run blocked while critical is current', async () => {
    const harness = createHarness();
    await seedQuota(harness, criticalState(now));

    await worker.scheduled?.({} as ScheduledController, harness.env);

    expect(providerCalls(harness.provider)).toBe(0);
    expect(await harness.storage.getActiveVersion(2026)).toBeNull();
  });

  it('recovers automatically on the next run after the window resets', async () => {
    const blocked = createHarness();
    await seedQuota(blocked, criticalState(now));
    await worker.scheduled?.({} as ScheduledController, blocked.env);
    expect(providerCalls(blocked.provider)).toBe(0);

    // A later invocation, past the minute window.
    const later = createHarness();
    later.env.__LOCAL_STORAGE = blocked.storage;
    later.env.__CLOCK = clockAt('2026-07-20T12:02:00.000Z');

    await worker.scheduled?.({} as ScheduledController, later.env);

    expect(providerCalls(later.provider)).toBe(1);
    expect(await blocked.storage.getActiveVersion(2026)).toBeTypeOf('string');
  });

  it('does not stay critical forever after a 429 instruction expires', async () => {
    // A real rate-limit rejection through the service.
    const limited = createHarness({
      provider: new (
        await import('../../src/providers/mock/mock-provider')
      ).MockFormulaOneProvider({
        clock: createHarness().clock,
        failureMode: 'rate_limited',
      }),
    });
    await worker.fetch(adminRequest('/internal/admin/sync/full'), limited.env);
    const afterLimit = await limited.storage.getQuotaState('mock');
    expect(afterLimit?.warningLevel).toBe('critical');
    expect(afterLimit?.retryAfter).toBe('2026-07-20T12:01:00.000Z');

    // Past the Retry-After and past the minute window.
    const recovered = createHarness();
    recovered.env.__LOCAL_STORAGE = limited.storage;
    recovered.env.__CLOCK = clockAt('2026-07-20T12:05:00.000Z');

    await worker.scheduled?.({} as ScheduledController, recovered.env);

    expect(providerCalls(recovered.provider)).toBe(1);
    const quota = await limited.storage.getQuotaState('mock');
    expect(quota?.retryAfter).toBeNull();
    expect(quota?.warningLevel).toBe('normal');
  });

  it('persists the refresh even when no job is due', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    // Force a stale critical whose window has already elapsed.
    await seedQuota(
      harness,
      criticalState(new Date('2026-07-20T11:00:00.000Z')),
    );

    const later = createHarness();
    later.env.__LOCAL_STORAGE = harness.storage;
    later.env.__CLOCK = clockAt('2026-07-20T12:00:10.000Z');
    await worker.scheduled?.({} as ScheduledController, later.env);

    // No job was due (the seed just ran), yet the expired critical state must
    // not survive in the admin surface.
    expect(providerCalls(later.provider)).toBe(0);
    const stored = await harness.storage.getQuotaState('mock');
    expect(stored?.warningLevel).toBe('normal');
    expect(longestSustainedWindow(stored!)?.used).toBe(0);
    expect(
      (harness.storage as unknown as { values: Map<string, unknown> }).values,
    ).toBeDefined();
    expect([
      ...(
        harness.storage as unknown as { values: Map<string, unknown> }
      ).values.keys(),
    ]).toContain(quotaKey('mock'));
  });

  it('lets a protected admin sync recover a critical source', async () => {
    const harness = createHarness();
    await seedQuota(harness, criticalState(now));

    const response = await worker.fetch(
      adminRequest('/internal/admin/sync/full'),
      harness.env,
    );
    const body = (await response.json()) as {
      data: { status: string; dueJobs: string[] };
    };

    expect(response.status).toBe(200);
    expect(body.data.status).toBe('completed');
    expect(body.data.dueJobs.length).toBeGreaterThan(0);
    expect(providerCalls(harness.provider)).toBe(1);
  });

  it('keeps public reads unable to synchronize or consume quota', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    await seedQuota(harness, criticalState(now));
    const before = providerCalls(harness.provider);

    await worker.fetch(request('/v1/seasons/2026/calendar'), harness.env);
    await worker.fetch(request('/v1/home?season=2026'), harness.env);
    // A public POST is rejected outright; there is no public sync route.
    const post = await worker.fetch(
      request('/v1/seasons/2026/calendar', 'POST'),
      harness.env,
    );

    expect(post.status).toBe(405);
    expect(providerCalls(harness.provider)).toBe(before);
    const quota = await harness.storage.getQuotaState('mock');
    expect(longestSustainedWindow(quota!)?.used).toBe(
      longestSustainedWindow(criticalState(now))!.used,
    );
  });
});
