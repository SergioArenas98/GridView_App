import { buildProviderMappingRegistry } from '../../providers/mappings/mapping-registry';
import { curatedParticipantsFrom } from '../../providers/jolpica/curated-participants';
import { curatedCircuitsFrom } from '../../providers/jolpica/curated-circuits';
import { validateSeed } from './validate';
import { requireCatalog } from './model';
/** Explicit offline parity projection. No runtime resolver selection or cache. */
export async function catalogIndexes(input: unknown) {
  const seed = await validateSeed(input),
    s = seed.snapshot;
  const document = s.sourceDocuments.find(
    (d) => d.document.kind === 'provider-mappings',
  )!.document;
  const registry = buildProviderMappingRegistry([document], {
    driver: new Set(s.drivers.map((d) => d.anchor.driverId)),
    constructor: new Set(s.constructors.map((c) => c.id)),
    circuit: new Set(s.circuits.map((c) => c.id)),
    event: new Set(s.events.map((e) => e.id)),
  });
  requireCatalog(registry.isValid, 'derived-index');
  return {
    registry,
    participants: curatedParticipantsFrom(
      s.drivers.map((d) => d.profile),
      s.constructors,
    ),
    circuits: curatedCircuitsFrom(s.circuits),
    events: new Map(s.events.map((e) => [e.id, e.name])),
  };
}

/** Complete registry construction shared by immutable child revision validation. */
export function reviewedRegistry(snapshot: import('./model').CatalogSnapshot) {
  return buildProviderMappingRegistry(
    snapshot.seasonContent.map((sc) => ({
      schemaVersion: 2,
      kind: 'provider-mappings',
      season: sc.season,
      mappings: snapshot.bindings
        .filter((b) => b.key.season === sc.season)
        .map((b) => ({
          source: b.key.source,
          entity: b.key.entity,
          providerField: b.key.providerField,
          providerValue: b.key.providerValue,
          gridviewId: b.targetId,
        })),
    })),
    {
      driver: new Set(snapshot.drivers.map((d) => d.anchor.driverId)),
      constructor: new Set(snapshot.constructors.map((c) => c.id)),
      circuit: new Set(snapshot.circuits.map((c) => c.id)),
      event: new Set(snapshot.events.map((e) => e.id)),
    },
  );
}
