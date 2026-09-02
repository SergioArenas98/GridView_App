/**
 * Reading an untrusted object against a **closed** field list.
 *
 * Two rules live here, and they are the reason a validator can be trusted with
 * an adapter's object at all.
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
 * value validated is the value taken. Both reflective traps can throw for a
 * hostile proxy, so both are contained here.
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

function isPlainObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    if (!isPlainObject(value)) return collector.add(path, 'type');

    let keys: (string | symbol)[];
    try {
      keys = Reflect.ownKeys(value);
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
        taken = ownDataProperty(value, field.key);
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
