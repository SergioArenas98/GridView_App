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
import {
  canonicalConstructorSeasonEntryId,
  canonicalDriverSeasonEntryId,
  canonicalGrandPrixId,
  canonicalRaceResultId,
  canonicalSessionId,
} from '../../contract/identity';
import type { DriverSeasonEntry } from '../../contract/types';
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
  /**
   * `calendar[].id` must be the event's own canonical identity.
   *
   * A Grand Prix edition identity is *derived* from the event
   * (GridView_Domain_Model.md §4.2: `{season}-{eventSlug}`), so like a session
   * or a classification identity it is a field that can contradict what it
   * describes. Nothing upstream catches it: a `season-calendar` resource names
   * only a season, so the coordinator's payload boundary has no event identity
   * to check the `id` against, and an event carrying an arbitrary unique id
   * passes `session-event` and `result-event` alike as long as its sessions and
   * classifications consistently use that same wrong id.
   *
   * Deliberately separate from `duplicate-identity`, which needs two payloads
   * to collide: two events carrying two *different* arbitrary ids collide with
   * nothing at all, and are both wrong. The local database keys events by this
   * `id`, so an arbitrary id and a later corrected one are two primary keys for
   * one edition.
   */
  'event-identity',
  /**
   * `calendar[].sessions[].id` must be that event's own canonical identity for
   * that session type.
   *
   * A session identity is *derived* from its parent event
   * (GridView_Domain_Model.md §6: `{grandPrixId}-{sessionType}`), so it is the
   * one field that can contradict the event it is filed under. Nothing
   * upstream can catch it: an `event-schedule` resource names only a season
   * and a round, so the coordinator's payload boundary has no event id to
   * check against, and assembly then replaces that round's sessions wholesale.
   * This is where the event and its sessions are finally both in hand.
   */
  'session-event',
  /** `driverEntries[].driverId` must resolve. `requireOne` throws otherwise. */
  'driver-entry-driver',
  /** `driverEntries[].constructorId` is published verbatim on the summary. */
  'driver-entry-constructor',
  /**
   * A driver's participation spans must be internally consistent.
   *
   * Multiple entries for one driver are legitimate - mid-season participation
   * is modelled as split spans rather than by mutating identity
   * (GridView_Domain_Model.md §6.7) - but an *inverted* span
   * (`startRound > endRound`) or two *overlapping* stints for the same driver
   * are not. The local write rejects both
   * (`CompetitorDao._validateDriverSpans()`), so publishing either fails the
   * client's roster refresh transaction and leaves users on stale data with no
   * server-side signal that anything went wrong.
   *
   * Null bounds carry the meaning the local rule gives them for overlap: a
   * null `startRound` is the season start and a null `endRound` extends
   * without limit (no exit has been observed, ADR 0026 D6 - which is not a
   * claim about the rest of the season), so neither can invert. Touching spans
   * overlap, because the shared round would belong to both.
   */
  'driver-entry-span',
  /**
   * `driverEntries[].id` must be the entry's own canonical identity under
   * ADR 0026 D7: `{season}-{driverId}` when `startRound` is null, otherwise
   * `{season}-{driverId}-{startRound}`.
   *
   * The client keys every span by this id, so an arbitrary unique id passes
   * `duplicate-identity` and still publishes a row a later corrected id would
   * duplicate instead of replace. Global uniqueness is a separate question:
   * the rule is not injective across drivers (`foo-7`'s base entry equals
   * `foo`'s round-7 entry), and that collision is `duplicate-identity`'s.
   */
  'driver-entry-identity',
  /** `constructorEntries[].constructorId` must resolve. `requireOne` throws. */
  'constructor-entry-constructor',
  /**
   * `constructorEntries[].id` must be the entry's own canonical identity.
   *
   * The model defines it as exactly `{season}-{constructorId}`
   * (GridView_Domain_Model.md §4.2), and both components are on the payload.
   * `constructor-entry-constructor` asks only whether `constructorId` resolves,
   * and `duplicate-identity` needs a collision, so an arbitrary unique id
   * passes both and reaches the published constructor documents. The driver
   * season entry's counterpart is `driver-entry-identity`.
   */
  'constructor-entry-identity',
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
   * `results[].id` must be that classification's own canonical identity for
   * its parent event and session type.
   *
   * A result identity is *derived* from its parent session
   * (GridView_Domain_Model.md §4.2, §6.11:
   * `{grandPrixId}-{sessionType}-results`), so like a session identity it is
   * the one field that can contradict what it is filed under. Nothing upstream
   * can catch it: a `session-classification` resource names a season, a round
   * and a session type, so the coordinator's payload boundary has those three
   * to check and no event identity to check the `id` against, and assembly
   * then carries the result through verbatim.
   *
   * Deliberately separate from `result-event`, which asks whether
   * `grandPrixId` names the event at that round: a result can name the right
   * event and still carry a wrong `id`. Equally separate from
   * `duplicate-identity`, which needs two payloads to collide - two results
   * carrying two *different* arbitrary ids collide with nothing at all, and
   * are both wrong. The local database keys results by this `id` while
   * enforcing `UNIQUE(grandPrixId, sessionType)`, so an arbitrary id and a
   * later corrected arbitrary id are two primary keys for one unique session.
   */
  'result-identity',
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
  /**
   * Classification to span (ADR 0026 D5 rule 8, D12 item 5).
   *
   * Every row of a selected, classified race classification - a participation
   * fact (D3) - must fall inside **exactly one** span of the same driver, and
   * that span must name the row's constructor. No span, two covering spans or
   * a span for another constructor all mean published participation and
   * published results disagree.
   */
  'result-entry-span',
  /**
   * Span to classification (ADR 0026 D5 rules 1-7, D6, D8, D12 item 5).
   *
   * Every span must agree with the selected, classified race rounds for its
   * own driver and constructor:
   *
   * - it is observed at its opening round: `startRound`, or the season's first
   *   classified race round when `startRound` is null. A non-null `startRound`
   *   equal to that first round is refused, because D8 spells it null;
   * - it is observed at its closing round: `endRound`, or the latest
   *   classified race round when `endRound` is null, since a later classified
   *   round without the driver for this constructor would establish an exit.
   *   A non-null `endRound` equal to that latest round is refused: no later
   *   round has established the exit, even when the calendar is complete;
   * - it is observed at **every** classified race round in between: an
   *   absence closes a span, and a return is a new span (D5 rules 4, 5);
   * - it is **not** observed at the classified race round just before or just
   *   after it: the same seat there would have extended it (D5 rule 2).
   *
   * A span with no supporting fact therefore fails, and before the first
   * classified race no span can exist at all (D9). Rounds with no selected
   * classification are not observations and are not judged here.
   */
  'driver-entry-support',
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

