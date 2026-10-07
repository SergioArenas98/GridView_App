/**
 * The offline frozen-fixture converter (test-only APK path).
 *
 * It turns one reviewed season batch - the `artifact.json` and
 * `manifest.json` the season-batch generator wrote - into the envelope files
 * the Flutter `DATA_SOURCE=fixture` source (`FixtureGridViewApi`) loads from
 * `assets/dev_fixtures/`, plus one descriptor, `frozen-dataset.json`, that
 * identifies the frozen dataset to the app and to the build procedure.
 *
 * **Nothing is invented.** Every envelope is exactly what the Worker's public
 * router serves for the stored document: `{ data, meta: { ...meta,
 * requestId } }` (`src/public/router.ts`, `withRequestId`). The only added
 * value is a fixed `requestId`. `status.json` is not produced: the Worker
 * computes `/v1/status` and no snapshot document carries it.
 *
 * **Fail closed.** The manifest must be the exact bytes the operator reviewed
 * (its SHA-256 is an argument), the artifact must match the manifest's
 * size and digest, every document must match its manifest digest, and the
 * documents must regenerate exactly from the artifact's own `source`. The
 * first problem refuses the whole batch with one closed reason, and no file is
 * produced.
 *
 * Dormant and offline: it reads two local files, sends nothing and is not part
 * of the Worker bundle.
 */

import dataSources from '../../../../content/attribution/data-sources.json';
import type { ProviderSeasonSource } from '../../src/providers/formula-one-provider';
import { compareUtf8 } from '../../src/publication/canonical/ordering';
import { generateSnapshotSet } from '../../src/snapshots/generator';
import type {
  SnapshotDocumentName,
  StoredSnapshot,
} from '../../src/storage/types';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import {
  canonicalJson,
  CanonicalJsonError,
  sha256Hex,
  utf8,
} from './canonical-json';
import {
  artifactKind,
  manifestKind,
  seasonBatchSchemaVersion,
} from './generate';

export const descriptorFile = 'frozen-dataset.json';
export const descriptorKind = 'gridview-frozen-dataset';
export const descriptorSchemaVersion = 1;

/**
 * Where the batch came from, declared by the operator and never inferred.
 *
 * - `provider-capture`: a separately authorized recording of Jolpica. The app
 *   labels it as frozen test data with its capture date and credits Jolpica.
 * - `synthetic`: test material. The app keeps presenting it as sample data,
 *   and credits no source for it.
 */
export const fixtureOrigins = ['provider-capture', 'synthetic'] as const;
export type FixtureOrigin = (typeof fixtureOrigins)[number];

/** Every reason a batch is refused. Closed; safe to print. */
export const fixtureConversionFailures = [
  'manifest-digest-mismatch',
  'manifest-malformed',
  'manifest-not-canonical',
  'manifest-tree-dirty',
  'capture-digest-inconsistent',
  'artifact-digest-mismatch',
  'artifact-malformed',
  'artifact-not-canonical',
  'artifact-inconsistent',
  'document-digest-mismatch',
  'document-invalid',
  'document-name-unsupported',
  'document-set-incomplete',
  'document-source-inconsistent',
  'fixture-name-collision',
  'attribution-mismatch',
  'origin-invalid',
] as const;

export type FixtureConversionFailure =
  (typeof fixtureConversionFailures)[number];

/** The OpenAPI schemas one fixture envelope must satisfy. */
export interface FixtureContract {
  readonly data: string;
  readonly dataKind: 'single' | 'array';
  readonly meta: 'SeasonSnapshotMeta' | 'SnapshotMeta';
}

export interface FixtureFile {
  readonly name: string;
  readonly text: string;
  readonly byteLength: number;
  readonly sha256: string;
  /** `null` for the descriptor, which is not an API envelope. */
  readonly contract: FixtureContract | null;
}

export interface FixtureConversionSummary {
  readonly origin: FixtureOrigin;
  readonly season: number;
  readonly capturedAt: string;
  readonly documentCount: number;
  readonly fixtureCount: number;
  readonly sources: readonly string[];
  readonly manifestSha256: string;
  readonly artifactSha256: string;
}

