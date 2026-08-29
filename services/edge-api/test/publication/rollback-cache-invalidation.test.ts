/**
 * Rollback cache invalidation is a different question from rollback target
 * completeness.
 *
 * Completeness asks *which documents the target must contain* to be a legal
 * rollback target. Cache invalidation asks *which public responses may still
 * be carrying the outgoing version's representation* once the pointer moves.
 * The second set is strictly wider: a round the target deliberately has no
 * classification for still has a public results URL, and that URL may hold the
 * newer version's final classification.
 *
 * Deriving the purge set from the completeness set therefore leaves a cached
 * classification serving after a rollback that was supposed to restore a
 * meaningful absence.
 */

import { describe, expect, it } from 'vitest';

import {
  MemoryCachePurgeAdapter,
  type CachePurgeAdapter,
  type CachePurgeResult,
} from '../../src/cache/purge';
import { CapturingLogger } from '../../src/logging/logger';
import { SnapshotPublisher } from '../../src/publication/publisher';
import { MemorySnapshotStorage } from '../../src/storage/local';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import { generateSnapshotSet } from '../../src/snapshots/generator';
import type { ProviderSeasonSource } from '../../src/providers/formula-one-provider';
import type { RaceResult } from '../../src/contract/types';
import {
  FIXED_NOW,
  SEASON,
  seasonFixture,
} from '../providers/coordination/support';

const ORIGIN = 'https://api.gridview.test';
const TARGET = 'v1';
const NEWER = 'v2';
const LATER = '2026-07-25T00:00:00.000Z';

/** The round the curated fixture leaves unclassified and still ahead. */
const PENDING_ROUND = 13;
/** The final round of the curated calendar, used for the difference cases. */
const LAST_ROUND = 16;

interface Harness {
  storage: MemorySnapshotStorage;
  purger: MemoryCachePurgeAdapter;
  publisher: SnapshotPublisher;
}

function harnessFor(purger: MemoryCachePurgeAdapter): Harness {
  const storage = new MemorySnapshotStorage();
  return {
    storage,
    purger,
    publisher: new SnapshotPublisher(
      storage,
      runtimeSnapshotValidator,
      purger,
      new CapturingLogger(),
      ORIGIN,
    ),
  };
}

function detailUrl(round: number): string {
  return ORIGIN + '/v1/seasons/' + SEASON + '/grand-prix/' + round;
}

function resultsUrl(round: number): string {
  return detailUrl(round) + '/results';
}

async function publish(
  harness: Harness,
  source: ProviderSeasonSource,
  version: string,
  sourceUpdatedAt = source.sourceUpdatedAt,
): Promise<void> {
  const result = await harness.publisher.publish(
    generateSnapshotSet({ ...source, sourceUpdatedAt }, FIXED_NOW, version),
  );
  expect(result.status, 'publishing ' + version).toBe('applied');
}

/** Keeps only the named rounds, in both the calendar and the results. */
function withRounds(
  source: ProviderSeasonSource,
  keep: readonly number[],
): ProviderSeasonSource {
  return {
    ...source,
    calendar: source.calendar.filter((event) => keep.includes(event.round)),
    results: source.results.filter((result) => keep.includes(result.round)),
  };
}

/** Drops the results documents for the named rounds, calendar untouched. */
function withoutResultDocuments(
  source: ProviderSeasonSource,
  rounds: readonly number[],
): ProviderSeasonSource {
  return {
    ...source,
    results: source.results.filter((result) => !rounds.includes(result.round)),
  };
}

/**
 * The same season, one round later: the pending round is now classified and
 * the calendar advertises it.
 */
function classify(
  source: ProviderSeasonSource,
  round: number,
): ProviderSeasonSource {
  const classified = source.results.find(
    (result) => result.status === 'final' && result.sessionType === 'race',
  );
  const pending = source.results.find(
    (result) => result.round === round && result.sessionType === 'race',
  );
  if (classified === undefined || pending === undefined) {
    throw new Error('fixture gap');
  }
  const promoted: RaceResult = {
    ...pending,
    status: 'final',
    entries: classified.entries,
    fastestLap: classified.fastestLap,
  };
  return {
    ...source,
    calendar: source.calendar.map((event) =>
      event.round === round ? { ...event, hasResults: true } : event,
    ),
    results: [
      ...source.results.filter((result) => result !== pending),
      promoted,
    ],
  };
}

