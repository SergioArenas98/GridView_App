import {
  currentAliasUrlsForDocuments,
  invalidationUrlsForDocuments,
  type CachePurgeAdapter,
  type SeasonAliasing,
} from '../cache/purge';
import type { Logger } from '../logging/logger';
import {
  contentMetadataFromManifest,
  type SnapshotStorage,
} from '../storage/types';
import type { SnapshotDocumentName } from '../storage/types';
import { readStoredInventory, validatedInventory } from './version-inventory';
import type { SnapshotValidator } from '../validation/snapshot-validator';
import type { GeneratedSnapshotSet } from '../snapshots/generator';

export type PublicationStatus = 'applied' | 'skipped' | 'rejected' | 'failed';

/**
 * Why a publication ended the way it did. Closed and bounded: these values
 * reach structured logs and stored sync state, so no adapter-supplied or
 * exception-derived string may ever occupy one.
 */
export const publicationReasons = [
  /** The active version already is this version, and it is complete. */
  'idempotent',
  /** The active version already is this version, but documents are missing. */
  'active-version-incomplete',
  /** The candidate is older than what is already serving. */
  'older-source-updated-at',
  /** A generated document failed contract validation, or validation threw. */
  'contract-validation',
  /** A read the decision depended on could not be completed. */
  'storage-read',
  /** A write before or at the commit point could not be completed. */
  'storage-write',
  /** Documents were written but the version did not read back complete. */
  'incomplete-version',
  /** Publication committed; the post-commit cache purge did not succeed. */
  'cache-purge-failed',
  /**
   * The pointer moved, but the post-commit `previous` maintenance write did
   * not. The release **is** serving; what degraded is the recovery path.
   */
  'previous-pointer-maintenance-failed',
  /** Rollback was asked for with no previous version recorded. */
  'missing-previous-version',
  /** The rollback target has no documents. */
  'rollback-target-missing',
  /** The rollback target is missing documents. */
  'rollback-target-incomplete',
  /** The version records no exact inventory, so nothing may be derived. */
  'missing-version-inventory',
  /** The season has no active version at all. */
  'no-active-version',
] as const;

export type PublicationReason = (typeof publicationReasons)[number];

/**
 * What happened to the post-commit cache purge.
 *
 * A closed domain rather than a free-form warning string, so a caller decides
 * on a value it can exhaustively switch over instead of parsing prose.
 * `not-required` means no purge was attempted at all - the publication did not
 * reach the commit point, or nothing changed.
 */
export const cachePurgeDispositions = [
  'not-required',
  'succeeded',
  'failed',
] as const;

export type CachePurgeDisposition = (typeof cachePurgeDispositions)[number];

/**
 * What happened to the post-commit `previous` pointer maintenance write.
 *
 * `not-required` covers both "the commit point was never crossed" and "there
 * was no outgoing active version to record". `failed` alongside
 * `status: 'applied'` is the truthful shape of a committed transition whose
 * recovery pointer could not be updated: the new version **is** serving, and
 * the stale `previous` is a separate, recoverable operational fact.
 */
export const pointerMaintenanceDispositions = [
  'not-required',
  'succeeded',
  'failed',
] as const;

export type PointerMaintenanceDisposition =
  (typeof pointerMaintenanceDispositions)[number];

export interface PublicationResult {
  status: PublicationStatus;
  season: number;
  version: string;
  previousVersion: string | null;
  reason: PublicationReason | null;
  cachePurgeOk: boolean;
  /**
   * Bounded purge outcome. `failed` alongside `status: 'applied'` is the
   * truthful shape of a committed release whose cache purge did not succeed:
   * the new version **is** serving, and the stale cache is a separate,
   * recoverable operational fact.
   */
  cachePurge: CachePurgeDisposition;
  /** Bounded outcome of the post-commit `previous` pointer maintenance. */
  pointerMaintenance: PointerMaintenanceDisposition;
  purgedUrls: string[];
}

/** The bounded outcome of an operator-triggered cache purge. */
export interface ManualCachePurgeResult {
  season: number;
  activeVersion: string | null;
  ok: boolean;
  reason: PublicationReason | null;
  urls: string[];
}

/**
 * The documents every version must record in its inventory.
 *
 * These are the season-level documents generation always emits, so a version
 * whose inventory omits one did not record a complete generated set and is not
 * a legal rollback target however many documents it does hold.
 */
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

