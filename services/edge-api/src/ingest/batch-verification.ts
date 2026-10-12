/**
 * Verification of one operator-reviewed season batch, before anything is
 * written (the guarded staging ingest, decision pack 2026-10-07 §5.2).
 *
 * A batch is the `manifest.json` and `artifact.json` the offline generator
 * wrote. The Worker trusts neither file's word about itself:
 *
 * 1. **Identity.** The manifest must hash to the SHA-256 the operator
 *    reviewed, its capture digest must be the generator's own function of the
 *    recorded responses it lists, and the artifact must have exactly the size
 *    and SHA-256 that reviewed manifest names. Both are hashed over their
 *    canonical JSON text, which is byte-identical to the files the generator
 *    wrote, so no other bytes can match.
 * 2. **Consistency.** The artifact's season, instants and release labels must
 *    agree with the manifest, and its release metadata with the curated
 *    content and attribution record this Worker bundles: a batch generated
 *    against other curated content is refused.
 * 3. **The source.** The assembled source is deep-validated as untrusted
 *    input (`source-validation.ts`).
 * 4. **Completeness.** Every calendar round whose race was at least five hours
 *    old at the capture instant must be classified - the runtime's own
 *    eligibility rule - and the capture must declare exactly those rounds.
 * 5. **The documents.** The documents are regenerated here, from the source,
 *    at the batch's own instant and version, and must equal the submitted
 *    documents and their reviewed digests byte for byte. So what the operator
 *    reviewed is exactly what this Worker's generator makes of the source;
 *    a document edited after generation, or a generator that drifted between
 *    the batch's commit and the deployed Worker, is refused.
 *
 * The first problem refuses the whole batch with one closed reason. Nothing
 * here reads storage, the sequencer or the network, and no reason, value or
 * identifier from the batch leaves this module except the verified source.
 */

import type { ProviderSeasonSource } from '../providers/formula-one-provider';
import type { CoordinatedPayload } from '../providers/coordination/resource';
import { compareUtf8 } from '../publication/canonical/ordering';
import { deriveParticipationGuard } from '../publication/guard/participation-guard';
import {
  generateSnapshotSet,
  type GeneratedSnapshotSet,
} from '../snapshots/generator';
import { calendarAnchorsOf } from '../sync/coordinated/observation/revisions';
import type { CuratedSeasonMetadata } from '../sync/coordinated/outcome/metadata';
import { isEligible } from '../sync/coordinated/policy/cadence';
import {
  artifactFile,
  artifactKind,
  batchVersion,
  manifestKind,
  seasonBatchSchemaVersion,
} from './batch-format';
import {
  canonicalJson,
  CanonicalJsonError,
  sha256Hex,
  utf8,
} from './canonical-json';
import { sourceRefusal, type SourceRefusal } from './source-validation';

/** Every reason a batch is refused. Closed; safe to log and return. */
export const batchVerificationFailures = [
  'manifest-digest-mismatch',
  'manifest-malformed',
  'manifest-tree-dirty',
  'capture-digest-inconsistent',
  'artifact-digest-mismatch',
  'artifact-malformed',
  'artifact-inconsistent',
  'batch-from-future',
  'curated-metadata-mismatch',
  'attribution-mismatch',
  'source-malformed',
  'source-invalid',
  'source-inconsistent',
  'classification-incomplete',
  'document-digest-mismatch',
  'document-source-inconsistent',
  'summary-inconsistent',
] as const;

export type BatchVerificationFailure =
  (typeof batchVerificationFailures)[number];

/** The bundled attribution record's credit for the batch's one source. */
export interface SourceAttribution {
  readonly recordVersion: string;
  readonly name: string;
  readonly sourceUrl: string;
  readonly licenseName: string;
  readonly licenseUrl: string;
}

export interface BatchVerificationInput {
  /** The parsed `manifest.json`, untrusted. */
  readonly manifest: unknown;
  /** The parsed `artifact.json`, untrusted. */
  readonly artifact: unknown;
  /** Lower-case hex SHA-256 of the manifest the operator reviewed. */
  readonly reviewedManifestSha256: string;
  /** The one season this ingest accepts. */
  readonly season: number;
  readonly now: Date;
  /** This Worker's curated metadata for `season`; `null` refuses every batch. */
  readonly metadata: CuratedSeasonMetadata | null;
  /** This Worker's attribution credit for Jolpica; `null` refuses every batch. */
  readonly attribution: SourceAttribution | null;
}

