/**
 * A replacement release withdraws routes, and a withdrawn route is exactly the
 * one nothing else will invalidate.
 *
 * Publication maps the **incoming** version's inventory to public URLs. That
 * covers every route the new release still carries, and misses every route the
 * outgoing release carried and the new one drops: a driver who left the grid, a
 * cancelled round, results reclassified as absent. The origin stops serving
 * those documents the moment the active pointer moves, but the CDN keys on the
 * request URL and keeps the withdrawn response until its TTL expires - an hour
 * for a profile route.
 *
 * Rollback has always purged the union of both inventories for this reason. The
 * suite below pins the same property for publication, across every document
 * family whose removal is structurally possible, and pins the failure direction
 * when the outgoing surface cannot be enumerated at all.
 *
 * The ten `baseDocumentNames` are deliberately absent from the families below:
 * a version missing one of them is `incomplete` and is rejected before the
 * commit point, so a season collection or a standings document cannot be
 * withdrawn by a publication that succeeds.
 */

import { describe, expect, it } from 'vitest';

import {
  invalidationUrlsForDocuments,
  publicUrlsForDocuments,
} from '../../src/cache/purge';
import type { SnapshotPublisher } from '../../src/publication/publisher';
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

const FIRST = 'v1';
const SECOND = 'v2';
const LATER = '2026-07-25T00:00:00.000Z';
/** A season published after `SEASON`, so publishing it moves `current`. */
const NEXT_SEASON = 2027;

/**
 * Storage whose current-season pointer is fixed, so a publication can be driven
 * against a season the aliases do **not** resolve to.
 *
 * `publish` writes `setCurrentSeason(set.season)` at its commit point, so in an
 * ordinary run the season being published is always the current one. Pinning
 * the pointer is the only way to exercise the historical branch of the shared
 * expansion through the publisher rather than through the operator purge.
 */
class PinnedCurrentSeasonStorage extends MemorySnapshotStorage {
  constructor(private readonly pinned: number) {
    super();
  }
  override async getCurrentSeason(): Promise<number | null> {
    return this.pinned;
  }
}

/** Storage that returns a structurally invalid inventory for one version. */
class CorruptInventoryStorage extends MemorySnapshotStorage {
  private corrupt: string | null = null;

  corruptInventoryFor(season: number, version: string): void {
    this.corrupt = `${season}:${version}`;
  }

  override async readVersionInventory(
    season: number,
    version: string,
  ): Promise<SnapshotDocumentName[] | null> {
    if (this.corrupt === `${season}:${version}`) {
      // What a truncated or hand-edited stored value deserializes to. It is not
      // an inventory, and it must not be read as an empty one.
      return 'grand-prix:1' as unknown as SnapshotDocumentName[];
    }
    return super.readVersionInventory(season, version);
  }
}

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

/** The last batch the purger was handed, never an accumulation of batches. */
function lastBatch(harness: Harness): string[] {
  const batch = harness.purger.batches.at(-1);
  expect(batch, 'a purge batch').toBeDefined();
  return batch as string[];
}

async function inventoryOf(
  storage: MemorySnapshotStorage,
  season: number,
  version: string,
): Promise<SnapshotDocumentName[]> {
  const inventory = await storage.readVersionInventory(season, version);
  expect(inventory, `inventory of ${version}`).not.toBeNull();
  return inventory as SnapshotDocumentName[];
}

/** The first element of a fixture collection, proven present rather than asserted with `!`. */
function first<T>(items: readonly T[], what: string): T {
  const item = items[0];
  expect(item, what).toBeDefined();
  return item as T;
}

/** Every URL the router serves one document under for the current season. */
function urlsFor(document: SnapshotDocumentName): string[] {
  return invalidationUrlsForDocuments(
    ORIGIN,
    SEASON,
    [document],
    'season-is-current',
  );
}

