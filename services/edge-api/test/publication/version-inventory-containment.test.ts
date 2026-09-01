/**
 * A stored inventory is deserialized data, not a typed value.
 *
 * `SnapshotStorage.readVersionInventory` is *declared* to return
 * `SnapshotDocumentName[] | null`, but the value behind that declaration comes
 * back from KV as whatever JSON the key happens to hold. A truncated write, a
 * hand-edited entry or a partially rolled-back migration can leave a number, a
 * string, or an array holding a number where an inventory belongs - all of them
 * perfectly valid JSON.
 *
 * Every one of those values then reaches code that assumes an array of
 * strings: a spread, `startsWith` inside the route mapper, and the alias
 * expansion. Spreading a number throws, and `startsWith` on a number throws,
 * and neither throw is inside the guarded purge-adapter call. The consequences
 * differ by *phase*, which is the whole point of this file:
 *
 * - **Before a commit point** a malformed inventory must reject the operation
 *   safely, on the established `missing-version-inventory` reason, with the
 *   active pointer exactly where it was.
 * - **After a commit point** it must not undo the committed publication and
 *   must not escape as a rejected promise. The release *is* serving; the
 *   truthful shape is `applied` with `cachePurge: 'failed'`.
 * - **The operator purge** moves no pointer at all, so it must return its
 *   bounded failure representation rather than throw.
 *
 * The invariant this file pins:
 *
 * > Every persisted inventory passes one validated boundary before anything
 * > spreads it, maps it to a route or builds an alias from it, and a value
 * > that fails that boundary degrades the operation to its established bounded
 * > outcome for the phase it was discovered in.
 *
 * Valid inventories are asserted unchanged throughout, so containment cannot
 * be bought with a narrower purge.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../src/logging/logger';
import { SnapshotPublisher } from '../../src/publication/publisher';
import type { ProviderSeasonSource } from '../../src/providers/formula-one-provider';
import { SEASON, seasonFixture } from '../providers/coordination/support';
import {
  ORIGIN,
  RecordingPurgeAdapter,
  ScriptableStorage,
  publisherFor,
  setFor,
} from './support';

const FIRST = 'v1';
const SECOND = 'v2';
const NEXT_SEASON = 2027;
const LATER = '2026-07-25T00:00:00.000Z';

/**
 * Malformed values that are all valid JSON.
 *
 * Each one breaks a *different* downstream assumption: a number is not
 * iterable at all, a string is iterable into single characters, and an array
 * carrying a non-string reaches `startsWith` on something that has no such
 * method.
 */
const malformedInventories: readonly (readonly [string, unknown])[] = [
  ['a number', 7],
  ['a string', 'season'],
  ['an array holding a number', ['season', 7]],
  ['an array holding null', ['season', null]],
  ['an array holding an object', ['season', { name: 'season' }]],
  ['an array holding a nested array', ['season', ['season']]],
  ['an object', { documents: ['season'] }],
  ['a boolean', true],
];

interface Harness {
  storage: ScriptableStorage;
  purger: RecordingPurgeAdapter;
  publisher: SnapshotPublisher;
  logger: CapturingLogger;
}

function harness(): Harness {
  const storage = new ScriptableStorage();
  const purger = new RecordingPurgeAdapter();
  const logger = new CapturingLogger();
  return {
    storage,
    purger,
    logger,
    publisher: publisherFor(storage, purger, logger),
  };
}

async function publish(
  bench: Harness,
  source: ProviderSeasonSource,
  version: string,
  season: number = SEASON,
  sourceUpdatedAt = source.sourceUpdatedAt,
): Promise<void> {
  const result = await bench.publisher.publish(
    setFor({ ...source, season }, version, sourceUpdatedAt),
  );
  expect(result.status, `publishing ${season}/${version}`).toBe('applied');
}

/** The version the pointer names, read without the guards firing. */
async function activeOf(
  bench: Harness,
  season: number,
): Promise<string | null> {
  return (await bench.storage.pointers(season)).active;
}

