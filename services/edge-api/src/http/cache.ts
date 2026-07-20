import type { StoredSnapshot } from '../storage/types';

export type CacheCategory =
  | 'status'
  | 'aggregate'
  | 'calendar'
  | 'event'
  | 'standings'
  | 'profile'
  | 'manifest'
  | 'error';

export interface CachePolicy {
  category: CacheCategory;
  cacheControl: string;
  cdnCacheControl?: string;
}

const policies: Record<CacheCategory, CachePolicy> = {
  status: {
    category: 'status',
    cacheControl: 'public, max-age=30, must-revalidate',
  },
  aggregate: {
    category: 'aggregate',
    cacheControl: 'public, max-age=120, stale-while-revalidate=60',
    cdnCacheControl: 'public, s-maxage=300',
  },
  calendar: {
    category: 'calendar',
    cacheControl: 'public, max-age=300, stale-while-revalidate=300',
    cdnCacheControl: 'public, s-maxage=900',
  },
  event: {
    category: 'event',
    cacheControl: 'public, max-age=180, stale-while-revalidate=120',
    cdnCacheControl: 'public, s-maxage=600',
  },
  standings: {
    category: 'standings',
    cacheControl: 'public, max-age=120, stale-while-revalidate=120',
    cdnCacheControl: 'public, s-maxage=300',
  },
  profile: {
    category: 'profile',
    cacheControl: 'public, max-age=1800, stale-while-revalidate=1800',
    cdnCacheControl: 'public, s-maxage=3600',
  },
  manifest: {
    category: 'manifest',
    cacheControl: 'public, max-age=1800, stale-while-revalidate=1800',
    cdnCacheControl: 'public, s-maxage=3600',
  },
  error: {
    category: 'error',
    cacheControl: 'no-store',
  },
};

export function cachePolicy(category: CacheCategory): CachePolicy {
  return policies[category];
}

export function weakEtag(
  resourceIdentity: string,
  contentVersion: string,
): string {
  const material = `v1|${resourceIdentity}|${contentVersion}`;
  return `W/"gv1-${fnv1a(material)}"`;
}

export function snapshotCacheHeaders(
  snapshot: StoredSnapshot,
  resourceIdentity: string,
  category: CacheCategory,
): Record<string, string> {
  const policy = cachePolicy(category);
  const headers: Record<string, string> = {
    ETag: weakEtag(resourceIdentity, snapshot.meta.contentVersion),
    'Cache-Control': policy.cacheControl,
    'Last-Modified': new Date(snapshot.meta.sourceUpdatedAt).toUTCString(),
  };
  if (policy.cdnCacheControl) {
    headers['CDN-Cache-Control'] = policy.cdnCacheControl;
  }
  return headers;
}

export function statusCacheHeaders(
  resourceIdentity: string,
): Record<string, string> {
  return {
    ETag: weakEtag(resourceIdentity, 'status'),
    'Cache-Control': cachePolicy('status').cacheControl,
  };
}

export function ifNoneMatchMatches(
  ifNoneMatch: string | null,
  etag: string,
): boolean {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === '*') return true;
  return ifNoneMatch
    .split(',')
    .map((part) => part.trim())
    .includes(etag);
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
