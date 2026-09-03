/**
 * The canonical value model and its serialization.
 *
 * A projection (`schema.ts`) turns an untrusted payload into one of these
 * values; this module turns that value into the exact text whose UTF-8 bytes
 * are hashed. Splitting the two is what makes the format testable: a
 * projection can be checked for *what it read*, and the serialization for
 * *how it wrote it*, without either having to reason about the other.
 *
 * **The framing is length-prefixed, not delimited.** Every string carries its
 * UTF-8 byte length, so no value can be confused with the structure around it:
 * there is no escape sequence to get wrong, no delimiter a payload could
 * contain, and no pair of distinct canonical values that serializes to the
 * same text. A JSON-shaped format would have needed an escaping rule, and an
 * escaping rule is one more thing two implementations could disagree about.
 *
 * The grammar, in full:
 *
 * ```text
 * null            n
 * absent          ?          a required property that is not present
 * invalid         !<len>:<reason>
 * boolean         t | f
 * number          #<len>:<canonical decimal>
 * string          s<len>:<raw string>
 * instant         i<len>:<canonical RFC 3339 UTC>
 * list            [ <value>* ]
 * object          { (k<len>:<key> <value>)* }        keys in canonical order
 * ```
 */

import { compareUtf8, utf8ByteLength } from './ordering';

/**
 * Why a value has no canonical form.
 *
 * A **closed** vocabulary, and deliberately so: these tokens are hashed, and a
 * reason derived from the value itself - a message, a key name, a stringified
 * exception - would put untrusted content of unbounded size into the digest
 * input. What the token records is the *kind* of failure, never the value.
 */
export const canonicalInvalidReasons = [
  /** Present, but not the type the schema declares. */
  'type',
  /** A number that is not finite, so it has no canonical spelling. */
  'non-finite',
  /** Nothing about the value could be established without running its code. */
  'unreadable',
  /** No schema is declared for this snapshot key. */
  'unsupported',
] as const;

export type CanonicalInvalidReason = (typeof canonicalInvalidReasons)[number];

export type CanonicalValue =
  | { readonly kind: 'null' }
  | { readonly kind: 'absent' }
  | { readonly kind: 'invalid'; readonly reason: CanonicalInvalidReason }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'number'; readonly text: string }
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'instant'; readonly value: string }
  | { readonly kind: 'list'; readonly items: readonly CanonicalValue[] }
  | { readonly kind: 'object'; readonly entries: readonly CanonicalEntry[] };

export interface CanonicalEntry {
  readonly key: string;
  readonly value: CanonicalValue;
}

export const canonicalNull: CanonicalValue = { kind: 'null' };
export const canonicalAbsent: CanonicalValue = { kind: 'absent' };

export function canonicalInvalid(
  reason: CanonicalInvalidReason,
): CanonicalValue {
  return { kind: 'invalid', reason };
}

/**
 * The canonical text for one value.
 *
 * Iterative over the entries of each object and each list, and recursive over
 * nesting - which is bounded statically, because the only nesting that exists
 * is the nesting a declared schema describes.
 */
export function serializeCanonical(value: CanonicalValue): string {
  switch (value.kind) {
    case 'null':
      return 'n';
    case 'absent':
      return '?';
    case 'invalid':
      return framed('!', value.reason);
    case 'boolean':
      return value.value ? 't' : 'f';
    case 'number':
      return framed('#', value.text);
    case 'string':
      return framed('s', value.value);
    case 'instant':
      return framed('i', value.value);
    case 'list':
      return `[${value.items.map(serializeCanonical).join('')}]`;
    case 'object': {
      // Sorted here rather than trusting the projection's order, so the
      // ordering rule holds for every object the format can express - and one
      // comparator decides it, in one place.
      const entries = [...value.entries].sort((left, right) =>
        compareUtf8(left.key, right.key),
      );
      const body = entries
        .map(
          (entry) =>
            `${framed('k', entry.key)}${serializeCanonical(entry.value)}`,
        )
        .join('');
      return `{${body}}`;
    }
  }
}

/** `<tag><utf-8 byte length>:<text>`. */
function framed(tag: string, text: string): string {
  return `${tag}${utf8ByteLength(text)}:${text}`;
}