describe('a malformed same-season inventory cannot un-publish a committed release', () => {
  it('reports applied with a failed purge for every malformed replaced inventory', async () => {
    const source = await seasonFixture();

    for (const [label, malformed] of malformedInventories) {
      const bench = harness();
      await publish(bench, source, FIRST);
      bench.storage.corruptInventory(SEASON, FIRST, malformed);

      const result = await bench.publisher.publish(
        setFor(source, SECOND, LATER),
      );

      expect(result.status, label).toBe('applied');
      expect(result.version, label).toBe(SECOND);
      expect(result.cachePurge, label).toBe('failed');
      expect(result.cachePurgeOk, label).toBe(false);
      expect(result.reason, label).toBe('cache-purge-failed');
      // Committed, and the pointer says so.
      expect(await activeOf(bench, SEASON), label).toBe(SECOND);
    }
  });

  it('contains a replaced-inventory read that throws and one that rejects', async () => {
    const source = await seasonFixture();

    for (const mode of ['throw', 'reject'] as const) {
      const bench = harness();
      await publish(bench, source, FIRST);
      // Call 1 is the replaced version's inventory, read pre-commit; call 2 is
      // the incoming version's own completeness check. Only the first is armed,
      // so the release still commits.
      bench.storage.arm('readVersionInventory', 1, mode);

      const result = await bench.publisher.publish(
        setFor(source, SECOND, LATER),
      );
      bench.storage.disarm();

      expect(result.status, mode).toBe('applied');
      expect(result.cachePurge, mode).toBe('failed');
      expect(result.reason, mode).toBe('cache-purge-failed');
      expect(await activeOf(bench, SEASON), mode).toBe(SECOND);
    }
  });

  it('purges the incoming release even when the withdrawn surface is unenumerable', async () => {
    const source = await seasonFixture();
    const bench = harness();
    await publish(bench, source, FIRST);
    bench.storage.corruptInventory(SEASON, FIRST, 7);

    await bench.publisher.publish(setFor(source, SECOND, LATER));

    // One batch for the transition, and it still names the incoming routes.
    expect(bench.purger.batches).toHaveLength(2);
    const batch = bench.purger.batches[1] as string[];
    expect(batch).toContain(`${ORIGIN}/v1/seasons/${SEASON}`);
    expect(batch).toContain(`${ORIGIN}/v1/seasons/${SEASON}/calendar`);
    expect([...batch]).toEqual([...batch].sort());
    expect(new Set(batch).size).toBe(batch.length);
  });
});

describe('a malformed inventory cannot be read as a completeness verdict', () => {
  it('refuses to call a republished version idempotent on an unusable inventory', async () => {
    const source = await seasonFixture();

    for (const [label, malformed] of malformedInventories) {
      const bench = harness();
      await publish(bench, source, FIRST);
      bench.storage.corruptInventory(SEASON, FIRST, malformed);

      // Republishing the version that is already active: the decision is made
      // over the *stored* inventory, which no longer describes anything.
      const result = await bench.publisher.publish(setFor(source, FIRST));

      expect(result.status, label).toBe('rejected');
      expect(result.reason, label).toBe('active-version-incomplete');
      expect(result.cachePurge, label).toBe('not-required');
      expect(await activeOf(bench, SEASON), label).toBe(FIRST);
    }
  });

  it('still reports a well-formed republication as idempotent', async () => {
    const source = await seasonFixture();
    const bench = harness();
    await publish(bench, source, FIRST);

    const result = await bench.publisher.publish(setFor(source, FIRST));

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('idempotent');
  });
});

