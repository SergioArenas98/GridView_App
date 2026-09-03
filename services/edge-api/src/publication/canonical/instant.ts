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
