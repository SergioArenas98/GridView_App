import { describe, expect, it } from 'vitest';

import { canonicalNumber } from '../../../src/publication/canonical/number';

/**
 * The canonical numeric form for `snapshotRevision` (ADR 0020 D1.7).
 *
 * One representation per value: no exponent, no negative zero, no
 * insignificant trailing zeros. Fractional championship points therefore hash
 * stably, and a magnitude that JavaScript happens to print in exponent
 * notation cannot produce a second spelling of the same number.
 */
describe('canonical numbers', () => {
  it('writes integers without a decimal point', () => {
    expect(canonicalNumber(0)).toBe('0');
    expect(canonicalNumber(1)).toBe('1');
    expect(canonicalNumber(-1)).toBe('-1');
    expect(canonicalNumber(2026)).toBe('2026');
    expect(canonicalNumber(Number.MAX_SAFE_INTEGER)).toBe('9007199254740991');
  });

  it('collapses negative zero onto zero', () => {
    expect(canonicalNumber(-0)).toBe('0');
    expect(canonicalNumber(-0)).toBe(canonicalNumber(0));
  });

  it('writes fractional values without trailing zeros', () => {
    expect(canonicalNumber(25.5)).toBe('25.5');
    expect(canonicalNumber(0.5)).toBe('0.5');
    expect(canonicalNumber(-18.25)).toBe('-18.25');
    // 25.50 and 25.5 are the same double, so they cannot be distinguished -
    // what matters is that the one they share is the trimmed spelling.
    expect(canonicalNumber(25.5)).toBe(canonicalNumber(25.5));
  });

  it('expands magnitudes JavaScript would print with an exponent', () => {
    expect(canonicalNumber(1e21)).toBe('1' + '0'.repeat(21));
    expect(canonicalNumber(-1e21)).toBe('-1' + '0'.repeat(21));
    expect(canonicalNumber(1.5e22)).toBe('15' + '0'.repeat(21));
    expect(canonicalNumber(1e-7)).toBe('0.0000001');
    expect(canonicalNumber(1.5e-7)).toBe('0.00000015');
    expect(canonicalNumber(-2.5e-8)).toBe('-0.000000025');
    for (const value of [1e21, 1e-7, 1.5e22, -2.5e-8, 5e-324]) {
      expect(canonicalNumber(value)).not.toMatch(/[eE]/);
    }
  });

  it('keeps distinct values distinct across the exponent boundary', () => {
    expect(canonicalNumber(1e21)).not.toBe(canonicalNumber(1.0000000000001e21));
    expect(canonicalNumber(1e-7)).not.toBe(canonicalNumber(2e-7));
  });

  it('refuses every non-finite value rather than inventing a spelling', () => {
    expect(canonicalNumber(Number.NaN)).toBeNull();
    expect(canonicalNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(canonicalNumber(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('round-trips back to the same double', () => {
    const values = [
      0, -0, 1, -1, 25.5, 0.1, 1e21, 1e-7, 1.5e-7, 9007199254740991, 5e-324,
      -3.4028234663852886e38,
    ];
    for (const value of values) {
      const text = canonicalNumber(value);
      expect(text).not.toBeNull();
      expect(Number(text)).toBe(value === 0 ? 0 : value);
    }
  });
});
