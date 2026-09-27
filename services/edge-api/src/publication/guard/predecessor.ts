/**
 * Reads the authoritative predecessor's guard from the exact release the
 * sequencer reports active, and the `(documentName, revision)` pairs `prepare`
 * binds it to
 * ([ADR 0026](../../../../../docs/adr/0026-season-participation-semantics-and-derivation.md)
 * D14-D16;
 * [ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D4).
 *
 * Versioned documents are written once and never rewritten, so a non-null read
 * is that version's content. A `null` read is not: Workers KV visibility is
 * eventual, so it is `unavailable`, **never an empty predecessor**. The
 * revisions computed here are what the sequencer compares against its own
 * `committed/` rows inside `prepare`, which is what proves the content read is
 * the content the authority committed. The predecessor is a comparison input
 * only: nothing read here is ever copied into a candidate.
 */

import type { PerKeyRevision } from '../sequencer/model';
import { maximumManifestSize } from '../sequencer/store';
import { compareUtf8 } from '../canonical/ordering';
import {
  revisionInputForDocument,
  snapshotRevision,
} from '../snapshot-revision';
import { readStoredInventory } from '../version-inventory';
import type {
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
} from '../../storage/types';
import {
  deriveParticipationGuard,
  isRaceResultsDocumentName,
  type ParticipationGuard,
} from './participation-guard';

export type PredecessorGuardRead =
  | {
      readonly kind: 'read';
      readonly guard: ParticipationGuard;
      /** Every results document of the version, sorted by `compareUtf8`. */
      readonly guardDocuments: readonly PerKeyRevision[];
    }
  /** An inventory or document could not be read, or read as absent. */
  | { readonly kind: 'unavailable' }
  /** What was read is not a valid release's results. */
  | { readonly kind: 'invalid' };

const unavailable: PredecessorGuardRead = { kind: 'unavailable' };
const invalid: PredecessorGuardRead = { kind: 'invalid' };

export async function readPredecessorGuard(
  storage: SnapshotStorage,
  season: number,
  version: string,
): Promise<PredecessorGuardRead> {
  const inventory = await readStoredInventory(storage, season, version);
  if (inventory.kind === 'unreadable' || inventory.kind === 'absent') {
    return unavailable;
  }
  if (inventory.kind === 'malformed' || inventory.documents.length === 0) {
    return invalid;
  }

  const names = inventory.documents.filter((name) =>
    isRaceResultsDocumentName(name),
  );
  if (new Set(names).size !== names.length) return invalid;
  if (names.length > maximumManifestSize) return invalid;

  const documents: StoredSnapshot[] = [];
  for (const name of names) {
    const read = await readDocument(storage, season, version, name);
    if (read === 'unavailable') return unavailable;
    if (!isEnvelopeFor(read, name)) return invalid;
    documents.push(read);
  }

  const derived = deriveParticipationGuard(season, documents);
  if (derived.kind === 'invalid') return invalid;

  const guardDocuments: PerKeyRevision[] = [];
  for (const document of documents) {
    guardDocuments.push({
      documentName: document.documentName,
      revision: await snapshotRevision(revisionInputForDocument(document)),
    });
  }
  guardDocuments.sort((left, right) =>
    compareUtf8(left.documentName, right.documentName),
  );
  return { kind: 'read', guard: derived.guard, guardDocuments };
}

/**
 * The stored envelope carries the name it was read under and the schema
 * version its revision is computed over. Anything else cannot have produced a
 * committed revision, so it is invalid rather than hashed.
 */
function isEnvelopeFor(
  document: StoredSnapshot,
  name: SnapshotDocumentName,
): boolean {
  const meta: unknown = (document as { meta?: unknown }).meta;
  return (
    document.documentName === name &&
    typeof meta === 'object' &&
    meta !== null &&
    Number.isSafeInteger((meta as { schemaVersion?: unknown }).schemaVersion)
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