export interface VerifiedSeasonBatch {
  readonly season: number;
  readonly observedAt: string;
  /** The batch's release label; the sequencer allocates the committed version. */
  readonly version: string;
  readonly source: ProviderSeasonSource;
  readonly manifestSha256: string;
  readonly artifactSha256: string;
  readonly documentCount: number;
  readonly classifiedRounds: readonly number[];
}

export type BatchVerification =
  | { readonly ok: true; readonly batch: VerifiedSeasonBatch }
  | { readonly ok: false; readonly failure: BatchVerificationFailure };

type Refusal = Extract<BatchVerification, { readonly ok: false }>;
type Json = Record<string, unknown>;

function refuse(failure: BatchVerificationFailure): Refusal {
  return { ok: false, failure };
}

const sha256Pattern = /^[0-9a-f]{64}$/;
const gitCommitPattern = /^[0-9a-f]{40}$/;
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Json {
  if (!isRecord(value)) return false;
  const present = Object.keys(value);
  return (
    present.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    instantPattern.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === 'string' && sha256Pattern.test(value);
}

function isRoundList(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every(
      (round, index) =>
        Number.isSafeInteger(round) &&
        (round as number) > 0 &&
        (index === 0 || (round as number) > (value[index - 1] as number)),
    )
  );
}

function sameRounds(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return (
    left.length === right.length &&
    left.every((round, index) => round === right[index])
  );
}

/** The canonical text of a parsed value, or `null` if it has none. */
function canonicalText(value: unknown): string | null {
  try {
    return canonicalJson(value);
  } catch (error) {
    if (error instanceof CanonicalJsonError) return null;
    throw error;
  }
}

// --- Manifest -------------------------------------------------------------

interface DocumentDigest {
  readonly documentName: string;
  readonly sha256: string;
}

interface BatchManifest {
  readonly season: number;
  readonly observedAt: string;
  readonly classificationRounds: readonly number[];
  readonly artifactByteLength: number;
  readonly artifactSha256: string;
  readonly summary: Json;
  readonly documents: readonly DocumentDigest[];
  readonly attribution: Json;
}

const manifestKeys = [
  'kind',
  'schemaVersion',
  'season',
  'use',
  'review',
  'generator',
  'capture',
  'artifact',
  'summary',
  'attribution',
];
const generatorKeys = ['name', 'schemaVersion', 'gitCommit', 'treeClean'];
const captureKeys = [
  'observedAt',
  'classificationRounds',
  'digest',
  'responses',
];
const responseKeys = ['url', 'status', 'contentType', 'byteLength', 'sha256'];
const summaryCountKeys = [
  'documentCount',
  'calendarRounds',
  'participationFacts',
  'drivers',
  'constructors',
  'circuits',
  'driverEntries',
  'constructorEntries',
  'driverStandings',
  'constructorStandings',
];
const summaryKeys = [
  ...summaryCountKeys,
  'version',
  'classifiedRounds',
  'documents',
];
const attributionKeys = [
  'recordVersion',
  'name',
  'sourceUrl',
  'licenseName',
  'licenseUrl',
  'recordStatus',
];

/** Every recorded response is a complete Jolpica answer for this season. */
function isResponseList(value: unknown, season: number): value is Json[] {
  const prefix = `https://api.jolpi.ca/ergast/f1/${season}/`;
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (entry) =>
        hasExactKeys(entry, responseKeys) &&
        typeof entry.url === 'string' &&
        entry.url.startsWith(prefix) &&
        entry.status === 200 &&
        typeof entry.contentType === 'string' &&
        isCount(entry.byteLength) &&
        isDigest(entry.sha256),
    )
  );
}

function isDigestList(value: unknown): value is DocumentDigest[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (entry) =>
        hasExactKeys(entry, ['documentName', 'sha256']) &&
        typeof entry.documentName === 'string' &&
        isDigest(entry.sha256),
    )
  );
}

