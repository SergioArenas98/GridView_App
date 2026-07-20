import { describe, expect, it } from 'vitest';

import { MemoryCachePurgeAdapter } from '../../src/cache/purge';
import { CapturingLogger } from '../../src/logging/logger';
import { SnapshotPublisher } from '../../src/publication/publisher';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import { FixedClock } from '../../src/runtime/clock';
import { generateSnapshotSet } from '../../src/snapshots/generator';
import { activeKey, previousKey } from '../../src/storage/keys';
import { MemorySnapshotStorage } from '../../src/storage/local';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import type { SnapshotValidator } from '../../src/validation/snapshot-validator';

describe('snapshot publication', () => {
  it('publishes a complete initial version and writes active pointer last', async () => {
    const context = await publishContext('v1');

    expect(await context.storage.getActiveVersion(2026)).toBe('v1');
    expect(context.storage.writeLog.at(-1)).toBe(activeKey(2026));
    expect(
      await context.storage.readVersionedDocument(2026, 'v1', 'bootstrap'),
    ).toBeTruthy();
    expect(
      await context.storage.readVersionedDocument(
        2026,
        'v1',
        'content:manifest',
      ),
    ).toBeTruthy();
  });

  it('preserves the previous active version and treats repeat publication as idempotent', async () => {
    const context = await publishContext('v1');
    const secondSet = await generatedSet(
      context.provider,
      context.clock,
      'v2',
      {
        sourceUpdatedAt: '2026-07-18T12:20:00.000Z',
        contentVersion: '2026.07.18.2',
      },
    );
    const second = await context.publisher.publish(secondSet);
    const repeat = await context.publisher.publish(secondSet);

    expect(second.status).toBe('applied');
    expect(await context.storage.getActiveVersion(2026)).toBe('v2');
    expect(await context.storage.getPreviousVersion(2026)).toBe('v1');
    expect(context.storage.writeLog.includes(previousKey(2026))).toBe(true);
    expect(repeat.status).toBe('skipped');
    expect(repeat.reason).toBe('idempotent');
  });

  it('leaves the active version unchanged after validation or write failure', async () => {
    const context = await publishContext('v1');
    const rejectValidator: SnapshotValidator = {
      validate: () => [{ path: 'data', message: 'forced failure' }],
    };
    const rejectingPublisher = new SnapshotPublisher(
      context.storage,
      rejectValidator,
      context.purger,
      context.logger,
    );
    const invalidSet = await generatedSet(
      context.provider,
      context.clock,
      'bad',
      {
        sourceUpdatedAt: '2026-07-18T12:30:00.000Z',
        contentVersion: '2026.07.18.3',
      },
    );
    const rejected = await rejectingPublisher.publish(invalidSet);

    context.storage.setWriteFailure((key) => key.includes(':broken:calendar'));
    const brokenSet = await generatedSet(
      context.provider,
      context.clock,
      'broken',
      {
        sourceUpdatedAt: '2026-07-18T12:40:00.000Z',
        contentVersion: '2026.07.18.4',
      },
    );
    const failed = await context.publisher.publish(brokenSet);

    expect(rejected.status).toBe('rejected');
    expect(failed.status).toBe('failed');
    expect(await context.storage.getActiveVersion(2026)).toBe('v1');
  });

  it('rejects older source data and rolls back to a complete previous version', async () => {
    const context = await publishContext('v1');
    await context.publisher.publish(
      await generatedSet(context.provider, context.clock, 'v2', {
        sourceUpdatedAt: '2026-07-18T12:20:00.000Z',
        contentVersion: '2026.07.18.2',
      }),
    );

    const older = await context.publisher.publish(
      await generatedSet(context.provider, context.clock, 'older', {
        sourceUpdatedAt: '2026-07-18T10:00:00.000Z',
        contentVersion: '2026.07.18.0',
      }),
    );
    const rollback = await context.publisher.rollback(2026);

    expect(older.status).toBe('rejected');
    expect(older.reason).toBe('older-source-updated-at');
    expect(rollback.status).toBe('applied');
    expect(await context.storage.getActiveVersion(2026)).toBe('v1');
  });

  it('rejects rollback to a missing version', async () => {
    const context = await publishContext('v1');

    const rollback = await context.publisher.rollback(2026, 'missing');

    expect(rollback.status).toBe('rejected');
    expect(rollback.reason).toBe('rollback-target-missing');
    expect(await context.storage.getActiveVersion(2026)).toBe('v1');
  });
});

async function publishContext(version: string) {
  const clock = new FixedClock(new Date('2026-07-20T12:00:00.000Z'));
  const storage = new MemorySnapshotStorage();
  const logger = new CapturingLogger();
  const purger = new MemoryCachePurgeAdapter();
  const provider = new MockFormulaOneProvider({ clock });
  const publisher = new SnapshotPublisher(
    storage,
    runtimeSnapshotValidator,
    purger,
    logger,
  );
  await publisher.publish(await generatedSet(provider, clock, version));
  return { clock, storage, logger, purger, provider, publisher };
}

async function generatedSet(
  provider: MockFormulaOneProvider,
  clock: FixedClock,
  version: string,
  overrides: { sourceUpdatedAt?: string; contentVersion?: string } = {},
) {
  const source = await new MockFormulaOneProvider({
    clock,
    sourceUpdatedAt: overrides.sourceUpdatedAt,
    contentVersion: overrides.contentVersion,
  }).fetchSeasonSource(2026, [
    'season-calendar',
    'event-schedule',
    'profiles',
    'standings',
    'results',
    'home-rebuild',
  ]);
  provider.callCount += 1;
  return generateSnapshotSet(source, clock.now().toISOString(), version);
}
