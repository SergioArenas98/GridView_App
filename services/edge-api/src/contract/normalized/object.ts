/**
 * Reading an untrusted object against a **closed** field list.
 *
 * Three rules live here, and they are the reason a validator can be trusted
 * with an adapter's object at all.
 *
 * **An ordinary record, decided by prototype.** "Not null and not an array" is
 * a weaker question than "is this a record the contract could describe", and
 * the difference is what `classifyRecord` below exists to close.
 *
 * **Closed, not tolerant.** An undeclared own property is refused. The
 * tolerant-consumer note in `contract/parse.ts` describes the *reading*
 * direction - a client ignoring a future server's additive fields - and this is
 * the *producing* direction. `snapshots/generator.ts` carries a normalized
 * entity into `driver:{id}`, `constructor:{id}`, `circuit:{id}`,
 * `grand-prix:{round}`, `grand-prix:{round}:results`, `standings:*`, `home` and
 * `bootstrap` **verbatim**, with no field projection, and season assembly
 * copies collections shallowly, so an undeclared property is not a harmless
 * extra: it is provider-controlled content published unexamined. Provider
 * neutrality is binding, and a substring scan for one key name is not
 * containment.
 *
 * **Read once, never invoked.** Every declared field is taken through the
 * existing `ownDataProperty` discipline, so an accessor is described rather
 * than called, an inherited property is not mistaken for an own one, and the
 * value validated is the value taken. Every reflective trap this module
 * touches - `getPrototypeOf`, `ownKeys` and `getOwnPropertyDescriptor` - can
 * throw for a hostile proxy, so each is contained here.
 */

import { ownDataProperty } from '../../runtime/own-property';
import type { Check } from './values';

/** One declared property of a normalized entity. */
export interface Field {
  readonly key: string;
  readonly check: Check;
  /**
   * `true` only where `contract/types.ts` declares the property with `?`.
   *
   * The contract distinguishes "absent is allowed" (`?`) from "present, and may
   * be null" (`| null`), and states that absent optionals are represented as
   * null. Only `MediaVariants` uses the first form.
   */
  readonly optional?: boolean;
}

/**
 * How a value classifies as a normalized **record**.
 *
 * `unreadable` is separate from `not-a-record` because they are different
 * facts: one says the value is the wrong kind of thing, the other says nothing
 * about its kind could be established without running code it supplied.
 */
type RecordShape =
  /** Carries the narrowed value, so no caller has to assert it back. */
  | { readonly kind: 'record'; readonly record: object }
  | { readonly kind: 'not-a-record' }
  | { readonly kind: 'unreadable' };

/**
 * Whether a value is an **ordinary record**, decided by its prototype.
 *
 * "Not null and not an array" is a weaker question than "is this a record the
 * public contract could describe", and the gap is not academic: a `Date`, a
 * `Map`, a typed array, a boxed primitive and a class instance all pass the
 * weaker test. Where every declared property is optional - `MediaVariants` is
 * the only such object in the contract - an exotic with no own keys then
 * produces **no issue at all**, so it is selected, assembled and published as
 * whatever the storage encoding makes of it, which for a `Date` is a string
 * where the contract requires an object.
 *
 * So the prototype is the classifier, and it is deliberately **general** rather
 * than a guard bolted onto the one field that exposed it: every object the
 * validator inspects - an entity, a nested value object, a collection element,
 * the payload wrapper - goes through this one function.
 *
 * Two prototypes are accepted. `Object.prototype` is the ordinary literal.
 * `null` is accepted because the contract's own boundary tests require a
 * null-prototype record to be valid, and a null-prototype object is *safer*
 * than an ordinary one here, not more dangerous: it cannot inherit anything.
 *
 * **`instanceof` is deliberately not used.** It answers "is this prototype
 * anywhere on the chain", which accepts a subclass of `Object` - that is,
 * nearly every exotic - and it consults `Symbol.hasInstance`, which is code the
 * value can supply. An identity comparison against two known prototypes
 * consults nothing.
 *
 * `Object.getPrototypeOf` is a proxy trap and can throw, so it is contained
 * here rather than by the caller.
 */
function classifyRecord(value: unknown): RecordShape {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { kind: 'not-a-record' };
  }
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
  } catch {
    return { kind: 'unreadable' };
  }
  // Identity, not `instanceof`. Every value the validator sees at the
  // coordination boundary is same-realm - it is the coordinator's own
  // `structuredClone` snapshot - so a cross-realm `Object.prototype` is not a
  // case this has to answer for.
  return prototype === Object.prototype || prototype === null
    ? { kind: 'record', record: value }
    : { kind: 'not-a-record' };
}

/**
 * Validates one object against its declared fields.
 *
 * Undeclared keys are reported **before** the declared fields are read, so the
 * output order is the object's own closure failures followed by its field
 * failures, followed by anything nested. That ordering is what makes the result
 * deterministic for a given input.
 */
export function objectOf(fields: readonly Field[]): Check {
  const declared = new Set(fields.map((field) => field.key));
  return (value, path, collector) => {
    const shape = classifyRecord(value);
    if (shape.kind === 'unreadable') return collector.add(path, 'unreadable');
    if (shape.kind === 'not-a-record') return collector.add(path, 'type');
    const record = shape.record;

    let keys: (string | symbol)[];
    try {
      keys = Reflect.ownKeys(record);
    } catch {
      // A hostile `ownKeys` trap. Nothing about this object can be established,
      // so it is one bounded failure rather than a partial report.
      return collector.add(path, 'unreadable');
    }
    for (const key of keys) {
      if (collector.full) return;
      if (typeof key === 'string' && declared.has(key)) continue;
      // The key name is provider-controlled text, so the object's own path and
      // the kind of failure are all this reports.
      collector.add(path, 'unknown-property');
    }

    for (const field of fields) {
      if (collector.full) return;
      const at = `${path}.${field.key}`;
      let taken: { readonly value: unknown } | null;
      try {
        taken = ownDataProperty(record, field.key);
      } catch {
        collector.add(at, 'unreadable');
        continue;
      }
      if (taken === null) {
        if (!field.optional) collector.add(at, 'missing');
        continue;
      }
      field.check(taken.value, at, collector);
    }
  };
}

/** A nested object that may also be `null`. */
export function nullableObjectOf(fields: readonly Field[]): Check {
  const check = objectOf(fields);
  return (value, path, collector) => {
    if (value === null) return;
    check(value, path, collector);
  };
}