/**
 * Public routes whose representation is derived from the active pointer.
 *
 * Every one of them is also an ordinary inventoried document, so this list
 * changes nothing for a healthy version. It exists so that a version whose
 * inventory is somehow narrower than it should be still cannot leave the
 * season-wide routes serving a withdrawn release.
 */
const activePointerDerivedDocuments: readonly SnapshotDocumentName[] = [
  'bootstrap',
  'home',
  'season',
  'content:manifest',
];

/**
 * The season the public `current` aliases pointed at before an operation moved
 * the current-season pointer, when that is not the season being written.
 *
 * Only publication can produce anything but `none`: it is the one operation
 * that writes `setCurrentSeason`. Rollback and the operator purge never move
 * it, so for them the outgoing and incoming current season are the same thing.
 *
 * `unresolved` is a distinct value on purpose. "Nothing else was current" and
 * "we could not find out what was current" are different facts, and only the
 * first one means there is nothing left to invalidate.
 */
type OutgoingCurrentSeason =
  | { readonly kind: 'none' }
  | { readonly kind: 'season'; readonly season: number }
  | { readonly kind: 'unresolved' };

const noOutgoingCurrentSeason: OutgoingCurrentSeason = { kind: 'none' };

/**
 * Classifies the pre-commit current-season read against the season being
 * published.
 *
 * Publishing the season that is already current moves nothing, and a pointer
 * that was unset was not serving any aliases: both leave nothing extra to
 * invalidate. Only a genuine change of identity does.
 */
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

/**
 * The documents the version being **replaced** in this season was serving.
 *
 * Deliberately not the same concept as `OutgoingCurrentSeason`, and named so it
 * cannot be mistaken for it. That one is about a *different* season losing the
 * `current` aliases while its own active version stays put, so only its aliases
 * go stale. This one is about the *same* season's active version changing, so
 * every route the replaced version carried and the new one drops goes stale -
 * canonical URLs included.
 *
 * `unenumerable` is a distinct value on purpose. An existing version whose
 * inventory is missing, malformed or unreadable is not a version that carried
 * nothing: it is a surface we cannot describe, and reading it as empty would
 * turn a withdrawn release still serving from a CDN into a reported success.
 */
type ReplacedVersionDocuments =
  | {
      readonly kind: 'documents';
      readonly documents: readonly SnapshotDocumentName[];
    }
  | { readonly kind: 'unenumerable' };

/** No version was replaced: a first publication has withdrawn nothing. */
const noReplacedVersion: ReplacedVersionDocuments = {
  kind: 'documents',
  documents: [],
};

/** The outcome of one guarded operational step. */
type Attempt<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false };

/**
 * Runs one operational dependency call and converts a synchronous throw or a
 * promise rejection into a bounded negative result.
 *
 * The thrown value is never read, logged or re-raised: it can embed a storage
 * key, a provider body, a snapshot payload or a stack. Only the fact of
 * failure crosses this boundary; the caller decides which bounded reason that
 * fact maps to, because only the caller knows which phase it was in.
 */
async function attempt<T>(
  operation: () => Promise<T> | T,
): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch {
    return { ok: false };
  }
}

/**
 * What one stored version is, as far as any decision may rely on it.
 *
 * `no-inventory` is deliberately not `incomplete`: the two are different
 * facts, and only one of them says anything about the documents.
 */
type VersionAssessment = 'complete' | 'incomplete' | 'empty' | 'no-inventory';

export class SnapshotPublisher {
  constructor(
    private readonly storage: SnapshotStorage,
    private readonly validator: SnapshotValidator,
    private readonly purger: CachePurgeAdapter,
    private readonly logger: Logger,
    private readonly purgeOrigin = 'https://api.gridview.local',
  ) {}

