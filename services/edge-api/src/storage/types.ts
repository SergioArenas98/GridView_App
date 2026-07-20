import type {
  ContentManifest,
  SeasonSnapshotMeta,
  SnapshotMeta,
} from '../contract/types';

export type StoredMeta =
  Omit<SeasonSnapshotMeta, 'requestId'> | Omit<SnapshotMeta, 'requestId'>;

export type SnapshotDocumentName =
  | 'bootstrap'
  | 'home'
  | 'season'
  | 'calendar'
  | `grand-prix:${number}`
  | `grand-prix:${number}:results`
  | 'drivers'
  | 'constructors'
  | 'circuits'
  | 'standings:drivers'
  | 'standings:constructors'
  | `driver:${string}`
  | `constructor:${string}`
  | `circuit:${string}`
  | 'content:manifest';

export interface StoredSnapshot<TData = unknown> {
  data: TData;
  meta: StoredMeta;
  documentName: SnapshotDocumentName;
  resourceIdentity: string;
}

export type SyncJobCategory =
  | 'season-calendar'
  | 'event-schedule'
  | 'profiles'
  | 'standings'
  | 'results'
  | 'home-rebuild';

export type QuotaWarningLevel =
  'normal' | 'warning' | 'high' | 'critical' | 'unknown';

export interface QuotaState {
  dailyLimit: number | null;
  dailyRemaining: number | null;
  perMinuteLimit: number | null;
  perMinuteRemaining: number | null;
  lastProviderSuccessAt: string | null;
  lastProviderFailureAt: string | null;
  retryAfter: string | null;
  usageByJobCategory: Partial<Record<SyncJobCategory, number>>;
  warningLevel: QuotaWarningLevel;
}

export interface SyncState {
  season: number;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  lastFailureCategory: string | null;
  lastSuccessByJob: Partial<Record<SyncJobCategory, string>>;
  lastFailureByJob: Partial<Record<SyncJobCategory, string>>;
  lastSkippedJobs: SyncJobCategory[];
  lastPublicationVersion: string | null;
  lastPublicationStatus: string | null;
}

export interface ContentMetadata {
  schemaVersion: number;
  contentVersion: string;
  mediaVersion: string | null;
  supportedSeasons: number[];
  attributionVersion: string | null;
  minimumApiSchemaVersion: number;
  lastPublishedAt: string;
}

export interface SnapshotStorage {
  writeVersionedDocument(
    season: number,
    version: string,
    document: StoredSnapshot,
  ): Promise<void>;
  readVersionedDocument(
    season: number,
    version: string,
    documentName: SnapshotDocumentName,
  ): Promise<StoredSnapshot | null>;
  getActiveVersion(season: number): Promise<string | null>;
  setActiveVersion(season: number, version: string): Promise<void>;
  getPreviousVersion(season: number): Promise<string | null>;
  setPreviousVersion(season: number, version: string | null): Promise<void>;
  getCurrentSeason(): Promise<number | null>;
  setCurrentSeason(season: number): Promise<void>;
  getSyncState(season: number): Promise<SyncState | null>;
  setSyncState(season: number, state: SyncState): Promise<void>;
  getQuotaState(): Promise<QuotaState | null>;
  setQuotaState(state: QuotaState): Promise<void>;
  getContentMetadata(): Promise<ContentMetadata | null>;
  setContentMetadata(metadata: ContentMetadata): Promise<void>;
  listVersions(season: number): Promise<string[]>;
  deleteUnpublishedVersion(season: number, version: string): Promise<void>;
}

export function contentMetadataFromManifest(
  manifest: ContentManifest,
  lastPublishedAt: string,
): ContentMetadata {
  return {
    schemaVersion: 1,
    contentVersion: manifest.contentVersion,
    mediaVersion: manifest.mediaVersion,
    supportedSeasons: manifest.supportedSeasons,
    attributionVersion: manifest.attributionVersion,
    minimumApiSchemaVersion: manifest.minimumApiSchemaVersion,
    lastPublishedAt,
  };
}
