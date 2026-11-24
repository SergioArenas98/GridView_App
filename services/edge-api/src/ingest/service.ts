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
 * - The environment is `staging` or `production`. Development never ingests,
 *   whatever is set. Production additionally requires the cutover control
 *   `genesis:<the same season>`: it has no legacy release to seed from, so its
 *   only sequenced seasons are born by genesis (ADR 0025 D12, "Amendment
 *   (2026-10-20)"), and the same control closes the season's legacy
 *   admission.
 * - `PROVIDER_MODE` is not `coordinated`, so there is never a second provider
 *   budget beside the Worker's own.
 * - The publication authority is a reachable sequencer, so the guarded entry
 *   point exists. A season that is not `active` there is still refused by
 *   `publishGuarded` itself (`guard-authority-not-sequenced`); there is no
 *   legacy path.
 * - The bundled attribution record credits the batch's source as `active`
 *   or `automatic` (DP-7: real data is not published while the app calls the
 *   source dormant). Both statuses' wording covers a batch, so a Worker that
 *   falls back from `coordinated` to manual batches is admitted again.
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
 * A `genesis` season's first submission names `null`: the sequencer reports no
 * release, and the empty predecessor is bound the same way. Once that first
 * release commits, a retry naming `null` is refused as stale.
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
import type { CutoverControl } from '../publication/cutover/control';
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
import type {
  IdentityContextConfiguration,
  IdentityRunContext,
} from '../identity/catalog/run-context';
import type { ReconciliationLedgerPort } from '../sync/coordinated/ledger-port';
import { releaseSeasonLease } from '../sync/coordinated/operator/lease';
import {
  admitBatchCatalog,
  batchCatalogCall,
  BatchCatalogError,
} from './catalog-admission';
import type { BatchAdmissionRequest } from '../identity/catalog/batch-admission';
import { canonicalJson, sha256Hex, utf8 } from './canonical-json';
import type { SeasonPublicationSequencerPort } from '../publication/sequencer/port';
import type { SnapshotStorage } from '../storage/types';
import { readStoredPublicationMetadata } from '../publication/publication-metadata';

export const SEASON_BATCH_INGEST_OPERATION = 'season-batch.ingest';

/** Why an ingest was refused before its body was read. Closed. */
export const ingestAdmissionRefusals = [
  'catalog-admission-refused',
  'batch-lease-unavailable',
  'batch-recovery-required',
  'runtime-batch-requires-u7',
  'ingest-disabled',
  'ingest-misconfigured',
  'environment-not-permitted',
  /** Production, without `genesis:<season>` naming the ingested season. */
  'genesis-control-required',
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
  readonly recovered?: true;
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
  readonly expectedActiveVersion: string | null;
  readonly documentCount: number;
  readonly classifiedRounds: readonly number[];
}

export interface SeasonBatchIngestDeps {
  readonly recovery?: {
    readonly port: SeasonPublicationSequencerPort;
    readonly storage: SnapshotStorage;
  };
  readonly identity?: IdentityContextConfiguration;
  readonly ledger?: ReconciliationLedgerPort | null;
  /** Explicit installation-scoped opt-in, absent everywhere by default. */
  readonly compatibilityInstallation?: string;
  readonly identityMode?: 'bundled' | 'compare' | 'runtime';
  readonly environment: EnvironmentName;
  readonly providerMode: ProviderMode;
  /** The resolved cutover control; production ingests only under `genesis:`. */
  readonly cutoverControl: CutoverControl;
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
  /** Whether the status admits an operator-run batch. */
  readonly admitsBatch: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The statuses whose wording covers an operator-run batch. */
const batchCreditStatuses: readonly unknown[] = ['active', 'automatic'];

/**
 * An attribution record's credit for the batch's source, and whether its
 * status admits a batch (`active` or `automatic`), or `null` for a record
 * that does not credit it exactly once.
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
    admitsBatch: batchCreditStatuses.includes(entry.status),
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
    if (
      this.deps.identityMode === 'runtime' &&
      (!this.deps.identity?.namespace || !this.deps.ledger)
    )
      return 'runtime-batch-requires-u7';
    const raw = this.deps.enabledSeason;
    if (raw === undefined || raw === '') return 'ingest-disabled';
    if (!seasonPattern.test(raw) || this.metadataFor(Number(raw)) === null) {
      return 'ingest-misconfigured';
    }
    if (
      this.deps.environment !== 'staging' &&
      this.deps.environment !== 'production'
    ) {
      return 'environment-not-permitted';
    }
    const control = this.deps.cutoverControl;
    if (
      this.deps.environment === 'production' &&
      !(control.kind === 'genesis' && control.season === Number(raw))
    ) {
      return 'genesis-control-required';
    }
    if (this.deps.providerMode === 'coordinated') {
      return 'provider-mode-coordinated';
    }
    if (this.deps.guarded === null) return 'authority-not-sequenced';
    const credit = attributionCredit(this.attributionRecord);
    if (credit === null || !credit.admitsBatch) return 'attribution-not-active';
    return { season: Number(raw), guarded: this.deps.guarded, credit };
  }

  /** Verifies and publishes one decoded submission for an admitted Worker. */
  async ingest(
    admitted: Admitted,
    submission: SeasonBatchSubmission,
  ): Promise<SeasonBatchIngestOutcome> {
    if (this.deps.identityMode === 'runtime') {
      if (!this.deps.identity?.namespace || !this.deps.ledger)
        return this.refused('admission', 'runtime-batch-requires-u7');
      return this.runtimeIngest(admitted, submission);
    }
    return this.verifiedIngest(admitted, submission);
  }

  private async verifiedIngest(
    admitted: Admitted,
    submission: SeasonBatchSubmission,
    context?: IdentityRunContext,
    now = this.deps.clock.now(),
    beforePublish?: () => Promise<void>,
    onPrepared?: (version: string) => Promise<void>,
  ): Promise<SeasonBatchIngestOutcome> {
    if (submission.season !== admitted.season) {
      return this.refused('request', 'season-not-enabled');
    }
    const verified = await verifySeasonBatch({
      identityContext: context,
      manifest: submission.manifest,
      artifact: submission.artifact,
      reviewedManifestSha256: submission.reviewedManifestSha256,
      season: admitted.season,
      now,
      metadata: context
        ? context.seasonMetadata
        : this.metadataFor(admitted.season),
      attribution: admitted.credit.attribution,
    });
    if (!verified.ok) return this.refused('verification', verified.failure);

    const set = candidateAt(verified.batch, now);
    if (set === null) return this.refused('verification', 'generation-failed');
    await beforePublish?.();
    const result = await admitted.guarded.publishGuarded(set, {
      onPrepared,
      expectedActiveVersion: submission.expectedActiveVersion,
    });
    return this.published(result, verified.batch, submission);
  }

  private async runtimeIngest(
    admitted: Admitted,
    submission: SeasonBatchSubmission,
  ): Promise<SeasonBatchIngestOutcome> {
    if (submission.season !== admitted.season)
      return this.refused('request', 'season-not-enabled');
    const ledger = this.deps.ledger!,
      config = this.deps.identity!;
    const acquired = await ledger.acquireLease(admitted.season);
    if (acquired.outcome !== 'acquired')
      return this.refused('admission', 'batch-lease-unavailable');
    const lease = {
      season: acquired.lease.season,
      fence: acquired.lease.fence,
    };
    try {
      const digest = await sha256Hex(utf8(canonicalJson(submission)));
      const artifact = submission.artifact as { schemaVersion?: unknown };
      const legacy = artifact?.schemaVersion === 1;
      if (!legacy && !submission.operationId)
        return this.refused('admission', 'runtime-batch-requires-u7');
      // v1 wire format stays unchanged; identical legacy submissions share a stable operation.
      const operationId =
        submission.operationId ??
        `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
      // U10: the installation's trusted effective policy, never the
      // submission's own claim. Legacy v1 batches never gain the optional
      // policy: under it they are refused before any catalog call.
      const optional = config.inventoryMode === 'optional-drivers';
      if (legacy && optional)
        return this.refused('admission', 'runtime-batch-requires-u7');
      const request: BatchAdmissionRequest = {
        ...(optional
          ? {
              schemaVersion: 2 as const,
              inventoryPolicy: 'optional-driver-inventory-v1' as const,
            }
          : { schemaVersion: 1 as const }),
        operationId,
        installationId: config.installationId ?? '',
        season: admitted.season,
        submissionHash: 'sha256:' + digest,
        leaseFence: lease.fence,
        legacy,
        compatibilityInstallation: this.deps.compatibilityInstallation ?? null,
      };
      const { receipt, context } = await admitBatchCatalog(config, request);
      if (receipt.state === 'complete')
        return receipt.result as SeasonBatchIngestOutcome;
      if (!context) throw Error('catalog-context-required');
      // A crash after intent may have finalized. Never send a second candidate;
      // the sequencer/predecessor and the retained receipt resolve that uncertainty.
      if (receipt.state === 'publishing') {
        const recovered = await this.recoverBatch(
          admitted,
          submission,
          context,
          receipt.admittedAt,
          receipt.result,
        );
        if (!recovered)
          return this.refused('admission', 'batch-recovery-required');
        await batchCatalogCall(config, '/batch-transition', {
          request,
          state: 'complete',
          result: recovered,
        });
        return recovered;
      }
      if (legacy && !receipt.legacyAllowed)
        return this.refused('admission', 'runtime-batch-requires-u7');
      if (
        !legacy &&
        (
          submission.manifest as {
            identityCatalog?: { exportSha256?: unknown };
          }
        ).identityCatalog?.exportSha256 !== receipt.exportSha256
      )
        return this.refused('verification', 'catalog-reference-mismatch');
      const assertLease = async () => {
        const current = await ledger.readSeason(admitted.season);
        if (
          current.outcome !== 'read' ||
          current.snapshot.lease?.state !== 'held' ||
          current.snapshot.lease.fence !== lease.fence ||
          Date.parse(acquired.lease.expiresAt) <=
            this.deps.clock.now().getTime() ||
          current.snapshot.seasonRecord?.record.operatorHold ||
          current.snapshot.seasonRecord?.record.durableBlock
        )
          throw Error('batch-lease-invalid');
      };
      const result = await this.verifiedIngest(
        admitted,
        submission,
        context,
        new Date(receipt.admittedAt),
        async () => {
          await assertLease();
          await batchCatalogCall(config, '/batch-transition', {
            request,
            state: 'publishing',
            result: null,
          });
        },
        async (candidateVersion) => {
          await assertLease();
          await batchCatalogCall(config, '/batch-transition', {
            request,
            state: 'publishing',
            result: { candidateVersion },
          });
          if (
            Date.parse(acquired.lease.expiresAt) <=
            this.deps.clock.now().getTime()
          )
            throw Error('batch-lease-invalid');
        },
      );
      await batchCatalogCall(config, '/batch-transition', {
        request,
        state: 'complete',
        result,
      });
      return result;
    } catch (error) {
      return this.refused(
        'admission',
        error instanceof BatchCatalogError
          ? error.failure
          : 'catalog-admission-refused',
      );
    } finally {
      await releaseSeasonLease(ledger, lease);
    }
  }

  private async recoverBatch(
    admitted: Admitted,
    submission: SeasonBatchSubmission,
    context: IdentityRunContext,
    admittedAt: string,
    intent: unknown,
  ): Promise<SeasonBatchIngestOutcome | null> {
    const recovery = this.deps.recovery;
    if (
      !recovery ||
      !isRecord(intent) ||
      typeof intent.candidateVersion !== 'string'
    )
      return null;
    const authority = await recovery.port.readAuthority(admitted.season);
    if (
      authority.cutoverState !== 'active' ||
      !authority.authoritative ||
      (authority.activeVersion !== intent.candidateVersion &&
        authority.previousVersion !== intent.candidateVersion)
    )
      return null;
    const sidecar = await readStoredPublicationMetadata(
      recovery.storage,
      admitted.season,
      intent.candidateVersion,
    );
    if (sidecar.kind !== 'record') return null;
    const verified = await verifySeasonBatch({
      manifest: submission.manifest,
      artifact: submission.artifact,
      reviewedManifestSha256: submission.reviewedManifestSha256,
      season: admitted.season,
      now: new Date(admittedAt),
      metadata: context.seasonMetadata,
      attribution: admitted.credit.attribution,
      identityContext: context,
    });
    if (
      !verified.ok ||
      sidecar.record.sourceOrderingInput !== verified.batch.observedAt
    )
      return null;
    const result = this.published(
      {
        status: 'applied',
        season: admitted.season,
        version: intent.candidateVersion,
        previousVersion: submission.expectedActiveVersion,
        reason: 'idempotent',
        cachePurgeOk: true,
        cachePurge: 'not-required',
        pointerMaintenance: 'not-required',
        purgedUrls: [],
      },
      verified.batch,
      submission,
    );
    if (result.outcome !== 'publication') return null;
    // These maintenance fields describe this recovery only, never the lost call.
    return {
      ...result,
      publication: { ...result.publication, recovered: true },
    };
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
