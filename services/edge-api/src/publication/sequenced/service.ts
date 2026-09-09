/**
 * The season publication sequencer wired into ordinary publication, rollback
 * and the operator cache purge (ADR 0025 D3, D4, D8) - **disabled by default**.
 *
 * The composition root constructs this only when
 * `SEASON_PUBLICATION_AUTHORITY=sequencer` is set *and* a sequencer port is
 * reachable. Every deployed environment leaves that unset, gets the bare
 * `SnapshotPublisher` instead, and never reaches this file. Even when it is
 * constructed, this service delegates to the legacy `SnapshotPublisher` for any
 * season whose authority has not been switched to `cutoverState: 'active'` -
 * which no environment has done - so the two-phase protocol below runs only
 * under a test that has explicitly seeded and activated a season.
 *
 * ## Why the two-phase protocol lives here and not in `SnapshotPublisher`
 *
 * `SnapshotPublisher` is the legacy Workers KV pointer authority and stays
 * exactly as it is: its commit point is `setActiveVersion`, a KV write. Here the
 * commit point is `SeasonPublicationSequencer.finalize`, one atomic Durable
 * Object storage transaction with no external KV pointer write inside it
 * (ADR 0025 D2, D9). The caller never mints or chooses a version - `prepare`
 * allocates it in the sidecar-required `pm1-…` namespace - and every per-key
 * `snapshotObservedAt` is assigned by `prepare`, not by generation.
 */

import {
  currentAliasUrlsForDocuments,
  invalidationUrlsForDocuments,
  type CachePurgeAdapter,
  type SeasonAliasing,
} from '../../cache/purge';
import type { Logger } from '../../logging/logger';
import { systemClock, type Clock } from '../../runtime/clock';
import { contentMetadataFromManifest } from '../../storage/types';
import type {
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
} from '../../storage/types';
import type { SnapshotValidator } from '../../validation/snapshot-validator';
import type { GeneratedSnapshotSet } from '../../snapshots/generator';
import type { ContentManifest } from '../../contract/types';
import type { PublicationCommands } from '../commands';
import type {
  ManualCachePurgeResult,
  PointerMaintenanceDisposition,
  PublicationReason,
  PublicationResult,
} from '../publisher';
import { manifestCommitment } from '../sequencer/manifest-commitment';
import type {
  OperationKind,
  PerKeyState,
  PrepareOutcome,
} from '../sequencer/model';
import type { SeasonPublicationSequencerPort } from '../sequencer/port';
import { readStoredInventory } from '../version-inventory';
import { writePublicationMetadataOnce } from '../publication-metadata';
import { buildPublicationPlan, type PublicationPlan } from './manifest-plan';
import { bakeAssignedTimestamps, refreshVolatileFields } from './documents';
import { resolveRollbackSourceOrdering } from './rollback-provenance';

/** Season-level documents every generated set carries; also the manual-purge base. */
const baseDocumentNames: readonly SnapshotDocumentName[] = [
  'season',
  'bootstrap',
  'home',
  'calendar',
  'drivers',
  'constructors',
  'circuits',
  'standings:drivers',
  'standings:constructors',
  'content:manifest',
];

const activePointerDerivedDocuments: readonly SnapshotDocumentName[] = [
  'bootstrap',
  'home',
  'season',
  'content:manifest',
];

type Attempt<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false };

async function attempt<T>(op: () => Promise<T> | T): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await op() };
  } catch {
    return { ok: false };
  }
}

/**
 * The season the public `current` aliases pointed at before this operation
 * moved the current-season pointer, when that is not the season being written.
 *
 * The same closed domain `SnapshotPublisher` uses, and for the same reason:
 * "nothing else was current" and "we could not find out what was current" are
 * different facts, and only the first means there is nothing left to
 * invalidate. It is read **before** `finalize`, because after the commit the
 * pointer this derives from is the one the post-commit maintenance overwrites.
 */
type OutgoingCurrentSeason =
  | { readonly kind: 'none' }
  | { readonly kind: 'season'; readonly season: number }
  | { readonly kind: 'unresolved' };

