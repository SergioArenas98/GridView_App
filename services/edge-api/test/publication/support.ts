/**
 * Shared publication test scaffolding.
 *
 * One storage double drives every phase-failure case, so a test names the
 * phase it is injecting at rather than re-implementing an interceptor. It
 * extends the real `MemorySnapshotStorage` rather than re-implementing
 * `SnapshotStorage`, so a new storage capability is inherited instead of
 * silently missing from the double.
 */

import { MemoryCachePurgeAdapter } from '../../src/cache/purge';
import type {
  CachePurgeAdapter,
  CachePurgeResult,
} from '../../src/cache/purge';
import { CapturingLogger } from '../../src/logging/logger';
import { SnapshotPublisher } from '../../src/publication/publisher';
import { MemorySnapshotStorage } from '../../src/storage/local';
import type {
  SnapshotDocumentName,
  StoredSnapshot,
} from '../../src/storage/types';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import type { SnapshotValidator } from '../../src/validation/snapshot-validator';
import { generateSnapshotSet } from '../../src/snapshots/generator';
import type { GeneratedSnapshotSet } from '../../src/snapshots/generator';
import type { ProviderSeasonSource } from '../../src/providers/formula-one-provider';
import { FIXED_NOW } from '../providers/coordination/support';

export const ORIGIN = 'https://api.gridview.test';

/** Every storage entry point a publication or rollback run depends on. */
export type StoragePhase =
  | 'getActiveVersion'
  | 'setActiveVersion'
  | 'getPreviousVersion'
  | 'setPreviousVersion'
  | 'readVersionedDocument'
  | 'writeVersionedDocument'
  | 'readVersionInventory'
  | 'writeVersionInventory'
  | 'setContentMetadata'
  | 'getCurrentSeason'
  | 'setCurrentSeason'
  | 'deleteUnpublishedVersion';

export type FailureMode = 'throw' | 'reject';

interface Armed {
  readonly phase: StoragePhase;
  readonly onCall: number | 'every';
  readonly mode: FailureMode;
}

/**
 * In-memory storage that can be armed to fail one named phase, and can hide a
 * document or an inventory that was legitimately written.
 *
 * Hiding models the two states an exact inventory has to survive: a document
 * that went missing after it was recorded, and a version published before
 * inventories existed at all.
 */
export class ScriptableStorage extends MemorySnapshotStorage {
  readonly calls: StoragePhase[] = [];
  private readonly counts = new Map<StoragePhase, number>();
  private armed: Armed | null = null;
  private readonly hiddenDocuments = new Set<string>();
  private readonly hiddenInventories = new Set<string>();

  arm(
    phase: StoragePhase,
    onCall: number | 'every' = 1,
    mode: FailureMode = 'throw',
  ): void {
    this.armed = { phase, onCall, mode };
    this.counts.clear();
    this.calls.length = 0;
  }

  disarm(): void {
    this.armed = null;
  }

  callsTo(phase: StoragePhase): number {
    return this.calls.filter((call) => call === phase).length;
  }

  hideDocument(
    season: number,
    version: string,
    documentName: SnapshotDocumentName,
  ): void {
    this.hiddenDocuments.add(documentKey(season, version, documentName));
  }

  hideInventory(season: number, version: string): void {
    this.hiddenInventories.add(versionKey(season, version));
  }

  private async guard(phase: StoragePhase): Promise<void> {
    this.calls.push(phase);
    const next = (this.counts.get(phase) ?? 0) + 1;
    this.counts.set(phase, next);
    if (this.armed === null || this.armed.phase !== phase) return;
    if (this.armed.onCall !== 'every' && this.armed.onCall !== next) return;
    // The message deliberately embeds something that must never be logged, so
    // a containment test proves the value is dropped rather than re-reported.
    const error = new Error(`KV outage in ${phase} for gridview://secret-key`);
    if (this.armed.mode === 'throw') throw error;
    return Promise.reject(error);
  }

  override async readVersionedDocument(
    season: number,
    version: string,
    documentName: SnapshotDocumentName,
  ): Promise<StoredSnapshot | null> {
    await this.guard('readVersionedDocument');
    if (this.hiddenDocuments.has(documentKey(season, version, documentName))) {
      return null;
    }
    return super.readVersionedDocument(season, version, documentName);
  }

