/**
 * Referential integrity of an assembled season, checked **once, before
 * snapshot generation**.
 *
 * Every logical resource is coordinated and selected on its own - that is the
 * whole point of the seam - so nothing upstream ever compares a calendar event
 * against the circuits collection, or a standing against the driver profiles.
 * Two individually valid candidates can therefore be mutually inconsistent,
 * and snapshot generation is where that stops being harmless. It assumes those
 * references resolve in two different ways, both of them bad here:
 *
 * - **It throws.** `requireOne` raises on a missing driver, constructor or
 *   circuit, which would escape `CoordinatedSeasonPublication.publish` as a
 *   rejected promise instead of the bounded outcome that boundary promises.
 * - **It publishes the dangling identifier.** Standings and classification
 *   entries are copied through verbatim, so a missing profile becomes a public
 *   document naming an entity that has no document of its own.
 *
 * This module is the single deterministic answer to both. It is a *preflight*,
 * not a second generator: it re-states the generator's lookup assumptions as
 * explicit relations and says which of them do not hold. It resolves nothing,
 * repairs nothing, normalizes nothing and drops nothing - one broken relation
 * withholds the whole candidate.
 *
 * **Nothing identifying leaves it.** A violation is a closed relation name, so
 * a provider-shaped or canonical identifier can never ride out inside a
 * diagnostic.
 */

import type { ProviderSeasonSource } from '../formula-one-provider';

/**
 * The closed set of cross-resource relations generation depends on.
 *
 * Each member names a *relation*, never an entity: `driver-entry-driver` says
 * "a season entry pointed at a driver profile that is not in this season", and
 * that is the entire diagnostic. The list is ordered, and results are reported
 * in this order, so the report never depends on collection order.
 */
export const seasonRelations = [
  /** `calendar[].circuitId` must resolve. `requireOne` throws otherwise. */
  'event-circuit',
  /** `driverEntries[].driverId` must resolve. `requireOne` throws otherwise. */
  'driver-entry-driver',
  /** `driverEntries[].constructorId` is published verbatim on the summary. */
  'driver-entry-constructor',
  /** `constructorEntries[].constructorId` must resolve. `requireOne` throws. */
  'constructor-entry-constructor',
  /** `constructorEntries[].driverLineup[]` must resolve. `requireOne` throws. */
  'constructor-entry-lineup',
  /** `driverStandings[].driverId` is published verbatim. */
  'driver-standing-driver',
  /** `driverStandings[].constructorId`, when present, is published verbatim. */
  'driver-standing-constructor',
  /** `constructorStandings[].constructorId` is published verbatim. */
  'constructor-standing-constructor',
  /** A classification must belong to a calendar event, by round and by id. */
  'result-event',
  /** `results[].entries[].driverId` is published verbatim. */
  'result-entry-driver',
  /** `results[].entries[].constructorId` is published verbatim. */
  'result-entry-constructor',
  /** `results[].fastestLap.driverId`, when present, is published verbatim. */
  'result-fastest-lap-driver',
  /** Two profiles, events or classifications claiming one published document. */
  'duplicate-identity',
] as const;

export type SeasonRelation = (typeof seasonRelations)[number];

function idSet(values: readonly { readonly id: string }[]): Set<string> {
  return new Set(values.map((value) => value.id));
}

/** True when a collection contains the same identity twice. */
function hasDuplicate(values: readonly (string | number)[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * The relations an assembled season fails, in declared order and without
 * repetition.
 *
 * An empty result means every reference generation will follow resolves.
 *
 * Two relations are deliberately **not** checked, because requiring them would
 * fail closed on correct data:
 *
 * - `circuits[].lapRecord.driverId` is documented as an *optional historical
 *   fact* (GridView_Domain_Model.md §6, `lapRecord`). A circuit record can be
 *   held by a driver who is not on this season's grid, so demanding a current
 *   profile for it would reject a legitimate season.
 * - A driver appearing in more than one `driverEntries` row is legitimate:
 *   mid-season participation is modelled as split spans with `startRound` and
 *   `endRound` (GridView_Domain_Model.md §6.7, decision M6), not by mutating
 *   identity.
 */
export function validateSeasonReferences(
  source: ProviderSeasonSource,
): readonly SeasonRelation[] {
  const drivers = idSet(source.drivers);
  const constructors = idSet(source.constructors);
  const circuits = idSet(source.circuits);
  const eventIdByRound = new Map(
    source.calendar.map((event) => [event.round, event.id]),
  );

  const failed = new Set<SeasonRelation>();
  const fail = (relation: SeasonRelation): void => {
    failed.add(relation);
  };

  for (const event of source.calendar) {
    if (!circuits.has(event.circuitId)) fail('event-circuit');
  }
  for (const entry of source.driverEntries) {
    if (!drivers.has(entry.driverId)) fail('driver-entry-driver');
    if (!constructors.has(entry.constructorId)) {
      fail('driver-entry-constructor');
    }
  }
  for (const entry of source.constructorEntries) {
    if (!constructors.has(entry.constructorId)) {
      fail('constructor-entry-constructor');
    }
    for (const driverId of entry.driverLineup ?? []) {
      if (!drivers.has(driverId)) fail('constructor-entry-lineup');
    }
  }
  for (const standing of source.driverStandings) {
    if (!drivers.has(standing.driverId)) fail('driver-standing-driver');
    if (
      standing.constructorId !== null &&
      !constructors.has(standing.constructorId)
    ) {
      fail('driver-standing-constructor');
    }
  }
  for (const standing of source.constructorStandings) {
    if (!constructors.has(standing.constructorId)) {
      fail('constructor-standing-constructor');
    }
  }
  for (const result of source.results) {
    // A classification is published under its round's event, so it must name
    // an event that exists *and* be the classification of that same event.
    if (eventIdByRound.get(result.round) !== result.grandPrixId) {
      fail('result-event');
    }
    if (
      result.fastestLap !== null &&
      result.fastestLap.driverId !== null &&
      !drivers.has(result.fastestLap.driverId)
    ) {
      fail('result-fastest-lap-driver');
    }
    for (const entry of result.entries) {
      if (!drivers.has(entry.driverId)) fail('result-entry-driver');
      if (!constructors.has(entry.constructorId)) {
        fail('result-entry-constructor');
      }
    }
  }

  // Each of these collections backs a per-identity published document, so a
  // repeated identity means two payloads competing for one document name.
  // Which one would win is an ordering accident, so neither is allowed to.
  if (
    drivers.size !== source.drivers.length ||
    constructors.size !== source.constructors.length ||
    circuits.size !== source.circuits.length ||
    hasDuplicate(source.calendar.map((event) => event.round)) ||
    hasDuplicate(source.results.map((result) => result.round))
  ) {
    fail('duplicate-identity');
  }

  return seasonRelations.filter((relation) => failed.has(relation));
}