const noOutgoingCurrentSeason: OutgoingCurrentSeason = { kind: 'none' };

function outgoingCurrentSeason(
  read: Attempt<number | null>,
  season: number,
): OutgoingCurrentSeason {
  if (!read.ok) return { kind: 'unresolved' };
  if (read.value === null || read.value === season) {
    return noOutgoingCurrentSeason;
  }
  return { kind: 'season', season: read.value };
}

export interface SequencedPublicationDeps {
  readonly port: SeasonPublicationSequencerPort;
  /** The legacy authority, used for any season that is not `active`. */
  readonly fallback: PublicationCommands;
  readonly storage: SnapshotStorage;
  readonly validator: SnapshotValidator;
  readonly purger: CachePurgeAdapter;
  readonly logger: Logger;
  readonly clock?: Clock;
  readonly purgeOrigin?: string;
}

interface ActiveAuthority {
  readonly activeVersion: string;
  readonly previousVersion: string | null;
}

interface TwoPhaseInput {
  readonly season: number;
  readonly operationKind: OperationKind;
  /** Final stable data; volatile fields already fresh; timestamps not yet assigned. */
  readonly documents: readonly StoredSnapshot[];
  readonly sourceOrderingInput: string;
  readonly authority: ActiveAuthority;
  /** Ordinary publication moves the current-season pointer and content metadata. */
  readonly publishesSeasonPointer: boolean;
}

export class SequencedPublicationService implements PublicationCommands {
  private readonly port: SeasonPublicationSequencerPort;
  private readonly fallback: PublicationCommands;
  private readonly storage: SnapshotStorage;
  private readonly validator: SnapshotValidator;
  private readonly purger: CachePurgeAdapter;
  private readonly logger: Logger;
  private readonly clock: Clock;
  private readonly purgeOrigin: string;

  constructor(deps: SequencedPublicationDeps) {
    this.port = deps.port;
    this.fallback = deps.fallback;
    this.storage = deps.storage;
    this.validator = deps.validator;
    this.purger = deps.purger;
    this.logger = deps.logger;
    this.clock = deps.clock ?? systemClock;
    this.purgeOrigin = deps.purgeOrigin ?? 'https://api.gridview.local';
  }

  async publish(set: GeneratedSnapshotSet): Promise<PublicationResult> {
    const authority = await this.activeAuthority(set.season);
    if (authority === null) return this.fallback.publish(set);
    if (authority === 'unavailable') {
      return failed(
        set.season,
        set.version,
        null,
        'sequencer-authority-unavailable',
      );
    }

    const validation = await this.validateDocuments(set.season, set.documents);
    if (validation !== null) {
      return {
        status: validation.status,
        season: set.season,
        version: set.version,
        previousVersion: authority.activeVersion,
        reason: 'contract-validation',
        cachePurgeOk: true,
        cachePurge: 'not-required',
        pointerMaintenance: 'not-required',
        purgedUrls: [],
      };
    }

    return this.runTwoPhase({
      season: set.season,
      operationKind: 'ordinary-publication',
      documents: set.documents,
      sourceOrderingInput: set.sourceUpdatedAt,
      authority,
      publishesSeasonPointer: true,
    });
  }

