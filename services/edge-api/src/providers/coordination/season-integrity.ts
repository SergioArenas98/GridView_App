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

import type { ResultStatus } from '../../contract/enums';
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
  /**
   * `GrandPrix.hasResults` must agree exactly with whether that round has a
   * selected race classification.
   */
  'event-has-results',
  /** `results[].entries[].driverId` is published verbatim. */
  'result-entry-driver',
  /** `results[].entries[].constructorId` is published verbatim. */
  'result-entry-constructor',
  /** `results[].fastestLap.driverId`, when present, is published verbatim. */
  'result-fastest-lap-driver',
  /** Two payloads claiming one identity that storage keys a single row on. */
  'duplicate-identity',
] as const;

export type SeasonRelation = (typeof seasonRelations)[number];

/**
 * Whether a result document carries an actual classification.
 *
 * A result *object* existing is not the same as a result being available: the
 * public contract requires a not-yet-run session to return
 * `status = 'unavailable'` with an empty `entries` array rather than a
 * fabricated empty classification (GridView_Backend_Scheme.md §10.5), and the
 * provider emits exactly that. Only `final` and `provisional` denote a real
 * classification; `unavailable` says so explicitly, and `unknown` establishes
 * nothing, so neither may assert availability. This is the same
 * fail-towards-not-fabricating rule the event-status table uses.
 */
export function isClassifiedResult(status: ResultStatus): boolean {
  return status === 'final' || status === 'provisional';
}

function idSet(values: readonly { readonly id: string }[]): Set<string> {
  return new Set(values.map((value) => value.id));
}

/** True when a collection contains the same identity twice. */
function hasDuplicate(values: readonly (string | number)[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * A composite identity, length-prefixed so it is injective by construction
 * rather than by hoping no component contains the separator.
 */
function composite(...parts: readonly string[]): string {
  let encoded = '';
  for (const part of parts) encoded += part.length + ':' + part + ';';
  return encoded;
}

/**
 * The closed set of identities that back exactly one stored row.
 *
 * Each member is an identity the domain model defines and the local database
 * keys on, so two payloads sharing one means the later silently overwrites the
 * earlier. Which of them survives would be an ordering accident, so neither is
 * allowed to: the whole candidate fails closed instead.
 *
 * Deliberately **not** here, because multiplicity is legitimate:
 *
 * - a driver may hold several `driverEntries` rows, since mid-season
 *   participation is modelled as split spans keyed by their own `id`
 *   (GridView_Domain_Model.md §6.7, decision M6) - the *entry ids* are checked,
 *   the driver ids are not;
 * - a circuit's `lapRecord` may name a driver outside the current grid, so it
 *   is not an identity of this season at all.
 *
 * A season entry has **two** independent stored identities and both are
 * checked: the row's own `id`, which is its primary key, and the participant
 * it names, which carries its own UNIQUE constraint. Checking only one of them
 * lets two rows collide on the other - two constructor entries naming different
 * teams under one entry id satisfy `UNIQUE(season, constructorId)` while still
 * overwriting each other on the primary key.
 */
const duplicateIdentityCategories = [
  'driver',
  'constructor',
  'circuit',
  'event',
  'event-round',
  'session',
  'race-result',
  'race-result-round',
  'race-result-entry',
  'driver-standing',
  'constructor-standing',
  'driver-season-entry-id',
  'constructor-season-entry-id',
  'constructor-season-entry-team',
] as const;

export type DuplicateIdentityCategory =
  (typeof duplicateIdentityCategories)[number];

/**
 * Every identity list to check, by category.
 *
 * One place, one mechanism: adding a stored identity means adding a category
 * here, never another ad hoc `Set` comparison somewhere else.
 */
function identitiesByCategory(
  source: ProviderSeasonSource,
): Record<DuplicateIdentityCategory, readonly (string | number)[]> {
  return {
    // `drivers.id`, `constructors.id`, `circuits.id` are primary keys.
    driver: source.drivers.map((driver) => driver.id),
    constructor: source.constructors.map((entry) => entry.id),
    circuit: source.circuits.map((circuit) => circuit.id),
    // `grand_prix` keys on `id` **and** carries UNIQUE(season, round): two
    // independent constraints, so both are checked independently.
    event: source.calendar.map((event) => event.id),
    'event-round': source.calendar.map((event) => event.round),
    // `sessions.id` is a primary key across the whole database, not per event.
    session: source.calendar.flatMap((event) =>
      event.sessions.map((session) => session.id),
    ),
    'race-result': source.results.map((result) => result.id),
    'race-result-round': source.results.map((result) => result.round),
    // `race_result_entries` keys on (resultId, driverId): one classification
    // per driver per result.
    'race-result-entry': source.results.flatMap((result) =>
      result.entries.map((entry) => composite(result.id, entry.driverId)),
    ),
    // Standings key on (season, driverId) / (season, constructorId); the season
    // is uniform across an assembled source, so the participant is the identity.
    'driver-standing': source.driverStandings.map(
      (standing) => standing.driverId,
    ),
    'constructor-standing': source.constructorStandings.map(
      (standing) => standing.constructorId,
    ),
    // Primary keys. A driver deliberately has no participant check here:
    // split participation spans are legitimate and each carries its own id.
    'driver-season-entry-id': source.driverEntries.map((entry) => entry.id),
    'constructor-season-entry-id': source.constructorEntries.map(
      (entry) => entry.id,
    ),
    // UNIQUE(season, constructorId): exactly one entry per team per season.
    'constructor-season-entry-team': source.constructorEntries.map(
      (entry) => entry.constructorId,
    ),
  };
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

  // `hasResults` is not a local flag: it is an assertion about the *results*
  // collection, and the client acts on it. With nothing cached it decides
  // whether the classification is requested at all, so a classification
  // published under a `false` flag is invisible to a fresh client, and a `true`
  // flag with no classification advertises data that does not exist. Both
  // directions are equally wrong, and neither is repaired here - no flag is
  // rewritten and no result is fabricated or dropped; the candidate fails
  // closed as a whole.
  const classifiedRounds = new Set(
    source.results
      .filter((result) => isClassifiedResult(result.status))
      .map((result) => result.round),
  );
  for (const event of source.calendar) {
    if (event.hasResults !== classifiedRounds.has(event.round)) {
      fail('event-has-results');
    }
  }

  // One mechanism over a closed set of stored identities.
  const identities = identitiesByCategory(source);
  for (const category of duplicateIdentityCategories) {
    if (hasDuplicate(identities[category])) fail('duplicate-identity');
  }

  return seasonRelations.filter((relation) => failed.has(relation));
}
