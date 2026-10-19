/**
 * Scaffolding for the guarded staging ingest's tests.
 *
 * Every batch is made by the real offline generator from the synthetic
 * recorded captures the season-batch tests already use: committed curated
 * content only, no provider response, no private capture, no credential and
 * no request. The sequencer is the integration slice's real one, over either
 * transport, seeded from a synthetic predecessor release.
 */

import { createHash } from 'node:crypto';

import dataSources from '../../../../content/attribution/data-sources.json';
import { canonicalJson } from '../../src/ingest/canonical-json';
import { submissionKind } from '../../src/ingest/batch-format';
import { decodeSubmission } from '../../src/ingest/submission';
import {
  SeasonBatchIngest,
  type SeasonBatchIngestDeps,
} from '../../src/ingest/service';
import type { ProviderSeasonSource } from '../../src/providers/formula-one-provider';
import type { GuardedPublicationCommands } from '../../src/publication/commands';
import type { FreshnessPolicy } from '../../src/publication/sequenced/freshness-horizon';
import { generateSnapshotSet } from '../../src/snapshots/generator';
import { generateSeasonBatch } from '../../scripts/season-batch/generate';
import {
  SEASON,
  SEED_VERSION,
  sequencedContext,
  type SequencedContext,
  type SequencerTransport,
} from '../publication/sequenced/support';
import { fixtureCapture, inputFor } from '../season-batch/support';

export { SEASON, SEED_VERSION };

/** Rounds 1-2 are eligible at this instant (fixture anchors: 1 March + weeks). */
export const PREDECESSOR_OBSERVED_AT = '2026-03-09T12:00:00.000Z';
export const PREDECESSOR_ROUNDS: readonly number[] = [1, 2];
/** Rounds 1-3 are eligible at this instant. */
export const BATCH_OBSERVED_AT = '2026-03-16T12:00:00.000Z';
export const BATCH_ROUNDS: readonly number[] = [1, 2, 3];

/** The predecessor's generation instant: the sequenced context's own clock. */
const SEED_GENERATED_AT = '2026-07-20T12:00:00.000Z';

export type Json = Record<string, unknown>;

