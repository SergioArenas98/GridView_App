/**
 * Invalidation has to cover the URLs the CDN actually keys on.
 *
 * The public router resolves a season three ways for the same document: from
 * the numeric season, from an explicit `season=current`, and from an omitted
 * `season` that defaults to `current` - plus the path form
 * `/v1/seasons/current`. Those are distinct request URLs, so they are distinct
 * CDN cache entries. Purging only the numeric one leaves the aliases serving a
 * withdrawn release for the whole of their TTL, which for a profile route is
 * an hour.
 *
 * The alias set is not a longer hard-coded list either: it is derived from the
 * same route table `params.ts` matches on, and it is expanded by one shared
 * mechanism that publication, rollback and the operator purge all go through,
 * so none of the three can quietly fall back to numeric-only invalidation.
 */

import { describe, expect, it } from 'vitest';

import {
  MemoryCachePurgeAdapter,
  invalidationUrlsForDocuments,
  publicUrlsForDocuments,
} from '../../src/cache/purge';
import { SnapshotPublisher } from '../../src/publication/publisher';
import { MemorySnapshotStorage } from '../../src/storage/local';
import type { SnapshotDocumentName } from '../../src/storage/types';
import type { ProviderSeasonSource } from '../../src/providers/formula-one-provider';
import { SEASON, seasonFixture } from '../providers/coordination/support';
import {
  ExplodingPurgeAdapter,
  ORIGIN,
  RecordingPurgeAdapter,
  ScriptableStorage,
  publisherFor,
  setFor,
} from './support';

const TARGET = 'v1';
const NEWER = 'v2';
const LATER = '2026-07-25T00:00:00.000Z';
/** A season published after `SEASON`, so publishing it moves `current`. */
const NEXT_SEASON = 2027;

/** The season-level aliases the router accepts for the current season. */
const seasonLevelAliases = [
  `${ORIGIN}/v1/bootstrap`,
  `${ORIGIN}/v1/bootstrap?season=current`,
  `${ORIGIN}/v1/home`,
  `${ORIGIN}/v1/home?season=current`,
  `${ORIGIN}/v1/seasons/current`,
];

/**
 * Forms the router deliberately does **not** serve. `resolveSeasonRoute`
 * parses `parts[2]` with the four-digit season pattern, so every
 * `/v1/seasons/current/...` form below is an `INVALID_PARAMETER` rather than a
 * route, and `/v1/content/manifest` rejects every query key. Purging one would
 * be inventing an alias.
 */
const nonRoutes = [
  `${ORIGIN}/v1/seasons/current/calendar`,
  `${ORIGIN}/v1/seasons/current/drivers`,
  `${ORIGIN}/v1/seasons/current/constructors`,
  `${ORIGIN}/v1/seasons/current/circuits`,
  `${ORIGIN}/v1/seasons/current/standings/drivers`,
  `${ORIGIN}/v1/seasons/current/standings/constructors`,
  `${ORIGIN}/v1/seasons/current/grand-prix/1`,
  `${ORIGIN}/v1/seasons/current/grand-prix/1/results`,
  `${ORIGIN}/v1/content/manifest?season=current`,
];

interface Harness {
  storage: MemorySnapshotStorage;
  purger: RecordingPurgeAdapter;
  publisher: SnapshotPublisher;
}

function harnessFor(
  storage: MemorySnapshotStorage = new MemorySnapshotStorage(),
): Harness {
  const purger = new RecordingPurgeAdapter();
  return { storage, purger, publisher: publisherFor(storage, purger) };
}

async function publish(
  harness: Harness,
  source: ProviderSeasonSource,
  version: string,
  sourceUpdatedAt = source.sourceUpdatedAt,
): Promise<void> {
  const result = await harness.publisher.publish(
    setFor(source, version, sourceUpdatedAt),
  );
  expect(result.status, `publishing ${version}`).toBe('applied');
}

