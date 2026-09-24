/**
 * Curated driver and constructor content, read from the same
 * version-controlled registries that own the canonical identities.
 *
 * The mapping registry resolves an **identity**; it deliberately indexes no
 * display text or facts. A normalized `Driver` and `Constructor` still need a
 * name and their descriptive keys, and the only admissible source for them is
 * the curated registry the identity came from - never the provider's given or
 * family name, code, number, nationality or constructor name, which are
 * unapproved descriptive content (ADR 0022 D5; ADR 0026 D2).
 *
 * **Defaults are the mock provider's, exactly.** A registry row always carries
 * its identity and display name, and carries a descriptive fact only where
 * GridView owns it; most 2026 rows are identity-only. The contract requires
 * every key to be *present*, so an absent fact becomes an explicit `null` - the
 * same rule `withDriverMedia` and `withConstructorMedia` apply in the mock
 * provider, pinned to them by a parity test. The mock's functions are not
 * reused because they also attach **mock media**, which a provider adapter must
 * never present, and moving them into a shared module would change the
 * deployed Worker bundle. This is the precedent `curated-circuits.ts` set.
 *
 * Cached at module scope on the same terms as the mapping registry: the content
 * is immutable, derived from a reviewed repository change, holds no request
 * state and exposes no mutator. Every read returns a fresh copy.
 */

import driversRegistry from '../../../../../content/registries/drivers.mock.json';
import constructorsRegistry from '../../../../../content/registries/constructors.mock.json';
import type { Constructor, Driver } from '../../contract/types';

/** A normalized driver before media, which this adapter never supplies. */
export type CuratedDriver = Omit<Driver, 'media'>;

/** A normalized constructor before media, which this adapter never supplies. */
export type CuratedConstructor = Omit<Constructor, 'media'>;

/** A curated driver row: `id` and `fullName` always, any fact GridView owns. */
export type CuratedDriverRow = Pick<Driver, 'id' | 'fullName'> &
  Partial<Omit<Driver, 'id' | 'fullName' | 'media'>>;

/** A curated constructor row: `id` and `name` always, any fact GridView owns. */
export type CuratedConstructorRow = Pick<Constructor, 'id' | 'name'> &
  Partial<Omit<Constructor, 'id' | 'name' | 'media'>>;

/** Canonical participant ids to their curated content. */
export interface CuratedParticipants {
  /** A fresh copy of the curated driver, or `null` when none is curated. */
  driverById(id: string): CuratedDriver | null;
  /** A fresh copy of the curated constructor, or `null` when none is curated. */
  constructorById(id: string): CuratedConstructor | null;
}

/** An absent fact is "GridView records no such fact", never a guess. */
function orNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

/**
 * Every declared key, picked explicitly rather than spread from the row, so a
 * key the contract does not declare can never ride along.
 */
function normalizedDriver(row: CuratedDriverRow): CuratedDriver {
  return {
    id: row.id,
    fullName: row.fullName,
    givenName: orNull(row.givenName),
    familyName: orNull(row.familyName),
    shortCode: orNull(row.shortCode),
    permanentNumber: orNull(row.permanentNumber),
    nationality: orNull(row.nationality),
    countryCode: orNull(row.countryCode),
    dateOfBirth: orNull(row.dateOfBirth),
    placeOfBirth: orNull(row.placeOfBirth),
    biography: orNull(row.biography),
  };
}

function normalizedConstructor(row: CuratedConstructorRow): CuratedConstructor {
  return {
    id: row.id,
    name: row.name,
    shortName: orNull(row.shortName),
    nationality: orNull(row.nationality),
    countryCode: orNull(row.countryCode),
    colorPrimary: orNull(row.colorPrimary),
    biography: orNull(row.biography),
  };
}

/** Builds a lookup over curated rows. Exposed so tests can supply their own. */
export function curatedParticipantsFrom(
  drivers: readonly CuratedDriverRow[],
  constructors: readonly CuratedConstructorRow[],
): CuratedParticipants {
  const driversById = new Map(
    drivers.map((row) => [row.id, normalizedDriver(row)]),
  );
  const constructorsById = new Map(
    constructors.map((row) => [row.id, normalizedConstructor(row)]),
  );
  return {
    driverById(id: string): CuratedDriver | null {
      const driver = driversById.get(id);
      return driver === undefined ? null : structuredClone(driver);
    },
    constructorById(id: string): CuratedConstructor | null {
      const constructor = constructorsById.get(id);
      return constructor === undefined ? null : structuredClone(constructor);
    },
  };
}

let cached: CuratedParticipants | undefined;

/** The curated participant content, from the committed registries. */
export function curatedParticipants(): CuratedParticipants {
  cached ??= curatedParticipantsFrom(
    (driversRegistry as unknown as { drivers: CuratedDriverRow[] }).drivers,
    (
      constructorsRegistry as unknown as {
        constructors: CuratedConstructorRow[];
      }
    ).constructors,
  );
  return cached;
}
