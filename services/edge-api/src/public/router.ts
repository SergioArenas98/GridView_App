import type {
  ErrorCode,
  SeasonSnapshotMeta,
  SnapshotMeta,
} from '../contract/types';
import { errorResponse, successResponse } from '../http/envelope';
import { ifNoneMatchMatches, snapshotCacheHeaders } from '../http/cache';
import type { PublicationAuthority } from '../publication/authority';
import type { SeasonAuthority } from '../publication/sequencer/model';
import { readStoredInventory } from '../publication/version-inventory';
import type {
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
} from '../storage/types';
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
  authority: PublicationAuthority = { mode: 'legacy' },
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
  const match = resolution.match;

  const season = await resolveSeason(storage, match);
  if (season === null) {
    return result(
      publicError(503, 'SNAPSHOT_NOT_READY', requestId, true),
      match.routeTemplate,
      'error',
    );
  }

  // The active/previous versions this request resolves against. In the default
  // (legacy) authority mode, and for any season the sequencer has not switched
  // to `cutoverState: 'active'`, this is the existing Workers KV pointer read
  // and nothing about the flow below changes.
  const versions = await resolveVersions(storage, authority, season, requestId);
  if (versions.kind === 'response') return versions.value;
  const { activeVersion, previousVersion, sequencerAuthoritative } =
    versions.value;

  if (activeVersion === null) {
    return result(
      publicError(404, 'SEASON_NOT_FOUND', requestId),
      match.routeTemplate,
      'error',
    );
  }

  if (sequencerAuthoritative) {
    // ADR 0025 D6: the active version's inventory is consulted before anything
    // is decided about the document, because a missing document is not, by
    // itself, evidence of propagation lag.
    const activeInventory = await readStoredInventory(
      storage,
      season,
      activeVersion,
    );
    if (activeInventory.kind !== 'documents') {
      // Missing, malformed or not-yet-visible: the bounded unavailable/degraded
      // response, never `previousVersion` as a substitute decision.
      return result(
        publicError(503, 'SNAPSHOT_NOT_READY', requestId, true),
        match.routeTemplate,
        'error',
      );
    }
    if (!activeInventory.documents.includes(match.documentName)) {
      // Validly excluded: the intended not-found response. `previousVersion` is
      // never consulted - a withdrawn route is not a propagation problem.
      return result(
        missingResponse(match, requestId),
        match.routeTemplate,
        'error',
      );
    }
  }

  const snapshot = await storage.readVersionedDocument(
    season,
    activeVersion,
    match.documentName,
  );
  if (snapshot) {
    return serveSnapshot(request, snapshot, match, requestId, activeVersion);
  }

  if (sequencerAuthoritative && previousVersion !== null) {
    // The active inventory names the document but it is not yet readable: the
    // single bounded, adjacent-version fallback ADR 0025 D6 permits - and only
    // when the previous version's own inventory also names it.
    const fallback = await servePropagationFallback(
      request,
      storage,
      season,
      previousVersion,
      match,
      requestId,
    );
    if (fallback) return fallback;
  }

  return result(
    missingResponse(match, requestId),
    match.routeTemplate,
    'error',
  );
}

type ResolvedVersions = {
  activeVersion: string | null;
  previousVersion: string | null;
  sequencerAuthoritative: boolean;
};

async function resolveVersions(
  storage: SnapshotStorage,
  authority: PublicationAuthority,
  season: number,
  requestId: string,
): Promise<
  | { kind: 'ok'; value: ResolvedVersions }
  | { kind: 'response'; value: PublicRouteResult }
> {
  if (authority.mode === 'sequencer-unavailable') {
    // Sequencer mode was explicitly selected and no port is reachable. That is
    // an unavailable authority, not a licence to read `active:{season}` - so
    // this returns the same bounded response a failed lookup does, without
    // touching storage.
    return {
      kind: 'response',
      value: result(
        publicError(503, 'SNAPSHOT_NOT_READY', requestId, true),
        'unknown',
        'error',
      ),
    };
  }

  if (authority.mode === 'sequencer') {
    let read: SeasonAuthority;
    try {
      read = await authority.port.readAuthority(season);
    } catch {
      // The lookup itself failed. Fail closed - never a legacy KV pointer read.
      return {
        kind: 'response',
        value: result(
          publicError(503, 'SNAPSHOT_NOT_READY', requestId, true),
          'unknown',
          'error',
        ),
      };
    }
    if (read.cutoverState === 'unavailable') {
      return {
        kind: 'response',
        value: result(
          publicError(503, 'SNAPSHOT_NOT_READY', requestId, true),
          'unknown',
          'error',
        ),
      };
    }
    if (read.cutoverState === 'active') {
      return {
        kind: 'ok',
        value: {
          activeVersion: read.activeVersion,
          previousVersion: read.previousVersion,
          sequencerAuthoritative: true,
        },
      };
    }
    // `uninitialized` / `seeded`: legacy pointers remain authoritative (D12).
  }

  return {
    kind: 'ok',
    value: {
      activeVersion: await storage.getActiveVersion(season),
      previousVersion: null,
      sequencerAuthoritative: false,
    },
  };
}

