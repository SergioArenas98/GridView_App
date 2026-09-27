/**
 * Turns decoded Jolpica standings rows into the normalized public
 * `DriverStanding` and `ConstructorStanding` collections.
 *
 * This is the **identity boundary**. Every driver and constructor is resolved
 * through the curated mapping registry only; nothing is derived, minted,
 * folded or guessed from a provider value or name (ADR 0022 D2, D4, D5). An
 * unresolved identity fails the **whole** resource, and no row is ever dropped
 * from an otherwise accepted one (ADR 0022 D10).
 *
 * It applies the curator decisions recorded in ADR 0023 amendment A3:
 *
 * - **S-1** - a standing is identified by `(season, driverId)` or
 *   `(season, constructorId)`. No standing ID is minted and no field is added.
 * - **S-3** - every constructor a driver row lists must resolve. Exactly one
 *   listed constructor becomes that canonical ID. More than one becomes
 *   `constructorId: null`: the current team is never inferred from list order,
 *   points or race results.
 * - **S-4** - the driver's season total is kept exactly as supplied and never
 *   apportioned between constructors.
 * - **S-7** - `wins` is the supplied value; driver `podiums` is `null` and is
 *   never derived.
 * - **S-8** - `provisional` is `false`. That is a curator policy on Jolpica's
 *   reconciled standings role, **not** provider evidence: the responses carry
 *   no finality field.
 * - **S-10** - two provider identities resolving to one canonical identity
 *   fail the whole resource.
 *
 * **What it deliberately does not produce.** No round, no participation span,
 * no season entry and no per-constructor points. Standings never create,
 * extend or close a participation span (ADR 0026 D1).
 */

import type { ConstructorStanding, DriverStanding } from '../../contract/types';
import type {
  ProviderMappingFailure,
  ProviderMappingRegistry,
} from '../mappings';
import { maxReportedMappingFailures } from './calendar-normalizer';
import type {
  DecodedConstructorStanding,
  DecodedDriverStanding,
} from './standings-payload';

/** Why a resolved standings table still could not be normalized. Closed. */
export type StandingsNormalizationProblem =
  /**
   * Two distinct provider driver identities resolved to one canonical driver.
   * One table holding a driver twice is a contradictory resource, not two
   * rows to merge.
   */
  | 'duplicate-canonical-driver'
  /**
   * Two distinct provider constructor identities resolved to one canonical
   * constructor, across the constructor table or inside one driver row.
   */
  | 'duplicate-canonical-constructor';

export type StandingsNormalization<T> =
  | { readonly ok: true; readonly standings: readonly T[] }
  | {
      readonly ok: false;
      readonly kind: 'mapping';
      readonly failures: readonly ProviderMappingFailure[];
    }
  | {
      readonly ok: false;
      readonly kind: 'contradiction';
      readonly problem: StandingsNormalizationProblem;
    };

/**
 * S-8: a curator policy for Jolpica's reconciled standings role, as results
 * C-1 is for classifications. Not read from, and not claimed by, the provider.
 */
const reconciledStandingProvisional = false;

/** Collects mapping failures up to the shared reporting cap. */
function failureCollector(): {
  readonly failures: ProviderMappingFailure[];
  readonly add: (failure: ProviderMappingFailure) => void;
} {
  const failures: ProviderMappingFailure[] = [];
  return {
    failures,
    add: (failure) => {
      if (failures.length < maxReportedMappingFailures) failures.push(failure);
    },
  };
}

function hasDuplicate(ids: readonly string[]): boolean {
  return new Set(ids).size !== ids.length;
}

interface ResolvedDriverRow {
  readonly row: DecodedDriverStanding;
  readonly driverId: string;
  readonly constructorIds: readonly string[];
}

/**
 * Resolves and normalizes one complete driver standings table for `season`.
 *
 * Every identity is attempted even after the first failure, so an operator
 * sees the bounded set to curate rather than one at a time - but no partial
 * table is ever produced.
 */
export function normalizeDriverStandings(
  rows: readonly DecodedDriverStanding[],
  season: number,
  registry: ProviderMappingRegistry,
): StandingsNormalization<DriverStanding> {
  const collector = failureCollector();
  const resolved: ResolvedDriverRow[] = [];
  for (const row of rows) {
    const driver = registry.resolve({
      season,
      source: 'jolpica',
      entity: 'driver',
      providerField: 'driverId',
      providerValue: row.driverId,
    });
    if (driver.outcome === 'unresolved') collector.add(driver.failure);

    // Every listed constructor must resolve, including the ones a multi-team
    // row will not publish (S-3).
    const constructorIds: string[] = [];
    for (const providerValue of row.constructorIds) {
      const constructor = registry.resolve({
        season,
        source: 'jolpica',
        entity: 'constructor',
        providerField: 'constructorId',
        providerValue,
      });
      if (constructor.outcome === 'unresolved') {
        collector.add(constructor.failure);
      } else {
        constructorIds.push(constructor.gridviewId);
      }
    }
    if (
      driver.outcome === 'resolved' &&
      constructorIds.length === row.constructorIds.length
    ) {
      resolved.push({ row, driverId: driver.gridviewId, constructorIds });
    }
  }
  if (collector.failures.length > 0) {
    return { ok: false, kind: 'mapping', failures: collector.failures };
  }

  if (hasDuplicate(resolved.map((entry) => entry.driverId))) {
    return {
      ok: false,
      kind: 'contradiction',
      problem: 'duplicate-canonical-driver',
    };
  }
  if (resolved.some((entry) => hasDuplicate(entry.constructorIds))) {
    return {
      ok: false,
      kind: 'contradiction',
      problem: 'duplicate-canonical-constructor',
    };
  }

  return {
    ok: true,
    standings: resolved.map(({ row, driverId, constructorIds }) => ({
      season,
      driverId,
      // S-3: one listed constructor is the context team; several are
      // published as none, never as a guess at the current one.
      constructorId:
        constructorIds.length === 1 ? (constructorIds[0] as string) : null,
      position: row.position,
      // S-4: the season total, never apportioned between constructors.
      points: row.points,
      wins: row.wins,
      // S-7: no podium count is supplied, and none is derived.
      podiums: null,
      provisional: reconciledStandingProvisional,
    })),
  };
}

/** Resolves and normalizes one complete constructor standings table. */
export function normalizeConstructorStandings(
  rows: readonly DecodedConstructorStanding[],
  season: number,
  registry: ProviderMappingRegistry,
): StandingsNormalization<ConstructorStanding> {
  const collector = failureCollector();
  const resolved: { row: DecodedConstructorStanding; id: string }[] = [];
  for (const row of rows) {
    const constructor = registry.resolve({
      season,
      source: 'jolpica',
      entity: 'constructor',
      providerField: 'constructorId',
      providerValue: row.constructorId,
    });
    if (constructor.outcome === 'unresolved') {
      collector.add(constructor.failure);
    } else {
      resolved.push({ row, id: constructor.gridviewId });
    }
  }
  if (collector.failures.length > 0) {
    return { ok: false, kind: 'mapping', failures: collector.failures };
  }

  if (hasDuplicate(resolved.map((entry) => entry.id))) {
    return {
      ok: false,
      kind: 'contradiction',
      problem: 'duplicate-canonical-constructor',
    };
  }

  return {
    ok: true,
    standings: resolved.map(({ row, id }) => ({
      season,
      constructorId: id,
      position: row.position,
      points: row.points,
      wins: row.wins,
      provisional: reconciledStandingProvisional,
    })),
  };
}
