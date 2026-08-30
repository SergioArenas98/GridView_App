/**
 * A version's inventory is what it actually generated, not what its
 * collections happen to advertise.
 *
 * The two are not the same set, and the difference is not hypothetical: the
 * shipped curated content carries a circuit registry entry (`monaco`) that no
 * calendar event races at, so `circuit:monaco` is generated and stored while
 * the `circuits` collection - derived from the calendar - never names it. The
 * same asymmetry exists for drivers and constructors, whose collections are
 * derived from the season *entry* lists while their detail documents are
 * generated from the registry.
 *
 * Reconstructing "what this version holds" from the collections therefore
 * under-reports the version. Two questions depend on that set, and both break
 * quietly:
 *
 * - **Completeness.** A rollback target missing a generated detail document is
 *   accepted as complete, and the pointer moves to a version that 404s a route
 *   the outgoing version served.
 * - **Cache invalidation.** The orphan's public detail route is never purged,
 *   so it keeps serving the withdrawn version's representation.
 */

import { describe, expect, it } from 'vitest';

import {
  MemoryCachePurgeAdapter,
  publicUrlsForDocuments,
} from '../../src/cache/purge';
import type { SnapshotPublisher } from '../../src/publication/publisher';
import type { SnapshotDocumentName } from '../../src/storage/types';
import { generateSnapshotSet } from '../../src/snapshots/generator';
import type { ProviderSeasonSource } from '../../src/providers/formula-one-provider';
import type { Circuit, Constructor, Driver } from '../../src/contract/types';
import {
  FIXED_NOW,
  SEASON,
  seasonFixture,
} from '../providers/coordination/support';
import { ORIGIN, ScriptableStorage, publisherFor } from './support';

const TARGET = 'v1';
const NEWER = 'v2';
const LATER = '2026-07-25T00:00:00.000Z';

interface Harness {
  storage: ScriptableStorage;
  purger: MemoryCachePurgeAdapter;
  publisher: SnapshotPublisher;
}

