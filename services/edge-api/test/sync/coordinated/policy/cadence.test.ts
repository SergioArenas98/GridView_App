/**
 * The §10.4.1 cadence arithmetic on ADR 0028 D5's schedule: the hourly
 * initial window from the Jolpica start anchor + 1 h 30 min, the back-off,
 * daily checks to the 14-day ceiling, the confirmation slots of an accepted
 * result, missed-check collapse, the + 1 h 30 min eligibility boundary and the
 * unchanged five-hour batch capture rule.
 */

import { describe, expect, it } from 'vitest';

import {
  MAXIMUM_CHECK_INDEX,
  MAXIMUM_CONSECUTIVE_CONFIRMATIONS,
} from '../../../../src/sync/coordinated/ledger';
import {
  FINAL_CHECK_SLOT,
  SETTLING_FIRST_SLOT,
  calendarAnchor,
  checkTime,
  currentSlot,
  isBatchCaptureEligible,
  isConfirmationSlot,
  isEligible,
  nextCheckAt,
  slotSetFor,
  standingsIntervalMs,
} from '../../../../src/sync/coordinated/policy';
import { ANCHOR, DAY, HOUR, anchorOf, plus } from './support';

const MINUTE = HOUR / 60;
const hoursAfter = (slot: number) =>
  (checkTime(ANCHOR, slot).getTime() - Date.parse(ANCHOR)) / HOUR;

describe('the classification cadence', () => {
  it('checks hourly from +1 h 30 min to +10 h 30 min, then at +15 h and +24 h, then daily on days 2 to 14', () => {
    const offsets = Array.from({ length: FINAL_CHECK_SLOT }, (_, index) =>
      hoursAfter(index + 1),
    );
    expect(offsets).toEqual([
      1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 15, 24, 48, 72, 96,
      120, 144, 168, 192, 216, 240, 264, 288, 312, 336,
    ]);
    expect(FINAL_CHECK_SLOT).toBe(25);
    expect(hoursAfter(SETTLING_FIRST_SLOT)).toBe(24);
    // The ledger's bounds are the cadence's.
    expect(MAXIMUM_CHECK_INDEX).toBe(FINAL_CHECK_SLOT);
    expect(MAXIMUM_CONSECUTIVE_CONFIRMATIONS).toBe(FINAL_CHECK_SLOT);
  });

  it('has no slot outside 1-25', () => {
    for (const slot of [0, 26, 1.5]) {
      expect(() => checkTime(ANCHOR, slot)).toThrow(RangeError);
    }
    expect(nextCheckAt(ANCHOR, FINAL_CHECK_SLOT)).toBeNull();
    expect(nextCheckAt(ANCHOR, FINAL_CHECK_SLOT, 'confirmation')).toBeNull();
    expect(nextCheckAt(ANCHOR, 0)).toBe(
      plus(ANCHOR, 90 * MINUTE).toISOString(),
    );
  });

  it('lets an accepted result take only slots 5 and 9 of the window, and every slot after it', () => {
    const confirmation = Array.from(
      { length: FINAL_CHECK_SLOT },
      (_, index) => index + 1,
    ).filter(isConfirmationSlot);
    expect(confirmation).toEqual([
      5, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    ]);
    expect(nextCheckAt(ANCHOR, 1, 'confirmation')).toBe(
      plus(ANCHOR, 5.5 * HOUR).toISOString(),
    );
    expect(nextCheckAt(ANCHOR, 5, 'confirmation')).toBe(
      plus(ANCHOR, 9.5 * HOUR).toISOString(),
    );
    expect(nextCheckAt(ANCHOR, 9, 'confirmation')).toBe(
      plus(ANCHOR, 15 * HOUR).toISOString(),
    );
    expect(nextCheckAt(ANCHOR, 5, 'every')).toBe(
      plus(ANCHOR, 6.5 * HOUR).toISOString(),
    );
  });

  it('takes every slot until a result is accepted, and again while a change is pending', () => {
    expect(slotSetFor(null)).toBe('every');
    expect(slotSetFor({ contentRevision: null, candidateRevision: null })).toBe(
      'every',
    );
    expect(
      slotSetFor({ contentRevision: 'sha256:a', candidateRevision: null }),
    ).toBe('confirmation');
    expect(
      slotSetFor({
        contentRevision: 'sha256:a',
        candidateRevision: 'sha256:b',
      }),
    ).toBe('every');
  });

  it('collapses every missed slot into the latest one that has come', () => {
    expect(currentSlot(ANCHOR, plus(ANCHOR, 90 * MINUTE - 1))).toBe(0);
    expect(currentSlot(ANCHOR, plus(ANCHOR, 90 * MINUTE))).toBe(1);
    expect(currentSlot(ANCHOR, plus(ANCHOR, 4 * HOUR))).toBe(3);
    expect(currentSlot(ANCHOR, plus(ANCHOR, 14 * HOUR))).toBe(10);
    expect(currentSlot(ANCHOR, plus(ANCHOR, 23 * HOUR))).toBe(11);
    expect(currentSlot(ANCHOR, plus(ANCHOR, 6 * DAY + HOUR))).toBe(17);
    expect(currentSlot(ANCHOR, plus(ANCHOR, 14 * DAY))).toBe(25);
    expect(currentSlot(ANCHOR, plus(ANCHOR, 400 * DAY))).toBe(25);
    // An accepted result's latest slot is a confirmation slot.
    expect(currentSlot(ANCHOR, plus(ANCHOR, 4 * HOUR), 'confirmation')).toBe(0);
    expect(currentSlot(ANCHOR, plus(ANCHOR, 8 * HOUR), 'confirmation')).toBe(5);
    expect(currentSlot(ANCHOR, plus(ANCHOR, 14 * HOUR), 'confirmation')).toBe(
      9,
    );
  });

  it('makes a round eligible exactly at anchor + 1 h 30 min, never before', () => {
    expect(isEligible(ANCHOR, plus(ANCHOR, 90 * MINUTE - 1))).toBe(false);
    expect(isEligible(ANCHOR, plus(ANCHOR, 90 * MINUTE))).toBe(true);
    // A race that has started but cannot have finished.
    expect(isEligible(ANCHOR, plus(ANCHOR, HOUR))).toBe(false);
  });

  it('leaves the batch capture rule at five hours (ADR 0028 D5)', () => {
    expect(isBatchCaptureEligible(ANCHOR, plus(ANCHOR, 5 * HOUR - 1))).toBe(
      false,
    );
    expect(isBatchCaptureEligible(ANCHOR, plus(ANCHOR, 5 * HOUR))).toBe(true);
    expect(isBatchCaptureEligible(ANCHOR, plus(ANCHOR, 2 * HOUR))).toBe(false);
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