describe('a malformed outgoing-current-season inventory stays contained', () => {
  /**
   * The reported post-commit failure, reproduced end to end: the pointer moves
   * to a new season, the outgoing season's alias expansion meets a malformed
   * inventory, and the publication must still report its bounded
   * applied-with-purge-failure result rather than reject.
   */
  it('returns applied with a failed purge for every malformed outgoing inventory', async () => {
    const source = await seasonFixture();

    for (const [label, malformed] of malformedInventories) {
      const bench = harness();
      await publish(bench, source, FIRST);
      expect(await activeOf(bench, SEASON), label).toBe(FIRST);
      bench.storage.corruptInventory(SEASON, FIRST, malformed);

      const result = await bench.publisher.publish(
        setFor({ ...source, season: NEXT_SEASON }, SECOND, LATER),
      );

      expect(result.status, label).toBe('applied');
      expect(result.cachePurge, label).toBe('failed');
      expect(result.cachePurgeOk, label).toBe(false);
      expect(result.reason, label).toBe('cache-purge-failed');
      // The commit point was crossed for the incoming season.
      expect(await activeOf(bench, NEXT_SEASON), label).toBe(SECOND);
      expect(await bench.storage.getCurrentSeason(), label).toBe(NEXT_SEASON);
      // The outgoing season keeps serving its own release.
      expect(await activeOf(bench, SEASON), label).toBe(FIRST);
    }
  });

  it('still purges the incoming season, and never a malformed alias', async () => {
    const source = await seasonFixture();
    const bench = harness();
    await publish(bench, source, FIRST);
    bench.storage.corruptInventory(SEASON, FIRST, ['season', 7]);

    await bench.publisher.publish(
      setFor({ ...source, season: NEXT_SEASON }, SECOND, LATER),
    );

    const batch = bench.purger.batches.at(-1) as string[];
    expect(batch).toContain(`${ORIGIN}/v1/seasons/${NEXT_SEASON}`);
    expect(batch.every((url) => url.startsWith(ORIGIN))).toBe(true);
    expect([...batch]).toEqual([...batch].sort());
  });

  it('contains an outgoing-inventory read that throws and one that rejects', async () => {
    const source = await seasonFixture();

    for (const mode of ['throw', 'reject'] as const) {
      const bench = harness();
      await publish(bench, source, FIRST);
      // Call 1 is the incoming version's own completeness check, inside the
      // commit block; call 2 is the outgoing season's inventory, read
      // post-commit by the alias expansion.
      bench.storage.arm('readVersionInventory', 2, mode);

      const result = await bench.publisher.publish(
        setFor({ ...source, season: NEXT_SEASON }, SECOND, LATER),
      );
      bench.storage.disarm();

      expect(result.status, mode).toBe('applied');
      expect(result.cachePurge, mode).toBe('failed');
      expect(result.reason, mode).toBe('cache-purge-failed');
      expect(await activeOf(bench, NEXT_SEASON), mode).toBe(SECOND);
    }
  });

  it('keeps a valid outgoing inventory purging its aliases unchanged', async () => {
    const source = await seasonFixture();
    const bench = harness();
    await publish(bench, source, FIRST);

    const result = await bench.publisher.publish(
      setFor({ ...source, season: NEXT_SEASON }, SECOND, LATER),
    );

    expect(result.status).toBe('applied');
    expect(result.cachePurge).toBe('succeeded');
    expect(result.reason).toBeNull();
    const batch = bench.purger.batches.at(-1) as string[];
    expect(batch).toContain(`${ORIGIN}/v1/seasons/current`);
    expect(batch).toContain(`${ORIGIN}/v1/bootstrap`);
  });
});

