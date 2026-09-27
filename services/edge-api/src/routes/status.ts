import { resolveEnvironment, type Env } from '../config/environment';
import type { BaseMeta } from '../contract/types';
import { API_VERSION, successResponse } from '../http/envelope';
import { ifNoneMatchMatches, statusCacheHeaders } from '../http/cache';
import {
  legacyPublicationAuthority,
  type PublicationAuthority,
} from '../publication/authority';
import type { SeasonAuthority } from '../publication/sequencer/model';
import type { Clock } from '../runtime/clock';
import { secondsBetween } from '../runtime/clock';
import type { SnapshotStorage } from '../storage/types';

/**
 * `GET /v1/status` - service health and metadata.
 *
 * This endpoint reads only local/KV metadata and the season's publication
 * authority. It never calls the provider and never triggers synchronization.
 *
 * The active version is resolved the way the public router resolves it
 * (ADR 0025 D6). A season the sequencer holds `active` is read from the
 * sequencer, because sequenced publication never moves the legacy
 * `active:{season}` pointer. Every other season, and every season under the
 * legacy authority, reads that pointer as before. An unreachable or
 * `unavailable` sequencer yields no active version, never the legacy pointer,
 * and the endpoint still answers: health does not depend on the authority.
 */
export async function handleStatus(
  request: Request,
  env: Env,
  storage: SnapshotStorage,
  clock: Clock,
  requestId: string,
  authority: PublicationAuthority = legacyPublicationAuthority,
): Promise<Response> {
  const currentSeason = await storage.getCurrentSeason();
  const resolved =
    currentSeason === null
      ? noActiveVersion
      : await resolveActiveVersion(storage, authority, currentSeason);
  const activeVersion = resolved.kind === 'version' ? resolved.version : null;
  const syncState =
    currentSeason === null ? null : await storage.getSyncState(currentSeason);
  const activeSeason =
    currentSeason === null || activeVersion === null
      ? null
      : await storage.readVersionedDocument(
          currentSeason,
          activeVersion,
          'season',
        );
  const resourceIdentity = [
    'status',
    currentSeason ?? 'none',
    resolved.kind === 'authority-unavailable'
      ? 'authority-unavailable'
      : (activeVersion ?? 'none'),
    syncState?.lastCompletedAt ?? 'never',
  ].join(':');
  const headers = statusCacheHeaders(resourceIdentity);
  const etag = headers['ETag'] ?? '';
  if (ifNoneMatchMatches(request.headers.get('If-None-Match'), etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        ...headers,
        'X-Request-ID': requestId,
      },
    });
  }
  const data = {
    status: 'ok',
    service: 'gridview-edge-api',
    environment: resolveEnvironment(env.ENVIRONMENT),
    apiVersion: API_VERSION,
    currentSeason,
    lastSuccessfulSyncAt: syncState?.lastCompletedAt ?? null,
    snapshotAgeSeconds: activeSeason
      ? secondsBetween(activeSeason.meta.sourceUpdatedAt, clock.now())
      : null,
    maintenance: false,
  };
  const meta: BaseMeta = {
    apiVersion: API_VERSION,
    generatedAt: clock.now().toISOString(),
    requestId,
  };
  const response = successResponse(data, meta, headers);
  if (request.method === 'HEAD') {
    return new Response(null, {
      status: response.status,
      headers: response.headers,
    });
  }
  return response;
}

type ActiveVersionRead =
  | { readonly kind: 'version'; readonly version: string | null }
  | { readonly kind: 'authority-unavailable' };

const noActiveVersion: ActiveVersionRead = { kind: 'version', version: null };
const authorityUnavailable: ActiveVersionRead = {
  kind: 'authority-unavailable',
};

async function resolveActiveVersion(
  storage: SnapshotStorage,
  authority: PublicationAuthority,
  season: number,
): Promise<ActiveVersionRead> {
  if (authority.mode === 'sequencer-unavailable') return authorityUnavailable;
  if (authority.mode === 'sequencer') {
    let read: SeasonAuthority;
    try {
      read = await authority.port.readAuthority(season);
    } catch {
      return authorityUnavailable;
    }
    if (read.cutoverState === 'unavailable') return authorityUnavailable;
    if (read.cutoverState === 'active') {
      return { kind: 'version', version: read.activeVersion };
    }
    // `uninitialized` / `seeded`: the legacy pointer remains authoritative.
  }
  return { kind: 'version', version: await storage.getActiveVersion(season) };
}
