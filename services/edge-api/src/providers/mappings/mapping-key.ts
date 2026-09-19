/**
 * The typed, source-qualified, season-qualified identity of one provider
 * entity, and the closed set of GridView identities it may resolve to.
 *
 * Everything here is **internal**. A provider identifier never appears in a
 * public v1 DTO, in the OpenAPI schema, in a published snapshot or in any
 * generated fixture (GridView_Provider_Evaluation.md §10.8, Backend Scheme
 * §8.1, ADR 0022).
 *
 * Naming a source here does not make it runnable. `PROVIDER_MODE` still admits
 * exactly `mock | none`, no adapter for `jolpica` or `openf1` exists, and this
 * registry is dormant until one does.
 */

/**
 * The real sources a curated mapping may describe.
 *
 * `mock` is deliberately absent. The mock provider emits GridView-owned
 * identities directly, so it neither needs nor may have a provider mapping;
 * making it unrepresentable in the key type means a mock mapping cannot be
 * written by mistake.
 */
export const providerMappingSources = ['jolpica', 'openf1'] as const;
export type ProviderMappingSource = (typeof providerMappingSources)[number];

/**
 * The stable identity kinds a curated GridView registry already governs.
 * Meeting and session identities are deliberately excluded: no authoritative
 * contract requires them in this phase, and neither has a curated registry.
 *
 * `event` was added by the ADR 0022 amendment of 2026-09-16 (A1, A5.1), which
 * introduced the curated GridView event registry that owns `eventSlug`.
 */
export const providerMappingEntities = [
  'driver',
  'constructor',
  'circuit',
  'event',
] as const;
export type ProviderMappingEntity = (typeof providerMappingEntities)[number];

/**
 * The upstream field a key is read from.
 *
 * Every member but `eventLocator` is the literal name of a provider field.
 * `eventLocator` is **GridView's own name for a composite locator**, because
 * Jolpica publishes no event identifier at all (amendment A2): the locator
 * spans three Jolpica fields at once and no single upstream field name
 * describes it. Naming it here keeps the five-part key shape (D4) intact
 * rather than making the field position optional for one entity kind.
 */
export const providerMappingFields = [
  'driverId',
  'constructorId',
  'circuitId',
  'driver_number',
  'team_name',
  'circuit_key',
  'eventLocator',
] as const;
export type ProviderMappingField = (typeof providerMappingFields)[number];

/**
 * The Jolpica event locator: a complete, season-scoped provider locator.
 *
 * It is **not an identity** (amendment A2). It is internal, never published,
 * never builds a GridView ID, and is never unique outside its source and
 * season. The season is deliberately **absent**: it is the key's existing
 * season qualifier, supplied by the `content/seasons/<year>/` file the record
 * lives in (D3). A record that carried its own season could disagree with its
 * file and then match nothing while passing every other check, so a second
 * season field is unrepresentable here and rejected at decode time.
 */
export interface ProviderEventLocator {
  readonly round: number;
  readonly raceName: string;
  readonly circuitId: string;
}

/**
 * The closed discriminated union of provider keys.
 *
 * Each variant pins the source, the entity kind, the exact upstream field name
 * and the upstream value's type together. There is no variant for, say, a
 * Jolpica `driver_number` or an OpenF1 `driverId`, so a cross-field or
 * cross-source lookup is a compile error rather than a silent miss.
 *
 * Every key is season-qualified, Jolpica included. Jolpica slugs are usually
 * stable across seasons, but an explicit per-season reviewed set stops an old
 * participation assumption being carried into a new season, matches the
 * existing `content/seasons/<year>/` layout, and is *required* for OpenF1:
 * `driver_number` is reassigned between seasons and the champion's `1` is a
 * per-season choice (GridView_Provider_Evaluation.md §8.7 M2), so it can never
 * be a cross-season key.
 */