  /**
   * Publishes one generated set, as three explicit phases.
   *
   * **Pre-commit** - reads, contract validation, the inactive writes and the
   * exact inventory. Nothing is serving yet, so any operational failure here
   * returns a bounded `failed` result, leaves the previous active pointer
   * exactly where it was, leaves the half-written version inactive, leaves the
   * `previous` pointer untouched and performs no purge.
   *
   * **Commit** - `setActiveVersion` is the last decisive storage write and the
   * only irreversible step. Before it the new release is not active; after it,
   * it is.
   *
   * **Post-commit** - the `previous` pointer maintenance and the cache purge.
   * Both run *after* the release is already serving, so neither can make the
   * publication not have happened. Each failure is reported as `applied` with
   * its own bounded disposition, never as a failure that would imply the old
   * release is still active.
   *
   * `previous` is written **after** the commit deliberately. Writing it first
   * makes a failed commit overwrite the one pointer a default rollback can
   * reach, so a publication that changed nothing would still have destroyed
   * the recovery path.
   *
   * **Expected operational failures never reject this promise.** A storage
   * outage, a validator defect, a failed cleanup and a purge outage all become
   * `PublicationResult` values, because this class is the only component that
   * knows whether the commit point was crossed - and a caller cannot recover
   * that fact from an exception.
   */
  async publish(set: GeneratedSnapshotSet): Promise<PublicationResult> {
    const documents = new Map(
      set.documents.map((document) => [document.documentName, document]),
    );
    const inventory = sortedInventory(
      set.documents.map((document) => document.documentName),
    );

    const active = await attempt(() =>
      this.storage.getActiveVersion(set.season),
    );
    if (!active.ok) return this.failed(set, null, 'storage-read');
    const activeVersion = active.value;
    const previousVersion = activeVersion;

    // Read before the commit block, which overwrites it. This is a cache
    // concern only, so its failure is never allowed to reject a publication
    // that is otherwise fine: it is carried as `unresolved` and settled by the
    // post-commit purge, which reports a failed invalidation rather than a
    // success it cannot stand behind.
    const currentBefore = await attempt(() => this.storage.getCurrentSeason());
    const outgoing = outgoingCurrentSeason(currentBefore, set.season);

    if (activeVersion === set.version) {
      // Idempotency is decided over the version's own recorded inventory, not
      // over the set in hand: what matters is whether the release that is
      // already serving is intact.
      const assessment = await attempt(() =>
        this.assessVersion(set.season, set.version),
      );
      if (!assessment.ok)
        return this.failed(set, previousVersion, 'storage-read');
      const complete = assessment.value === 'complete';
      return {
        status: complete ? 'skipped' : 'rejected',
        season: set.season,
        version: set.version,
        previousVersion,
        reason: complete ? 'idempotent' : 'active-version-incomplete',
        cachePurgeOk: true,
        cachePurge: 'not-required',
        pointerMaintenance: 'not-required',
        purgedUrls: [],
      };
    }

    let activeSourceUpdatedAt: string | null = null;
    if (activeVersion) {
      const read = await attempt(() =>
        this.activeSourceUpdatedAt(set.season, activeVersion),
      );
      if (!read.ok) return this.failed(set, previousVersion, 'storage-read');
      activeSourceUpdatedAt = read.value;
    }
    if (
      activeSourceUpdatedAt &&
      Date.parse(set.sourceUpdatedAt) < Date.parse(activeSourceUpdatedAt)
    ) {
      return {
        status: 'rejected',
        season: set.season,
        version: set.version,
        previousVersion,
        reason: 'older-source-updated-at',
        cachePurgeOk: true,
        cachePurge: 'not-required',
        pointerMaintenance: 'not-required',
        purgedUrls: [],
      };
    }

    for (const document of documents.values()) {
      // A validator is an ordinary dependency: it may throw as well as report.
      // The two are **different facts** and must not share a branch.
      const validated = await attempt(() => this.validator.validate(document));
      if (!validated.ok) {
        // The validator broke. Nothing was examined, so nothing was declined:
        // this is an operational failure like any other dependency outage.
        // Reporting it as `rejected` would tell the synchronization service the
        // candidate was assessed and refused.
        this.logger.warn({
          operation: 'publication.validation_failed',
          season: set.season,
          releaseVersion: set.version,
          failureCategory: 'contract-validation',
          issueCount: 0,
          documentName: document.documentName,
        });
        return this.failed(set, previousVersion, 'contract-validation');
      }
      if (validated.value.length > 0) {
        // The documents were examined and did not satisfy the contract. That
        // is a genuine rejection of this candidate, and stays one.
        this.logger.warn({
          operation: 'publication.validation_failed',
          season: set.season,
          releaseVersion: set.version,
          failureCategory: 'contract-validation',
          issueCount: validated.value.length,
          documentName: document.documentName,
        });
        return {
          status: 'rejected',
          season: set.season,
          version: set.version,
          previousVersion,
          reason: 'contract-validation',
          cachePurgeOk: true,
          cachePurge: 'not-required',
          pointerMaintenance: 'not-required',
          purgedUrls: [],
        };
      }
    }

    // The routes this release **withdraws** are exactly the ones its own
    // inventory cannot name, so they are read from the version being replaced -
    // while that version is still the one serving, and before the commit block
    // moves the pointer that identifies it. Like the current-season read above
    // this is a cache concern only: it never rejects a publication that is
    // otherwise fine, and an unenumerable outgoing surface is settled by the
    // post-commit purge reporting a failure instead of a success.
    const replaced =
      activeVersion === null
        ? noReplacedVersion
        : await this.replacedVersionDocuments(set.season, activeVersion);

    const written = await attempt(async () => {
      for (const document of documents.values()) {
        await this.storage.writeVersionedDocument(
          set.season,
          set.version,
          document,
        );
      }
      // The inventory is written before the version is verified, so what is
      // verified is what generation actually produced rather than what a
      // collection document happens to advertise.
      await this.storage.writeVersionInventory(
        set.season,
        set.version,
        inventory,
      );
      if ((await this.assessVersion(set.season, set.version)) !== 'complete') {
        return 'incomplete-version' as const;
      }
      const manifest = documents.get('content:manifest');
      if (manifest) {
        await this.storage.setContentMetadata(
          contentMetadataFromManifest(
            manifest.data as import('../contract/types').ContentManifest,
            manifest.meta.generatedAt,
          ),
        );
      }
      await this.storage.setCurrentSeason(set.season);
      // The commit point, and deliberately the final decisive storage write.
      await this.storage.setActiveVersion(set.season, set.version);
      return 'committed' as const;
    });

    if (!written.ok || written.value === 'incomplete-version') {
      // The compensating delete is itself an operational call that can fail.
      // Its failure must not replace the real publication failure, and must
      // not escape: the classification the caller needs is the one from the
      // phase that actually failed. It removes the inventory with the
      // documents, so a half-written version cannot leave a description of a
      // release that does not exist.
      await attempt(() =>
        this.storage.deleteUnpublishedVersion(set.season, set.version),
      );
      return this.failed(
        set,
        previousVersion,
        written.ok ? 'incomplete-version' : 'storage-write',
      );
    }

    // Committed. Everything below is best-effort and cannot un-publish.
    const maintenance = await this.maintainPreviousPointer(
      set.season,
      activeVersion,
      'publication',
    );
    const purge = await this.purgeRoutes(
      set.season,
      inventory,
      outgoing,
      replaced,
    );
    this.logger.info({
      operation: 'publication.completed',
      season: set.season,
      releaseVersion: set.version,
      status: 200,
      cacheOutcome: purge.ok ? 'purged' : 'purge-failed',
      pointerMaintenance: maintenance,
    });
    return {
      status: 'applied',
      season: set.season,
      version: set.version,
      previousVersion,
      reason: appliedReason(maintenance, purge.ok),
      cachePurgeOk: purge.ok,
      cachePurge: purge.ok ? 'succeeded' : 'failed',
      pointerMaintenance: maintenance,
      purgedUrls: purge.urls,
    };
  }

