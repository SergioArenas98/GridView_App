/**
 * Strict decoding of one Jolpica race-results response:
 * `/{season}/{round}/results/`.
 *
 * The response is **untrusted input**. Nothing here coerces, trims, repairs,
 * folds case or fills a default: every value this module reads is either the
 * documented shape or the whole resource fails. A classification is an
 * identity-bearing document, and one silently repaired row is a wrong result
 * published under a right-looking round.
 *
 * **It reads only what the resource needs.** A race contributes its locator
 * (`round`, `raceName`, `Circuit.circuitId`) and nothing else. A row
 * contributes its two provider identities and the classification facts the
 * normalized contract has a field for. The car number, every name, code, date,
 * nationality and URL, the race date and time and every circuit description are
 * provider-descriptive content GridView has not approved (ADR 0022 D5), so they
 * are never read and never carried forward.
 *
 * **Every value is taken as an own data property.** A field inherited from a
 * prototype or served by an accessor is not the documented shape: it is refused
 * without being invoked.
 *
 * **The status vocabulary is closed** (ADR 0023 amendment A2, curator decision
 * C-5). Exactly the `status` / `positionText` pairs observed in the 2026 rounds
 * 1-14 evidence are accepted, each with an approved meaning. Any other pair -
 * including a disqualification, an exclusion, a non-qualification or a
 * not-classified code, should one appear - fails the whole resource. Nothing is
 * guessed and no row is dropped.
 *
 * This mirrors `participants-payload.ts` rather than sharing its private
 * helpers, so the existing slices stay untouched by this one.
 */

import { ownDataProperty } from '../../runtime/own-property';

/** Why a response could not be decoded. Closed, bounded, log-safe. */
export const resultsDecodeProblems = [
  'envelope',
  'pagination',
  'incomplete-page',
  'season-mismatch',
  'round-mismatch',
  'race-collection',
  'race-row',
  'race-name',
  'circuit-id',
  'result-collection',
  'result-row',
  'identity',
  'position',
  'status',
  'points',
  'grid',
  'laps',
  'time',
  'fastest-lap',
  'fastest-lap-time',
  'winner',
  'duplicate-driver',
  'duplicate-position',
  'duplicate-fastest-lap-rank',
] as const;

export type ResultsDecodeProblem = (typeof resultsDecodeProblems)[number];

/**
 * The approved meaning of one provider row, decided by the closed status table.
 *
 * - `finished` - `Finished` with a numeric `positionText`.
 * - `lapped` - `Lapped` with a numeric `positionText`.
 * - `lapped-display-retired` - `Lapped` with `positionText` `R` (curator
 *   decision C-2). The structured status governs: the row is classified and
 *   lapped, and keeps its numeric `position`. The `R` token is a presentation
 *   value and is never carried forward.
 * - `retired-classified` - `Retired` with a numeric `positionText` (C-4). A
 *   retirement the provider still classifies: it keeps its position.
 * - `retired` - `Retired` with `positionText` `R`. Unclassified.
 * - `did-not-start` - `Did not start` with `positionText` `W`. Unclassified,
 *   and still a participation fact (ADR 0026 D3).
 */
export type ResultRowClass =
  | 'finished'
  | 'lapped'
  | 'lapped-display-retired'
  | 'retired-classified'
  | 'retired'
  | 'did-not-start';

/** Whether a row class keeps a classified position. */
export const classifiedRowClasses: ReadonlySet<ResultRowClass> = new Set([
  'finished',
  'lapped',
  'lapped-display-retired',
  'retired-classified',
]);

/** The `positionText` shapes the status table distinguishes. */
type PositionTextShape = 'numeric' | 'R' | 'W';

/**
 * The closed status table (C-5): every accepted `(status, positionText)` pair,
 * and nothing else. Each entry is observed in the 2026 rounds 1-14 evidence.
 */
export const resultStatusTable: readonly {
  readonly status: string;
  readonly positionText: PositionTextShape;
  readonly rowClass: ResultRowClass;
}[] = [
  { status: 'Finished', positionText: 'numeric', rowClass: 'finished' },
  { status: 'Lapped', positionText: 'numeric', rowClass: 'lapped' },
  { status: 'Lapped', positionText: 'R', rowClass: 'lapped-display-retired' },
  {
    status: 'Retired',
    positionText: 'numeric',
    rowClass: 'retired-classified',
  },
  { status: 'Retired', positionText: 'R', rowClass: 'retired' },
  { status: 'Did not start', positionText: 'W', rowClass: 'did-not-start' },
];