export type FixtureConversionResult =
  | {
      readonly ok: true;
      /** Every fixture, then the descriptor, sorted by name. */
      readonly files: readonly FixtureFile[];
      readonly summary: FixtureConversionSummary;
    }
  | {
      readonly ok: false;
      readonly failure: FixtureConversionFailure;
    };

type Refusal = Extract<FixtureConversionResult, { readonly ok: false }>;

function refuse(failure: FixtureConversionFailure): Refusal {
  return { ok: false, failure };
}

type Json = Record<string, unknown>;

const sha256Pattern = /^[0-9a-f]{64}$/;
const gitCommitPattern = /^[0-9a-f]{40}$/;
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const entityIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const roundPattern = /^[1-9]\d{0,2}$/;

/** The largest artifact the converter reads. A real season is far smaller. */
export const maximumArtifactBytes = 32 * 1024 * 1024;
export const maximumManifestBytes = 1024 * 1024;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Json {
  if (!isRecord(value)) return false;
  const present = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    present.length === expected.length &&
    present.every((key, index) => key === expected[index])
  );
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
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

function decodeJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes),
    );
  } catch {
    return undefined;
  }
}

function isCanonical(value: unknown, bytes: Uint8Array): boolean {
  try {
    const text = canonicalJson(value);
    const expected = utf8(text);
    return (
      expected.byteLength === bytes.byteLength &&
      expected.every((byte, index) => byte === bytes[index])
    );
  } catch (error) {
    if (error instanceof CanonicalJsonError) return false;
    throw error;
  }
}

// --- Manifest -------------------------------------------------------------

