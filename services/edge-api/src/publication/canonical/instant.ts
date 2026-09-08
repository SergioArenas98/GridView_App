/**
 * The canonical RFC 3339 form for `snapshotRevision` (ADR 0020 D1.7,
 * "Dates").
 *
 * Two properties must hold at once, and they pull in opposite directions.
 *
 * **Equivalent instants must hash identically.** `Z` and `z`, `T` and `t`,
 * `+02:00` and the matching UTC reading, `.000` and no fraction at all are the
 * same instant written four ways; a provider switching between them has not
 * changed the content, and treating it as a change would advance
 * `sourceUpdatedAt` for nothing.
 *
 * **Distinct instants must stay distinct.** Phase 9B-5 accepts
 * `time-secfrac = "." 1*DIGIT` with no ceiling, exactly as RFC 3339 §5.6
 * writes it, so the wire contract carries unbounded fractional precision.
 * Reading the ADR's "fixed precision" as *truncate to the millisecond the
 * publication clock uses* would make `…:00.0001Z` and `…:00.0002Z` share a
 * revision. It is read here as **one canonical spelling** instead, which
 * satisfies the ADR without narrowing the contract: the zone is normalized,
 * insignificant trailing zeros are dropped, and every significant digit
 * survives.
 *
 * **`Date` is deliberately never used.** `Date.parse` and `new Date` roll a
 * leap second silently into the following minute, so `1998-12-31T23:59:60Z`
 * and `1999-01-01T00:00:00Z` - two different valid RFC 3339 values - would
 * collapse onto one revision. The offset arithmetic here is integer civil-date
 * arithmetic instead, and because an RFC 3339 offset is a whole number of
 * minutes it never touches the seconds field at all.
 */

/**
 * The RFC 3339 `date-time` grammar, with the fraction and the offset captured.
 *
 * Deliberately the same shape as `contract/normalized/values.ts` accepts, so a
 * value the public contract calls valid always has a canonical form: a
 * narrower pattern here would silently push conforming payloads onto the
 * opaque-string fallback and let two equivalent instants hash differently.
 * Fully anchored, with no alternation inside a repetition, so matching stays
 * linear on adversarial input.
 */
const pattern =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/;

/** Days from 1970-01-01 for a proleptic Gregorian calendar date. */
function daysFromCivil(year: number, month: number, day: number): number {
  const shifted = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(shifted / 400);
  const yearOfEra = shifted - era * 400;
  const dayOfYear =
    Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** The inverse of `daysFromCivil`. */
function civilFromDays(days: number): {
  year: number;
  month: number;
  day: number;
} {
  const shifted = days + 719468;
  const era = Math.floor(shifted / 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  );
  const year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra -
    (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPrime = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPrime + 2) / 5) + 1;
  const month = monthPrime + (monthPrime < 10 ? 3 : -9);
  return { year: year + (month <= 2 ? 1 : 0), month, day };
}

/** Whether three numbers name a date that exists. */
function isCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const rebuilt = civilFromDays(daysFromCivil(year, month, day));
  return (
    rebuilt.year === year && rebuilt.month === month && rebuilt.day === day
  );
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * The canonical UTC spelling of one RFC 3339 `date-time`, or `null` when the
 * value is not one.
 *
 * `null` is a refusal, not a failure: the caller keeps the original string as
 * an opaque value, so a malformed timestamp still contributes to the revision
 * and still cannot collide with a canonicalized one.
 */
export function canonicalInstant(value: string): string | null {
  const parts = pattern.exec(value);
  if (parts === null) return null;

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const hour = Number(parts[4]);
  const minute = Number(parts[5]);
  const second = Number(parts[6]);
  const fraction = parts[7];
  const offsetSign = parts[8];
  const offsetHour = parts[9];
  const offsetMinute = parts[10];

  if (!isCalendarDate(year, month, day)) return null;
  // A leap second is representable in RFC 3339, so 60 is permitted - and it is
  // carried through untouched rather than normalized away.
  if (hour > 23 || minute > 59 || second > 60) return null;

  let offsetMinutes = 0;
  if (offsetSign !== undefined) {
    const hours = Number(offsetHour);
    const minutes = Number(offsetMinute);
    if (hours > 23 || minutes > 59) return null;
    offsetMinutes = (hours * 60 + minutes) * (offsetSign === '-' ? -1 : 1);
  }

  // Whole minutes only, so `second` and the fraction are never involved: that
  // is what keeps a leap second a leap second across a zone conversion.
  const totalMinutes =
    daysFromCivil(year, month, day) * 1440 + hour * 60 + minute - offsetMinutes;
  const days = Math.floor(totalMinutes / 1440);
  const withinDay = totalMinutes - days * 1440;
  const civil = civilFromDays(days);
  if (civil.year < 0 || civil.year > 9999) return null;

  const trimmed = fraction === undefined ? '' : fraction.replace(/0+$/, '');
  const secfrac = trimmed === '' ? '' : `.${trimmed}`;
  return (
    `${pad(civil.year, 4)}-${pad(civil.month, 2)}-${pad(civil.day, 2)}` +
    `T${pad(Math.floor(withinDay / 60), 2)}:${pad(withinDay % 60, 2)}` +
    `:${pad(second, 2)}${secfrac}Z`
  );
}

