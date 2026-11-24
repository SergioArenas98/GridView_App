import { CatalogValidationError } from '../../identity/catalog/model';
import { IdentityError } from '../../identity/port';
export const ordinaryLimit = 256 * 1024;
export const artifactLimit = 2 * 1024 * 1024;
export class AdminError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfter?: number,
  ) {
    super(code);
  }
}
export function errorFor(error: unknown): AdminError {
  if (error instanceof AdminError) return error;
  if (error instanceof IdentityError) {
    const codes = {
      'not-found': [404, 'CANDIDATE_NOT_FOUND'],
      conflict: [409, 'CANDIDATE_STALE'],
      capacity: [503, 'CATALOG_CAPACITY'],
      'installation-mismatch': [409, 'INSTALLATION_MISMATCH'],
      'schema-version': [503, 'CATALOG_SCHEMA_UNSUPPORTED'],
      'invalid-request': [400, 'INVALID_REQUEST'],
      unavailable: [503, 'CATALOG_UNAVAILABLE'],
    } as const;
    const [status, code] = codes[error.code];
    return new AdminError(status, code);
  }
  if (error instanceof CatalogValidationError) {
    const c = error.code;
    if (/capacity|byte-limit/.test(c))
      return new AdminError(503, 'CATALOG_CAPACITY');
    if (/storage-schema|catalog-head-schema/.test(c))
      return new AdminError(503, 'CATALOG_SCHEMA_UNSUPPORTED');
    if (/record-missing|proposal-status/.test(c))
      return new AdminError(404, 'REVISION_NOT_FOUND');
    if (c === 'candidate-missing')
      return new AdminError(404, 'CANDIDATE_NOT_FOUND');
    if (/operation-content-conflict/.test(c))
      return new AdminError(409, 'IDEMPOTENCY_CONFLICT');
    if (/candidate.*(conflict|stale)/.test(c))
      return new AdminError(409, 'CANDIDATE_STALE');
    if (/HEAD_CONFLICT|parent-conflict/.test(c))
      return new AdminError(409, 'CATALOG_HEAD_CONFLICT');
    if (/canonical-id-conflict|UNIQUE.*anchor/.test(c))
      return new AdminError(409, 'CANONICAL_ID_RESERVED');
    if (/binding.*conflict/.test(c))
      return new AdminError(409, 'BINDING_CONFLICT');
    if (c === 'REVISION_ALREADY_ACTIVATED') return new AdminError(409, c);
    if (/certificate|proposal-not-validated|reviewed-evidence/.test(c))
      return new AdminError(422, 'VALIDATION_STALE');
    if (/evidence|dossier|association|duplicate-review|same-name/.test(c))
      return new AdminError(422, 'EVIDENCE_INSUFFICIENT');
    if (/profile/.test(c)) return new AdminError(422, 'PROFILE_INVALID');
    return new AdminError(422, 'CATALOG_INVALID');
  }
  if (
    error instanceof SyntaxError ||
    (error instanceof Error && error.message.startsWith('INVALID_REQUEST:'))
  )
    return new AdminError(400, 'INVALID_REQUEST');
  return new AdminError(503, 'CATALOG_UNAVAILABLE');
}
export function reply(
  value: unknown,
  status = 200,
  extra: Record<string, string> = {},
  cap = ordinaryLimit,
): Response {
  const body = JSON.stringify(value);
  if (new TextEncoder().encode(body).length > cap)
    throw new AdminError(503, 'RESPONSE_TOO_LARGE');
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}
export function failure(error: unknown, requestId: string): Response {
  const e = errorFor(error);
  return reply(
    {
      error: {
        code: e.code,
        message: e.code.replaceAll('_', ' ').toLowerCase() + '.',
        requestId,
      },
    },
    e.status,
    {
      ...(e.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}),
      ...(e.retryAfter ? { 'Retry-After': String(e.retryAfter) } : {}),
    },
  );
}
export async function boundedBody(
  request: Request | Response,
  cap: number,
): Promise<string> {
  const length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > cap))
    throw new AdminError(413, 'BODY_TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > cap) throw new AdminError(413, 'BODY_TOO_LARGE');
      chunks.push(chunk.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
      bytes,
    );
  } catch {
    throw new AdminError(400, 'INVALID_REQUEST');
  }
}