  async rollback(
    season: number,
    targetVersion?: string,
  ): Promise<PublicationResult> {
    const authority = await this.activeAuthority(season);
    if (authority === null)
      return this.fallback.rollback(season, targetVersion);
    if (authority === 'unavailable') {
      return failed(season, '', null, 'sequencer-authority-unavailable');
    }

    const target = targetVersion ?? authority.previousVersion;
    if (target === null) {
      return rejection(
        season,
        '',
        authority.activeVersion,
        'missing-previous-version',
      );
    }
    if (target === authority.activeVersion) {
      return {
        status: 'skipped',
        season,
        version: target,
        previousVersion: authority.activeVersion,
        reason: 'idempotent',
        cachePurgeOk: true,
        cachePurge: 'not-required',
        pointerMaintenance: 'not-required',
        purgedUrls: [],
      };
    }

    // Read and validate the exact target: its inventory and every document it names.
    const inventory = await readStoredInventory(this.storage, season, target);
    if (inventory.kind === 'unreadable') {
      return failed(season, target, authority.activeVersion, 'storage-read');
    }
    if (inventory.kind !== 'documents') {
      return rejection(
        season,
        target,
        authority.activeVersion,
        'missing-version-inventory',
      );
    }
    if (inventory.documents.length === 0) {
      return rejection(
        season,
        target,
        authority.activeVersion,
        'rollback-target-missing',
      );
    }

    const documents = new Map<SnapshotDocumentName, StoredSnapshot>();
    for (const name of inventory.documents) {
      const read = await attempt(() =>
        this.storage.readVersionedDocument(season, target, name),
      );
      if (!read.ok) {
        return failed(season, target, authority.activeVersion, 'storage-read');
      }
      if (read.value === null) {
        return rejection(
          season,
          target,
          authority.activeVersion,
          'rollback-target-incomplete',
        );
      }
      documents.set(name, read.value);
    }

    // Resolve the target's own release-wide ordering input before `prepare`.
    const provenance = await resolveRollbackSourceOrdering(
      this.storage,
      season,
      target,
      documents,
    );
    if (provenance.kind === 'rejected') {
      this.logger.warn({
        operation: 'rollback.sequencer.rejected',
        season,
        releaseVersion: target,
        failureCategory: 'rollback-source-ordering-unavailable',
        publicationStatus: provenance.classification,
      });
      return rejection(
        season,
        target,
        authority.activeVersion,
        'rollback-source-ordering-unavailable',
      );
    }
    this.logger.info({
      operation: 'rollback.sequencer.provenance',
      season,
      releaseVersion: target,
      publicationStatus: provenance.classification,
    });

    // Copy the stable historical data verbatim; regenerate only volatile fields.
    const refreshed = refreshVolatileFields(
      [...documents.values()],
      this.clock.now(),
    );
    const validation = await this.validateDocuments(season, refreshed);
    if (validation !== null) {
      return rejection(
        season,
        target,
        authority.activeVersion,
        'contract-validation',
      );
    }

    return this.runTwoPhase({
      season,
      operationKind: 'rollback-republication',
      documents: refreshed,
      sourceOrderingInput: provenance.sourceOrderingInput,
      authority,
      publishesSeasonPointer: false,
    });
  }

  async purgeActiveVersion(season: number): Promise<ManualCachePurgeResult> {
    const authority = await this.activeAuthority(season);
    if (authority === null) return this.fallback.purgeActiveVersion(season);
    if (authority === 'unavailable') {
      return {
        season,
        activeVersion: null,
        ok: false,
        reason: 'sequencer-authority-unavailable',
        urls: [],
      };
    }
    const inventory = await readStoredInventory(
      this.storage,
      season,
      authority.activeVersion,
    );
    if (inventory.kind === 'unreadable') {
      return {
        season,
        activeVersion: authority.activeVersion,
        ok: false,
        reason: 'storage-read',
        urls: [],
      };
    }
    if (inventory.kind !== 'documents') {
      return {
        season,
        activeVersion: authority.activeVersion,
        ok: false,
        reason: 'missing-version-inventory',
        urls: [],
      };
    }
    const purge = await this.purgeDocuments(season, inventory.documents, []);
    return {
      season,
      activeVersion: authority.activeVersion,
      ok: purge.ok,
      reason: purge.ok ? null : 'cache-purge-failed',
      urls: purge.urls,
    };
  }

  // --- the shared two-phase core -------------------------------------------

