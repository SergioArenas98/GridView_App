/**
 * Strict decoding of the two Jolpica season-participants responses:
 * `/{season}/drivers/` and `/{season}/constructors/`.
 *
 * The responses are **untrusted input**. Nothing here coerces, trims, repairs,
 * folds case or fills a default: every value this module reads is either the
 * documented shape or the whole resource fails.
 *
 * **It reads only what the resource needs.** A driver row contributes exactly
 * its `driverId`, and a constructor row exactly its `constructorId`. Those are
 * the provider identities the curated mappings resolve (ADR 0026 D2). Given and
 * family names, codes, permanent numbers, dates and places of birth,
 * nationalities, constructor names and every URL are provider-descriptive
 * content GridView has not approved (ADR 0022 D5), so they are never read,
 * never validated into meaning and never carried forward. Canonical names and
 * facts come from the curated registries only (`curated-participants.ts`).
 *
 * **No row count is assumed.** The preserved 2026 captures held 32 drivers and
 * 11 constructors, but nothing here states how many rows a season should have:
 * each page is decoded completely, against its own metadata, or refused.
 *
 * **Every value is taken as an own data property.** A field inherited from a
 * prototype or served by an accessor is not the documented shape: it is
 * refused without being invoked, so a hostile value cannot answer one thing to
 * validation and another afterwards, and cannot throw from a read.
 *
 * This otherwise mirrors `circuits-payload.ts` rather than sharing its private
 * helpers, so the existing slices stay untouched by this one.
 */

import { ownDataProperty } from '../../runtime/own-property';

/** Why a response could not be decoded. Closed, bounded, log-safe. */
export const participantsDecodeProblems = [
  'envelope',
  'pagination',
  'incomplete-page',
  'season-mismatch',
  'collection',
  'row',
  'identity',
  'duplicate-identity',
] as const;

export type ParticipantsDecodeProblem =
  (typeof participantsDecodeProblems)[number];

/** One decoded driver row: the exact provider identity and nothing else. */
export interface DecodedDriver {
  readonly driverId: string;
}

/** One decoded constructor row: the exact provider identity and nothing else. */
export interface DecodedConstructor {
  readonly constructorId: string;
}

export type DriversDecodeResult =
  | { readonly ok: true; readonly drivers: readonly DecodedDriver[] }
  | { readonly ok: false; readonly problem: ParticipantsDecodeProblem };

export type ConstructorsDecodeResult =
  | { readonly ok: true; readonly constructors: readonly DecodedConstructor[] }
  | { readonly ok: false; readonly problem: ParticipantsDecodeProblem };

/** Where one identity table lives in the Ergast-compatible envelope. */
interface IdentityTable {
  readonly table: 'DriverTable' | 'ConstructorTable';
  readonly rows: 'Drivers' | 'Constructors';
  readonly identity: 'driverId' | 'constructorId';
}

type IdentityDecodeResult =
  | { readonly ok: true; readonly identities: readonly string[] }
  | { readonly ok: false; readonly problem: ParticipantsDecodeProblem };

function fail(problem: ParticipantsDecodeProblem): IdentityDecodeResult {
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

/**
 * Decodes one complete identity page.
 *
 * **Pagination is validated strictly and fails closed**, on exactly the terms
 * the calendar and circuits use: `offset` at the start, the echoed `limit` as
 * requested, and a `total` the returned collection covers exactly. A `total`
 * beyond the limit means more rows exist than were returned, and a truncated
 * identity list would silently omit a participant (ADR 0026 D13). No second
 * page is ever requested.
 *
 * **Duplicate provider identities fail the resource.** Two rows naming one
 * identity is a contradictory payload, not a repeated fact to be merged.
 */
function decodeIdentityTable(
  body: unknown,
  season: number,
  requestedLimit: number,
  shape: IdentityTable,
): IdentityDecodeResult {
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

  const table = field(mrData, shape.table);
  if (!isRecord(table)) return fail('envelope');
  // The table restates the season it answers for, and must agree with the
  // request. A participant row carries no season of its own.
  if (field(table, 'season') !== String(season)) return fail('season-mismatch');

  const rows = field(table, shape.rows);
  if (!Array.isArray(rows)) return fail('collection');

  // More rows exist upstream than this page returned, or the page contradicts
  // its own metadata. Either way the collection is not the one declared.
  if (total > limit || rows.length !== total) return fail('incomplete-page');

  const identities: string[] = [];
  const seen = new Set<string>();
  // Index access over own data properties, never the array's iterator: a hole
  // or an accessor-backed element is not a row.
  for (let index = 0; index < total; index += 1) {
    const row = field(
      rows as unknown as Record<string, unknown>,
      String(index),
    );
    if (!isRecord(row)) return fail('row');
    // Only the identity leaves this loop. Every other field of the row,
    // well-formed or not, is dropped here unread.
    const identity = field(row, shape.identity);
    if (!isNonEmptyString(identity)) return fail('identity');
    if (seen.has(identity)) return fail('duplicate-identity');
    seen.add(identity);
    identities.push(identity);
  }
  return { ok: true, identities };
}

/** Decodes one complete `/{season}/drivers/` response. */
export function decodeSeasonDrivers(
  body: unknown,
  season: number,
  requestedLimit: number,
): DriversDecodeResult {
  const decoded = decodeIdentityTable(body, season, requestedLimit, {
    table: 'DriverTable',
    rows: 'Drivers',
    identity: 'driverId',
  });
  return decoded.ok
    ? {
        ok: true,
        drivers: decoded.identities.map((driverId) => ({ driverId })),
      }
    : decoded;
}

/** Decodes one complete `/{season}/constructors/` response. */
export function decodeSeasonConstructors(
  body: unknown,
  season: number,
  requestedLimit: number,
): ConstructorsDecodeResult {
  const decoded = decodeIdentityTable(body, season, requestedLimit, {
    table: 'ConstructorTable',
    rows: 'Constructors',
    identity: 'constructorId',
  });
  return decoded.ok
    ? {
        ok: true,
        constructors: decoded.identities.map((constructorId) => ({
          constructorId,
        })),
      }
    : decoded;
}
