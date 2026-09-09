/**
 * The version-independent publication plan a caller computes **before**
 * `prepare` is ever called (ADR 0025 D3, D4).
 *
 * Everything here commits to document *names* and *content*, never to a
 * destination version - which is exactly why it can be computed before one
 * exists. The sequencer allocates the `pm1-…` version inside `prepare`, after
 * receiving `expectedManifestCommitment` and the per-key revisions this module
 * produces.
 */

import type { PerKeyRevision } from '../sequencer/model';
import { manifestCommitment } from '../sequencer/manifest-commitment';
import {
  revisionInputForDocument,
  snapshotRevision,
} from '../snapshot-revision';
import type { SnapshotDocumentName, StoredSnapshot } from '../../storage/types';

export interface PublicationPlan {
  /** Sorted, deduplicated - the exact inventory the version will record. */
  readonly documentNames: readonly SnapshotDocumentName[];
  /** One entry per document, in the same sorted order. */
  readonly perKeyRevisions: readonly PerKeyRevision[];
  /** `sha256:<64 hex>` over the sorted document-name manifest. */
  readonly expectedManifestCommitment: string;
}

/**
 * Builds the plan for a set of documents.
 *
 * The documents are addressed by name, so a duplicated `documentName` in the
 * input is collapsed to its last occurrence before anything is computed - the
 * same de-duplication the stored inventory and the manifest commitment both
 * already apply, kept consistent here so the per-key revision set cannot carry
 * a name the manifest does not.
 */
export async function buildPublicationPlan(
  documents: readonly StoredSnapshot[],
): Promise<PublicationPlan> {
  const byName = new Map<SnapshotDocumentName, StoredSnapshot>();
  for (const document of documents) byName.set(document.documentName, document);

  const documentNames = [...byName.keys()].sort() as SnapshotDocumentName[];
  const perKeyRevisions: PerKeyRevision[] = [];
  for (const documentName of documentNames) {
    const document = byName.get(documentName) as StoredSnapshot;
    perKeyRevisions.push({
      documentName,
      revision: await snapshotRevision(revisionInputForDocument(document)),
    });
  }

  return {
    documentNames,
    perKeyRevisions,
    expectedManifestCommitment: await manifestCommitment(documentNames),
  };
}
