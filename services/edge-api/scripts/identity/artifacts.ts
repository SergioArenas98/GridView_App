import { prepareSeed } from '../../src/identity/catalog/seed';
import { exportSeed } from '../../src/identity/catalog/export';
import { catalogIndexes } from '../../src/identity/catalog/indexes';
import { canonicalJson } from '../../src/ingest/canonical-json';
import { providerMappingRegistry } from '../../src/providers/mappings';
import { curatedParticipants } from '../../src/providers/jolpica/curated-participants';
import { curatedCircuits } from '../../src/providers/jolpica/curated-circuits';
import { curatedEventNames } from '../../src/providers/jolpica/curated-events';
import {
  requireCatalog,
  type RepositorySource,
} from '../../src/identity/catalog/model';
export async function artifacts(
  corpus: Omit<RepositorySource, 'semanticHash'>[],
) {
  const seed = await prepareSeed(corpus),
    indexes = await catalogIndexes(seed),
    legacy = providerMappingRegistry();
  const same = (a: unknown, b: unknown) =>
    canonicalJson(a) === canonicalJson(b);
  const bindings = seed.snapshot.bindings.map((b) => ({
    key: b.key,
    targetId: b.targetId,
    equal: same(indexes.registry.resolve(b.key), legacy.resolve(b.key)),
  }));
  const drivers = seed.snapshot.drivers.map((d) => ({
    id: d.anchor.driverId,
    equal: same(
      indexes.participants.driverById(d.anchor.driverId),
      curatedParticipants().driverById(d.anchor.driverId),
    ),
  }));
  const constructors = seed.snapshot.constructors.map((c) => ({
    id: c.id,
    equal: same(
      indexes.participants.constructorById(c.id),
      curatedParticipants().constructorById(c.id),
    ),
  }));
  const circuits = seed.snapshot.circuits.map((c) => ({
    id: c.id,
    equal: same(indexes.circuits.get(c.id), curatedCircuits().get(c.id)),
  }));
  const events = seed.snapshot.events.map((e) => ({
    id: e.id,
    equal: e.name === curatedEventNames().get(e.id),
  }));
  const unresolved = seed.snapshot.unresolved.map((u) => ({
    key: u.key,
    equal: same(indexes.registry.resolve(u.key), legacy.resolve(u.key)),
    unresolved: indexes.registry.resolve(u.key).outcome === 'unresolved',
  }));
  requireCatalog(
    [
      ...bindings,
      ...drivers,
      ...constructors,
      ...circuits,
      ...events,
      ...unresolved,
    ].every((r) => r.equal) && unresolved.every((r) => r.unresolved),
    'bundled-parity',
  );
  return {
    'seed.json': await exportSeed(seed),
    'manifest.json': canonicalJson({
      format: 'gridview-identity-seed-manifest/1',
      state: seed.state,
      contentHash: seed.contentHash,
      snapshotByteLength: seed.snapshotByteLength,
      sources: seed.sources.map(({ text, ...s }) => {
        void text;
        return s;
      }),
      counts: {
        drivers: drivers.length,
        constructors: constructors.length,
        circuits: circuits.length,
        events: events.length,
        bindings: bindings.length,
        evidence: seed.snapshot.evidence.length,
        unresolved: unresolved.length,
      },
      datasetVersion: '2026.10.07.1',
    }),
    'parity.json': canonicalJson({
      format: 'gridview-identity-seed-parity/1',
      contentHash: seed.contentHash,
      valid: true,
      bindings,
      drivers,
      constructors,
      circuits,
      events,
      unresolved,
    }),
  };
}
