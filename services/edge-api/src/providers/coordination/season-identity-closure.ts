/**
 * U10: required driver identity closure (design §8.2, ADR 0030 D2).
 *
 * Under the explicit `optional-drivers` policy a provider driver inventory may
 * omit a driver that a selected race result or standings row still requires,
 * because the inventory and the classifications are separate provider
 * resources. This module closes the season's public driver set over every
 * required reference, using **only** profiles that are already verified in the
 * same pinned catalog revision the run admitted:
 *
 * ```text
 * required = driver IDs of every selected race result entry
 *          ∪ every non-null selected fastestLap.driverId
 *          ∪ every selected driver standing
 *          ∪ every derived participation span driver
 *          ∪ every non-null constructor-lineup driver reference
 * output   = verified inventory profiles (provider order)
 *          ++ (required − inventory), in exact canonical-ID order
 * ```
 *
 * What it never does:
 *
 * - synthesize an identity, a fallback profile or a profile from provider
 *   names - a required ID without a complete pinned profile is a refusal;
 * - add every curated driver, or any driver nothing requires;
 * - create, extend or infer a participation span, a team or a constructor
 *   association: it returns profiles only, and span derivation stays
 *   `deriveDriverSeasonEntries`'s;
 * - read a mutable catalog head, the network or a clock.
 *
 * Pure and deterministic. Problems are closed codes and never carry a value.
 */

import type {
  ConstructorSeasonEntry,
  Driver,
  DriverSeasonEntry,
  DriverStanding,
  RaceResult,
} from '../../contract/types';
import { validateDriver } from '../../contract/normalized';
import type { DriverInventoryPolicy } from '../../identity/inventory/model';

/**
 * The verified driver profiles of one pinned catalog revision, for one season.
 *
 * Built once from the admitted `IdentityRunContext` (see
 * `identity/catalog/closure-profiles.ts`), never from a current head.
 */
export interface PinnedDriverProfiles {
  /** The catalog hash of the admitted run context. */
  readonly catalogHash: string;
  /** A fresh copy of the pinned canonical profile, or `null`. */
  driverById(id: string): Omit<Driver, 'media'> | null;
  /**
   * Whether the pinned revision holds a verified Jolpica driver binding for
   * this season targeting `id`. A profile without one was never admitted as a
   * season identity and cannot be supplemented.
   */
  isVerifiedSeasonDriver(id: string): boolean;
}

/** The trusted identity inputs assembly receives for one whole run. */
export interface SeasonIdentityContext {
  /** The run's single admitted inventory policy. */
  readonly policy: DriverInventoryPolicy;
  readonly profiles: PinnedDriverProfiles;
}

export interface SeasonIdentityClosureInput {
  /** The verified inventory profiles, in provider order. */
  readonly inventoryDrivers: readonly Driver[];
  /** Every selected race classification. */
  readonly results: readonly RaceResult[];
  readonly driverStandings: readonly DriverStanding[];
  /** The derived participation spans (and any contributed entries). */
  readonly driverEntries: readonly DriverSeasonEntry[];
  readonly constructorEntries: readonly ConstructorSeasonEntry[];
  readonly profiles: PinnedDriverProfiles;
}

/** Closed problem codes. Never an identifier. */
export const identityClosureProblems = [
  /** Two inventory profiles share one canonical identity. */
  'duplicate-inventory-driver',
  /** An inventory profile differs from the pinned profile of its identity. */
  'inventory-profile-mismatch',
  /** A required identity has no pinned profile. */
  'missing-profile',
  /** The pinned profile answers for a different identity. */
  'contradictory-profile',
  /** The pinned profile fails deep driver validation. */
  'invalid-profile',
  /** The identity has no verified season binding in the pinned revision. */
  'unbound-profile',
] as const;

export type IdentityClosureProblem = (typeof identityClosureProblems)[number];

