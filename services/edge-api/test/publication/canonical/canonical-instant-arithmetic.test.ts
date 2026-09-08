import { describe, expect, it } from 'vitest';

import {
  boundedInstant,
  compareInstants,
  instantPlusMillisecond,
} from '../../../src/publication/canonical/instant';

/**
 * Exact ordering and bounded one-millisecond arithmetic over the RFC 3339
 * domain `canonicalInstant` accepts (ADR 0025 D4, "make sequencer instant
 * handling total").
 *
 * `Date.parse` / `Date#getTime` / `new Date(number)` are the values under
 * replacement: they return `NaN` for a leap second and silently truncate
 * sub-millisecond precision, so they can neither order nor bump a value this
 * contract calls valid.
 */
describe('compareInstants', () => {
  it('treats equivalent spellings of one instant as equal', () => {
    for (const [a, b] of [
      ['2026-07-18T12:00:00Z', '2026-07-18T12:00:00.000Z'],
      ['2026-07-18T14:00:00+02:00', '2026-07-18T12:00:00Z'],
      ['2026-07-18T07:00:00-05:00', '2026-07-18T12:00:00Z'],
      ['2026-07-18T12:00:00.100Z', '2026-07-18T12:00:00.1Z'],
      ['2026-07-18t12:00:00z', '2026-07-18T12:00:00Z'],
    ]) {
      expect(compareInstants(a!, b!)).toBe(0);
      expect(compareInstants(b!, a!)).toBe(0);
    }
  });

  it('orders distinct fractional values beyond the millisecond', () => {
    expect(
      compareInstants('2026-07-18T12:00:00.0001Z', '2026-07-18T12:00:00.0002Z'),
    ).toBe(-1);
    expect(
      compareInstants(
        '2026-07-18T12:00:00.1234567890123Z',
        '2026-07-18T12:00:00.1234567890124Z',
      ),
    ).toBe(-1);
    // A longer fraction that is only trailing zeros is still equal.
    expect(
      compareInstants('2026-07-18T12:00:00.5Z', '2026-07-18T12:00:00.5000Z'),
    ).toBe(0);
  });

  it('does not collapse a leap second onto the following ordinary second', () => {
    expect(
      compareInstants('2016-12-31T23:59:60Z', '2017-01-01T00:00:00Z'),
    ).toBe(-1);
    expect(
      compareInstants('2016-12-31T23:59:60Z', '2016-12-31T23:59:59Z'),
    ).toBe(1);
    expect(
      compareInstants('2016-12-31T23:59:60Z', '2016-12-31T23:59:59.999Z'),
    ).toBe(1);
  });

  it('returns null when either value is outside the accepted domain', () => {
    expect(compareInstants('2026-07-18', '2026-07-18T12:00:00Z')).toBeNull();
    expect(compareInstants('2026-07-18T12:00:00Z', 'nope')).toBeNull();
  });
});

describe('instantPlusMillisecond', () => {
  it('advances an ordinary second', () => {
    expect(instantPlusMillisecond('2026-01-01T00:00:00Z')).toBe(
      '2026-01-01T00:00:00.001Z',
    );
    expect(instantPlusMillisecond('2026-01-01T00:00:00.004Z')).toBe(
      '2026-01-01T00:00:00.005Z',
    );
  });

  it('advances a fractional value, carrying any sub-millisecond tail untouched', () => {
    expect(instantPlusMillisecond('2026-01-01T00:00:00.1234Z')).toBe(
      '2026-01-01T00:00:00.1244Z',
    );
    expect(instantPlusMillisecond('2026-01-01T00:00:00.999999Z')).toBe(
      '2026-01-01T00:00:01.000999Z',
    );
  });

  it('rolls a leap second to :00 of the next minute, never to :61', () => {
    expect(instantPlusMillisecond('1998-12-31T23:59:60Z')).toBe(
      '1998-12-31T23:59:60.001Z',
    );
    expect(instantPlusMillisecond('1998-12-31T23:59:60.999Z')).toBe(
      '1999-01-01T00:00:00Z',
    );
  });

  it('carries an end-of-minute, day, month and year rollover', () => {
    expect(instantPlusMillisecond('2026-01-01T00:00:59.999Z')).toBe(
      '2026-01-01T00:01:00Z',
    );
    expect(instantPlusMillisecond('2026-01-31T23:59:59.999Z')).toBe(
      '2026-02-01T00:00:00Z',
    );
    expect(instantPlusMillisecond('2026-12-31T23:59:59.999Z')).toBe(
      '2027-01-01T00:00:00Z',
    );
  });

  it('fails closed rather than leaving the representable year range', () => {
    expect(instantPlusMillisecond('9999-12-31T23:59:59.999Z')).toBeNull();
    expect(instantPlusMillisecond('not-a-timestamp')).toBeNull();
  });

  it('produces a value strictly greater than its input', () => {
    for (const value of [
      '2026-01-01T00:00:00Z',
      '2026-01-01T00:00:00.999Z',
      '2020-06-30T23:59:60Z',
      '2020-06-30T23:59:60.500Z',
      '2020-01-01T00:00:00.000123456Z',
    ]) {
      const bumped = instantPlusMillisecond(value);
      expect(bumped).not.toBeNull();
      expect(compareInstants(bumped as string, value)).toBe(1);
    }
  });
});

describe('boundedInstant', () => {
  it('returns the raw ISO spelling for a Date in the four-digit year range', () => {
    expect(boundedInstant(new Date('2026-09-02T00:00:00.000Z'))).toBe(
      '2026-09-02T00:00:00.000Z',
    );
    // The trailing `.000` is kept, not canonicalized away.
    expect(boundedInstant(new Date('9999-12-31T23:59:59.999Z'))).toBe(
      '9999-12-31T23:59:59.999Z',
    );
  });

  it('returns null for a non-finite Date rather than throwing', () => {
    expect(boundedInstant(new Date('not a date'))).toBeNull();
    expect(boundedInstant(new Date(Number.NaN))).toBeNull();
  });

  it('returns null for a finite Date whose ISO spelling is an extended year', () => {
    // `new Date(8.64e15)` is the maximum valid Date - year 275760.
    const farFuture = new Date(8.64e15);
    expect(Number.isFinite(farFuture.getTime())).toBe(true);
    expect(farFuture.toISOString()).toMatch(/^\+\d{6}-/);
    expect(boundedInstant(farFuture)).toBeNull();
    // And one just past year 9999.
    expect(boundedInstant(new Date('+010000-01-01T00:00:00.000Z'))).toBeNull();
  });
});