export interface BatchManifest {
  readonly season: number;
  readonly gitCommit: string;
  readonly observedAt: string;
  readonly classificationRounds: readonly number[];
  readonly captureDigest: string;
  readonly responses: readonly Json[];
  readonly artifactByteLength: number;
  readonly artifactSha256: string;
  readonly version: string;
  readonly documentCount: number;
  readonly documents: readonly { documentName: string; sha256: string }[];
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
const summaryKeys = [
  'version',
  'documentCount',
  'calendarRounds',
  'classifiedRounds',
  'participationFacts',
  'drivers',
  'constructors',
  'circuits',
  'driverEntries',
  'constructorEntries',
  'driverStandings',
  'constructorStandings',
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
const responseKeys = ['url', 'status', 'contentType', 'byteLength', 'sha256'];

function decodeResponses(value: unknown): Json[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  for (const entry of value) {
    if (
      !hasExactKeys(entry, responseKeys) ||
      typeof entry.url !== 'string' ||
      entry.status !== 200 ||
      typeof entry.contentType !== 'string' ||
      !isCount(entry.byteLength) ||
      typeof entry.sha256 !== 'string' ||
      !sha256Pattern.test(entry.sha256)
    ) {
      return null;
    }
  }
  return value as Json[];
}

function decodeDocumentDigests(
  value: unknown,
): { documentName: string; sha256: string }[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  for (const entry of value) {
    if (
      !hasExactKeys(entry, ['documentName', 'sha256']) ||
      typeof entry.documentName !== 'string' ||
      typeof entry.sha256 !== 'string' ||
      !sha256Pattern.test(entry.sha256)
    ) {
      return null;
    }
  }
  return value as { documentName: string; sha256: string }[];
}

/** Decodes the manifest's known shape exactly; anything else is `null`. */
function decodeManifest(value: unknown): BatchManifest | 'dirty' | null {
  if (!hasExactKeys(value, manifestKeys)) return null;
  const { review, generator, capture, artifact, summary, attribution } = value;
  if (
    value.kind !== manifestKind ||
    value.schemaVersion !== seasonBatchSchemaVersion ||
    !Number.isSafeInteger(value.season) ||
    value.use !== 'review-only' ||
    !hasExactKeys(review, ['status']) ||
    review.status !== 'unreviewed' ||
    !hasExactKeys(generator, [
      'name',
      'schemaVersion',
      'gitCommit',
      'treeClean',
    ]) ||
    generator.name !== 'gridview-season-batch' ||
    generator.schemaVersion !== seasonBatchSchemaVersion ||
    typeof generator.gitCommit !== 'string' ||
    !gitCommitPattern.test(generator.gitCommit) ||
    typeof generator.treeClean !== 'boolean' ||
    !hasExactKeys(capture, [
      'observedAt',
      'classificationRounds',
      'digest',
      'responses',
    ]) ||
    typeof capture.observedAt !== 'string' ||
    !instantPattern.test(capture.observedAt) ||
    Number.isNaN(Date.parse(capture.observedAt)) ||
    !isRoundList(capture.classificationRounds) ||
    typeof capture.digest !== 'string' ||
    !sha256Pattern.test(capture.digest) ||
    !hasExactKeys(artifact, ['file', 'byteLength', 'sha256']) ||
    artifact.file !== 'artifact.json' ||
    !isCount(artifact.byteLength) ||
    typeof artifact.sha256 !== 'string' ||
    !sha256Pattern.test(artifact.sha256) ||
    !hasExactKeys(summary, summaryKeys) ||
    typeof summary.version !== 'string' ||
    !isCount(summary.documentCount) ||
    !isRoundList(summary.classifiedRounds) ||
    !hasExactKeys(attribution, attributionKeys)
  ) {
    return null;
  }
  const responses = decodeResponses(capture.responses);
  const documents = decodeDocumentDigests(summary.documents);
  if (responses === null || documents === null) return null;
  for (const key of summaryKeys) {
    if (key === 'version' || key === 'documents') continue;
    if (key === 'classifiedRounds') continue;
    if (!isCount(summary[key])) return null;
  }
  // A batch generated from a modified tree is not a reviewable provenance.
  if (generator.treeClean !== true) return 'dirty';
  return {
    season: value.season as number,
    gitCommit: generator.gitCommit,
    observedAt: capture.observedAt,
    classificationRounds: capture.classificationRounds,
    captureDigest: capture.digest,
    responses,
    artifactByteLength: artifact.byteLength,
    artifactSha256: artifact.sha256,
    version: summary.version,
    documentCount: summary.documentCount,
    documents,
    attribution,
  };
}

export type ManifestDecoding =
  { readonly ok: true; readonly manifest: BatchManifest } | Refusal;

/**
 * Checks the manifest is exactly the reviewed bytes and decodes it. The CLI
 * calls this first, to learn the artifact size to read within.
 */
export async function decodeReviewedManifest(
  manifestBytes: Uint8Array,
  expectedSha256: string,
): Promise<ManifestDecoding> {
  if (
    !sha256Pattern.test(expectedSha256) ||
    (await sha256Hex(manifestBytes)) !== expectedSha256
  ) {
    return refuse('manifest-digest-mismatch');
  }
  const value = decodeJson(manifestBytes);
  if (value === undefined) return refuse('manifest-malformed');
  if (!isCanonical(value, manifestBytes))
    return refuse('manifest-not-canonical');
  const manifest = decodeManifest(value);
  if (manifest === 'dirty') return refuse('manifest-tree-dirty');
  if (manifest === null) return refuse('manifest-malformed');
  if (manifest.artifactByteLength > maximumArtifactBytes) {
    return refuse('manifest-malformed');
  }
  // The capture digest is the generator's own function of the recorded
  // responses; a manifest whose two halves disagree was not written by it.
  const recomputed = await sha256Hex(
    utf8(
      canonicalJson({
        season: manifest.season,
        observedAt: manifest.observedAt,
        classificationRounds: manifest.classificationRounds,
        responses: manifest.responses,
      }),
    ),
  );
  if (recomputed !== manifest.captureDigest) {
    return refuse('capture-digest-inconsistent');
  }
  return { ok: true, manifest };
}

// --- Documents and file names ---------------------------------------------

interface ArtifactDocument {
  readonly documentName: SnapshotDocumentName;
  readonly resourceIdentity: string;
  readonly meta: Json;
  readonly data: unknown;
}

const seasonMeta = 'SeasonSnapshotMeta';

/**
 * The fixture file names and contract of one document, as
 * `FixtureGridViewApi` requests them, or `null` for a name it cannot serve.
 * The mapping is the one documented on PR #68 ("Assessment 1").
 */
export function fixtureNamesFor(
  documentName: string,
  season: number,
): { names: string[]; contract: FixtureContract } | null {
  const single = (data: string): FixtureContract => ({
    data,
    dataKind: 'single',
    meta: seasonMeta,
  });
  const list = (data: string): FixtureContract => ({
    data,
    dataKind: 'array',
    meta: seasonMeta,
  });
  switch (documentName) {
    case 'bootstrap':
      return {
        names: ['bootstrap.json', `bootstrap-${season}.json`],
        contract: single('BootstrapData'),
      };
    case 'home':
      return { names: ['home.json'], contract: single('HomeData') };
    case 'season':
      return {
        names: ['season-current.json', `season-${season}.json`],
        contract: single('Season'),
      };
    case 'calendar':
      return {
        names: [`calendar-${season}.json`],
        contract: list('GrandPrixSummary'),
      };
    case 'drivers':
      return {
        names: [`drivers-${season}.json`],
        contract: list('SeasonDriverSummary'),
      };
    case 'constructors':
      return {
        names: [`constructors-${season}.json`],
        contract: list('SeasonConstructorSummary'),
      };
    case 'circuits':
      return { names: [`circuits-${season}.json`], contract: list('Circuit') };
    case 'standings:drivers':
      return {
        names: [`standings-drivers-${season}.json`],
        contract: list('DriverStanding'),
      };
    case 'standings:constructors':
      return {
        names: [`standings-constructors-${season}.json`],
        contract: list('ConstructorStanding'),
      };
    case 'content:manifest':
      return {
        names: ['content-manifest.json'],
        contract: {
          data: 'ContentManifest',
          dataKind: 'single',
          meta: 'SnapshotMeta',
        },
      };
    default:
      break;
  }
  const grandPrix = /^grand-prix:(\d+)(:results)?$/.exec(documentName);
  if (grandPrix !== null) {
    const round = grandPrix[1]!;
    if (!roundPattern.test(round)) return null;
    return grandPrix[2] === undefined
      ? {
          names: [`grand-prix-${season}-${round}.json`],
          contract: single('GrandPrix'),
        }
      : {
          names: [`results-${season}-${round}.json`],
          contract: single('RaceResult'),
        };
  }
  const entity = /^(driver|constructor|circuit):(.+)$/.exec(documentName);
  if (entity !== null && entityIdPattern.test(entity[2]!)) {
    const kind = entity[1]!;
    const schema = {
      driver: 'DriverDetail',
      constructor: 'ConstructorDetail',
      circuit: 'CircuitDetail',
    }[kind]!;
    return { names: [`${kind}-${entity[2]}.json`], contract: single(schema) };
  }
  return null;
}

/** Documents a fixture build cannot start or render without. */
const requiredDocuments = [
  'bootstrap',
  'home',
  'season',
  'calendar',
  'drivers',
  'constructors',
  'circuits',
  'standings:drivers',
  'standings:constructors',
  'content:manifest',
];

function decodeDocuments(value: unknown): ArtifactDocument[] | null {
  if (!Array.isArray(value)) return null;
  for (const entry of value) {
    if (
      !hasExactKeys(entry, [
        'documentName',
        'resourceIdentity',
        'meta',
        'data',
      ]) ||
      typeof entry.documentName !== 'string' ||
      typeof entry.resourceIdentity !== 'string' ||
      !isRecord(entry.meta)
    ) {
      return null;
    }
  }
  return value as ArtifactDocument[];
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

// --- Attribution ----------------------------------------------------------

/**
 * The sources the app must credit for this batch. A provider capture is
 * credited under the repository's own attribution record, so the record the
 * app bundles must name the same source, licence and links the batch was
 * generated under.
 */
function creditedSources(
  origin: FixtureOrigin,
  manifest: BatchManifest,
): string[] | null {
  if (origin === 'synthetic') return [];
  const record = dataSources.sources.find(
    (candidate) => candidate.sourceId === 'jolpica',
  );
  const notice = manifest.attribution;
  if (
    record === undefined ||
    notice.name !== record.name ||
    notice.sourceUrl !== record.sourceUrl ||
    notice.licenseName !== record.licenseName ||
    notice.licenseUrl !== record.licenseUrl
  ) {
    return null;
  }
  const jolpica = `https://api.jolpi.ca/ergast/f1/${manifest.season}/`;
  const fromJolpica = manifest.responses.every(
    (response) =>
      typeof response.url === 'string' && response.url.startsWith(jolpica),
  );
  return fromJolpica ? ['jolpica'] : null;
}

// --- Conversion -----------------------------------------------------------

export interface FixtureConversionInput {
  readonly manifestBytes: Uint8Array;
  readonly artifactBytes: Uint8Array;
  /** The SHA-256 of the manifest the operator reviewed, lower-case hex. */
  readonly expectedManifestSha256: string;
  readonly origin: string;
}

async function fileOf(
  name: string,
  value: unknown,
  contract: FixtureContract | null,
): Promise<FixtureFile> {
  const text = canonicalJson(value);
  const bytes = utf8(text);
  return {
    name,
    text,
    byteLength: bytes.byteLength,
    sha256: await sha256Hex(bytes),
    contract,
  };
}

async function documentRefusal(
  documents: readonly ArtifactDocument[],
  manifest: BatchManifest,
): Promise<Refusal | null> {
  if (
    documents.length !== manifest.documentCount ||
    documents.length !== manifest.documents.length
  ) {
    return refuse('artifact-inconsistent');
  }
  for (const [index, document] of documents.entries()) {
    const digest = manifest.documents[index]!;
    if (document.documentName !== digest.documentName) {
      return refuse('artifact-inconsistent');
    }
    if (
      index > 0 &&
      compareUtf8(documents[index - 1]!.documentName, document.documentName) >=
        0
    ) {
      return refuse('artifact-inconsistent');
    }
    if ((await sha256Hex(utf8(canonicalJson(document)))) !== digest.sha256) {
      return refuse('document-digest-mismatch');
    }
    if (
      document.resourceIdentity !==
        `v1:${manifest.season}:${document.documentName}` ||
      runtimeSnapshotValidator.validate(document as unknown as StoredSnapshot)
        .length > 0 ||
      (document.documentName !== 'content:manifest' &&
        document.meta.season !== manifest.season)
    ) {
      return refuse('document-invalid');
    }
  }
  return null;
}

/**
 * The documents must be exactly what the Worker's own generator makes from
 * the artifact's `source` at the batch's instant and version: nothing edited
 * after generation, nothing dropped, nothing added.
 */
function sourceRefusal(
  source: unknown,
  manifest: BatchManifest,
  documents: readonly ArtifactDocument[],
): Refusal | null {
  let regenerated: string;
  try {
    const set = generateSnapshotSet(
      source as ProviderSeasonSource,
      manifest.observedAt,
      manifest.version,
    );
    regenerated = canonicalJson(
      [...set.documents]
        .map((document) => ({
          documentName: String(document.documentName),
          resourceIdentity: document.resourceIdentity,
          meta: document.meta,
          data: document.data,
        }))
        .sort((left, right) =>
          compareUtf8(left.documentName, right.documentName),
        ),
    );
  } catch {
    // The thrown value is never read: it can embed provider data.
    return refuse('document-source-inconsistent');
  }
  return regenerated === canonicalJson(documents)
    ? null
    : refuse('document-source-inconsistent');
}

/**
 * Converts one reviewed batch into fixture files, or refuses it with one
 * closed reason. Deterministic: the same batch and origin always yield
 * byte-identical files.
 */
export async function convertSeasonBatch(
  input: FixtureConversionInput,
): Promise<FixtureConversionResult> {
  if (!(fixtureOrigins as readonly string[]).includes(input.origin)) {
    return refuse('origin-invalid');
  }
  const origin = input.origin as FixtureOrigin;
  const decoded = await decodeReviewedManifest(
    input.manifestBytes,
    input.expectedManifestSha256,
  );
  if (!decoded.ok) return decoded;
  const { manifest } = decoded;

  if (
    input.artifactBytes.byteLength !== manifest.artifactByteLength ||
    (await sha256Hex(input.artifactBytes)) !== manifest.artifactSha256
  ) {
    return refuse('artifact-digest-mismatch');
  }
  const artifact = decodeJson(input.artifactBytes);
  if (
    !hasExactKeys(artifact, artifactKeys) ||
    !hasExactKeys(artifact.release, releaseKeys) ||
    !isRecord(artifact.source)
  ) {
    return refuse('artifact-malformed');
  }
  if (!isCanonical(artifact, input.artifactBytes)) {
    return refuse('artifact-not-canonical');
  }
  const documents = decodeDocuments(artifact.documents);
  if (documents === null) return refuse('artifact-malformed');
  if (
    artifact.kind !== artifactKind ||
    artifact.schemaVersion !== seasonBatchSchemaVersion ||
    artifact.season !== manifest.season ||
    artifact.observedAt !== manifest.observedAt ||
    artifact.release.version !== manifest.version ||
    artifact.release.generatedAt !== manifest.observedAt
  ) {
    return refuse('artifact-inconsistent');
  }
  const documentProblem = await documentRefusal(documents, manifest);
  if (documentProblem !== null) return documentProblem;
  const sourceProblem = sourceRefusal(artifact.source, manifest, documents);
  if (sourceProblem !== null) return sourceProblem;

  const sources = creditedSources(origin, manifest);
  if (sources === null) return refuse('attribution-mismatch');

  const names = new Set(documents.map((document) => document.documentName));
  if (
    !requiredDocuments.every((name) => names.has(name as SnapshotDocumentName))
  ) {
    return refuse('document-set-incomplete');
  }

  const requestId = `frozen-${input.expectedManifestSha256.slice(0, 16)}`;
  const files: FixtureFile[] = [];
  const taken = new Set<string>([descriptorFile]);
  for (const document of documents) {
    const mapping = fixtureNamesFor(document.documentName, manifest.season);
    if (mapping === null) return refuse('document-name-unsupported');
    // Exactly the Worker's public envelope for the stored document.
    const envelope = {
      data: document.data,
      meta: { ...document.meta, requestId },
    };
    for (const name of mapping.names) {
      if (taken.has(name)) return refuse('fixture-name-collision');
      taken.add(name);
      files.push(await fileOf(name, envelope, mapping.contract));
    }
  }
  files.sort((left, right) => compareUtf8(left.name, right.name));

  const descriptor = await fileOf(
    descriptorFile,
    {
      kind: descriptorKind,
      schemaVersion: descriptorSchemaVersion,
      origin,
      season: manifest.season,
      capturedAt: manifest.observedAt,
      sources,
      batch: {
        manifestSha256: input.expectedManifestSha256,
        artifactSha256: manifest.artifactSha256,
        captureDigest: manifest.captureDigest,
        generatorCommit: manifest.gitCommit,
        version: manifest.version,
        documentCount: documents.length,
      },
      files: files.map(({ name, byteLength, sha256 }) => ({
        name,
        byteLength,
        sha256,
      })),
    },
    null,
  );

  return {
    ok: true,
    files: [...files, descriptor],
    summary: {
      origin,
      season: manifest.season,
      capturedAt: manifest.observedAt,
      documentCount: documents.length,
      fixtureCount: files.length,
      sources,
      manifestSha256: input.expectedManifestSha256,
      artifactSha256: manifest.artifactSha256,
    },
  };
}
