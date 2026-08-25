/**
 * Shared helpers for the provider-mapping tests.
 *
 * Everything here is a fixed local fixture or the checked-in curated content.
 * No test in this directory contacts a provider, reads the network or depends
 * on the current Formula 1 season.
 */

import {
  buildProviderMappingRegistry,
  curatedMappingDocuments,
  curatedRegistries,
  type CanonicalRegistries,
  type ProviderMappingEntity,
  type ProviderMappingKey,
  type ProviderMappingKeyFor,
  type ProviderMappingRegistry,
} from '../../../src/providers/mappings';

export const SEASON = 2026;

/** The canonical GridView registries, as the runtime reads them. */
export const canonical: CanonicalRegistries = curatedRegistries();

/** A registry over the real curated content. */
export function realRegistry(): ProviderMappingRegistry {
  return buildProviderMappingRegistry(curatedMappingDocuments(), canonical);
}

/** A registry over ad-hoc records, sharing the real canonical registries. */
export function registryOf(
  mappings: readonly unknown[],
  season: number = SEASON,
  registries: CanonicalRegistries = canonical,
): ProviderMappingRegistry {
  return buildProviderMappingRegistry([{ season, mappings }], registries);
}

/**
 * Narrows a key literal to its entity variant without any cast at the call
 * site, so a test can never smuggle an invalid combination past the types.
 */
export function key<E extends ProviderMappingEntity>(
  value: ProviderMappingKeyFor<E>,
): ProviderMappingKeyFor<E> {
  return value;
}

/** A well-formed curated record for tests that only vary one field. */
export function record(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    source: 'jolpica',
    entity: 'driver',
    providerField: 'driverId',
    providerValue: 'norris',
    gridviewId: 'lando-norris',
    evidence: 'test fixture',
    ...overrides,
  };
}

/** Every key variant, for exhaustiveness checks. */
export const allKeys: readonly ProviderMappingKey[] = [
  {
    season: SEASON,
    source: 'jolpica',
    entity: 'driver',
    providerField: 'driverId',
    providerValue: 'norris',
  },
  {
    season: SEASON,
    source: 'jolpica',
    entity: 'constructor',
    providerField: 'constructorId',
    providerValue: 'mclaren',
  },
  {
    season: SEASON,
    source: 'jolpica',
    entity: 'circuit',
    providerField: 'circuitId',
    providerValue: 'albert_park',
  },
  {
    season: SEASON,
    source: 'openf1',
    entity: 'driver',
    providerField: 'driver_number',
    providerValue: 1,
  },
  {
    season: SEASON,
    source: 'openf1',
    entity: 'constructor',
    providerField: 'team_name',
    providerValue: 'Mercedes',
  },
  {
    season: SEASON,
    source: 'openf1',
    entity: 'circuit',
    providerField: 'circuit_key',
    providerValue: 7,
  },
];
