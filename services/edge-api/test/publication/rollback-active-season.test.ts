/**
 * Rollback must accept the releases publication is willing to produce.
 *
 * An active season legitimately publishes without a results document for a
 * round that has not been classified: the generator emits one only when a
 * classification exists, and the calendar advertises that with
 * `hasResults: false`. Rollback rebuilds the required-document set from the
 * stored calendar instead of from what was written, so the two must agree on
 * the same rule - otherwise a perfectly valid release becomes unreachable as a
 * rollback target, both explicitly and through the previous pointer.
 */

import { describe, expect, it } from 'vitest';

import { MemoryCachePurgeAdapter } from '../../src/cache/purge';
import { CapturingLogger } from '../../src/logging/logger';
import { SnapshotPublisher } from '../../src/publication/publisher';
import { MemorySnapshotStorage } from '../../src/storage/local';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import { generateSnapshotSet } from '../../src/snapshots/generator';
import type { ProviderSeasonSource } from '../../src/providers/formula-one-provider';
import {
  FIXED_NOW,
  SEASON,
  seasonFixture,
} from '../providers/coordination/support';

const ACTIVE = 'v1';
const NEXT = 'v2';

interface Harness {
  storage: MemorySnapshotStorage;
  purger: MemoryCachePurgeAdapter;
  logger: CapturingLogger;
  publisher: SnapshotPublisher;
}

function harnessFor(): Harness {
  const storage = new MemorySnapshotStorage();
  const purger = new MemoryCachePurgeAdapter();
  const logger = new CapturingLogger();
  return {
    storage,
    purger,
    logger,
    publisher: new SnapshotPublisher(
      storage,
      runtimeSnapshotValidator,
      purger,
      logger,
      'https://api.gridview.test',
    ),
  };
}

/**
 * The curated season as a real in-season release: only the classified round
 * keeps a results document, and every other round advertises none.
 *
 * This is exactly what publication now produces for an active season, so it is
 * the shape rollback has to accept.
 */
async function activeSeason(): Promise<{
  source: ProviderSeasonSource;
  classifiedRound: number;
  futureRounds: number[];
}> {
  const base = await seasonFixture();
  const classified = base.results.find((result) => result.status === 'final');
  if (classified === undefined) throw new Error('fixture gap');
  const futureRounds = base.calendar
    .map((event) => event.round)
    .filter((round) => round !== classified.round);
  return {
    classifiedRound: classified.round,
    futureRounds,
    source: {
      ...base,
      // Only the classified round has a result at all; the rest are absent
      // rather than carrying an `unavailable` document.
      results: [classified],
      calendar: base.calendar.map((event) => ({
        ...event,
        hasResults: event.round === classified.round,
      })),
    },
  };
}

async function publishActive(
  harness: Harness,
  source: ProviderSeasonSource,
  version: string,
  sourceUpdatedAt = source.sourceUpdatedAt,
): Promise<void> {
  const result = await harness.publisher.publish(
    generateSnapshotSet({ ...source, sourceUpdatedAt }, FIXED_NOW, version),
  );
  expect(result.status, `publishing ${version}`).toBe('applied');
}