  private failed(
    set: GeneratedSnapshotSet,
    previousVersion: string | null,
    reason: PublicationReason,
  ): PublicationResult {
    return failure(set, previousVersion, reason);
  }

  /**
   * Moves the active pointer back to an earlier version.
   *
   * The phase structure is the same as `publish`, and for the same reason: the
   * active-pointer write is the commit point, everything before it may fail
   * without changing what serves, and everything after it may fail without
   * un-moving the pointer.
   *
   * **Every expected operational failure returns a bounded result.** Rollback
   * is the recovery path, so a caller reaching for it during an outage must
   * still be told which side of the commit point the attempt ended on rather
   * than being handed an exception it cannot classify.
   */
  async rollback(
    season: number,
    targetVersion?: string,
  ): Promise<PublicationResult> {
    const active = await attempt(() => this.storage.getActiveVersion(season));
    if (!active.ok) return rollbackFailure(season, '', null, 'storage-read');
    const activeVersion = active.value;

    let target = targetVersion ?? null;
    if (target === null) {
      const previous = await attempt(() =>
        this.storage.getPreviousVersion(season),
      );
      if (!previous.ok) {
        return rollbackFailure(season, '', activeVersion, 'storage-read');
      }
      target = previous.value;
    }
    if (target === null) {
      return rollbackRejection(
        season,
        '',
        activeVersion,
        'missing-previous-version',
      );
    }

    if (target === activeVersion) {
      // Nothing to move. Reporting a transition here would be untrue, and
      // writing `previous` would destroy the one version a later default
      // rollback can reach - which is the whole point of the operation.
      this.logger.warn({
        operation: 'rollback.skipped',
        season,
        releaseVersion: target,
        failureCategory: 'idempotent',
      });
      return {
        status: 'skipped',
        season,
        version: target,
        previousVersion: activeVersion,
        reason: 'idempotent',
        cachePurgeOk: true,
        cachePurge: 'not-required',
        pointerMaintenance: 'not-required',
        purgedUrls: [],
      };
    }

    const targetInventory = await readStoredInventory(
      this.storage,
      season,
      target,
    );
    if (targetInventory.kind === 'unreadable') {
      return rollbackFailure(season, target, activeVersion, 'storage-read');
    }
    if (targetInventory.kind !== 'documents') {
      // Either a version published before exact inventories existed, or one
      // whose inventory no longer deserializes to a list of documents. Nothing
      // may be reconstructed for either: the collection documents are known not
      // to name every document a version carries, so accepting one would be
      // accepting a completeness verdict that has already been proven wrong.
      // Decided **pre-commit**, so the rollback is refused with the pointer
      // exactly where it was.
      return rollbackRejection(
        season,
        target,
        activeVersion,
        'missing-version-inventory',
      );
    }
    if (targetInventory.documents.length === 0) {
      return rollbackRejection(
        season,
        target,
        activeVersion,
        'rollback-target-missing',
      );
    }

    const assessment = await attempt(() => this.assessVersion(season, target));
    if (!assessment.ok) {
      return rollbackFailure(season, target, activeVersion, 'storage-read');
    }
    if (assessment.value !== 'complete') {
      return rollbackRejection(
        season,
        target,
        activeVersion,
        'rollback-target-incomplete',
      );
    }

    // Decided before the pointer moves, while "what is serving" is still
    // unambiguous, and from the exact inventories of **both** versions: a
    // route only one of them carries is still a route the pointer change
    // affects. An outgoing version with no inventory contributes nothing here
    // rather than blocking the recovery it is being rolled back from.
    let invalidated: SnapshotDocumentName[] = [...targetInventory.documents];
    if (activeVersion !== null) {
      const activeInventory = await readStoredInventory(
        this.storage,
        season,
        activeVersion,
      );
      if (activeInventory.kind === 'unreadable') {
        return rollbackFailure(season, target, activeVersion, 'storage-read');
      }
      if (activeInventory.kind === 'malformed') {
        // Still pre-commit. An outgoing version whose inventory is corrupt is a
        // surface that cannot be described, and rolling back over it would move
        // the pointer while silently dropping every route only that version
        // carried. `absent` is a different fact and keeps its documented
        // behaviour below: a version predating exact inventories contributes
        // nothing rather than blocking the recovery it is being rolled back to.
        return rollbackRejection(
          season,
          target,
          activeVersion,
          'missing-version-inventory',
        );
      }
      invalidated = [
        ...invalidated,
        ...(activeInventory.kind === 'documents'
          ? activeInventory.documents
          : []),
      ];
    }

    const committed = await attempt(() =>
      this.storage.setActiveVersion(season, target),
    );
    if (!committed.ok) {
      return rollbackFailure(season, target, activeVersion, 'storage-write');
    }

    // Committed. Both steps below are post-commit and best-effort for exactly
    // the reason they are in `publish`: neither can un-move the pointer, so a
    // failure is reported alongside a truthful `applied`, never as a rollback
    // that did not happen.
    const maintenance = await this.maintainPreviousPointer(
      season,
      activeVersion,
      'rollback',
    );
    const purge = await this.purgeRoutes(season, invalidated);
    this.logger.warn({
      operation: 'rollback.completed',
      season,
      releaseVersion: target,
      cacheOutcome: purge.ok ? 'purged' : 'purge-failed',
      pointerMaintenance: maintenance,
    });
    return {
      status: 'applied',
      season,
      version: target,
      previousVersion: activeVersion,
      reason: appliedReason(maintenance, purge.ok),
      cachePurgeOk: purge.ok,
      cachePurge: purge.ok ? 'succeeded' : 'failed',
      pointerMaintenance: maintenance,
      purgedUrls: purge.urls,
    };
  }