/** The last batch the purger was handed. */
function lastBatch(harness: Harness): string[] {
  const batch = harness.purger.batches.at(-1);
  expect(batch, 'a purge batch').toBeDefined();
  return batch as string[];
}

async function inventoryOf(
  harness: Harness,
  season: number,
): Promise<SnapshotDocumentName[]> {
  const version = await harness.storage.getActiveVersion(season);
  expect(version).not.toBeNull();
  const inventory = await harness.storage.readVersionInventory(
    season,
    version as string,
  );
  expect(inventory).not.toBeNull();
  return inventory as SnapshotDocumentName[];
}

function profileDocuments(
  inventory: readonly SnapshotDocumentName[],
): SnapshotDocumentName[] {
  return inventory.filter(
    (name) =>
      name.startsWith('driver:') ||
      name.startsWith('constructor:') ||
      name.startsWith('circuit:'),
  );
}

/** Both alias forms of one profile document, derived like the router reads them. */
function profileAliasesFor(document: SnapshotDocumentName): string[] {
  const separator = document.indexOf(':');
  const kind = document.slice(0, separator);
  const id = document.slice(separator + 1);
  const segment =
    kind === 'driver'
      ? 'drivers'
      : kind === 'constructor'
        ? 'constructors'
        : 'circuits';
  const base = `${ORIGIN}/v1/${segment}/${id}`;
  return [base, `${base}?season=current`];
}

/** Removes one driver from the season entry lists, by document name. */
function withoutDriverEntry(
  source: ProviderSeasonSource,
  document: string,
): ProviderSeasonSource {
  const driverId = document.slice('driver:'.length);
  return {
    ...source,
    drivers: source.drivers.filter((driver) => driver.id !== driverId),
    driverEntries: source.driverEntries.filter(
      (entry) => entry.driverId !== driverId,
    ),
    // The lineup names drivers by id, so a constructor entry that still
    // referenced the removed driver would fail generation rather than model a
    // season that simply no longer fields them.
    constructorEntries: source.constructorEntries.map((entry) => ({
      ...entry,
      driverLineup: entry.driverLineup?.filter((id) => id !== driverId) ?? null,
    })),
    driverStandings: source.driverStandings.filter(
      (standing) => standing.driverId !== driverId,
    ),
    results: source.results.map((result) => ({
      ...result,
      entries: result.entries.filter((entry) => entry.driverId !== driverId),
    })),
  };
}

describe('publication invalidates every current-season alias', () => {
  it('purges the season-level omitted and explicit current aliases', async () => {
    const harness = harnessFor();
    await publish(harness, await seasonFixture(), TARGET);

    for (const alias of seasonLevelAliases) {
      expect(lastBatch(harness), alias).toContain(alias);
    }
  });

  it('purges both alias forms of every driver, constructor and circuit profile', async () => {
    const harness = harnessFor();
    await publish(harness, await seasonFixture(), TARGET);
    const profiles = profileDocuments(await inventoryOf(harness, SEASON));
    expect(profiles.length).toBeGreaterThan(0);

    const purged = lastBatch(harness);
    for (const document of profiles) {
      for (const alias of profileAliasesFor(document)) {
        expect(purged, alias).toContain(alias);
      }
    }
  });

  it('still purges every canonical numeric URL', async () => {
    const harness = harnessFor();
    await publish(harness, await seasonFixture(), TARGET);
    const inventory = await inventoryOf(harness, SEASON);

    const purged = lastBatch(harness);
    for (const url of publicUrlsForDocuments(ORIGIN, SEASON, inventory)) {
      expect(purged, url).toContain(url);
    }
  });

  it('is exactly the canonical set plus the accepted aliases', async () => {
    const harness = harnessFor();
    await publish(harness, await seasonFixture(), TARGET);
    const inventory = await inventoryOf(harness, SEASON);

    expect(lastBatch(harness)).toEqual(
      invalidationUrlsForDocuments(
        ORIGIN,
        SEASON,
        inventory,
        'season-is-current',
      ),
    );
  });

  it('invents no alias the router does not serve', async () => {
    const harness = harnessFor();
    await publish(harness, await seasonFixture(), TARGET);

    const purged = lastBatch(harness);
    for (const url of nonRoutes) {
      expect(purged, url).not.toContain(url);
    }
  });

  it('purges one deduplicated, deterministically sorted batch', async () => {
    const harness = harnessFor();
    await publish(harness, await seasonFixture(), TARGET);

    const purged = lastBatch(harness);
    expect(new Set(purged).size).toBe(purged.length);
    expect(purged).toEqual([...purged].sort());
  });
});

