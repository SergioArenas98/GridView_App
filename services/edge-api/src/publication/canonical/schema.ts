/**
 * Declaring the canonical revision input, and projecting a payload onto it.
 *
 * ADR 0020 D1.7 excludes envelope, provenance and time-varying metadata "without
 * exception". A deny-list would satisfy that only for the fields somebody
 * remembered to name, and the one field it is easiest to forget is already in
 * the payload: `HomeData.freshness` carries `generatedAt`, `sourceUpdatedAt`,
 * `staleAfter` and the server-stale flag *inside* `data`, so a recursive
 * serializer that filtered envelope keys would hash `sourceUpdatedAt` into the
 * input that derives it.
 *
 * So the input is **constructed**, never filtered. A schema names exactly the
 * properties the revision is defined over; the projection reads those and
 * nothing else. A field that is not declared cannot reach the digest, whether
 * or not anyone thought about it - which is what "by construction" means here.
 *
 * The reading discipline is the one the contract validator already
 * establishes, for the same reasons: values arriving here are assembled from
 * adapter output, so every property is taken through `ownDataProperty` (an
 * accessor is described, never invoked; an inherited property is never
 * mistaken for an own one; the value taken is the value used), records are
 * classified by prototype rather than by `typeof`, and every reflective trap
 * that can throw for a hostile proxy is contained. This module does not import
 * the validator: the two answer different questions, and neither should be
 * able to drift the other.
 */

import { ownDataProperty } from '../../runtime/own-property';
import { canonicalInstant } from './instant';
import { canonicalNumber } from './number';
import { compareUtf8 } from './ordering';
import {
  canonicalAbsent,
  canonicalInvalid,
  canonicalNull,
  serializeCanonical,
  type CanonicalEntry,
  type CanonicalValue,
} from './serialize';

/**
 * How a list's order is treated.
 *
 * The policy is **per declaration**, never inferred from the values: ADR 0020
 * sorts an array only where its order carries no domain meaning, and no
 * heuristic can tell a classification order from an incidental one by looking
 * at the elements.
 */
export type CanonicalListOrder =
  /** The order is content. A permutation is a different revision. */
  | { readonly kind: 'semantic' }
  /** Scalar members with no domain order; sorted by their own canonical form. */
  | { readonly kind: 'self' }
  /** Object members with no domain order; sorted by one identifying property. */
  | { readonly kind: 'field'; readonly key: string };

export type CanonicalSpec =
  | { readonly kind: 'string'; readonly nullable: boolean }
  | { readonly kind: 'number'; readonly nullable: boolean }
  | { readonly kind: 'boolean'; readonly nullable: boolean }
  | { readonly kind: 'instant'; readonly nullable: boolean }
  | {
      readonly kind: 'object';
      readonly nullable: boolean;
      readonly fields: readonly CanonicalFieldSpec[];
    }
  | {
      readonly kind: 'list';
      readonly nullable: boolean;
      readonly item: CanonicalSpec;
      readonly order: CanonicalListOrder;
    };

export interface CanonicalFieldSpec {
  readonly key: string;
  readonly spec: CanonicalSpec;
  /**
   * `true` only where `contract/types.ts` declares the property with `?`.
   *
   * ADR 0020 normalizes absent and explicitly `null` onto one representation
   * for exactly those properties, so a provider switching between the two is
   * not a false revision change. A **required** property keeps the
   * distinction: absent is a contract violation, not a null, and collapsing
   * the two would let a truncated payload share a revision with a complete
   * one.
   */
  readonly optional?: boolean;
}

export const text = (): CanonicalSpec => ({ kind: 'string', nullable: false });
export const nullableText = (): CanonicalSpec => ({
  kind: 'string',
  nullable: true,
});
export const numeric = (): CanonicalSpec => ({
  kind: 'number',
  nullable: false,
});
export const nullableNumeric = (): CanonicalSpec => ({
  kind: 'number',
  nullable: true,
});
export const flag = (): CanonicalSpec => ({ kind: 'boolean', nullable: false });
export const nullableFlag = (): CanonicalSpec => ({
  kind: 'boolean',
  nullable: true,
});
/**
 * Only the nullable form exists: every RFC 3339 `date-time` in the public
 * payload - the two `Session` boundaries - is declared `| null`, and a builder
 * with no declaration to serve would be a shape nothing has agreed on.
 */
