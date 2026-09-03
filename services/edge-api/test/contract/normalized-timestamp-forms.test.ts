/**
 * Every RFC 3339 `date-time` form the contract declares is accepted.
 *
 * The pattern spelled the time and zone designators as literal uppercase `T`
 * and `Z` and capped the fractional part at nine digits. RFC 3339 does neither:
 * §5.6 notes that "the grammar element date-time ... is case-insensitive" for
 * the `T` and `Z` designators, and `time-secfrac = "." 1*DIGIT` states a lower
 * bound of one digit and no upper bound at all.
 *
 * `docs/api/gridview-api-v1.yaml` declares these fields `format: date-time`, so
 * a conforming adapter emitting `2026-07-19t13:00:00z`, or precision finer than
 * a nanosecond, was being converted into an `invalid-payload` contribution and
 * could make an otherwise healthy resource unavailable.
 *
 * This widens the accepted *lexical* forms only. The calendar rule, the local
 * clock bounds, the leap second, the numeric offset bounds, the issue code, the
 * structural path, the redaction and the non-coercion are unchanged, and the
 * controls in the last block pin every one of them.
 */

import { describe, expect, it } from 'vitest';

import {
  validateSession,
  type ContractIssue,
} from '../../src/contract/normalized';

const session: Record<string, unknown> = {
  id: '2026-belgian-grand-prix-race',
  type: 'race',
  name: 'Race',
  startTime: '2026-07-19T13:00:00.000Z',
  endTime: '2026-07-19T15:00:00.000Z',
  status: 'completed',
};

function startTimeCodes(value: string): string[] {
  const issues: readonly ContractIssue[] = validateSession(
    { ...session, startTime: value },
    'v',
  );
  return issues
    .filter((issue) => issue.path === 'v.startTime')
    .map((issue) => issue.code);
}

describe('the case of the time and zone designators is not a contract rule', () => {
  it.each([
    ['a lowercase separator and a lowercase zone', '2026-07-19t13:00:00z'],
    ['an uppercase separator and a lowercase zone', '2026-07-19T13:00:00z'],
    ['a lowercase separator and an uppercase zone', '2026-07-19t13:00:00Z'],
    [
      'a lowercase separator with a positive numeric offset',
      '2026-07-19t13:00:00+02:00',
    ],
    [
      'a lowercase separator with a negative numeric offset',
      '2026-07-19t13:00:00-05:00',
    ],
    [
      'a lowercase separator, fractional seconds and a lowercase zone',
      '2026-07-19t13:00:00.250z',
    ],
  ])('accepts %s', (_label, value) => {
    expect(startTimeCodes(value)).toEqual([]);
  });
});

describe('fractional seconds carry no undocumented precision cap', () => {
  it.each([
    ['one digit, the ABNF minimum', '2026-07-19T13:00:00.1Z'],
    ['three digits', '2026-07-19T13:00:00.123Z'],
    ['nine digits', '2026-07-19T13:00:00.123456789Z'],
    ['ten digits', '2026-07-19T13:00:00.1234567890Z'],
    ['twelve digits', '2026-07-19T13:00:00.123456789012Z'],
    [
      'twelve digits with a numeric offset',
      '2026-07-19T13:00:00.123456789012+05:45',
    ],
  ])('accepts %s', (_label, value) => {
    expect(startTimeCodes(value)).toEqual([]);
  });

  it('accepts a substantially longer fractional component', () => {
    expect(startTimeCodes(`2026-07-19T13:00:00.${'1'.repeat(4096)}Z`)).toEqual(
      [],
    );
  });

  it('stays linear on a long fractional component that must be accepted', () => {
    const started = Date.now();
    const codes = startTimeCodes(
      `2026-07-19T13:00:00.${'1'.repeat(100_000)}+02:00`,
    );

    expect(codes).toEqual([]);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('stays linear on a long fractional component that must be rejected', () => {
    const started = Date.now();
    const codes = startTimeCodes(
      `2026-07-19T13:00:00.${'1'.repeat(100_000)}+24:00`,
    );

    expect(codes).toEqual(['timestamp']);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('widening the lexical forms changes nothing else', () => {
  it.each([
    ['an offset hour beyond 23', '2026-07-19t13:00:00+24:00'],
    ['an offset minute beyond 59', '2026-07-19t13:00:00-00:60'],
    ['a nonsense offset on a lowercase form', '2026-07-19t13:00:00+99:99'],
    ['a decimal point with no digits', '2026-07-19T13:00:00.z'],
    [
      'a decimal point with no digits before an offset',
      '2026-07-19t13:00:00.+02:00',
    ],
    ['a non-calendar date', '2026-02-30t13:00:00z'],
    ['month 13', '2026-13-01t13:00:00z'],
    ['an hour of 24', '2026-07-19t24:00:00z'],
    ['a minute of 60', '2026-07-19t13:60:00z'],
    ['a second of 61', '2026-07-19t13:00:61z'],
    ['a missing zone designator', '2026-07-19t13:00:00'],
    ['a space instead of the separator', '2026-07-19 13:00:00Z'],
    ['a lowercase zone with trailing whitespace', '2026-07-19t13:00:00z '],
    ['a one-digit offset hour', '2026-07-19t13:00:00+2:00'],
    ['an offset without a colon', '2026-07-19t13:00:00+0200'],
    ['a date where a date-time is required', '2026-07-19'],
    ['a fractional part in the wrong position', '2026-07-19t13:00.250:00z'],
  ])('still rejects %s', (_label, value) => {
    expect(startTimeCodes(value)).toEqual(['timestamp']);
  });

  it('still accepts a leap second in a lowercase form', () => {
    expect(startTimeCodes('2026-06-30t23:59:60z')).toEqual([]);
  });

  it('reports exactly one issue for a rejected lowercase form', () => {
    expect(
      validateSession(
        { ...session, startTime: '2026-07-19t13:00:00+99:99' },
        'v',
      ),
    ).toHaveLength(1);
  });

  it('leaks neither the value nor the offset into the issue', () => {
    const serialized = JSON.stringify(
      validateSession(
        { ...session, startTime: '2026-07-19t13:00:00+99:99' },
        'v',
      ),
    );

    expect(serialized).not.toContain('99');
    expect(serialized).not.toContain('2026-07-19');
  });

  it('still reports a non-string as a type failure', () => {
    expect(
      validateSession({ ...session, startTime: 1_700_000_000 }, 'v')
        .filter((issue) => issue.path === 'v.startTime')
        .map((issue) => issue.code),
    ).toEqual(['type']);
  });

  it('still accepts null in the nullable position', () => {
    expect(
      validateSession({ ...session, startTime: null, endTime: null }, 'v'),
    ).toEqual([]);
  });

  it('does not normalize or coerce an accepted lowercase value', () => {
    const value = { ...session, startTime: '2026-07-19t13:00:00.5z' };
    const before = JSON.stringify(value);
    validateSession(value, 'v');

    expect(JSON.stringify(value)).toBe(before);
  });

  it('accepts a lowercase form on both timestamp fields', () => {
    expect(
      validateSession(
        {
          ...session,
          startTime: '2026-07-19t13:00:00z',
          endTime: '2026-07-19t15:00:00.1234567890z',
        },
        'v',
      ),
    ).toEqual([]);
  });
});