function harnessFor(): Harness {
  const storage = new ScriptableStorage();
  const purger = new MemoryCachePurgeAdapter();
  return { storage, purger, publisher: publisherFor(storage, purger) };
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

function documentNames(
  source: ProviderSeasonSource,
  version: string,
): SnapshotDocumentName[] {
  return generateSnapshotSet(source, FIXED_NOW, version).documents.map(
    (document) => document.documentName,
  );
}

/** A registry driver with no season entry: generated, never in `drivers`. */
function withOrphanDriver(source: ProviderSeasonSource): ProviderSeasonSource {
  const template = source.drivers[0];
  if (template === undefined) throw new Error('fixture gap');
  const orphan: Driver = { ...template, id: 'orphan-driver' };
  return { ...source, drivers: [...source.drivers, orphan] };
}

function withOrphanConstructor(
  source: ProviderSeasonSource,
): ProviderSeasonSource {
  const template = source.constructors[0];
  if (template === undefined) throw new Error('fixture gap');
  const orphan: Constructor = { ...template, id: 'orphan-constructor' };
  return { ...source, constructors: [...source.constructors, orphan] };
}

function withoutCircuit(
  source: ProviderSeasonSource,
  id: string,
): ProviderSeasonSource {
  return {
    ...source,
    circuits: source.circuits.filter((circuit: Circuit) => circuit.id !== id),
  };
}

describe('the shipped fixture already generates a document its collections omit', () => {
  it('generates circuit:monaco while the circuits collection omits monaco', async () => {
    const source = await seasonFixture();
    const set = generateSnapshotSet(source, FIXED_NOW, TARGET);
    const circuits = set.documents.find(
      (document) => document.documentName === 'circuits',
    );

    expect(source.circuits.map((circuit) => circuit.id)).toContain('monaco');
    expect(set.documents.map((document) => document.documentName)).toContain(
      'circuit:monaco',
    );
    expect(
      (circuits?.data as Array<{ id: string }>).map((circuit) => circuit.id),
    ).not.toContain('monaco');
  });
});

describe('the exact inventory is every generated document name', () => {
  it('records the whole generated set, sorted and deduplicated', async () => {
    const harness = harnessFor();
    const source = await seasonFixture();
    await publish(harness, source, TARGET);

    const inventory = await harness.storage.readVersionInventory(
      SEASON,
      TARGET,
    );
    const expected = [...new Set(documentNames(source, TARGET))].sort();

    expect(inventory).toEqual(expected);
    expect(inventory).toContain('circuit:monaco');
  });

  it('records orphan driver and constructor profiles', async () => {
    const harness = harnessFor();
    const source = withOrphanConstructor(
      withOrphanDriver(await seasonFixture()),
    );
    await publish(harness, source, TARGET);

    const inventory = await harness.storage.readVersionInventory(
      SEASON,
      TARGET,
    );

    expect(inventory).toContain('driver:orphan-driver');
    expect(inventory).toContain('constructor:orphan-constructor');
  });

  it('never maps to a public route', async () => {
    const harness = harnessFor();
    await publish(harness, await seasonFixture(), TARGET);
    const inventory =
      (await harness.storage.readVersionInventory(SEASON, TARGET)) ?? [];

    expect(
      publicUrlsForDocuments(ORIGIN, SEASON, inventory).some((url) =>
        url.includes('inventory'),
      ),
    ).toBe(false);
  });

  it('is removed with an unpublished version', async () => {
    const harness = harnessFor();
    const source = await seasonFixture();
    await publish(harness, source, TARGET);
    await publish(harness, source, NEWER, LATER);
    await harness.storage.deleteUnpublishedVersion(SEASON, TARGET);

    expect(
      await harness.storage.readVersionInventory(SEASON, TARGET),
    ).toBeNull();
  });
});

describe('completeness is decided over the exact inventory', () => {
  it('rejects a target missing a generated detail document', async () => {
    const harness = harnessFor();
    const source = await seasonFixture();
    await publish(harness, source, TARGET);
    await publish(harness, source, NEWER, LATER);
    // The orphan circuit's detail document disappears from the target.
    harness.storage.hideDocument(SEASON, TARGET, 'circuit:monaco');

    const result = await harness.publisher.rollback(SEASON, TARGET);

    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('rollback-target-incomplete');
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(NEWER);
  });

  it('rejects a target missing a generated optional results document', async () => {
    const harness = harnessFor();
    const source = await seasonFixture();
    const round = source.results[0]?.round;
    if (round === undefined) throw new Error('fixture gap');
    await publish(harness, source, TARGET);
    await publish(harness, source, NEWER, LATER);
    harness.storage.hideDocument(SEASON, TARGET, `grand-prix:${round}:results`);

    const result = await harness.publisher.rollback(SEASON, TARGET);

    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('rollback-target-incomplete');
  });

  it('fails a legacy target closed when it carries no inventory', async () => {
    const harness = harnessFor();
    const source = await seasonFixture();
    await publish(harness, source, TARGET);
    await publish(harness, source, NEWER, LATER);
    harness.storage.hideInventory(SEASON, TARGET);

    const result = await harness.publisher.rollback(SEASON, TARGET);

    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('missing-version-inventory');
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(NEWER);
  });
});

describe('the rollback purge set is the exact union of both inventories', () => {
  it('equals every public route both versions carry, sorted and deduplicated', async () => {
    const harness = harnessFor();
    const active = withOrphanDriver(await seasonFixture());
    const target = await seasonFixture();
    await publish(harness, target, TARGET);
    await publish(harness, active, NEWER, LATER);

    const result = await harness.publisher.rollback(SEASON, TARGET);
    const expected = publicUrlsForDocuments(ORIGIN, SEASON, [
      ...documentNames(target, TARGET),
      ...documentNames(active, NEWER),
    ]);

    expect(result.status).toBe('applied');
    expect(result.purgedUrls).toEqual(expected);
  });

  it('purges the orphan circuit detail route', async () => {
    const harness = harnessFor();
    const source = await seasonFixture();
    await publish(harness, source, TARGET);
    await publish(harness, source, NEWER, LATER);

    const result = await harness.publisher.rollback(SEASON, TARGET);

    expect(result.purgedUrls).toContain(
      ORIGIN + '/v1/circuits/monaco?season=' + SEASON,
    );
  });

  it('purges a profile route only one of the two versions carries', async () => {
    const harness = harnessFor();
    const target = await seasonFixture();
    const active = withOrphanDriver(target);
    await publish(harness, target, TARGET);
    await publish(harness, active, NEWER, LATER);

    const result = await harness.publisher.rollback(SEASON, TARGET);

    expect(result.purgedUrls).toContain(
      ORIGIN + '/v1/drivers/orphan-driver?season=' + SEASON,
    );
  });

  it('purges a circuit route the target dropped', async () => {
    const harness = harnessFor();
    const target = withoutCircuit(await seasonFixture(), 'monaco');
    const active = await seasonFixture();
    await publish(harness, target, TARGET);
    await publish(harness, active, NEWER, LATER);

    const result = await harness.publisher.rollback(SEASON, TARGET);

    expect(result.purgedUrls).toContain(
      ORIGIN + '/v1/circuits/monaco?season=' + SEASON,
    );
  });
});
