/**
 * The offline season-batch generator (decision pack 2026-10-07, PR-1).
 *
 * It turns one recorded capture of Jolpica responses into a deterministic,
 * reviewable season artifact and its manifest, through exactly the rules the
 * Worker's coordinated runtime applies:
 *
 *     recorded responses -> hardened ProviderHttpClient (replay transport)
 *       -> the five Jolpica ports (normalization, curated mappings,
 *          deep payload validation) -> MultiSourceCoordinator
 *       -> assembleSeasonSource (completeness, A3.5 standings coherence,
 *          span derivation, referential integrity) -> generateSnapshotSet
 *       -> runtime snapshot validation -> D14/D15 guard derivation
 *
 * `assembleSeasonSource` followed by `generateSnapshotSet` is the same pair of
 * calls `CoordinatedSeasonPublication.prepareCandidate` makes; the generator
 * calls them directly only to keep the assembled source for the artifact.
 *
 * **Dormant and offline.** Nothing here can reach a provider, Cloudflare or any
 * other host: the only transport is the replay over verified recordings, and
 * the generator publishes nothing, ingests nothing and reads no credential. It
 * is not part of the Worker bundle. Its output is review material only: a
 * future guarded ingest or a test-only APK build would each need their own
 * separate decision.
 *
 * **Fail closed.** The first problem found refuses the whole capture with one
 * closed reason. No partial artifact is produced, nothing is substituted, and
 * no round, table or row is dropped to make a capture fit.
 *
 * **What it does not apply.** The runtime's multi-check classification
 * acceptance (settling confirmations, staged corrections) needs the
 * reconciliation ledger's history, which one capture does not have. A human
 * review of the manifest stands in for it; the D14-D16 guard still applies at
 * any future publication.
 */

import dataSources from '../../../../content/attribution/data-sources.json';
import { CapturingLogger } from '../../src/logging/logger';
import { assembleSeasonSource } from '../../src/providers/coordination/season-assembly';
import { MultiSourceCoordinator } from '../../src/providers/coordination/coordinator';
import type { CoordinationRun } from '../../src/providers/coordination/outcome';
import type {
  CoordinatedPayload,
  CoordinatedResource,
} from '../../src/providers/coordination/resource';
import { ProviderHttpClient } from '../../src/providers/http/provider-http-client';
import {
  JolpicaCalendarPort,
  JolpicaCircuitsPort,
  JolpicaParticipantsPort,
  JolpicaResourcePort,
  JolpicaResultsPort,
  JolpicaStandingsPort,
} from '../../src/providers/jolpica';
import type { ProviderSeasonSource } from '../../src/providers/formula-one-provider';
import { deriveParticipationGuard } from '../../src/publication/guard/participation-guard';
import { compareUtf8 } from '../../src/publication/canonical/ordering';
import { maximumManifestSize } from '../../src/publication/sequencer/store';
import {
  generateSnapshotSet,
  type GeneratedSnapshotSet,
} from '../../src/snapshots/generator';
import { calendarAnchorsOf } from '../../src/sync/coordinated/observation/revisions';
import { curatedSeasonMetadata } from '../../src/sync/coordinated/outcome/metadata';
import { isEligible } from '../../src/sync/coordinated/policy/cadence';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import {
  decodeCaptureManifest,
  type CaptureManifest,
  type CaptureManifestProblem,
} from './capture';
import {
  canonicalJson,
  CanonicalJsonError,
  sha256Hex,
  utf8,
} from './canonical-json';
import {
  replayLimiter,
  replayTransport,
  type RecordedResponse,
} from './replay';

export const artifactKind = 'gridview-season-batch';
export const manifestKind = 'gridview-season-batch-manifest';
export const seasonBatchSchemaVersion = 1;
export const artifactFile = 'artifact.json';
export const manifestFile = 'manifest.json';

const gitCommitPattern = /^[0-9a-f]{40}$/;

/** Every reason a capture is refused. Closed; safe to print. */
export const seasonBatchFailures = [
  'invalid-provenance',
  'capture-malformed',
  'capture-body-missing',
  'capture-body-unexpected',
  'capture-digest-mismatch',
  'capture-response-not-ok',
  'capture-response-missing',
  'capture-response-repeated',
  'capture-response-unrequested',
  'capture-request-unexpected',
  'coordination-not-completed',
  'metadata-unavailable',
  'assembly-withheld',
  'generation-failed',
  'calendar-unanchored',
  'classification-rounds-mismatch',
  'snapshot-validation-failed',
  'participation-guard-invalid',
  'document-set-invalid',
  'artifact-not-canonical',
] as const;

