/**
 * The guarded staging ingest of one operator-reviewed season batch (decision
 * pack 2026-10-07 §5.2, PR-2) - **disabled by default in every committed
 * environment**.
 *
 * ```
 * submission -> admission -> batch verification (digests, curated content,
 *   attribution, deep source validation, completeness, regeneration)
 *   -> generateSnapshotSet(source, now) -> publishGuarded(set,
 *      { expectedActiveVersion }) -> D14/D15 guard -> prepare CAS
 *   -> candidate write -> finalize
 * ```
 *
 * ## Admission
 *
 * Everything below is refused before the request body is read unless all of
 * these hold:
 *
 * - `SEASON_BATCH_INGEST` names the one season accepted. No committed
 *   environment sets it.
 * - The environment is `staging`. Production never ingests, whatever is set.
 * - `PROVIDER_MODE` is not `coordinated`, so there is never a second provider
 *   budget beside the Worker's own.
 * - The publication authority is a reachable sequencer, so the guarded entry
 *   point exists. A season that is not `active` there is still refused by
 *   `publishGuarded` itself (`guard-authority-not-sequenced`); there is no
 *   legacy path.
 * - The bundled attribution record credits the batch's source as `active`
 *   (DP-7: real data is not published while the app calls the source
 *   dormant).
 *
 * ## Publication
 *
 * The submitted documents are never published. Verification proves they are
 * exactly what this Worker's generator makes of the submitted source at the
 * batch's own instant; publication then regenerates them from that same source
 * at the Worker's clock, so the season's chronology and freshness are current.
 * The `sourceUpdatedAt` ordering input is the capture instant.
 *
 * The submission names the active release it was reviewed against
 * (`expectedActiveVersion`). Any other active release refuses it before
 * anything is written, and the guard and the `prepare` CAS bind to that
 * version, so a retry after a commit - reported or lost - is refused rather
 * than publishing a duplicate release, and of two conflicting submissions at
 * most one commits.
 *
 * ## What leaves this module
 *
 * Closed reasons, the publication status, versions, digests the operator
 * already holds, counts and round numbers. Never a provider payload, a
 * document, an identifier, a URL or a secret, in a response or a log line.
 */

import dataSources from '../../../../content/attribution/data-sources.json';
import type { EnvironmentName, ProviderMode } from '../config/environment';
import type { Logger } from '../logging/logger';
import type { GuardedPublicationCommands } from '../publication/commands';
import type {
  PublicationReason,
  PublicationResult,
} from '../publication/publisher';
import type { Clock } from '../runtime/clock';
import {
  generateSnapshotSet,
  type GeneratedSnapshotSet,
} from '../snapshots/generator';
import { curatedSeasonMetadata } from '../sync/coordinated/outcome/metadata';
import {
  verifySeasonBatch,
  type BatchVerificationFailure,
  type SourceAttribution,
  type VerifiedSeasonBatch,
} from './batch-verification';
import type { SeasonBatchSubmission } from './submission';

export const SEASON_BATCH_INGEST_OPERATION = 'season-batch.ingest';

/** Why an ingest was refused before its body was read. Closed. */
export const ingestAdmissionRefusals = [
  'ingest-disabled',
  'ingest-misconfigured',
  'environment-not-permitted',
  'provider-mode-coordinated',
  'authority-not-sequenced',
  'attribution-not-active',
] as const;

export type IngestAdmissionRefusal = (typeof ingestAdmissionRefusals)[number];

/** Why a read body was refused before verification. Closed. */
export const ingestRequestRefusals = [
  'submission-oversized',
  'submission-malformed',
  'season-not-enabled',
] as const;

export type IngestRequestRefusal = (typeof ingestRequestRefusals)[number];

export type IngestVerificationRefusal =
  BatchVerificationFailure | 'generation-failed';