describe('rollback invalidates every public route the pointer change affects', () => {
  it('purges the results URL of a target round that stores an absence document', async () => {
    const purger = new MemoryCachePurgeAdapter();
    const harness = harnessFor(purger);
    // The curated season carries an `unavailable` results document for the
    // pending round, and advertises `hasResults: false`.
    const target = await seasonFixture();
    await publish(harness, target, TARGET);
    await publish(harness, classify(target, PENDING_ROUND), NEWER, LATER);

    const before = purger.purgedUrls.length;
    const result = await harness.publisher.rollback(SEASON, TARGET);

    expect(result.status).toBe('applied');
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(TARGET);
    // The newer version published a final classification at this exact URL.
    expect(purger.purgedUrls.slice(before)).toContain(
      resultsUrl(PENDING_ROUND),
    );
    expect(result.purgedUrls).toContain(resultsUrl(PENDING_ROUND));
  });

  it('purges the results URL of a target round that stores no document at all', async () => {
    const purger = new MemoryCachePurgeAdapter();
    const harness = harnessFor(purger);
    const target = withoutResultDocuments(await seasonFixture(), [
      PENDING_ROUND,
    ]);
    await publish(harness, target, TARGET);
    expect(
      await harness.storage.readVersionedDocument(
        SEASON,
        TARGET,
        `grand-prix:${PENDING_ROUND}:results`,
      ),
    ).toBeNull();
    await publish(
      harness,
      classify(await seasonFixture(), PENDING_ROUND),
      NEWER,
      LATER,
    );

    const before = purger.purgedUrls.length;
    const result = await harness.publisher.rollback(SEASON, TARGET);

    expect(result.status).toBe('applied');
    expect(purger.purgedUrls.slice(before)).toContain(
      resultsUrl(PENDING_ROUND),
    );
  });

  it('purges routes for a round only the outgoing active version had', async () => {
    const purger = new MemoryCachePurgeAdapter();
    const harness = harnessFor(purger);
    const full = await seasonFixture();
    const shortened = withRounds(
      full,
      full.calendar
        .map((event) => event.round)
        .filter((round) => round !== LAST_ROUND),
    );
    await publish(harness, shortened, TARGET);
    await publish(harness, full, NEWER, LATER);

    const before = purger.purgedUrls.length;
    await harness.publisher.rollback(SEASON, TARGET);
    const purged = purger.purgedUrls.slice(before);

    expect(purged).toContain(detailUrl(LAST_ROUND));
    expect(purged).toContain(resultsUrl(LAST_ROUND));
  });

  it('purges routes for a round only the rollback target has', async () => {
    const purger = new MemoryCachePurgeAdapter();
    const harness = harnessFor(purger);
    const full = await seasonFixture();
    const shortened = withRounds(
      full,
      full.calendar
        .map((event) => event.round)
        .filter((round) => round !== LAST_ROUND),
    );
    await publish(harness, full, TARGET);
    await publish(harness, shortened, NEWER, LATER);

    const before = purger.purgedUrls.length;
    await harness.publisher.rollback(SEASON, TARGET);
    const purged = purger.purgedUrls.slice(before);

    expect(purged).toContain(detailUrl(LAST_ROUND));
    expect(purged).toContain(resultsUrl(LAST_ROUND));
  });

  it('purges both routes for every round when the calendars are identical', async () => {
    const purger = new MemoryCachePurgeAdapter();
    const harness = harnessFor(purger);
    const source = await seasonFixture();
    await publish(harness, source, TARGET);
    await publish(harness, source, NEWER, LATER);

    const before = purger.purgedUrls.length;
    await harness.publisher.rollback(SEASON, TARGET);
    const purged = purger.purgedUrls.slice(before);

    for (const event of source.calendar) {
      expect(purged, `round ${event.round}`).toContain(detailUrl(event.round));
      expect(purged, `round ${event.round}`).toContain(resultsUrl(event.round));
    }
  });

  it('deduplicates deterministically and returns a sorted set', async () => {
    const purger = new MemoryCachePurgeAdapter();
    const harness = harnessFor(purger);
    const source = await seasonFixture();
    await publish(harness, source, TARGET);
    await publish(harness, source, NEWER, LATER);

    const result = await harness.publisher.rollback(SEASON, TARGET);

    expect(new Set(result.purgedUrls).size).toBe(result.purgedUrls.length);
    expect(result.purgedUrls).toEqual([...result.purgedUrls].sort());
  });

  it('applies the same route union through the previous pointer', async () => {
    const purger = new MemoryCachePurgeAdapter();
    const harness = harnessFor(purger);
    const target = await seasonFixture();
    await publish(harness, target, TARGET);
    await publish(harness, classify(target, PENDING_ROUND), NEWER, LATER);
    expect(await harness.storage.getPreviousVersion(SEASON)).toBe(TARGET);

    const result = await harness.publisher.rollback(SEASON);

    expect(result.status).toBe('applied');
    expect(result.version).toBe(TARGET);
    expect(result.purgedUrls).toContain(resultsUrl(PENDING_ROUND));
  });
});

class ThrowingPurger implements CachePurgeAdapter {
  constructor(private readonly mode: 'throw' | 'reject') {}

  purgePublicUrls(): Promise<CachePurgeResult> {
    if (this.mode === 'throw') throw new Error('purge exploded');
    return Promise.reject(new Error('purge rejected'));
  }
}

describe('a rollback purge failure never un-does the pointer move', () => {
  for (const mode of ['throw', 'reject'] as const) {
    it(`reports cachePurge failed when the purger ${mode}s`, async () => {
      const storage = new MemorySnapshotStorage();
      const source = await seasonFixture();
      const seeding = new SnapshotPublisher(
        storage,
        runtimeSnapshotValidator,
        new MemoryCachePurgeAdapter(),
        new CapturingLogger(),
        ORIGIN,
      );
      expect(
        (await seeding.publish(generateSnapshotSet(source, FIXED_NOW, TARGET)))
          .status,
      ).toBe('applied');
      expect(
        (
          await seeding.publish(
            generateSnapshotSet(
              { ...source, sourceUpdatedAt: LATER },
              FIXED_NOW,
              NEWER,
            ),
          )
        ).status,
      ).toBe('applied');

      const publisher = new SnapshotPublisher(
        storage,
        runtimeSnapshotValidator,
        new ThrowingPurger(mode),
        new CapturingLogger(),
        ORIGIN,
      );
      const result = await publisher.rollback(SEASON, TARGET);

      expect(result.status).toBe('applied');
      expect(result.reason).toBe('cache-purge-failed');
      expect(result.cachePurge).toBe('failed');
      expect(result.cachePurgeOk).toBe(false);
      expect(result.purgedUrls).toEqual([]);
      // The commit point was crossed before the purge, so the pointer stays.
      expect(await storage.getActiveVersion(SEASON)).toBe(TARGET);
    });
  }
});
