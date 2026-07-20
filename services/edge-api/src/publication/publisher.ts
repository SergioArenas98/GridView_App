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

export interface PublicationResult {
  status: PublicationStatus;
  season: number;
  version: string;
  previousVersion: string | null;
  reason: string | null;
  cachePurgeOk: boolean;
  purgedUrls: string[];
}

export class SnapshotPublisher {
  constructor(
    private readonly storage: SnapshotStorage,
    private readonly validator: SnapshotValidator,
    private readonly purger: CachePurgeAdapter,
    private readonly logger: Logger,
    private readonly purgeOrigin = 'https://api.gridview.local',
  ) {}

  async publish(set: GeneratedSnapshotSet): Promise<PublicationResult> {
    const activeVersion = await this.storage.getActiveVersion(set.season);
    const previousVersion = activeVersion;
    const documents = new Map(
      set.documents.map((document) => [document.documentName, document]),
    );
    const required = set.documents.map((document) => document.documentName);

    if (activeVersion === set.version) {
      const complete = await this.versionComplete(
        set.season,
        set.version,
        required,
      );
      return {
        status: complete ? 'skipped' : 'rejected',
        season: set.season,
        version: set.version,
        previousVersion,
        reason: complete ? 'idempotent' : 'active-version-incomplete',
        cachePurgeOk: true,
        purgedUrls: [],
      };
    }

    const activeSourceUpdatedAt = activeVersion
      ? await this.activeSourceUpdatedAt(set.season, activeVersion)
      : null;
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
        purgedUrls: [],
      };
    }

    for (const document of documents.values()) {
      const issues = this.validator.validate(document);
      if (issues.length > 0) {
        this.logger.warn({
          operation: 'publication.validation_failed',
          season: set.season,
          releaseVersion: set.version,
          failureCategory: 'contract-validation',
          issueCount: issues.length,
          documentName: document.documentName,
        });
        return {
          status: 'rejected',
          season: set.season,
          version: set.version,
          previousVersion,
          reason: 'contract-validation',
          cachePurgeOk: true,
          purgedUrls: [],
        };
      }
    }

    try {
      for (const document of documents.values()) {
        await this.storage.writeVersionedDocument(
          set.season,
          set.version,
          document,
        );
      }
      if (!(await this.versionComplete(set.season, set.version, required))) {
        await this.storage.deleteUnpublishedVersion(set.season, set.version);
        return failure(set, previousVersion, 'incomplete-version');
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
      await this.storage.setActiveVersion(set.season, set.version);
    } catch {
      await this.storage.deleteUnpublishedVersion(set.season, set.version);
      return failure(set, previousVersion, 'storage-write');
    }

    const purgeResult = await this.purger.purgePublicUrls(
      publicUrlsForDocuments(this.purgeOrigin, set.season, required),
    );
    this.logger.info({
      operation: 'publication.completed',
      season: set.season,
      releaseVersion: set.version,
      status: 200,
      cacheOutcome: purgeResult.ok ? 'purged' : 'purge-failed',
    });
    return {
      status: 'applied',
      season: set.season,
      version: set.version,
      previousVersion,
      reason: purgeResult.failureCategory,
      cachePurgeOk: purgeResult.ok,
      purgedUrls: purgeResult.urls,
    };
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
        purgedUrls: [],
      };
    }
    const required = await this.documentNamesForVersion(
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
        purgedUrls: [],
      };
    }
    if (activeVersion) {
      await this.storage.setPreviousVersion(season, activeVersion);
    }
    await this.storage.setActiveVersion(season, previousVersion);
    const purgeResult = await this.purger.purgePublicUrls(
      publicUrlsForDocuments(this.purgeOrigin, season, required),
    );
    this.logger.warn({
      operation: 'rollback.completed',
      season,
      releaseVersion: previousVersion,
      cacheOutcome: purgeResult.ok ? 'purged' : 'purge-failed',
    });
    return {
      status: 'applied',
      season,
      version: previousVersion,
      previousVersion: activeVersion,
      reason: purgeResult.failureCategory,
      cachePurgeOk: purgeResult.ok,
      purgedUrls: purgeResult.urls,
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

  private async documentNamesForVersion(
    season: number,
    version: string,
  ): Promise<SnapshotDocumentName[]> {
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
    const out: SnapshotDocumentName[] = [];
    for (const name of known) {
      if (await this.storage.readVersionedDocument(season, version, name)) {
        out.push(name);
      }
    }
    const calendar = await this.storage.readVersionedDocument(
      season,
      version,
      'calendar',
    );
    if (Array.isArray(calendar?.data)) {
      for (const event of calendar.data as Array<{ round?: number }>) {
        if (typeof event.round === 'number') {
          out.push(`grand-prix:${event.round}`);
          out.push(`grand-prix:${event.round}:results`);
        }
      }
    }
    const drivers = await this.storage.readVersionedDocument(
      season,
      version,
      'drivers',
    );
    if (Array.isArray(drivers?.data)) {
      for (const driver of drivers.data as Array<{ driverId?: string }>) {
        if (typeof driver.driverId === 'string')
          out.push(`driver:${driver.driverId}`);
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
          out.push(`constructor:${constructor.constructorId}`);
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
        if (typeof circuit.id === 'string') out.push(`circuit:${circuit.id}`);
      }
    }
    return out;
  }
}

function failure(
  set: GeneratedSnapshotSet,
  previousVersion: string | null,
  reason: string,
): PublicationResult {
  return {
    status: 'failed',
    season: set.season,
    version: set.version,
    previousVersion,
    reason,
    cachePurgeOk: true,
    purgedUrls: [],
  };
}
