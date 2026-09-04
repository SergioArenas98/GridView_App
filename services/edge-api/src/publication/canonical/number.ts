/**
 * The canonical numeric form for `snapshotRevision` (ADR 0020 D1.7,
 * "Numbers").
 *
 * One spelling per value: integers without a decimal point, decimals in plain
 * positional notation, no exponent, no negative zero and no insignificant
 * trailing zeros. Fractional championship points therefore hash stably, and a
 * magnitude that JavaScript happens to print as `1e+21` cannot become a second
 * spelling of a number some other stage would print in full.
 *
 * `String(value)` is the starting point deliberately: it is the shortest
 * representation that round-trips back to the same double, which is exactly
 * the "no insignificant digits" property the ADR asks for. All this module
 * adds is the two normalizations `String` does not do - collapsing `-0` and
 * expanding the exponent notation it switches to outside
 * `[1e-6, 1e21)`.
 */

/**
 * The canonical text for one finite number, or `null` for a value that has no
 * canonical form.
 *
 * `NaN` and the infinities are refused rather than spelled: JSON cannot carry
 * them, so a payload holding one is not a public snapshot payload, and
 * inventing a token for it here would let two different non-finite values
 * share a revision. The caller decides what a refusal means.
 */
export function canonicalNumber(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  // `Object.is` rather than `value === 0`, because `-0 === 0` is true and the
  // whole point is to tell them apart before collapsing them.
  if (Object.is(value, -0)) return '0';

  const printed = String(value);
  if (!printed.includes('e') && !printed.includes('E')) {
    return trimFraction(printed);
  }
  return trimFraction(expandExponent(printed));
}

/**
 * Rewrites `1.5e-7` and `1e+21` in plain positional notation.
 *
 * The mantissa is shifted rather than re-derived, so no rounding happens here:
 * every digit `String` produced is a digit the result carries, in the same
 * order.
 */
function expandExponent(printed: string): string {
  const parts = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(printed);
  // Total by construction: only a value `String` printed with an exponent
  // reaches here, and that is the shape it prints. A value that somehow is not
  // is returned untouched rather than mangled.
  if (parts === null) return printed;
  const sign = parts[1] ?? '';
  const integerPart = parts[2] ?? '';
  const fractionPart = parts[3] ?? '';
  const exponent = Number(parts[4]);
  const digits = `${integerPart}${fractionPart}`;
  // Where the decimal point lands once the exponent has been applied. It may
  // fall left of the first digit or right of the last one, which are the two
  // cases that need padding.
  const point = integerPart.length + exponent;

  if (point <= 0) {
    return `${sign}0.${'0'.repeat(-point)}${digits}`;
  }
  if (point >= digits.length) {
    return `${sign}${digits}${'0'.repeat(point - digits.length)}`;
  }
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/** Drops trailing zeros in the fraction, and the point left behind by them. */
function trimFraction(printed: string): string {
  if (!printed.includes('.')) return printed;
  const trimmed = printed.replace(/0+$/, '').replace(/\.$/, '');
  // `-0.0` would trim to `-0`, which is the one spelling this module exists to
  // remove.
  return trimmed === '-0' ? '0' : trimmed;
}
