/**
 * The revision one race classification is recorded under.
 *
 * It is hashed exactly as the release that would publish it: `snapshotRevision`
 * of a `grand-prix:{round}:results` document whose `data` is the `RaceResult`.
 * That is the rule the authoritative release's revisions are recomputed with
 * before they are reconciled into `publishedRevision`, so an accepted revision
 * and a published revision compare equal exactly when the content is the same.
 *
 * Shared by the observation orchestration (`observation/revisions.ts`) and the
 * operator verification (`operator/verification.ts`; PR-E3), so a sighting a
 * verification records and one a run records are the same revision for the
 * same content.
 */

import type { RaceResult } from '../../contract/types';
import { snapshotRevision } from '../../publication/snapshot-revision';
import type { RevisionHash } from './ledger/model';

/**
 * The `meta.schemaVersion` every generated snapshot document carries
 * (`snapshots/generator.ts`). A results document's revision is computed over
 * it, so an observation must use the same value. A test pins the two together.
 */
export const PUBLISHED_SNAPSHOT_SCHEMA_VERSION = 1;

/** The published revision of one race classification. */
export async function classificationRevision(
  result: RaceResult,
): Promise<RevisionHash> {
  return snapshotRevision({
    documentName: `grand-prix:${result.round}:results`,
    schemaVersion: PUBLISHED_SNAPSHOT_SCHEMA_VERSION,
    data: result,
  });
}
