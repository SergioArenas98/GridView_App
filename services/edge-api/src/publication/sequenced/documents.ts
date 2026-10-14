/**
 * The caller-side document phase of the two-phase protocol (ADR 0025 D4,
 * "Caller document phase"): baking the sequencer-assigned observation
 * timestamps into each immutable document, and stamping the release's one
 * logical publication instant over the volatile publication and freshness
 * fields that `snapshotRevision` already excludes (ADR 0020 D1.7).
 *
 * Nothing here touches the stable public `data` payload the revision is
 * computed over. Every change is confined to `meta` and, for the one document
 * that carries it, `data.freshness` - the fields the canonical schema
 * projection drops by construction.
 */

import { boundedInstant } from '../canonical/instant';
import {
  embeddedFreshness,
  isHomeWithFreshness,
  isRecord,
} from './embedded-freshness';
import type { PerKeyState } from '../sequencer/model';
import type {
  SnapshotDocumentName,
  StoredMeta,
  StoredSnapshot,
} from '../../storage/types';

/**
 * Returns a copy of each document with `meta.sourceUpdatedAt` set to the
 * observation timestamp `prepare` assigned for that key, and the same value
 * mirrored into `data.freshness.sourceUpdatedAt` for the home document, which
 * surfaces it to the client.
 *
 * A document with no assignment is left untouched - the sequencer only ever
 * returns one entry per requested key, so this is defensive.
 */
export function bakeAssignedTimestamps(
  documents: readonly StoredSnapshot[],
  assigned: readonly PerKeyState[],
): StoredSnapshot[] {
  const byName = new Map<SnapshotDocumentName, string>(
    assigned.map((state) => [state.documentName, state.observedAt]),
  );
  return documents.map((document) => {
    const observedAt = byName.get(document.documentName);
    if (observedAt === undefined) return document;
    return {
      ...document,
      meta: { ...document.meta, sourceUpdatedAt: observedAt } as StoredMeta,
      data: withFreshnessSourceUpdatedAt(document, observedAt),
    };
  });
}

/**
 * Stamps one logical publication instant on every document (ADR 0025 D4,
 * amended 2026-10-14): `meta.generatedAt` - and every embedded Home
 * `freshness.generatedAt`, Home's own and the bootstrap's copy - become
 * `generatedAt`, and `staleAfter` is
 * re-derived from it preserving each document's own
 * `staleAfter - generatedAt` interval (15 minutes for most documents, an hour
 * for the content manifest). That interval rule is the one rollback
 * republication has always applied (D8 step 4); only the instant it starts
 * from is now the release's derived publication instant rather than a raw
 * clock reading.
 *
 * A document that already carries exactly this instant is returned unchanged,
 * so an ordinary candidate whose generation reading is already strictly later
 * than the active release is published byte-for-byte as generated.
 * `requestId` is not touched because it is never stored - the public router
 * sets it per response.
 *
 * Returns `null` when a re-derived `staleAfter` would leave the representable
 * four-digit year range; the caller refuses before any write.
 */
export function stampPublicationInstant(
  documents: readonly StoredSnapshot[],
  generatedAt: string,
): StoredSnapshot[] | null {
  const stamped: StoredSnapshot[] = [];
  for (const document of documents) {
    if (carriesInstant(document, generatedAt)) {
      stamped.push(document);
      continue;
    }
    const staleAfter = reprojectStaleAfter(document.meta, generatedAt);
    if (staleAfter === null) return null;
    stamped.push({
      ...document,
      meta: { ...document.meta, generatedAt, staleAfter } as StoredMeta,
      data: withStampedFreshness(document, generatedAt, staleAfter),
    });
  }
  return stamped;
}

function carriesInstant(
  document: StoredSnapshot,
  generatedAt: string,
): boolean {
  if (document.meta.generatedAt !== generatedAt) return false;
  return embeddedFreshness(document).every(
    (freshness) => freshness.generatedAt === generatedAt,
  );
}

/**
 * Re-derives `staleAfter` from `generatedAt`, preserving the original
 * `staleAfter - generatedAt` interval the generator chose for this document.
 * Falls back to 15 minutes if the stored pair cannot be measured, and returns
 * `null` when the result has no four-digit RFC 3339 spelling.
 */
function reprojectStaleAfter(
  meta: StoredMeta,
  generatedAt: string,
): string | null {
  const from = Date.parse(meta.generatedAt);
  const to = Date.parse(meta.staleAfter);
  const seconds =
    Number.isNaN(from) || Number.isNaN(to) || to <= from
      ? 15 * 60
      : Math.round((to - from) / 1000);
  return boundedInstant(new Date(Date.parse(generatedAt) + seconds * 1000));
}

interface FreshnessCarrier {
  freshness?: {
    generatedAt?: unknown;
    sourceUpdatedAt?: unknown;
    staleAfter?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function hasFreshness(document: StoredSnapshot): document is StoredSnapshot & {
  data: FreshnessCarrier & { freshness: Record<string, unknown> };
} {
  const data = document.data as FreshnessCarrier;
  return (
    document.documentName === 'home' &&
    typeof data === 'object' &&
    data !== null &&
    typeof data.freshness === 'object' &&
    data.freshness !== null
  );
}

function withFreshnessSourceUpdatedAt(
  document: StoredSnapshot,
  sourceUpdatedAt: string,
): unknown {
  if (!hasFreshness(document)) return document.data;
  return {
    ...document.data,
    freshness: { ...document.data.freshness, sourceUpdatedAt },
  };
}

/**
 * Every `HomeData.freshness` block a document embeds takes the instant and the
 * document's re-derived `staleAfter`: Home's own block, and the copy of Home
 * the bootstrap carries at `data.home` (OpenAPI `DataFreshness.generatedAt`
 * equals the enclosing snapshot's `meta.generatedAt`).
 */
function withStampedFreshness(
  document: StoredSnapshot,
  generatedAt: string,
  staleAfter: string,
): unknown {
  const stamp = (home: Record<string, unknown>) => ({
    ...home,
    freshness: {
      ...(home.freshness as Record<string, unknown>),
      generatedAt,
      staleAfter,
    },
  });
  const data = document.data as Record<string, unknown>;
  if (document.documentName === 'home' && isHomeWithFreshness(data)) {
    return stamp(data);
  }
  if (document.documentName === 'bootstrap' && isRecord(data)) {
    const home = data.home;
    if (isHomeWithFreshness(home)) return { ...data, home: stamp(home) };
  }
  return document.data;
}
