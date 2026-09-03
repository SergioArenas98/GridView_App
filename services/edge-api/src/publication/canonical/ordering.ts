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
 * for every well-formed string, by construction of the encoding. It also
 * settles the one case a code-point comparator has to special-case - a lone
 * surrogate, which `TextEncoder` replaces with U+FFFD - because the comparison
 * then sees exactly the bytes the digest will.
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

/**
 * Compares two strings in canonical order: byte-wise over their UTF-8 forms,
 * with a prefix ordering before the string that extends it.
 *
 * Returns a negative number, zero or a positive number, so it can be handed
 * straight to `Array.prototype.sort`.
 */
export function compareUtf8(left: string, right: string): number {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const shared = Math.min(a.length, b.length);
  for (let index = 0; index < shared; index += 1) {
    // Within `shared`, both reads are in range; the assertions record that
    // rather than inventing a fallback byte a comparison could act on.
    const difference = (a[index] as number) - (b[index] as number);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}