  private async runTwoPhase(input: TwoPhaseInput): Promise<PublicationResult> {
    const plan = await buildPublicationPlan(input.documents);

    // Read before anything commits. `meta:current-season` is global state that
    // the post-commit maintenance below overwrites, so afterwards there is no
    // way left to tell which season's aliases this publication took over.
    const outgoing = input.publishesSeasonPointer
      ? outgoingCurrentSeason(
          await attempt(() => this.storage.getCurrentSeason()),
          input.season,
        )
      : noOutgoingCurrentSeason;

    const prepared = await this.prepareWithCleanup(input, plan);
    if (prepared.kind !== 'prepared') {
      // A prepare refusal is not automatically an operational failure: a
      // strictly older ordinary candidate is the pacing system working, and
      // the publication contract treats it as a benign completed no-op only
      // when its status is `rejected`.
      const outcome = prepared.status === 'rejected' ? rejection : failed;
      return outcome(
        input.season,
        '',
        input.authority.activeVersion,
        prepared.reason,
      );
    }
    const {
      operationEpoch,
      operationToken,
      candidateVersion,
      assignedTimestamps,
    } = prepared;

    const baked = bakeAssignedTimestamps(input.documents, assignedTimestamps);

    const writeReason = await this.writeCandidate(
      input,
      candidateVersion,
      baked,
      plan.documentNames,
    );
    if (writeReason !== null) {
      await this.cancelAndClean(
        input.season,
        operationEpoch,
        operationToken,
        candidateVersion,
      );
      return failed(
        input.season,
        candidateVersion,
        input.authority.activeVersion,
        writeReason,
      );
    }

    // Every required write succeeded: attest the manifest actually written and
    // finalize. The attestation names exactly `plan.documentNames`, so it
    // equals `expectedManifestCommitment` by construction - the Durable Object
    // still re-checks it (ADR 0025 D4).
    const completionAttestation = {
      manifestCommitment: await manifestCommitment(plan.documentNames),
    };
    const call = await attempt(() =>
      this.port.finalize({
        season: input.season,
        operationEpoch,
        operationToken,
        completionAttestation,
      }),
    );
    if (!call.ok) {
      // The commit call itself did not resolve, so whether it committed is
      // genuinely unknown. Nothing is cleaned up here: deleting the candidate
      // could destroy a release that did commit, and the sequencer's own
      // pending-cleanup slot collects it if it did not (ADR 0025 D5). No global
      // state was touched, so the prior release keeps serving either way.
      this.logger.warn({
        operation: 'publication.sequencer.finalize_unavailable',
        season: input.season,
        releaseVersion: candidateVersion,
        failureCategory: 'sequencer-authority-unavailable',
      });
      return failed(
        input.season,
        candidateVersion,
        input.authority.activeVersion,
        'sequencer-authority-unavailable',
      );
    }
    const finalized = call.value;

    if (finalized.outcome === 'superseded') {
      this.logger.warn({
        operation: 'publication.sequencer.superseded',
        season: input.season,
        releaseVersion: candidateVersion,
      });
      return failed(
        input.season,
        candidateVersion,
        input.authority.activeVersion,
        'sequencer-operation-superseded',
      );
    }
    if (finalized.outcome === 'rejected') {
      this.logger.warn({
        operation: 'publication.sequencer.rejected',
        season: input.season,
        releaseVersion: candidateVersion,
        failureCategory: finalized.reason,
      });
      await this.cancelAndClean(
        input.season,
        operationEpoch,
        operationToken,
        candidateVersion,
      );
      return failed(
        input.season,
        candidateVersion,
        input.authority.activeVersion,
        'sequencer-prepare-rejected',
      );
    }

    // Committed. Everything below is post-commit and best-effort; none of it
    // can un-publish (ADR 0025 D9 "Failure behavior").
    //
    // The global current-season and content-metadata writes belong here rather
    // than in the candidate write phase: they decide which season
    // `/v1/seasons/current` resolves to, so performing them before the
    // authoritative `finalize` would make a *pre-commit* failure - an expired
    // lease, a supersession, a corrupt-state rejection - user-visible while the
    // prior release is still the one serving.
    const maintenance = input.publishesSeasonPointer
      ? await this.maintainGlobalMetadata(input.season, baked)
      : 'not-required';
    const withdrawn = await this.withdrawnRoutes(
      input.season,
      input.authority.activeVersion,
      plan.documentNames,
    );
    const purge = await this.purgeDocuments(
      input.season,
      plan.documentNames,
      withdrawn.documents,
      withdrawn.enumerable,
      // A rejected maintenance write is not proof the pointer stayed put: the
      // write can land and still be reported as a failure, in which case the
      // outgoing season silently lost the `current` aliases. Invalidating them
      // whenever the outcome is uncertain costs a re-fetch of URLs that still
      // resolve correctly; skipping them would serve the prior season for a
      // whole profile TTL. Operations that move no global pointer - a rollback,
      // a same-season publication - already carry `noOutgoingCurrentSeason`.
      outgoing,
    );
    this.logger.info({
      operation: 'publication.sequencer.committed',
      season: input.season,
      releaseVersion: candidateVersion,
      publicationStatus: input.operationKind,
      cacheOutcome: purge.ok ? 'purged' : 'purge-failed',
      pointerMaintenance: maintenance,
    });
    return {
      status: 'applied',
      season: input.season,
      version: candidateVersion,
      previousVersion: input.authority.activeVersion,
      reason: appliedReason(maintenance, purge.ok),
      cachePurgeOk: purge.ok,
      cachePurge: purge.ok ? 'succeeded' : 'failed',
      // `previous` commits atomically with `active` inside the Durable Object
      // transaction, so this disposition carries the *global* maintenance
      // instead: `not-required` whenever the operation moves no global pointer.
      pointerMaintenance: maintenance,
      purgedUrls: purge.urls,
    };
  }

