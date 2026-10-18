/**
 * The logical publication instant: the one `meta.generatedAt` every document
 * of a committed release carries
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D4, amended 2026-10-14).
 *
 * A release's instant is identical across its documents - including the
 * content manifest and every embedded Home `freshness.generatedAt`, Home's own
 * and the bootstrap's copy - and
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
import { embeddedFreshness } from './embedded-freshness';
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

/**
 * The precise, closed cause behind a refusal, logged beside the publication
 * reason so an operator can tell the cases apart without any instant or
 * document name reaching a log line:
 *
 * - `active-release-unreadable` - an inventory or document read failed or was
 *   absent (`publication-instant-unavailable`). Usually KV visibility; a
 *   retry may clear it.
 * - `active-instant-invalid` - the active release carries an instant that
 *   cannot be ordered. Needs repair; a retry cannot clear it.
 * - `candidate-instant-invalid` - the candidate's documents disagree on their
 *   generation instant, or a `home` or `bootstrap` document lacks its required
 *   Home freshness block (an ordinary candidate or a rollback target). A
 *   defect in the generator or in the stored target; a retry of the same input
 *   cannot clear it.
 * - `clock-invalid` - the clock reading has no millisecond-precision spelling.
 * - `leap-second-step` - the active instant is a leap second and the clock is
 *   not yet past it. Clears on its own within a second.
 * - `year-range` - the step or a derived `staleAfter` would pass `9999`
 *   (`publication-instant-exhausted`). Needs repair.
 */
export const publicationInstantCauses = [
  'active-release-unreadable',
  'active-instant-invalid',
  'candidate-instant-invalid',
  'clock-invalid',
  'leap-second-step',
  'year-range',
] as const;

export type PublicationInstantCause = (typeof publicationInstantCauses)[number];

export type PublicationInstant =
  | { readonly kind: 'derived'; readonly generatedAt: string }
  | {
      readonly kind: 'refused';
      readonly reason: PublicationInstantRefusal;
      readonly cause: PublicationInstantCause;
    };

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
    const values = documentInstants(document);
    if (values === null) return invalid;
    for (const value of values) {
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
    const values = documentInstants(document);
    if (values === null) return null;
    for (const value of values) {
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
  if (clock === null) return refused('invalid', 'clock-invalid');
  const order = compareInstants(clock, activeInstant);
  if (order === null) return refused('invalid', 'active-instant-invalid');
  if (order === 1) return { kind: 'derived', generatedAt: clock };

  // A canonical instant that `Date` cannot read is a leap second.
  const activeMillis = Date.parse(activeInstant);
  if (Number.isNaN(activeMillis)) {
    return refused('invalid', 'leap-second-step');
  }
  const stepped = boundedInstant(new Date(activeMillis + 1));
  if (stepped === null) return refused('exhausted', 'year-range');
  // Defensive: `Date.parse` truncates toward the earlier millisecond, so one
  // step is always strictly later. Asserted rather than assumed.
  if (compareInstants(stepped, activeInstant) !== 1) {
    return refused('invalid', 'active-instant-invalid');
  }
  return { kind: 'derived', generatedAt: stepped };
}

function refused(
  reason: PublicationInstantRefusal,
  cause: PublicationInstantCause,
): PublicationInstant {
  return { kind: 'refused', reason, cause };
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
 * The publication instants one document carries: `meta.generatedAt`, and the
 * `generatedAt` of every Home freshness block it embeds - Home's own and the
 * bootstrap's copy of Home.
 */
function documentInstants(document: StoredSnapshot): unknown[] | null {
  const meta = (document as { meta?: { generatedAt?: unknown } }).meta;
  const embedded = embeddedFreshness(document);
  if (embedded.kind === 'malformed') return null;
  return [
    meta?.generatedAt,
    ...embedded.blocks.map((freshness) => freshness.generatedAt),
  ];
}

/**
 * Whether every `home` and `bootstrap` document carries its required Home
 * freshness block, so the stamp has somewhere to put the instant. A missing or
 * non-object block is refused, never skipped.
 */
export function carriesEmbeddedFreshness(
  documents: readonly StoredSnapshot[],
): boolean {
  return documents.every(
    (document) => embeddedFreshness(document).kind === 'blocks',
  );
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
