import drivers from '../../../../../content/registries/drivers.mock.json';
import constructors from '../../../../../content/registries/constructors.mock.json';
import circuits from '../../../../../content/registries/circuits.mock.json';
import events from '../../../../../content/registries/events.development.json';
import mappings from '../../../../../content/seasons/2026/provider-mappings.development.json';
import evidence from '../../../../../content/seasons/2026/provider-evidence.development.json';
import metadata from '../../../../../content/seasons/2026/season-metadata.development.json';
import driverEntries from '../../../../../content/seasons/2026/driver-entries.mock.json';
import constructorEntries from '../../../../../content/seasons/2026/constructor-entries.mock.json';
import overrides from '../../../../../content/seasons/2026/overrides.mock.json';
import { curatedParticipants } from '../../providers/jolpica/curated-participants';
import { curatedCircuits } from '../../providers/jolpica/curated-circuits';
import { decodeProviderMappingKey } from '../../providers/mappings/mapping-key';
import { providerMappingRegistry } from '../../providers/mappings';
import { requireCatalog } from './model';
import { freeze, boundedJson, object } from './sources';
import spec from './source-spec.json';

/** Explicit reviewed repository authority. No retained export or active-head cache. */
export function bundledIdentityContent() {
  const documents = [
    drivers,
    constructors,
    circuits,
    events,
    mappings,
    evidence,
    metadata,
    driverEntries,
    constructorEntries,
    overrides,
  ].map((d) => {
    const value = boundedJson(d);
    object(value);
    delete value.$schema;
    return value;
  });
  const participants = curatedParticipants(),
    circuitLookup = curatedCircuits();
  const bindings = mappings.mappings.map((row) => {
    const decoded = decodeProviderMappingKey({
      season: mappings.season,
      source: row.source,
      entity: row.entity,
      providerField: row.providerField,
      providerValue: row.providerValue,
    });
    requireCatalog(decoded.ok, 'bundled-key');
    return { key: decoded.key, targetId: row.gridviewId };
  });
  const sourceDocuments = Object.entries(spec)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([path, kind]) => ({
      path,
      document: documents.find((d) => d.kind === kind)!,
    }));
  const projectionInput = {
    drivers: drivers.drivers.map((d) => ({
      profile: participants.driverById(d.id)!,
    })),
    constructors: constructors.constructors.map((c) =>
      participants.constructorById(c.id)!,
    ),
    circuits: circuits.circuits.map((c) => circuitLookup.get(c.id)!),
    events: events.events,
    bindings,
    sourceDocuments,
  };
  return freeze({
    registry: providerMappingRegistry(),
    participants,
    circuits: circuitLookup,
    events: events.events,
    projectionInput,
    sourceDocuments,
  });
}
