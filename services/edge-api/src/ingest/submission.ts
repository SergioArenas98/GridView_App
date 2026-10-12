/**
 * The one request body the guarded staging ingest accepts, and how it is read.
 *
 * ```json
 * {
 *   "kind": "gridview-season-batch-submission",
 *   "schemaVersion": 1,
 *   "season": 2026,
 *   "expectedActiveVersion": "<the active release the batch was reviewed against>",
 *   "reviewedManifestSha256": "<64 lower-case hex>",
 *   "manifest": { ...manifest.json... },
 *   "artifact": { ...artifact.json... }
 * }
 * ```
 *
 * The two batch files travel as JSON values, not as strings: their digests are
 * taken over their canonical JSON text, which is byte-identical to the files
 * the generator wrote, so re-indenting them in transit changes nothing and
 * escaping does not inflate the body.
 *
 * The body is read within a strict byte bound: a declared `Content-Length`
 * over it is refused unread, and a stream that runs past it is cancelled.
 */

import { submissionKind, seasonBatchSchemaVersion } from './batch-format';

/**
 * The largest body read. The real batch at round 16 of 2026 makes a body of
 * about 0.4 MB (0.67 MB as the generator writes its two files); the bound
 * leaves room for the rest of the season and still refuses anything
 * unreasonable before parsing it.
 */
export const maximumSubmissionBytes = 2 * 1024 * 1024;

export interface SeasonBatchSubmission {
  readonly season: number;
  readonly expectedActiveVersion: string;
  readonly reviewedManifestSha256: string;
  /** Untrusted until `verifySeasonBatch` accepts it. */
  readonly manifest: unknown;
  /** Untrusted until `verifySeasonBatch` accepts it. */
  readonly artifact: unknown;
}

const submissionKeys = [
  'kind',
  'schemaVersion',
  'season',
  'expectedActiveVersion',
  'reviewedManifestSha256',
  'manifest',
  'artifact',
];

/** A sequencer or legacy release version: bounded, URL- and log-safe. */
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Decodes the submission envelope exactly; anything else is `null`. */
export function decodeSubmission(value: unknown): SeasonBatchSubmission | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (
    keys.length !== submissionKeys.length ||
    !submissionKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    )
  ) {
    return null;
  }
  if (
    value.kind !== submissionKind ||
    value.schemaVersion !== seasonBatchSchemaVersion ||
    !Number.isSafeInteger(value.season) ||
    typeof value.expectedActiveVersion !== 'string' ||
    !versionPattern.test(value.expectedActiveVersion) ||
    typeof value.reviewedManifestSha256 !== 'string' ||
    !sha256Pattern.test(value.reviewedManifestSha256) ||
    !isRecord(value.manifest) ||
    !isRecord(value.artifact)
  ) {
    return null;
  }
  return {
    season: value.season as number,
    expectedActiveVersion: value.expectedActiveVersion,
    reviewedManifestSha256: value.reviewedManifestSha256,
    manifest: value.manifest,
    artifact: value.artifact,
  };
}

export type BoundedBody =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly reason: 'oversized' | 'malformed' };

/**
 * Reads and parses a JSON body of at most `limit` bytes. Never reads past the
 * bound, and never echoes what it read.
 */
export async function readBoundedJson(
  request: Request,
  limit: number = maximumSubmissionBytes,
): Promise<BoundedBody> {
  const declared = request.headers.get('Content-Length');
  if (declared !== null && !(Number(declared) <= limit)) {
    return { ok: false, reason: 'oversized' };
  }
  if (request.body === null) return { ok: false, reason: 'malformed' };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return { ok: false, reason: 'oversized' };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: false,
    }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    // The thrown value is never read: it can quote the body.
    return { ok: false, reason: 'malformed' };
  }
}
