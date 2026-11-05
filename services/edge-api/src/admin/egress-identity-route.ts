/**
 * The staging-only operator route for the one-request Jolpica egress identity
 * probe (Cloudflare-to-Jolpica 429 investigation, 2026-11-05).
 *
 * ```
 * POST /internal/admin/provider/jolpica/egress-identity
 * ```
 *
 * It sits under `/internal/admin/`, so `handleAdminRequest` has already
 * enforced `ADMIN_TOKEN`. It is not in the public OpenAPI document. Each call
 * sends at most one `GET https://api.jolpi.ca/test/`, composed through the
 * coordinated runtime's own gate exactly as an operator verification composes
 * its one request: the limiter object's upstream hold defers it (nothing is
 * sent), and a `429` is reported and held like any other. It writes no ledger,
 * release, pointer or cache, and its answer and single log line carry only
 * closed facts (`sync/coordinated/egress-identity.ts`).
 *
 * Refused with `404`, before anything is composed, outside staging or when
 * the Worker is not in `coordinated` mode.
 */

import { jsonResponse } from '../http/envelope';
import type { Logger } from '../logging/logger';
import type { CoordinatedRuntimeDependencies } from '../sync/coordinated/composition';
import { probeEgressIdentityUnderComposition } from '../sync/coordinated/egress-identity';

export const egressIdentityPath =
  '/internal/admin/provider/jolpica/egress-identity';

export interface EgressIdentityContext {
  /** `ENVIRONMENT` as configured; only `staging` is served. */
  readonly environment: string | undefined;
  readonly coordinated: boolean;
  /** The coordinated runtime's gated dependencies; resolving them built nothing. */
  readonly dependencies: CoordinatedRuntimeDependencies;
  readonly logger: Logger;
  readonly requestId: string;
}

function noStore(): Record<string, string> {
  return { 'Cache-Control': 'no-store' };
}

function refusal(
  status: number,
  code: string,
  message: string,
  requestId: string,
  headers: Record<string, string> = {},
): Response {
  return jsonResponse(
    { error: { code, message, requestId } },
    status,
    requestId,
    {
      ...noStore(),
      ...headers,
    },
  );
}

export async function handleEgressIdentityRequest(
  request: Request,
  context: EgressIdentityContext,
): Promise<Response> {
  const { requestId } = context;
  if (request.method !== 'POST') {
    return refusal(
      405,
      'METHOD_NOT_ALLOWED',
      'The requested method is not allowed.',
      requestId,
      { Allow: 'POST' },
    );
  }
  if (context.environment !== 'staging' || !context.coordinated) {
    return refusal(404, 'NOT_FOUND', 'Not found.', requestId);
  }

  const result = await probeEgressIdentityUnderComposition(
    context.dependencies,
  );

  context.logger.info({
    operation: 'provider.egress_identity',
    providerSourceId: 'jolpica',
    coordinationOutcome: result.outcome,
    ...(result.outcome === 'observed'
      ? {
          providerEgressAddressClass: result.remoteAddress.class,
          providerEgressForwardedHops: result.forwardedFor.hops,
          providerEgressFresh: result.fresh,
          providerCacheStatus: result.cacheStatus,
        }
      : {}),
  });

  return jsonResponse(
    { data: result, requestId },
    result.outcome === 'coordinated-runtime-unavailable' ? 503 : 200,
    requestId,
    noStore(),
  );
}
