/**
 * What an operator verification may show about the content it observed
 * (OD-7; PR-E3): counts, sorted canonical driver IDs and the names of the
 * `RaceResult` fields that differ. **Never a value**: no position, points,
 * time, status, name or provider string, old or new, ever leaves this module,
 * and nothing it computes is logged, stored or cached.
 *
 * The comparison base is the **published** document: the active release's
 * `grand-prix:{round}:results`, read from the release the sequencer reports
 * active and authoritative. It is labelled `published`, never `accepted`,
 * because what is served may differ from the ledger's accepted revision -
 * after a rollback, or before an accepted change is published.
 * `publishedIsAccepted` says which case holds, by revision.
 *
 * Every read here is a read. Nothing is written, published or requested from
 * a provider. When the authority or the document cannot support a coherent
 * comparison, the answer is a closed `unavailable` reason, never an invented
 * or partial diff.
 */

import type { RaceResult } from '../../../contract/types';
import { isSlug } from '../../../contract/validation';
import { isEnvelopeFor } from '../../../publication/guard/predecessor';
import type { SeasonPublicationSequencerPort } from '../../../publication/sequencer/port';
import {
  revisionInputForDocument,
  snapshotRevision,
} from '../../../publication/snapshot-revision';
import type { SnapshotStorage, StoredSnapshot } from '../../../storage/types';
import type { RevisionHash } from '../ledger/model';

/** The one comparison base. */
export const COMPARISON_BASE = 'published';

/** Why no comparison is shown. Closed, and safe to log. */
export const comparisonUnavailableReasons = [
  /** The verification produced no fresh, valid result to compare. */
  'no-observation',
  /** A resent operation: the comparison is never stored, so never repeated. */
  'not-repeated',
  'authority-unavailable',
  'authority-not-authoritative',
  /** The active release's document could not be read, or read as absent. */
  'published-document-unavailable',
  /** What was read, or observed, is not a coherent classification. */
  'published-document-invalid',
  'observed-result-invalid',
] as const;
export type ComparisonUnavailableReason =
  (typeof comparisonUnavailableReasons)[number];

/** The `RaceResult` fields a comparison may name, besides `entries`. */
export const resultFieldNames = [
  'id',
  'season',
  'round',
  'grandPrixId',
  'sessionType',
  'status',
  'fastestLap',
] as const;

/** The `RaceResultEntry` fields a comparison may name. `driverId` is the key. */
export const entryFieldNames = [
  'constructorId',
  'position',
  'gridPosition',
  'points',
  'status',
  'laps',
  'elapsedTimeMillis',
  'gapToLeaderMillis',
  'lapsBehind',
  'fastestLap',
  'dnfReason',
  'gapText',
] as const;

/** More entries than any classification holds; a guard, not a limit. */
const MAXIMUM_ENTRIES = 100;

export type PublishedComparison =
  | {
      readonly base: typeof COMPARISON_BASE;
      readonly status: 'compared';
      /** Whether the published document is the ledger's accepted revision. */
      readonly publishedIsAccepted: boolean;
      readonly counts: {
        readonly observedEntries: number;
        readonly publishedEntries: number;
        readonly added: number;
        readonly removed: number;
        readonly changed: number;
      };
      /** Canonical driver IDs, each list sorted. */
      readonly drivers: {
        readonly added: readonly string[];
        readonly removed: readonly string[];
        readonly changed: readonly string[];
      };
      /** `RaceResult` field names that differ, `entries` included. Sorted. */
      readonly resultFields: readonly string[];
      /** `RaceResultEntry` field names that differ in a kept entry. Sorted. */
      readonly entryFields: readonly string[];
    }
  | {
      readonly base: typeof COMPARISON_BASE;
      readonly status: 'unavailable';
      readonly reason: ComparisonUnavailableReason;
    };

export function comparisonUnavailable(
  reason: ComparisonUnavailableReason,
): PublishedComparison {
  return { base: COMPARISON_BASE, status: 'unavailable', reason };
}

export interface ComparisonInput {
  readonly sequencer: SeasonPublicationSequencerPort;
  readonly storage: SnapshotStorage;
  readonly season: number;
  readonly round: number;
  readonly observed: RaceResult;
  /** The ledger's accepted revision, for `publishedIsAccepted` only. */
  readonly acceptedRevision: RevisionHash | null;
}

/** Reads the published base and compares the observation with it. */
export async function compareWithPublished(
  input: ComparisonInput,
): Promise<PublishedComparison> {
  const base = await readPublishedResult(input);
  if (typeof base === 'string') return comparisonUnavailable(base);
  const observed = entriesOf(input.observed, input.season, input.round);
  if (observed === null)
    return comparisonUnavailable('observed-result-invalid');
  return {
    ...compareResults(input.observed, observed, base.result, base.entries),
    publishedIsAccepted: base.revision === input.acceptedRevision,
  };
}