/**
 * The `Date`'s ISO spelling, but only when it lands inside the four-digit
 * RFC 3339 domain this module accepts - `null` for anything else.
 *
 * `Date#toISOString` throws for a non-finite `Date` and emits an extended-year
 * spelling (`+010000-01-01T…`) for a year outside `0000`-`9999`; either would
 * put an unusable value into durable state. This is the one bounded conversion
 * the sequencer routes every clock reading and every deadline through, so a
 * value that reaches storage is always one every later operation can order.
 * The raw `toISOString` text is returned unchanged (its trailing `.000` and
 * all) when it is in range - `canonicalInstant` only validates it here.
 */
export function boundedInstant(value: Date): string | null {
  let iso: string;
  try {
    iso = value.toISOString();
  } catch {
    return null;
  }
  return canonicalInstant(iso) === null ? null : iso;
}

/** The fixed `YYYY-MM-DDTHH:MM:SS(.frac)?` shape a canonical value always has. */
const canonicalPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/;

/**
 * A total order over the RFC 3339 `date-time` domain `canonicalInstant`
 * accepts: `-1`, `0` or `1` when both values canonicalize, `null` when either
 * does not.
 *
 * `Date.parse` is deliberately not used - it returns `NaN` for a leap second
 * and truncates sub-millisecond precision, so it can neither order nor
 * distinguish two values this contract calls valid. Comparison is done on the
 * canonical UTC spelling instead: the 19-character `YYYY-MM-DDTHH:MM:SS` head
 * is fixed-width with constant separators, so a lexical comparison of it is a
 * chronological one (and `:60` sorts correctly after `:59`); the fraction is
 * then compared digit-for-digit with the shorter side zero-extended, so every
 * significant digit past the millisecond still separates two instants.
 * Equivalent spellings (`Z`/`+00:00`, `.100`/`.1`, a numeric offset and its
 * UTC reading) share a canonical form and therefore compare equal.
 */
export function compareInstants(a: string, b: string): -1 | 0 | 1 | null {
  const ca = canonicalInstant(a);
  const cb = canonicalInstant(b);
  if (ca === null || cb === null) return null;
  if (ca === cb) return 0;
  const [headA, fractionA = ''] = ca.slice(0, -1).split('.');
  const [headB, fractionB = ''] = cb.slice(0, -1).split('.');
  if (headA !== headB) return headA! < headB! ? -1 : 1;
  const width = Math.max(fractionA.length, fractionB.length);
  const paddedA = fractionA.padEnd(width, '0');
  const paddedB = fractionB.padEnd(width, '0');
  if (paddedA === paddedB) return 0;
  return paddedA < paddedB ? -1 : 1;
}

/**
 * The canonical spelling of one RFC 3339 `date-time` plus exactly one
 * millisecond, or `null` when the value is not one this module accepts or the
 * result would leave the representable year range.
 *
 * Total across every case the sequencer's assignment floor can reach: an
 * ordinary second, a fraction (the millisecond digit advances and any
 * sub-millisecond tail is carried untouched), a leap second (`:60` is the last
 * second of its minute, so a carry out of it rolls to `:00` of the next
 * minute, never to a synthesized `:61`), and an end-of-minute / hour / day /
 * month / year rollover (carried through the same integer civil-date
 * arithmetic `canonicalInstant` uses, so no `Date` is involved and no leap
 * second is collapsed).
 */
export function instantPlusMillisecond(value: string): string | null {
  const canonical = canonicalInstant(value);
  if (canonical === null) return null;
  const parts = canonicalPattern.exec(canonical);
  if (parts === null) return null;

  let year = Number(parts[1]);
  let month = Number(parts[2]);
  let day = Number(parts[3]);
  let hour = Number(parts[4]);
  let minute = Number(parts[5]);
  let second = Number(parts[6]);
  const fraction = parts[7] ?? '';

  const milli = Number((fraction + '000').slice(0, 3));
  const subMilli = fraction.length > 3 ? fraction.slice(3) : '';
  let newMilli = milli + 1;
  let carrySecond = 0;
  if (newMilli === 1000) {
    newMilli = 0;
    carrySecond = 1;
  }

  if (carrySecond === 1) {
    // 0..59 for an ordinary minute, plus 60 for a leap second - either way the
    // second after the last one is `:00` of the next minute.
    if (second >= 59) {
      second = 0;
      minute += 1;
      if (minute === 60) {
        minute = 0;
        hour += 1;
        if (hour === 24) {
          hour = 0;
          const civil = civilFromDays(daysFromCivil(year, month, day) + 1);
          year = civil.year;
          month = civil.month;
          day = civil.day;
        }
      }
    } else {
      second += 1;
    }
  }

  if (year < 0 || year > 9999) return null;

  const rebuiltFraction =
    `${String(newMilli).padStart(3, '0')}${subMilli}`.replace(/0+$/, '');
  const secfrac = rebuiltFraction === '' ? '' : `.${rebuiltFraction}`;
  return (
    `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` +
    `T${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}${secfrac}Z`
  );
}