  /**
   * The post-commit global maintenance an ordinary publication owes.
   *
   * Runs only after `finalize` has committed, and its failure never un-publishes
   * the release: the season's own documents and authority record are already
   * correct, and what degraded is which season the public `current` aliases
   * resolve to. Reported as a bounded disposition rather than escaping or
   * turning a committed publication into `failed`.
   */
  private async maintainGlobalMetadata(
    season: number,
    baked: readonly StoredSnapshot[],
  ): Promise<PointerMaintenanceDisposition> {
    const manifest = baked.find(
      (document) => document.documentName === 'content:manifest',
    );
    const written = await attempt(async () => {
      if (manifest) {
        await this.storage.setContentMetadata(
          contentMetadataFromManifest(
            manifest.data as ContentManifest,
            manifest.meta.generatedAt,
          ),
        );
      }
      await this.storage.setCurrentSeason(season);
    });
    if (written.ok) return 'succeeded';
    this.logger.warn({
      operation: 'publication.sequencer.current_season_maintenance_failed',
      season,
      failureCategory: 'current-season-maintenance-failed',
    });
    return 'failed';
  }

  private async prepareWithCleanup(
    input: TwoPhaseInput,
    plan: PublicationPlan,
    retried = false,
  ): Promise<
    | {
        kind: 'prepared';
        operationEpoch: number;
        operationToken: string;
        candidateVersion: string;
        assignedTimestamps: readonly PerKeyState[];
      }
    | {
        kind: 'rejected';
        /**
         * How the *publication* ends, not how the sequencer refused. Only the
         * strictly-older ordinary candidate is a benign `rejected` no-op;
         * backpressure, corrupt state, an unavailable authority and both
         * exhaustion reasons stay operational failures.
         */
        status: 'failed' | 'rejected';
        reason: PublicationReason;
      }
  > {
    const outcome: PrepareOutcome = await this.port.prepare({
      season: input.season,
      operationKind: input.operationKind,
      perKeyRevisions: plan.perKeyRevisions,
      sourceOrderingInput: input.sourceOrderingInput,
      expectedManifestCommitment: plan.expectedManifestCommitment,
    });

    if (outcome.outcome === 'prepared') {
      if (outcome.retiredCleanup) {
        await this.drainOrphan(
          input.season,
          outcome.retiredCleanup.operationEpoch,
          outcome.retiredCleanup.candidateVersion,
        );
      }
      return {
        kind: 'prepared',
        operationEpoch: outcome.operationEpoch,
        operationToken: outcome.operationToken,
        candidateVersion: outcome.candidateVersion,
        assignedTimestamps: outcome.assignedTimestamps,
      };
    }

    if (
      outcome.reason === 'pending-cleanup-required' &&
      outcome.pendingCleanup
    ) {
      await this.drainOrphan(
        input.season,
        outcome.pendingCleanup.operationEpoch,
        outcome.pendingCleanup.candidateVersion,
      );
      if (!retried) return this.prepareWithCleanup(input, plan, true);
    }

    this.logger.warn({
      operation: 'publication.sequencer.rejected',
      season: input.season,
      failureCategory: outcome.reason,
      publicationStatus: input.operationKind,
    });
    if (outcome.reason === 'older-source-ordering-input') {
      // The one benign refusal: nothing needed publishing, and the legacy
      // publisher reports exactly this pair for the same candidate.
      return {
        kind: 'rejected',
        status: 'rejected',
        reason: 'older-source-updated-at',
      };
    }
    if (outcome.reason === 'authority-not-active') {
      return {
        kind: 'rejected',
        status: 'failed',
        reason: 'sequencer-authority-unavailable',
      };
    }
    return {
      kind: 'rejected',
      status: 'failed',
      reason: 'sequencer-prepare-rejected',
    };
  }