describe('an active-season release stays a valid rollback target', () => {
  it('publishes without results documents for unclassified rounds', async () => {
    const harness = harnessFor();
    const { source, classifiedRound, futureRounds } = await activeSeason();

    await publishActive(harness, source, ACTIVE);

    expect(
      await harness.storage.readVersionedDocument(
        SEASON,
        ACTIVE,
        `grand-prix:${classifiedRound}:results`,
      ),
    ).not.toBeNull();
    for (const round of futureRounds) {
      expect(
        await harness.storage.readVersionedDocument(
          SEASON,
          ACTIVE,
          `grand-prix:${round}:results`,
        ),
        `round ${round}`,
      ).toBeNull();
      // The event's own detail document is still required and present.
      expect(
        await harness.storage.readVersionedDocument(
          SEASON,
          ACTIVE,
          `grand-prix:${round}`,
        ),
        `round ${round} detail`,
      ).not.toBeNull();
    }
  });

  it('accepts that release as an explicit rollback target', async () => {
    const harness = harnessFor();
    const { source } = await activeSeason();
    await publishActive(harness, source, ACTIVE);
    await publishActive(harness, source, NEXT, '2026-07-25T00:00:00.000Z');
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(NEXT);

    const result = await harness.publisher.rollback(SEASON, ACTIVE);

    expect(result.status).toBe('applied');
    expect(result.version).toBe(ACTIVE);
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(ACTIVE);
    // The restored release is served again, so its documents are reachable.
    expect(
      await harness.storage.readVersionedDocument(SEASON, ACTIVE, 'season'),
    ).not.toBeNull();
    expect(harness.purger.purgedUrls.length).toBeGreaterThan(0);
  });

  it('accepts it through the previous pointer as well', async () => {
    const harness = harnessFor();
    const { source } = await activeSeason();
    await publishActive(harness, source, ACTIVE);
    await publishActive(harness, source, NEXT, '2026-07-25T00:00:00.000Z');
    expect(await harness.storage.getPreviousVersion(SEASON)).toBe(ACTIVE);

    const result = await harness.publisher.rollback(SEASON);

    expect(result.status).toBe('applied');
    expect(result.version).toBe(ACTIVE);
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(ACTIVE);
  });

  it('still requires the results document a classified round advertises', async () => {
    const harness = harnessFor();
    const { source, classifiedRound } = await activeSeason();

    // The calendar entry says `hasResults: true`, so this document is genuinely
    // required. Publishing a version without it proves that relaxing the
    // future-round rule did not become a blanket existence bypass: `publish`
    // only verifies what it generated, so the gap only shows up at rollback.
    const set = generateSnapshotSet(source, FIXED_NOW, ACTIVE);
    const stripped = {
      ...set,
      documents: set.documents.filter(
        (document) =>
          document.documentName !== `grand-prix:${classifiedRound}:results`,
      ),
    };
    expect(stripped.documents.length).toBe(set.documents.length - 1);
    expect((await harness.publisher.publish(stripped)).status).toBe('applied');
    await publishActive(harness, source, NEXT, '2026-07-25T00:00:00.000Z');

    const purgedBefore = harness.purger.purgedUrls.length;
    const result = await harness.publisher.rollback(SEASON, ACTIVE);

    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('rollback-target-incomplete');
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(NEXT);
    expect(harness.purger.purgedUrls).toHaveLength(purgedBefore);
    expect(classifiedRound).toBeGreaterThan(0);
  });

  it('still rejects a target missing a required detail document', async () => {
    const harness = harnessFor();
    const { source } = await activeSeason();
    await publishActive(harness, source, ACTIVE);
    await publishActive(harness, source, NEXT, '2026-07-25T00:00:00.000Z');

    const purgedBefore = harness.purger.purgedUrls.length;
    const result = await harness.publisher.rollback(SEASON, 'no-such-version');

    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('rollback-target-missing');
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(NEXT);
    expect(harness.purger.purgedUrls).toHaveLength(purgedBefore);
  });

  it('keeps a version carrying optional absence documents rollback-compatible', async () => {
    const harness = harnessFor();
    // The unmodified curated season carries an `unavailable` results document
    // for every unclassified round. Those are optional, but present, and must
    // not disturb rollback either.
    const source = await seasonFixture();
    await publishActive(harness, source, ACTIVE);
    await publishActive(harness, source, NEXT, '2026-07-25T00:00:00.000Z');

    const result = await harness.publisher.rollback(SEASON, ACTIVE);

    expect(result.status).toBe('applied');
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(ACTIVE);
  });

  it('rejects rollback with no previous version and moves no pointer', async () => {
    const harness = harnessFor();
    const { source } = await activeSeason();
    await publishActive(harness, source, ACTIVE);

    const purgedBefore = harness.purger.purgedUrls.length;
    const result = await harness.publisher.rollback(SEASON);

    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('missing-previous-version');
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(ACTIVE);
    expect(harness.purger.purgedUrls).toHaveLength(purgedBefore);
  });
});
