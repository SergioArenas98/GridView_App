import {
  activeKey,
  contentMetadataKey,
  currentSeasonKey,
  parseVersionFromSnapshotKey,
  legacyGlobalQuotaKey,
  previousKey,
  quotaKey,
  snapshotKey,
  snapshotPrefix,
  syncStateKey,
} from './keys';
import type { ProviderSourceId } from '../providers/provider-source';
import {
  adaptLegacyMockQuotaState,
  assertQuotaSource,
  quotaRecordForSource,
} from './quota-records';
import type {
  ContentMetadata,
  QuotaState,
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
  SyncState,
} from './types';

export class KvSnapshotStorage implements SnapshotStorage {
  constructor(private readonly kv: KVNamespace) {}

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
    return this.getString(activeKey(season));
  }

  async setActiveVersion(season: number, version: string): Promise<void> {
    await this.putString(activeKey(season), version);
  }

  async getPreviousVersion(season: number): Promise<string | null> {
    return this.getString(previousKey(season));
  }

  async setPreviousVersion(
    season: number,
    version: string | null,
  ): Promise<void> {
    if (version === null) {
      await this.kv.delete(previousKey(season));
      return;
    }
    await this.putString(previousKey(season), version);
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

  async getQuotaState(sourceId: ProviderSourceId): Promise<QuotaState | null> {
    const current = quotaRecordForSource(
      sourceId,
      await this.get<unknown>(quotaKey(sourceId)),
    );
    if (current) return current;
    // Narrow, mock-only fallback to the pre-Phase-9B-1 global record. It is
    // never returned for `jolpica` or `openf1`, and it is never deleted.
    return adaptLegacyMockQuotaState(
      sourceId,
      await this.get<unknown>(legacyGlobalQuotaKey),
    );
  }

  async setQuotaState(
    sourceId: ProviderSourceId,
    state: QuotaState,
  ): Promise<void> {
    // Fail closed rather than relabel: a mismatch throws before any write.
    assertQuotaSource(sourceId, state);
    await this.put(quotaKey(sourceId), state);
  }

  async getContentMetadata(): Promise<ContentMetadata | null> {
    return this.get<ContentMetadata>(contentMetadataKey);
  }

  async setContentMetadata(metadata: ContentMetadata): Promise<void> {
    await this.put(contentMetadataKey, metadata);
  }

  async listVersions(season: number): Promise<string[]> {
    const versions = new Set<string>();
    let cursor: string | undefined;
    do {
      const list = await this.kv.list({
        prefix: `snapshot:${season}:`,
        cursor,
      });
      for (const key of list.keys) {
        const version = parseVersionFromSnapshotKey(key.name, season);
        if (version) versions.add(version);
      }
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);
    return [...versions].sort();
  }

  async deleteUnpublishedVersion(
    season: number,
    version: string,
  ): Promise<void> {
    if ((await this.getActiveVersion(season)) === version) return;
    let cursor: string | undefined;
    const prefix = snapshotPrefix(season, version);
    do {
      const list = await this.kv.list({ prefix, cursor });
      await Promise.all(list.keys.map((key) => this.kv.delete(key.name)));
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);
  }

  private async get<T>(key: string): Promise<T | null> {
    const raw = await this.kv.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  }

  private async put(key: string, value: unknown): Promise<void> {
    await this.kv.put(key, JSON.stringify(value));
  }

  private async getString(key: string): Promise<string | null> {
    return this.kv.get(key);
  }

  private async putString(key: string, value: string): Promise<void> {
    await this.kv.put(key, value);
  }
}
