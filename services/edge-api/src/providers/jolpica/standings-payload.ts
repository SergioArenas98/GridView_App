/**
 * Strict decoding of one Jolpica standings response:
 * `/{season}/driverstandings/` or `/{season}/constructorstandings/`.
 *
 * The response is **untrusted input**. Nothing here coerces, trims, repairs,
 * folds case or fills a default: every value this module reads is either the
 * documented shape or the whole resource fails (ADR 0023 amendment A3, S-11).
 * A standings table is an ordering, and one silently repaired row is a wrong
 * championship order published under a right-looking season.
 *
 * **It reads only what the resource needs.** A driver row contributes its
 * provider driver identity, every provider constructor identity it lists and
 * the position, points and wins facts; a constructor row contributes its one
 * provider identity and the same three facts. Every name, code, number, date,
 * nationality and URL beside them is provider-descriptive content GridView has
 * not approved (ADR 0022 D5; A3 S-12), so it is never read and never carried
 * forward.
 *
 * **The round is validated, then dropped** (S-2). The provider chooses the
 * round a standings response is bound to; the response states it twice, once
 * on the table and once on its standings list. Both must be the same strict
 * positive integer string, and neither is returned: the normalized contract
 * has no round field. Whether a standings table from one round may be
 * published beside classifications selected through another is a separate,
 * unresolved activation decision, which this module does not answer.
 *
 * **No finality is read** (S-8). The responses carry no finality field, and a
 * field that appeared would not be read.
 *
 * **Every value is taken as an own data property.** A field inherited from a
 * prototype or served by an accessor is not the documented shape: it is refused
 * without being invoked.
 *
 * This mirrors `results-payload.ts` rather than sharing its private helpers,
 * so the existing slices stay untouched by this one.
 */

import { ownDataProperty } from '../../runtime/own-property';

/** Why a response could not be decoded. Closed, bounded, log-safe. */
export const standingsDecodeProblems = [
  'envelope',
  'pagination',
  'incomplete-page',
  'season-mismatch',
  'round',
  'round-mismatch',
  'standings-collection',
  'standing-row',
  'identity',
  'constructor-collection',
  'position',
  'position-order',
  'duplicate-position',
  'points',
  'wins',
  'duplicate-driver',
  'duplicate-constructor',
] as const;

export type StandingsDecodeProblem = (typeof standingsDecodeProblems)[number];

/** One decoded driver standing, in provider order. */
export interface DecodedDriverStanding {
  readonly driverId: string;
  /**
   * Every provider constructor identity the row lists, in provider order.
   * Never empty. The order is carried only so that nothing is lost; it is
   * never read as meaning which constructor is current (S-3).
   */
  readonly constructorIds: readonly string[];
  /** A strictly positive integer. */
  readonly position: number;
  /** The driver's season total, exactly as supplied (S-4, S-6). */
  readonly points: number;
  readonly wins: number;
}

/** One decoded constructor standing, in provider order. */
export interface DecodedConstructorStanding {
  readonly constructorId: string;
  /** A strictly positive integer. */
  readonly position: number;
  readonly points: number;
  readonly wins: number;
}

export type StandingsDecodeResult<R> =
  /** Every row in provider order. Empty only for the S-9 empty answer. */
  | { readonly ok: true; readonly rows: readonly R[] }
  | { readonly ok: false; readonly problem: StandingsDecodeProblem };

/** A plain object. `null` and arrays are not records. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** One field, only as an own data property of a record; `undefined` otherwise. */
function field(record: Record<string, unknown>, key: string): unknown {
  return ownDataProperty(record, key)?.value;
}

/** One array element, only as an own data property; a hole is `undefined`. */
function element(array: readonly unknown[], index: number): unknown {
  return field(array as unknown as Record<string, unknown>, String(index));
}

/** A non-empty string, with no trimming (ADR 0022 D4). */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** A base-10 non-negative integer string. No sign, no padding, no exponent. */
const nonNegativeIntegerPattern = /^(?:0|[1-9][0-9]*)$/;
/** A base-10 strictly positive integer string. `0` and `01` are refused. */
const positiveIntegerPattern = /^[1-9][0-9]*$/;
/**
 * A non-negative decimal points string (S-6). A fraction is accepted, since
 * fractional points are valid contract values; a sign, padding, an exponent, a
 * bare separator or surrounding whitespace is not.
 */
const pointsPattern = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

