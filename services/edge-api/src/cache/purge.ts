import type { SnapshotDocumentName } from '../storage/types';

export interface CachePurgeResult {
  ok: boolean;
  urls: string[];
  failureCategory: string | null;
}

export interface CachePurgeAdapter {
  purgePublicUrls(urls: string[]): Promise<CachePurgeResult>;
}

export class MemoryCachePurgeAdapter implements CachePurgeAdapter {
  readonly purgedUrls: string[] = [];
  failNext = false;

  async purgePublicUrls(urls: string[]): Promise<CachePurgeResult> {
    if (this.failNext) {
      this.failNext = false;
      return { ok: false, urls, failureCategory: 'cache-purge-failed' };
    }
    this.purgedUrls.push(...urls);
    return { ok: true, urls, failureCategory: null };
  }
}

const sharedPurger = new MemoryCachePurgeAdapter();

export function getSharedMemoryPurger(): MemoryCachePurgeAdapter {
  return sharedPurger;
}

export function publicUrlsForDocuments(
  origin: string,
  season: number,
  documents: SnapshotDocumentName[],
): string[] {
  const urls = new Set<string>();
  for (const document of documents) {
    const path = publicPathForDocument(season, document);
    if (path) urls.add(new URL(path, origin).toString());
  }
  return [...urls].sort();
}

function publicPathForDocument(
  season: number,
  document: SnapshotDocumentName,
): string | null {
  if (document === 'bootstrap') return `/v1/bootstrap?season=${season}`;
  if (document === 'home') return `/v1/home?season=${season}`;
  if (document === 'season') return `/v1/seasons/${season}`;
  if (document === 'calendar') return `/v1/seasons/${season}/calendar`;
  if (document === 'drivers') return `/v1/seasons/${season}/drivers`;
  if (document === 'constructors') return `/v1/seasons/${season}/constructors`;
  if (document === 'circuits') return `/v1/seasons/${season}/circuits`;
  if (document === 'standings:drivers') {
    return `/v1/seasons/${season}/standings/drivers`;
  }
  if (document === 'standings:constructors') {
    return `/v1/seasons/${season}/standings/constructors`;
  }
  if (document === 'content:manifest') return '/v1/content/manifest';
  if (document.startsWith('grand-prix:')) {
    const [, round, suffix] = document.split(':');
    return suffix === 'results'
      ? `/v1/seasons/${season}/grand-prix/${round}/results`
      : `/v1/seasons/${season}/grand-prix/${round}`;
  }
  if (document.startsWith('driver:')) {
    return `/v1/drivers/${document.slice('driver:'.length)}?season=${season}`;
  }
  if (document.startsWith('constructor:')) {
    return `/v1/constructors/${document.slice('constructor:'.length)}?season=${season}`;
  }
  if (document.startsWith('circuit:')) {
    return `/v1/circuits/${document.slice('circuit:'.length)}?season=${season}`;
  }
  return null;
}