  /**
   * Invalidates every public route the active version carries.
   *
   * The operator-facing counterpart of the rollback purge, over the same exact
   * inventory and the same route mapper, so a document the active release
   * holds can never be missing from a manual purge. It moves no pointer and
   * writes nothing.
   */
  async purgeActiveVersion(season: number): Promise<ManualCachePurgeResult> {
    const active = await attempt(() => this.storage.getActiveVersion(season));
    if (!active.ok) {
      return manualPurgeFailure(season, null, 'storage-read');
    }
    const activeVersion = active.value;
    if (activeVersion === null) {
      return manualPurgeFailure(season, null, 'no-active-version');
    }

    const inventory = await readStoredInventory(
      this.storage,
      season,
      activeVersion,
    );
    if (inventory.kind === 'unreadable') {
      return manualPurgeFailure(season, activeVersion, 'storage-read');
    }
    if (inventory.kind !== 'documents') {
      // Nothing enumerable to purge, and no pointer to move. The operator is
      // told the surface could not be described rather than handed an exception
      // or a success over a partial route set.
      return manualPurgeFailure(
        season,
        activeVersion,
        'missing-version-inventory',
      );
    }

    const purge = await this.purgeRoutes(season, inventory.documents);
    return {
      season,
      activeVersion,
      ok: purge.ok,
      reason: purge.ok ? null : 'cache-purge-failed',
      urls: purge.urls,
    };
  }

