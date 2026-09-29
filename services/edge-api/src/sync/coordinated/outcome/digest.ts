/**
 * The candidate digest the no-change gate compares (runtime activation
 * decision O-12).
 *
 * It is taken over exactly what the sequencer's `prepare` receives: every
 * generated document's name and its `snapshotRevision`, sorted by name, from
 * the same publication plan the sequenced service builds. A snapshot revision
 * excludes every envelope and time-varying field by construction, so
 * `generatedAt`, `sourceUpdatedAt`, `staleAfter`, `fetchedAt` and the release
 * label cannot change the digest; only public content, a document appearing
 * or disappearing, or a schema version can.
 */

import { encodeUtf8 } from '../../../publication/canonical/ordering';
import { buildPublicationPlan } from '../../../publication/sequenced/manifest-plan';
import type { StoredSnapshot } from '../../../storage/types';
import type { RevisionHash } from '../ledger/model';

/** Inside the hashed bytes, so a change to the rule changes every digest. */
export const CANDIDATE_DIGEST_FORMAT = 'gv-candidate/1';

export async function candidateDigest(
  documents: readonly StoredSnapshot[],
): Promise<RevisionHash> {
  const plan = await buildPublicationPlan(documents);
  const text = `${CANDIDATE_DIGEST_FORMAT}${JSON.stringify(
    plan.perKeyRevisions.map((entry) => [entry.documentName, entry.revision]),
  )}`;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encodeUtf8(text) as unknown as BufferSource,
  );
  let hex = '';
  for (const byte of new Uint8Array(digest)) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return `sha256:${hex}`;
}
