/**
 * Strict decoding of the Jolpica season-calendar response.
 *
 * The response is **untrusted input**, exactly like an adapter outcome is to
 * the coordinator. Nothing here coerces, trims, repairs, folds case or fills a
 * default: every value is either the documented shape or the whole resource
 * fails. A calendar is an identity-bearing document, and a leniently repaired
 * calendar is how a wrong event gets published under a right-looking round.
 *
 * What this module produces is a **decoded provider row**, not a normalized
 * entity: provider strings, one integer round, and the session blocks that were
 * actually present. Identity resolution and contract normalization are the next
 * stage's business (`calendar-normalizer.ts`), so the two cannot be confused.
 *
 * Nothing provider-controlled escapes this module. A decode failure answers a
 * bounded closed code; the offending value is never carried, thrown or logged.
 */

/** The documented Jolpica session blocks, in canonical weekend order. */
export const jolpicaSessionBlocks = [
  'FirstPractice',
  'SecondPractice',
  'ThirdPractice',
  'SprintQualifying',
  'Sprint',
  'Qualifying',
] as const;

export type JolpicaSessionBlock = (typeof jolpicaSessionBlocks)[number];

/**
 * `SprintShootout` is the earlier upstream name for the sprint-qualifying
 * block (Provider Evaluation S8). It is accepted as the **same** block rather
 * than as a second session, and a row carrying both names is contradictory and
 * fails: two names for one block cannot disagree about when it starts.
 *
 * This is a documented upstream field name, not an identity alias. No mapping
 * record is involved and no identity is derived from it.
 */
const sprintQualifyingAliases = ['SprintQualifying', 'SprintShootout'] as const;

/** Why a response could not be decoded. Closed, bounded, log-safe. */
export const calendarDecodeProblems = [
  'envelope',
  'pagination',
  'incomplete-page',
  'season-mismatch',
  'race-collection',
  'race-row',
  'round',
  'race-name',
  'circuit-id',
  'race-date',
  'session-block',
  'session-instant',
  'duplicate-round',
  'duplicate-locator',
] as const;

export type CalendarDecodeProblem = (typeof calendarDecodeProblems)[number];

/** One decoded session block: a provider instant that was complete. */
export interface DecodedSession {
  readonly block: JolpicaSessionBlock;
  /** RFC 3339 UTC instant, assembled from the block's own `date` and `time`. */
  readonly startTime: string;
}

/**
 * One decoded race row.
 *
 * `round` is an integer, converted exactly once here. `raceName` and
 * `circuitId` are the **exact** provider strings: they are locator components,
 * and any adjustment to them is a different locator.
 */
export interface DecodedRace {
  readonly round: number;
  readonly raceName: string;
  readonly circuitId: string;
  readonly date: string;
  /** The race's own start instant. Always present: a race block is required. */
  readonly startTime: string;
  readonly sessions: readonly DecodedSession[];
}

export type CalendarDecodeResult =
  | { readonly ok: true; readonly races: readonly DecodedRace[] }
  | { readonly ok: false; readonly problem: CalendarDecodeProblem };

function fail(problem: CalendarDecodeProblem): CalendarDecodeResult {
  return { ok: false, problem };
}

/** A plain object. `null` and arrays are not records. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A non-empty string, with no trimming.
 *
 * A padded provider value is **not** silently accepted as its trimmed form:
 * trimming into a match is exactly the lenient coercion ADR 0022 D4 forbids,
 * so `' albert_park '` is a different value and simply will not resolve.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** A base-10 non-negative integer string. No sign, no padding, no exponent. */
const nonNegativeIntegerPattern = /^(?:0|[1-9][0-9]*)$/;
/** A base-10 strictly positive integer string. `0` and `01` are refused. */
const positiveIntegerPattern = /^[1-9][0-9]*$/;

const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
/**
 * The UTC time form Jolpica publishes (Provider Evaluation §8.4).
 *
 * Only `Z` is accepted. A numeric offset would still be valid RFC 3339, but it
 * is not what this endpoint documents, and accepting one would mean the
 * adapter silently re-anchoring an instant the provider never expressed.
 */