/**
 * Whether any driver's participation spans are inverted or overlapping.
 *
 * Mirrors `CompetitorDao._validateDriverSpans()` in the Flutter client, which
 * is the rule that would actually reject the write, including its null-bound
 * semantics: an absent `startRound` is the season start and an absent
 * `endRound` is unbounded. `Number.NEGATIVE_INFINITY` and
 * `Number.POSITIVE_INFINITY` express those directly rather than reusing the
 * client's sentinel integers, which exist only because Dart lacks a
 * double-typed round.
 *
 * Spans are grouped per driver, so two drivers sharing a round are untouched,
 * and each group is ordered by start before consecutive pairs are compared -
 * the arrival order of the entries therefore cannot change the answer.
 */
function hasInvalidDriverSpans(entries: readonly DriverSeasonEntry[]): boolean {
  const byDriver = new Map<string, { start: number; end: number }[]>();
  for (const entry of entries) {
    const start = entry.startRound ?? Number.NEGATIVE_INFINITY;
    const end = entry.endRound ?? Number.POSITIVE_INFINITY;
    if (start > end) return true;
    const spans = byDriver.get(entry.driverId) ?? [];
    spans.push({ start, end });
    byDriver.set(entry.driverId, spans);
  }
  for (const spans of byDriver.values()) {
    const ordered = [...spans].sort((left, right) => left.start - right.start);
    for (let index = 1; index < ordered.length; index += 1) {
      // `<=`, not `<`: a stint starting on the round the previous one ended is
      // two seats for one round, which is exactly the case the local write
      // refuses.
      if (ordered[index]!.start <= ordered[index - 1]!.end) return true;
    }
  }
  return false;
}

