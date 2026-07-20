import { resolveEnvironment, type Env } from '../config/environment';
import type { BaseMeta } from '../contract/types';
import { API_VERSION, successResponse } from '../http/envelope';
import { ifNoneMatchMatches, statusCacheHeaders } from '../http/cache';
import type { Clock } from '../runtime/clock';
import { secondsBetween } from '../runtime/clock';
import type { SnapshotStorage } from '../storage/types';

/**
 * `GET /v1/status` - service health and metadata.
 *
 * This endpoint reads only local/KV metadata. It never calls the provider and
 * never triggers synchronization.
 */
export async function handleStatus(
  request: Request,
  env: Env,
  storage: SnapshotStorage,
  clock: Clock,
  requestId: string,
): Promise<Response> {
  const currentSeason = await storage.getCurrentSeason();
  const activeVersion =
    currentSeason === null
      ? null
      : await storage.getActiveVersion(currentSeason);
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
    activeVersion ?? 'none',
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