describe('a malformed rollback inventory rejects before the pointer moves', () => {
  it('rejects on missing-version-inventory for every malformed target', async () => {
    const source = await seasonFixture();

    for (const [label, malformed] of malformedInventories) {
      const bench = harness();
      await publish(bench, source, FIRST);
      await publish(bench, source, SECOND, SEASON, LATER);
      bench.storage.corruptInventory(SEASON, FIRST, malformed);

      const result = await bench.publisher.rollback(SEASON, FIRST);

      expect(result.status, label).toBe('rejected');
      expect(result.reason, label).toBe('missing-version-inventory');
      expect(result.cachePurge, label).toBe('not-required');
      // Nothing moved, and nothing was purged.
      expect(await activeOf(bench, SEASON), label).toBe(SECOND);
      expect(bench.purger.batches, label).toHaveLength(2);
    }
  });

  it('rejects on missing-version-inventory for every malformed active inventory', async () => {
    const source = await seasonFixture();

    for (const [label, malformed] of malformedInventories) {
      const bench = harness();
      await publish(bench, source, FIRST);
      await publish(bench, source, SECOND, SEASON, LATER);
      // The *outgoing* side of the rollback: the target is intact.
      bench.storage.corruptInventory(SEASON, SECOND, malformed);

      const result = await bench.publisher.rollback(SEASON, FIRST);

      expect(result.status, label).toBe('rejected');
      expect(result.reason, label).toBe('missing-version-inventory');
      expect(await activeOf(bench, SEASON), label).toBe(SECOND);
      expect(bench.purger.batches, label).toHaveLength(2);
    }
  });

  it('still distinguishes a missing inventory by the same bounded reason', async () => {
    const source = await seasonFixture();
    const bench = harness();
    await publish(bench, source, FIRST);
    await publish(bench, source, SECOND, SEASON, LATER);
    bench.storage.hideInventory(SEASON, FIRST);

    const result = await bench.publisher.rollback(SEASON, FIRST);

    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('missing-version-inventory');
    expect(await activeOf(bench, SEASON)).toBe(SECOND);
  });

  it('contains a rollback inventory read that throws and one that rejects', async () => {
    const source = await seasonFixture();

    for (const mode of ['throw', 'reject'] as const) {
      const bench = harness();
      await publish(bench, source, FIRST);
      await publish(bench, source, SECOND, SEASON, LATER);
      bench.storage.arm('readVersionInventory', 'every', mode);

      const result = await bench.publisher.rollback(SEASON, FIRST);
      bench.storage.disarm();

      expect(result.status, mode).toBe('failed');
      expect(result.reason, mode).toBe('storage-read');
      expect(await activeOf(bench, SEASON), mode).toBe(SECOND);
    }
  });

  it('rolls back unchanged when both inventories are well formed', async () => {
    const source = await seasonFixture();
    const bench = harness();
    await publish(bench, source, FIRST);
    await publish(bench, source, SECOND, SEASON, LATER);

    const result = await bench.publisher.rollback(SEASON, FIRST);

    expect(result.status).toBe('applied');
    expect(result.reason).toBeNull();
    expect(result.cachePurge).toBe('succeeded');
    expect(await activeOf(bench, SEASON)).toBe(FIRST);
    expect(bench.purger.batches).toHaveLength(3);
    const batch = bench.purger.batches[2] as string[];
    expect(batch).toContain(`${ORIGIN}/v1/seasons/${SEASON}`);
    expect([...batch]).toEqual([...batch].sort());
  });
});

describe('the operator purge fails bounded on a malformed inventory', () => {
  it('returns its bounded failure for every malformed active inventory', async () => {
    const source = await seasonFixture();

    for (const [label, malformed] of malformedInventories) {
      const bench = harness();
      await publish(bench, source, FIRST);
      bench.storage.corruptInventory(SEASON, FIRST, malformed);

      const result = await bench.publisher.purgeActiveVersion(SEASON);

      expect(result.ok, label).toBe(false);
      expect(result.reason, label).toBe('missing-version-inventory');
      expect(result.activeVersion, label).toBe(FIRST);
      expect(result.urls, label).toEqual([]);
      // No purge was attempted at all: nothing enumerable to purge.
      expect(bench.purger.batches, label).toHaveLength(1);
    }
  });

  it('contains an inventory read that throws and one that rejects', async () => {
    const source = await seasonFixture();

    for (const mode of ['throw', 'reject'] as const) {
      const bench = harness();
      await publish(bench, source, FIRST);
      bench.storage.arm('readVersionInventory', 'every', mode);

      const result = await bench.publisher.purgeActiveVersion(SEASON);
      bench.storage.disarm();

      expect(result.ok, mode).toBe(false);
      expect(result.reason, mode).toBe('storage-read');
      expect(result.urls, mode).toEqual([]);
    }
  });

  it('purges the full route set for a well-formed active inventory', async () => {
    const source = await seasonFixture();
    const bench = harness();
    await publish(bench, source, FIRST);

    const result = await bench.publisher.purgeActiveVersion(SEASON);

    expect(result.ok).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.urls).toContain(`${ORIGIN}/v1/seasons/${SEASON}`);
    expect(result.urls).toContain(`${ORIGIN}/v1/seasons/current`);
    expect([...result.urls]).toEqual([...result.urls].sort());
    expect(new Set(result.urls).size).toBe(result.urls.length);
  });
});

describe('containment never leaks what it refused', () => {
  it('keeps malformed inventory content out of the logs', async () => {
    const source = await seasonFixture();
    const bench = harness();
    await publish(bench, source, FIRST);
    bench.storage.corruptInventory(SEASON, FIRST, [
      'season',
      'gridview://secret-key',
    ]);

    await bench.publisher.publish(
      setFor({ ...source, season: NEXT_SEASON }, SECOND, LATER),
    );

    expect(bench.logger.serialized()).not.toContain('gridview://secret-key');
  });
});
