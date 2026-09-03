/**
 * The value rules, as composable checks.
 *
 * Each check answers about **one** already-read value and writes at most one
 * issue. Nothing here reads a property, walks an object or invokes anything
 * the value supplied - `object.ts` owns that - so a check can be reasoned
 * about, and tested, on its own.
 *
 * Constraints come from `docs/api/gridview-api-v1.yaml`. Where the schema
 * states no bound, none is imposed: there is no sign or range rule for wins,
 * podiums, laps, lengths, corner counts, coordinates, aspect ratios, durations,
 * gaps or points, so inventing one here would reject data the contract calls
 * valid.
 */

import type { IssueCollector } from './issues';
import { maxCollectionLength } from './issues';

/** A check over one value at one structural path. */
export type Check = (
  value: unknown,
  path: string,
  collector: IssueCollector,
) => void;

/** Identifier grammar, shared by `Slug` and `GridViewId`. */
const identifierPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const slugMaxLength = 64;
const gridViewIdMaxLength = 96;

const countryCodePattern = /^[A-Z]{2}$/;
const colorHexPattern = /^#[0-9a-fA-F]{6}$/;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
/**
 * RFC 3339 `date-time`, with the numeric offset **captured** so it can be
 * bounded rather than merely shaped.
 *
 * The lexical forms are exactly the ones RFC 3339 §5.6 defines, and no more.
 * The time and zone designators are **case-insensitive** there, so `[Tt]` and
 * `[Zz]` are both accepted; and `time-secfrac = "." 1*DIGIT` states one digit
 * as the floor and **no ceiling**, so the fractional part is `\d+` rather than
 * a precision cap this file would have invented. `format: date-time` in
 * `docs/api/gridview-api-v1.yaml` is that grammar, so narrowing it here would
 * refuse values the contract calls valid and turn a conforming adapter into an
 * `invalid-payload` contribution.
 *
 * Groups 7 and 8 are the offset hour and minute; both are `undefined` for `Z`.
 * The pattern is fully anchored, every group is a single character class under
 * one quantifier, and there is no alternation inside a repetition, so the only
 * backtracking possible is one linear retreat along `\d+` - each step of which
 * fails in constant time against the zone designator that must follow.
 * Execution therefore stays linear on adversarial input.
 */
const dateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/;

/**
 * The supported season range, taken from `Season.year` in the OpenAPI schema,
 * which is the authority for it. The same two numbers already bound a
 * coordinated resource identity elsewhere in the Worker; this is the schema
 * they both restate, not a second rule.
 */
export const seasonMinimum = 1950;
export const seasonMaximum = 2100;

/** A calendar date that really exists, not merely three well-sized numbers. */
function isCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const at = Date.UTC(year, month - 1, day);
  const rebuilt = new Date(at);
  return (
    rebuilt.getUTCFullYear() === year &&
    rebuilt.getUTCMonth() === month - 1 &&
    rebuilt.getUTCDate() === day
  );
}

/** Permits `null`, and defers everything else to the wrapped check. */
export function nullable(check: Check): Check {
  return (value, path, collector) => {
    if (value === null) return;
    check(value, path, collector);
  };
}

export const str: Check = (value, path, collector) => {
  if (value === null) return collector.add(path, 'null');
  if (typeof value !== 'string') collector.add(path, 'type');
};

export const bool: Check = (value, path, collector) => {
  if (value === null) return collector.add(path, 'null');
  if (typeof value !== 'boolean') collector.add(path, 'type');
};

/** A finite number. Fractional values are valid; points genuinely are. */
export const num: Check = (value, path, collector) => {
  if (value === null) return collector.add(path, 'null');
  if (typeof value !== 'number') return collector.add(path, 'type');
  if (!Number.isFinite(value)) collector.add(path, 'number');
};

export const int: Check = (value, path, collector) => {
  if (value === null) return collector.add(path, 'null');
  if (typeof value !== 'number') return collector.add(path, 'type');
  if (!Number.isSafeInteger(value)) collector.add(path, 'integer');
};

/** An integer with a stated inclusive lower bound, such as `position >= 1`. */
export function intAtLeast(minimum: number): Check {
  return (value, path, collector) => {
    if (value === null) return collector.add(path, 'null');
    if (typeof value !== 'number') return collector.add(path, 'type');
    if (!Number.isSafeInteger(value)) return collector.add(path, 'integer');
    if (value < minimum) collector.add(path, 'range');
  };
}

export const seasonYear: Check = (value, path, collector) => {
  if (value === null) return collector.add(path, 'null');
  if (typeof value !== 'number') return collector.add(path, 'type');
  if (!Number.isSafeInteger(value)) return collector.add(path, 'integer');
  if (value < seasonMinimum || value > seasonMaximum)
    collector.add(path, 'range');
};

function identifier(maxLength: number): Check {
  return (value, path, collector) => {
    if (value === null) return collector.add(path, 'null');
    if (typeof value !== 'string') return collector.add(path, 'type');
    if (value.length < 1 || value.length > maxLength) {
      return collector.add(path, 'identifier');
    }
    if (!identifierPattern.test(value)) collector.add(path, 'identifier');
  };
}

export const slug = identifier(slugMaxLength);
export const gridViewId = identifier(gridViewIdMaxLength);

function patterned(pattern: RegExp): Check {
  return (value, path, collector) => {
    if (value === null) return collector.add(path, 'null');
    if (typeof value !== 'string') return collector.add(path, 'type');
    if (!pattern.test(value)) collector.add(path, 'pattern');
  };
}

export const countryCode = patterned(countryCodePattern);
export const colorHex = patterned(colorHexPattern);

