/**
 * The logical publication instant: the one `meta.generatedAt` every document
 * of a committed release carries
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D4, amended 2026-10-14).
 *
 * A release's instant is identical across its documents - including the
 * content manifest and Home's embedded `data.freshness.generatedAt` - and
 * strictly later than the instant of the release it replaces. It is derived
 * from two inputs only, both read before `prepare`:
 *
 * - **the clock** - the candidate's own generation reading for ordinary
 *   publication, the caller's clock for rollback-republication;
 * - **the active release** - the latest `generatedAt` among the immutable
 *   documents of the exact version `prepare` binds as the predecessor.
 *
 * `max(clock, activeInstant + 1 ms)`, spelled at millisecond precision. No
 * floor is stored anywhere: the active release *is* the floor, and only a
 * committed release can become one, so a candidate that fails before
 * `finalize` advances nothing. `prepare` refuses a predecessor that is no
 * longer active and `finalize` re-asserts it (ADR 0026 D16), so the release
 * read here is the one the commit replaces.
 *
 * Nothing here writes. Every refusal is returned before `prepare`.
 */

import {
  boundedInstant,
  canonicalInstant,
  compareInstants,
} from '../canonical/instant';
import { isEnvelopeFor } from '../guard/predecessor';
import { readStoredInventory } from '../version-inventory';
import type {
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
} from '../../storage/types';

/**
 * The latest instant an active release published, or why it is not known.
 *
 * - `unavailable` - its inventory or a document could not be read, or read as
 *   absent. Workers KV visibility is eventual, so this is never an empty
 *   release.
 * - `invalid` - what was read is not a release whose instants can be ordered.
 */
export type ActivePublicationInstant =
  | { readonly kind: 'instant'; readonly value: string }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'invalid' };

/** Why no instant could be derived. Both are refusals with no write. */
export type PublicationInstantRefusal = 'invalid' | 'exhausted';

export type PublicationInstant =
  | { readonly kind: 'derived'; readonly generatedAt: string }
  | { readonly kind: 'refused'; readonly reason: PublicationInstantRefusal };

const unavailable: ActivePublicationInstant = { kind: 'unavailable' };
const invalid: ActivePublicationInstant = { kind: 'invalid' };

/**
 * Reads every document the active version's inventory names and returns the
 * latest `generatedAt` among them.
 *
 * The latest, not the manifest's alone: a release committed before this rule
 * existed is not promised to be uniform, and "strictly later than the active
 * release" must hold against every instant it ever served.
 */
export async function readActivePublicationInstant(
  storage: SnapshotStorage,
  season: number,
  version: string,
): Promise<ActivePublicationInstant> {
  const inventory = await readStoredInventory(storage, season, version);
  if (inventory.kind === 'unreadable' || inventory.kind === 'absent') {
    return unavailable;
  }
  if (inventory.kind === 'malformed' || inventory.documents.length === 0) {
    return invalid;
  }

  let latest: string | null = null;
  for (const name of inventory.documents) {
    const document = await readDocument(storage, season, version, name);
    if (document === 'unavailable') return unavailable;
    if (!isEnvelopeFor(document, name)) return invalid;
    for (const value of documentInstants(document)) {
      if (typeof value !== 'string' || canonicalInstant(value) === null) {
        return invalid;
      }
      if (latest === null || compareInstants(value, latest) === 1) {
        latest = value;
      }
    }
  }
  return latest === null ? invalid : { kind: 'instant', value: latest };
}

/**
 * The one generation instant a candidate set carries, or `null` when its
 * documents disagree or carry no usable instant. The generator stamps one
 * reading on every document; anything else is not a candidate this rule can
 * publish as one release.
 */
export function candidateGenerationInstant(
  documents: readonly StoredSnapshot[],
): string | null {
  let instant: string | null = null;
  for (const document of documents) {
    for (const value of documentInstants(document)) {
      if (typeof value !== 'string' || canonicalInstant(value) === null) {
        return null;
      }
      if (instant === null) {
        instant = value;
      } else if (compareInstants(value, instant) !== 0) {
        return null;
      }
    }
  }
  return instant;
}

/**
 * `max(clock, active + 1 ms)` at millisecond precision.
 *
 * - The clock reading must itself be a millisecond-precision instant inside
 *   the four-digit year domain; anything else is `invalid`.
 * - When the clock is strictly past the active instant it is the answer,
 *   unchanged.
 * - Otherwise the answer is the first millisecond strictly after the active
 *   instant (a sub-millisecond active value is floored first, so the step is
 *   still strictly later). A leap-second active value cannot be stepped at
 *   millisecond precision and is `invalid`; a step past `9999` is
 *   `exhausted`. Both clear on their own once the clock passes the active
 *   instant.
 */
export function derivePublicationInstant(
  clockReading: string,
  activeInstant: string,
): PublicationInstant {
  const clock = millisecondInstant(clockReading);
  if (clock === null || canonicalInstant(activeInstant) === null) {
    return { kind: 'refused', reason: 'invalid' };
  }
  const order = compareInstants(clock, activeInstant);
  if (order === null) return { kind: 'refused', reason: 'invalid' };
  if (order === 1) return { kind: 'derived', generatedAt: clock };

  const activeMillis = Date.parse(activeInstant);
  if (Number.isNaN(activeMillis)) {
    return { kind: 'refused', reason: 'invalid' };
  }
  const stepped = boundedInstant(new Date(activeMillis + 1));
  if (stepped === null) return { kind: 'refused', reason: 'exhausted' };
  // Defensive: `Date.parse` truncates toward the earlier millisecond, so one
  // step is always strictly later. Asserted rather than assumed.
  if (compareInstants(stepped, activeInstant) !== 1) {
    return { kind: 'refused', reason: 'invalid' };
  }
  return { kind: 'derived', generatedAt: stepped };
}

/**
 * The `toISOString` spelling of an instant that is exactly representable at
 * millisecond precision, or `null`. A value with sub-millisecond digits or a
 * leap second would change on the way through `Date`, so it is refused rather
 * than silently moved.
 */
function millisecondInstant(value: string): string | null {
  if (canonicalInstant(value) === null) return null;
  const millis = Date.parse(value);
  if (Number.isNaN(millis)) return null;
  const spelled = boundedInstant(new Date(millis));
  if (spelled === null || compareInstants(spelled, value) !== 0) return null;
  return spelled;
}

/**
 * The publication instants one document carries: `meta.generatedAt`, and for
 * Home the embedded `data.freshness.generatedAt` as well.
 */
function documentInstants(document: StoredSnapshot): unknown[] {
  const meta = (document as { meta?: { generatedAt?: unknown } }).meta;
  const values: unknown[] = [meta?.generatedAt];
  if (document.documentName === 'home') {
    const data = document.data as { freshness?: { generatedAt?: unknown } };
    if (typeof data === 'object' && data !== null && data.freshness) {
      values.push(data.freshness.generatedAt);
    }
  }
  return values;
}

async function readDocument(
  storage: SnapshotStorage,
  season: number,
  version: string,
  name: SnapshotDocumentName,
): Promise<StoredSnapshot | 'unavailable'> {
  try {
    return (
      (await storage.readVersionedDocument(season, version, name)) ??
      'unavailable'
    );
  } catch {
    return 'unavailable';
  }
}