async function servePropagationFallback(
  request: Request,
  storage: SnapshotStorage,
  season: number,
  previousVersion: string,
  match: PublicRouteMatch,
  requestId: string,
): Promise<PublicRouteResult | null> {
  const previousInventory = await readStoredInventory(
    storage,
    season,
    previousVersion,
  );
  if (
    previousInventory.kind !== 'documents' ||
    !previousInventory.documents.includes(match.documentName)
  ) {
    return null;
  }
  const snapshot = await storage.readVersionedDocument(
    season,
    previousVersion,
    match.documentName,
  );
  if (!snapshot) return null;
  return serveFallbackSnapshot(request, snapshot, match, requestId);
}

/**
 * Serves a propagation fallback, and never as an ordinary snapshot.
 *
 * The document is the *previous* version's, served only because the active
 * one has not become readable yet - a window the publication's single cache
 * purge has already passed through. Giving it the category's normal lifetime
 * would let an edge hold the superseded body for up to an hour after the active
 * document appears, which is exactly the bound this fallback exists to keep.
 *
 * So it carries `Cache-Control: no-store` and no `CDN-Cache-Control`, and it
 * emits no validator at all: a reusable `ETag` here would let a client's
 * `If-None-Match` turn the next request into a `304` that keeps the historical
 * body current beyond this response. The body, the public envelope, the request
 * id and HEAD semantics are exactly the normal path's.
 */
function serveFallbackSnapshot(
  request: Request,
  snapshot: StoredSnapshot,
  match: PublicRouteMatch,
  requestId: string,
): PublicRouteResult {
  const meta = withRequestId(snapshot.meta, requestId);
  const response = successResponse(snapshot.data, meta, {
    'Cache-Control': 'no-store',
    'Last-Modified': new Date(snapshot.meta.sourceUpdatedAt).toUTCString(),
  });
  return {
    response: responseForMethod(request, response),
    routeTemplate: match.routeTemplate,
    cacheOutcome: 'miss',
  };
}

function serveSnapshot(
  request: Request,
  snapshot: StoredSnapshot,
  match: PublicRouteMatch,
  requestId: string,
  publicationVersion: string,
): PublicRouteResult {
  const headers = snapshotCacheHeaders(
    snapshot,
    snapshot.resourceIdentity,
    match.cacheCategory,
    publicationVersion,
  );
  const etag = headers['ETag'] ?? '';
  if (ifNoneMatchMatches(request.headers.get('If-None-Match'), etag)) {
    return {
      response: new Response(null, {
        status: 304,
        headers: { ...headers, 'X-Request-ID': requestId },
      }),
      routeTemplate: match.routeTemplate,
      cacheOutcome: 'not-modified',
    };
  }
  const meta = withRequestId(snapshot.meta, requestId);
  const response = successResponse(snapshot.data, meta, headers);
  return {
    response: responseForMethod(request, response),
    routeTemplate: match.routeTemplate,
    cacheOutcome: 'hit',
  };
}

function missingResponse(match: PublicRouteMatch, requestId: string): Response {
  const code = detailDocument(match.documentName)
    ? 'RESOURCE_NOT_FOUND'
    : 'SNAPSHOT_NOT_READY';
  return publicError(
    code === 'RESOURCE_NOT_FOUND' ? 404 : 503,
    code,
    requestId,
    code !== 'RESOURCE_NOT_FOUND',
  );
}

function result(
  response: Response,
  routeTemplate: string,
  cacheOutcome: PublicRouteResult['cacheOutcome'],
): PublicRouteResult {
  return { response, routeTemplate, cacheOutcome };
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

function detailDocument(documentName: SnapshotDocumentName): boolean {
  return (
    documentName.startsWith('grand-prix:') ||
    documentName.startsWith('driver:') ||
    documentName.startsWith('constructor:') ||
    documentName.startsWith('circuit:')
  );
}
