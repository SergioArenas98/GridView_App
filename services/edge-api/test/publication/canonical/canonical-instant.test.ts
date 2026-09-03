import { describe, expect, it } from 'vitest';

import { canonicalInstant } from '../../../src/publication/canonical/instant';

/**
 * RFC 3339 canonicalization for `snapshotRevision` (ADR 0020 D1.7, "Dates").
 *
 * Two properties have to hold at once, and they pull in opposite directions:
 *
 * - **Equivalent instants must hash identically.** A provider that switches
 *   from `+02:00` to `Z`, from `T` to `t`, or from `.000` to no fraction has
 *   not changed the content.
 * - **Distinct instants must stay distinct.** Phase 9B-5 accepts unbounded
 *   fractional precision, so nothing here may truncate to the millisecond the
 *   publication clock happens to use.
 *
 * `Date.parse` / `new Date` are deliberately not used: they silently roll a
 * leap second into the following minute, which would collapse two different
 * valid instants onto one revision.
 */
describe('canonical instants', () => {
  it('normalizes the case of the time and zone designators', () => {
    const canonical = '2026-07-18T12:00:00Z';
    expect(canonicalInstant('2026-07-18T12:00:00Z')).toBe(canonical);
    expect(canonicalInstant('2026-07-18t12:00:00z')).toBe(canonical);
    expect(canonicalInstant('2026-07-18T12:00:00z')).toBe(canonical);
  });

  it('converts a numeric offset to the equivalent UTC instant', () => {
    const canonical = '2026-07-18T12:00:00Z';
    expect(canonicalInstant('2026-07-18T14:00:00+02:00')).toBe(canonical);
    expect(canonicalInstant('2026-07-18T07:00:00-05:00')).toBe(canonical);
    expect(canonicalInstant('2026-07-18T12:30:00+00:30')).toBe(canonical);
  });

  it('carries an offset across a day, month and year boundary', () => {
    expect(canonicalInstant('2026-01-01T00:30:00+01:00')).toBe(
      '2025-12-31T23:30:00Z',
    );
    expect(canonicalInstant('2025-12-31T23:30:00-01:00')).toBe(
      '2026-01-01T00:30:00Z',
    );
    expect(canonicalInstant('2024-03-01T00:15:00+01:00')).toBe(
      '2024-02-29T23:15:00Z',
    );
  });

  it('treats an all-zero fraction as no fraction', () => {
    expect(canonicalInstant('2026-07-18T12:00:00.000Z')).toBe(
      '2026-07-18T12:00:00Z',
    );
    expect(canonicalInstant('2026-07-18T12:00:00.0Z')).toBe(
      '2026-07-18T12:00:00Z',
    );
    expect(canonicalInstant('2026-07-18T12:00:00.000000000000Z')).toBe(
      '2026-07-18T12:00:00Z',
    );
  });

  it('strips only insignificant trailing zeros from the fraction', () => {
    expect(canonicalInstant('2026-07-18T12:00:00.100Z')).toBe(
      '2026-07-18T12:00:00.1Z',
    );
    expect(canonicalInstant('2026-07-18T12:00:00.1Z')).toBe(
      '2026-07-18T12:00:00.1Z',
    );
    expect(canonicalInstant('2026-07-18T12:00:00.120Z')).toBe(
      '2026-07-18T12:00:00.12Z',
    );
  });

  it('preserves arbitrary fractional precision without truncating', () => {
    expect(canonicalInstant('2026-07-18T12:00:00.000123456789Z')).toBe(
      '2026-07-18T12:00:00.000123456789Z',
    );
    // Sub-millisecond neighbours must not share a revision.
    expect(canonicalInstant('2026-07-18T12:00:00.0001Z')).not.toBe(
      canonicalInstant('2026-07-18T12:00:00.0002Z'),
    );
    expect(canonicalInstant('2026-07-18T12:00:00.1234567890123Z')).toBe(
      '2026-07-18T12:00:00.1234567890123Z',
    );
  });

  it('preserves a leap second instead of rolling it into the next minute', () => {
    expect(canonicalInstant('2016-12-31T23:59:60Z')).toBe(
      '2016-12-31T23:59:60Z',
    );
    expect(canonicalInstant('2016-12-31T23:59:60Z')).not.toBe(
      canonicalInstant('2017-01-01T00:00:00Z'),
    );
    // The offset shifts whole minutes only, so the second is untouched.
    expect(canonicalInstant('2016-12-31T15:59:60-08:00')).toBe(
      '2016-12-31T23:59:60Z',
    );
  });

  it('refuses values the public contract does not call a date-time', () => {
    for (const value of [
      '',
      '2026-07-18',
      '2026-07-18T12:00:00',
      '2026-07-18 12:00:00Z',
      '2026-07-18T12:00:00+2:00',
      '2026-07-18T25:00:00Z',
      '2026-07-18T12:60:00Z',
      '2026-07-18T12:00:61Z',
      '2026-02-30T12:00:00Z',
      '2026-07-18T12:00:00+24:00',
      '2026-07-18T12:00:00+00:60',
      '2026-07-18T12:00:00.Z',
      'not-a-timestamp',
    ]) {
      expect(canonicalInstant(value)).toBeNull();
    }
  });

  it('is idempotent: canonicalizing a canonical value changes nothing', () => {
    for (const value of [
      '2026-07-18T14:00:00+02:00',
      '2026-07-18t12:00:00.500z',
      '2016-12-31T23:59:60Z',
    ]) {
      const once = canonicalInstant(value);
      expect(once).not.toBeNull();
      expect(canonicalInstant(once as string)).toBe(once);
    }
  });
});