export type SeasonBatchFailure = (typeof seasonBatchFailures)[number];

export interface SeasonBatchProvenance {
  /** The full commit the generator ran from. */
  readonly gitCommit: string;
  /** Whether the working tree matched that commit exactly. */
  readonly treeClean: boolean;
}

export interface SeasonBatchInput {
  /** The parsed `capture.json`, still untrusted. */
  readonly capture: unknown;
  /** Each body file named by the capture, by file name. */
  readonly bodies: ReadonlyMap<string, Uint8Array>;
  readonly provenance: SeasonBatchProvenance;
}

export interface SeasonBatchFile {
  readonly name: string;
  readonly text: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface SeasonBatchSummary {
  readonly season: number;
  readonly observedAt: string;
  /** The SHA-256 of the canonical capture description in the manifest. */
  readonly captureDigest: string;
  readonly version: string;
  readonly documentCount: number;
  readonly calendarRounds: number;
  readonly classifiedRounds: readonly number[];
  readonly participationFacts: number;
}

export type SeasonBatchResult =
  | {
      readonly ok: true;
      readonly artifact: SeasonBatchFile;
      readonly manifest: SeasonBatchFile;
      readonly summary: SeasonBatchSummary;
    }
  | {
      readonly ok: false;
      readonly failure: SeasonBatchFailure;
      /**
       * A closed qualifier from the existing vocabularies - a capture-manifest
       * problem, an assembly gap or a coordination status - or `null`. Never a
       * URL, an identifier or provider data.
       */
      readonly detail: string | null;
    };

type Refusal = Extract<SeasonBatchResult, { readonly ok: false }>;

function refuse(
  failure: SeasonBatchFailure,
  detail: CaptureManifestProblem | string | null = null,
): Refusal {
  return { ok: false, failure, detail };
}

/** The resources one publication run plans, in the runtime planner's order. */
function planFor(manifest: CaptureManifest): CoordinatedResource[] {
  const { season } = manifest;
  return [
    { kind: 'season-calendar', season },
    { kind: 'season-circuits', season },
    { kind: 'season-participants', season },
    { kind: 'driver-standings', season },
    { kind: 'constructor-standings', season },
    ...manifest.classificationRounds.map((round): CoordinatedResource => ({
      kind: 'session-classification',
      season,
      round,
      sessionType: 'race',
    })),
  ];
}

function selectedCalendar(run: CoordinationRun): CoordinatedPayload | null {
  for (const resource of run.resources) {
    if (resource.resource.kind !== 'season-calendar') continue;
    return resource.selection.outcome === 'selected'
      ? resource.selection.payload
      : null;
  }
  return null;
}

/** A release label that names its capture instant and its origin. */
export function batchVersion(observedAt: string): string {
  return `${observedAt.replace(/[-:.TZ]/g, '')}-batch`;
}

async function verifiedRecordings(
  manifest: CaptureManifest,
  bodies: ReadonlyMap<string, Uint8Array>,
): Promise<RecordedResponse[] | Refusal> {
  const named = new Set(manifest.responses.map((entry) => entry.file));
  for (const file of bodies.keys()) {
    if (!named.has(file)) return refuse('capture-body-unexpected');
  }
  const recordings: RecordedResponse[] = [];
  for (const entry of manifest.responses) {
    const body = bodies.get(entry.file);
    if (body === undefined) return refuse('capture-body-missing');
    if (
      body.byteLength !== entry.byteLength ||
      (await sha256Hex(body)) !== entry.sha256
    ) {
      return refuse('capture-digest-mismatch');
    }
    // Only a complete answer is a recording a season can be built from.
    if (entry.status !== 200) return refuse('capture-response-not-ok');
    recordings.push({
      url: entry.url,
      status: entry.status,
      contentType: entry.contentType,
      body,
    });
  }
  return recordings;
}

interface Coordinated {
  readonly run: CoordinationRun;
  /** Recordings no request asked for. Judged only once assembly succeeded. */
  readonly unrequested: number;
}

async function coordinate(
  manifest: CaptureManifest,
  recordings: readonly RecordedResponse[],
): Promise<Coordinated | Refusal> {
  const logger = new CapturingLogger();
  const replay = replayTransport(recordings);
  const instant = Date.parse(manifest.observedAt);
  const client = new ProviderHttpClient({
    transport: replay.transport,
    limiter: replayLimiter,
    logger,
    now: () => new Date(instant),
  });
  const port = new JolpicaResourcePort({
    calendar: new JolpicaCalendarPort({ client, logger }),
    circuits: new JolpicaCircuitsPort({ client, logger }),
    participants: new JolpicaParticipantsPort({ client, logger }),
    results: new JolpicaResultsPort({ client, logger }),
    standings: new JolpicaStandingsPort({ client, logger }),
  });
  const coordinator = new MultiSourceCoordinator({
    ports: [port],
    logger,
    maxConcurrentOperations: 1,
  });
  const run = await coordinator.coordinate({
    plan: { season: manifest.season, resources: planFor(manifest) },
  });

  const usage = replay.usage();
  if (usage.unexpectedMethod > 0) return refuse('capture-request-unexpected');
  if (usage.unrecorded > 0) return refuse('capture-response-missing');
  if (usage.repeated > 0) return refuse('capture-response-repeated');
  if (run.status !== 'completed') {
    return refuse('coordination-not-completed', run.status);
  }
  return { run, unrequested: usage.unrequested };
}

/**
 * The rounds the runtime would plan at `observedAt`: every calendar round
 * whose race anchor is at least five hours old (`isEligible`). A capture must
 * hold exactly these - a missing one would publish a season behind its own
 * calendar, and a later one was recorded before Jolpica could have a result.
 */
function eligibilityRefusal(
  manifest: CaptureManifest,
  run: CoordinationRun,
): Refusal | null {
  const calendar = selectedCalendar(run);
  const anchors =
    calendar === null ? null : calendarAnchorsOf(calendar, manifest.season);
  if (anchors === null) return refuse('calendar-unanchored');
  const now = new Date(manifest.observedAt);
  const eligible = anchors
    .filter((anchor) => isEligible(anchor.anchor, now))
    .map((anchor) => anchor.round);
  const declared = manifest.classificationRounds;
  const same =
    eligible.length === declared.length &&
    eligible.every((round, index) => round === declared[index]);
  return same ? null : refuse('classification-rounds-mismatch');
}

function documentSetRefusal(set: GeneratedSnapshotSet): Refusal | null {
  if (
    set.documents.length === 0 ||
    set.documents.length > maximumManifestSize
  ) {
    return refuse('document-set-invalid');
  }
  const names = new Set<string>();
  for (const document of set.documents) {
    const name = String(document.documentName);
    if (names.has(name)) return refuse('document-set-invalid');
    names.add(name);
    if (runtimeSnapshotValidator.validate(document).length > 0) {
      return refuse('snapshot-validation-failed');
    }
  }
  return null;
}

/** The Jolpica attribution entry the artifact's data is credited under. */
function attributionNotice(): Record<string, unknown> {
  const source = dataSources.sources.find(
    (candidate) => candidate.sourceId === 'jolpica',
  );
  return {
    recordVersion: dataSources.version,
    name: source?.name ?? null,
    sourceUrl: source?.sourceUrl ?? null,
    licenseName: source?.licenseName ?? null,
    licenseUrl: source?.licenseUrl ?? null,
    recordStatus: source?.status ?? null,
  };
}

async function fileOf(name: string, value: unknown): Promise<SeasonBatchFile> {
  const text = canonicalJson(value);
  const bytes = utf8(text);
  return {
    name,
    text,
    byteLength: bytes.byteLength,
    sha256: await sha256Hex(bytes),
  };
}

/**
 * Generates the season batch, or refuses the capture with one closed reason.
 * Deterministic: the same capture, provenance and repository content always
 * yield byte-identical files.
 */
export async function generateSeasonBatch(
  input: SeasonBatchInput,
): Promise<SeasonBatchResult> {
  if (!gitCommitPattern.test(input.provenance.gitCommit)) {
    return refuse('invalid-provenance');
  }
  const decoded = decodeCaptureManifest(input.capture);
  if (!decoded.ok) return refuse('capture-malformed', decoded.reason);
  const manifest = decoded.manifest;

  const recordings = await verifiedRecordings(manifest, input.bodies);
  if (!Array.isArray(recordings)) return recordings;

  const coordinated = await coordinate(manifest, recordings);
  if ('ok' in coordinated) return coordinated;
  const { run } = coordinated;

  const metadata = curatedSeasonMetadata(manifest.season);
  if (metadata === null) return refuse('metadata-unavailable');
  const release = {
    ...metadata,
    sourceUpdatedAt: manifest.observedAt,
  };
  const assembly = assembleSeasonSource(run, release);
  if (!assembly.complete) return refuse('assembly-withheld', assembly.gap);
  // After assembly, so a resource that failed part-way - and therefore never
  // asked for its remaining recordings - is reported as the failure it is.
  if (coordinated.unrequested > 0) {
    return refuse('capture-response-unrequested');
  }

  const eligibility = eligibilityRefusal(manifest, run);
  if (eligibility !== null) return eligibility;

  const version = batchVersion(manifest.observedAt);
  let set: GeneratedSnapshotSet;
  try {
    set = generateSnapshotSet(assembly.source, manifest.observedAt, version);
  } catch {
    // The thrown value is never read: it can embed provider data.
    return refuse('generation-failed');
  }
  const documentRefusal = documentSetRefusal(set);
  if (documentRefusal !== null) return documentRefusal;
  const guard = deriveParticipationGuard(manifest.season, set.documents);
  if (guard.kind !== 'valid') return refuse('participation-guard-invalid');

  try {
    return await outputs(input.provenance, manifest, assembly.source, set, {
      version,
      calendarRounds: assembly.source.calendar.length,
      classifiedRounds: guard.guard.classifiedRounds,
      participationFacts: guard.guard.facts.length,
    });
  } catch (error) {
    if (error instanceof CanonicalJsonError) {
      return refuse('artifact-not-canonical');
    }
    throw error;
  }
}

async function outputs(
  provenance: SeasonBatchProvenance,
  manifest: CaptureManifest,
  source: ProviderSeasonSource,
  set: GeneratedSnapshotSet,
  facts: {
    readonly version: string;
    readonly calendarRounds: number;
    readonly classifiedRounds: readonly number[];
    readonly participationFacts: number;
  },
): Promise<SeasonBatchResult> {
  const documents = [...set.documents]
    .map((document) => ({
      documentName: String(document.documentName),
      resourceIdentity: document.resourceIdentity,
      meta: document.meta,
      data: document.data,
    }))
    .sort((left, right) => compareUtf8(left.documentName, right.documentName));

  const artifact = await fileOf(artifactFile, {
    kind: artifactKind,
    schemaVersion: seasonBatchSchemaVersion,
    season: manifest.season,
    observedAt: manifest.observedAt,
    release: {
      version: set.version,
      generatedAt: manifest.observedAt,
      sourceUpdatedAt: set.sourceUpdatedAt,
      contentVersion: set.contentVersion,
      mediaVersion: source.mediaVersion,
      attributionVersion: source.attributionVersion,
      seasonLabel: source.seasonLabel,
    },
    source,
    documents,
  });

  const responses = [...manifest.responses]
    .map(({ url, status, contentType, byteLength, sha256 }) => ({
      url,
      status,
      contentType,
      byteLength,
      sha256,
    }))
    .sort((left, right) => compareUtf8(left.url, right.url));
  const captureDigest = await sha256Hex(
    utf8(
      canonicalJson({
        season: manifest.season,
        observedAt: manifest.observedAt,
        classificationRounds: manifest.classificationRounds,
        responses,
      }),
    ),
  );
  const documentDigests = await Promise.all(
    documents.map(async (document) => ({
      documentName: document.documentName,
      sha256: await sha256Hex(utf8(canonicalJson(document))),
    })),
  );

  const manifestFileContent = await fileOf(manifestFile, {
    kind: manifestKind,
    schemaVersion: seasonBatchSchemaVersion,
    season: manifest.season,
    use: 'review-only',
    review: { status: 'unreviewed' },
    generator: {
      name: 'gridview-season-batch',
      schemaVersion: seasonBatchSchemaVersion,
      gitCommit: provenance.gitCommit,
      treeClean: provenance.treeClean,
    },
    capture: {
      observedAt: manifest.observedAt,
      classificationRounds: manifest.classificationRounds,
      digest: captureDigest,
      responses,
    },
    artifact: {
      file: artifact.name,
      byteLength: artifact.byteLength,
      sha256: artifact.sha256,
    },
    summary: {
      version: facts.version,
      documentCount: documents.length,
      calendarRounds: facts.calendarRounds,
      classifiedRounds: facts.classifiedRounds,
      participationFacts: facts.participationFacts,
      drivers: source.drivers.length,
      constructors: source.constructors.length,
      circuits: source.circuits.length,
      driverEntries: source.driverEntries.length,
      constructorEntries: source.constructorEntries.length,
      driverStandings: source.driverStandings.length,
      constructorStandings: source.constructorStandings.length,
      documents: documentDigests,
    },
    attribution: attributionNotice(),
  });

  return {
    ok: true,
    artifact,
    manifest: manifestFileContent,
    summary: {
      season: manifest.season,
      observedAt: manifest.observedAt,
      captureDigest,
      version: facts.version,
      documentCount: documents.length,
      calendarRounds: facts.calendarRounds,
      classifiedRounds: facts.classifiedRounds,
      participationFacts: facts.participationFacts,
    },
  };
}
