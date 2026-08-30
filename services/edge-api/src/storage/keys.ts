import type { ProviderSourceId } from '../providers/provider-source';
import type { SnapshotDocumentName } from './types';

export function snapshotKey(
  season: number,
  version: string,
  documentName: SnapshotDocumentName,
): string {
  return `snapshot:${season}:${version}:${documentName}`;
}

export function snapshotPrefix(season: number, version: string): string {
  return `snapshot:${season}:${version}:`;
}

/**
 * The exact document inventory of one version.
 *
 * Deliberately keyed **under the version's own snapshot prefix**, for two
 * reasons that are both correctness rather than convenience:
 *
 * - It is part of the inactive version, so `deleteUnpublishedVersion` removes
 *   it with the documents it describes. An inventory that outlived its
 *   documents would describe a version that no longer exists.
 * - Its suffix is not, and cannot become, a `SnapshotDocumentName`: that union
 *   is closed, so nothing can ask for this key through
 *   `readVersionedDocument`, and `publicUrlsForDocuments` can never map it to
 *   a public route.
 */
export function versionInventoryKey(season: number, version: string): string {
  return `${snapshotPrefix(season, version)}__inventory`;
}

export function activeKey(season: number): string {
  return `active:${season}`;
}

export function previousKey(season: number): string {
  return `previous:${season}`;
}

export const currentSeasonKey = 'meta:current-season';
export const contentMetadataKey = 'meta:content-schema';
/**
 * Source-specific quota record. Every new write uses this key, so one source
 * can never overwrite another.
 */
export function quotaKey(sourceId: ProviderSourceId): string {
  return `quota:provider:${sourceId}`;
}

/**
 * The pre-Phase-9B-1 global quota record, written when only the mock provider
 * existed and quota had no source dimension.
 *
 * It is read only as a narrow fallback for the `mock` source (see
 * `readLegacyMockQuotaState`), is never written again, and is never deleted
 * automatically.
 */
export const legacyGlobalQuotaKey = 'quota:provider';

export function syncStateKey(season: number): string {
  return `sync:${season}:state`;
}

export function parseVersionFromSnapshotKey(
  key: string,
  season: number,
): string | null {
  const prefix = `snapshot:${season}:`;
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const index = rest.indexOf(':');
  if (index <= 0) return null;
  return rest.slice(0, index);
}
