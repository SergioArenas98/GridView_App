/**
 * `snapshotRevision`: the equality-and-identity signal for one snapshot key.
 *
 * ADR 0020 D1.7 defines it as a stable hash of a deterministic canonical
 * serialization of the normalized public `data` payload, with envelope,
 * provenance, transport and time-varying metadata excluded without exception.
 * D1.6 and D1.7 both state what it is **not**: it is not temporally sortable,
 * and it never orders two payloads. Only equality is ever asked of it.
 *
 * ## Nothing here publishes anything
 *
 * This module has **no production caller**. It computes a revision; it does not
 * assign an observation time, does not read or write storage, and does not
 * touch `meta.sourceUpdatedAt`. Binding a revision to a `snapshotObservedAt`
 * and publishing that value is the second half of Phase 9B-6, and it is blocked
 * on a serialization guarantee that Workers KV cannot provide (ADR 0007, ADR
 * 0010): two overlapping publications for one season both decide pre-commit
 * from the same active pointer, so a pre-commit assignment cannot be shown to
 * be strictly monotonic (D1.10). Until that is resolved, the published
 * `sourceUpdatedAt` is unchanged and this module is inert.
 *
 * ## The hashed input
 *
 * Three things, and nothing else:
 *
 * - `data` - projected onto the schema declared for this snapshot key in
 *   `canonical/snapshot-schemas.ts`, which is what makes every exclusion an
 *   exclusion *by construction* rather than by deny-list;
 * - `schemaVersion` - a schema change genuinely changes the public
 *   representation, so D1.7 makes it part of the hashed payload;
 * - `documentName` - a **domain separator**, not content. Two snapshot keys
 *   carrying byte-identical payloads are still two keys, and a shared digest
 *   would be a coincidence waiting to be mistaken for sameness. It cannot
 *   cause a false revision change, because a key's name is fixed for the life
 *   of the key.
 *
 * ## The algorithm
 *
 * SHA-256, over the UTF-8 bytes of the canonical text, rendered as lowercase
 * hexadecimal and prefixed with the algorithm name: `sha256:<64 hex digits>`.
 * The prefix is what makes the digest self-describing, so a later algorithm is
 * a visibly different value rather than a silent reinterpretation of the same
 * one. `crypto.subtle` is the Workers runtime's own primitive; no dependency
 * is added for it.
 *
 * The canonical text is additionally prefixed with `gv-canon/1`. A change to
 * the serialization rules must change every revision - that is the point of a
 * canonical form - so the format version is inside the hashed bytes rather
 * than beside them.
 */

import type { StoredSnapshot } from '../storage/types';
import type { SnapshotDocumentName } from '../storage/types';
import { canonicalSchemaFor } from './canonical/snapshot-schemas';
import { projectCanonical } from './canonical/schema';
import {
  canonicalInvalid,
  serializeCanonical,
  type CanonicalValue,
} from './canonical/serialize';
import { encodeUtf8 } from './canonical/ordering';

/** The canonical serialization format the digest is taken over. */
export const canonicalFormatVersion = 'gv-canon/1';

/** The digest algorithm, and the prefix every revision carries. */
export const snapshotRevisionAlgorithm = 'sha256';

export interface SnapshotRevisionInput {
  readonly documentName: SnapshotDocumentName | string;
  readonly schemaVersion: number;
  readonly data: unknown;
}

/**
 * The exact text whose UTF-8 bytes are hashed.
 *
 * Exposed because a digest is unreviewable on its own: a test that pins the
 * format can fail with a readable difference, and an operator comparing two
 * revisions can see *what* differs rather than only *that* it does. It is
 * derived from the payload, so it is diagnostic output, never log output.
 *
 * Total and non-throwing, like everything it calls.
 */
export function canonicalRevisionText(input: SnapshotRevisionInput): string {
  const value: CanonicalValue = {
    kind: 'object',
    entries: [
      { key: 'data', value: projectedData(input) },
      {
        key: 'documentName',
        value: { kind: 'string', value: String(input.documentName) },
      },
      {
        key: 'schemaVersion',
        value: projectSchemaVersion(input.schemaVersion),
      },
    ],
  };
  return `${canonicalFormatVersion}${serializeCanonical(value)}`;
}

/**
 * The stable revision for one snapshot document.
 *
 * Never rejects: every branch of the canonicalization has an image, so the
 * only asynchronous step is the digest itself, and a payload that does not fit
 * its schema produces a revision over bounded markers rather than an
 * exception a caller would have to classify.
 */
export async function snapshotRevision(
  input: SnapshotRevisionInput,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encodeUtf8(canonicalRevisionText(input)) as unknown as BufferSource,
  );
  return `${snapshotRevisionAlgorithm}:${hex(new Uint8Array(digest))}`;
}

/**
 * The revision input for one stored document.
 *
 * It takes `schemaVersion` from the envelope and everything else from `data`,
 * which is the whole of the envelope it is allowed to see: `generatedAt`,
 * `sourceUpdatedAt`, `staleAfter` and `contentVersion` sit beside it in the
 * same object and are never read.
 */
export function revisionInputForDocument(
  document: StoredSnapshot,
): SnapshotRevisionInput {
  return {
    documentName: document.documentName,
    schemaVersion: document.meta.schemaVersion,
    data: document.data,
  };
}

function projectedData(input: SnapshotRevisionInput): CanonicalValue {
  const schema = canonicalSchemaFor(String(input.documentName));
  // Fail closed. A key with no declared schema has no defined revision, so a
  // bounded marker is recorded rather than a digest over whatever the payload
  // happened to hold - which would look like a revision and mean nothing.
  if (schema === null) return canonicalInvalid('unsupported');
  return projectCanonical(schema, input.data);
}

function projectSchemaVersion(schemaVersion: number): CanonicalValue {
  return projectCanonical({ kind: 'number', nullable: false }, schemaVersion);
}

function hex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}