const utcTimePattern = /^(\d{2}):(\d{2}):(\d{2})Z$/;

function parseNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== 'string' || !nonNegativeIntegerPattern.test(value)) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value !== 'string' || !positiveIntegerPattern.test(value)) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * A real calendar date, not merely a well-shaped one.
 *
 * `2026-02-30` matches the pattern and is not a date. The contract validator
 * applies the same rule, so accepting it here would only move the failure to a
 * later boundary that can no longer attribute it to a provider row.
 */
function isCalendarDate(value: string): boolean {
  const parts = dateOnlyPattern.exec(value);
  if (parts === null) return false;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const limit =
    month === 2 && isLeapYear(year) ? 29 : (daysInMonth[month - 1] as number);
  return day <= limit;
}

function isUtcTime(value: string): boolean {
  const parts = utcTimePattern.exec(value);
  if (parts === null) return false;
  const hour = Number(parts[1]);
  const minute = Number(parts[2]);
  const second = Number(parts[3]);
  // 60 is a representable leap second in RFC 3339, matching the contract
  // validator rather than narrowing what it calls valid.
  return hour <= 23 && minute <= 59 && second <= 60;
}

/**
 * Assembles one complete instant from a block's own `date` and `time`.
 *
 * Returns `null` when either half is absent or malformed. **Nothing is
 * substituted** — not midnight, not end of day, not the race's own time and
 * not the fetch clock (ADR 0022 A8).
 */
function readInstant(source: Record<string, unknown>): string | null {
  const date = source.date;
  const time = source.time;
  if (!isNonEmptyString(date) || !isCalendarDate(date)) return null;
  if (!isNonEmptyString(time) || !isUtcTime(time)) return null;
  return `${date}T${time}`;
}

/**
 * Reads the optional session blocks a race row carries.
 *
 * Three outcomes, deliberately distinct:
 *
 * - **Absent block** - contributes no session at all (A8). It is not an error.
 * - **Present block that yields a complete instant** - one decoded session.
 * - **Present block that cannot** - fails the whole resource. A session
 *   Jolpica did deliver is never published with a silently absent start, which
 *   is an adapter rule stricter than the nullable contract field (A8).
 *
 * **Presence is structural, and `null` is present.** A8 draws its line between
 * a block that is *entirely absent* and one that is *there but unusable*, so
 * only a missing key may take the absence path. `Qualifying: null` is a block
 * Jolpica put in the response and could not describe; skipping it would
 * publish a weekend with a session silently missing, which is exactly the
 * outcome A8 exists to prevent. The row comes from `JSON.parse`, where a key
 * can only be missing or carry a JSON value, so `undefined` means absent and
 * nothing else does.
 */
function readSessions(
  row: Record<string, unknown>,
): readonly DecodedSession[] | CalendarDecodeProblem {
  const sprintQualifyingNames = sprintQualifyingAliases.filter(
    (name) => row[name] !== undefined,
  );
  // Two names for one block. Nothing here can decide which is authoritative,
  // and picking one would be inventing an answer. A `null` under one of them
  // still counts as present, so it cannot be used to slip past this check.
  if (sprintQualifyingNames.length > 1) return 'session-block';

  const sessions: DecodedSession[] = [];
  for (const block of jolpicaSessionBlocks) {
    // The sprint-qualifying block is whichever of its two documented names the
    // row actually used; every other block is named by itself.
    const field =
      block === 'SprintQualifying'
        ? (sprintQualifyingNames[0] ?? block)
        : block;
    const raw = row[field];
    if (raw === undefined) continue;
    // `null` lands here and is refused: it is present and is not a block.
    if (!isRecord(raw)) return 'session-block';
    const startTime = readInstant(raw);
    if (startTime === null) return 'session-instant';
    sessions.push({ block, startTime });
  }
  return sessions;
}

