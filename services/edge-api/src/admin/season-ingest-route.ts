/**
 * The operator route for the guarded staging ingest of one reviewed season
 * batch (`src/ingest/service.ts`).
 *
 * ```
 * POST /internal/admin/season/ingest
 * ```
 *
 * It sits under `/internal/admin/`, so `handleAdminRequest` has already
 * enforced `ADMIN_TOKEN`. It is not in the public OpenAPI document. The season
 * comes from the validated body and must be the one `SEASON_BATCH_INGEST`
 * names - never `meta:current-season`.
 *
 * | Status | Meaning |
 * |---|---|
 * | 200 | Published: the guarded publication committed (`applied`). |
 * | 409 | Refused at admission, or the guarded publication did not commit. |
 * | 400 | The body is not a submission, or names another season. |
 * | 413 | The body is over the bound; it was not read past it. |
 * | 422 | The batch failed verification. Nothing was written. |
 *
 * Every response is `{ data: <outcome>, requestId }` with
 * `Cache-Control: no-store`. The outcome carries closed reasons, versions,
 * digests, counts and round numbers only.
 */

import { jsonResponse } from '../http/envelope';
import type {
  SeasonBatchIngest,
  SeasonBatchIngestOutcome,
} from '../ingest/service';
import { decodeSubmission, readBoundedJson } from '../ingest/submission';

export const seasonIngestPath = '/internal/admin/season/ingest';

export async function handleSeasonIngestRequest(
  request: Request,
  ingest: SeasonBatchIngest,
  requestId: string,
): Promise<Response> {
  if (request.method !== 'POST') {
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
      { ...noStore(), Allow: 'POST' },
    );
  }

  // Admission reads configuration and bundled content only: a disabled or
  // ineligible Worker never reads, parses or hashes the body.
  const admitted = ingest.admit();
  if (typeof admitted === 'string') {
    return respond(ingest.refused('admission', admitted), requestId);
  }

  const body = await readBoundedJson(request);
  if (!body.ok) {
    return respond(
      ingest.refused(
        'request',
        body.reason === 'oversized'
          ? 'submission-oversized'
          : 'submission-malformed',
      ),
      requestId,
    );
  }
  const submission = decodeSubmission(body.value);
  if (submission === null) {
    return respond(
      ingest.refused('request', 'submission-malformed'),
      requestId,
    );
  }
  return respond(await ingest.ingest(admitted, submission), requestId);
}

function statusFor(outcome: SeasonBatchIngestOutcome): number {
  if (outcome.outcome === 'publication') {
    return outcome.publication.status === 'applied' ? 200 : 409;
  }
  switch (outcome.stage) {
    case 'admission':
      return 409;
    case 'request':
      return outcome.reason === 'submission-oversized' ? 413 : 400;
    case 'verification':
      return 422;
  }
}

function respond(outcome: SeasonBatchIngestOutcome, requestId: string) {
  return jsonResponse(
    { data: outcome, requestId },
    statusFor(outcome),
    requestId,
    noStore(),
  );
}

function noStore(): Record<string, string> {
  return { 'Cache-Control': 'no-store' };
}
