import type {
  ContentManifest,
  SeasonSnapshotMeta,
  SnapshotMeta,
} from '../contract/types';
import type {
  ProviderSourceId,
  QuotaWindowClass,
  QuotaWindowKind,
} from '../providers/provider-source';

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

/**
 * One locally modelled rate-limit window for one source.
 *
 * The collection is extensible rather than a fixed set of fields, so a source
 * publishing per-second and per-hour limits and one publishing per-second and
 * per-minute limits are both representable without adding
 * `perSecondRemaining` / `perHourRemaining` columns.
 *
 * Every figure is a GridView-local counter derived from a published limit.
 * Neither adopted source returns quota headers
 * (GridView_Provider_Evaluation.md §8.6), so none of this is read from a
 * response.
 */
export interface QuotaWindowState {
  window: QuotaWindowKind;
  windowClass: QuotaWindowClass;
  /** The published limit for this window, or the test-only fixture for `mock`. */
  limit: number;
  durationSeconds: number;
  used: number;
  remaining: number;
  windowStartedAt: string;
  resetsAt: string;
  /**
   * Consecutive times this window has reached zero without an intervening
   * window that stayed clean. Bounded, and what separates a single normal
   * burst saturation from repeated saturation.
   */
  saturationStreak: number;
}

export interface QuotaState {
  /** Canonical internal source this state belongs to. Never published. */
  sourceId: ProviderSourceId;
  /** `true` when `limit` values are GridView test fixtures, not published policy. */
  testOnly: boolean;
  windows: QuotaWindowState[];
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
  /**
   * Reads the modelled quota state for one source. Source selection is
   * required at compile time, so one source can never be served another
   * source's record.
   */
  getQuotaState(sourceId: ProviderSourceId): Promise<QuotaState | null>;
  /** Writes under the source-specific key only. */
  setQuotaState(sourceId: ProviderSourceId, state: QuotaState): Promise<void>;
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