export type ProviderMappingKey =
  | {
      readonly season: number;
      readonly source: 'jolpica';
      readonly entity: 'driver';
      readonly providerField: 'driverId';
      readonly providerValue: string;
    }
  | {
      readonly season: number;
      readonly source: 'jolpica';
      readonly entity: 'constructor';
      readonly providerField: 'constructorId';
      readonly providerValue: string;
    }
  | {
      readonly season: number;
      readonly source: 'jolpica';
      readonly entity: 'circuit';
      readonly providerField: 'circuitId';
      readonly providerValue: string;
    }
  | {
      readonly season: number;
      readonly source: 'openf1';
      readonly entity: 'driver';
      readonly providerField: 'driver_number';
      readonly providerValue: number;
    }
  | {
      readonly season: number;
      readonly source: 'openf1';
      readonly entity: 'constructor';
      readonly providerField: 'team_name';
      readonly providerValue: string;
    }
  | {
      readonly season: number;
      readonly source: 'openf1';
      readonly entity: 'circuit';
      readonly providerField: 'circuit_key';
      readonly providerValue: number;
    }
  | {
      readonly season: number;
      readonly source: 'jolpica';
      readonly entity: 'event';
      readonly providerField: 'eventLocator';
      readonly providerValue: ProviderEventLocator;
    };

/** The key variants whose entity kind is `E`. */
export type ProviderMappingKeyFor<E extends ProviderMappingEntity> = Extract<
  ProviderMappingKey,
  { entity: E }
>;

/**
 * Entity-specific GridView identity types.
 *
 * A resolved identity is branded so it cannot be confused with an arbitrary
 * string, and so a driver ID cannot be passed where a constructor ID is
 * expected. Only `mapping-registry.ts` can produce one, and only from a
 * curated record whose target was proven to exist in the matching registry.
 */
declare const gridViewIdBrand: unique symbol;

export type GridViewDriverId = string & {
  readonly [gridViewIdBrand]: 'driver';
};
export type GridViewConstructorId = string & {
  readonly [gridViewIdBrand]: 'constructor';
};
export type GridViewCircuitId = string & {
  readonly [gridViewIdBrand]: 'circuit';
};
/**
 * A curator-created `eventSlug` from the curated event registry.
 *
 * It is **not** a `GrandPrix.id`. `GrandPrix.id` stays `{season}-{eventSlug}`
 * and is built by `canonicalGrandPrixId`; nothing here constructs it
 * (amendment A1).
 */
export type GridViewEventId = string & {
  readonly [gridViewIdBrand]: 'event';
};

export interface GridViewIdByEntity {
  readonly driver: GridViewDriverId;
  readonly constructor: GridViewConstructorId;
  readonly circuit: GridViewCircuitId;
  readonly event: GridViewEventId;
}

/** The GridView identity type a key of entity kind `E` resolves to. */
export type GridViewIdFor<E extends ProviderMappingEntity> =
  GridViewIdByEntity[E];

/**
 * The only valid (source, entity, field, value type) combinations, as data.
 * Mirrors the union above so a decoded value can be checked at runtime.
 */
interface KeyShape {
  readonly source: ProviderMappingSource;
  readonly entity: ProviderMappingEntity;
  readonly providerField: ProviderMappingField;
  readonly valueType: ProviderValueType;
}

/**
 * The value's type, which is part of the key (D4).
 *
 * `locator` is the composite Jolpica event locator. Keeping it a distinct tag
 * means an event key can never collide with a string or integer key, exactly
 * as integer `1` can never collide with string `"1"`.
 */
type ProviderValueType = 'string' | 'integer' | 'locator';

export const providerKeyShapes: readonly KeyShape[] = Object.freeze([
  {
    source: 'jolpica',
    entity: 'driver',
    providerField: 'driverId',
    valueType: 'string',
  },
  {
    source: 'jolpica',
    entity: 'constructor',
    providerField: 'constructorId',
    valueType: 'string',
  },
  {
    source: 'jolpica',
    entity: 'circuit',
    providerField: 'circuitId',
    valueType: 'string',
  },
  {
    source: 'openf1',
    entity: 'driver',
    providerField: 'driver_number',
    valueType: 'integer',
  },
  {
    source: 'openf1',
    entity: 'constructor',
    providerField: 'team_name',
    valueType: 'string',
  },
  {
    source: 'openf1',
    entity: 'circuit',
    providerField: 'circuit_key',
    valueType: 'integer',
  },
  // Exactly one event combination, and it is Jolpica's (amendment A5.1).
  // No OpenF1 event combination exists: `meeting_key` stays excluded by the
  // ADR's scope note, and the OpenF1 path remains fail-closed.
  {
    source: 'jolpica',
    entity: 'event',
    providerField: 'eventLocator',
    valueType: 'locator',
  },
] as const satisfies readonly KeyShape[]);

