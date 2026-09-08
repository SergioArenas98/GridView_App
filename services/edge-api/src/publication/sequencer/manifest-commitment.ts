/**
 * The deterministic commitment a caller computes over its **planned public
 * document manifest**, before `prepare` is ever called
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D3, D4).
 *
 * It commits to document *names*, not to a destination version, which is
 * exactly why it can be computed before a version exists - the sequencer
 * allocates the version inside `prepare`, after receiving this value.
 *
 * The sequencer never computes or derives it. `prepare` records the caller's
 * `expectedManifestCommitment` durably; `finalize` compares it against the
 * commitment carried by the caller's later `completionAttestation`. That proves
 * the caller's post-write attestation names the same manifest the operation was
 * admitted against - and nothing more. It is not an inspection of Workers KV,
 * and a caller that falsely attests to the correct manifest for an incomplete
 * write phase produces no detectable mismatch.
 *
 * The sidecar is a **precondition** for producing an attestation, not an entry
 * in the manifest it commits to: `__publication_metadata` is not an
 * `__inventory` member and is not a public document.
 *
 * The construction mirrors `snapshotRevision`'s discipline: a format version
 * inside the hashed bytes, deterministic UTF-8 byte ordering with the
 * repository's own comparator (JavaScript's default UTF-16 code-unit order is
 * not the documented rule), length framing so no concatenation of two names can
 * be confused with another, and a self-describing `sha256:` prefix.
 */

import { compareUtf8, encodeUtf8, utf8ByteLength } from '../canonical/ordering';
import type { SnapshotDocumentName } from '../../storage/types';

/** The commitment format the digest is taken over. */
export const manifestCommitmentFormatVersion = 'gv-manifest/1';

/** The digest algorithm, and the prefix every commitment carries. */
export const manifestCommitmentAlgorithm = 'sha256';

/** The shape every valid commitment has. */
export const manifestCommitmentPattern = /^sha256:[0-9a-f]{64}$/;

export function isManifestCommitment(value: unknown): value is string {
  return typeof value === 'string' && manifestCommitmentPattern.test(value);
}

/**
 * The exact text whose UTF-8 bytes are hashed.
 *
 * Exposed for the same reason `canonicalRevisionText` is: a digest is
 * unreviewable on its own, and a test pinning the format fails with a readable
 * difference. It is derived from document names only, so it is diagnostic
 * output rather than log output.
 */
export function manifestCommitmentText(
  documentNames: readonly SnapshotDocumentName[],
): string {
  const sorted = [...new Set<string>(documentNames)].sort(compareUtf8);
  const framed = sorted
    .map((name) => `${utf8ByteLength(name)}:${name}`)
    .join('');
  return `${manifestCommitmentFormatVersion}|${sorted.length}|${framed}`;
}

/**
 * The commitment for one planned document manifest.
 *
 * Deterministic in both directions that matter: the same set of names always
 * produces the same value regardless of the order they arrive in or how many
 * times a name repeats, and two different sets never share a framing.
 */
export async function manifestCommitment(
  documentNames: readonly SnapshotDocumentName[],
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encodeUtf8(
      manifestCommitmentText(documentNames),
    ) as unknown as BufferSource,
  );
  return `${manifestCommitmentAlgorithm}:${hex(new Uint8Array(digest))}`;
}

function hex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}