export type SeasonBatchIngestOutcome =
  | {
      readonly outcome: 'refused';
      readonly stage: 'admission';
      readonly reason: IngestAdmissionRefusal;
    }
  | {
      readonly outcome: 'refused';
      readonly stage: 'request';
      readonly reason: IngestRequestRefusal;
    }
  | {
      readonly outcome: 'refused';
      readonly stage: 'verification';
      readonly reason: IngestVerificationRefusal;
    }
  | {
      readonly outcome: 'publication';
      readonly publication: IngestPublication;
      readonly batch: IngestBatchSummary;
    };

/** The bounded part of a `PublicationResult`: no purged URL is returned. */
export interface IngestPublication {
  readonly status: PublicationResult['status'];
  readonly season: number;
  readonly version: string;
  readonly previousVersion: string | null;
  readonly reason: PublicationReason | null;
  readonly cachePurge: PublicationResult['cachePurge'];
  readonly pointerMaintenance: PublicationResult['pointerMaintenance'];
  readonly purgedUrlCount: number;
}

export interface IngestBatchSummary {
  readonly manifestSha256: string;
  readonly artifactSha256: string;
  readonly observedAt: string;
  readonly expectedActiveVersion: string;
  readonly documentCount: number;
  readonly classifiedRounds: readonly number[];
}

export interface SeasonBatchIngestDeps {
  readonly environment: EnvironmentName;
  readonly providerMode: ProviderMode;
  /** The raw `SEASON_BATCH_INGEST` value. */
  readonly enabledSeason: string | undefined;
  /** The guarded sequenced publication, or `null` when there is none. */
  readonly guarded: GuardedPublicationCommands | null;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly requestId: string;
  /** The attribution record; defaults to the bundled one. Tests inject. */
  readonly attributionRecord?: unknown;
  /** The curated season records; defaults to the bundled ones. Tests inject. */
  readonly seasonRecords?: readonly unknown[];
}

const seasonPattern = /^\d{4}$/;
const creditedSourceId = 'jolpica';

export interface Credit {
  readonly attribution: SourceAttribution;
  readonly active: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * An attribution record's credit for the batch's source, and whether it is
 * `active`, or `null` for a record that does not credit it exactly once.
 */
export function attributionCredit(record: unknown): Credit | null {
  if (
    !isRecord(record) ||
    record.kind !== 'data-source-attribution' ||
    typeof record.version !== 'string' ||
    !Array.isArray(record.sources)
  ) {
    return null;
  }
  const entries = record.sources.filter(
    (entry) => isRecord(entry) && entry.sourceId === creditedSourceId,
  ) as Record<string, unknown>[];
  if (entries.length !== 1) return null;
  const entry = entries[0]!;
  const fields = ['name', 'sourceUrl', 'licenseName', 'licenseUrl', 'status'];
  if (!fields.every((field) => typeof entry[field] === 'string')) return null;
  return {
    attribution: {
      recordVersion: record.version,
      name: entry.name as string,
      sourceUrl: entry.sourceUrl as string,
      licenseName: entry.licenseName as string,
      licenseUrl: entry.licenseUrl as string,
    },
    active: entry.status === 'active',
  };
}

interface Admitted {
  readonly season: number;
  readonly guarded: GuardedPublicationCommands;
  readonly credit: Credit;
}

export class SeasonBatchIngest {
  private readonly deps: SeasonBatchIngestDeps;
  private readonly attributionRecord: unknown;

  constructor(deps: SeasonBatchIngestDeps) {
    this.deps = deps;
    this.attributionRecord = deps.attributionRecord ?? dataSources;
  }

  /**
   * Whether this Worker accepts a batch at all. Reads configuration and
   * bundled content only, so the route calls it before reading the body.
   */
  admit(): Admitted | IngestAdmissionRefusal {
    const raw = this.deps.enabledSeason;
    if (raw === undefined || raw === '') return 'ingest-disabled';
    if (!seasonPattern.test(raw) || this.metadataFor(Number(raw)) === null) {
      return 'ingest-misconfigured';
    }
    if (this.deps.environment !== 'staging') {
      return 'environment-not-permitted';
    }
    if (this.deps.providerMode === 'coordinated') {
      return 'provider-mode-coordinated';
    }
    if (this.deps.guarded === null) return 'authority-not-sequenced';
    const credit = attributionCredit(this.attributionRecord);
    if (credit === null || !credit.active) return 'attribution-not-active';
    return { season: Number(raw), guarded: this.deps.guarded, credit };
  }

