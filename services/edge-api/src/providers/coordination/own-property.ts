/**
 * Reading one **own data property** of an untrusted object, without running
 * any code the object supplied.
 *
 * Every runtime boundary in this package - the plan, a resource identity, a
 * recorded provisional bound and an adapter outcome - decides what a value
 * *is* before deciding what it *means*, and all four need the same primitive:
 * take a declared field exactly once, in a way that cannot invoke a getter,
 * cannot walk a prototype chain and cannot answer differently on a second
 * call. One implementation, so the rule those boundaries document is the rule
 * they all actually apply.
 */

/**
 * The value of one **own data property**, or `null` when the key is absent,
 * inherited, or present as an accessor.
 *
 * A descriptor rather than a property read, for three reasons:
 *
 * - A plain read walks the prototype chain, so an object could supply a
 *   declared field it does not actually own.
 * - A descriptor **describes** an accessor without invoking it, so a getter is
 *   refused rather than executed: it cannot throw from here, cannot run
 *   foreign code merely because a shape was being checked, and cannot answer
 *   one value to validation and another to whoever consumes the field later.
 * - Taking the value once, here, is what makes "read once" true. A caller that
 *   validates a descriptor's value and then reads the property again has
 *   validated a different moment than it used.
 *
 * A data descriptor's `value` is inert - reading it runs nothing - so taking it
 * here is not a value read in the sense the ordering rule cares about. What
 * the value *means* is still decided afterwards, by the caller.
 *
 * `Object.getOwnPropertyDescriptor` is itself a proxy trap, so it can still
 * throw for a hostile object. Containing that is the caller's job, exactly as
 * it already is for `Reflect.ownKeys` and `in`.
 */
export function ownDataProperty(
  target: object,
  key: string,
): { readonly value: unknown } | null {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor === undefined) return null;
  if (!('value' in descriptor)) return null;
  return { value: descriptor.value };
}