  private async validateDocuments(
    season: number,
    documents: readonly StoredSnapshot[],
  ): Promise<{ status: 'rejected' | 'failed' } | null> {
    for (const document of documents) {
      const validated = await attempt(() => this.validator.validate(document));
      if (!validated.ok) {
        this.logger.warn({
          operation: 'publication.validation_failed',
          season,
          failureCategory: 'contract-validation',
          issueCount: 0,
          documentName: document.documentName,
        });
        return { status: 'failed' };
      }
      if (validated.value.length > 0) {
        this.logger.warn({
          operation: 'publication.validation_failed',
          season,
          failureCategory: 'contract-validation',
          issueCount: validated.value.length,
          documentName: document.documentName,
        });
        return { status: 'rejected' };
      }
    }
    return null;
  }

  private async writeCandidate(
    input: TwoPhaseInput,
    candidateVersion: string,
    baked: readonly StoredSnapshot[],
    documentNames: readonly SnapshotDocumentName[],
  ): Promise<PublicationReason | null> {
    const written = await attempt(async () => {
      for (const document of baked) {
        await this.storage.writeVersionedDocument(
          input.season,
          candidateVersion,
          document,
        );
      }
      await this.storage.writeVersionInventory(
        input.season,
        candidateVersion,
        documentNames,
      );
    });
    if (!written.ok) return 'storage-write';

    // The sidecar is part of the required publication write set (ADR 0025 D3):
    // a refused, failed or ambiguous write here has the same consequence as a
    // failed document write.
    const sidecar = await attempt(() =>
      writePublicationMetadataOnce(
        this.storage,
        input.season,
        candidateVersion,
        input.sourceOrderingInput,
      ),
    );
    if (!sidecar.ok || sidecar.value.outcome === 'refused') {
      return 'storage-write';
    }

    const complete = await attempt(() =>
      this.versionIsComplete(input.season, candidateVersion, documentNames),
    );
    if (!complete.ok) return 'storage-read';
    if (!complete.value) return 'incomplete-version';

    // Deliberately nothing global here. This phase writes only the candidate's
    // own immutable, versioned artifacts - the documents, the inventory and the
    // `__publication_metadata` sidecar the attestation requires. `meta:content-schema`
    // and `meta:current-season` are global state that a live response reads, so
    // they belong strictly after `finalize` (see `maintainGlobalMetadata`).
    return null;
  }

  private async versionIsComplete(
    season: number,
    version: string,
    documentNames: readonly SnapshotDocumentName[],
  ): Promise<boolean> {
    const recorded = new Set<string>(documentNames);
    for (const name of baseDocumentNames) {
      if (!recorded.has(name)) return false;
    }
    for (const name of documentNames) {
      if (!(await this.storage.readVersionedDocument(season, version, name))) {
        return false;
      }
    }
    return true;
  }

  // --- cleanup -----------------------------------------------------------------

