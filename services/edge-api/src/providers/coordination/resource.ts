/**
 * The canonical identity of one **logical resource** GridView coordinates, and
 * the normalized payload a source may contribute for it (gap G4).
 *
 * This is the granularity the previous whole-season `fetchSeasonSource(season,
 * jobs)` call could not express. One resource is one thing a source can be
 * asked for independently, can succeed or fail independently, and can be
 * selected for independently.
 *
 * Everything here is **internal**. A resource identity is not a public v1
 * field, is never serialized into a snapshot, and carries no provider
 * identifier: payloads are the already-normalized public contract types, which
 * is the boundary a future adapter normalizes to inside itself
 * (GridView_Provider_Evaluation.md Appendix D.1).
 */

import type {
  Circuit,
  Constructor,
  ConstructorSeasonEntry,
  ConstructorStanding,
  Driver,
  DriverSeasonEntry,
  DriverStanding,
  GrandPrix,
  RaceResult,
  Session,
} from '../../contract/types';
import type { SyncJobCategory } from '../../storage/types';

/**
 * The closed set of logical resources.
 *
 * Derived from what the adopted sources actually publish per check
 * (GridView_Provider_Evaluation.md §11.1) and from the existing job
 * categories. There is deliberately **no** member for a derived document:
 * `home-rebuild` rebuilds published GridView data and must never become a
 * provider request (GridView_Backend_Scheme.md §15).
 */
export const coordinatedResourceKinds = [
  'season-calendar',
  'event-schedule',
  'season-participants',
  'season-circuits',
  'session-classification',
  'driver-standings',
  'constructor-standings',
] as const;

export type CoordinatedResourceKind = (typeof coordinatedResourceKinds)[number];

/**
 * Session types that produce a classification.
 *
 * Practice sessions and the contract's `unknown` member are excluded: neither
 * has a classification resource, so neither can be named in a request.
 */
export const classifiedSessionTypes = [
  'sprint_qualifying',
  'qualifying',
  'sprint',
  'race',
] as const;

export type ClassifiedSessionType = (typeof classifiedSessionTypes)[number];

/**
 * The closed discriminated union of resource identities.
 *
 * Season scope is mandatory on every member. Round and session scope appear
 * only on the members that genuinely have them, so an event-scoped request
 * without a round, or a season-scoped request carrying one, is a compile error
 * rather than an ignored field.
 */
export type CoordinatedResource =
  | { readonly kind: 'season-calendar'; readonly season: number }
  | { readonly kind: 'season-participants'; readonly season: number }
  | { readonly kind: 'season-circuits'; readonly season: number }
  | { readonly kind: 'driver-standings'; readonly season: number }
  | { readonly kind: 'constructor-standings'; readonly season: number }
  | {
      readonly kind: 'event-schedule';
      readonly season: number;
      readonly round: number;
    }
  | {
      readonly kind: 'session-classification';
      readonly season: number;
      readonly round: number;
      readonly sessionType: ClassifiedSessionType;
    };

/**
 * The normalized payload a source contributes.
 *
 * Each member is pinned to exactly one resource kind, so a calendar payload
 * cannot be returned for a standings request without failing both the type
 * check and the runtime match below.
 */
export type CoordinatedPayload =
  | { readonly kind: 'season-calendar'; readonly events: readonly GrandPrix[] }
  | {
      readonly kind: 'season-participants';
      readonly drivers: readonly Driver[];
      readonly constructors: readonly Constructor[];
      readonly driverEntries: readonly DriverSeasonEntry[];
      readonly constructorEntries: readonly ConstructorSeasonEntry[];
    }
  | { readonly kind: 'season-circuits'; readonly circuits: readonly Circuit[] }
  | {
      readonly kind: 'driver-standings';
      readonly standings: readonly DriverStanding[];
    }
  | {
      readonly kind: 'constructor-standings';
      readonly standings: readonly ConstructorStanding[];
    }
  | {
      readonly kind: 'event-schedule';
      readonly round: number;
      readonly sessions: readonly Session[];
    }
  | { readonly kind: 'session-classification'; readonly result: RaceResult };

