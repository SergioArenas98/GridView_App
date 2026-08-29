import { publicUrlsForDocuments, type CachePurgeAdapter } from '../cache/purge';
import type { Logger } from '../logging/logger';
import {
  contentMetadataFromManifest,
  type SnapshotStorage,
} from '../storage/types';
import type { SnapshotDocumentName } from '../storage/types';
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
  /** Rollback was asked for with no previous version recorded. */
  'missing-previous-version',
  /** The rollback target has no documents. */
  'rollback-target-missing',
  /** The rollback target is missing documents. */
  'rollback-target-incomplete',
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
  purgedUrls: string[];
}

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
 * One stored version, as the raw facts both rollback questions are derived
 * from. Kept separate from either derivation so neither can quietly become the
 * other.
 */
interface VersionInventory {
  /** Season-level documents this version actually stores. */
  readonly collections: SnapshotDocumentName[];
  /** Every round the stored calendar declares. */
  readonly rounds: number[];
  /** The subset of those rounds advertising `hasResults: true`. */
  readonly classifiedRounds: number[];
  /** Driver, constructor and circuit detail documents. */
  readonly entities: SnapshotDocumentName[];
}

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
   * **Pre-commit** - reads, contract validation, inactive writes and the
   * bookkeeping pointers. Nothing is serving yet, so any operational failure
   * here returns a bounded `failed` result, leaves the previous active pointer
   * exactly where it was, leaves the half-written version inactive and
   * performs no purge.
   *
   * **Commit** - `setActiveVersion` is the last storage write and the only
   * irreversible step. Before it the new release is not active; after it, it
   * is.
   *
   * **Post-commit** - the cache purge. It runs *after* the release is already
   * serving, so it cannot make the publication not have happened. A purge
   * failure is therefore reported as `applied` with a bounded
   * `cachePurge: 'failed'`, never as a failure that would imply the old
   * release is still active.
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
    const required = set.documents.map((document) => document.documentName);

    const active = await attempt(() =>
      this.storage.getActiveVersion(set.season),
    );
    if (!active.ok) return this.failed(set, null, 'storage-read');
    const activeVersion = active.value;
    const previousVersion = activeVersion;

    if (activeVersion === set.version) {
      const complete = await attempt(() =>
        this.versionComplete(set.season, set.version, required),
      );
      if (!complete.ok)
        return this.failed(set, previousVersion, 'storage-read');
      return {
        status: complete.value ? 'skipped' : 'rejected',
        season: set.season,
        version: set.version,
        previousVersion,
        reason: complete.value ? 'idempotent' : 'active-version-incomplete',
        cachePurgeOk: true,
        cachePurge: 'not-required',
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
        // candidate was assessed and refused - which is what makes it record a
        // completed run and mark every due job successful, hiding a broken
        // validator until the next cadence.
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
          purgedUrls: [],
        };
      }
    }

    const written = await attempt(async () => {
      for (const document of documents.values()) {
        await this.storage.writeVersionedDocument(
          set.season,
          set.version,
          document,
        );
      }
      if (!(await this.versionComplete(set.season, set.version, required))) {
        return 'incomplete-version' as const;
      }
      if (activeVersion) {
        await this.storage.setPreviousVersion(set.season, activeVersion);
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
      // The commit point, and deliberately the final storage write.
      await this.storage.setActiveVersion(set.season, set.version);
      return 'committed' as const;
    });

    if (!written.ok || written.value === 'incomplete-version') {
      // The compensating delete is itself an operational call that can fail.
      // Its failure must not replace the real publication failure, and must
      // not escape: the classification the caller needs is the one from the
      // phase that actually failed.
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
    const purged = await attempt(() =>
      this.purger.purgePublicUrls(
        publicUrlsForDocuments(this.purgeOrigin, set.season, required),
      ),
    );
    const purgeOk = purged.ok && purged.value.ok;
    this.logger.info({
      operation: 'publication.completed',
      season: set.season,
      releaseVersion: set.version,
      status: 200,
      cacheOutcome: purgeOk ? 'purged' : 'purge-failed',
    });
    return {
      status: 'applied',
      season: set.season,
      version: set.version,
      previousVersion,
      // Bounded by construction: a purge adapter's own category string never
      // becomes the publication reason.
      reason: purgeOk ? null : 'cache-purge-failed',
      cachePurgeOk: purgeOk,
      cachePurge: purgeOk ? 'succeeded' : 'failed',
      purgedUrls: purged.ok ? purged.value.urls : [],
    };
  }

  private failed(
    set: GeneratedSnapshotSet,
    previousVersion: string | null,
    reason: PublicationReason,
  ): PublicationResult {
    return failure(set, previousVersion, reason);
  }

  async rollback(
    season: number,
    targetVersion?: string,
  ): Promise<PublicationResult> {
    const activeVersion = await this.storage.getActiveVersion(season);
    const previousVersion =
      targetVersion ?? (await this.storage.getPreviousVersion(season));
    if (!previousVersion) {
      return {
        status: 'rejected',
        season,
        version: '',
        previousVersion: activeVersion,
        reason: 'missing-previous-version',
        cachePurgeOk: true,
        cachePurge: 'not-required',
        purgedUrls: [],
      };
    }
    const required = await this.requiredDocumentsForVersion(
      season,
      previousVersion,
    );
    if (required.length === 0) {
      return {
        status: 'rejected',
        season,
        version: previousVersion,
        previousVersion: activeVersion,
        reason: 'rollback-target-missing',
        cachePurgeOk: true,
        cachePurge: 'not-required',
        purgedUrls: [],
      };
    }
    if (!(await this.versionComplete(season, previousVersion, required))) {
      return {
        status: 'rejected',
        season,
        version: previousVersion,
        previousVersion: activeVersion,
        reason: 'rollback-target-incomplete',
        cachePurgeOk: true,
        cachePurge: 'not-required',
        purgedUrls: [],
      };
    }
    // Decided before the pointer moves, while "what is serving" is still
    // unambiguous, and deliberately from a different set than the completeness
    // check above: see `cacheRoutesForVersion`.
    const invalidated = [
      ...(activeVersion
        ? await this.cacheRoutesForVersion(season, activeVersion)
        : []),
      ...(await this.cacheRoutesForVersion(season, previousVersion)),
    ];

    if (activeVersion) {
      await this.storage.setPreviousVersion(season, activeVersion);
    }
    await this.storage.setActiveVersion(season, previousVersion);

    // Committed. The purge is post-commit and best-effort here for exactly the
    // reason it is in `publish`: it cannot un-move the pointer, so its failure
    // is reported alongside a truthful `applied`, never as a rollback that did
    // not happen. A purge adapter that throws or rejects is an ordinary
    // dependency outage and must not escape as a rejected promise.
    const purged = await attempt(() =>
      this.purger.purgePublicUrls(
        publicUrlsForDocuments(this.purgeOrigin, season, invalidated),
      ),
    );
    const purgeOk = purged.ok && purged.value.ok;
    this.logger.warn({
      operation: 'rollback.completed',
      season,
      releaseVersion: previousVersion,
      cacheOutcome: purgeOk ? 'purged' : 'purge-failed',
    });
    return {
      status: 'applied',
      season,
      version: previousVersion,
      previousVersion: activeVersion,
      reason: purgeOk ? null : 'cache-purge-failed',
      cachePurgeOk: purgeOk,
      cachePurge: purgeOk ? 'succeeded' : 'failed',
      purgedUrls: purged.ok ? purged.value.urls : [],
    };
  }

  private async versionComplete(
    season: number,
    version: string,
    required: SnapshotDocumentName[],
  ): Promise<boolean> {
    for (const documentName of required) {
      if (
        !(await this.storage.readVersionedDocument(
          season,
          version,
          documentName,
        ))
      ) {
        return false;
      }
    }
    return true;
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

  /**
   * What one stored version actually holds, read once and derived from twice.
   *
   * Two different questions are asked of a rollback target, and answering them
   * from one list is what let a cached classification survive a rollback:
   *
   * - **Completeness** - which documents must the target contain to be a legal
   *   rollback target at all (`requiredDocumentsForVersion`).
   * - **Cache invalidation** - which public routes may still be serving the
   *   outgoing version's representation once the pointer moves
   *   (`cacheRoutesForVersion`).
   *
   * The second is strictly wider than the first and is deliberately not
   * derived from it.
   */
  private async inventoryForVersion(
    season: number,
    version: string,
  ): Promise<VersionInventory> {
    const known: SnapshotDocumentName[] = [
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
    const collections: SnapshotDocumentName[] = [];
    for (const name of known) {
      if (await this.storage.readVersionedDocument(season, version, name)) {
        collections.push(name);
      }
    }

    const rounds: number[] = [];
    const classifiedRounds: number[] = [];
    const calendar = await this.storage.readVersionedDocument(
      season,
      version,
      'calendar',
    );
    if (Array.isArray(calendar?.data)) {
      for (const event of calendar.data as Array<{
        round?: number;
        hasResults?: unknown;
      }>) {
        if (typeof event.round !== 'number') continue;
        rounds.push(event.round);
        if (event.hasResults === true) classifiedRounds.push(event.round);
      }
    }

    const entities: SnapshotDocumentName[] = [];
    const drivers = await this.storage.readVersionedDocument(
      season,
      version,
      'drivers',
    );
    if (Array.isArray(drivers?.data)) {
      for (const driver of drivers.data as Array<{ driverId?: string }>) {
        if (typeof driver.driverId === 'string') {
          entities.push(`driver:${driver.driverId}`);
        }
      }
    }
    const constructors = await this.storage.readVersionedDocument(
      season,
      version,
      'constructors',
    );
    if (Array.isArray(constructors?.data)) {
      for (const constructor of constructors.data as Array<{
        constructorId?: string;
      }>) {
        if (typeof constructor.constructorId === 'string') {
          entities.push(`constructor:${constructor.constructorId}`);
        }
      }
    }
    const circuits = await this.storage.readVersionedDocument(
      season,
      version,
      'circuits',
    );
    if (Array.isArray(circuits?.data)) {
      for (const circuit of circuits.data as Array<{ id?: string }>) {
        if (typeof circuit.id === 'string') {
          entities.push(`circuit:${circuit.id}`);
        }
      }
    }

    return { collections, rounds, classifiedRounds, entities };
  }

  /**
   * The documents a version must contain to be a valid rollback target.
   *
   * Mirrors what publication actually generates. Every event has a detail
   * document, but a results document exists only where the calendar advertises
   * a classification - the generator emits one only when a classification
   * exists, and the cross-resource preflight binds `hasResults` to `final` or
   * `provisional`. Demanding one for every round would make a perfectly valid
   * active-season release unreachable as a rollback target, while a completed
   * classified round still cannot evade the check, because its own flag is
   * what requires the document.
   *
   * This set answers completeness **only**. It is never the purge set: an
   * absent optional document does not mean the public route behind it has no
   * cached representation to invalidate.
   */
  private async requiredDocumentsForVersion(
    season: number,
    version: string,
  ): Promise<SnapshotDocumentName[]> {
    const inventory = await this.inventoryForVersion(season, version);
    return [
      ...inventory.collections,
      ...inventory.rounds.map(
        (round) => `grand-prix:${round}` as SnapshotDocumentName,
      ),
      ...inventory.classifiedRounds.map(
        (round) => `grand-prix:${round}:results` as SnapshotDocumentName,
      ),
      ...inventory.entities,
    ];
  }

  /**
   * Every public route one version can be responsible for, as document names.
   *
   * Deliberately conservative, and deliberately **not** gated on `hasResults`.
   * A round the calendar says has no classification still owns the public
   * results route, and that route may hold the other version's final
   * classification: purging a URL whose new representation is a meaningful
   * absence, or has no document at all, costs one cache miss, while leaving it
   * cached keeps serving data the pointer change was meant to withdraw.
   *
   * The caller unions the outgoing active version's routes with the incoming
   * target's, so a round, profile or collection that exists in only one of the
   * two is still invalidated. `publicUrlsForDocuments` deduplicates and sorts,
   * so the resulting request is deterministic.
   */
  private async cacheRoutesForVersion(
    season: number,
    version: string,
  ): Promise<SnapshotDocumentName[]> {
    const inventory = await this.inventoryForVersion(season, version);
    return [
      ...inventory.collections,
      ...inventory.rounds.flatMap(
        (round) =>
          [
            `grand-prix:${round}`,
            `grand-prix:${round}:results`,
          ] as SnapshotDocumentName[],
      ),
      ...inventory.entities,
    ];
  }
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
    // Nothing committed, so nothing was purged.
    cachePurge: 'not-required',
    purgedUrls: [],
  };
}