function parseInteger(value: unknown, pattern: RegExp): number | null {
  if (typeof value !== 'string' || !pattern.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

const parseNonNegativeInteger = (value: unknown): number | null =>
  parseInteger(value, nonNegativeIntegerPattern);
const parsePositiveInteger = (value: unknown): number | null =>
  parseInteger(value, positiveIntegerPattern);

/**
 * The decimal text a lossless conversion must restate: the input with any
 * trailing fractional zeros, and then a bare separator, removed. `"7.50"`
 * becomes `"7.5"` and `"7.0"` becomes `"7"`.
 */
function canonicalDecimalText(text: string): string {
  if (!text.includes('.')) return text;
  const trimmed = text.replace(/0+$/, '');
  return trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Parses one standings points value into the contract's number type (S-6).
 *
 * The text must be a strict non-negative decimal. The conversion must be
 * lossless: formatting the number back must restate the text exactly (up to
 * trailing fractional zeros), so a value whose digits a double cannot hold is
 * refused rather than rounded. A value beyond the safe-integer range, where
 * distinct decimal strings collapse onto one number, is refused too, as is
 * anything JavaScript would format with an exponent. Nothing is ever rounded.
 */
export function parseStandingPoints(value: unknown): number | null {
  if (typeof value !== 'string' || !pointsPattern.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed > Number.MAX_SAFE_INTEGER) return null;
  return String(parsed) === canonicalDecimalText(value) ? parsed : null;
}

/**
 * The position of one row (S-5). `position` must be a strict positive integer
 * string and `positionText` must restate it byte for byte, so no display
 * token - `"-"`, a letter, a blank - is ever accepted or mapped to anything.
 */
function readPosition(row: Record<string, unknown>): number | null {
  const text = field(row, 'position');
  const position = parsePositiveInteger(text);
  if (position === null) return null;
  return field(row, 'positionText') === text ? position : null;
}

/** The three facts every standings row carries, or the first bounded problem. */
function readFacts(row: Record<string, unknown>):
  | {
      readonly position: number;
      readonly points: number;
      readonly wins: number;
    }
  | StandingsDecodeProblem {
  const position = readPosition(row);
  if (position === null) return 'position';
  const points = parseStandingPoints(field(row, 'points'));
  if (points === null) return 'points';
  const wins = parseNonNegativeInteger(field(row, 'wins'));
  if (wins === null) return 'wins';
  return { position, points, wins };
}

/** The provider identity inside one nested identity object. */
function readIdentity(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const id = field(value, key);
  return isNonEmptyString(id) ? id : null;
}

/**
 * Every constructor a driver row lists (S-3, S-4). At least one is required:
 * a driver standing with no constructor reference is refused, never turned
 * into a `null` team. A repeated provider identity inside one row is a
 * contradiction, not two facts.
 */
function readRowConstructors(
  row: Record<string, unknown>,
): readonly string[] | StandingsDecodeProblem {
  const listed = field(row, 'Constructors');
  if (!Array.isArray(listed) || listed.length === 0) {
    return 'constructor-collection';
  }
  const ids: string[] = [];
  for (let index = 0; index < listed.length; index += 1) {
    const id = readIdentity(element(listed, index), 'constructorId');
    if (id === null) return 'identity';
    if (ids.includes(id)) return 'duplicate-constructor';
    ids.push(id);
  }
  return ids;
}

function readDriverStanding(
  value: unknown,
): DecodedDriverStanding | StandingsDecodeProblem {
  if (!isRecord(value)) return 'standing-row';
  const driverId = readIdentity(field(value, 'Driver'), 'driverId');
  if (driverId === null) return 'identity';
  const constructorIds = readRowConstructors(value);
  if (typeof constructorIds === 'string') return constructorIds;
  const facts = readFacts(value);
  if (typeof facts === 'string') return facts;
  return { driverId, constructorIds, ...facts };
}

function readConstructorStanding(
  value: unknown,
): DecodedConstructorStanding | StandingsDecodeProblem {
  if (!isRecord(value)) return 'standing-row';
  const constructorId = readIdentity(
    field(value, 'Constructor'),
    'constructorId',
  );
  if (constructorId === null) return 'identity';
  const facts = readFacts(value);
  if (typeof facts === 'string') return facts;
  return { constructorId, ...facts };
}

/**
 * Positions are unique and strictly increasing in response order (S-5), so
 * the provider's row order and its positions state the same ordering. They are
 * deliberately **not** required to be contiguous: nothing in the evidence
 * establishes that a gap is impossible.
 */
function checkPositions(
  rows: readonly { readonly position: number }[],
): StandingsDecodeProblem | null {
  const seen = new Set<number>();
  let previous = 0;
  for (const row of rows) {
    if (seen.has(row.position)) return 'duplicate-position';
    if (row.position < previous) return 'position-order';
    seen.add(row.position);
    previous = row.position;
  }
  return null;
}

/** One provider identity per row, for the whole resource (S-10). */
function checkUnique(
  ids: readonly string[],
  problem: StandingsDecodeProblem,
): StandingsDecodeProblem | null {
  return new Set(ids).size === ids.length ? null : problem;
}

/** Which standings resource a response answers. */
interface StandingsShape<R> {
  /** The row collection inside the one standings list. */
  readonly listKey: 'DriverStandings' | 'ConstructorStandings';
  readonly readRow: (value: unknown) => R | StandingsDecodeProblem;
  readonly checkRows: (rows: readonly R[]) => StandingsDecodeProblem | null;
}

/**
 * Decodes one complete standings response for exactly `season`.
 *
 * **Pagination is validated strictly and fails closed.** `limit`, `offset` and
 * `total` must be strict integer strings, `offset` must be 0, the echoed limit
 * must be the requested one, and on these endpoints `total` counts **standing
 * rows**, so it must equal the returned row count and fit in one page. A
 * truncated table is a table missing competitors. No second page is ever
 * requested.
 *
 * **The response must answer the question asked.** The table's season and
 * its one list's season both restate the request. The round is checked and
 * dropped (see the module comment).
 *
 * **Empty only in one exact shape** (S-9): no standings list at all, with a
 * complete page and `total "0"`. This shape was not observed; it is accepted
 * because it is the only structurally coherent empty answer, and it is marked
 * unverified in ADR 0023 A3. With no list, the table's round has nothing to
 * agree with: it may be absent, and if present it must still be a strict
 * positive integer string. A list present with no rows fails.
 */
function decodeStandings<R extends { readonly position: number }>(
  body: unknown,
  season: number,
  requestedLimit: number,
  shape: StandingsShape<R>,
): StandingsDecodeResult<R> {
  if (!isRecord(body)) return { ok: false, problem: 'envelope' };
  const mrData = field(body, 'MRData');
  if (!isRecord(mrData)) return { ok: false, problem: 'envelope' };

  const limit = parseNonNegativeInteger(field(mrData, 'limit'));
  const offset = parseNonNegativeInteger(field(mrData, 'offset'));
  const total = parseNonNegativeInteger(field(mrData, 'total'));
  if (limit === null || offset === null || total === null) {
    return { ok: false, problem: 'pagination' };
  }
  if (offset !== 0 || limit !== requestedLimit) {
    return { ok: false, problem: 'pagination' };
  }
  if (total > limit) return { ok: false, problem: 'incomplete-page' };

  const table = field(mrData, 'StandingsTable');
  if (!isRecord(table)) return { ok: false, problem: 'envelope' };
  if (field(table, 'season') !== String(season)) {
    return { ok: false, problem: 'season-mismatch' };
  }
  const tableRound = field(table, 'round');

  const lists = field(table, 'StandingsLists');
  if (!Array.isArray(lists)) {
    return { ok: false, problem: 'standings-collection' };
  }
  if (lists.length === 0) {
    if (tableRound !== undefined && parsePositiveInteger(tableRound) === null) {
      return { ok: false, problem: 'round' };
    }
    return total === 0
      ? { ok: true, rows: [] }
      : { ok: false, problem: 'incomplete-page' };
  }
  if (lists.length !== 1) {
    return { ok: false, problem: 'standings-collection' };
  }
  if (parsePositiveInteger(tableRound) === null) {
    return { ok: false, problem: 'round' };
  }

  const list = element(lists, 0);
  if (!isRecord(list)) return { ok: false, problem: 'standings-collection' };
  if (field(list, 'season') !== String(season)) {
    return { ok: false, problem: 'season-mismatch' };
  }
  const listRound = field(list, 'round');
  if (parsePositiveInteger(listRound) === null) {
    return { ok: false, problem: 'round' };
  }
  // Both are strict unpadded integer strings, so equal text is equal rounds.
  if (listRound !== tableRound) return { ok: false, problem: 'round-mismatch' };

  const collection = field(list, shape.listKey);
  if (!Array.isArray(collection) || collection.length === 0) {
    return { ok: false, problem: 'standings-collection' };
  }

  const rows: R[] = [];
  // Index access over own data properties, never the array's iterator: a hole
  // or an accessor-backed element is not a row.
  for (let index = 0; index < collection.length; index += 1) {
    const row = shape.readRow(element(collection, index));
    if (typeof row === 'string') return { ok: false, problem: row };
    rows.push(row);
  }
  // The page contradicts its own metadata, or more rows exist than returned.
  if (rows.length !== total) return { ok: false, problem: 'incomplete-page' };

  const contradiction = checkPositions(rows) ?? shape.checkRows(rows);
  if (contradiction !== null) return { ok: false, problem: contradiction };
  return { ok: true, rows };
}

/** Decodes one complete `/{season}/driverstandings/` response. */
export function decodeDriverStandings(
  body: unknown,
  season: number,
  requestedLimit: number,
): StandingsDecodeResult<DecodedDriverStanding> {
  return decodeStandings(body, season, requestedLimit, {
    listKey: 'DriverStandings',
    readRow: readDriverStanding,
    checkRows: (rows) =>
      checkUnique(
        rows.map((row) => row.driverId),
        'duplicate-driver',
      ),
  });
}

/** Decodes one complete `/{season}/constructorstandings/` response. */
export function decodeConstructorStandings(
  body: unknown,
  season: number,
  requestedLimit: number,
): StandingsDecodeResult<DecodedConstructorStanding> {
  return decodeStandings(body, season, requestedLimit, {
    listKey: 'ConstructorStandings',
    readRow: readConstructorStanding,
    checkRows: (rows) =>
      checkUnique(
        rows.map((row) => row.constructorId),
        'duplicate-constructor',
      ),
  });
}