/**
 * One canonical participation fact (ADR 0026 D3, D15): a row of a selected,
 * classified **race** classification. Sprint, qualifying and unavailable
 * classifications contribute none.
 */
interface ParticipationFact {
  readonly round: number;
  readonly driverId: string;
  readonly constructorId: string;
}

/** The selected, classified race classifications: the only observations. */
function classifiedRaces(source: ProviderSeasonSource) {
  return source.results.filter(
    (result) =>
      result.sessionType === 'race' && isClassifiedResult(result.status),
  );
}

function participationFacts(
  source: ProviderSeasonSource,
): readonly ParticipationFact[] {
  return classifiedRaces(source).flatMap((result) =>
    result.entries.map((entry) => ({
      round: result.round,
      driverId: entry.driverId,
      constructorId: entry.constructorId,
    })),
  );
}

/** Whether `round` lies inside a span, null bounds being unbounded. */
function spanContains(entry: DriverSeasonEntry, round: number): boolean {
  return (
    (entry.startRound ?? Number.NEGATIVE_INFINITY) <= round &&
    round <= (entry.endRound ?? Number.POSITIVE_INFINITY)
  );
}

/**
 * Whether any participation fact is not placed in exactly one span of its
 * driver that names its constructor (`result-entry-span`).
 */
function hasUnplacedParticipation(
  entries: readonly DriverSeasonEntry[],
  facts: readonly ParticipationFact[],
): boolean {
  return facts.some((fact) => {
    const covering = entries.filter(
      (entry) =>
        entry.driverId === fact.driverId && spanContains(entry, fact.round),
    );
    return (
      covering.length !== 1 || covering[0]!.constructorId !== fact.constructorId
    );
  });
}

/**
 * Whether any span disagrees with the classified race rounds
 * (`driver-entry-support`). See the relation for the exact rule.
 *
 * `rounds` is the ascending set of selected, classified race rounds. Rounds
 * without such a classification are not observations at all, so they neither
 * support nor interrupt a span here; accounting for them is span derivation's
 * business (ADR 0026 D4).
 */