export const nullableInstant = (): CanonicalSpec => ({
  kind: 'instant',
  nullable: true,
});

export const object = (
  fields: readonly CanonicalFieldSpec[],
): CanonicalSpec => ({ kind: 'object', nullable: false, fields });
export const nullableObject = (
  fields: readonly CanonicalFieldSpec[],
): CanonicalSpec => ({ kind: 'object', nullable: true, fields });

/** A list whose order is part of the content: rounds, positions, sessions. */
export const orderedList = (item: CanonicalSpec): CanonicalSpec => ({
  kind: 'list',
  nullable: false,
  item,
  order: { kind: 'semantic' },
});
export const nullableOrderedList = (item: CanonicalSpec): CanonicalSpec => ({
  kind: 'list',
  nullable: true,
  item,
  order: { kind: 'semantic' },
});

/** A list with no domain order, sorted by a stable GridView identity. */
export const unorderedList = (
  item: CanonicalSpec,
  identity: CanonicalListOrder,
): CanonicalSpec => ({ kind: 'list', nullable: false, item, order: identity });
export const nullableUnorderedList = (
  item: CanonicalSpec,
  identity: CanonicalListOrder,
): CanonicalSpec => ({ kind: 'list', nullable: true, item, order: identity });

/** Sorted by each member's own canonical form. */
export const byValue: CanonicalListOrder = { kind: 'self' };
/** Sorted by one identifying property of each member. */
export const byField = (key: string): CanonicalListOrder => ({
  kind: 'field',
  key,
});

/**
 * Projects one untrusted value onto its declared shape.
 *
 * Total and non-throwing: every value has an image, including the ones that do
 * not fit the declaration. A mismatch becomes a bounded `invalid` marker
 * carrying the *kind* of mismatch and never the value, so a wrong-typed
 * payload still contributes to the revision - it just cannot contribute
 * unbounded content to it.
 */
export function projectCanonical(
  spec: CanonicalSpec,
  value: unknown,
): CanonicalValue {
  // `undefined` is not representable in JSON, so a stored document can never
  // hold one; where an in-memory value does, it is the same fact as a property
  // that is not there.
  if (value === undefined) return canonicalAbsent;
  if (value === null) {
    return spec.nullable ? canonicalNull : canonicalInvalid('type');
  }

  switch (spec.kind) {
    case 'string':
      return typeof value === 'string'
        ? { kind: 'string', value }
        : canonicalInvalid('type');
    case 'boolean':
      return typeof value === 'boolean'
        ? { kind: 'boolean', value }
        : canonicalInvalid('type');
    case 'number': {
      if (typeof value !== 'number') return canonicalInvalid('type');
      const canonical = canonicalNumber(value);
      return canonical === null
        ? canonicalInvalid('non-finite')
        : { kind: 'number', text: canonical };
    }
    case 'instant': {
      if (typeof value !== 'string') return canonicalInvalid('type');
      const canonical = canonicalInstant(value);
      // A value the contract would reject still has to hash *as itself*, so a
      // malformed timestamp stays an opaque string. The tags differ, so it can
      // never collide with a canonicalized instant.
      return canonical === null
        ? { kind: 'string', value }
        : { kind: 'instant', value: canonical };
    }
    case 'object':
      return projectObject(spec.fields, value);
    case 'list':
      return projectList(spec, value);
  }
}

/**
 * Whether a value is an **ordinary record**, decided by its prototype.
 *
 * "Not null and not an array" accepts a `Date`, a `Map`, a boxed primitive and
 * every class instance, each of which would then be read as a record with no
 * declared properties - producing the same canonical image as an empty object
 * and letting two different payloads share a revision. Identity against two
 * known prototypes is used rather than `instanceof`, which walks the chain and
 * consults `Symbol.hasInstance`, i.e. code the value supplies.
 */
function asRecord(value: object): object | null | 'unreadable' {
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
  } catch {
    return 'unreadable';
  }
  return prototype === Object.prototype || prototype === null ? value : null;
}

/**
 * The outcome of classifying whether a value is an array, contained the same
 * way every other reflective read in this module is: a revoked `Proxy` makes
 * `Array.isArray` itself throw (`Cannot perform 'IsArray' on a proxy that has
 * been revoked`), which is not a trap the proxy's handler controls but is
 * still a throw a hostile or merely-torn-down value can produce. Centralized
 * here so `projectObject` and `projectList` - the two callers that must tell
 * an array from a record before doing anything else - apply the same
 * containment instead of each guarding it independently.
 */
