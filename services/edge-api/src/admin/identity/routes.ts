import type { Env } from '../../config/environment';
import { adminAuthOk } from '../auth';
import { handleIdentityRead } from '../identity-routes';
import { authenticate, configured } from './auth';
import { routeFor, queries } from './requests';
import {
  AdminError,
  artifactLimit,
  ordinaryLimit,
  boundedBody,
  failure,
} from './responses';
import { within } from '../../identity/discovery/persist';

/** Identity dispatch precedes the shared-token gate, which remains mandatory
 * for every other legacy admin operation. No generic admin fallback exists. */
export async function handleIdentityRequest(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  try {
    // Explicit U2 shadow-only compatibility, including its established shapes.
    if (env.IDENTITY_ADMIN_MODE === 'read-only' && adminAuthOk(request, env))
      return handleIdentityRead(request, env, requestId);
    if (adminAuthOk(request, env)) throw new AdminError(401, 'UNAUTHORIZED');
    if (
      env.IDENTITY_ADMIN_MODE === 'read-only' &&
      !env.IDENTITY_REVIEWER_CREDENTIALS
    )
      throw new AdminError(401, 'UNAUTHORIZED');
    if (
      !configured(env) ||
      !env.IDENTITY_CATALOG ||
      typeof env.IDENTITY_CATALOG.idFromName !== 'function' ||
      typeof env.IDENTITY_CATALOG.get !== 'function'
    )
      throw new AdminError(503, 'CATALOG_UNAVAILABLE');
    const principal = await authenticate(request, env);
    if (!principal) throw new AdminError(401, 'UNAUTHORIZED');
    const url = new URL(request.url);
    if (
      url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      )
    )
      throw new AdminError(400, 'HTTPS_REQUIRED');
    const route = routeFor(url.pathname, request.method);
    queries(url, route.operation);
    if (
      route.operation !== 'operations-detail' &&
      !principal.roles.includes(route.role) &&
      !(route.operation === 'abandon' && principal.roles.includes('activator'))
    )
      throw new AdminError(403, 'ROLE_REQUIRED');
    if (request.method === 'POST' && env.IDENTITY_ADMIN_MODE !== 'review')
      throw new AdminError(403, 'IDENTITY_WRITES_DISABLED');
    const body =
      request.method === 'POST'
        ? await boundedBody(
            request,
            ['seed', 'import-base'].includes(route.operation)
              ? artifactLimit
              : ordinaryLimit,
          )
        : undefined;
    const stub = env.IDENTITY_CATALOG.get(
      env.IDENTITY_CATALOG.idFromName(
        'identity:' + env.IDENTITY_INSTALLATION_ID!,
      ),
    );
    const response = await within(
      stub.fetch(request.url, {
        method: request.method,
        body,
        headers: {
          Authorization: request.headers.get('Authorization')!,
          'X-Identity-Request-Id': requestId,
          'Content-Type':
            request.headers.get('Content-Type') ?? 'application/json',
          'Idempotency-Key': request.headers.get('Idempotency-Key') ?? '',
        },
      }),
      10000,
    );
    const content = await boundedBody(response, artifactLimit);
    return new Response(content, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...(response.headers.has('Retry-After')
          ? { 'Retry-After': response.headers.get('Retry-After')! }
          : {}),
        ...(response.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}),
      },
    });
  } catch (error) {
    return failure(error, requestId);
  }
}