function hasManifestEnvelope(value: unknown, season: number): value is Json {
  return (
    hasExactKeys(value, manifestKeys) &&
    value.kind === manifestKind &&
    value.schemaVersion === seasonBatchSchemaVersion &&
    value.season === season &&
    value.use === 'review-only' &&
    hasExactKeys(value.review, ['status']) &&
    hasExactKeys(value.generator, generatorKeys) &&
    value.generator.name === 'gridview-season-batch' &&
    value.generator.schemaVersion === seasonBatchSchemaVersion &&
    typeof value.generator.gitCommit === 'string' &&
    gitCommitPattern.test(value.generator.gitCommit) &&
    typeof value.generator.treeClean === 'boolean' &&
    hasExactKeys(value.capture, captureKeys) &&
    isInstant(value.capture.observedAt) &&
    isRoundList(value.capture.classificationRounds) &&
    isDigest(value.capture.digest) &&
    isResponseList(value.capture.responses, season) &&
    hasExactKeys(value.artifact, ['file', 'byteLength', 'sha256']) &&
    value.artifact.file === artifactFile &&
    isCount(value.artifact.byteLength) &&
    isDigest(value.artifact.sha256) &&
    hasExactKeys(value.summary, summaryKeys) &&
    summaryCountKeys.every((key) => isCount((value.summary as Json)[key])) &&
    typeof value.summary.version === 'string' &&
    isRoundList(value.summary.classifiedRounds) &&
    isDigestList(value.summary.documents) &&
    hasExactKeys(value.attribution, attributionKeys)
  );
}

async function verifiedManifest(
  input: BatchVerificationInput,
): Promise<BatchManifest | Refusal> {
  const text = canonicalText(input.manifest);
  if (text === null) return refuse('manifest-malformed');
  if (
    !isDigest(input.reviewedManifestSha256) ||
    (await sha256Hex(utf8(text))) !== input.reviewedManifestSha256
  ) {
    return refuse('manifest-digest-mismatch');
  }
  const value = input.manifest;
  if (!hasManifestEnvelope(value, input.season)) {
    return refuse('manifest-malformed');
  }
  const generator = value.generator as Json;
  const capture = value.capture as Json;
  const artifact = value.artifact as Json;
  const summary = value.summary as Json;
  // A batch generated from a modified tree is not a reviewable provenance.
  if (generator.treeClean !== true) return refuse('manifest-tree-dirty');
  const recomputed = await sha256Hex(
    utf8(
      canonicalJson({
        season: input.season,
        observedAt: capture.observedAt,
        classificationRounds: capture.classificationRounds,
        responses: capture.responses,
      }),
    ),
  );
  if (recomputed !== capture.digest) {
    return refuse('capture-digest-inconsistent');
  }
  return {
    season: input.season,
    observedAt: capture.observedAt as string,
    classificationRounds: capture.classificationRounds as number[],
    artifactByteLength: artifact.byteLength as number,
    artifactSha256: artifact.sha256 as string,
    summary,
    documents: summary.documents as DocumentDigest[],
    attribution: value.attribution as Json,
  };
}

// --- Artifact -------------------------------------------------------------

interface BatchDocument {
  readonly documentName: string;
  /** The document's canonical text, computed once and reused. */
  readonly text: string;
}

interface BatchArtifact {
  readonly release: Json;
  readonly source: unknown;
  readonly documents: readonly BatchDocument[];
}

const artifactKeys = [
  'kind',
  'schemaVersion',
  'season',
  'observedAt',
  'release',
  'source',
  'documents',
];
const releaseKeys = [
  'version',
  'generatedAt',
  'sourceUpdatedAt',
  'contentVersion',
  'mediaVersion',
  'attributionVersion',
  'seasonLabel',
];
const documentKeys = ['documentName', 'resourceIdentity', 'meta', 'data'];

function batchDocuments(value: unknown): BatchDocument[] | null {
  if (!Array.isArray(value)) return null;
  const documents: BatchDocument[] = [];
  for (const entry of value) {
    if (
      !hasExactKeys(entry, documentKeys) ||
      typeof entry.documentName !== 'string'
    ) {
      return null;
    }
    const text = canonicalText(entry);
    if (text === null) return null;
    documents.push({ documentName: entry.documentName, text });
  }
  return documents;
}

