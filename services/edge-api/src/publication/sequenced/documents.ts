/**
 * The caller-side document phase of the two-phase protocol (ADR 0025 D4,
 * "Caller document phase"): baking the sequencer-assigned observation
 * timestamps into each immutable document, and - for rollback only -
 * regenerating the volatile publication and freshness fields that
 * `snapshotRevision` already excludes (ADR 0020 D1.7).
 *
 * Nothing here touches the stable public `data` payload the revision is
 * computed over. Every change is confined to `meta` and, for the one document
 * that carries it, `data.freshness` - the fields the canonical schema
 * projection drops by construction.
 */

import { addSeconds } from '../../runtime/clock';
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
 * Regenerates the volatile publication and freshness fields for a rollback
 * republication (ADR 0025 D8 step 4): `generatedAt` moves to now, `staleAfter`
 * is re-derived preserving each document's original TTL, and the home
 * document's freshness block is regenerated the same way. `requestId` is not
 * touched because it is never stored - the public router sets it per response.
 */
export function refreshVolatileFields(
  documents: readonly StoredSnapshot[],
  now: Date,
): StoredSnapshot[] {
  const generatedAt = now.toISOString();
  return documents.map((document) => {
    const staleAfter = reprojectStaleAfter(document.meta, generatedAt);
    const meta = {
      ...document.meta,
      generatedAt,
      staleAfter,
    } as StoredMeta;
    return {
      ...document,
      meta,
      data: withRefreshedFreshness(document, generatedAt, staleAfter),
    };
  });
}

/**
 * Re-derives `staleAfter` from now, preserving the original
 * `staleAfter - generatedAt` interval the generator chose for this document
 * (15 minutes for most, an hour for Grand Prix detail). Falls back to 15
 * minutes if the stored pair cannot be measured.
 */
function reprojectStaleAfter(meta: StoredMeta, generatedAt: string): string {
  const from = Date.parse(meta.generatedAt);
  const to = Date.parse(meta.staleAfter);
  const seconds =
    Number.isNaN(from) || Number.isNaN(to) || to <= from
      ? 15 * 60
      : Math.round((to - from) / 1000);
  return addSeconds(generatedAt, seconds);
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

function withRefreshedFreshness(
  document: StoredSnapshot,
  generatedAt: string,
  staleAfter: string,
): unknown {
  if (!hasFreshness(document)) return document.data;
  return {
    ...document.data,
    freshness: { ...document.data.freshness, generatedAt, staleAfter },
  };
}
