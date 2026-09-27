/**
 * The §10.4.1 cadence arithmetic: dense offsets from the Jolpica start
 * anchor, daily checks to the 14-day ceiling, missed-check collapse and the
 * +5h eligibility boundary.
 */

import { describe, expect, it } from 'vitest';

import {
  FINAL_CHECK_SLOT,
  calendarAnchor,
  checkTime,
  currentSlot,
  isEligible,
  nextCheckAt,
  standingsIntervalMs,
} from '../../../../src/sync/coordinated/policy';
import { ANCHOR, DAY, HOUR, anchorOf, plus } from './support';

describe('the classification cadence', () => {
  it('checks at +5, +9, +15 and +24 hours, then daily on days 2 to 14', () => {
    const offsets = Array.from(
      { length: FINAL_CHECK_SLOT },
      (_, index) =>
        (checkTime(ANCHOR, index + 1).getTime() - Date.parse(ANCHOR)) / HOUR,
    );
    expect(offsets).toEqual([
      5, 9, 15, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240, 264, 288, 312,
      336,
    ]);
    expect(FINAL_CHECK_SLOT).toBe(17);
  });

  it('has no slot outside 1-17', () => {
    for (const slot of [0, 18, 1.5]) {
      expect(() => checkTime(ANCHOR, slot)).toThrow(RangeError);
    }
    expect(nextCheckAt(ANCHOR, FINAL_CHECK_SLOT)).toBeNull();
    expect(nextCheckAt(ANCHOR, 0)).toBe(plus(ANCHOR, 5 * HOUR).toISOString());
  });

  it('collapses every missed slot into the latest one that has come', () => {
    expect(currentSlot(ANCHOR, plus(ANCHOR, 5 * HOUR - 1))).toBe(0);
    expect(currentSlot(ANCHOR, plus(ANCHOR, 5 * HOUR))).toBe(1);
    expect(currentSlot(ANCHOR, plus(ANCHOR, 23 * HOUR))).toBe(3);
    expect(currentSlot(ANCHOR, plus(ANCHOR, 6 * DAY + HOUR))).toBe(9);
    expect(currentSlot(ANCHOR, plus(ANCHOR, 14 * DAY))).toBe(17);
    expect(currentSlot(ANCHOR, plus(ANCHOR, 400 * DAY))).toBe(17);
  });

  it('makes a round eligible exactly at anchor + 5 hours, never before', () => {
    expect(isEligible(ANCHOR, plus(ANCHOR, 5 * HOUR - 1))).toBe(false);
    expect(isEligible(ANCHOR, plus(ANCHOR, 5 * HOUR))).toBe(true);
    // A race that has started but cannot have a result yet.
    expect(isEligible(ANCHOR, plus(ANCHOR, HOUR))).toBe(false);
  });
});

describe('the Jolpica anchor', () => {
  it('is the race start when the time is present', () => {
    expect(calendarAnchor(18, '2026-10-04', '13:00:00Z')).toEqual({
      round: 18,
      anchor: '2026-10-04T13:00:00.000Z',
      anchorKind: 'date-time',
    });
  });

  it('falls back to the end of the day when the time is absent', () => {
    expect(calendarAnchor(18, '2026-10-04', null)).toEqual({
      round: 18,
      anchor: '2026-10-04T23:59:59.000Z',
      anchorKind: 'date-eod',
    });
  });

  it.each([
    ['an impossible date', '2026-02-30', '13:00:00Z'],
    ['a local time', '2026-10-04', '13:00:00'],
    ['an offset time', '2026-10-04', '13:00:00+02:00'],
    ['a malformed date', '4 Oct 2026', '13:00:00Z'],
  ])('substitutes nothing for %s', (_label, date, time) => {
    expect(calendarAnchor(1, date, time)).toBeNull();
  });
});

describe('the standings refresh interval', () => {
  const calendar = [
    anchorOf(1, '2026-03-08T04:00:00.000Z'),
    anchorOf(2, ANCHOR),
  ];

  it('is daily from the first race to the final race ceiling, weekly otherwise', () => {
    expect(
      standingsIntervalMs(calendar, new Date('2026-03-01T00:00:00.000Z')),
    ).toBe(7 * DAY);
    expect(
      standingsIntervalMs(calendar, new Date('2026-06-01T00:00:00.000Z')),
    ).toBe(DAY);
    expect(standingsIntervalMs(calendar, plus(ANCHOR, 14 * DAY))).toBe(DAY);
    expect(standingsIntervalMs(calendar, plus(ANCHOR, 14 * DAY + 1))).toBe(
      7 * DAY,
    );
    expect(standingsIntervalMs(null, new Date(ANCHOR))).toBe(7 * DAY);
  });
});