/** One decoded fastest-lap block. */
export interface DecodedFastestLap {
  readonly rank: number;
  readonly lap: number;
  /** Exact milliseconds of the lap, or `null` when the provider gave no time. */
  readonly timeMillis: number | null;
}

/** One decoded classification row. */
export interface DecodedResultRow {
  readonly driverId: string;
  readonly constructorId: string;
  /** The provider's own ordering position. Always a positive integer. */
  readonly position: number;
  readonly rowClass: ResultRowClass;
  readonly points: number;
  /** `null` for `0`, an empty string or an absent value (C-6). */
  readonly grid: number | null;
  readonly laps: number;
  /** The row's `Time.millis`, when a `Time` block is present. */
  readonly elapsedMillis: number | null;
  readonly fastestLap: DecodedFastestLap | null;
}

/** One decoded race: its locator and every row, in provider order. */
export interface DecodedRaceResult {
  readonly round: number;
  readonly raceName: string;
  readonly circuitId: string;
  readonly rows: readonly DecodedResultRow[];
}

export type ResultsDecodeResult =
  | { readonly ok: true; readonly race: DecodedRaceResult }
  /**
   * A structurally valid response with no race in it (C-9). Not a failure of
   * decoding, and not a classification either: it names no event, so no
   * result document can be built from it.
   */
  | { readonly ok: true; readonly race: null }
  | { readonly ok: false; readonly problem: ResultsDecodeProblem };

function fail(problem: ResultsDecodeProblem): ResultsDecodeResult {
  return { ok: false, problem };
}