/** The GridView public-ID grammar: lowercase ASCII kebab-case, bounded. */
const PUBLIC_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PUBLIC_ID_MAX_LENGTH = 64;
const PROVIDER_STRING_MAX_LENGTH = 64;

export function isPublicIdGrammar(value: unknown): value is string {
  // The grammar itself is ASCII-only, so code points and code units coincide
  // here; counted the same way as the provider bound for consistency.
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    [...value].length <= PUBLIC_ID_MAX_LENGTH &&
    PUBLIC_ID.test(value)
  );
}

/**
 * An exact upstream string: non-empty, bounded, no control character and no
 * leading or trailing whitespace. Curated data is rejected rather than
 * repaired, because repairing it would be the normalization this design
 * forbids.
 */
export function isProviderStringValue(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  // Counted in **Unicode code points**, matching JSON Schema `maxLength`.
  // `String#length` counts UTF-16 code units, so a 40-code-point
  // supplementary-plane value measures 80 there: the curated schema would
  // accept it and this predicate would reject it, and because the registry
  // fails closed as a whole, content that passed `validate:content` could
  // invalidate the entire runtime registry. The two layers must agree.
  const codePoints = [...value];
  if (
    codePoints.length === 0 ||
    codePoints.length > PROVIDER_STRING_MAX_LENGTH
  ) {
    return false;
  }
  for (const character of codePoints) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) return false;
  }
  return value.trim() === value;
}

export function isProviderIntegerValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/**
 * The round bound, matching `common.schema.json#/$defs/round`.
 *
 * A round is not an arbitrary positive integer: the curated content schema has
 * always bounded it, and the two layers must agree or content that passed
 * `validate:content` could still invalidate the whole runtime registry.
 */
const ROUND_MIN = 1;
const ROUND_MAX = 40;

function isRound(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= ROUND_MIN &&
    value <= ROUND_MAX
  );
}

/**
 * The complete, closed set of properties an event locator may carry.
 *
 * `season` is deliberately **not** a member. The season is the key's own
 * qualifier (amendment A2), so a locator that carried one could contradict its
 * file and match nothing for ever while passing schema, uniqueness, target and
 * evidence validation. Rejecting it outright is stricter than the fallback A2
 * allows (requiring an inner season to equal the file's), and is possible here
 * precisely because no inner season is represented.
 */
export const PROVIDER_LOCATOR_PROPERTIES: ReadonlySet<string> = new Set([
  'round',
  'raceName',
  'circuitId',
]);

/**
 * An exact, complete Jolpica event locator.
 *
 * Every component is validated on its own terms and none is repaired: no
 * trimming, case folding, punctuation rewriting or numeric coercion applies to
 * any of them (amendment A2).
 */
export function isProviderEventLocator(
  value: unknown,
): value is ProviderEventLocator {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  if (!hasExactlyOwnProperties(value, PROVIDER_LOCATOR_PROPERTIES)) {
    return false;
  }
  const locator = value as Record<string, unknown>;
  return (
    isRound(locator.round) &&
    isProviderStringValue(locator.raceName) &&
    isProviderStringValue(locator.circuitId)
  );
}

function valueTypeOf(value: unknown): ProviderValueType | null {
  if (isProviderStringValue(value)) return 'string';
  if (isProviderIntegerValue(value)) return 'integer';
  if (isProviderEventLocator(value)) return 'locator';
  return null;
}

function isSeason(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1950 &&
    value <= 2100
  );
}

