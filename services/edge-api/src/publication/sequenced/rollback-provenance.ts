/**
 * Resolves a rollback target's own release-wide `sourceOrderingInput`
 * (ADR 0025 D8 "Rollback's source-ordering provenance"), before `prepare` is
 * ever called.
 *
 * A rollback republishes a historical release, so it must carry that release's
 * own ordering input - and the Durable Object cannot supply it
 * (`committedSourceOrderingInput` describes only the currently active release
 * and is replaced by every `finalize`), and a post-cutover document cannot
 * either (`meta.sourceUpdatedAt` carries that key's per-key `snapshotObservedAt`,
 * not a release-wide value). The immutable per-version `__publication_metadata`
 * sidecar exists to close that gap.
 *
 * The rules, exactly as D8 and D12 step 6 both apply them - one rule, two
 * callers:
 *
 * - **valid sidecar** (either namespace) - use its value verbatim; the version
 *   identifier's namespace is not consulted when a valid record exists.
 * - **absent sidecar on a `pm1-…` version** - the protocol must have written it
 *   before it could finalize, so `null` means *not readable right now*, never
 *   *never written*. **Fail closed.** Never fall through to document inference,
 *   even when every document carries a uniform timestamp.
 * - **absent sidecar on a legacy-format version** - a release predating the
 *   sidecar. Apply the bounded legacy fallback: every inventory-named document
 *   must carry the **same** valid `meta.sourceUpdatedAt`; that single value is
 *   the target's legacy ordering input. A missing or non-uniform value fails
 *   closed - a value is never picked from one document arbitrarily and the
 *   operator is never asked to invent one.
 * - **malformed sidecar** (either namespace) - **fail closed.**
 * - **unreadable sidecar** (either namespace) - **fail closed.** An unreadable
 *   read is never treated as an absent one, so it can never silently select the
 *   legacy path.
 *
 * Eligibility for the legacy fallback comes from the version-format
 * discriminator, **never** from the KV read returning `null`.
 */

import { canonicalInstant } from '../canonical/instant';
import { versionNamespace } from '../sequencer/candidate-version';
import { readStoredPublicationMetadata } from '../publication-metadata';
import type {
  SnapshotDocumentName,
  SnapshotStorage,
} from '../../storage/types';
import type { StoredSnapshot } from '../../storage/types';

/**
 * The bounded classification of how (or why not) a target's provenance
 * resolved. Reaches structured logs (ADR 0025 D11); never carries the storage
 * key or the ordering value itself.
 */
export const rollbackProvenanceClassifications = [
  'sidecar',
  'legacy-uniform-documents',
  'absent-sidecar-required',
  'malformed-sidecar',
  'unreadable-sidecar',
  'legacy-missing-document-timestamp',
  'legacy-non-uniform-document-timestamps',
] as const;

export type RollbackProvenanceClassification =
  (typeof rollbackProvenanceClassifications)[number];

export type RollbackProvenance =
  | {
      readonly kind: 'resolved';
      readonly sourceOrderingInput: string;
      readonly classification: 'sidecar' | 'legacy-uniform-documents';
    }
  | {
      readonly kind: 'rejected';
      readonly classification: Exclude<
        RollbackProvenanceClassification,
        'sidecar' | 'legacy-uniform-documents'
      >;
    };

/**
 * @param documents Every document the target's inventory names, already read
 *   and confirmed present by the caller - so the legacy fallback here inspects
 *   `meta.sourceUpdatedAt` without a second read, and never papers over an
 *   incomplete target.
 */
export async function resolveRollbackSourceOrdering(
  storage: SnapshotStorage,
  season: number,
  targetVersion: string,
  documents: ReadonlyMap<SnapshotDocumentName, StoredSnapshot>,
): Promise<RollbackProvenance> {
  const sidecar = await readStoredPublicationMetadata(
    storage,
    season,
    targetVersion,
  );

  if (sidecar.kind === 'record') {
    return {
      kind: 'resolved',
      sourceOrderingInput: sidecar.record.sourceOrderingInput,
      classification: 'sidecar',
    };
  }
  if (sidecar.kind === 'malformed') {
    return { kind: 'rejected', classification: 'malformed-sidecar' };
  }
  if (sidecar.kind === 'unreadable') {
    return { kind: 'rejected', classification: 'unreadable-sidecar' };
  }

  // sidecar.kind === 'absent' - the discriminator, not this read, decides.
  if (versionNamespace(targetVersion) === 'sidecar-required') {
    return { kind: 'rejected', classification: 'absent-sidecar-required' };
  }

  // Legacy fallback: one uniform, valid `meta.sourceUpdatedAt` across every
  // inventory-named document.
  let uniform: string | null = null;
  for (const document of documents.values()) {
    const value = document.meta.sourceUpdatedAt;
    if (typeof value !== 'string' || canonicalInstant(value) === null) {
      return {
        kind: 'rejected',
        classification: 'legacy-missing-document-timestamp',
      };
    }
    if (uniform === null) {
      uniform = value;
    } else if (uniform !== value) {
      return {
        kind: 'rejected',
        classification: 'legacy-non-uniform-document-timestamps',
      };
    }
  }
  if (uniform === null) {
    // An empty document set cannot supply a legacy ordering input; the caller
    // has already rejected an empty inventory, so this is defensive.
    return {
      kind: 'rejected',
      classification: 'legacy-missing-document-timestamp',
    };
  }
  return {
    kind: 'resolved',
    sourceOrderingInput: uniform,
    classification: 'legacy-uniform-documents',
  };
}