  private async cancelAndClean(
    season: number,
    operationEpoch: number,
    operationToken: string,
    candidateVersion: string,
  ): Promise<void> {
    await attempt(() =>
      this.port.cancel({ season, operationEpoch, operationToken }),
    );
    const authorized = await attempt(() =>
      this.port.authorizeCleanup({
        season,
        operationEpoch,
        operationToken,
        candidateVersion,
      }),
    );
    if (authorized.ok && authorized.value.outcome === 'authorized') {
      await this.deleteCandidate(season, candidateVersion);
      await attempt(() =>
        this.port.acknowledgeCleanup({
          season,
          operationEpoch,
          operationToken,
          candidateVersion,
        }),
      );
    }
    this.logger.info({
      operation: 'publication.sequencer.candidate_cleanup',
      season,
      releaseVersion: candidateVersion,
      cacheOutcome: authorized.ok ? authorized.value.outcome : 'unavailable',
    });
  }

  private async drainOrphan(
    season: number,
    operationEpoch: number,
    candidateVersion: string,
  ): Promise<void> {
    const authorized = await attempt(() =>
      this.port.authorizeCleanup({ season, operationEpoch, candidateVersion }),
    );
    if (authorized.ok && authorized.value.outcome === 'authorized') {
      await this.deleteCandidate(season, candidateVersion);
      await attempt(() =>
        this.port.acknowledgeCleanup({
          season,
          operationEpoch,
          candidateVersion,
        }),
      );
    }
    this.logger.info({
      operation: 'publication.sequencer.candidate_cleanup',
      season,
      releaseVersion: candidateVersion,
      cacheOutcome: authorized.ok ? authorized.value.outcome : 'unavailable',
    });
  }

  private async deleteCandidate(
    season: number,
    version: string,
  ): Promise<void> {
    await attempt(() => this.storage.deleteUnpublishedVersion(season, version));
    await attempt(() =>
      this.storage.deletePublicationMetadata(season, version),
    );
  }

  // --- authority + purge -----------------------------------------------------

  /**
   * `null` - not `active`, so the caller delegates to the legacy authority.
   * `'unavailable'` - the lookup itself could not be resolved; fail closed.
   */
  private async activeAuthority(
    season: number,
  ): Promise<ActiveAuthority | null | 'unavailable'> {
    const read = await attempt(() => this.port.readAuthority(season));
    if (!read.ok) return 'unavailable';
    const authority = read.value;
    if (authority.cutoverState === 'unavailable') return 'unavailable';
    if (authority.cutoverState !== 'active') return null;
    return {
      activeVersion: authority.activeVersion,
      previousVersion: authority.previousVersion,
    };
  }

  private async withdrawnRoutes(
    season: number,
    replacedVersion: string | null,
    newDocuments: readonly SnapshotDocumentName[],
  ): Promise<{ documents: SnapshotDocumentName[]; enumerable: boolean }> {
    if (replacedVersion === null) return { documents: [], enumerable: true };
    const inventory = await readStoredInventory(
      this.storage,
      season,
      replacedVersion,
    );
    if (inventory.kind !== 'documents') {
      return { documents: [], enumerable: false };
    }
    const kept = new Set<string>(newDocuments);
    return {
      documents: inventory.documents.filter((name) => !kept.has(name)),
      enumerable: true,
    };
  }

