import type {
  ErrorCode,
  SeasonSnapshotMeta,
  SnapshotMeta,
} from '../contract/types';
import { errorResponse, successResponse } from '../http/envelope';
import { ifNoneMatchMatches, snapshotCacheHeaders } from '../http/cache';
import type { SnapshotStorage, StoredSnapshot } from '../storage/types';
import { resolvePublicRoute, type PublicRouteMatch } from './params';

export interface PublicRouteResult {
  response: Response;
  routeTemplate: string;
  cacheOutcome: 'hit' | 'not-modified' | 'miss' | 'error';
}

export async function handlePublicRequest(
  request: Request,
  storage: SnapshotStorage,
  requestId: string,
): Promise<PublicRouteResult> {
  const url = new URL(request.url);
  const resolution = resolvePublicRoute(url);
  if (resolution.error) {
    const status = resolution.error === 'INVALID_PARAMETER' ? 400 : 404;
    return {
      response: publicError(status, resolution.error, requestId),
      routeTemplate:
        resolution.error === 'INVALID_PARAMETER' ? 'invalid' : 'unknown',
      cacheOutcome: 'error',
    };
  }
  if (!resolution.match) {
    return {
      response: publicError(404, 'RESOURCE_NOT_FOUND', requestId),
      routeTemplate: 'unknown',
      cacheOutcome: 'error',
    };
  }

  const season = await resolveSeason(storage, resolution.match);
  if (season === null) {
    return {
      response: publicError(503, 'SNAPSHOT_NOT_READY', requestId, true),
      routeTemplate: resolution.match.routeTemplate,
      cacheOutcome: 'error',
    };
  }

  const activeVersion = await storage.getActiveVersion(season);
  if (!activeVersion) {
    return {
      response: publicError(404, 'SEASON_NOT_FOUND', requestId),
      routeTemplate: resolution.match.routeTemplate,
      cacheOutcome: 'error',
    };
  }

  const snapshot = await storage.readVersionedDocument(
    season,
    activeVersion,
    resolution.match.documentName,
  );
  if (!snapshot) {
    const code = detailDocument(resolution.match.documentName)
      ? 'RESOURCE_NOT_FOUND'
      : 'SNAPSHOT_NOT_READY';
    return {
      response: publicError(
        code === 'RESOURCE_NOT_FOUND' ? 404 : 503,
        code,
        requestId,
        code !== 'RESOURCE_NOT_FOUND',
      ),
      routeTemplate: resolution.match.routeTemplate,
      cacheOutcome: 'error',
    };
  }

  const headers = snapshotCacheHeaders(
    snapshot,
    snapshot.resourceIdentity,
    resolution.match.cacheCategory,
  );
  const etag = headers['ETag'] ?? '';
  if (ifNoneMatchMatches(request.headers.get('If-None-Match'), etag)) {
    return {
      response: new Response(null, {
        status: 304,
        headers: {
          ...headers,
          'X-Request-ID': requestId,
        },
      }),
      routeTemplate: resolution.match.routeTemplate,
      cacheOutcome: 'not-modified',
    };
  }

  const meta = withRequestId(snapshot.meta, requestId);
  const response = successResponse(snapshot.data, meta, headers);
  return {
    response: responseForMethod(request, response),
    routeTemplate: resolution.match.routeTemplate,
    cacheOutcome: 'hit',
  };
}

function responseForMethod(request: Request, response: Response): Response {
  if (request.method !== 'HEAD') return response;
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}

function withRequestId(
  meta: StoredSnapshot['meta'],
  requestId: string,
): SeasonSnapshotMeta | SnapshotMeta {
  return { ...meta, requestId } as SeasonSnapshotMeta | SnapshotMeta;
}

async function resolveSeason(
  storage: SnapshotStorage,
  match: PublicRouteMatch,
): Promise<number | null> {
  if (match.season !== 'current') return match.season;
  return storage.getCurrentSeason();
}

function publicError(
  status: number,
  code: ErrorCode,
  requestId: string,
  retryable = false,
): Response {
  const messages: Record<ErrorCode, string> = {
    INVALID_PARAMETER: 'The request contains an invalid parameter.',
    SEASON_NOT_FOUND: 'The requested season is not available.',
    RESOURCE_NOT_FOUND: 'The requested resource does not exist.',
    RESOURCE_NOT_AVAILABLE: 'The requested resource is not available.',
    SNAPSHOT_NOT_READY: 'The requested snapshot is not ready.',
    UPSTREAM_UNAVAILABLE: 'The requested data is temporarily unavailable.',
    UPSTREAM_RATE_LIMITED: 'The requested data is temporarily unavailable.',
    MAINTENANCE: 'The service is temporarily unavailable.',
    METHOD_NOT_ALLOWED: 'The requested method is not allowed.',
    INTERNAL_ERROR: 'An internal error occurred.',
  };
  return errorResponse(status, code, messages[code], retryable, requestId);
}

function detailDocument(documentName: string): boolean {
  return (
    documentName.startsWith('grand-prix:') ||
    documentName.startsWith('driver:') ||
    documentName.startsWith('constructor:') ||
    documentName.startsWith('circuit:')
  );
}
