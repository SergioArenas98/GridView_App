/**
 * Curated circuit content, read from the same version-controlled registry
 * that owns the canonical circuit identity.
 *
 * The mapping registry resolves an **identity**; it deliberately indexes no
 * display text or facts. The normalized `Circuit` still needs a name and its
 * ten descriptive keys, and the only admissible source for them is the curated
 * registry the identity came from - never the provider's `circuitName`,
 * `Location` or coordinates, which are unapproved descriptive content
 * (Provider Evaluation §8.8.1; ADR 0022 D5).
 *
 * **Defaults are the mock provider's, exactly.** A registry row always carries
 * `id` and `name` and carries a descriptive fact only where GridView owns it;
 * the 17 identity-only 2026 rows carry none. The contract requires every key
 * to be *present*, so an absent fact becomes an explicit `null` - the same
 * rule `withCircuitMedia` applies in the mock provider, pinned to it by a
 * parity test. The mock's function is not reused because it also attaches
 * **mock media**, which a provider adapter must never present, and moving it
 * into a shared module would change the deployed Worker bundle.
 *
 * Cached at module scope on the same terms as the mapping registry: the
 * content is immutable, derived from a reviewed repository change, holds no
 * request state and exposes no mutator. Every read returns a fresh copy, so a
 * caller can never alter the cache.
 */

import circuitsRegistry from '../../../../../content/registries/circuits.mock.json';
import type { Circuit } from '../../contract/types';

/** A normalized circuit before media, which this adapter never supplies. */
export type CuratedCircuit = Omit<Circuit, 'media'>;

/**
 * A curated registry row: `id` and `name` always, any descriptive fact only
 * where GridView owns it.
 */
export type CuratedCircuitRow = Pick<Circuit, 'id' | 'name'> &
  Partial<Omit<Circuit, 'id' | 'name' | 'media'>>;

/** Canonical circuit id to its curated content. */
export interface CuratedCircuits {
  /** A fresh copy of the curated circuit, or `null` when none is curated. */
  get(id: string): CuratedCircuit | null;
}

/** An absent fact is "GridView records no such fact", never a guess. */
function orNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

/**
 * Every declared key, picked explicitly rather than spread from the row, so a
 * key the contract does not declare can never ride along.
 */
function normalizedRow(row: CuratedCircuitRow): CuratedCircuit {
  return {
    id: row.id,
    name: row.name,
    locality: orNull(row.locality),
    country: orNull(row.country),
    countryCode: orNull(row.countryCode),
    latitude: orNull(row.latitude),
    longitude: orNull(row.longitude),
    lengthMeters: orNull(row.lengthMeters),
    cornerCount: orNull(row.cornerCount),
    direction: orNull(row.direction),
    firstGrandPrixYear: orNull(row.firstGrandPrixYear),
    lapRecord: orNull(row.lapRecord),
  };
}

/** Builds a lookup over curated rows. Exposed so tests can supply their own. */
export function curatedCircuitsFrom(
  rows: readonly CuratedCircuitRow[],
): CuratedCircuits {
  const byId = new Map(rows.map((row) => [row.id, normalizedRow(row)]));
  return {
    get(id: string): CuratedCircuit | null {
      const circuit = byId.get(id);
      return circuit === undefined ? null : structuredClone(circuit);
    },
  };
}

let cached: CuratedCircuits | undefined;

/** The curated circuit content, from the committed registry. */
export function curatedCircuits(): CuratedCircuits {
  cached ??= curatedCircuitsFrom(
    (circuitsRegistry as unknown as { circuits: CuratedCircuitRow[] }).circuits,
  );
  return cached;
}