export interface Batch {
  readonly manifest: Json;
  readonly artifact: Json;
  readonly manifestSha256: string;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** A real generator batch over a synthetic capture. */
export async function syntheticBatch(
  rounds: readonly number[] = BATCH_ROUNDS,
  observedAt: string = BATCH_OBSERVED_AT,
): Promise<Batch> {
  const result = await generateSeasonBatch(
    inputFor(fixtureCapture(rounds, observedAt)),
  );
  if (!result.ok) throw new Error(`fixture batch refused: ${result.failure}`);
  return {
    manifest: JSON.parse(result.manifest.text) as Json,
    artifact: JSON.parse(result.artifact.text) as Json,
    manifestSha256: result.manifest.sha256,
  };
}

/** A deep copy, so a test's edit never reaches a shared batch. */
export function copy<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Re-anchors an edited batch at the file level: the manifest names the
 * edited artifact's size and digest, and the reviewed digest is the edited
 * manifest's, so only a deeper check can refuse it.
 */
export function reanchored(manifest: Json, artifact: Json): Batch {
  const artifactText = canonicalJson(artifact);
  const edited = copy(manifest);
  const record = edited.artifact as Json;
  record.byteLength = new TextEncoder().encode(artifactText).byteLength;
  record.sha256 = sha256(artifactText);
  return {
    manifest: edited,
    artifact,
    manifestSha256: sha256(canonicalJson(edited)),
  };
}

/** Recomputes every document digest the manifest records. */
export function rehashDocuments(manifest: Json, artifact: Json): void {
  const summary = manifest.summary as Json;
  summary.documents = (artifact.documents as Json[]).map((document) => ({
    documentName: document.documentName,
    sha256: sha256(canonicalJson(document)),
  }));
}

/** Recomputes the capture digest the manifest records. */
export function recaptured(manifest: Json): void {
  const capture = manifest.capture as Json;
  capture.digest = sha256(
    canonicalJson({
      season: manifest.season,
      observedAt: capture.observedAt,
      classificationRounds: capture.classificationRounds,
      responses: capture.responses,
    }),
  );
}

/** The calendar date `Date.parse` silently rolls `2026-02-31` over to. */
const ROLLED_OVER_AT = '2026-03-03T12:00:00.000Z';
export const IMPOSSIBLE_OBSERVED_AT = '2026-02-31T12:00:00.000Z';

/**
 * A generator batch respelled at the impossible instant `2026-02-31`, and
 * otherwise consistent: every instant, release label and document carries the
 * impossible spelling, and every document, capture and artifact digest is
 * recomputed over it. It is generated at the instant `Date.parse` reads the
 * impossible one as, so a validator that trusts `Date.parse` finds nothing
 * else wrong with it. Only the synthetic round 1 (2026-03-01) is eligible.
 */
export async function impossibleInstantBatch(): Promise<Batch> {
  const real = await syntheticBatch([1], ROLLED_OVER_AT);
  const compact = (instant: string) => instant.replace(/[-:.TZ]/g, '');
  const respelled = (value: Json): Json =>
    JSON.parse(
      canonicalJson(value)
        .replaceAll(ROLLED_OVER_AT, IMPOSSIBLE_OBSERVED_AT)
        .replaceAll(compact(ROLLED_OVER_AT), compact(IMPOSSIBLE_OBSERVED_AT)),
    ) as Json;
  const manifest = respelled(real.manifest);
  const artifact = respelled(real.artifact);
  rehashDocuments(manifest, artifact);
  recaptured(manifest);
  return reanchored(manifest, artifact);
}

export interface SubmissionOverrides {
  readonly expectedActiveVersion?: string;
  readonly season?: number;
  readonly reviewedManifestSha256?: string;
}

export function submissionFor(
  batch: Batch,
  expectedActiveVersion: string,
  overrides: Omit<SubmissionOverrides, 'expectedActiveVersion'> = {},
): Json {
  return {
    kind: submissionKind,
    schemaVersion: 1,
    season: overrides.season ?? SEASON,
    expectedActiveVersion,
    reviewedManifestSha256:
      overrides.reviewedManifestSha256 ?? batch.manifestSha256,
    manifest: batch.manifest,
    artifact: batch.artifact,
  };
}

/** The bundled attribution record, with the batch's source `active`. */
export function activeAttribution(): Json {
  const record = copy(dataSources) as unknown as Json;
  record.sources = (record.sources as Json[]).map((source) =>
    source.sourceId === 'jolpica' ? { ...source, status: 'active' } : source,
  );
  return record;
}

/**
 * A sequenced context whose active predecessor is the synthetic season at
 * `PREDECESSOR_ROUNDS`, so a later synthetic batch is a superset of it.
 */
export async function ingestContext(
  options: {
    readonly transport?: SequencerTransport;
    readonly cutover?: 'active' | 'seeded' | 'none';
    /** The sequencer's committed ordering input; defaults to the predecessor's. */
    readonly seedOrderingInput?: string;
    /** The publication service's `staleAfter` policy; `interval` when omitted. */
    readonly freshnessPolicy?: FreshnessPolicy;
  } = {},
): Promise<SequencedContext> {
  const predecessor = await syntheticBatch(
    PREDECESSOR_ROUNDS,
    PREDECESSOR_OBSERVED_AT,
  );
  const source = predecessor.artifact.source as unknown as ProviderSeasonSource;
  return sequencedContext({
    transport: options.transport,
    cutover: options.cutover,
    seedOrderingInput: options.seedOrderingInput ?? PREDECESSOR_OBSERVED_AT,
    freshnessPolicy: options.freshnessPolicy,
    seedTransform: () =>
      generateSnapshotSet(source, SEED_GENERATED_AT, SEED_VERSION),
  });
}

export function ingestFor(
  context: Pick<SequencedContext, 'clock' | 'logger'>,
  guarded: GuardedPublicationCommands | null,
  overrides: Partial<SeasonBatchIngestDeps> = {},
): SeasonBatchIngest {
  return new SeasonBatchIngest({
    environment: 'staging',
    providerMode: 'mock',
    enabledSeason: String(SEASON),
    guarded,
    clock: context.clock,
    logger: context.logger,
    requestId: 'ingest-test-request',
    attributionRecord: activeAttribution(),
    ...overrides,
  });
}

/** Admits and ingests one submission, failing the test if admission refuses. */
export async function ingestOnce(ingest: SeasonBatchIngest, submission: Json) {
  const admitted = ingest.admit();
  if (typeof admitted === 'string') {
    throw new Error(`admission refused: ${admitted}`);
  }
  const decoded = decodeSubmission(submission);
  if (decoded === null) throw new Error('submission malformed');
  return ingest.ingest(admitted, decoded);
}
