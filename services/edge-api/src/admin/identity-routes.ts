import type { Env } from '../config/environment';
import { identityClientFor } from '../identity/factory';
import { isHash, integer } from '../identity/wire-decoders';
import { within } from '../identity/discovery/persist';
export const isIdentityPath = (path: string): boolean =>
  path === '/internal/admin/identity' ||
  path.startsWith('/internal/admin/identity/');
/** Called only after existing admin authentication; no mutations are forwarded. */
export async function handleIdentityRead(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  const reply = (data: unknown, status = 200) =>
    Response.json(data, {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    });
  const fail = (status: number, code: string) =>
    reply(
      {
        error: {
          code,
          message: 'Identity discovery request unavailable.',
          requestId,
        },
      },
      status,
    );
  if (env.IDENTITY_ADMIN_MODE !== 'read-only') return fail(404, 'NOT_FOUND');
  if (request.method !== 'GET') return fail(405, 'METHOD_NOT_ALLOWED');
  try {
    const client = identityClientFor(env);
    if (!client) return fail(503, 'IDENTITY_UNAVAILABLE');
    const url = new URL(request.url);
    const parts = url.pathname
      .slice('/internal/admin/identity/'.length)
      .split('/');
    const allowed =
      parts[0] === 'health'
        ? []
        : parts.length === 1
          ? ['cursor', 'limit', 'unread']
          : ['cursor', 'limit'];
    const keys = [...url.searchParams.keys()];
    if (
      keys.some((k) => !allowed.includes(k)) ||
      new Set(keys).size !== keys.length
    )
      return fail(400, 'INVALID_REQUEST');
    const cursor = url.searchParams.get('cursor');
    if (cursor !== null && !isHash(cursor)) return fail(400, 'INVALID_REQUEST');
    let result: unknown;
    if (parts[0] === 'health' && parts.length === 1)
      result = await within(client.health(), 2000);
    else if (parts[0] === 'candidates' && parts.length === 1) {
      const raw = url.searchParams.get('limit') ?? '50';
      const limit = Number(raw),
        unread = url.searchParams.get('unread') ?? 'false';
      if (
        !/^[1-9][0-9]*$/.test(raw) ||
        !integer(limit, 1, 100) ||
        !['true', 'false'].includes(unread)
      )
        return fail(400, 'INVALID_REQUEST');
      result = await within(
        client.list({
          cursor: cursor as never,
          limit,
          unread: unread === 'true',
        }),
        2000,
      );
    } else if (
      parts[0] === 'candidates' &&
      (parts.length === 2 || parts.length === 3) &&
      isHash(parts[1])
    ) {
      const raw = url.searchParams.get('limit') ?? '16',
        limit = Number(raw),
        section = parts[2] ?? 'candidate';
      if (
        !/^[1-9][0-9]*$/.test(raw) ||
        !integer(limit, 1, 16) ||
        !['candidate', 'evidence', 'observations'].includes(section)
      )
        return fail(400, 'INVALID_REQUEST');
      result = await within(
        client.inspect({
          candidateId: parts[1],
          section: section as 'candidate' | 'evidence' | 'observations',
          cursor: cursor as never,
          limit,
        }),
        2000,
      );
    } else return fail(404, 'NOT_FOUND');
    return reply({ data: result, requestId, replayed: false });
  } catch {
    return fail(503, 'IDENTITY_UNAVAILABLE');
  }
}
