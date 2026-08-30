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

export class CloudflareCacheApiPurgeAdapter implements CachePurgeAdapter {
  constructor(
    private readonly cacheProvider: () => Cache | null = () =>
      typeof caches === 'undefined' ? null : caches.default,
  ) {}

  async purgePublicUrls(urls: string[]): Promise<CachePurgeResult> {
    const cache = this.cacheProvider();
    if (!cache) {
      return {
        ok: false,
        urls,
        failureCategory: 'cache-api-unavailable',
      };
    }

    const deletions = await Promise.allSettled(
      urls.map((url) => cache.delete(new Request(url, { method: 'GET' }))),
    );
    const failed = deletions.some((result) => result.status === 'rejected');
    return {
      ok: !failed,
      urls,
      failureCategory: failed ? 'cache-api-delete-failed' : null,
    };
  }
}

const sharedPurger = new MemoryCachePurgeAdapter();

export function getSharedMemoryPurger(): MemoryCachePurgeAdapter {
  return sharedPurger;
}

/**
 * Whether the affected season is the one the public `current` aliases resolve
 * to.
 *
 * A closed domain rather than a boolean, because the two values mean different
 * things at a call site and a boolean would read as "true what?". It is also
 * the only switch that can widen an invalidation, so it is worth naming.
 */
export const seasonAliasings = [
  'season-is-current',
  'season-is-historical',
] as const;

export type SeasonAliasing = (typeof seasonAliasings)[number];

/**
 * The **authoritative** public-URL expansion for a set of documents.
 *
 * Publication, rollback and the operator purge all invalidate through this one
 * function, so none of the three can drift into a narrower rule than the
 * others. It is the only place that knows a document maps to more than one
 * request URL.
 *
 * A CDN keys on the request URL, and the public router accepts the same
 * document under several: the canonical numeric season, an explicit
 * `season=current`, and an **omitted** `season` - which `params.ts` defaults to
 * `current` - plus the path form `/v1/seasons/current`. Those are separate
 * cache entries, so purging only the canonical one leaves the aliases serving a
 * withdrawn release until their TTL expires, which for a profile route is an
 * hour.
 *
 * The canonical numeric URL is always produced. The aliases are added only for
 * `season-is-current`, because a historical season's aliases belong to whatever
 * season *is* current and purging them would evict a perfectly valid entry.
 */
export function invalidationUrlsForDocuments(
  origin: string,
  season: number,
  documents: readonly SnapshotDocumentName[],
  aliasing: SeasonAliasing,
): string[] {
  const urls = new Set<string>();
  for (const document of documents) {
    const path = publicPathForDocument(season, document);
    if (path) urls.add(new URL(path, origin).toString());
    if (aliasing === 'season-is-current') {
      for (const alias of currentAliasPathsForDocument(document)) {
        urls.add(new URL(alias, origin).toString());
      }
    }
  }
  return [...urls].sort();
}

/**
 * Only the current-season aliases, with no canonical numeric URL.
 *
 * Used for the season that *stops* being current during a publication: its own
 * numeric routes still serve correct content and must not be evicted, but the
 * alias URLs it was being served through now belong to the incoming season.
 */
export function currentAliasUrlsForDocuments(
  origin: string,
  documents: readonly SnapshotDocumentName[],
): string[] {
  const urls = new Set<string>();
  for (const document of documents) {
    for (const alias of currentAliasPathsForDocument(document)) {
      urls.add(new URL(alias, origin).toString());
    }
  }
  return [...urls].sort();
}

/**
 * The canonical numeric-season URLs alone.
 *
 * Kept as a named projection of the expansion above rather than a second
 * mapper, so "the canonical set" and "the canonical set plus aliases" can never
 * disagree about what a document's canonical URL is.
 */
export function publicUrlsForDocuments(
  origin: string,
  season: number,
  documents: readonly SnapshotDocumentName[],
): string[] {
  return invalidationUrlsForDocuments(
    origin,
    season,
    documents,
    'season-is-historical',
  );
}

/**
 * Every additional path the router serves this document under when its season
 * is the current one.
 *
 * Derived from `public/params.ts`, and deliberately no wider:
 *
 * - `/v1/bootstrap`, `/v1/home` and the three profile routes read `season` from
 *   the query, where an omitted value defaults to `current`, so each has an
 *   omitted form and an explicit `current` form.
 * - `/v1/seasons/current` is matched as an exact path before the numeric season
 *   parser runs. There is no `/v1/seasons/current/calendar` or any other
 *   `current` sub-path: `resolveSeasonRoute` parses that segment with the
 *   four-digit season pattern, so those are rejected as invalid parameters
 *   rather than served.
 * - `/v1/content/manifest` carries no season in its URL at all and rejects
 *   every query key, so its single canonical URL is already the whole surface.
 * - The remaining season routes accept no query at all, so they have exactly
 *   one URL each.
 *
 * Duplicated `season` keys (`?season=current&season=2026`) are technically
 * accepted by `onlySearch` and are unbounded in number, so they are not
 * enumerable and are not treated as part of the surface.
 */
function currentAliasPathsForDocument(
  document: SnapshotDocumentName,
): readonly string[] {
  if (document === 'bootstrap') {
    return ['/v1/bootstrap', '/v1/bootstrap?season=current'];
  }
  if (document === 'home') {
    return ['/v1/home', '/v1/home?season=current'];
  }
  if (document === 'season') return ['/v1/seasons/current'];
  if (document.startsWith('driver:')) {
    return profileAliases('drivers', document.slice('driver:'.length));
  }
  if (document.startsWith('constructor:')) {
    return profileAliases(
      'constructors',
      document.slice('constructor:'.length),
    );
  }
  if (document.startsWith('circuit:')) {
    return profileAliases('circuits', document.slice('circuit:'.length));
  }
  return [];
}

function profileAliases(segment: string, id: string): readonly string[] {
  const base = `/v1/${segment}/${id}`;
  return [base, `${base}?season=current`];
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
