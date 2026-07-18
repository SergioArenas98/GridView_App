import { resolveEnvironment, type Env } from '../config/environment';
import { API_VERSION, successResponse } from '../http/envelope';

/**
 * `GET /v1/status` - service health and metadata.
 *
 * Snapshot-related fields stay `null` until KV snapshot storage exists
 * (Phase 5). This endpoint never calls the data provider.
 */
export function handleStatus(env: Env, requestId: string): Response {
  const data = {
    status: 'ok',
    service: 'gridview-edge-api',
    environment: resolveEnvironment(env.ENVIRONMENT),
    apiVersion: API_VERSION,
    currentSeason: null,
    lastSuccessfulSyncAt: null,
    snapshotAgeSeconds: null,
    maintenance: false,
  };
  return successResponse(data, requestId, {
    'Cache-Control': 'public, max-age=60',
  });
}