describe('rollback invalidates the same alias surface', () => {
  it('purges every season-level and profile alias', async () => {
    const harness = harnessFor();
    const source = await seasonFixture();
    await publish(harness, source, TARGET);
    await publish(harness, source, NEWER, LATER);

    const result = await harness.publisher.rollback(SEASON, TARGET);

    expect(result.status).toBe('applied');
    for (const alias of seasonLevelAliases) {
      expect(result.purgedUrls, alias).toContain(alias);
    }
    for (const document of profileDocuments(
      await inventoryOf(harness, SEASON),
    )) {
      for (const alias of profileAliasesFor(document)) {
        expect(result.purgedUrls, alias).toContain(alias);
      }
    }
  });

  it('equals the aliased union of both version inventories', async () => {
    const harness = harnessFor();
    const source = await seasonFixture();
    await publish(harness, source, TARGET);
    await publish(harness, source, NEWER, LATER);
    const target =
      (await harness.storage.readVersionInventory(SEASON, TARGET)) ?? [];
    const newer =
      (await harness.storage.readVersionInventory(SEASON, NEWER)) ?? [];

    const result = await harness.publisher.rollback(SEASON, TARGET);

    expect(result.purgedUrls).toEqual(
      invalidationUrlsForDocuments(
        ORIGIN,
        SEASON,
        [...target, ...newer],
        'season-is-current',
      ),
    );
    expect(new Set(result.purgedUrls).size).toBe(result.purgedUrls.length);
    expect(result.purgedUrls).toEqual([...result.purgedUrls].sort());
  });

  it('keeps the committed pointer when the aliased purge fails', async () => {
    const storage = new MemorySnapshotStorage();
    const source = await seasonFixture();
    const recording = harnessFor(storage);
    await publish(recording, source, TARGET);
    await publish(recording, source, NEWER, LATER);
    const publisher = publisherFor(storage, new ExplodingPurgeAdapter());

    const result = await publisher.rollback(SEASON, TARGET);

    expect(result.status).toBe('applied');
    expect(result.reason).toBe('cache-purge-failed');
    expect(result.cachePurge).toBe('failed');
    expect(result.cachePurgeOk).toBe(false);
    expect(await storage.getActiveVersion(SEASON)).toBe(TARGET);
  });
});

describe('the operator purge invalidates the same alias surface', () => {
  it('purges the aliased set for the current season', async () => {
    const harness = harnessFor();
    await publish(harness, await seasonFixture(), TARGET);
    const inventory = await inventoryOf(harness, SEASON);

    const result = await harness.publisher.purgeActiveVersion(SEASON);

    expect(result.ok).toBe(true);
    expect(result.urls).toEqual(
      invalidationUrlsForDocuments(
        ORIGIN,
        SEASON,
        inventory,
        'season-is-current',
      ),
    );
  });

  it('stays contained when the purger throws', async () => {
    const storage = new MemorySnapshotStorage();
    await publish(harnessFor(storage), await seasonFixture(), TARGET);
    const publisher = publisherFor(storage, new ExplodingPurgeAdapter());

    const result = await publisher.purgeActiveVersion(SEASON);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('cache-purge-failed');
    expect(result.urls).toEqual([]);
  });
});