export type SeasonIdentityClosure =
  | {
      readonly ok: true;
      /** Inventory profiles, then supplemented profiles in exact-ID order. */
      readonly drivers: readonly Driver[];
      /** Exact-ID order; the supplemented subset of `drivers`. */
      readonly supplemented: readonly string[];
    }
  | { readonly ok: false; readonly problem: IdentityClosureProblem };

/** Exact UTF-16 code-unit order: locale-independent and total. */
function exactOrder(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** The required driver identity set, exactly as design §8.2 defines it. */
export function requiredDriverIds(
  input: Omit<SeasonIdentityClosureInput, 'inventoryDrivers' | 'profiles'>,
): ReadonlySet<string> {
  const required = new Set<string>();
  for (const result of input.results) {
    for (const entry of result.entries) required.add(entry.driverId);
    const fastest = result.fastestLap?.driverId ?? null;
    if (fastest !== null) required.add(fastest);
  }
  for (const standing of input.driverStandings) required.add(standing.driverId);
  for (const entry of input.driverEntries) required.add(entry.driverId);
  for (const entry of input.constructorEntries) {
    // A null lineup is "GridView records no lineup", never a reference.
    for (const driverId of entry.driverLineup ?? []) required.add(driverId);
  }
  return required;
}

/** One pinned profile, deep-validated, or the closed reason it is unusable. */
function pinnedProfile(
  profiles: PinnedDriverProfiles,
  id: string,
): Driver | IdentityClosureProblem {
  const profile = profiles.driverById(id);
  if (profile === null) return 'missing-profile';
  // The same media policy every Jolpica profile projection applies.
  const driver = { ...profile, media: null } as Driver;
  if (driver.id !== id) return 'contradictory-profile';
  if (validateDriver(driver, 'driver').length > 0) return 'invalid-profile';
  if (!profiles.isVerifiedSeasonDriver(id)) return 'unbound-profile';
  return driver;
}

/**
 * Structural equality, independent of key order. Every `Driver` field is a
 * scalar today; comparing structurally keeps a future array or object field
 * from turning every inventory profile into a spurious mismatch.
 */
function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    left === null ||
    right === null ||
    Array.isArray(left) !== Array.isArray(right)
  )
    return false;
  const keys = Object.keys(right);
  return (
    Object.keys(left).length === keys.length &&
    keys.every(
      (key) =>
        Object.hasOwn(left, key) &&
        sameValue(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
        ),
    )
  );
}

function sameProfile(left: Driver, right: Driver): boolean {
  return sameValue(left, right);
}

/**
 * Closes the season's public driver set over every required reference.
 *
 * Every inventory profile is re-checked against the pinned profile of its
 * identity, so a coordination payload can never disagree with the run's
 * catalog. Every supplemented profile is loaded from the same pinned profiles
 * and deep-validated here, not only those that passed through a provider port.
 */
export function closeSeasonDriverIdentities(
  input: SeasonIdentityClosureInput,
): SeasonIdentityClosure {
  const inventoryIds = new Set<string>();
  const drivers: Driver[] = [];
  for (const driver of input.inventoryDrivers) {
    if (inventoryIds.has(driver.id))
      return { ok: false, problem: 'duplicate-inventory-driver' };
    inventoryIds.add(driver.id);
    const pinned = pinnedProfile(input.profiles, driver.id);
    if (typeof pinned === 'string') return { ok: false, problem: pinned };
    if (!sameProfile(driver, pinned))
      return { ok: false, problem: 'inventory-profile-mismatch' };
    drivers.push(pinned);
  }

  const supplemented = [...requiredDriverIds(input)]
    .filter((id) => !inventoryIds.has(id))
    .sort(exactOrder);
  for (const id of supplemented) {
    const pinned = pinnedProfile(input.profiles, id);
    if (typeof pinned === 'string') return { ok: false, problem: pinned };
    drivers.push(pinned);
  }
  return {
    ok: true,
    drivers: Object.freeze(drivers),
    supplemented: Object.freeze(supplemented),
  };
}
