/**
 * Turns decoded Jolpica driver and constructor rows into the normalized
 * season-participants resource.
 *
 * This is the **identity boundary** (ADR 0026 D2, D10, D11). Every canonical
 * identifier, name and fact emitted here comes from the curated mapping
 * registry and the curated registries behind it; none is derived, minted,
 * folded, trimmed or guessed from a provider value (ADR 0022 D2, D4, D5).
 *
 * **Membership is exactly the provider's rows, each resolved, or nothing.** An
 * unresolved identity fails the **whole** resource, and no row is ever dropped
 * from an otherwise accepted one (ADR 0022 D10).
 *
 * **What it emits, and what it deliberately does not.** The identity
 * inventory (`drivers`, `constructors`) and one `ConstructorSeasonEntry` per
 * mapped constructor are this port's to produce (ADR 0026 D10, D11). A
 * `DriverSeasonEntry` is not: participation spans are derived by season
 * assembly from selected, classified race results only (D3-D7), so
 * `driverEntries` is always empty here. That is the accepted ADR 0026 state,
 * not a placeholder. Nothing here assigns a driver to a constructor, and
 * nothing produces a role, a race number or a start or end round.
 */

import { canonicalConstructorSeasonEntryId } from '../../contract/identity';
import type {
  Constructor,
  ConstructorSeasonEntry,
  Driver,
} from '../../contract/types';
import type {
  ProviderMappingFailure,
  ProviderMappingRegistry,
  ProviderMappingResolution,
} from '../mappings';
import { maxReportedMappingFailures } from './calendar-normalizer';
import type { CuratedParticipants } from './curated-participants';
import type { DecodedConstructor, DecodedDriver } from './participants-payload';

/** Why a resolved collection still could not be normalized. Closed, log-safe. */
export type ParticipantsNormalizationProblem =
  /**
   * Two distinct provider identities resolved to one canonical identity.
   *
   * ADR 0022 D9 allows several curated aliases for one identity, but one
   * normalized collection holding the same identity twice is a contradictory
   * resource with a duplicate primary key, not two facts to merge.
   */
  | 'duplicate-canonical-driver'
  | 'duplicate-canonical-constructor'
  /**
   * An identity resolved, but the curated registry holds no content for it.
   * Unreachable with the committed content, whose mapping targets are checked
   * against that very registry; kept total for injected registries.
   */
  | 'curated-driver-missing'
  | 'curated-constructor-missing';

export type IdentityNormalization<T> =
  | { readonly ok: true; readonly identities: readonly T[] }
  | {
      readonly ok: false;
      readonly kind: 'mapping';
      readonly failures: readonly ProviderMappingFailure[];
    }
  | {
      readonly ok: false;
      readonly kind: 'contradiction';
      readonly problem: ParticipantsNormalizationProblem;
    };

/**
 * Resolves every provider identity through the season-qualified mapping
 * registry, then dedupes and loads curated content.
 *
 * Every row is attempted even after the first failure, so an operator sees the
 * bounded set of identities to curate rather than one at a time - but no
 * partial collection is ever produced.
 */
function normalizeIdentities<T>(
  providerValues: readonly string[],
  resolve: (
    providerValue: string,
  ) => ProviderMappingResolution<'driver' | 'constructor'>,
  curated: (id: string) => T | null,
  duplicate: ParticipantsNormalizationProblem,
  missing: ParticipantsNormalizationProblem,
): IdentityNormalization<T> {
  const resolvedIds: string[] = [];
  const failures: ProviderMappingFailure[] = [];
  for (const providerValue of providerValues) {
    const resolution = resolve(providerValue);
    if (resolution.outcome === 'unresolved') {
      if (failures.length < maxReportedMappingFailures) {
        failures.push(resolution.failure);
      }
      continue;
    }
    resolvedIds.push(resolution.gridviewId);
  }
  if (failures.length > 0) return { ok: false, kind: 'mapping', failures };

  const identities: T[] = [];
  const seen = new Set<string>();
  for (const id of resolvedIds) {
    if (seen.has(id)) {
      return { ok: false, kind: 'contradiction', problem: duplicate };
    }
    seen.add(id);
    const content = curated(id);
    if (content === null) {
      return { ok: false, kind: 'contradiction', problem: missing };
    }
    identities.push(content);
  }
  return { ok: true, identities };
}

/** Resolves and normalizes one complete driver identity list. */
export function normalizeSeasonDrivers(
  rows: readonly DecodedDriver[],
  season: number,
  registry: ProviderMappingRegistry,
  curated: CuratedParticipants,
): IdentityNormalization<Driver> {
  return normalizeIdentities(
    rows.map((row) => row.driverId),
    (providerValue) =>
      registry.resolve({
        season,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue,
      }),
    (id) => {
      const driver = curated.driverById(id);
      // Media is curated content owned by the media pipeline, and the only
      // driver media committed today is mock media, which a provider adapter
      // never presents. The circuits port emits `media: null` on the same
      // reasoning.
      return driver === null ? null : { ...driver, media: null };
    },
    'duplicate-canonical-driver',
    'curated-driver-missing',
  );
}

/** Resolves and normalizes one complete constructor identity list. */
export function normalizeSeasonConstructors(
  rows: readonly DecodedConstructor[],
  season: number,
  registry: ProviderMappingRegistry,
  curated: CuratedParticipants,
): IdentityNormalization<Constructor> {
  return normalizeIdentities(
    rows.map((row) => row.constructorId),
    (providerValue) =>
      registry.resolve({
        season,
        source: 'jolpica',
        entity: 'constructor',
        providerField: 'constructorId',
        providerValue,
      }),
    (id) => {
      const constructor = curated.constructorById(id);
      return constructor === null ? null : { ...constructor, media: null };
    },
    'duplicate-canonical-constructor',
    'curated-constructor-missing',
  );
}

/**
 * One `ConstructorSeasonEntry` per mapped constructor (ADR 0026 D10).
 *
 * The identity is the existing `constructor-entry-identity` rule,
 * `{season}-{constructorId}`, computed from the canonical id - so the `audi`
 * row yields `2026-sauber`, never an `audi` entry. Every seasonal fact is
 * `null` because nothing separately sources it (D8): the entrant's full and
 * short names, both colours, the power unit, the team principal, the base and
 * the chassis. `driverLineup` is `null` because the line-up is derived from
 * driver spans and never accepted as a second source of truth (D8, D10). The
 * provider's constructor name populates nothing.
 */
export function constructorSeasonEntries(
  season: number,
  constructors: readonly Constructor[],
): ConstructorSeasonEntry[] {
  return constructors.map((constructor) => ({
    id: canonicalConstructorSeasonEntryId(season, constructor.id),
    season,
    constructorId: constructor.id,
    fullName: null,
    shortName: null,
    colorPrimary: null,
    colorSecondary: null,
    powerUnit: null,
    teamPrincipal: null,
    base: null,
    chassis: null,
    driverLineup: null,
  }));
}