function readRace(
  value: unknown,
  season: number,
): DecodedRace | CalendarDecodeProblem {
  if (!isRecord(value)) return 'race-row';

  // The row states its own season. A row for another season does not answer
  // the question that was asked, so it fails the resource rather than being
  // filtered out of it.
  if (value.season !== String(season)) return 'season-mismatch';

  const round = parsePositiveInteger(value.round);
  if (round === null) return 'round';

  const raceName = value.raceName;
  if (!isNonEmptyString(raceName)) return 'race-name';

  const circuit = value.Circuit;
  if (!isRecord(circuit)) return 'circuit-id';
  const circuitId = circuit.circuitId;
  if (!isNonEmptyString(circuitId)) return 'circuit-id';

  const date = value.date;
  if (!isNonEmptyString(date) || !isCalendarDate(date)) return 'race-date';

  // The adapter emits a race session for every event, so the race's own
  // instant is never an optional block (A8).
  const startTime = readInstant(value);
  if (startTime === null) return 'session-instant';

  const sessions = readSessions(value);
  if (typeof sessions === 'string') return sessions;

  return { round, raceName, circuitId, date, startTime, sessions };
}

/**
 * Decodes one complete season-calendar response.
 *
 * **Pagination is validated strictly and fails closed.** The request asks for
 * an explicit `limit`, and this slice accepts only a response that is complete
 * within it: `offset` at the start, the echoed `limit` as requested, and a
 * `total` the returned collection actually covers. A `total` beyond the limit
 * means more rows exist than were returned, and a partial calendar is not a
 * smaller correct calendar - it is a calendar missing events. Multi-page
 * accounting is a later slice's business and is deliberately not invented
 * here, because one calendar resource maps to one transport attempt and the
 * port has no way to represent a second.
 */
export function decodeSeasonCalendar(
  body: unknown,
  season: number,
  requestedLimit: number,
): CalendarDecodeResult {
  if (!isRecord(body)) return fail('envelope');
  const mrData = body.MRData;
  if (!isRecord(mrData)) return fail('envelope');

  const limit = parseNonNegativeInteger(mrData.limit);
  const offset = parseNonNegativeInteger(mrData.offset);
  const total = parseNonNegativeInteger(mrData.total);
  if (limit === null || offset === null || total === null) {
    return fail('pagination');
  }
  if (offset !== 0 || limit !== requestedLimit) return fail('pagination');

  const raceTable = mrData.RaceTable;
  if (!isRecord(raceTable)) return fail('envelope');
  // The table restates the season it answers for. It must agree with the
  // request as well as each row does.
  if (raceTable.season !== String(season)) return fail('season-mismatch');

  const races = raceTable.Races;
  if (!Array.isArray(races)) return fail('race-collection');

  // More rows exist upstream than this page returned. Fail closed rather than
  // publish a truncated calendar.
  if (total > limit || races.length !== total) return fail('incomplete-page');

  const decoded: DecodedRace[] = [];
  const seenRounds = new Set<number>();
  const seenLocators = new Set<string>();
  for (const raw of races) {
    const race = readRace(raw, season);
    if (!isDecodedRace(race)) return fail(race);
    if (seenRounds.has(race.round)) return fail('duplicate-round');
    seenRounds.add(race.round);
    const locator = eventKey(race);
    if (seenLocators.has(locator)) return fail('duplicate-locator');
    seenLocators.add(locator);
    decoded.push(race);
  }

  return { ok: true, races: decoded };
}

function isDecodedRace(
  value: DecodedRace | CalendarDecodeProblem,
): value is DecodedRace {
  return typeof value !== 'string';
}

/**
 * The event-identifying half of a locator: `raceName` and `circuitId`.
 *
 * The round is deliberately **excluded**. A locator that included it would be
 * unique whenever the round differs, so the check would be strictly weaker
 * than the duplicate-round check above and could never fire on its own. What
 * is worth catching is the contradictory case that check cannot see: the same
 * event appearing twice under two different rounds. One circuit may host two
 * events in a season, but only under different names (ADR 0022 A3), so the
 * pair is the right granularity.
 *
 * Length-prefixed, so the key is injective by construction rather than by the
 * components happening not to contain the separator.
 */
function eventKey(race: DecodedRace): string {
  return [race.raceName, race.circuitId]
    .map((part) => `${part.length}:${part}`)
    .join(';');
}
