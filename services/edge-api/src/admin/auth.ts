import type { Env } from '../config/environment';
import { jsonResponse } from '../http/envelope';

export function isInternalPath(pathname: string): boolean {
  return pathname.startsWith('/internal/admin/');
}

export function unauthorized(requestId: string): Response {
  return jsonResponse(
    { error: { code: 'UNAUTHORIZED', message: 'Unauthorized', requestId } },
    401,
    requestId,
    { 'Cache-Control': 'no-store' },
  );
}

export function adminAuthOk(request: Request, env: Env): boolean {
  const token = env.ADMIN_TOKEN;
  if (!token) return false;
  const header = request.headers.get('Authorization') ?? '';
  const expected = `Bearer ${token}`;
  return timingSafeEqual(header, expected);
}

/** The shortest scoped token accepted: anything shorter is ignored. */
export const minimumScopedTokenLength = 32;

/**
 * The only requests `SEASON_INGEST_TOKEN` authorizes: reading which release
 * is active, and submitting a season batch to the guarded ingest. Exact
 * method and path; the routes themselves still validate everything else.
 */
export function isSeasonIngestScope(method: string, pathname: string): boolean {
  return (
    (method === 'GET' &&
      pathname === '/internal/admin/publication/cutover/status') ||
    (method === 'POST' && pathname === '/internal/admin/season/ingest')
  );
}

/**
 * Whether the request carries the season-ingest token for a request inside
 * its scope. Staging only: no other environment honours it. A token that is
 * short, or equal to `ADMIN_TOKEN`, is ignored, so it never widens access.
 */
export function seasonIngestAuthOk(request: Request, env: Env): boolean {
  if (env.ENVIRONMENT !== 'staging') return false;
  const token = env.SEASON_INGEST_TOKEN;
  if (!token || token.length < minimumScopedTokenLength) return false;
  if (env.ADMIN_TOKEN && timingSafeEqual(token, env.ADMIN_TOKEN)) return false;
  const { pathname } = new URL(request.url);
  if (!isSeasonIngestScope(request.method, pathname)) return false;
  const header = request.headers.get('Authorization') ?? '';
  return timingSafeEqual(header, `Bearer ${token}`);
}

function timingSafeEqual(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