  /**
   * Records the outgoing active version as the new rollback target.
   *
   * Runs only after the commit point. A failure here degrades recovery, not
   * the release, so it is reported as a bounded disposition rather than
   * escaping or being folded into a failure that would claim the pointer never
   * moved. Only the bounded phase and category reach the log.
   */
  private async maintainPreviousPointer(
    season: number,
    outgoingVersion: string | null,
    phase: 'publication' | 'rollback',
  ): Promise<PointerMaintenanceDisposition> {
    if (outgoingVersion === null) return 'not-required';
    const written = await attempt(() =>
      this.storage.setPreviousVersion(season, outgoingVersion),
    );
    if (written.ok) return 'succeeded';
    this.logger.warn({
      operation: `${phase}.previous_pointer_maintenance_failed`,
      season,
      failureCategory: 'previous-pointer-maintenance-failed',
    });
    return 'failed';
  }

  /**
   * Purges the public routes for a set of documents, containing any outage.
   *
   * The set is the canonical numeric URLs plus - when this season is the one
   * the public `current` aliases resolve to - every alias the router accepts
   * for those same documents. A CDN keys on the request URL, so
   * `/v1/seasons/2026` and `/v1/seasons/current` are two entries and purging
   * one says nothing about the other.
   *
   * `replaced` carries the documents of the version this operation is replacing
   * **in the same season**, and it is unioned into the same expansion rather
   * than mapped separately. A route the replaced version carried and the new
   * one drops is the one route the incoming inventory can never name, and it is
   * exactly the one that keeps serving a withdrawn response: the origin stops
   * answering it the moment the pointer moves, while the CDN holds the old body
   * for the rest of its TTL. Rollback passes its union through `documents` for
   * the same reason; publication has a second inventory to name, so it has its
   * own parameter. When that surface is `unenumerable` the purge is reported as
   * failed - it may be complete, but nothing here can say so.
   *
   * When a publication moves the current-season pointer, the alias URLs were
   * serving the **outgoing** season. Most of them are covered already, because
   * an alias URL is season-independent and the incoming season carries the same
   * season-level documents. What is not covered is a profile the outgoing
   * season had and the incoming one does not, so those aliases are added from
   * the outgoing season's own inventory. If that inventory cannot be read the
   * surface is not enumerable, and the purge reports failure rather than
   * claiming a success that leaves a withdrawn profile serving.
   */
  private async purgeRoutes(
    season: number,
    documents: readonly SnapshotDocumentName[],
    outgoing: OutgoingCurrentSeason = noOutgoingCurrentSeason,
    replaced: ReplacedVersionDocuments = noReplacedVersion,
  ): Promise<{ ok: boolean; urls: string[] }> {
    const aliasing = await this.seasonAliasing(season);
    const withdrawn =
      replaced.kind === 'documents' ? replaced.documents : ([] as const);
    const invalidated = new Set(
      invalidationUrlsForDocuments(
        this.purgeOrigin,
        season,
        [...documents, ...withdrawn, ...activePointerDerivedDocuments],
        aliasing,
      ),
    );
    const outgoingAliases = await this.outgoingAliasUrls(outgoing);
    for (const url of outgoingAliases ?? []) invalidated.add(url);

    const urls = [...invalidated].sort();
    const purged = await attempt(() => this.purger.purgePublicUrls(urls));
    return {
      ok:
        replaced.kind === 'documents' &&
        outgoingAliases !== null &&
        purged.ok &&
        purged.value.ok,
      urls: purged.ok ? purged.value.urls : [],
    };
  }