function withoutDriver(
  source: ProviderSeasonSource,
  driverId: string,
): ProviderSeasonSource {
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

function withoutConstructor(
  source: ProviderSeasonSource,
  constructorId: string,
): ProviderSeasonSource {
  const drivers = source.driverEntries
    .filter((entry) => entry.constructorId === constructorId)
    .map((entry) => entry.driverId);
  const dropped = drivers.reduce(withoutDriver, source);
  return {
    ...dropped,
    constructors: dropped.constructors.filter(
      (item) => item.id !== constructorId,
    ),
    constructorEntries: dropped.constructorEntries.filter(
      (entry) => entry.constructorId !== constructorId,
    ),
    constructorStandings: dropped.constructorStandings.filter(
      (standing) => standing.constructorId !== constructorId,
    ),
  };
}

function withoutCircuit(
  source: ProviderSeasonSource,
  circuitId: string,
): ProviderSeasonSource {
  const rounds = source.calendar
    .filter((event) => event.circuitId === circuitId)
    .map((event) => event.round);
  const dropped = rounds.reduce(withoutRound, source);
  return {
    ...dropped,
    circuits: dropped.circuits.filter((circuit) => circuit.id !== circuitId),
  };
}

function withoutRound(
  source: ProviderSeasonSource,
  round: number,
): ProviderSeasonSource {
  return {
    ...source,
    calendar: source.calendar.filter((event) => event.round !== round),
    results: source.results.filter((result) => result.round !== round),
  };
}

/** Keeps the round, withdraws only its results document. */
function withoutResults(
  source: ProviderSeasonSource,
  round: number,
): ProviderSeasonSource {
  return {
    ...source,
    calendar: source.calendar.map((event) =>
      event.round === round ? { ...event, hasResults: false } : event,
    ),
    results: source.results.filter((result) => result.round !== round),
  };
}

/**
 * Publishes a replacement that drops documents, and returns what the outgoing
 * release carried, what the incoming one carries and the batch that was purged.
 */
async function replacement(
  narrow: (source: ProviderSeasonSource) => ProviderSeasonSource,
): Promise<{
  outgoing: SnapshotDocumentName[];
  incoming: SnapshotDocumentName[];
  purged: string[];
}> {
  const harness = harnessFor();
  const source = await seasonFixture();
  await publish(harness, source, FIRST);
  const outgoing = await inventoryOf(harness.storage, SEASON, FIRST);
  await publish(harness, narrow(source), SECOND, LATER);
  const incoming = await inventoryOf(harness.storage, SEASON, SECOND);
  return { outgoing, incoming, purged: lastBatch(harness) };
}

describe('a replacement release purges the routes it withdraws', () => {
  it('purges all three URLs of a withdrawn driver profile', async () => {
    const source = await seasonFixture();
    const driverId = first(source.drivers, 'a driver').id;
    const { incoming, purged } = await replacement((item) =>
      withoutDriver(item, driverId),
    );

    const document = `driver:${driverId}` as SnapshotDocumentName;
    expect(incoming).not.toContain(document);
    expect(urlsFor(document)).toHaveLength(3);
    for (const url of urlsFor(document)) {
      expect(purged, url).toContain(url);
    }
  });

  it('purges all three URLs of a withdrawn constructor profile', async () => {
    const source = await seasonFixture();
    const constructorId = first(source.constructors, 'a constructor').id;
    const { incoming, purged } = await replacement((item) =>
      withoutConstructor(item, constructorId),
    );

    const document = `constructor:${constructorId}` as SnapshotDocumentName;
    expect(incoming).not.toContain(document);
    expect(urlsFor(document)).toHaveLength(3);
    for (const url of urlsFor(document)) {
      expect(purged, url).toContain(url);
    }
  });

  it('purges all three URLs of a withdrawn circuit profile', async () => {
    const source = await seasonFixture();
    const circuitId = first(source.circuits, 'a circuit').id;
    const { incoming, purged } = await replacement((item) =>
      withoutCircuit(item, circuitId),
    );

    const document = `circuit:${circuitId}` as SnapshotDocumentName;
    expect(incoming).not.toContain(document);
    expect(urlsFor(document)).toHaveLength(3);
    for (const url of urlsFor(document)) {
      expect(purged, url).toContain(url);
    }
  });

  it('purges the detail and results URLs of a withdrawn round', async () => {
    const source = await seasonFixture();
    const round = first(source.results, 'a result').round;
    const { incoming, purged } = await replacement((item) =>
      withoutRound(item, round),
    );

    const detail = `grand-prix:${round}` as SnapshotDocumentName;
    const results = `grand-prix:${round}:results` as SnapshotDocumentName;
    expect(incoming).not.toContain(detail);
    expect(incoming).not.toContain(results);
    for (const url of [...urlsFor(detail), ...urlsFor(results)]) {
      expect(purged, url).toContain(url);
    }
  });

  it('purges a results URL withdrawn while its round is retained', async () => {
    const source = await seasonFixture();
    const round = first(source.results, 'a result').round;
    const { incoming, purged } = await replacement((item) =>
      withoutResults(item, round),
    );

    const detail = `grand-prix:${round}` as SnapshotDocumentName;
    const results = `grand-prix:${round}:results` as SnapshotDocumentName;
    expect(incoming).toContain(detail);
    expect(incoming).not.toContain(results);
    for (const url of urlsFor(results)) {
      expect(purged, url).toContain(url);
    }
  });

  it('is exactly the aliased union of the outgoing and incoming inventories', async () => {
    const source = await seasonFixture();
    const driverId = first(source.drivers, 'a driver').id;
    const { outgoing, incoming, purged } = await replacement((item) =>
      withoutDriver(item, driverId),
    );

    expect(purged).toEqual(
      invalidationUrlsForDocuments(
        ORIGIN,
        SEASON,
        [...outgoing, ...incoming],
        'season-is-current',
      ),
    );
  });

  it('keeps incoming and pointer-derived routes, deduplicated and sorted', async () => {
    const source = await seasonFixture();
    const driverId = first(source.drivers, 'a driver').id;
    const { incoming, purged } = await replacement((item) =>
      withoutDriver(item, driverId),
    );

    for (const url of invalidationUrlsForDocuments(
      ORIGIN,
      SEASON,
      incoming,
      'season-is-current',
    )) {
      expect(purged, url).toContain(url);
    }
    for (const derived of ['bootstrap', 'home', 'season', 'content:manifest']) {
      for (const url of urlsFor(derived as SnapshotDocumentName)) {
        expect(purged, url).toContain(url);
      }
    }
    expect(new Set(purged).size).toBe(purged.length);
    expect(purged).toEqual([...purged].sort());
  });
});

describe('a historical season withdraws canonical routes only', () => {
  it('purges the withdrawn numeric URL and invents no current alias', async () => {
    const storage = new PinnedCurrentSeasonStorage(NEXT_SEASON);
    const harness = harnessFor(storage);
    const source = await seasonFixture();
    await publish(harness, source, FIRST);
    const outgoing = await inventoryOf(storage, SEASON, FIRST);
    const driverId = first(source.drivers, 'a driver').id;

    await publish(harness, withoutDriver(source, driverId), SECOND, LATER);

    const incoming = await inventoryOf(storage, SEASON, SECOND);
    const purged = lastBatch(harness);
    expect(incoming).not.toContain(`driver:${driverId}`);
    expect(purged).toEqual(
      publicUrlsForDocuments(ORIGIN, SEASON, [...outgoing, ...incoming]),
    );
    expect(purged).toContain(
      `${ORIGIN}/v1/drivers/${driverId}?season=${SEASON}`,
    );
    expect(purged).not.toContain(`${ORIGIN}/v1/drivers/${driverId}`);
    expect(purged).not.toContain(
      `${ORIGIN}/v1/drivers/${driverId}?season=current`,
    );
  });
});

describe('a first publication has nothing to withdraw', () => {
  it('purges the incoming inventory and reports a clean purge', async () => {
    const harness = harnessFor();
    const source = await seasonFixture();

    const result = await harness.publisher.publish(setFor(source, FIRST));

    expect(result.status).toBe('applied');
    expect(result.cachePurge).toBe('succeeded');
    const incoming = await inventoryOf(harness.storage, SEASON, FIRST);
    expect(result.purgedUrls).toEqual(
      invalidationUrlsForDocuments(
        ORIGIN,
        SEASON,
        incoming,
        'season-is-current',
      ),
    );
  });
});

describe('an unenumerable outgoing surface fails the purge, not the release', () => {
  it('reports a failed purge when the outgoing inventory is missing', async () => {
    const storage = new ScriptableStorage();
    const harness = harnessFor(storage);
    const source = await seasonFixture();
    await publish(harness, source, FIRST);
    storage.hideInventory(SEASON, FIRST);

    const result = await harness.publisher.publish(
      setFor(
        withoutDriver(source, first(source.drivers, 'a driver').id),
        SECOND,
        LATER,
      ),
    );

    expect(result.status).toBe('applied');
    expect(result.cachePurge).toBe('failed');
    expect(result.cachePurgeOk).toBe(false);
    expect(result.reason).toBe('cache-purge-failed');
    expect(await storage.getActiveVersion(SEASON)).toBe(SECOND);
  });

  it('reports a failed purge when the outgoing inventory is malformed', async () => {
    const storage = new CorruptInventoryStorage();
    const harness = harnessFor(storage);
    const source = await seasonFixture();
    await publish(harness, source, FIRST);
    storage.corruptInventoryFor(SEASON, FIRST);

    const result = await harness.publisher.publish(
      setFor(
        withoutDriver(source, first(source.drivers, 'a driver').id),
        SECOND,
        LATER,
      ),
    );

    expect(result.status).toBe('applied');
    expect(result.cachePurge).toBe('failed');
    expect(result.cachePurgeOk).toBe(false);
    expect(await storage.getActiveVersion(SEASON)).toBe(SECOND);
  });

  it('reports a failed purge when the outgoing inventory read throws', async () => {
    const storage = new ScriptableStorage();
    const harness = harnessFor(storage);
    const source = await seasonFixture();
    await publish(harness, source, FIRST);
    const set = setFor(
      withoutDriver(source, first(source.drivers, 'a driver').id),
      SECOND,
      LATER,
    );
    storage.arm('readVersionInventory', 1, 'throw');

    const result = await harness.publisher.publish(set);

    storage.disarm();
    expect(result.status).toBe('applied');
    expect(result.cachePurge).toBe('failed');
    expect(await storage.pointers(SEASON)).toEqual({
      active: SECOND,
      previous: FIRST,
    });
  });

  it('reports a failed purge when the outgoing inventory read rejects', async () => {
    const storage = new ScriptableStorage();
    const harness = harnessFor(storage);
    const source = await seasonFixture();
    await publish(harness, source, FIRST);
    const set = setFor(
      withoutDriver(source, first(source.drivers, 'a driver').id),
      SECOND,
      LATER,
    );
    storage.arm('readVersionInventory', 1, 'reject');

    const result = await harness.publisher.publish(set);

    storage.disarm();
    expect(result.status).toBe('applied');
    expect(result.cachePurge).toBe('failed');
    expect(await storage.getActiveVersion(SEASON)).toBe(SECOND);
  });

  it('contains a purge adapter that throws over the widened set', async () => {
    const storage = new MemorySnapshotStorage();
    const source = await seasonFixture();
    await publish(harnessFor(storage), source, FIRST);
    const publisher = publisherFor(storage, new ExplodingPurgeAdapter());

    const result = await publisher.publish(
      setFor(
        withoutDriver(source, first(source.drivers, 'a driver').id),
        SECOND,
        LATER,
      ),
    );

    expect(result.status).toBe('applied');
    expect(result.cachePurge).toBe('failed');
    expect(result.purgedUrls).toEqual([]);
    expect(await storage.getActiveVersion(SEASON)).toBe(SECOND);
  });
});

describe('a cross-season transition keeps alias-only treatment', () => {
  it('leaves the outgoing season season-scoped URLs untouched', async () => {
    const harness = harnessFor();
    const source = await seasonFixture();
    await publish(harness, source, FIRST);
    const outgoing = await inventoryOf(harness.storage, SEASON, FIRST);

    await publish(harness, { ...source, season: NEXT_SEASON }, SECOND, LATER);

    // `/v1/content/manifest` carries no season and belongs to both releases, so
    // the outgoing season's *season-scoped* URLs are the ones that must not be
    // evicted: its active version did not change and they still serve correctly.
    const purged = lastBatch(harness);
    const seasonScoped = publicUrlsForDocuments(
      ORIGIN,
      SEASON,
      outgoing,
    ).filter((url) => url.includes(String(SEASON)));
    expect(seasonScoped.length).toBe(outgoing.length - 1);
    for (const url of seasonScoped) {
      expect(purged, url).not.toContain(url);
    }
    expect(purged).toContain(`${ORIGIN}/v1/seasons/current`);
    expect(purged).toContain(`${ORIGIN}/v1/seasons/${NEXT_SEASON}`);
    expect(purged).toContain(`${ORIGIN}/v1/content/manifest`);
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(FIRST);
  });
});