interface PublishedBase {
  readonly result: Record<string, unknown>;
  readonly entries: ReadonlyMap<string, Record<string, unknown>>;
  readonly revision: RevisionHash;
}

async function readPublishedResult(
  input: ComparisonInput,
): Promise<PublishedBase | ComparisonUnavailableReason> {
  let authority: Awaited<
    ReturnType<SeasonPublicationSequencerPort['readAuthority']>
  >;
  try {
    authority = await input.sequencer.readAuthority(input.season);
  } catch {
    return 'authority-unavailable';
  }
  if (authority.cutoverState === 'unavailable') return 'authority-unavailable';
  if (authority.cutoverState !== 'active' || !authority.authoritative) {
    return 'authority-not-authoritative';
  }
  const name = `grand-prix:${input.round}:results` as const;
  let document: StoredSnapshot | null;
  try {
    document = await input.storage.readVersionedDocument(
      input.season,
      authority.activeVersion,
      name,
    );
  } catch {
    return 'published-document-unavailable';
  }
  // Workers KV visibility is eventual: absent is unavailable, never empty.
  if (document === null) return 'published-document-unavailable';
  if (!isEnvelopeFor(document, name)) return 'published-document-invalid';
  const result = document.data;
  if (!isRecord(result)) return 'published-document-invalid';
  const entries = entriesOf(result, input.season, input.round);
  if (entries === null) return 'published-document-invalid';
  return {
    result,
    entries,
    revision: await snapshotRevision(revisionInputForDocument(document)),
  };
}

/**
 * The entries of a classification by canonical driver ID, or `null` when it
 * is not one coherent classification of this round: another season or round,
 * a malformed entry, a non-canonical or repeated driver ID.
 */
function entriesOf(
  value: unknown,
  season: number,
  round: number,
): Map<string, Record<string, unknown>> | null {
  if (!isRecord(value) || value.season !== season || value.round !== round) {
    return null;
  }
  const entries = value.entries;
  if (!Array.isArray(entries) || entries.length > MAXIMUM_ENTRIES) return null;
  const byDriver = new Map<string, Record<string, unknown>>();
  for (const entry of entries) {
    if (!isRecord(entry) || !isSlug(entry.driverId)) return null;
    if (byDriver.has(entry.driverId)) return null;
    byDriver.set(entry.driverId, entry);
  }
  return byDriver;
}

function compareResults(
  observedResult: RaceResult,
  observed: ReadonlyMap<string, Record<string, unknown>>,
  publishedResult: Record<string, unknown>,
  published: ReadonlyMap<string, Record<string, unknown>>,
): Omit<
  Extract<PublishedComparison, { status: 'compared' }>,
  'publishedIsAccepted'
> {
  const added = [...observed.keys()].filter((id) => !published.has(id));
  const removed = [...published.keys()].filter((id) => !observed.has(id));
  const changed: string[] = [];
  const entryFields = new Set<string>();
  for (const [id, entry] of observed) {
    const before = published.get(id);
    if (before === undefined) continue;
    const fields = entryFieldNames.filter(
      (field) => !sameValue(entry[field], before[field]),
    );
    if (fields.length > 0) changed.push(id);
    for (const field of fields) entryFields.add(field);
  }

  const observedRecord = observedResult as unknown as Record<string, unknown>;
  const resultFields: string[] = resultFieldNames.filter(
    (field) => !sameValue(observedRecord[field], publishedResult[field]),
  );
  const order = (entries: ReadonlyMap<string, unknown>) =>
    JSON.stringify([...entries.keys()]);
  if (
    added.length + removed.length + changed.length > 0 ||
    order(observed) !== order(published)
  ) {
    resultFields.push('entries');
  }
  return {
    base: COMPARISON_BASE,
    status: 'compared',
    counts: {
      observedEntries: observed.size,
      publishedEntries: published.size,
      added: added.length,
      removed: removed.length,
      changed: changed.length,
    },
    drivers: {
      added: added.sort(),
      removed: removed.sort(),
      changed: changed.sort(),
    },
    resultFields: resultFields.sort(),
    entryFields: [...entryFields].sort(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Equality of two JSON values, independent of object key order. */
function sameValue(left: unknown, right: unknown): boolean {
  return canonical(left) === canonical(right);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  // `undefined` (a missing field) and `null` stay distinct.
  return value === undefined ? 'undefined' : JSON.stringify(value);
}