  /**
   * The exact documents one version of this season recorded.
   *
   * Separate from `outgoingAliasUrls`, which answers a different question about
   * a different season. This one is read pre-commit and returns documents, not
   * URLs, so the one shared route expansion stays the only place that knows how
   * a document becomes a URL.
   */
  private async replacedVersionDocuments(
    season: number,
    version: string,
  ): Promise<ReplacedVersionDocuments> {
    const inventory = await readStoredInventory(this.storage, season, version);
    if (inventory.kind !== 'documents') return { kind: 'unenumerable' };
    return { kind: 'documents', documents: inventory.documents };
  }

  /**
   * Whether this season is the one the public `current` aliases resolve to.
   *
   * Decided from the stored pointer, never from a clock: "the current season"
   * is a published fact, and a wall-clock guess would invalidate the wrong
   * aliases around a season boundary.
   *
   * An unreadable or unset pointer answers `season-is-current`, which is the
   * conservative direction. Purging an alias that was not stale costs one cache
   * miss; not purging one that was leaves a withdrawn release serving for the
   * whole of its TTL.
   */
  private async seasonAliasing(season: number): Promise<SeasonAliasing> {
    const current = await attempt(() => this.storage.getCurrentSeason());
    if (!current.ok || current.value === null) return 'season-is-current';
    return current.value === season
      ? 'season-is-current'
      : 'season-is-historical';
  }

  /**
   * The alias URLs the outgoing current season was being served through.
   *
   * Aliases only: the outgoing season's numeric URLs still serve correct
   * content and evicting them would be over-invalidation with no stale entry to
   * justify it. `null` means the surface could not be enumerated at all.
   */
  private async outgoingAliasUrls(
    outgoing: OutgoingCurrentSeason,
  ): Promise<string[] | null> {
    if (outgoing.kind === 'none') return [];
    if (outgoing.kind === 'unresolved') return null;

    const active = await attempt(() =>
      this.storage.getActiveVersion(outgoing.season),
    );
    if (!active.ok) return null;
    if (active.value === null) return [];

    const inventory = await readStoredInventory(
      this.storage,
      outgoing.season,
      active.value,
    );
    if (inventory.kind !== 'documents') return null;
    return currentAliasUrlsForDocuments(this.purgeOrigin, inventory.documents);
  }