/** A plain object. `null` and arrays are not records. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** One field, only as an own data property of a record; `undefined` otherwise. */
function field(record: Record<string, unknown>, key: string): unknown {
  return ownDataProperty(record, key)?.value;
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
 * A non-negative decimal points string. Fractional points are valid contract
 * values (GridView_Domain_Model.md §5.1), so a fraction is accepted; a sign,
 * padding, an exponent or a bare separator is not.
 */
const pointsPattern = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
/**
 * The one fastest-lap time grammar observed in the evidence (C-7): one minute
 * digit, two second digits below 60, and exactly three millisecond digits.
 * Anything else that is present is malformed, never approximated.
 */
const fastestLapTimePattern = /^([0-9]):([0-5][0-9])\.([0-9]{3})$/;

function parseInteger(value: unknown, pattern: RegExp): number | null {
  if (typeof value !== 'string' || !pattern.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

const parseNonNegativeInteger = (value: unknown): number | null =>
  parseInteger(value, nonNegativeIntegerPattern);
const parsePositiveInteger = (value: unknown): number | null =>
  parseInteger(value, positiveIntegerPattern);

function parsePoints(value: unknown): number | null {
  if (typeof value !== 'string' || !pointsPattern.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Converts one fastest-lap time to exact milliseconds (C-7).
 *
 * Integer arithmetic over the three captured groups, so nothing is rounded and
 * no floating-point seconds value ever exists.
 */
export function parseFastestLapTime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parts = fastestLapTimePattern.exec(value);
  if (parts === null) return null;
  const minutes = Number(parts[1]);
  const seconds = Number(parts[2]);
  const millis = Number(parts[3]);
  return minutes * 60_000 + seconds * 1_000 + millis;
}

/**
 * The starting grid slot (C-6).
 *
 * A positive integer is the slot the provider established. `0`, an empty string
 * and an absent value all mean no slot was established, and become `null`:
 * `null` is not read as a pit-lane start, and no slot is invented. Anything else
 * is malformed.
 */
function readGrid(value: unknown): number | null | 'invalid' {
  if (value === undefined || value === '' || value === '0') return null;
  return parsePositiveInteger(value) ?? 'invalid';
}

function positionTextShape(
  value: unknown,
  position: number,
): PositionTextShape | null {
  if (value === 'R' || value === 'W') return value;
  // A numeric display position must restate the structured one exactly.
  return value === String(position) ? 'numeric' : null;
}

function rowClassFor(
  status: unknown,
  shape: PositionTextShape,
): ResultRowClass | null {
  for (const entry of resultStatusTable) {
    if (entry.status === status && entry.positionText === shape) {
      return entry.rowClass;
    }
  }
  return null;
}

/**
 * Reads an optional `Time` block. Only its `millis` can matter downstream, and
 * only for the winner; the display `time` text is checked to be a string and
 * is never parsed, because on a lapped row it is not a gap (C-3, C-8).
 */
function readTime(row: Record<string, unknown>): number | null | 'absent' {
  const time = field(row, 'Time');
  if (time === undefined) return 'absent';
  if (!isRecord(time)) return null;
  if (typeof field(time, 'time') !== 'string') return null;
  return parsePositiveInteger(field(time, 'millis'));
}

function readFastestLap(
  row: Record<string, unknown>,
): DecodedFastestLap | 'absent' | ResultsDecodeProblem {
  const block = field(row, 'FastestLap');
  if (block === undefined) return 'absent';
  if (!isRecord(block)) return 'fastest-lap';
  const rank = parsePositiveInteger(field(block, 'rank'));
  const lap = parsePositiveInteger(field(block, 'lap'));
  if (rank === null || lap === null) return 'fastest-lap';

  // A block may legitimately omit its time (C-7). A time that is present must
  // be the observed grammar.
  const time = field(block, 'Time');
  if (time === undefined) return { rank, lap, timeMillis: null };
  if (!isRecord(time)) return 'fastest-lap-time';
  const timeMillis = parseFastestLapTime(field(time, 'time'));
  if (timeMillis === null) return 'fastest-lap-time';
  return { rank, lap, timeMillis };
}

function readRow(value: unknown): DecodedResultRow | ResultsDecodeProblem {
  if (!isRecord(value)) return 'result-row';

  const driver = field(value, 'Driver');
  const constructor = field(value, 'Constructor');
  if (!isRecord(driver) || !isRecord(constructor)) return 'identity';
  const driverId = field(driver, 'driverId');
  const constructorId = field(constructor, 'constructorId');
  if (!isNonEmptyString(driverId) || !isNonEmptyString(constructorId)) {
    return 'identity';
  }

  const position = parsePositiveInteger(field(value, 'position'));
  if (position === null) return 'position';
  const shape = positionTextShape(field(value, 'positionText'), position);
  if (shape === null) return 'status';
  const rowClass = rowClassFor(field(value, 'status'), shape);
  if (rowClass === null) return 'status';

  const points = parsePoints(field(value, 'points'));
  if (points === null) return 'points';
  const grid = readGrid(field(value, 'grid'));
  if (grid === 'invalid') return 'grid';
  const laps = parseNonNegativeInteger(field(value, 'laps'));
  if (laps === null) return 'laps';

  const time = readTime(value);
  if (time === null) return 'time';
  // An unclassified row has no race time to state.
  if (time !== 'absent' && !classifiedRowClasses.has(rowClass)) return 'time';

  const fastestLap = readFastestLap(value);
  if (typeof fastestLap === 'string' && fastestLap !== 'absent') {
    return fastestLap;
  }
  if (fastestLap !== 'absent') {
    // A car that did not start set no lap, and no car sets its fastest lap on
    // a lap it never completed.
    if (rowClass === 'did-not-start' || fastestLap.lap > laps) {
      return 'fastest-lap';
    }
  }

  return {
    driverId,
    constructorId,
    position,
    rowClass,
    points,
    grid,
    laps,
    elapsedMillis: time === 'absent' ? null : time,
    fastestLap: fastestLap === 'absent' ? null : fastestLap,
  };
}

function isDecodedRow(
  value: DecodedResultRow | ResultsDecodeProblem,
): value is DecodedResultRow {
  return typeof value !== 'string';
}

/**
 * Checks every relation between rows. Nothing is repaired: any contradiction
 * fails the resource.
 *
 * - One row per driver, one row per position, and the positions are exactly
 *   `1..n`, so the classification is a complete ordering, with every
 *   classified row ahead of every unclassified one.
 * - The winner is the `finished` row at position 1 and carries its race time.
 * - Every `finished` row completed the winner's laps, every lapped row
 *   completed strictly fewer (C-3), and no row completed more.
 * - No fastest-lap rank repeats.
 */
function checkRows(
  rows: readonly DecodedResultRow[],
): ResultsDecodeProblem | null {
  const drivers = new Set<string>();
  const positions = new Set<number>();
  const ranks = new Set<number>();
  for (const row of rows) {
    if (drivers.has(row.driverId)) return 'duplicate-driver';
    drivers.add(row.driverId);
    if (positions.has(row.position)) return 'duplicate-position';
    positions.add(row.position);
    if (row.fastestLap !== null) {
      if (ranks.has(row.fastestLap.rank)) return 'duplicate-fastest-lap-rank';
      ranks.add(row.fastestLap.rank);
    }
  }
  for (let position = 1; position <= rows.length; position += 1) {
    if (!positions.has(position)) return 'position';
  }
  // Classified rows occupy the leading positions, so the published positions
  // are `1..k` with no gap. A classified row ranked below an unclassified one
  // contradicts the ordering it is published in.
  let firstUnclassified = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (!classifiedRowClasses.has(row.rowClass)) {
      firstUnclassified = Math.min(firstUnclassified, row.position);
    }
  }
  for (const row of rows) {
    if (
      classifiedRowClasses.has(row.rowClass) &&
      row.position > firstUnclassified
    ) {
      return 'position';
    }
  }

  const winner = rows.find((row) => row.position === 1);
  if (
    winner === undefined ||
    winner.rowClass !== 'finished' ||
    winner.elapsedMillis === null
  ) {
    return 'winner';
  }
  for (const row of rows) {
    if (row.laps > winner.laps) return 'laps';
    if (row.rowClass === 'finished' && row.laps !== winner.laps) return 'laps';
    const lapped =
      row.rowClass === 'lapped' || row.rowClass === 'lapped-display-retired';
    if (lapped && row.laps >= winner.laps) return 'laps';
  }
  return null;
}

function readRace(
  value: unknown,
  season: number,
  round: number,
): DecodedRaceResult | ResultsDecodeProblem {
  if (!isRecord(value)) return 'race-row';
  if (field(value, 'season') !== String(season)) return 'season-mismatch';
  if (parsePositiveInteger(field(value, 'round')) !== round) {
    return 'round-mismatch';
  }

  const raceName = field(value, 'raceName');
  if (!isNonEmptyString(raceName)) return 'race-name';
  const circuit = field(value, 'Circuit');
  if (!isRecord(circuit)) return 'circuit-id';
  const circuitId = field(circuit, 'circuitId');
  if (!isNonEmptyString(circuitId)) return 'circuit-id';

  const results = field(value, 'Results');
  if (!Array.isArray(results)) return 'result-collection';
  // A race listed with no rows is not a classification. The empty form Jolpica
  // answers for a race without results is an empty race list (C-9).
  if (results.length === 0) return 'result-collection';

  const rows: DecodedResultRow[] = [];
  // Index access over own data properties, never the array's iterator: a hole
  // or an accessor-backed element is not a row.
  for (let index = 0; index < results.length; index += 1) {
    const row = readRow(
      field(results as unknown as Record<string, unknown>, String(index)),
    );
    if (!isDecodedRow(row)) return row;
    rows.push(row);
  }
  const contradiction = checkRows(rows);
  if (contradiction !== null) return contradiction;

  return { round, raceName, circuitId, rows };
}

/**
 * Decodes one complete race-results response for exactly `(season, round)`.
 *
 * **Pagination is validated strictly and fails closed.** `limit`, `offset` and
 * `total` must be strict integer strings, `offset` must be 0, the echoed limit
 * must be the requested one, and on this endpoint `total` counts **result
 * rows**, so it must equal the returned row count and fit in one page. A
 * truncated classification is a classification missing drivers. No second page
 * is ever requested.
 *
 * **The response must answer the question asked.** The table's season and
 * round, and the race's own season and round, all restate the request.
 *
 * **Exactly one race when a result exists.** An empty race list with a zero
 * total is the structurally valid "no classification" answer (C-9) and decodes
 * to `race: null`. More than one race fails.
 */
export function decodeRaceResults(
  body: unknown,
  season: number,
  round: number,
  requestedLimit: number,
): ResultsDecodeResult {
  if (!isRecord(body)) return fail('envelope');
  const mrData = field(body, 'MRData');
  if (!isRecord(mrData)) return fail('envelope');

  const limit = parseNonNegativeInteger(field(mrData, 'limit'));
  const offset = parseNonNegativeInteger(field(mrData, 'offset'));
  const total = parseNonNegativeInteger(field(mrData, 'total'));
  if (limit === null || offset === null || total === null) {
    return fail('pagination');
  }
  if (offset !== 0 || limit !== requestedLimit) return fail('pagination');
  if (total > limit) return fail('incomplete-page');

  const table = field(mrData, 'RaceTable');
  if (!isRecord(table)) return fail('envelope');
  if (field(table, 'season') !== String(season)) return fail('season-mismatch');
  if (parsePositiveInteger(field(table, 'round')) !== round) {
    return fail('round-mismatch');
  }

  const races = field(table, 'Races');
  if (!Array.isArray(races)) return fail('race-collection');
  if (races.length === 0) {
    return total === 0 ? { ok: true, race: null } : fail('incomplete-page');
  }
  if (races.length !== 1) return fail('race-collection');

  const race = readRace(
    field(races as unknown as Record<string, unknown>, '0'),
    season,
    round,
  );
  if (typeof race === 'string') return fail(race);
  // The page contradicts its own metadata, or more rows exist than returned.
  if (race.rows.length !== total) return fail('incomplete-page');
  return { ok: true, race };
}
