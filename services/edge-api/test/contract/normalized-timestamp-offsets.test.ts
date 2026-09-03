/**
 * RFC 3339 numeric offsets are range-checked, not merely shaped.
 *
 * The date-time pattern matched `[+-]\d{2}:\d{2}` and stopped there, so the
 * offset's hour and minute were never bounded while the date and the local
 * clock fields were. `2026-07-19T13:00:00+99:99` therefore passed a gate whose
 * whole purpose is to decide whether a value is a contract `date-time`, and
 * could reach `Session.startTime` or `endTime` in a published document.
 *
 * This is a bound on the offset components only. Every other rule the validator
 * already applied - the calendar date, the local hour, minute and second, the
 * fractional-second form, `Z`, the issue code and the structural path - is
 * unchanged, and the controls below pin that.
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

describe('an out-of-range numeric offset is not a date-time', () => {
  it.each([
    ['a nonsense offset', '2026-07-19T13:00:00+99:99'],
    ['an out-of-range negative offset', '2026-07-19T13:00:00-25:61'],
    ['a minute of 60', '2026-07-19T13:00:00+00:60'],
    ['an hour of 24', '2026-07-19T13:00:00+24:00'],
    ['a negative hour of 24', '2026-07-19T13:00:00-24:00'],
    ['the last valid hour with an invalid minute', '2026-07-19T13:00:00+23:60'],
    ['an hour of 99 with a valid minute', '2026-07-19T13:00:00+99:00'],
    ['a minute of 99 with a valid hour', '2026-07-19T13:00:00-00:99'],
    [
      'an out-of-range offset on a fractional-second value',
      '2026-07-19T13:00:00.250+24:00',
    ],
  ])('rejects %s', (_label, value) => {
    expect(startTimeCodes(value)).toEqual(['timestamp']);
  });

  it('reports exactly one issue for an out-of-range offset', () => {
    expect(
      validateSession(
        { ...session, startTime: '2026-07-19T13:00:00+99:99' },
        'v',
      ),
    ).toHaveLength(1);
  });

  it('leaks neither the offending value nor the offset into the issue', () => {
    const serialized = JSON.stringify(
      validateSession(
        { ...session, startTime: '2026-07-19T13:00:00+99:99' },
        'v',
      ),
    );

    expect(serialized).not.toContain('99');
    expect(serialized).not.toContain('2026-07-19');
  });
});

describe('valid offsets stay accepted', () => {
  it.each([
    ['Z', '2026-07-19T13:00:00Z'],
    ['Z with milliseconds', '2026-07-19T13:00:00.000Z'],
    ['a positive zero offset', '2026-07-19T13:00:00+00:00'],
    [
      'a negative zero offset, which RFC 3339 permits',
      '2026-07-19T13:00:00-00:00',
    ],
    ['the maximum positive offset', '2026-07-19T13:00:00+23:59'],
    ['the maximum negative offset', '2026-07-19T13:00:00-23:59'],
    ['an ordinary positive offset', '2026-07-19T13:00:00+02:00'],
    ['an ordinary negative offset', '2026-07-19T13:00:00-05:00'],
    ['a half-hour offset', '2026-07-19T13:00:00+05:30'],
    ['a three-quarter-hour offset', '2026-07-19T13:00:00+05:45'],
    ['an offset with milliseconds', '2026-07-19T13:00:00.250+02:00'],
    [
      'an offset with nanosecond precision',
      '2026-07-19T13:00:00.123456789-03:00',
    ],
  ])('accepts %s', (_label, value) => {
    expect(startTimeCodes(value)).toEqual([]);
  });

  it('accepts a valid offset on both timestamp fields', () => {
    expect(
      validateSession(
        {
          ...session,
          startTime: '2026-07-19T13:00:00+23:59',
          endTime: '2026-07-19T15:00:00-23:59',
        },
        'v',
      ),
    ).toEqual([]);
  });
});

describe('every unrelated rule is unchanged', () => {
  it.each([
    ['a date where a date-time is required', '2026-07-19'],
    ['a non-calendar date', '2026-02-30T13:00:00Z'],
    ['month 13', '2026-13-01T13:00:00Z'],
    ['an hour of 24', '2026-07-19T24:00:00Z'],
    ['a minute of 60', '2026-07-19T13:60:00Z'],
    ['a missing zone designator', '2026-07-19T13:00:00'],
    ['a lowercase zone designator', '2026-07-19T13:00:00z'],
    ['a space instead of the date-time separator', '2026-07-19 13:00:00Z'],
    ['an empty fractional part', '2026-07-19T13:00:00.Z'],
    ['an over-long fractional part', '2026-07-19T13:00:00.1234567890Z'],
    ['a one-digit offset hour', '2026-07-19T13:00:00+2:00'],
    ['an offset without a colon', '2026-07-19T13:00:00+0200'],
    ['whitespace padding', ' 2026-07-19T13:00:00Z'],
  ])('still rejects %s', (_label, value) => {
    expect(startTimeCodes(value)).toEqual(['timestamp']);
  });

  it('still accepts a leap second, which RFC 3339 represents', () => {
    expect(startTimeCodes('2026-06-30T23:59:60Z')).toEqual([]);
  });

  it('still reports a non-string as a type failure, not a timestamp failure', () => {
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

  it('does not normalize or coerce an accepted value', () => {
    const value = { ...session, startTime: '2026-07-19T13:00:00+05:45' };
    const before = JSON.stringify(value);
    validateSession(value, 'v');

    expect(JSON.stringify(value)).toBe(before);
  });

  it('stays bounded against an adversarially long input', () => {
    const started = Date.now();
    startTimeCodes(`2026-07-19T13:00:00.${'1'.repeat(50_000)}+02:00`);

    expect(Date.now() - started).toBeLessThan(1000);
  });
});