/**
 * The complete, closed set of properties a provider mapping key may carry.
 *
 * This mirrors `additionalProperties: false` in the curated JSON Schema, so
 * the runtime boundary is as strict as the build-time one rather than merely
 * ignoring what the schema rejects.
 */
export const PROVIDER_KEY_PROPERTIES: ReadonlySet<string> = new Set([
  'season',
  'source',
  'entity',
  'providerField',
  'providerValue',
]);

/**
 * True when `value` carries exactly `allowed` as **own enumerable** properties
 * - no more, no fewer.
 *
 * Own properties only, deliberately: a plain property read walks the prototype
 * chain, so an object could otherwise supply a key field it does not actually
 * own. An object created with `Object.create(null)` that carries exactly the
 * required own properties is still accepted, because it is a legitimate way to
 * build a key without inheriting anything at all.
 *
 * `Object.keys` returns only own enumerable string keys, which is precisely
 * the surface a JSON payload can produce. It also means a `__proto__` or
 * `constructor` key that arrived as real own data is reported as an
 * unexpected property rather than being read as a key field.
 */
export function hasExactlyOwnProperties(
  value: object,
  allowed: ReadonlySet<string>,
): boolean {
  const own = Object.keys(value);
  if (own.length !== allowed.size) return false;
  for (const property of own) {
    if (!allowed.has(property)) return false;
  }
  return true;
}

/**
 * Why a value is not a provider mapping key.
 *
 * A closed, bounded set. It is safe to place in a log line and carries no
 * provider-controlled text of its own.
 */
export const providerKeyProblems = [
  'not-an-object',
  'unexpected-property',
  'invalid-season',
  'invalid-value',
  'invalid-combination',
] as const;
export type ProviderKeyProblem = (typeof providerKeyProblems)[number];

/**
 * The result of decoding an untrusted value.
 *
 * Deliberately **not** nullable. A malformed provider identity is not the same
 * thing as "no mapping is required here": returning `null` for both would let
 * a future adapter treat a corrupt upstream identifier as an optional absence
 * and continue with an unvalidated provider value. Every rejection is explicit
 * and carries a bounded reason.
 */
export type DecodedProviderMappingKey =
  | { readonly ok: true; readonly key: ProviderMappingKey }
  | { readonly ok: false; readonly problem: ProviderKeyProblem };

/**
 * Runtime decoder for an unknown value.
 *
 * Used for curated records read from JSON and for any future adapter input.
 * It accepts only a complete, valid discriminated combination — which is what
 * rejects `mock` as a source, a Jolpica `driver_number`, an OpenF1 `driverId`,
 * a string where an integer is required and the reverse.
 *
 * It performs **no** coercion: `"1"` never becomes `1`, and no string is
 * trimmed, case-folded or slugged on the way in.
 */
export function decodeProviderMappingKey(
  value: unknown,
): DecodedProviderMappingKey {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, problem: 'not-an-object' };
  }
  const record = value as Record<string, unknown>;

  // A provider key is a *closed* shape, so an object carrying a second
  // identity representation is rejected rather than silently narrowed. An
  // extra `gridviewId`, `target` or `providerId` alongside a valid key is a
  // confused-deputy hazard: today nothing reads it, but a future adapter that
  // spreads the same object into a domain record would carry the smuggled
  // identity with it. Own enumerable properties only, so a value cannot pass
  // by inheriting fields from a prototype either.
  if (!hasExactlyOwnProperties(record, PROVIDER_KEY_PROPERTIES)) {
    return { ok: false, problem: 'unexpected-property' };
  }

  if (!isSeason(record.season)) {
    return { ok: false, problem: 'invalid-season' };
  }

  const valueType = valueTypeOf(record.providerValue);
  if (valueType === null) {
    return { ok: false, problem: 'invalid-value' };
  }

  const shape = providerKeyShapes.find(
    (candidate) =>
      candidate.source === record.source &&
      candidate.entity === record.entity &&
      candidate.providerField === record.providerField &&
      candidate.valueType === valueType,
  );
  if (shape === undefined) {
    return { ok: false, problem: 'invalid-combination' };
  }

  return {
    ok: true,
    key: {
      season: record.season,
      source: shape.source,
      entity: shape.entity,
      providerField: shape.providerField,
      // A composite value is copied into a frozen object of its own rather
      // than aliased. The caller keeps whatever it passed in - nothing here
      // mutates it - and the decoded key cannot be changed afterwards through
      // a reference the caller still holds.
      providerValue:
        valueType === 'locator'
          ? frozenLocator(record.providerValue as ProviderEventLocator)
          : record.providerValue,
    } as ProviderMappingKey,
  };
}

