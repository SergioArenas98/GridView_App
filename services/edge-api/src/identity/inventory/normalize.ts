/**
 * U9: optional-driver inventory normalization (design §8.2 steps 1-4).
 *
 * Input is the **complete, already strictly decoded** season driver inventory:
 * envelope, pagination, row shape and duplicate provider identities have been
 * enforced by `participants-payload.ts`, and nothing here re-decodes or repairs
 * provider data. Malformed input never reaches this function and is never
 * converted into an unresolved identity.
 *
 * Exactly one case is optional: the registry's own `unmapped` answer for a
 * structurally valid, exact season/source/typed driver key that can be given
 * its existing deterministic U1 candidate ID. Every other resolver answer -
 * `invalid-key`, `registry-invalid`, `ambiguous`, `target-missing` - and every
 * contradiction - a duplicate canonical driver, a mapped target with no
 * profile, an invalid profile - fails the whole inventory, exactly as strict
 * mode does. No fuzzy name, ID coercion or cross-season inheritance exists.
 *
 * Unresolved rows are accounted, never projected: no canonical ID, profile,
 * team assignment or participation span is created for them.
 */

import { validateDriver } from '../../contract/normalized';
import type { Driver } from '../../contract/types';
import type { IdentityHash } from '../discovery/model';
import { candidateIdFor } from '../discovery/keys';
import {
  driverInventoryPolicyVersion,
  driverInventoryProjectionDigest,
  observationKeyHashFor,
  unresolvedInventoryReason,
  type DriverInventory,
  type InventoryKey,
  type ResolvedInventoryDriver,
  type UnresolvedInventoryDriver,
} from './model';

/** Why a decoded inventory could not be normalized. Closed, log-safe. */
export type DriverInventoryContradiction =
  | 'duplicate-canonical-driver'
  | 'curated-driver-missing'
  | 'invalid-driver-profile'
  | 'duplicate-observation'
  | 'duplicate-candidate'
  /**
   * An `unmapped` key the U1 candidate grammar refuses. Unreachable while the
   * two key validators agree; kept as a closed, logged contradiction so a
   * future divergence fails closed with a diagnostic, never optional.
   */
  | 'candidate-id-refused';

/**
 * One exact resolver answer. The caller - the Jolpica adapter, which owns the
 * mapping registry - supplies it, so this module never reads mapping content.
 * `F` is the caller's own failure type, returned unchanged for its logging.
 */
export type InventoryResolution<F extends { readonly reason: string }> =
  | { readonly outcome: 'resolved'; readonly gridviewId: string }
  | { readonly outcome: 'unresolved'; readonly failure: F };

export type DriverInventoryNormalization<
  F extends { readonly reason: string } = { readonly reason: string },
> =
  | {
      readonly ok: true;
      /** Complete verified profiles, provider order, `media: null`. */
      readonly drivers: readonly Driver[];
      readonly inventory: DriverInventory;
    }
  | {
      readonly ok: false;
      readonly kind: 'mapping';
      /** Blocking (non-`unmapped`) failures only, capped by the caller. */
      readonly failures: readonly F[];
    }
  | {
      readonly ok: false;
      readonly kind: 'contradiction';
      readonly problem: DriverInventoryContradiction;
    };

export interface DriverInventoryInput<F extends { readonly reason: string }> {
  /** Exact decoded `driverId` values, complete and in provider order. */
  readonly providerValues: readonly string[];
  readonly season: number;
  /** The exact season/source/typed lookup of one `driverId`; no fallback. */
  readonly resolve: (providerValue: string) => InventoryResolution<F>;
  /** Pinned-context profile lookup; `null` when the catalog has none. */
  readonly driverById: (id: string) => Omit<Driver, 'media'> | null;
  /** From the trusted run context, never from a payload. */
  readonly catalogHash: IdentityHash;
  readonly maxReportedFailures: number;
}

function driverKey(season: number, providerValue: string): InventoryKey {
  return {
    season,
    source: 'jolpica',
    entity: 'driver',
    providerField: 'driverId',
    providerValue,
  };
}

/** Partitions, resolves and accounts one complete decoded driver inventory. */
export async function normalizeDriverInventory<
  F extends { readonly reason: string },
>(input: DriverInventoryInput<F>): Promise<DriverInventoryNormalization<F>> {
  const resolvedRows: { id: string; key: InventoryKey }[] = [];
  const unmappedKeys: InventoryKey[] = [];
  const failures: F[] = [];
  let blocking = false;

  for (const providerValue of input.providerValues) {
    const key = driverKey(input.season, providerValue);
    const resolution = input.resolve(providerValue);
    if (resolution.outcome === 'resolved') {
      resolvedRows.push({ id: resolution.gridviewId, key });
      continue;
    }
    if (resolution.failure.reason === unresolvedInventoryReason) {
      unmappedKeys.push(key);
      continue;
    }
    // Every attempt continues so an operator sees the bounded blocking set,
    // but no partial inventory is ever produced.
    blocking = true;
    if (failures.length < input.maxReportedFailures)
      failures.push(resolution.failure);
  }
  if (blocking) return { ok: false, kind: 'mapping', failures };

  const drivers: Driver[] = [];
  const resolved: ResolvedInventoryDriver[] = [];
  const seenDrivers = new Set<string>();
  const seenObservations = new Set<string>();
  for (const row of resolvedRows) {
    if (seenDrivers.has(row.id))
      return {
        ok: false,
        kind: 'contradiction',
        problem: 'duplicate-canonical-driver',
      };
    seenDrivers.add(row.id);
    const profile = input.driverById(row.id);
    if (profile === null)
      return {
        ok: false,
        kind: 'contradiction',
        problem: 'curated-driver-missing',
      };
    // The same media policy strict normalization applies.
    const driver: Driver = { ...profile, media: null } as Driver;
    if (driver.id !== row.id || validateDriver(driver, 'driver').length > 0)
      return {
        ok: false,
        kind: 'contradiction',
        problem: 'invalid-driver-profile',
      };
    const observationKeyHash = await observationKeyHashFor(row.key);
    if (seenObservations.has(observationKeyHash))
      return {
        ok: false,
        kind: 'contradiction',
        problem: 'duplicate-observation',
      };
    seenObservations.add(observationKeyHash);
    drivers.push(driver);
    resolved.push({ driverId: row.id, observationKeyHash });
  }

  const unresolved: UnresolvedInventoryDriver[] = [];
  const seenCandidates = new Set<string>();
  for (const key of unmappedKeys) {
    let candidateId: IdentityHash;
    try {
      // The exact U1 identity. It throws only for a key the U1 decoder
      // refuses, which can never be an optional observation.
      candidateId = await candidateIdFor(key);
    } catch {
      return {
        ok: false,
        kind: 'contradiction',
        problem: 'candidate-id-refused',
      };
    }
    if (seenCandidates.has(candidateId))
      return {
        ok: false,
        kind: 'contradiction',
        problem: 'duplicate-candidate',
      };
    seenCandidates.add(candidateId);
    unresolved.push({ candidateId, reason: unresolvedInventoryReason });
  }
  unresolved.sort((a, b) =>
    a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0,
  );

  const projection = {
    policyVersion: driverInventoryPolicyVersion,
    catalogHash: input.catalogHash,
    providerRowCount: input.providerValues.length,
    resolved,
    unresolved,
  };
  const inventory: DriverInventory = {
    ...projection,
    projectionDigest: await driverInventoryProjectionDigest(projection),
  };
  return { ok: true, drivers, inventory };
}