describe('a historical season keeps numeric-only invalidation', () => {
  it('purges its canonical URLs and no current alias', async () => {
    const harness = harnessFor();
    const source = await seasonFixture();
    await publish(harness, source, TARGET);
    await publish(harness, { ...source, season: NEXT_SEASON }, NEWER, LATER);
    expect(await harness.storage.getCurrentSeason()).toBe(NEXT_SEASON);
    const inventory = await inventoryOf(harness, SEASON);

    const result = await harness.publisher.purgeActiveVersion(SEASON);

    expect(result.ok).toBe(true);
    expect(result.urls).toEqual(
      publicUrlsForDocuments(ORIGIN, SEASON, inventory),
    );
    for (const alias of seasonLevelAliases) {
      expect(result.urls, alias).not.toContain(alias);
    }
  });

  it('maps no historical route onto a current alias', async () => {
    const harness = harnessFor();
    const source = await seasonFixture();
    await publish(harness, source, TARGET);
    await publish(harness, { ...source, season: NEXT_SEASON }, NEWER, LATER);

    const result = await harness.publisher.purgeActiveVersion(SEASON);

    for (const url of result.urls) {
      expect(url, url).not.toContain('season=current');
      expect(url, url).not.toContain('/seasons/current');
    }
    expect(result.urls).toContain(`${ORIGIN}/v1/seasons/${SEASON}`);
  });
});

describe('a current-season transition invalidates both sides', () => {
  it('purges the aliases of the incoming current season', async () => {
    const harness = harnessFor();
    const source = await seasonFixture();
    await publish(harness, source, TARGET);
    await publish(harness, { ...source, season: NEXT_SEASON }, NEWER, LATER);

    for (const alias of seasonLevelAliases) {
      expect(lastBatch(harness), alias).toContain(alias);
    }
  });

  it('purges a profile alias the outgoing season cached and the incoming one drops', async () => {
    const harness = harnessFor();
    const source = await seasonFixture();
    await publish(harness, source, TARGET);
    const outgoing = profileDocuments(await inventoryOf(harness, SEASON));
    const dropped = outgoing.find((name) => name.startsWith('driver:'));
    expect(dropped).toBeDefined();
    const withoutDriver = withoutDriverEntry(source, dropped as string);

    await publish(
      harness,
      { ...withoutDriver, season: NEXT_SEASON },
      NEWER,
      LATER,
    );

    const purged = lastBatch(harness);
    expect(await inventoryOf(harness, NEXT_SEASON)).not.toContain(dropped);
    for (const alias of profileAliasesFor(dropped as SnapshotDocumentName)) {
      expect(purged, alias).toContain(alias);
    }
  });

  it('reports a failed purge when the outgoing alias surface cannot be read', async () => {
    const storage = new ScriptableStorage();
    const source = await seasonFixture();
    await publish(harnessFor(storage), source, TARGET);
    const publisher = publisherFor(storage, new MemoryCachePurgeAdapter());
    const version = await storage.getActiveVersion(SEASON);
    storage.hideInventory(SEASON, version as string);

    const result = await publisher.publish(
      setFor({ ...source, season: NEXT_SEASON }, NEWER, LATER),
    );

    expect(result.status).toBe('applied');
    expect(result.cachePurge).toBe('failed');
    expect(result.reason).toBe('cache-purge-failed');
    expect(await storage.getActiveVersion(NEXT_SEASON)).toBe(NEWER);
  });
});

describe('an unresolvable current season fails toward over-invalidation', () => {
  it('expands aliases when the current-season read is unavailable', async () => {
    const storage = new ScriptableStorage();
    await publish(harnessFor(storage), await seasonFixture(), TARGET);
    const publisher = publisherFor(storage, new RecordingPurgeAdapter());
    storage.arm('getCurrentSeason', 'every', 'reject');

    const result = await publisher.purgeActiveVersion(SEASON);

    storage.disarm();
    for (const alias of seasonLevelAliases) {
      expect(result.urls, alias).toContain(alias);
    }
  });
});
