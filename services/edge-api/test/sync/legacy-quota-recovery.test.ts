import { describe, expect, it } from 'vitest';

import worker from '../../src/index';
import { legacyGlobalQuotaKey, quotaKey } from '../../src/storage/keys';
import {
  createHarness,
  providerCalls,
  type EdgeHarness,
} from '../support/edge-harness';

/**
 * The harness clock is fixed at 2026-07-20T12:00:00.000Z, so "active" and
 * "expired" are relative to that instant.
 */
const now = '2026-07-20T12:00:00.000Z';
const expiredRetryAfter = '2026-07-20T11:59:00.000Z';
const activeRetryAfter = '2026-07-20T12:05:00.000Z';

function seedLegacyCritical(
  harness: EdgeHarness,
  retryAfter: string | null,
): void {
  (harness.storage as unknown as { values: Map<string, unknown> }).values.set(
    legacyGlobalQuotaKey,
    {
      dailyLimit: 1000,
      dailyRemaining: 10,
      perMinuteLimit: 60,
      perMinuteRemaining: 1,
      lastProviderSuccessAt: '2026-07-19T09:00:00.000Z',
      lastProviderFailureAt: '2026-07-19T10:00:00.000Z',
      retryAfter,
      usageByJobCategory: { standings: 3 },
      warningLevel: 'critical',
    },
  );
}

function storedKeys(harness: EdgeHarness): string[] {
  return [
    ...(
      harness.storage as unknown as { values: Map<string, unknown> }
    ).values.keys(),
  ];
}

describe('legacy critical quota no longer deadlocks the mock provider', () => {
  it('allows the next due operation when the legacy record has no Retry-After', async () => {
    const harness = createHarness();
    seedLegacyCritical(harness, null);

    await worker.scheduled?.({} as ScheduledController, harness.env);

    // Before the fix this was 0 forever: critical skipped every job, skipping
    // meant no attempt, and no attempt meant the fallback was never replaced.
    expect(providerCalls(harness.provider)).toBe(1);
    expect(await harness.storage.getActiveVersion(2026)).toBeTypeOf('string');
    const state = await harness.storage.getSyncState(2026);
    expect(state?.lastPublicationStatus).toBe('applied');
  });

  it('allows the next due operation when the legacy Retry-After has expired', async () => {
    const harness = createHarness();
    seedLegacyCritical(harness, expiredRetryAfter);

    await worker.scheduled?.({} as ScheduledController, harness.env);

    expect(providerCalls(harness.provider)).toBe(1);
    expect(await harness.storage.getActiveVersion(2026)).toBeTypeOf('string');
  });

  it('stays blocked while a legacy Retry-After is still active', async () => {
    const harness = createHarness();
    seedLegacyCritical(harness, activeRetryAfter);

    await worker.scheduled?.({} as ScheduledController, harness.env);

    // A provider instruction, unlike a derived level, still blocks.
    expect(providerCalls(harness.provider)).toBe(0);
    expect(await harness.storage.getActiveVersion(2026)).toBeNull();
    const state = await harness.storage.getSyncState(2026);
    expect(state?.lastPublicationStatus).toBe('skipped');
  });

  it('runs again once the active Retry-After expires', async () => {
    const blocked = createHarness();
    seedLegacyCritical(blocked, activeRetryAfter);
    await worker.scheduled?.({} as ScheduledController, blocked.env);
    expect(providerCalls(blocked.provider)).toBe(0);

    // Same storage, a clock past the Retry-After.
    const later = createHarness();
    later.env.__LOCAL_STORAGE = blocked.storage;
    later.env.__CLOCK = { now: () => new Date('2026-07-20T12:06:00.000Z') };

    await worker.scheduled?.({} as ScheduledController, later.env);

    expect(providerCalls(later.provider)).toBe(1);
    expect(await blocked.storage.getActiveVersion(2026)).toBeTypeOf('string');
  });

  it('replaces the fallback with policy-backed windows and a fresh warning level', async () => {
    const harness = createHarness();
    seedLegacyCritical(harness, null);

    // The migrated state is non-blocking and carries no modelled window.
    const migrated = await harness.storage.getQuotaState('mock');
    expect(migrated?.warningLevel).toBe('unknown');
    expect(migrated?.windows).toEqual([]);
    // Genuinely source-independent operational fields survive.
    expect(migrated?.lastProviderSuccessAt).toBe('2026-07-19T09:00:00.000Z');
    expect(migrated?.lastProviderFailureAt).toBe('2026-07-19T10:00:00.000Z');
    expect(migrated?.usageByJobCategory).toEqual({ standings: 3 });

    await worker.scheduled?.({} as ScheduledController, harness.env);

    const written = await harness.storage.getQuotaState('mock');
    expect(storedKeys(harness)).toContain(quotaKey('mock'));
    expect(written?.sourceId).toBe('mock');
    expect(written?.testOnly).toBe(true);
    // Windows now come from the mock policy, not from the legacy record.
    expect(written?.windows.map((window) => window.window)).toEqual([
      'second',
      'minute',
    ]);
    expect(written?.windows.every((window) => window.used === 1)).toBe(true);
    // The level is evaluated from those windows: one request of many.
    expect(written?.warningLevel).toBe('normal');
    expect(written?.lastProviderSuccessAt).toBe(now);
    // Job usage accumulates onto the migrated figure rather than resetting.
    expect(written?.usageByJobCategory.standings).toBe(4);
  });

  it('keeps the legacy record read-only and never deletes it', async () => {
    const harness = createHarness();
    seedLegacyCritical(harness, null);

    await worker.scheduled?.({} as ScheduledController, harness.env);
    await worker.scheduled?.({} as ScheduledController, harness.env);

    expect(storedKeys(harness)).toContain(legacyGlobalQuotaKey);
    const legacy = (
      harness.storage as unknown as { values: Map<string, unknown> }
    ).values.get(legacyGlobalQuotaKey) as { warningLevel: string };
    expect(legacy.warningLevel).toBe('critical');
  });

  it('never reads the legacy record for jolpica or openf1', async () => {
    const harness = createHarness();
    seedLegacyCritical(harness, null);

    expect(await harness.storage.getQuotaState('jolpica')).toBeNull();
    expect(await harness.storage.getQuotaState('openf1')).toBeNull();

    await worker.scheduled?.({} as ScheduledController, harness.env);

    // Running the mock source writes nothing for either other source.
    expect(await harness.storage.getQuotaState('jolpica')).toBeNull();
    expect(await harness.storage.getQuotaState('openf1')).toBeNull();
    expect(storedKeys(harness)).not.toContain(quotaKey('jolpica'));
    expect(storedKeys(harness)).not.toContain(quotaKey('openf1'));
  });
});