/** The payload member matching resource kind `K`. */
export type CoordinatedPayloadFor<K extends CoordinatedResourceKind> = Extract<
  CoordinatedPayload,
  { kind: K }
>;

/**
 * The job category one resource is accounted against.
 *
 * A total function over the closed kind union, so attribution is exact by
 * construction and a caller can never supply a mismatched category. Two
 * resources deliberately share `profiles`; that is the existing category
 * vocabulary, not a coordination decision.
 */
const jobCategories: Record<CoordinatedResourceKind, SyncJobCategory> = {
  'season-calendar': 'season-calendar',
  'event-schedule': 'event-schedule',
  'season-participants': 'profiles',
  'season-circuits': 'profiles',
  'session-classification': 'results',
  'driver-standings': 'standings',
  'constructor-standings': 'standings',
};

export function jobCategoryForResource(
  kind: CoordinatedResourceKind,
): SyncJobCategory {
  return jobCategories[kind];
}

const SEASON_MIN = 1950;
const SEASON_MAX = 2100;
const ROUND_MIN = 1;
const ROUND_MAX = 999;

function isSeason(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= SEASON_MIN &&
    value <= SEASON_MAX
  );
}

function isRound(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= ROUND_MIN &&
    value <= ROUND_MAX
  );
}

/**
 * Every property name any resource identity declares.
 *
 * A kind's *forbidden* set is derived from this list rather than written out,
 * so a scope one kind legitimately carries can never be silently tolerated -
 * or silently reachable through a prototype - on another.
 */
const declaredResourceKeys = [
  'kind',
  'season',
  'round',
  'sessionType',
] as const;

type DeclaredResourceKey = (typeof declaredResourceKeys)[number];

/**
 * The exact own properties each kind's identity has.
 *
 * An identity is validated as a **closed shape**, not as a set of fields that
 * merely happen to be present. An extra property is rejected rather than
 * ignored: `{ kind: 'season-calendar', season: 2026, round: 7 }` names exactly
 * the same logical resource as `{ kind: 'season-calendar', season: 2026 }`, so
 * tolerating it would let one logical resource enter a plan twice under two
 * different identities - defeating duplicate rejection and sending the same
 * request twice - and would let an unvalidated, unbounded, caller-controlled
 * value ride along inside a resource identity.
 *
 * The mechanism is deliberately the **same one the outcome boundary uses**
 * (`port.ts`): `Reflect.ownKeys` rather than `Object.keys`, so a
 * non-enumerable or symbol-keyed own property is counted rather than invisible,
 * `Object.hasOwn` for required fields, and `in` for keys another kind declares,
 * so a scope planted on a prototype fails closed instead of riding along. A
 * key-count comparison could see none of those three.
 */
const resourceShapes: Record<
  CoordinatedResourceKind,
  readonly DeclaredResourceKey[]
> = {
  'season-calendar': ['kind', 'season'],
  'season-participants': ['kind', 'season'],
  'season-circuits': ['kind', 'season'],
  'driver-standings': ['kind', 'season'],
  'constructor-standings': ['kind', 'season'],
  'event-schedule': ['kind', 'season', 'round'],
  'session-classification': ['kind', 'season', 'round', 'sessionType'],
};

function isResourceKind(value: unknown): value is CoordinatedResourceKind {
  return (
    typeof value === 'string' &&
    (coordinatedResourceKinds as readonly string[]).includes(value)
  );
}

/**
 * Whether an identity carries exactly the properties its kind declares.
 *
 * Nothing here reads a property's *value*, so a throwing accessor on a scope
 * field cannot fire from this function: shape is decided before any value is
 * inspected. A hostile proxy can still throw from `ownKeys`, `has` or
 * `getOwnPropertyDescriptor`; that is contained by `readCoordinatedResource`.
 */
function hasClosedResourceShape(
  record: object,
  kind: CoordinatedResourceKind,
): boolean {
  const allowed = new Set<string>(resourceShapes[kind]);
  for (const key of Reflect.ownKeys(record)) {
    if (typeof key !== 'string' || !allowed.has(key)) return false;
  }
  for (const key of resourceShapes[kind]) {
    if (!Object.hasOwn(record, key)) return false;
  }
  for (const key of declaredResourceKeys) {
    if (!allowed.has(key) && key in record) return false;
  }
  return true;
}