function hasUnsupportedSpan(
  entries: readonly DriverSeasonEntry[],
  facts: readonly ParticipationFact[],
  rounds: readonly number[],
): boolean {
  if (entries.length === 0) return false;
  if (rounds.length === 0) return true;
  const firstRound = rounds[0]!;
  const latestRound = rounds.at(-1)!;
  const observed = (entry: DriverSeasonEntry, round: number): boolean =>
    facts.some(
      (fact) =>
        fact.round === round &&
        fact.driverId === entry.driverId &&
        fact.constructorId === entry.constructorId,
    );
  return entries.some((entry) => {
    // D8 spells a span that begins at the first classified round as null.
    if (entry.startRound === firstRound) return true;
    // Only a later classified round without this seat establishes an exit
    // (D5, D6). None exists after the latest one, however complete the
    // calendar, so a span still observed there stays open: its end is null.
    if (entry.endRound === latestRound) return true;
    const opening = entry.startRound ?? firstRound;
    const closing = entry.endRound ?? latestRound;
    // Observed at both of its own boundaries (D5 rules 1, 3, 4; D6).
    if (!observed(entry, opening) || !observed(entry, closing)) return true;
    // Continuous: a classified round inside the span without the driver for
    // this constructor would have closed it (D5 rules 2, 4, 5).
    if (
      rounds.some(
        (round) =>
          round > opening && round < closing && !observed(entry, round),
      )
    ) {
      return true;
    }
    // Maximal: the neighbouring classified rounds must not observe the same
    // seat, or the span would have been extended instead (D5 rule 2).
    const before = rounds.filter((round) => round < opening).at(-1);
    const after = rounds.find((round) => round > closing);
    return (
      (before !== undefined && observed(entry, before)) ||
      (after !== undefined && observed(entry, after))
    );
  });
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
    // Exact equality against the identity the domain model defines, built by
    // the one shared constructor. Nothing is rewritten, trimmed, case-folded or
    // inferred - a mismatch withholds the whole candidate, exactly as every
    // other broken relation does.
    if (event.id !== canonicalGrandPrixId(event.season, event.eventSlug)) {
      fail('event-identity');
    }
    for (const session of event.sessions) {
      // Exact equality against the identity the domain model defines, built by
      // the one shared constructor. Deliberately not a prefix test: a prefix
      // would accept `{event}-race-2` and `{event}-qualifying` under a `race`
      // session alike, and the contract defines an identity, not a namespace.
      // Nothing is rewritten, coerced or inferred - a mismatch withholds the
      // whole candidate, exactly as every other broken relation does.
      if (session.id !== canonicalSessionId(event.id, session.type)) {
        fail('session-event');
      }
    }
  }
  for (const entry of source.driverEntries) {
    if (!drivers.has(entry.driverId)) fail('driver-entry-driver');
    if (!constructors.has(entry.constructorId)) {
      fail('driver-entry-constructor');
    }
    // Exact equality against the ADR 0026 D7 identity, built by the one shared
    // constructor. Nothing is renamed: a mismatch withholds the candidate.
    if (
      entry.id !==
      canonicalDriverSeasonEntryId(
        entry.season,
        entry.driverId,
        entry.startRound,
      )
    ) {
      fail('driver-entry-identity');
    }
  }
  if (hasInvalidDriverSpans(source.driverEntries)) fail('driver-entry-span');
  for (const entry of source.constructorEntries) {
    if (!constructors.has(entry.constructorId)) {
      fail('constructor-entry-constructor');
    }
    if (
      entry.id !==
      canonicalConstructorSeasonEntryId(entry.season, entry.constructorId)
    ) {
      fail('constructor-entry-identity');
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
    // Exact equality against the identity the domain model defines, built by
    // the one shared constructor. Deliberately not a prefix or suffix test: the
    // contract defines an identity, not a namespace, so `{gp}-race-results-2`
    // and `{gp}-race-result` are both wrong. Nothing is rewritten, coerced,
    // repaired or discarded - a mismatch withholds the whole candidate, exactly
    // as every other broken relation does.
    if (
      result.id !==
      canonicalRaceResultId(result.grandPrixId, result.sessionType)
    ) {
      fail('result-identity');
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

  // Published participation and published race classifications must agree in
  // both directions (ADR 0026 D12 item 5). Neither side is repaired: no span is
  // derived, extended or dropped here, and no row is discarded.
  const facts = participationFacts(source);
  const raceRounds = [
    ...new Set(classifiedRaces(source).map((result) => result.round)),
  ].sort((left, right) => left - right);
  if (hasUnplacedParticipation(source.driverEntries, facts)) {
    fail('result-entry-span');
  }
  if (hasUnsupportedSpan(source.driverEntries, facts, raceRounds)) {
    fail('driver-entry-support');
  }

  // One mechanism over a closed set of stored identities.
  const identities = identitiesByCategory(source);
  for (const category of duplicateIdentityCategories) {
    if (hasDuplicate(identities[category])) fail('duplicate-identity');
  }

  return seasonRelations.filter((relation) => failed.has(relation));
}