type ArrayClassification =
  | { readonly kind: 'array'; readonly value: readonly unknown[] }
  | { readonly kind: 'not-array' }
  | { readonly kind: 'unreadable' };

function classifyArray(value: unknown): ArrayClassification {
  try {
    if (Array.isArray(value)) return { kind: 'array', value };
    return { kind: 'not-array' };
  } catch {
    return { kind: 'unreadable' };
  }
}

function projectObject(
  fields: readonly CanonicalFieldSpec[],
  value: unknown,
): CanonicalValue {
  if (typeof value !== 'object' || value === null) {
    return canonicalInvalid('type');
  }
  const classification = classifyArray(value);
  if (classification.kind === 'unreadable')
    return canonicalInvalid('unreadable');
  if (classification.kind === 'array') return canonicalInvalid('type');
  const record = asRecord(value);
  if (record === 'unreadable') return canonicalInvalid('unreadable');
  if (record === null) return canonicalInvalid('type');

  const entries: CanonicalEntry[] = [];
  for (const field of fields) {
    entries.push({ key: field.key, value: readField(record, field) });
  }
  return { kind: 'object', entries };
}

function readField(record: object, field: CanonicalFieldSpec): CanonicalValue {
  let taken: { readonly value: unknown } | null;
  try {
    taken = ownDataProperty(record, field.key);
  } catch {
    return canonicalInvalid('unreadable');
  }
  if (taken === null || taken.value === undefined) {
    // Only a property the contract declares with `?` collapses onto null.
    return field.optional ? canonicalNull : canonicalAbsent;
  }
  return projectCanonical(field.spec, taken.value);
}

function projectList(
  spec: Extract<CanonicalSpec, { kind: 'list' }>,
  value: unknown,
): CanonicalValue {
  const classification = classifyArray(value);
  if (classification.kind === 'unreadable')
    return canonicalInvalid('unreadable');
  if (classification.kind === 'not-array') return canonicalInvalid('type');
  const sourceArray = classification.value;

  let length: { readonly value: unknown } | null;
  try {
    length = ownDataProperty(sourceArray, 'length');
  } catch {
    return canonicalInvalid('unreadable');
  }
  if (length === null || typeof length.value !== 'number') {
    return canonicalInvalid('unreadable');
  }

  const items: CanonicalValue[] = [];
  for (let index = 0; index < length.value; index += 1) {
    let element: { readonly value: unknown } | null;
    try {
      element = ownDataProperty(sourceArray, String(index));
    } catch {
      items.push(canonicalInvalid('unreadable'));
      continue;
    }
    // A hole in a sparse array is not a member with a value; it reads as the
    // same absence a missing property does.
    items.push(
      element === null
        ? canonicalAbsent
        : projectCanonical(spec.item, element.value),
    );
  }

  return {
    kind: 'list',
    items: spec.order.kind === 'semantic' ? items : sorted(items, spec.order),
  };
}

/**
 * Orders the members of an unordered list.
 *
 * The sort key comes from the **projected** member, not from the raw value, so
 * it is derived from the same canonical form the digest will see. The full
 * serialization is the tie-breaker, which makes the order total even when two
 * members share an identity - a duplicate must not make the result depend on
 * the input order the sort was supposed to remove.
 */
function sorted(
  items: readonly CanonicalValue[],
  order: Exclude<CanonicalListOrder, { kind: 'semantic' }>,
): CanonicalValue[] {
  const keyed = items.map((item) => ({
    item,
    identity: identityOf(item, order),
    full: serializeCanonical(item),
  }));
  keyed.sort(
    (left, right) =>
      compareUtf8(left.identity, right.identity) ||
      compareUtf8(left.full, right.full),
  );
  return keyed.map((entry) => entry.item);
}

function identityOf(
  item: CanonicalValue,
  order: Exclude<CanonicalListOrder, { kind: 'semantic' }>,
): string {
  if (order.kind === 'self') return serializeCanonical(item);
  if (item.kind !== 'object') return serializeCanonical(item);
  const entry = item.entries.find((candidate) => candidate.key === order.key);
  return entry === undefined
    ? serializeCanonical(item)
    : serializeCanonical(entry.value);
}
