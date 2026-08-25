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
 */
export const providerMappingEntities = [
  'driver',
  'constructor',
  'circuit',
] as const;
export type ProviderMappingEntity = (typeof providerMappingEntities)[number];

export const providerMappingFields = [
  'driverId',
  'constructorId',
  'circuitId',
  'driver_number',
  'team_name',
  'circuit_key',
] as const;
export type ProviderMappingField = (typeof providerMappingFields)[number];

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

export interface GridViewIdByEntity {
  readonly driver: GridViewDriverId;
  readonly constructor: GridViewConstructorId;
  readonly circuit: GridViewCircuitId;
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
  readonly valueType: 'string' | 'integer';
}

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
] as const satisfies readonly KeyShape[]);

/** The GridView public-ID grammar: lowercase ASCII kebab-case, bounded. */
const PUBLIC_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PUBLIC_ID_MAX_LENGTH = 64;
const PROVIDER_STRING_MAX_LENGTH = 64;

export function isPublicIdGrammar(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= PUBLIC_ID_MAX_LENGTH &&
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
  if (value.length === 0 || value.length > PROVIDER_STRING_MAX_LENGTH) {
    return false;
  }
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) return false;
  }
  return value.trim() === value;
}

export function isProviderIntegerValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function valueTypeOf(value: unknown): 'string' | 'integer' | null {
  if (isProviderStringValue(value)) return 'string';
  if (isProviderIntegerValue(value)) return 'integer';
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
): ProviderMappingKey | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;

  if (!isSeason(record.season)) return null;

  const valueType = valueTypeOf(record.providerValue);
  if (valueType === null) return null;

  const shape = providerKeyShapes.find(
    (candidate) =>
      candidate.source === record.source &&
      candidate.entity === record.entity &&
      candidate.providerField === record.providerField &&
      candidate.valueType === valueType,
  );
  if (shape === undefined) return null;

  return {
    season: record.season,
    source: shape.source,
    entity: shape.entity,
    providerField: shape.providerField,
    providerValue: record.providerValue,
  } as ProviderMappingKey;
}

/**
 * Field separator for the canonical lookup key: NUL.
 *
 * A curated provider value may not contain a control character, so no value
 * can embed the separator and forge a key belonging to another combination.
 */
const KEY_SEPARATOR = String.fromCharCode(0);

/**
 * The canonical lookup key.
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
  return [
    String(key.season),
    key.source,
    key.entity,
    key.providerField,
    typeof key.providerValue === 'number' ? 'integer' : 'string',
    String(key.providerValue),
  ].join(KEY_SEPARATOR);
}
