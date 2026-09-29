/**
 * The read-only operator route for the A3.5 staging predecessor gate
 * ([ADR 0023](../../../../docs/adr/0023-multi-source-provider-coordination.md)
 * A3.5 item 2).
 *
 * ```
 * GET /internal/admin/publication/standings-predecessor?season=YYYY
 * ```
 *
 * It sits under `/internal/admin/`, so `handleAdminRequest` has already
 * enforced `ADMIN_TOKEN`. It is not in the public OpenAPI document. It reads
 * the sequencer's answer and the active release's immutable documents, and
 * writes nothing: no pointer, no ledger, no sequencer record, no cache purge.
 *
 * The season comes from the query string only, never from
 * `meta:current-season`: the operator names the season the gate is for.
 * `200` is a coherent predecessor; `409` is a bounded refusal. Neither carries
 * a row, an identity or a document body, and the one log line carries only the
 * season, the version and the closed reason.
 */

import { jsonResponse } from '../http/envelope';
import type { Logger } from '../logging/logger';
import type { PublicationAuthority } from '../publication/authority';
import { checkStandingsPredecessor } from '../publication/guard/standings-predecessor';
import type { SnapshotStorage } from '../storage/types';

export const standingsPredecessorPath =
  '/internal/admin/publication/standings-predecessor';

export interface StandingsPredecessorContext {
  readonly authority: PublicationAuthority;
  readonly storage: SnapshotStorage;
  readonly logger: Logger;
  readonly requestId: string;
}

export async function handleStandingsPredecessorRequest(
  request: Request,
  url: URL,
  context: StandingsPredecessorContext,
): Promise<Response> {
  const { requestId } = context;
  if (request.method !== 'GET') {
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
      { ...noStore(), Allow: 'GET' },
    );
  }

  const raw = url.searchParams.get('season');
  if (raw === null || !/^\d{4}$/.test(raw)) {
    return jsonResponse(
      {
        error: {
          code: 'INVALID_PARAMETER',
          message: 'invalid-season',
          requestId,
        },
      },
      400,
      requestId,
      noStore(),
    );
  }
  const season = Number(raw);

  const check = await checkStandingsPredecessor(
    context.authority,
    context.storage,
    season,
  );
  if (check.kind === 'coherent') {
    context.logger.info({
      operation: 'publication.standings-predecessor',
      requestId,
      season,
      releaseVersion: check.activeVersion,
    });
  } else {
    context.logger.warn({
      operation: 'publication.standings-predecessor',
      requestId,
      season,
      failureCategory: check.reason,
    });
  }
  return jsonResponse(
    { data: check, requestId },
    check.kind === 'coherent' ? 200 : 409,
    requestId,
    noStore(),
  );
}

function noStore(): Record<string, string> {
  return { 'Cache-Control': 'no-store' };
}