async function verifiedArtifact(
  input: BatchVerificationInput,
  manifest: BatchManifest,
): Promise<BatchArtifact | Refusal> {
  const text = canonicalText(input.artifact);
  if (text === null) return refuse('artifact-malformed');
  const bytes = utf8(text);
  if (
    bytes.byteLength !== manifest.artifactByteLength ||
    (await sha256Hex(bytes)) !== manifest.artifactSha256
  ) {
    return refuse('artifact-digest-mismatch');
  }
  const value = input.artifact;
  if (
    !hasExactKeys(value, artifactKeys) ||
    !hasExactKeys(value.release, releaseKeys)
  ) {
    return refuse('artifact-malformed');
  }
  const documents = batchDocuments(value.documents);
  if (documents === null) return refuse('artifact-malformed');
  const release = value.release;
  if (
    value.kind !== artifactKind ||
    value.schemaVersion !== seasonBatchSchemaVersion ||
    value.season !== manifest.season ||
    value.observedAt !== manifest.observedAt ||
    release.version !== batchVersion(manifest.observedAt) ||
    release.version !== manifest.summary.version ||
    release.generatedAt !== manifest.observedAt ||
    release.sourceUpdatedAt !== manifest.observedAt
  ) {
    return refuse('artifact-inconsistent');
  }
  return { release, source: value.source, documents };
}

// --- Curated content and attribution ---------------------------------------

/** The artifact's release labels are this Worker's curated ones, exactly. */
function curatedRefusal(
  release: Json,
  metadata: CuratedSeasonMetadata | null,
): Refusal | null {
  if (
    metadata === null ||
    release.contentVersion !== metadata.contentVersion ||
    release.mediaVersion !== metadata.mediaVersion ||
    release.attributionVersion !== metadata.attributionVersion ||
    release.seasonLabel !== metadata.seasonLabel
  ) {
    return refuse('curated-metadata-mismatch');
  }
  return null;
}

/** The manifest credits the source exactly as this Worker's record does. */
function attributionRefusal(
  notice: Json,
  release: Json,
  attribution: SourceAttribution | null,
): Refusal | null {
  if (
    attribution === null ||
    notice.recordVersion !== attribution.recordVersion ||
    release.attributionVersion !== attribution.recordVersion ||
    notice.name !== attribution.name ||
    notice.sourceUrl !== attribution.sourceUrl ||
    notice.licenseName !== attribution.licenseName ||
    notice.licenseUrl !== attribution.licenseUrl
  ) {
    return refuse('attribution-mismatch');
  }
  return null;
}

/** The source's own labels are the release's. */
function sourceLabelsMatch(source: ProviderSeasonSource, release: Json) {
  return (
    source.contentVersion === release.contentVersion &&
    source.mediaVersion === release.mediaVersion &&
    source.attributionVersion === release.attributionVersion &&
    source.seasonLabel === release.seasonLabel &&
    source.sourceUpdatedAt === release.sourceUpdatedAt
  );
}

// --- Completeness and documents ---------------------------------------------

/** The rounds the runtime would classify at `observedAt`, or `null`. */
function eligibleRounds(
  source: ProviderSeasonSource,
  observedAt: string,
): number[] | null {
  const payload: CoordinatedPayload = {
    kind: 'season-calendar',
    events: source.calendar,
  };
  const anchors = calendarAnchorsOf(payload, source.season);
  if (anchors === null) return null;
  const now = new Date(observedAt);
  return anchors
    .filter((anchor) => isEligible(anchor.anchor, now))
    .map((anchor) => anchor.round);
}

function regenerated(
  source: ProviderSeasonSource,
  observedAt: string,
  version: string,
): GeneratedSnapshotSet | null {
  try {
    return generateSnapshotSet(source, observedAt, version);
  } catch {
    // The thrown value is never read: it can embed provider data.
    return null;
  }
}

/**
 * The submitted documents are exactly the reviewed digests, and exactly what
 * this Worker's generator makes of the source at the batch's own instant.
 */
