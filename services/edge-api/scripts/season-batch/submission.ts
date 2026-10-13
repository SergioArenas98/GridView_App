/**
 * The offline submission builder for the guarded staging ingest.
 *
 * It turns one reviewed season batch - the generator's `artifact.json` and
 * `manifest.json` - into the exact request body
 * `POST /internal/admin/season/ingest` accepts, after running **the Worker's
 * own batch verification** on it locally. A batch the Worker would refuse is
 * therefore refused here, before anything is sent, with the same closed
 * reason.
 *
 * Two things only the Worker can decide are reported, not checked:
 *
 * - whether `expectedActiveVersion` is still the active release when the
 *   body arrives (the operator reads it from the cutover status first);
 * - whether the deployed attribution record credits the source as `active`.
 *   The local record's status is reported as `attributionStatus`; the Worker
 *   refuses every batch while its own record is not `active`.
 *
 * Dormant and offline: it reads two local files, sends nothing, reads no
 * credential and is not part of the Worker bundle.
 */

import dataSources from '../../../../content/attribution/data-sources.json';
import { submissionKind } from '../../src/ingest/batch-format';
import {
  verifySeasonBatch,
  type BatchVerificationFailure,
} from '../../src/ingest/batch-verification';
import { sha256Hex, utf8 } from '../../src/ingest/canonical-json';
import { attributionCredit } from '../../src/ingest/service';
import {
  decodeSubmission,
  maximumSubmissionBytes,
} from '../../src/ingest/submission';
import { curatedSeasonMetadata } from '../../src/sync/coordinated/outcome/metadata';

/** Every reason a batch is refused here. Closed; safe to print. */
export type SubmissionBuildFailure =
  | 'manifest-digest-mismatch'
  | 'batch-malformed'
  | 'expected-version-invalid'
  | 'submission-oversized'
  | BatchVerificationFailure;

export interface SubmissionBuildInput {
  readonly manifestBytes: Uint8Array;
  readonly artifactBytes: Uint8Array;
  /** The SHA-256 of the manifest the operator reviewed, lower-case hex. */
  readonly reviewedManifestSha256: string;
  /** The active release the operator reviewed the batch against. */
  readonly expectedActiveVersion: string;
  readonly now: Date;
  /** The attribution record; defaults to the repository's. Tests inject. */
  readonly attributionRecord?: unknown;
}

export interface SubmissionSummary {
  readonly season: number;
  readonly observedAt: string;
  readonly version: string;
  readonly documentCount: number;
  readonly classifiedRounds: readonly number[];
  readonly manifestSha256: string;
  readonly artifactSha256: string;
  readonly expectedActiveVersion: string;
  readonly submissionBytes: number;
  readonly submissionSha256: string;
  /** The local record's status for the source; the Worker needs `active`. */
  readonly attributionStatus: 'active' | 'not-active';
}

export type SubmissionBuildResult =
  | {
      readonly ok: true;
      /** The request body, exactly as it is to be sent. */
      readonly text: string;
      readonly summary: SubmissionSummary;
    }
  | { readonly ok: false; readonly failure: SubmissionBuildFailure };

function refuse(failure: SubmissionBuildFailure): SubmissionBuildResult {
  return { ok: false, failure };
}

function parsed(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes),
    ) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function seasonOf(manifest: unknown): number | null {
  if (!isRecord(manifest)) return null;
  return Number.isSafeInteger(manifest.season)
    ? (manifest.season as number)
    : null;
}

/**
 * Builds the submission for one reviewed batch, or refuses it with the
 * closed reason the Worker would give. Deterministic for a given input.
 */
export async function buildSubmission(
  input: SubmissionBuildInput,
): Promise<SubmissionBuildResult> {
  if ((await sha256Hex(input.manifestBytes)) !== input.reviewedManifestSha256) {
    return refuse('manifest-digest-mismatch');
  }
  const manifest = parsed(input.manifestBytes);
  const artifact = parsed(input.artifactBytes);
  const season = seasonOf(manifest);
  if (season === null || !isRecord(artifact)) {
    return refuse('batch-malformed');
  }

  const body = {
    kind: submissionKind,
    schemaVersion: 1,
    season,
    expectedActiveVersion: input.expectedActiveVersion,
    reviewedManifestSha256: input.reviewedManifestSha256,
    manifest,
    artifact,
  };
  // The digest matched, so it is well formed; and both files are objects. The
  // only member left that the envelope can refuse is the expected version.
  const submission = decodeSubmission(body);
  if (submission === null) return refuse('expected-version-invalid');

  const record = input.attributionRecord ?? dataSources;
  const credit = attributionCredit(record);
  const verified = await verifySeasonBatch({
    manifest: submission.manifest,
    artifact: submission.artifact,
    reviewedManifestSha256: submission.reviewedManifestSha256,
    season,
    now: input.now,
    metadata: curatedSeasonMetadata(season, undefined, record),
    attribution: credit?.attribution ?? null,
  });
  if (!verified.ok) return refuse(verified.failure);

  const text = JSON.stringify(body);
  const bytes = utf8(text);
  if (bytes.byteLength > maximumSubmissionBytes) {
    return refuse('submission-oversized');
  }
  const { batch } = verified;
  return {
    ok: true,
    text,
    summary: {
      season,
      observedAt: batch.observedAt,
      version: batch.version,
      documentCount: batch.documentCount,
      classifiedRounds: batch.classifiedRounds,
      manifestSha256: batch.manifestSha256,
      artifactSha256: batch.artifactSha256,
      expectedActiveVersion: submission.expectedActiveVersion,
      submissionBytes: bytes.byteLength,
      submissionSha256: await sha256Hex(bytes),
      attributionStatus: credit?.active === true ? 'active' : 'not-active',
    },
  };
}