function frozenLocator(locator: ProviderEventLocator): ProviderEventLocator {
  return Object.freeze({
    round: locator.round,
    raceName: locator.raceName,
    circuitId: locator.circuitId,
  });
}

/**
 * Re-validates a value that already carries the key **type**.
 *
 * TypeScript proves the shape of an object literal; it proves nothing about
 * the runtime string or number inside it. `providerValue: string` happily
 * accepts `" norris "`, `""`, `"a
b"` and a five-thousand character string,
 * and `providerValue: number` accepts `NaN`, `Infinity`, `-1` and a
 * non-integer. A future adapter that builds its key from decoded provider JSON
 * would carry all of that straight into the lookup.
 *
 * So the resolver re-validates at its own boundary rather than trusting the
 * caller's types. This is the single validated entry point: there is no other
 * way to reach the index.
 */
export function validateProviderMappingKey(
  key: ProviderMappingKey,
): DecodedProviderMappingKey {
  return decodeProviderMappingKey(key);
}

/**
 * The canonical lookup key.
 *
 * The length prefix is a **UTF-16 code-unit** count (`String#length`), and
 * that is deliberate: it is a serialization detail, not a validation bound.
 * The 64-character *acceptance* limit counts Unicode **code points** to match
 * JSON Schema `maxLength`; the prefix only has to be deterministic and
 * unambiguous over the already-validated string, which a code-unit count is.
 * Mixing the two concerns would change the wire key for no benefit.
 *
 * **Length-prefixed, not separator-joined.** An earlier separator-joined form
 * was not injective once any component could contain the separator: a forged
 * `providerField` of `driverId\0string\0a` with value `b` serialized
 * identically to an honest `driverId` with value `a\0string\0b`. Prefixing
 * every component with its own length removes the ambiguity by construction,
 * so the encoding is injective over *all* inputs rather than only over inputs
 * that happen to have been validated first. Validation still happens - this
 * simply stops the encoding depending on it.
 *
 * The value's **type tag** is part of the key, so integer `1` and string `"1"`
 * are different keys. That is what makes the index immune to JavaScript object
 * key coercion, and it is why lookups use a `Map` rather than a plain object.
 *
 * Nothing is lower-cased, trimmed, transliterated or slugged here. `Red Bull`,
 * `red bull` and `Red Bull ` are three distinct keys, and only the first is in
 * the curated registry.
 */
export function canonicalKey(key: ProviderMappingKey): string {
  const components = [
    String(key.season),
    key.source,
    key.entity,
    key.providerField,
    ...valueComponents(key.providerValue),
  ];
  let encoded = '';
  for (const component of components) {
    encoded += component.length + ':' + component + ';';
  }
  return encoded;
}

/**
 * The type tag followed by the value's own components.
 *
 * The tag comes first and is itself length-prefixed, so it determines how many
 * frames follow. That keeps the whole encoding injective even though a locator
 * contributes three frames where a scalar contributes one: no scalar key can
 * ever produce the frame sequence of a locator key, because no scalar tag is
 * `locator`. The locator's components are emitted in a fixed order and are
 * never joined into one string, so a `raceName` containing the framing
 * characters cannot impersonate a `circuitId`.
 */
function valueComponents(
  value: string | number | ProviderEventLocator,
): readonly string[] {
  if (typeof value === 'number') return ['integer', String(value)];
  if (typeof value === 'string') return ['string', value];
  return ['locator', String(value.round), value.raceName, value.circuitId];
}
