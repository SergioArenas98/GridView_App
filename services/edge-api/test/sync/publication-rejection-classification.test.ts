/**
 * A rejected publication is not automatically a successful synchronization.
 *
 * `publish` returns four statuses, and only `failed` currently takes the
 * failure path. Everything else - including a candidate refused for failing
 * contract validation, and an active version that read back incomplete - is
 * recorded as a completed run: `lastCompletedAt` advances, every due job is
 * marked successful, and one `sync.completed` line is emitted. The next
 * cadence then sees nothing due, so a season that is genuinely not publishable
 * looks healthy until an operator reads the publication status by hand.
 *
 * Exactly one rejection is benign. A candidate older than what is already
 * serving is the pacing system working: nothing needed publishing, and the run
 * legitimately completed. Every other rejection is an integrity refusal and
 * must fail the run.
 */

import { describe, expect, it } from 'vitest';

import { MemoryCachePurgeAdapter } from '../../src/cache/purge';
import { CapturingLogger } from '../../src/logging/logger';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import {
  publicationReasons,
  type PublicationReason,
} from '../../src/publication/publisher';
import { FixedClock } from '../../src/runtime/clock';
import {
  SynchronizationService,
  consequenceForRejectedPublication,
  type SyncResult,
} from '../../src/sync/sync-service';
import type { SyncJobCategory } from '../../src/storage/types';
import type { SnapshotValidator } from '../../src/validation/snapshot-validator';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import { SEASON } from '../providers/coordination/support';
import {
  ExplodingPurgeAdapter,
  ScriptableStorage,
  publisherFor,
} from '../publication/support';

const NOW = new Date('2026-07-20T12:00:00.000Z');
const ALL_JOBS: SyncJobCategory[] = [
  'season-calendar',
  'event-schedule',
  'profiles',
  'standings',
  'results',
  'home-rebuild',
];

/** The one rejection the product treats as a benign completed no-op. */
const BENIGN_REJECTION: PublicationReason = 'older-source-updated-at';

interface Subject {
  storage: ScriptableStorage;
  logger: CapturingLogger;
  purger: MemoryCachePurgeAdapter;
  service: SynchronizationService;
  run: (version?: string) => Promise<SyncResult>;
}

function subjectFor(
  options: {
    storage?: ScriptableStorage;
    validator?: SnapshotValidator;
    purger?: MemoryCachePurgeAdapter;
    sourceUpdatedAt?: string;
    now?: Date;
  } = {},
): Subject {
  const storage = options.storage ?? new ScriptableStorage();
  const logger = new CapturingLogger();
  const purger = options.purger ?? new MemoryCachePurgeAdapter();
  const clock = new FixedClock(options.now ?? NOW);
  const provider = new MockFormulaOneProvider({
    clock,
    sourceUpdatedAt: options.sourceUpdatedAt ?? '2026-07-18T11:55:00.000Z',
    contentVersion: '2026.07.18.1',
  });
  const publisher = publisherFor(
    storage,
    purger,
    logger,
    options.validator ?? runtimeSnapshotValidator,
  );
  const service = new SynchronizationService(
    storage,
    provider,
    publisher,
    clock,
    logger,
  );
  return {
    storage,
    logger,
    purger,
    service,
    run: (version?: string) =>
      service.run({
        season: SEASON,
        trigger: 'manual-full',
        forceJobs: ALL_JOBS,
        ...(version === undefined ? {} : { forceVersion: version }),
      }),
  };
}

function operations(logger: CapturingLogger): string[] {
  return logger.events.map((event) => event.operation);
}

describe('the rejected-publication decision table is exhaustive', () => {
  it('classifies every declared publication reason', () => {
    for (const reason of publicationReasons) {
      expect(
        consequenceForRejectedPublication(reason),
        reason,
      ).not.toBeUndefined();
    }
  });

  it('treats exactly the older-source rejection as a benign no-op', () => {
    for (const reason of publicationReasons) {
      expect(consequenceForRejectedPublication(reason), reason).toBe(
        reason === BENIGN_REJECTION ? 'completed-no-op' : 'failed',
      );
    }
  });

  it('fails closed for an absent reason', () => {
    expect(consequenceForRejectedPublication(null)).toBe('failed');
  });
});

describe('an older-source rejection completes the run', () => {
  it('records a completed no-op without a failure line', async () => {
    const storage = new ScriptableStorage();
    const first = subjectFor({
      storage,
      sourceUpdatedAt: '2026-07-19T00:00:00.000Z',
    });
    expect((await first.run('v1')).status).toBe('completed');

    const older = subjectFor({
      storage,
      sourceUpdatedAt: '2026-07-01T00:00:00.000Z',
      now: new Date('2026-07-21T12:00:00.000Z'),
    });
    const result = await older.run('v2');
    const state = await storage.getSyncState(SEASON);

    expect(result.status).toBe('completed');
    expect(result.publicationStatus).toBe('rejected');
    expect(result.failureCategory).toBeNull();
    expect(state?.lastCompletedAt).toBe('2026-07-21T12:00:00.000Z');
    expect(state?.lastSuccessByJob['season-calendar']).toBe(
      '2026-07-21T12:00:00.000Z',
    );
    expect(operations(older.logger)).toContain('sync.completed');
    expect(operations(older.logger)).not.toContain('sync.failed');
    // Last-known-good is untouched: the older candidate never published.
    expect(await storage.getActiveVersion(SEASON)).toBe('v1');
  });
});

