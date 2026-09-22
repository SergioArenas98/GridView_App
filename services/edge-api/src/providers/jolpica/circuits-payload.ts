/**
 * Strict decoding of the Jolpica season-circuits response.
 *
 * The response is **untrusted input**. Nothing here coerces, trims, repairs,
 * folds case or fills a default: every value this module reads is either the
 * documented shape or the whole resource fails.
 *
 * **It reads only what the resource needs.** A circuit row contributes exactly
 * one value, its `circuitId`, which is the provider identity the curated
 * mapping resolves. Everything published beside it - `circuitName`, `url` and
 * the whole `Location` block with its coordinates, locality and country - is
 * provider-descriptive content GridView has not approved (Provider Evaluation
 * §8.8.1; ADR 0022 D5), so it is never read, never validated into meaning and
 * never carried forward. Canonical names and facts come from the curated
 * registry only (`curated-circuits.ts`).
 *
 * The row count is **not** assumed to equal the calendar's. Provider
 * Evaluation §8.4 recorded 24 circuits against 23 races (gap M8), so this
 * module states nothing about how many rows a season should have: it decodes
 * the page it was given, completely, or refuses it.
 *
 * This deliberately mirrors `calendar-payload.ts` rather than sharing its
 * private helpers, so the calendar slice stays untouched by this one.
 */

/** Why a response could not be decoded. Closed, bounded, log-safe. */
export const circuitsDecodeProblems = [
  'envelope',
  'pagination',
  'incomplete-page',
  'season-mismatch',
  'circuit-collection',
  'circuit-row',
  'circuit-id',
  'duplicate-circuit-id',
] as const;

export type CircuitsDecodeProblem = (typeof circuitsDecodeProblems)[number];

/**
 * One decoded circuit row: the exact provider identity and nothing else.
 *
 * `circuitId` is the **exact** provider string. Any adjustment to it is a
 * different identity, which is why nothing here trims or folds it.
 */
export interface DecodedCircuit {
  readonly circuitId: string;
}

export type CircuitsDecodeResult =
  | { readonly ok: true; readonly circuits: readonly DecodedCircuit[] }
  | { readonly ok: false; readonly problem: CircuitsDecodeProblem };

function fail(problem: CircuitsDecodeProblem): CircuitsDecodeResult {
  return { ok: false, problem };
}

/** A plain object. `null` and arrays are not records. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A non-empty string, with no trimming.
 *
 * A padded provider value is **not** accepted as its trimmed form: trimming
 * into a match is the lenient coercion ADR 0022 D4 forbids.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** A base-10 non-negative integer string. No sign, no padding, no exponent. */
const nonNegativeIntegerPattern = /^(?:0|[1-9][0-9]*)$/;

/**
 * The one wire-level numeric conversion this resource makes.
 *
 * Ergast-compatible pagination metadata arrives as strings (`"100"`), so a JSON
 * number, a non-finite value, a sign, a fraction, an exponent, padding or
 * whitespace are all refused rather than coerced. A value beyond the safe
 * integer range is refused too, so no precision is silently lost.
 */
function parseNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== 'string' || !nonNegativeIntegerPattern.test(value)) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function readCircuit(value: unknown): DecodedCircuit | CircuitsDecodeProblem {
  if (!isRecord(value)) return 'circuit-row';
  const circuitId = value.circuitId;
  if (!isNonEmptyString(circuitId)) return 'circuit-id';
  // Only the identity leaves this function. Every other field of the row,
  // well-formed or not, is dropped here unread.
  return { circuitId };
}

/**
 * Decodes one complete season-circuits response.
 *
 * **Pagination is validated strictly and fails closed**, on exactly the terms
 * the calendar uses: `offset` at the start, the echoed `limit` as requested,
 * and a `total` the returned collection covers exactly. A `total` beyond the
 * limit means more rows exist than were returned, and a truncated circuit
 * collection could silently omit the circuit a calendar event points at. One
 * resource maps to one transport attempt, so no multi-page accounting is
 * invented here.
 *
 * **Duplicate provider identities fail the resource.** Two rows naming one
 * `circuitId` is a contradictory payload, not a repeated fact to be merged:
 * nothing here can decide which row is authoritative.
 */
export function decodeSeasonCircuits(
  body: unknown,
  season: number,
  requestedLimit: number,
): CircuitsDecodeResult {
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

  const circuitTable = mrData.CircuitTable;
  if (!isRecord(circuitTable)) return fail('envelope');
  // The table restates the season it answers for, and must agree with the
  // request. A circuit row carries no season of its own, so this is the only
  // place the response can say which season it describes.
  if (circuitTable.season !== String(season)) return fail('season-mismatch');

  const rows = circuitTable.Circuits;
  if (!Array.isArray(rows)) return fail('circuit-collection');

  // More rows exist upstream than this page returned, or the page contradicts
  // its own metadata. Either way the collection is not the one declared.
  if (total > limit || rows.length !== total) return fail('incomplete-page');

  const decoded: DecodedCircuit[] = [];
  const seen = new Set<string>();
  for (const raw of rows) {
    const circuit = readCircuit(raw);
    if (typeof circuit === 'string') return fail(circuit);
    if (seen.has(circuit.circuitId)) return fail('duplicate-circuit-id');
    seen.add(circuit.circuitId);
    decoded.push(circuit);
  }

  return { ok: true, circuits: decoded };
}
