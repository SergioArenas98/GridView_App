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

export function activeKey(season: number): string {
  return `active:${season}`;
}

export function previousKey(season: number): string {
  return `previous:${season}`;
}

export const currentSeasonKey = 'meta:current-season';
export const contentMetadataKey = 'meta:content-schema';
export const quotaKey = 'quota:provider';

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