async function documentRefusal(
  submitted: readonly BatchDocument[],
  digests: readonly DocumentDigest[],
  set: GeneratedSnapshotSet,
): Promise<Refusal | null> {
  if (submitted.length !== digests.length) {
    return refuse('document-digest-mismatch');
  }
  for (const [index, document] of submitted.entries()) {
    const digest = digests[index]!;
    if (
      document.documentName !== digest.documentName ||
      (await sha256Hex(utf8(document.text))) !== digest.sha256
    ) {
      return refuse('document-digest-mismatch');
    }
  }
  const expected = set.documents
    .map((document) => ({
      documentName: String(document.documentName),
      resourceIdentity: document.resourceIdentity,
      meta: document.meta,
      data: document.data,
    }))
    .sort((left, right) => compareUtf8(left.documentName, right.documentName));
  if (expected.length !== submitted.length) {
    return refuse('document-source-inconsistent');
  }
  for (const [index, document] of expected.entries()) {
    if (canonicalText(document) !== submitted[index]!.text) {
      return refuse('document-source-inconsistent');
    }
  }
  return null;
}

/** Every count the reviewer saw describes the verified batch. */
function summaryMatches(
  summary: Json,
  source: ProviderSeasonSource,
  documentCount: number,
  classifiedRounds: readonly number[],
  participationFacts: number,
): boolean {
  return (
    summary.documentCount === documentCount &&
    summary.calendarRounds === source.calendar.length &&
    summary.participationFacts === participationFacts &&
    summary.drivers === source.drivers.length &&
    summary.constructors === source.constructors.length &&
    summary.circuits === source.circuits.length &&
    summary.driverEntries === source.driverEntries.length &&
    summary.constructorEntries === source.constructorEntries.length &&
    summary.driverStandings === source.driverStandings.length &&
    summary.constructorStandings === source.constructorStandings.length &&
    sameRounds(summary.classifiedRounds as number[], classifiedRounds)
  );
}

// --- Verification ---------------------------------------------------------

/**
 * Verifies one submitted batch, or refuses it with one closed reason.
 * Deterministic for a given input; reads nothing and writes nothing.
 */
export async function verifySeasonBatch(
  input: BatchVerificationInput,
): Promise<BatchVerification> {
  const manifest = await verifiedManifest(input);
  if ('ok' in manifest) return manifest;
  const artifact = await verifiedArtifact(input, manifest);
  if ('ok' in artifact) return artifact;
  const { release } = artifact;

  if (Date.parse(manifest.observedAt) > input.now.getTime()) {
    return refuse('batch-from-future');
  }
  const curated = curatedRefusal(release, input.metadata);
  if (curated !== null) return curated;
  const credited = attributionRefusal(
    manifest.attribution,
    release,
    input.attribution,
  );
  if (credited !== null) return credited;

  const invalid: SourceRefusal | null = sourceRefusal(
    artifact.source,
    input.season,
  );
  if (invalid !== null) return refuse(invalid);
  const source = artifact.source as ProviderSeasonSource;
  if (!sourceLabelsMatch(source, release)) {
    return refuse('artifact-inconsistent');
  }

  const eligible = eligibleRounds(source, manifest.observedAt);
  if (
    eligible === null ||
    !sameRounds(eligible, manifest.classificationRounds)
  ) {
    return refuse('classification-incomplete');
  }

  const version = release.version as string;
  const set = regenerated(source, manifest.observedAt, version);
  if (set === null) return refuse('document-source-inconsistent');
  const guard = deriveParticipationGuard(input.season, set.documents);
  if (
    guard.kind !== 'valid' ||
    !sameRounds(guard.guard.classifiedRounds, manifest.classificationRounds)
  ) {
    return refuse('classification-incomplete');
  }
  const documents = await documentRefusal(
    artifact.documents,
    manifest.documents,
    set,
  );
  if (documents !== null) return documents;
  if (
    !summaryMatches(
      manifest.summary,
      source,
      set.documents.length,
      guard.guard.classifiedRounds,
      guard.guard.facts.length,
    )
  ) {
    return refuse('summary-inconsistent');
  }

  return {
    ok: true,
    batch: {
      season: input.season,
      observedAt: manifest.observedAt,
      version,
      source,
      manifestSha256: input.reviewedManifestSha256,
      artifactSha256: manifest.artifactSha256,
      documentCount: set.documents.length,
      classifiedRounds: guard.guard.classifiedRounds,
    },
  };
}