  /**
   * What one stored version is, decided over its **exact inventory**.
   *
   * The inventory is the set generation actually produced, which is strictly
   * wider than what the collection documents advertise: the curated content
   * alone carries a circuit with no calendar event, and driver and constructor
   * profiles are generated from the registries while their collections are
   * derived from the season entry lists. Reconstructing the set from the
   * collections therefore accepts a version that is missing documents it
   * really holds.
   *
   * Three things are required, and each catches a different corruption:
   *
   * - **Every inventoried document exists.** This is what makes an orphan
   *   profile, and a generated optional `unavailable` classification, part of
   *   completeness: the version explicitly recorded that it carries them.
   * - **Every base document is inventoried.** A version that never recorded a
   *   season-level document did not record a complete generated set.
   * - **Every calendar event has its detail, and every classified event its
   *   results.** These are the two documents whose absence the inventory alone
   *   cannot reveal, because a truncated generation would simply not list
   *   them.
   *
   * Nothing is fabricated: a document generation did not produce never becomes
   * an inventory entry, so a legitimately absent optional classification
   * cannot fail this check.
   */
  private async assessVersion(
    season: number,
    version: string,
  ): Promise<VersionAssessment> {
    // The *validator* rather than the reader: a read failure here is still
    // classified by this method's callers, each of which already wraps the call
    // in the `attempt` its own phase needs. Only the shape is settled here, and
    // a value that is not a list of documents records no usable inventory.
    const inventory = validatedInventory(
      await this.storage.readVersionInventory(season, version),
    );
    if (inventory.kind !== 'documents') return 'no-inventory';
    const documents = inventory.documents;
    if (documents.length === 0) return 'empty';
    const recorded = new Set<string>(documents);

    for (const name of baseDocumentNames) {
      if (!recorded.has(name)) return 'incomplete';
    }
    for (const name of documents) {
      if (!(await this.storage.readVersionedDocument(season, version, name))) {
        return 'incomplete';
      }
    }

    const calendar = await this.storage.readVersionedDocument(
      season,
      version,
      'calendar',
    );
    if (!Array.isArray(calendar?.data)) return 'incomplete';
    for (const event of calendar.data as Array<{
      round?: number;
      hasResults?: unknown;
    }>) {
      if (typeof event.round !== 'number') return 'incomplete';
      if (!recorded.has(`grand-prix:${event.round}`)) return 'incomplete';
      if (
        event.hasResults === true &&
        !recorded.has(`grand-prix:${event.round}:results`)
      ) {
        return 'incomplete';
      }
    }
    return 'complete';
  }

  private async activeSourceUpdatedAt(
    season: number,
    version: string,
  ): Promise<string | null> {
    const snapshot = await this.storage.readVersionedDocument(
      season,
      version,
      'season',
    );
    return snapshot?.meta.sourceUpdatedAt ?? null;
  }
}

/** Sorted and deduplicated, so one version's inventory is deterministic. */
function sortedInventory(
  documentNames: readonly SnapshotDocumentName[],
): SnapshotDocumentName[] {
  return [...new Set(documentNames)].sort();
}

/**
 * The single bounded reason an applied transition carries.
 *
 * Only one field can hold it, and the two dispositions carry the full truth
 * independently, so precedence goes to the degradation an operator has to act
 * on first: a stale `previous` silently removes the recovery path, while a
 * stale cache is visible and self-correcting.
 */
function appliedReason(
  maintenance: PointerMaintenanceDisposition,
  purgeOk: boolean,
): PublicationReason | null {
  if (maintenance === 'failed') return 'previous-pointer-maintenance-failed';
  return purgeOk ? null : 'cache-purge-failed';
}

function failure(
  set: GeneratedSnapshotSet,
  previousVersion: string | null,
  reason: PublicationReason,
): PublicationResult {
  return {
    status: 'failed',
    season: set.season,
    version: set.version,
    previousVersion,
    reason,
    cachePurgeOk: true,
    // Nothing committed, so nothing was purged and no pointer was maintained.
    cachePurge: 'not-required',
    pointerMaintenance: 'not-required',
    purgedUrls: [],
  };
}

function rollbackOutcome(
  status: 'failed' | 'rejected',
  season: number,
  version: string,
  activeVersion: string | null,
  reason: PublicationReason,
): PublicationResult {
  return {
    status,
    season,
    version,
    previousVersion: activeVersion,
    reason,
    cachePurgeOk: true,
    cachePurge: 'not-required',
    pointerMaintenance: 'not-required',
    purgedUrls: [],
  };
}

function rollbackFailure(
  season: number,
  version: string,
  activeVersion: string | null,
  reason: PublicationReason,
): PublicationResult {
  return rollbackOutcome('failed', season, version, activeVersion, reason);
}

function rollbackRejection(
  season: number,
  version: string,
  activeVersion: string | null,
  reason: PublicationReason,
): PublicationResult {
  return rollbackOutcome('rejected', season, version, activeVersion, reason);
}

function manualPurgeFailure(
  season: number,
  activeVersion: string | null,
  reason: PublicationReason,
): ManualCachePurgeResult {
  return { season, activeVersion, ok: false, reason, urls: [] };
}
