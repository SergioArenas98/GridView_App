import { describe, expect, it } from 'vitest';

import worker from '../../src/index';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import { FixedClock } from '../../src/runtime/clock';
import { createHarness, seedPublishedSnapshot } from '../support/edge-harness';

// The deployed staging cron is `17 3 * * *` (see wrangler.toml). These tests
// exercise the real `scheduled()` export through the in-memory harness — the
// safest local mechanism — instead of triggering the remote schedule, so they
// never touch staging KV, never need the admin token, and never change the
// cron. They assert the invariants the scheduled handler must uphold.
describe('scheduled handler', () => {
  it('runs the same sync-and-publish orchestration and updates sync state and quota', async () => {
    const harness = createHarness();
    const callsBefore = harness.provider.callCount;

    await worker.scheduled?.({} as ScheduledController, harness.env);

    // Reads configured KV state (defaults the season to 2026) and drives the
    // shared SynchronizationService -> SnapshotPublisher path to an applied
    // release — the same orchestration the manual admin sync uses.
    expect(harness.provider.callCount).toBeGreaterThan(callsBefore);
    const activeVersion = await harness.storage.getActiveVersion(2026);
    expect(activeVersion).toBeTypeOf('string');

    const state = await harness.storage.getSyncState(2026);
    expect(state?.lastPublicationStatus).toBe('applied');
    expect(state?.lastPublicationVersion).toBe(activeVersion);
    expect(state?.lastCompletedAt).toBeTypeOf('string');
    expect(state?.lastFailedAt).toBeNull();

    const quotaState = await harness.storage.getQuotaState();
    expect(quotaState?.lastProviderSuccessAt).toBeTypeOf('string');
  });

  it('skips work and leaves the active release untouched when no job is due', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const active = await harness.storage.getActiveVersion(2026);
    const callsAfterSeed = harness.provider.callCount;

    await worker.scheduled?.({} as ScheduledController, harness.env);

    expect(harness.provider.callCount).toBe(callsAfterSeed);
    const state = await harness.storage.getSyncState(2026);
    expect(state?.lastPublicationStatus).toBe('skipped');
    expect(await harness.storage.getActiveVersion(2026)).toBe(active);
  });

  it('preserves the active release when a required scheduled job fails', async () => {
    const seed = createHarness();
    await seedPublishedSnapshot(seed);
    const active = await seed.storage.getActiveVersion(2026);
    expect(active).toBeTypeOf('string');

    const failingProvider = new MockFormulaOneProvider({
      clock: seed.clock,
      failureMode: 'failure',
    });
    const failing = createHarness({ provider: failingProvider });
    failing.env.__LOCAL_STORAGE = seed.storage;
    // Advance past every job interval (max 24h) so all jobs are due again.
    failing.env.__CLOCK = new FixedClock(new Date('2026-07-21T14:00:00.000Z'));

    await worker.scheduled?.({} as ScheduledController, failing.env);

    expect(failingProvider.callCount).toBeGreaterThan(0);
    // The active release is untouched: setActiveVersion is only reached on the
    // full success path, so any failure preserves the previously published one.
    expect(await seed.storage.getActiveVersion(2026)).toBe(active);

    const state = await seed.storage.getSyncState(2026);
    expect(state?.lastPublicationStatus).toBe('failed');
    expect(state?.lastFailureCategory).toBe('mock-provider-failure');
    expect(state?.lastFailedAt).toBeTypeOf('string');

    const quotaState = await seed.storage.getQuotaState();
    expect(quotaState?.lastProviderFailureAt).toBeTypeOf('string');
  });

  it('never writes the admin token or authorization material to scheduled logs', async () => {
    const secret = 'super-secret-scheduled-token-0007';
    const harness = createHarness({ adminToken: secret });

    await worker.scheduled?.({} as ScheduledController, harness.env);

    const serialized = harness.logger.serialized();
    expect(serialized).not.toContain(secret);
    expect(serialized.toLowerCase()).not.toContain('bearer ');
    for (const event of harness.logger.events) {
      expect(JSON.stringify(event)).not.toContain(secret);
      expect(event).not.toHaveProperty('authorization');
      expect(event).not.toHaveProperty('adminToken');
    }

    // The scheduled run still emitted structured sync telemetry.
    const operations = harness.logger.events.map((event) => event.operation);
    expect(operations).toContain('sync.started');
    expect(operations).toContain('sync.completed');
    expect(operations).toContain('publication.completed');
  });
});
