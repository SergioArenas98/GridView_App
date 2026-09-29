/**
 * Resolves a publication a previous run left unfinished, against the
 * authority, before anything is planned.
 *
 * A `publishing` disposition means a run committed its observations and never
 * committed its outcome: it crashed, lost its lease, or its outcome commit
 * failed or was lost. Two cases:
 *
 * - **No reservation** (`digest` null): the run never reached the guarded
 *   publisher, so nothing was published. The publication it owed is due now.
 * - **A reservation**: the run may have published. Its release-wide ordering
 *   input was reserved for it alone and is written into its candidate's
 *   immutable `__publication_metadata` sidecar before `finalize`, so the
 *   authoritative release is this run's exactly when that release's sidecar
 *   carries the reserved value. Then the release is recorded as published,
 *   with the reserved digest; otherwise the publication is due now.
 *
 * Nothing is replayed: the candidate is never re-sent, rebuilt or cleaned up
 * here. A publication found not to have committed is simply due, and the next
 * publication run observes and builds a fresh candidate through every guard.
 * A sidecar that cannot be read leaves the slot as it is, and the run fails
 * closed before any provider request.
 */

import { readStoredPublicationMetadata } from '../../../publication/publication-metadata';
import type { SnapshotStorage } from '../../../storage/types';
import type { LedgerInstant, SeasonRecord } from '../ledger/model';

export type RecoveryResolution = 'published' | 'not-published' | 'not-reached';

export type Recovery =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'resolved';
      readonly resolution: RecoveryResolution;
      readonly record: SeasonRecord;
    }
  | { readonly kind: 'unreadable' };

function dueBy(current: LedgerInstant | null, since: LedgerInstant): string {
  return current !== null && Date.parse(current) <= Date.parse(since)
    ? current
    : since;
}

export async function recoverUnfinishedPublication(input: {
  readonly record: SeasonRecord | null;
  /** The authoritative release, as this run reconciled it. */
  readonly activeVersion: string;
  readonly storage: SnapshotStorage;
  readonly now: Date;
}): Promise<Recovery> {
  const record = input.record;
  const disposition = record?.publicationDisposition ?? null;
  if (record === null || disposition?.state !== 'publishing') {
    return { kind: 'none' };
  }
  const due: SeasonRecord = {
    ...record,
    publicationDisposition: null,
    publicationDueAt: dueBy(record.publicationDueAt, disposition.since),
  };
  if (disposition.digest === null || disposition.orderingInput === null) {
    return { kind: 'resolved', resolution: 'not-reached', record: due };
  }

  const sidecar = await readStoredPublicationMetadata(
    input.storage,
    record.season,
    input.activeVersion,
  );
  if (sidecar.kind === 'unreadable') return { kind: 'unreadable' };
  // An absent or malformed sidecar is never one this runtime wrote: every
  // coordinated candidate carries a valid one before it can be finalized.
  if (
    sidecar.kind === 'record' &&
    sidecar.record.sourceOrderingInput === disposition.orderingInput
  ) {
    const at = input.now.toISOString();
    return {
      kind: 'resolved',
      resolution: 'published',
      record: {
        ...record,
        publicationDisposition: null,
        lastPublication: {
          digest: disposition.digest,
          activeVersion: input.activeVersion,
          publishedAt: at,
          confirmedAt: at,
        },
      },
    };
  }
  return { kind: 'resolved', resolution: 'not-published', record: due };
}
