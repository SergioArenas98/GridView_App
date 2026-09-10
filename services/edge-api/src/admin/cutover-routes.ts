/**
 * The authenticated internal operator surface for staging cutover preparation
 * ([ADR 0025](../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D12).
 *
 * ```
 * GET  /internal/admin/publication/cutover/status?season=YYYY
 * POST /internal/admin/publication/cutover/seed
 * POST /internal/admin/publication/cutover/activate
 * ```
 *
 * All three sit under `/internal/admin/`, so `handleAdminRequest` has already
 * enforced `ADMIN_TOKEN` before any of them is reached, and every response
 * carries `Cache-Control: no-store` through the same `jsonResponse` helper the
 * rest of the admin router uses.
 *
 * **None of them is in the public OpenAPI document.** They are internal
 * operator controls, exactly like `/internal/admin/rollback`, and the public
 * contract gains no field from this slice.
 *
 * ## What crosses the boundary
 *
 * Every body is decoded and validated at runtime before use, against the closed
 * checkpoint and evidence shapes. Unknown extra fields are ignored, which is
 * safe here for one specific reason: **no confirmation or precondition is
 * expressed by an absent field.** The activation confirmation must be the
 * literal `true`, so an ignored unknown field can never supply it, and the
 * historical-floor evidence is a closed union with a required reference, so an
 * ignored field can never weaken it either.
 *
 * Responses carry a bounded refusal or a safe operator receipt: the season, the
 * versions, the ordering baseline, the high-water mark and the fingerprint.
 * They never carry an operation token, a secret, a storage key, a document
 * payload or unrestricted Durable Object state.
 */

import { jsonResponse } from '../http/envelope';
import type { CutoverPreparationService } from '../publication/cutover/service';
import { decodeCutoverCheckpoint } from '../publication/cutover/checkpoint';

export const cutoverStatusPath = '/internal/admin/publication/cutover/status';
export const cutoverSeedPath = '/internal/admin/publication/cutover/seed';
export const cutoverActivatePath =
  '/internal/admin/publication/cutover/activate';

export function isCutoverPath(pathname: string): boolean {
  return (
    pathname === cutoverStatusPath ||
    pathname === cutoverSeedPath ||
    pathname === cutoverActivatePath
  );
}

/**
 * Routes one already-authenticated cutover request.
 *
 * The season comes from the query string for `status` and from the validated
 * body for the two mutating operations - never from `meta:current-season`. A
 * cutover names its season explicitly, and inferring one from stored state
 * would let a mistyped request act on a season the operator did not name.
 */
export async function handleCutoverRequest(
  request: Request,
  url: URL,
  service: CutoverPreparationService,
  requestId: string,
): Promise<Response> {
  if (url.pathname === cutoverStatusPath) {
    if (request.method !== 'GET') {
      return methodNotAllowed(requestId, 'GET');
    }
    const season = seasonFromQuery(url);
    if (season === null) return invalid(requestId, 'invalid-season');
    return ok(await service.status(season), requestId);
  }

  if (request.method !== 'POST') {
    return methodNotAllowed(requestId, 'POST');
  }

  const body = await readJsonObject(request);
  if (body === null) return invalid(requestId, 'malformed-body');

  if (url.pathname === cutoverSeedPath) {
    const checkpoint = decodeCutoverCheckpoint(body.checkpoint);
    if (checkpoint === null) return invalid(requestId, 'invalid-checkpoint');
    const result = await service.seed(checkpoint);
    return ok(result, requestId, result.kind === 'seeded' ? 200 : 409);
  }

  const checkpoint = decodeCutoverCheckpoint(body.checkpoint);
  if (checkpoint === null) return invalid(requestId, 'invalid-checkpoint');
  // The confirmation must be the literal `true`. A truthy string, a `1` or an
  // absent field is not an explicit operator confirmation, and D12 requires an
  // explicit one.
  const confirmed = body.confirmActivation === true;
  const result = await service.activate(checkpoint, confirmed);
  return ok(result, requestId, result.kind === 'activated' ? 200 : 409);
}

function seasonFromQuery(url: URL): number | null {
  const raw = url.searchParams.get('season');
  if (raw === null || !/^\d{4}$/.test(raw)) return null;
  return Number(raw);
}

/**
 * The request body as an object, or `null`.
 *
 * A malformed body is `null` rather than `{}`: the admin router's general
 * `readJson` treats unparseable JSON as an empty object, which is right for a
 * request whose fields are all optional and wrong for one that must carry an
 * explicit confirmation.
 */
async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}

function ok(data: unknown, requestId: string, status = 200): Response {
  return jsonResponse({ data, requestId }, status, requestId, noStore());
}

function invalid(requestId: string, reason: string): Response {
  return jsonResponse(
    {
      error: {
        code: 'INVALID_PARAMETER',
        // A bounded reason code, never an echo of what the caller sent.
        message: reason,
        requestId,
      },
    },
    400,
    requestId,
    noStore(),
  );
}

function methodNotAllowed(requestId: string, allow: string): Response {
  return jsonResponse(
    {
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'The requested method is not allowed.',
        requestId,
      },
    },
    405,
    requestId,
    { ...noStore(), Allow: allow },
  );
}

function noStore(): Record<string, string> {
  return { 'Cache-Control': 'no-store' };
}
