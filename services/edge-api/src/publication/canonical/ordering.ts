/**
 * Deterministic UTF-8 encoding and the canonical key order.
 *
 * ADR 0020 D1.7 states the ordering as **lexicographic UTF-8 code-point
 * order**. JavaScript's default string comparison is not that order, and the
 * difference is not academic: `<`, `Array.prototype.sort` and
 * `String.prototype.localeCompare` all compare UTF-16 code *units*, so a
 * supplementary code point - stored as a surrogate pair whose leading unit
 * lies in U+D800-U+DBFF - sorts *below* ordinary BMP characters above U+DFFF.
 * Two Workers agreeing on the rule but disagreeing on the comparator would
 * produce two different revisions for one payload.
 *
 * Comparing the encoded bytes **is** the documented rule rather than an
 * approximation of it: UTF-8 byte order and Unicode code-point order coincide
 * for every well-formed string, by construction of the encoding.
 *
 * **A lone surrogate is not well-formed, and `TextEncoder` does not reject
 * it.** A normalized JSON string can carry an unpaired UTF-16 surrogate
 * (U+D800-U+DFFF with no matching partner), and `TextEncoder` silently
 * replaces every one of them with U+FFFD - the same three bytes regardless of
 * *which* lone surrogate it was. Comparing or hashing the raw `TextEncoder`
 * output would therefore make `'\uD800'`, `'\uD801'` and a literal `'�'`
 * indistinguishable: three different strings, one digest. `canonicalizeString`
 * closes that gap by rewriting a value **before** it ever reaches
 * `TextEncoder`, so what gets encoded is always well-formed and the encoding
 * step stays a faithful, injective one.
 */

/**
 * One encoder for the whole module.
 *
 * `TextEncoder` is stateless and always emits UTF-8, so a shared instance is
 * deterministic. It is the same encoder the digest uses, which is what makes
 * "ordered by the bytes that are hashed" literally true.
 */
const encoder = new TextEncoder();

/** The UTF-8 bytes of one string. Never throws. */
export function encodeUtf8(value: string): Uint8Array {
  return encoder.encode(value);
}

/**
 * The length of one string **in UTF-8 bytes**.
 *
 * Not `String.prototype.length`, which counts UTF-16 units: an emoji is one
 * code point, two units and four bytes. The canonical serialization frames
 * every string with this figure, so using the UTF-16 count would desynchronize
 * the frame from the bytes it describes.
 */
export function utf8ByteLength(value: string): number {
  return encoder.encode(value).length;
}

/** The UTF-16 code unit range reserved for high (lead) surrogates. */
const HIGH_SURROGATE_START = 0xd800;
const HIGH_SURROGATE_END = 0xdbff;
/** The UTF-16 code unit range reserved for low (trail) surrogates. */
const LOW_SURROGATE_START = 0xdc00;
const LOW_SURROGATE_END = 0xdfff;
/** `\`, the one character the escape scheme must itself escape. */
const BACKSLASH = 0x5c;

function isHighSurrogate(unit: number): boolean {
  return unit >= HIGH_SURROGATE_START && unit <= HIGH_SURROGATE_END;
}

function isLowSurrogate(unit: number): boolean {
  return unit >= LOW_SURROGATE_START && unit <= LOW_SURROGATE_END;
}

/**
 * Rewrites a string so it is well-formed - no unpaired UTF-16 surrogate -
 * **before** anything encodes it, and does so injectively: distinct inputs
 * always produce distinct output text.
 *
 * Two things are escaped, both with a single, unescaped `\` as the marker:
 *
 * - a lone surrogate becomes `\uXXXX`, its own code unit spelled out in hex,
 *   so `'\uD800'` and `'\uD801'` produce visibly different escapes and
 *   neither collides with a literal U+FFFD, which is not a surrogate and is
 *   never touched by this function;
 * - a literal `\` becomes `\\`, which is what keeps the scheme injective: an
 *   escape token always begins with an **unescaped** `\`, and no literal
 *   backslash in the input can ever produce one. Literal text that already
 *   looks like an escape - the six characters `\`, `u`, `D`, `8`, `0`, `0` -
 *   has its backslash doubled and comes out as `\\uD800`, which cannot be
 *   confused with the single-backslash escape of an actual lone surrogate.
 *
 * A valid surrogate pair is left untouched, as the two code units it already
 * is, so it keeps encoding to the one Unicode scalar value it names - this
 * function only ever removes ill-formedness, never meaning from well-formed
 * text.
 *
 * Applied to every raw string and key before it is framed, so the length
 * `utf8ByteLength` records is always the length of the bytes that are
 * actually hashed.
 */
export function canonicalizeString(value: string): string {
  let out = '';
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit === BACKSLASH) {
      out += '\\\\';
      continue;
    }
    if (isHighSurrogate(unit)) {
      const next = index + 1 < value.length ? value.charCodeAt(index + 1) : NaN;
      if (isLowSurrogate(next)) {
        // A genuine pair: keep both units verbatim and skip the one already
        // consumed, so it still encodes as its one supplementary scalar.
        out += value.slice(index, index + 2);
        index += 1;
        continue;
      }
      out += `\\u${unit.toString(16).padStart(4, '0')}`;
      continue;
    }
    if (isLowSurrogate(unit)) {
      // Reaching this branch means it was not the second half of a pair just
      // consumed above, so it is unpaired on its own.
      out += `\\u${unit.toString(16).padStart(4, '0')}`;
      continue;
    }
    out += value.charAt(index);
  }
  return out;
}

/**
 * Compares two strings in canonical order: byte-wise over the UTF-8 form of
 * their **canonicalized** text, with a prefix ordering before the string that
 * extends it.
 *
 * Comparing the raw `TextEncoder` output would return `0` for two distinct
 * lone surrogates, which are equal once both collapse to U+FFFD; comparing
 * the canonicalized form keeps them distinct, so this returns `0` only when
 * `left === right`.
 *
 * Returns a negative number, zero or a positive number, so it can be handed
 * straight to `Array.prototype.sort`.
 */
export function compareUtf8(left: string, right: string): number {
  const a = encoder.encode(canonicalizeString(left));
  const b = encoder.encode(canonicalizeString(right));
  const shared = Math.min(a.length, b.length);
  for (let index = 0; index < shared; index += 1) {
    // Within `shared`, both reads are in range; the assertions record that
    // rather than inventing a fallback byte a comparison could act on.
    const difference = (a[index] as number) - (b[index] as number);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}