  /**
   * The post-commit invalidation set, over the same shared route expansion the
   * legacy publisher uses so the two can never disagree about a document's URLs.
   *
   * Three surfaces go in: the incoming season's own documents (canonical URLs
   * plus, while it is current, its aliases), the same-season routes this release
   * withdrew, and - when this publication may have changed the current season -
   * the alias URLs the **outgoing** season was being served through. That last
   * one is not covered by the others: a profile only the outgoing season carried
   * has an alias URL no incoming document names, and it would keep serving the
   * prior season from a CDN for its whole profile TTL. Only aliases are taken
   * from it; the outgoing season's canonical numeric routes still serve correct
   * content and evicting them would be over-invalidation.
   */
  private async purgeDocuments(
    season: number,
    documents: readonly SnapshotDocumentName[],
    withdrawn: readonly SnapshotDocumentName[],
    enumerable = true,
    outgoing: OutgoingCurrentSeason = noOutgoingCurrentSeason,
  ): Promise<{ ok: boolean; urls: string[] }> {
    const aliasing = await this.seasonAliasing(season);
    const invalidated = new Set(
      invalidationUrlsForDocuments(
        this.purgeOrigin,
        season,
        [...documents, ...withdrawn, ...activePointerDerivedDocuments],
        aliasing,
      ),
    );
    for (const url of currentAliasUrlsForDocuments(
      this.purgeOrigin,
      withdrawn,
    )) {
      invalidated.add(url);
    }
    const outgoingAliases = await this.outgoingAliasUrls(outgoing);
    for (const url of outgoingAliases ?? []) invalidated.add(url);

    const urls = [...invalidated].sort();
    const purged = await attempt(() => this.purger.purgePublicUrls(urls));
    return {
      ok:
        enumerable && outgoingAliases !== null && purged.ok && purged.value.ok,
      urls: purged.ok ? purged.value.urls : [],
    };
  }

  /**
   * The alias URLs the outgoing current season was being served through, or
   * `null` when that surface cannot be enumerated at all.
   *
   * The outgoing season's active version is resolved through **its own**
   * authority: a season the sequencer owns is read from the sequencer, and only
   * a season it does not own falls back to the legacy pointer. Reading
   * `active:{season}` for a cut-over season would be exactly the post-activation
   * legacy read ADR 0025 D6/D7 forbid, even for a cache decision.
   */
  private async outgoingAliasUrls(
    outgoing: OutgoingCurrentSeason,
  ): Promise<string[] | null> {
    if (outgoing.kind === 'none') return [];
    if (outgoing.kind === 'unresolved') return null;

    const version = await this.outgoingActiveVersion(outgoing.season);
    if (version === 'unresolved') return null;
    if (version === null) return [];

    const inventory = await readStoredInventory(
      this.storage,
      outgoing.season,
      version,
    );
    if (inventory.kind !== 'documents') return null;
    return currentAliasUrlsForDocuments(this.purgeOrigin, inventory.documents);
  }

  private async outgoingActiveVersion(
    season: number,
  ): Promise<string | null | 'unresolved'> {
    const authority = await this.activeAuthority(season);
    if (authority === 'unavailable') return 'unresolved';
    if (authority !== null) return authority.activeVersion;
    const legacy = await attempt(() => this.storage.getActiveVersion(season));
    return legacy.ok ? legacy.value : 'unresolved';
  }

  private async seasonAliasing(season: number): Promise<SeasonAliasing> {
    const current = await attempt(() => this.storage.getCurrentSeason());
    if (!current.ok || current.value === null) return 'season-is-current';
    return current.value === season
      ? 'season-is-current'
      : 'season-is-historical';
  }
}

/**
 * The single bounded reason a committed release carries.
 *
 * Same precedence as the legacy publisher's: the degradation an operator has to
 * act on first wins, and a wrong current season silently misroutes every
 * `current` alias while a stale cache is visible and self-correcting.
 */
function appliedReason(
  maintenance: PointerMaintenanceDisposition,
  purgeOk: boolean,
): PublicationReason | null {
  if (maintenance === 'failed') return 'current-season-maintenance-failed';
  return purgeOk ? null : 'cache-purge-failed';
}

function failed(
  season: number,
  version: string,
  previousVersion: string | null,
  reason: PublicationReason,
): PublicationResult {
  return {
    status: 'failed',
    season,
    version,
    previousVersion,
    reason,
    cachePurgeOk: true,
    cachePurge: 'not-required',
    pointerMaintenance: 'not-required',
    purgedUrls: [],
  };
}

function rejection(
  season: number,
  version: string,
  previousVersion: string | null,
  reason: PublicationReason,
): PublicationResult {
  return {
    status: 'rejected',
    season,
    version,
    previousVersion,
    reason,
    cachePurgeOk: true,
    cachePurge: 'not-required',
    pointerMaintenance: 'not-required',
    purgedUrls: [],
  };
}
