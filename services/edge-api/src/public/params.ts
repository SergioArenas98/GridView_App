import { isSlug } from '../contract/validation';
import type { SnapshotDocumentName } from '../storage/types';

export interface PublicRouteMatch {
  routeTemplate: string;
  documentName: SnapshotDocumentName;
  cacheCategory:
    'aggregate' | 'calendar' | 'event' | 'standings' | 'profile' | 'manifest';
  season: number | 'current';
}

export interface RouteResolution {
  match: PublicRouteMatch | null;
  error: 'INVALID_PARAMETER' | 'RESOURCE_NOT_FOUND' | null;
}

const seasonRe = /^\d{4}$/;
const roundRe = /^\d{1,2}$/;

export function resolvePublicRoute(url: URL): RouteResolution {
  const path = url.pathname;
  const searchKeys = [...url.searchParams.keys()];
  const seasonQuery = url.searchParams.get('season') ?? 'current';

  if (path === '/v1/bootstrap') {
    if (!onlySearch(searchKeys, ['season']) || !validSeasonQuery(seasonQuery)) {
      return invalid();
    }
    return match(
      '/v1/bootstrap',
      'bootstrap',
      'aggregate',
      parseSeasonQuery(seasonQuery),
    );
  }
  if (path === '/v1/home') {
    if (!onlySearch(searchKeys, ['season']) || !validSeasonQuery(seasonQuery)) {
      return invalid();
    }
    return match(
      '/v1/home',
      'home',
      'aggregate',
      parseSeasonQuery(seasonQuery),
    );
  }
  if (path === '/v1/seasons/current') {
    if (searchKeys.length > 0) return invalid();
    return match('/v1/seasons/current', 'season', 'calendar', 'current');
  }
  if (path === '/v1/content/manifest') {
    if (searchKeys.length > 0) return invalid();
    return match(
      '/v1/content/manifest',
      'content:manifest',
      'manifest',
      'current',
    );
  }

  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'v1') return notFound();

  if (parts[1] === 'seasons') {
    return resolveSeasonRoute(parts, searchKeys);
  }
  if (parts[1] === 'drivers' && parts.length === 3) {
    if (!onlySearch(searchKeys, ['season']) || !validSeasonQuery(seasonQuery)) {
      return invalid();
    }
    if (!isSlug(parts[2])) return invalid();
    return match(
      '/v1/drivers/{driverId}',
      `driver:${parts[2]}`,
      'profile',
      parseSeasonQuery(seasonQuery),
    );
  }
  if (parts[1] === 'constructors' && parts.length === 3) {
    if (!onlySearch(searchKeys, ['season']) || !validSeasonQuery(seasonQuery)) {
      return invalid();
    }
    if (!isSlug(parts[2])) return invalid();
    return match(
      '/v1/constructors/{constructorId}',
      `constructor:${parts[2]}`,
      'profile',
      parseSeasonQuery(seasonQuery),
    );
  }
  if (parts[1] === 'circuits' && parts.length === 3) {
    if (!onlySearch(searchKeys, ['season']) || !validSeasonQuery(seasonQuery)) {
      return invalid();
    }
    if (!isSlug(parts[2])) return invalid();
    return match(
      '/v1/circuits/{circuitId}',
      `circuit:${parts[2]}`,
      'profile',
      parseSeasonQuery(seasonQuery),
    );
  }
  return notFound();
}

function resolveSeasonRoute(
  parts: string[],
  searchKeys: string[],
): RouteResolution {
  if (searchKeys.length > 0) return invalid();
  const season = parseSeasonPath(parts[2]);
  if (season === null) return invalid();

  if (parts.length === 3) {
    return match('/v1/seasons/{season}', 'season', 'calendar', season);
  }
  if (parts.length === 4 && parts[3] === 'calendar') {
    return match(
      '/v1/seasons/{season}/calendar',
      'calendar',
      'calendar',
      season,
    );
  }
  if (parts.length === 4 && parts[3] === 'drivers') {
    return match('/v1/seasons/{season}/drivers', 'drivers', 'profile', season);
  }
  if (parts.length === 4 && parts[3] === 'constructors') {
    return match(
      '/v1/seasons/{season}/constructors',
      'constructors',
      'profile',
      season,
    );
  }
  if (parts.length === 4 && parts[3] === 'circuits') {
    return match(
      '/v1/seasons/{season}/circuits',
      'circuits',
      'profile',
      season,
    );
  }
  if (parts.length === 5 && parts[3] === 'standings') {
    if (parts[4] === 'drivers') {
      return match(
        '/v1/seasons/{season}/standings/drivers',
        'standings:drivers',
        'standings',
        season,
      );
    }
    if (parts[4] === 'constructors') {
      return match(
        '/v1/seasons/{season}/standings/constructors',
        'standings:constructors',
        'standings',
        season,
      );
    }
  }
  if (parts[3] === 'grand-prix' && parts.length >= 5) {
    const round = parseRound(parts[4]);
    if (round === null) return invalid();
    if (parts.length === 5) {
      return match(
        '/v1/seasons/{season}/grand-prix/{round}',
        `grand-prix:${round}`,
        'event',
        season,
      );
    }
    if (parts.length === 6 && parts[5] === 'results') {
      return match(
        '/v1/seasons/{season}/grand-prix/{round}/results',
        `grand-prix:${round}:results`,
        'event',
        season,
      );
    }
  }
  return notFound();
}

function parseSeasonPath(value: string | undefined): number | null {
  if (!value || !seasonRe.test(value)) return null;
  const season = Number(value);
  return season >= 1950 && season <= 2100 ? season : null;
}

function validSeasonQuery(value: string): boolean {
  return value === 'current' || parseSeasonPath(value) !== null;
}

function parseSeasonQuery(value: string): number | 'current' {
  return value === 'current' ? 'current' : Number(value);
}

function parseRound(value: string | undefined): number | null {
  if (!value || !roundRe.test(value)) return null;
  const round = Number(value);
  return round >= 1 && round <= 99 ? round : null;
}

function onlySearch(keys: string[], allowed: string[]): boolean {
  return keys.every((key) => allowed.includes(key));
}

function match(
  routeTemplate: string,
  documentName: SnapshotDocumentName,
  cacheCategory: PublicRouteMatch['cacheCategory'],
  season: number | 'current',
): RouteResolution {
  return {
    match: { routeTemplate, documentName, cacheCategory, season },
    error: null,
  };
}

function invalid(): RouteResolution {
  return { match: null, error: 'INVALID_PARAMETER' };
}

function notFound(): RouteResolution {
  return { match: null, error: 'RESOURCE_NOT_FOUND' };
}