  /** Verifies and publishes one decoded submission for an admitted Worker. */
  async ingest(
    admitted: Admitted,
    submission: SeasonBatchSubmission,
  ): Promise<SeasonBatchIngestOutcome> {
    if (submission.season !== admitted.season) {
      return this.refused('request', 'season-not-enabled');
    }
    const now = this.deps.clock.now();
    const verified = await verifySeasonBatch({
      manifest: submission.manifest,
      artifact: submission.artifact,
      reviewedManifestSha256: submission.reviewedManifestSha256,
      season: admitted.season,
      now,
      metadata: this.metadataFor(admitted.season),
      attribution: admitted.credit.attribution,
    });
    if (!verified.ok) return this.refused('verification', verified.failure);

    const set = candidateAt(verified.batch, now);
    if (set === null) return this.refused('verification', 'generation-failed');
    const result = await admitted.guarded.publishGuarded(set, {
      expectedActiveVersion: submission.expectedActiveVersion,
    });
    return this.published(result, verified.batch, submission);
  }

  /** Logs and returns a refusal that wrote nothing. */
  refused<Stage extends 'admission' | 'request' | 'verification'>(
    stage: Stage,
    reason: Extract<SeasonBatchIngestOutcome, { stage: Stage }>['reason'],
  ): SeasonBatchIngestOutcome {
    this.deps.logger.warn({
      operation: SEASON_BATCH_INGEST_OPERATION,
      requestId: this.deps.requestId,
      operatorAction: 'season-batch-ingest',
      operatorOutcome: 'refused',
      failureCategory: reason,
    });
    return { outcome: 'refused', stage, reason } as SeasonBatchIngestOutcome;
  }

  private published(
    result: PublicationResult,
    batch: VerifiedSeasonBatch,
    submission: SeasonBatchSubmission,
  ): SeasonBatchIngestOutcome {
    const event = {
      operation: SEASON_BATCH_INGEST_OPERATION,
      requestId: this.deps.requestId,
      season: result.season,
      operatorAction: 'season-batch-ingest',
      operatorOutcome: result.status,
      publicationStatus: result.status,
      ...(result.version === '' ? {} : { releaseVersion: result.version }),
      ...(result.reason === null ? {} : { failureCategory: result.reason }),
    };
    if (result.status === 'applied') {
      this.deps.logger.info(event);
    } else {
      this.deps.logger.warn(event);
    }
    return {
      outcome: 'publication',
      publication: {
        status: result.status,
        season: result.season,
        version: result.version,
        previousVersion: result.previousVersion,
        reason: result.reason,
        cachePurge: result.cachePurge,
        pointerMaintenance: result.pointerMaintenance,
        purgedUrlCount: result.purgedUrls.length,
      },
      batch: {
        manifestSha256: batch.manifestSha256,
        artifactSha256: batch.artifactSha256,
        observedAt: batch.observedAt,
        expectedActiveVersion: submission.expectedActiveVersion,
        documentCount: batch.documentCount,
        classifiedRounds: batch.classifiedRounds,
      },
    };
  }

  private metadataFor(season: number) {
    return curatedSeasonMetadata(
      season,
      this.deps.seasonRecords,
      this.attributionRecord,
    );
  }
}

/** The publication candidate: the verified source, generated at `now`. */
function candidateAt(
  batch: VerifiedSeasonBatch,
  now: Date,
): GeneratedSnapshotSet | null {
  try {
    return generateSnapshotSet(batch.source, now.toISOString(), batch.version);
  } catch {
    // The thrown value is never read: it can embed provider data.
    return null;
  }
}