export const isoDate: Check = (value, path, collector) => {
  if (value === null) return collector.add(path, 'null');
  if (typeof value !== 'string') return collector.add(path, 'type');
  const parts = datePattern.exec(value);
  if (parts === null) return collector.add(path, 'date');
  const [year, month, day] = [
    Number(parts[1]),
    Number(parts[2]),
    Number(parts[3]),
  ];
  if (!isCalendarDate(year, month, day)) collector.add(path, 'date');
};

export const isoDateTime: Check = (value, path, collector) => {
  if (value === null) return collector.add(path, 'null');
  if (typeof value !== 'string') return collector.add(path, 'type');
  const parts = dateTimePattern.exec(value);
  if (parts === null) return collector.add(path, 'timestamp');
  const [year, month, day] = [
    Number(parts[1]),
    Number(parts[2]),
    Number(parts[3]),
  ];
  const [hour, minute, second] = [
    Number(parts[4]),
    Number(parts[5]),
    Number(parts[6]),
  ];
  if (!isCalendarDate(year, month, day))
    return collector.add(path, 'timestamp');
  // A leap second is representable in RFC 3339, so 60 is permitted here rather
  // than treated as an off-by-one.
  if (hour > 23 || minute > 59 || second > 60) {
    return collector.add(path, 'timestamp');
  }
  // The offset is part of the value, so it is bounded like every other
  // component. Matching `[+-]dd:dd` says only that the offset is *shaped* like
  // one; `+99:99` is not a date-time, and a gate whose whole job is to decide
  // whether a value is one may not wave it through. Both components are absent
  // for `Z`, and present together otherwise.
  const offsetHour = parts[7];
  const offsetMinute = parts[8];
  if (offsetHour !== undefined && offsetMinute !== undefined) {
    if (Number(offsetHour) > 23 || Number(offsetMinute) > 59) {
      collector.add(path, 'timestamp');
    }
  }
};

/** Media variant URLs. Bounded, absolute, and `http`/`https` only. */
const maxUrlLength = 2048;

/**
 * Whether the **raw** string carries a character RFC 3986 has no place for.
 *
 * `new URL()` implements the WHATWG URL Standard, which is a *repair* parser
 * rather than a grammar: for a special scheme it deletes every ASCII tab,
 * newline and carriage return wherever they appear, strips leading and trailing
 * C0 controls and spaces, rewrites `\` as `/`, and percent-encodes whatever
 * forbidden characters are left. So a successful parse says the value *could be
 * turned into* a URL, not that it *is* one - and since validation here is
 * accept-or-reject, the string that gets published is the unrepaired original,
 * not the parser's cleaned-up view of it.
 *
 * `MediaVariant.url` is declared `format: uri`, which JSON Schema defines as
 * valid per RFC 3986, and none of C0, space, DEL or `\` is a URI character
 * under that grammar. A URI carries them percent-encoded, which this scan
 * leaves untouched: `%20` is three ordinary URI characters.
 *
 * The scan is a single pass over code units - linear, allocation-free, and
 * decided before the parser is given a chance to launder anything. It is
 * deliberately lexical and deliberately small: it is not a second URI
 * implementation, and it is **not** the Flutter client's `MediaUrlPolicy`,
 * whose HTTPS-only, host-required and no-userinfo rules are a *loading* policy
 * rather than anything the wire contract states.
 */
function hasNonUriCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    // C0 controls and space (0x00-0x20), DEL (0x7F), and the backslash.
    if (unit <= 0x20 || unit === 0x7f || unit === 0x5c) return true;
  }
  return false;
}

export const absoluteUrl: Check = (value, path, collector) => {
  if (value === null) return collector.add(path, 'null');
  if (typeof value !== 'string') return collector.add(path, 'type');
  if (value.length < 1 || value.length > maxUrlLength)
    return collector.add(path, 'uri');
  if (hasNonUriCharacter(value)) return collector.add(path, 'uri');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return collector.add(path, 'uri');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    collector.add(path, 'uri');
  }
};

/**
 * Exact membership in a closed vocabulary.
 *
 * `unknown` is a member of every contract vocabulary and is therefore
 * **accepted**: it is the additive-safe value an adapter is required to
 * normalize an unrecognised upstream token into. What is refused is the raw
 * token itself, which would otherwise carry the provider's vocabulary into a
 * public document.
 */
export function enumOf(allowed: readonly string[]): Check {
  return (value, path, collector) => {
    if (value === null) return collector.add(path, 'null');
    if (typeof value !== 'string') return collector.add(path, 'type');
    if (!allowed.includes(value)) collector.add(path, 'enum');
  };
}

/**
 * A bounded array whose every element is checked at its own indexed path.
 *
 * A collection over the bound is reported and **not traversed**: the length is
 * already a contract failure, and walking it would spend the issue budget
 * describing elements of a value that is refused as a whole.
 *
 * Elements are read by index through `Object.hasOwn`, so an array hole is a
 * missing element rather than a silently-skipped one, and no `[[Get]]` runs on
 * a key the array does not own.
 */
export function arrayOf(element: Check): Check {
  return (value, path, collector) => {
    if (value === null) return collector.add(path, 'null');
    if (!Array.isArray(value)) return collector.add(path, 'type');
    let length: number;
    try {
      length = value.length;
    } catch {
      return collector.add(path, 'unreadable');
    }
    if (!Number.isSafeInteger(length) || length > maxCollectionLength) {
      return collector.add(path, 'too-many-items');
    }
    for (let index = 0; index < length; index += 1) {
      if (collector.full) return;
      const at = `${path}[${index}]`;
      let entry: unknown;
      try {
        if (!Object.hasOwn(value, index)) {
          collector.add(at, 'missing');
          continue;
        }
        entry = value[index];
      } catch {
        collector.add(at, 'unreadable');
        continue;
      }
      element(entry, at, collector);
    }
  };
}
