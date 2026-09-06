/**
 * The single validated boundary between the stored per-version
 * publication-metadata sidecar and every decision taken over one
 * ([ADR 0025](../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D3, D8).
 *
 * `snapshot:{season}:{version}:__publication_metadata` records the
 * **release-wide `sourceOrderingInput`** that admitted the version it belongs
 * to, so a later rollback can recover that release's own ordering input rather
 * than an operator having to invent one. It is internal: its suffix is not a
 * `SnapshotDocumentName`, it is never a member of `__inventory`, it is excluded
 * from `snapshotRevision`, it has no public route, and it is removed with its
 * version.
 *
 * This module exists for the same reason `version-inventory.ts` does. The
 * storage read returns whatever JSON the key holds, so a truncated write or a
 * hand-edited entry deserializes to something that is not a record while still
 * being valid JSON. One rule here, and every reader goes through it.
 *
 * The result is a **four-valued** classification, and the three failure values
 * are deliberately not collapsed:
 *
 * - *absent* alone never proves a version predates the sidecar. Workers KV
 *   document storage is eventually consistent (ADR 0010), so a record that has
 *   not yet propagated reads identically to one that was never written.
 *   Eligibility for the legacy fallback is a property of the **version
 *   identifier's namespace** (`candidate-version.ts`), never of this read.
 * - *malformed* is a version whose provenance cannot be described, not one
 *   that never recorded provenance.
 * - *unreadable* says nothing about the version at all - including whether it
 *   ever recorded a sidecar - so it must never silently select the legacy path.
 *
 * Nothing here repairs, filters or reconstructs a record. A value either is one
 * or is not. **This module has no production caller**: resolving rollback
 * provenance and writing the sidecar as part of the required publication write
 * set are Integration-PR obligations.
 */

import { canonicalInstant } from './canonical/instant';
import type {
  PublicationMetadataRecord,
  SnapshotStorage,
} from '../storage/types';

/** The only record schema this generation writes or accepts. */
export const publicationMetadataSchemaVersion = 1;

/**
 * What one stored sidecar is, as far as any decision may rely on it.
 *
 * - `record` - a validated record carrying a usable `sourceOrderingInput`.
 * - `absent` - the key holds nothing *right now*. Whether that means "never
 *   written" or "not yet propagated" is decided by the version identifier's
 *   namespace, never here.
 * - `malformed` - the key holds something that is not a record of the declared
 *   shape.
 * - `unreadable` - the read itself failed.
 */
export type StoredPublicationMetadata =
  | { readonly kind: 'record'; readonly record: PublicationMetadataRecord }
  | { readonly kind: 'absent' }
  | { readonly kind: 'malformed' }
  | { readonly kind: 'unreadable' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Classifies one already-read sidecar value.
 *
 * Pure, so a caller holding its own read-failure handling can validate a shape
 * without also swallowing the exception.
 *
 * `sourceOrderingInput` must be a syntactically valid RFC 3339 `date-time`.
 * The value is the one ordinary-publication staleness admission is decided
 * against (ADR 0025 D4), so a string that cannot be ordered is not a usable
 * record - it is a malformed one.
 */
export function validatedPublicationMetadata(
  value: unknown,
): StoredPublicationMetadata {
  if (value === null || value === undefined) return { kind: 'absent' };
  if (!isRecord(value)) return { kind: 'malformed' };
  if (value.schemaVersion !== publicationMetadataSchemaVersion) {
    return { kind: 'malformed' };
  }
  const orderingInput = value.sourceOrderingInput;
  if (typeof orderingInput !== 'string') return { kind: 'malformed' };
  if (canonicalInstant(orderingInput) === null) return { kind: 'malformed' };
  return {
    kind: 'record',
    record: {
      schemaVersion: publicationMetadataSchemaVersion,
      sourceOrderingInput: orderingInput,
    },
  };
}

/**
 * Reads one version's sidecar and classifies it, containing a read failure.
 *
 * The thrown value is never read, logged or re-raised: it can embed a storage
 * key or a stack. Only the fact of failure crosses, as `unreadable`.
 */
export async function readStoredPublicationMetadata(
  storage: SnapshotStorage,
  season: number,
  version: string,
): Promise<StoredPublicationMetadata> {
  try {
    return validatedPublicationMetadata(
      await storage.readPublicationMetadata(season, version),
    );
  } catch {
    return { kind: 'unreadable' };
  }
}

/** Why an immutable sidecar write was refused. Bounded, never a raw value. */
export type PublicationMetadataWriteRefusal =
  /** A record already exists for this version, with different content. */
  | 'conflicting-record'
  /** A record already exists for this version and cannot be described. */
  | 'existing-record-malformed'
  /** The existing record could not be read, so immutability cannot be checked. */
  | 'existing-record-unreadable'
  /** The supplied ordering input is not a usable RFC 3339 `date-time`. */
  | 'invalid-source-ordering-input';

export type PublicationMetadataWriteOutcome =
  /** The record was written for the first time. */
  | { readonly outcome: 'written' }
  /** An identical record already existed. A byte-equivalent retry is a no-op. */
  | { readonly outcome: 'unchanged' }
  | {
      readonly outcome: 'refused';
      readonly reason: PublicationMetadataWriteRefusal;
    };

/**
 * Writes one version's sidecar **once**, refusing a conflicting rewrite.
 *
 * A restart between the sidecar write and `finalize` must be able to retry
 * safely, so an identical rewrite is accepted as idempotent and performs no
 * write at all. Different content under the same immutable version identifier
 * is an invariant violation and is refused rather than silently overwritten.
 *
 * **This is a best-effort guard, not a compare-and-set.** Workers KV offers no
 * conditional write (ADR 0007, ADR 0010), so the read and the write are not one
 * operation and this check cannot exclude a concurrent writer by itself. What
 * actually excludes one is structural: a candidate version is allocated inside
 * `prepare` and belongs to exactly one operation epoch for its whole existence
 * (ADR 0025 D3, D4), so two operations can never address the same version key.
 * This guard catches the invariant violation if that ever fails to hold; it is
 * not the reason it holds.
 */
export async function writePublicationMetadataOnce(
  storage: SnapshotStorage,
  season: number,
  version: string,
  sourceOrderingInput: string,
): Promise<PublicationMetadataWriteOutcome> {
  if (canonicalInstant(sourceOrderingInput) === null) {
    return { outcome: 'refused', reason: 'invalid-source-ordering-input' };
  }
  const existing = await readStoredPublicationMetadata(
    storage,
    season,
    version,
  );
  if (existing.kind === 'malformed') {
    return { outcome: 'refused', reason: 'existing-record-malformed' };
  }
  if (existing.kind === 'unreadable') {
    return { outcome: 'refused', reason: 'existing-record-unreadable' };
  }
  if (existing.kind === 'record') {
    return existing.record.sourceOrderingInput === sourceOrderingInput
      ? { outcome: 'unchanged' }
      : { outcome: 'refused', reason: 'conflicting-record' };
  }
  await storage.writePublicationMetadata(season, version, {
    schemaVersion: publicationMetadataSchemaVersion,
    sourceOrderingInput,
  });
  return { outcome: 'written' };
}
