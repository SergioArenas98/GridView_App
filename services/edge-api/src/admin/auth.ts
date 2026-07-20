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

function timingSafeEqual(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