  override async writeVersionedDocument(
    season: number,
    version: string,
    document: StoredSnapshot,
  ): Promise<void> {
    await this.guard('writeVersionedDocument');
    return super.writeVersionedDocument(season, version, document);
  }

  override async readVersionInventory(
    season: number,
    version: string,
  ): Promise<SnapshotDocumentName[] | null> {
    await this.guard('readVersionInventory');
    if (this.hiddenInventories.has(versionKey(season, version))) return null;
    return super.readVersionInventory(season, version);
  }

  override async writeVersionInventory(
    season: number,
    version: string,
    documentNames: readonly SnapshotDocumentName[],
  ): Promise<void> {
    await this.guard('writeVersionInventory');
    return super.writeVersionInventory(season, version, documentNames);
  }

  override async getActiveVersion(season: number): Promise<string | null> {
    await this.guard('getActiveVersion');
    return super.getActiveVersion(season);
  }

  override async setActiveVersion(
    season: number,
    version: string,
  ): Promise<void> {
    await this.guard('setActiveVersion');
    return super.setActiveVersion(season, version);
  }

  override async getPreviousVersion(season: number): Promise<string | null> {
    await this.guard('getPreviousVersion');
    return super.getPreviousVersion(season);
  }

  override async setPreviousVersion(
    season: number,
    version: string | null,
  ): Promise<void> {
    await this.guard('setPreviousVersion');
    return super.setPreviousVersion(season, version);
  }

  override async setContentMetadata(
    metadata: Parameters<MemorySnapshotStorage['setContentMetadata']>[0],
  ): Promise<void> {
    await this.guard('setContentMetadata');
    return super.setContentMetadata(metadata);
  }

  override async getCurrentSeason(): Promise<number | null> {
    await this.guard('getCurrentSeason');
    return super.getCurrentSeason();
  }

  override async setCurrentSeason(season: number): Promise<void> {
    await this.guard('setCurrentSeason');
    return super.setCurrentSeason(season);
  }

  override async deleteUnpublishedVersion(
    season: number,
    version: string,
  ): Promise<void> {
    await this.guard('deleteUnpublishedVersion');
    return super.deleteUnpublishedVersion(season, version);
  }

  /** Reads the stored pointers without the armed guards firing. */
  async pointers(season: number): Promise<{
    active: string | null;
    previous: string | null;
  }> {
    const armed = this.armed;
    this.armed = null;
    try {
      return {
        active: await super.getActiveVersion(season),
        previous: await super.getPreviousVersion(season),
      };
    } finally {
      this.armed = armed;
    }
  }
}

function versionKey(season: number, version: string): string {
  return `${season}:${version}`;
}

function documentKey(
  season: number,
  version: string,
  documentName: SnapshotDocumentName,
): string {
  return `${versionKey(season, version)}:${documentName}`;
}

/** A purge adapter that fails like an outage rather than reporting `ok: false`. */
export class ExplodingPurgeAdapter implements CachePurgeAdapter {
  calls = 0;
  constructor(private readonly mode: FailureMode = 'throw') {}
  purgePublicUrls(urls: string[]): Promise<CachePurgeResult> {
    this.calls += 1;
    const error = new Error(`purge failed for ${urls[0] ?? 'nothing'}`);
    if (this.mode === 'throw') throw error;
    return Promise.reject(error);
  }
}

/** A purge adapter that records each batch it was handed, in order. */
export class RecordingPurgeAdapter extends MemoryCachePurgeAdapter {
  readonly batches: string[][] = [];
  override purgePublicUrls(urls: string[]): Promise<CachePurgeResult> {
    this.batches.push([...urls]);
    return super.purgePublicUrls(urls);
  }
}

export function publisherFor(
  storage: MemorySnapshotStorage,
  purger: CachePurgeAdapter,
  logger: CapturingLogger = new CapturingLogger(),
  validator: SnapshotValidator = runtimeSnapshotValidator,
): SnapshotPublisher {
  return new SnapshotPublisher(storage, validator, purger, logger, ORIGIN);
}

export function setFor(
  source: ProviderSeasonSource,
  version: string,
  sourceUpdatedAt = source.sourceUpdatedAt,
): GeneratedSnapshotSet {
  return generateSnapshotSet(
    { ...source, sourceUpdatedAt },
    FIXED_NOW,
    version,
  );
}
