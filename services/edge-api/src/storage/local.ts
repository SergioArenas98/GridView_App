import {
  activeKey,
  contentMetadataKey,
  currentSeasonKey,
  parseVersionFromSnapshotKey,
  previousKey,
  quotaKey,
  snapshotKey,
  snapshotPrefix,
  syncStateKey,
} from './keys';
import type {
  ContentMetadata,
  QuotaState,
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
  SyncState,
} from './types';

type WriteFailure = (key: string, value: unknown) => boolean;

export class MemorySnapshotStorage implements SnapshotStorage {
  private readonly values = new Map<string, unknown>();
  readonly writeLog: string[] = [];
  private writeFailure: WriteFailure | null = null;

  setWriteFailure(failure: WriteFailure | null): void {
    this.writeFailure = failure;
  }

  clear(): void {
    this.values.clear();
    this.writeLog.length = 0;
    this.writeFailure = null;
  }

  async writeVersionedDocument(
    season: number,
    version: string,
    document: StoredSnapshot,
  ): Promise<void> {
    await this.put(
      snapshotKey(season, version, document.documentName),
      document,
    );
  }

  async readVersionedDocument(
    season: number,
    version: string,
    documentName: SnapshotDocumentName,
  ): Promise<StoredSnapshot | null> {
    return this.get<StoredSnapshot>(snapshotKey(season, version, documentName));
  }

  async getActiveVersion(season: number): Promise<string | null> {
    return this.get<string>(activeKey(season));
  }

  async setActiveVersion(season: number, version: string): Promise<void> {
    await this.put(activeKey(season), version);
  }

  async getPreviousVersion(season: number): Promise<string | null> {
    return this.get<string>(previousKey(season));
  }

  async setPreviousVersion(
    season: number,
    version: string | null,
  ): Promise<void> {
    const key = previousKey(season);
    if (version === null) {
      this.values.delete(key);
      return;
    }
    await this.put(key, version);
  }

  async getCurrentSeason(): Promise<number | null> {
    return this.get<number>(currentSeasonKey);
  }

  async setCurrentSeason(season: number): Promise<void> {
    await this.put(currentSeasonKey, season);
  }

  async getSyncState(season: number): Promise<SyncState | null> {
    return this.get<SyncState>(syncStateKey(season));
  }

  async setSyncState(season: number, state: SyncState): Promise<void> {
    await this.put(syncStateKey(season), state);
  }

  async getQuotaState(): Promise<QuotaState | null> {
    return this.get<QuotaState>(quotaKey);
  }

  async setQuotaState(state: QuotaState): Promise<void> {
    await this.put(quotaKey, state);
  }

  async getContentMetadata(): Promise<ContentMetadata | null> {
    return this.get<ContentMetadata>(contentMetadataKey);
  }

  async setContentMetadata(metadata: ContentMetadata): Promise<void> {
    await this.put(contentMetadataKey, metadata);
  }

  async listVersions(season: number): Promise<string[]> {
    const versions = new Set<string>();
    for (const key of this.values.keys()) {
      const version = parseVersionFromSnapshotKey(key, season);
      if (version) versions.add(version);
    }
    return [...versions].sort();
  }

  async deleteUnpublishedVersion(
    season: number,
    version: string,
  ): Promise<void> {
    if ((await this.getActiveVersion(season)) === version) return;
    const prefix = snapshotPrefix(season, version);
    for (const key of [...this.values.keys()]) {
      if (key.startsWith(prefix)) this.values.delete(key);
    }
  }

  private async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T | undefined) ?? null;
  }

  private async put(key: string, value: unknown): Promise<void> {
    if (this.writeFailure?.(key, value)) {
      throw new Error(`Injected local storage write failure for ${key}`);
    }
    this.writeLog.push(key);
    this.values.set(key, structuredClone(value));
  }
}

const sharedLocalStorage = new MemorySnapshotStorage();

export function getSharedLocalStorage(): MemorySnapshotStorage {
  return sharedLocalStorage;
}