/**
 * Validates one resource identity and returns a **plain frozen copy** of it.
 *
 * A copy rather than the caller's object, for one reason that matters: every
 * declared field is read exactly once, here, while the identity is being
 * validated. The coordinator then executes the identity it validated rather
 * than an object whose accessors could answer differently on the second read -
 * which is what would let a plan pass duplicate detection and then expand into
 * two different requests.
 *
 * Returns `null` for anything that is not a valid identity, and **never
 * throws**: reflection, `in` and property access are all caller-reachable
 * code, so the whole inspection is contained.
 */
export function readCoordinatedResource(
  value: unknown,
): CoordinatedResource | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    // The discriminant has to be read to know which shape applies at all; it
    // is the only read that precedes shape closure.
    const kind = record.kind;
    if (!isResourceKind(kind)) return null;
    if (!hasClosedResourceShape(record, kind)) return null;
    const season = record.season;
    if (!isSeason(season)) return null;

    switch (kind) {
      case 'season-calendar':
      case 'season-participants':
      case 'season-circuits':
      case 'driver-standings':
      case 'constructor-standings':
        return Object.freeze({ kind, season });
      case 'event-schedule': {
        const round = record.round;
        if (!isRound(round)) return null;
        return Object.freeze({ kind, season, round });
      }
      case 'session-classification': {
        const round = record.round;
        const sessionType = record.sessionType;
        if (!isRound(round)) return null;
        if (
          !(classifiedSessionTypes as readonly unknown[]).includes(sessionType)
        ) {
          return null;
        }
        return Object.freeze({
          kind,
          season,
          round,
          sessionType: sessionType as ClassifiedSessionType,
        });
      }
    }
  } catch {
    // A hostile proxy or accessor. Nothing it claims can be believed, and the
    // thrown value is never read: it is caller-controlled.
    return null;
  }
}

/**
 * Runtime validation of a resource identity.
 *
 * The caller's types prove the shape, never the runtime contents: `season:
 * number` accepts `NaN`, `-1` and `1.5` just as happily as `2026`, and a
 * structural type accepts any number of extra properties. A plan is an input
 * boundary, so it is re-validated here rather than trusted.
 */
export function isCoordinatedResource(
  value: unknown,
): value is CoordinatedResource {
  return readCoordinatedResource(value) !== null;
}

/** A closed, bounded component. Anything else contributes nothing at all. */
function scopeComponent(value: unknown): string {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? String(value)
    : '';
}

function sessionComponent(value: unknown): string {
  return (classifiedSessionTypes as readonly unknown[]).includes(value)
    ? (value as ClassifiedSessionType)
    : '';
}

/**
 * The canonical identity string for one resource.
 *
 * **Length-prefixed, not separator-joined**, for the same reason the mapping
 * registry is: a separator-joined form is injective only while no component
 * can contain the separator, and injectivity that depends on validation is
 * weaker than injectivity by construction. Every component here is a closed
 * enum member or an integer, so this is belt and braces - which is exactly
 * what a duplicate-detection key should be.
 *
 * Nothing is lower-cased, trimmed or otherwise normalized.
 */
export function resourceKey(resource: CoordinatedResource): string {
  // Components are chosen by **kind**, never by probing which properties
  // happen to exist, so an identity that carries a scope its kind does not
  // have keys identically to the same identity without it, and no
  // unvalidated value can enter the key or throw while being stringified.
  const components: string[] = [
    isResourceKind(resource.kind) ? resource.kind : '',
    scopeComponent(resource.season),
  ];
  switch (resource.kind) {
    case 'event-schedule':
      components.push(scopeComponent(resource.round), '');
      break;
    case 'session-classification':
      components.push(
        scopeComponent(resource.round),
        sessionComponent(resource.sessionType),
      );
      break;
    default:
      components.push('', '');
      break;
  }
  let encoded = '';
  for (const component of components) {
    encoded += component.length + ':' + component + ';';
  }
  return encoded;
}

function isArrayOfObjects(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' && entry !== null && !Array.isArray(entry),
    )
  );
}

