/**
 * The revision one selected observation is recorded under, and the calendar
 * anchors a calendar observation carries (decision pack §6.4).
 *
 * The ledger holds revisions, never payloads. Two rules decide them:
 *
 * - **A race classification** is hashed exactly as the release that would
 *   publish it: `snapshotRevision` of a `grand-prix:{round}:results` document
 *   whose `data` is the selected `RaceResult`. That is the rule the
 *   authoritative release's revisions are recomputed with before they are
 *   reconciled into `publishedRevision`, so an accepted revision and a
 *   published revision compare equal exactly when the content is the same.
 *   The rule lives in `../classification-revision.ts`, shared with operator
 *   verification, and is re-exported here.
 * - **A season-level refresh resource** is compared only with its own earlier
 *   observations, and its payload is not the shape of any one public
 *   document. It is hashed as a domain-separated canonical JSON text of the
 *   whole normalized payload, so every field it carries contributes. Nothing
 *   is projected away.
 *
 * Either answers `null` when the selected payload cannot be hashed or does
 * not describe what was asked. That is a malformed selection, and the run
 * fails closed on it: nothing is committed.
 */

import type { CoordinatedPayload } from '../../../providers/coordination';
import {
  compareUtf8,
  encodeUtf8,
} from '../../../publication/canonical/ordering';
import {
  MAXIMUM_ROUND,
  type CalendarAnchor,
  type RevisionHash,
} from '../ledger/model';
import { calendarAnchor } from '../policy';

export {
  PUBLISHED_SNAPSHOT_SCHEMA_VERSION,
  classificationRevision,
} from '../classification-revision';

/** The format of the refresh-resource digest. Inside the hashed bytes. */
export const OBSERVATION_REVISION_FORMAT = 'gv-observation/1';

/** Deeper than any normalized payload; a guard against a hostile shape only. */
const MAXIMUM_DEPTH = 32;

/**
 * The revision of one season-level payload, or `null` when it is not plain
 * JSON data (a non-finite number, `undefined`, a function, a cycle).
 */
export async function refreshRevision(
  payload: CoordinatedPayload,
): Promise<RevisionHash | null> {
  const text = canonicalJson(payload, 0);
  if (text === null) return null;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encodeUtf8(
      `${OBSERVATION_REVISION_FORMAT}${text}`,
    ) as unknown as BufferSource,
  );
  let hex = '';
  for (const byte of new Uint8Array(digest)) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return `sha256:${hex}`;
}

/**
 * Canonical JSON: object keys in UTF-8 byte order, arrays in their own order,
 * and `JSON.stringify` spelling for every scalar. Injective over plain JSON
 * data, which is all a detached normalized payload can hold.
 */
function canonicalJson(value: unknown, depth: number): string | null {
  if (depth > MAXIMUM_DEPTH) return null;
  if (value === null || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    return Number.isFinite(value) ? JSON.stringify(value) : null;
  }
  if (Array.isArray(value)) {
    const items: string[] = [];
    for (const item of value) {
      const text = canonicalJson(item, depth + 1);
      if (text === null) return null;
      items.push(text);
    }
    return `[${items.join(',')}]`;
  }
  if (typeof value !== 'object') return null;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  return plainObject(value, depth);
}

function plainObject(value: object, depth: number): string | null {
  const entries: string[] = [];
  const keys = Object.keys(value).sort(compareUtf8);
  for (const key of keys) {
    const text = canonicalJson(
      (value as Record<string, unknown>)[key],
      depth + 1,
    );
    if (text === null) return null;
    entries.push(`${JSON.stringify(key)}:${text}`);
  }
  return `{${entries.join(',')}}`;
}

const raceInstantPattern = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}Z)$/;

/**
 * The race anchors a selected calendar carries, sorted by round, or `null`
 * when the calendar cannot yield them.
 *
 * Every event must belong to the season, name a distinct round in range and
 * carry exactly one race session with a complete UTC start. The Jolpica
 * calendar port already requires the race instant (A8), so a race without one
 * never reaches here; if it did, it would be refused rather than anchored at
 * the end of its day.
 */
export function calendarAnchorsOf(
  payload: CoordinatedPayload,
  season: number,
): CalendarAnchor[] | null {
  if (payload.kind !== 'season-calendar') return null;
  if (payload.events.length > MAXIMUM_ROUND) return null;
  const anchors: CalendarAnchor[] = [];
  const rounds = new Set<number>();
  for (const event of payload.events) {
    if (event.season !== season) return null;
    if (
      !Number.isSafeInteger(event.round) ||
      event.round < 1 ||
      event.round > MAXIMUM_ROUND ||
      rounds.has(event.round)
    ) {
      return null;
    }
    rounds.add(event.round);
    const races = event.sessions.filter((session) => session.type === 'race');
    if (races.length !== 1) return null;
    const match = raceInstantPattern.exec(races[0]!.startTime ?? '');
    if (match === null) return null;
    const anchor = calendarAnchor(event.round, match[1]!, match[2]!);
    if (anchor === null) return null;
    anchors.push(anchor);
  }
  return anchors.sort((left, right) => left.round - right.round);
}
