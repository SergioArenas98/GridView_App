/**
 * The curated provider-identifier mapping registry, built from version-
 * controlled content.
 *
 * **Dormant by design.** Nothing imports this at runtime yet: no adapter for
 * `jolpica` or `openf1` exists, `PROVIDER_MODE` still admits exactly
 * `mock | none`, and the mock provider emits GridView-owned identities and
 * therefore neither needs nor may have a mapping. It is the dependency a
 * future adapter and the G4 coordinator will consume.
 *
 * The registry is version-controlled content, not runtime state. It is not in
 * KV, not in a Durable Object, not in a database and not mutable through an
 * admin endpoint: an operator changes it through a reviewed repository change
 * (docs/operations/GridView_Provider_Mapping_Guide.md).
 */

import driversRegistry from '../../../../../content/registries/drivers.mock.json';
import constructorsRegistry from '../../../../../content/registries/constructors.mock.json';
import circuitsRegistry from '../../../../../content/registries/circuits.mock.json';
import mappings2026 from '../../../../../content/seasons/2026/provider-mappings.development.json';

import {
  buildProviderMappingRegistry,
  canonicalIdsFrom,
  type CanonicalRegistries,
  type ProviderMappingRegistry,
} from './mapping-registry';

export {
  ProviderMappingRegistry,
  buildProviderMappingRegistry,
  canonicalIdsFrom,
} from './mapping-registry';
export type {
  CanonicalRegistries,
  ProviderMappingFailure,
  ProviderMappingFailureReason,
  ProviderMappingResolution,
  RegistryProblem,
} from './mapping-registry';
export * from './mapping-key';
export {
  PROVIDER_MAPPING_FAILURE_CATEGORY,
  PROVIDER_MAPPING_OPERATION,
  providerMappingFailureEvent,
} from './mapping-signal';

/** The curated GridView registries that own canonical identities. */
export function curatedRegistries(): CanonicalRegistries {
  return {
    driver: canonicalIdsFrom(driversRegistry.drivers),
    constructor: canonicalIdsFrom(constructorsRegistry.constructors),
    circuit: canonicalIdsFrom(circuitsRegistry.circuits),
  };
}

/** Every curated mapping document, in a fixed order that never affects lookup. */
export function curatedMappingDocuments(): readonly unknown[] {
  return [mappings2026];
}

let cached: ProviderMappingRegistry | undefined;

/**
 * The process-wide registry.
 *
 * Cached at module scope because the content is immutable and the registry
 * exposes no mutator, so the cache can never go stale within an isolate and
 * can never leak state between requests.
 */
export function providerMappingRegistry(): ProviderMappingRegistry {
  cached ??= buildProviderMappingRegistry(
    curatedMappingDocuments(),
    curatedRegistries(),
  );
  return cached;
}