/**
 * True when every entry of a collection is an object whose `season` is
 * **exactly** the requested season.
 *
 * A source is asked for one season. A collection that carries entries for
 * another one does not answer that question, and the layers below cannot catch
 * it: season assembly copies a selected collection into the season source
 * verbatim, and the snapshot validator checks each entry against its own
 * schema rather than against the season it is being published under. So this
 * is the boundary where the request and the answer are still both in hand.
 *
 * Three deliberate properties:
 *
 * - **No coercion.** `===` against an already-validated integer, so `'2026'`,
 *   `2026.5`, `NaN` and a missing field are all mismatches. Nothing is parsed,
 *   trimmed, rounded or defaulted.
 * - **One bad entry rejects the whole collection.** A partially correct
 *   collection is not a smaller correct one.
 * - **No filtering.** Publishing the matching subset would silently answer a
 *   narrower question than the one asked and would look like a complete
 *   season, so the contribution fails closed instead.
 */
function everyEntryInSeason(value: unknown, season: number): boolean {
  return (
    isArrayOfObjects(value) &&
    (value as Record<string, unknown>[]).every(
      (entry) => entry.season === season,
    )
  );
}

/**
 * True when `payload` is a structurally sound contribution **for this exact
 * resource**.
 *
 * Two separate things are checked, and both matter:
 *
 * 1. The payload's discriminant equals the resource kind, so a standings
 *    payload can never be selected as a calendar.
 * 2. Every identity field the payload's own normalized contract carries agrees
 *    with the requested identity: the season of each calendar event, standing
 *    and season entry, the round of an event schedule, and the season, round
 *    and session type of a classification. An adapter that answers a different
 *    question than the one it was asked is a malformed outcome, not a
 *    candidate - and a collection that answers the right question for only
 *    some of its entries is rejected whole, never filtered down to the subset
 *    that happens to match.
 *
 * An identity field is required only where the normalized contract actually
 * has one. Driver, constructor and circuit profiles are season-independent by
 * contract, so nothing is demanded of them and no DTO is widened to invent it.
 *
 * Deep contract validation stays with the adapter, which is the component that
 * normalizes provider data. This is the coordinator's own containment check:
 * it must never select a payload that does not belong to the resource it was
 * selected for.
 */
export function payloadMatchesResource(
  resource: CoordinatedResource,
  payload: unknown,
): payload is CoordinatedPayload {
  // An array is not a payload. `typeof [] === 'object'` alone would let one
  // through to a discriminant check it can only fail by accident, and `null`
  // would reach a property read. Neither can describe any payload member, so
  // both are refused before resource-specific validation - which stays the
  // single place the actual payload contract is decided.
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload))
    return false;
  const record = payload as Record<string, unknown>;
  if (record.kind !== resource.kind) return false;

  switch (resource.kind) {
    case 'season-calendar':
      return everyEntryInSeason(record.events, resource.season);
    case 'season-participants':
      // A driver and a constructor are season-independent profiles: neither
      // carries a season in the normalized contract, so none is demanded of
      // them. The two *entry* collections beside them are the season-scoped
      // half of this payload, and both are bound.
      return (
        isArrayOfObjects(record.drivers) &&
        isArrayOfObjects(record.constructors) &&
        everyEntryInSeason(record.driverEntries, resource.season) &&
        everyEntryInSeason(record.constructorEntries, resource.season)
      );
    case 'season-circuits':
      // A circuit carries no season either. Widening the DTO to create an
      // identity field this seam could check is not this seam's business.
      return isArrayOfObjects(record.circuits);
    case 'driver-standings':
    case 'constructor-standings':
      return everyEntryInSeason(record.standings, resource.season);
    case 'event-schedule':
      return (
        record.round === resource.round && isArrayOfObjects(record.sessions)
      );
    case 'session-classification': {
      const result = record.result;
      if (typeof result !== 'object' || result === null) return false;
      const classification = result as Partial<RaceResult>;
      return (
        classification.season === resource.season &&
        classification.round === resource.round &&
        classification.sessionType === resource.sessionType &&
        Array.isArray(classification.entries)
      );
    }
  }
}