describe('an integrity rejection fails the run', () => {
  const rejectingValidator: SnapshotValidator = {
    validate: () => [{ path: 'data', message: 'injected contract failure' }],
  };

  it('fails a contract-validation rejection', async () => {
    const storage = new ScriptableStorage();
    const seeded = subjectFor({ storage });
    expect((await seeded.run('v1')).status).toBe('completed');
    const completedAt = (await storage.getSyncState(SEASON))?.lastCompletedAt;

    const rejecting = subjectFor({
      storage,
      validator: rejectingValidator,
      sourceUpdatedAt: '2026-07-19T00:00:00.000Z',
      now: new Date('2026-07-21T12:00:00.000Z'),
    });
    const result = await rejecting.run('v2');
    const state = await storage.getSyncState(SEASON);

    expect(result.status).toBe('failed');
    expect(result.failureCategory).toBe('contract-validation');
    expect(state?.lastCompletedAt).toBe(completedAt);
    expect(state?.lastSuccessByJob['season-calendar']).not.toBe(
      '2026-07-21T12:00:00.000Z',
    );
    expect(state?.lastFailureByJob['season-calendar']).toBe(
      '2026-07-21T12:00:00.000Z',
    );
    expect(operations(rejecting.logger)).toContain('sync.failed');
    expect(operations(rejecting.logger)).not.toContain('sync.completed');
    expect(await storage.getActiveVersion(SEASON)).toBe('v1');
  });

  it('fails an active-version-incomplete rejection', async () => {
    const storage = new ScriptableStorage();
    const seeded = subjectFor({ storage });
    expect((await seeded.run('v1')).status).toBe('completed');
    const completedAt = (await storage.getSyncState(SEASON))?.lastCompletedAt;
    // The active version loses a document it recorded in its inventory.
    storage.hideDocument(SEASON, 'v1', 'circuit:monaco');

    const again = subjectFor({
      storage,
      now: new Date('2026-07-21T12:00:00.000Z'),
    });
    const result = await again.run('v1');
    const state = await storage.getSyncState(SEASON);

    expect(result.publicationStatus).toBe('rejected');
    expect(result.status).toBe('failed');
    expect(result.failureCategory).toBe('active-version-incomplete');
    expect(state?.lastCompletedAt).toBe(completedAt);
    expect(operations(again.logger)).toContain('sync.failed');
    expect(operations(again.logger)).not.toContain('sync.completed');
  });

  it('leaves the run completed when the same version reads back complete', async () => {
    const storage = new ScriptableStorage();
    const seeded = subjectFor({ storage });
    expect((await seeded.run('v1')).status).toBe('completed');

    const again = subjectFor({
      storage,
      now: new Date('2026-07-21T12:00:00.000Z'),
    });
    const result = await again.run('v1');

    expect(result.publicationStatus).toBe('skipped');
    expect(result.status).toBe('completed');
    expect(result.failureCategory).toBeNull();
  });
});

describe('an applied but degraded publication is still a completed run', () => {
  it('completes when the post-commit purge failed', async () => {
    const storage = new ScriptableStorage();
    const purger = new ExplodingPurgeAdapter('throw');
    const subject = subjectFor({ storage });
    const service = new SynchronizationService(
      storage,
      new MockFormulaOneProvider({
        clock: new FixedClock(NOW),
        sourceUpdatedAt: '2026-07-18T11:55:00.000Z',
      }),
      publisherFor(storage, purger, subject.logger),
      new FixedClock(NOW),
      subject.logger,
    );

    const result = await service.run({
      season: SEASON,
      trigger: 'manual-full',
      forceJobs: ALL_JOBS,
      forceVersion: 'v1',
    });

    expect(result.status).toBe('completed');
    expect(result.publicationStatus).toBe('applied');
    expect(await storage.getActiveVersion(SEASON)).toBe('v1');
    expect(operations(subject.logger)).not.toContain('sync.failed');
  });

  it('completes and reports the degradation when maintenance failed', async () => {
    const storage = new ScriptableStorage();
    const first = subjectFor({ storage });
    expect((await first.run('v1')).status).toBe('completed');

    const second = subjectFor({
      storage,
      sourceUpdatedAt: '2026-07-19T00:00:00.000Z',
      now: new Date('2026-07-21T12:00:00.000Z'),
    });
    storage.arm('setPreviousVersion', 'every');
    const result = await second.run('v2');

    expect(result.status).toBe('completed');
    expect(result.publicationStatus).toBe('applied');
    expect(await storage.getActiveVersion(SEASON)).toBe('v2');
    const completed = second.logger.events.find(
      (event) => event.operation === 'sync.completed',
    );
    expect(completed?.pointerMaintenance).toBe('failed');
    expect(second.logger.serialized()).not.toContain('secret-key');
  });
});
