export const API_VERSION = '1';

/**
 * Error codes exposed by the public API. The canonical list is finalized
 * with the OpenAPI contract in Phase 2; the scaffold uses the subset it
 * needs (see docs/technical/GridView_Backend_Scheme.md section 12).
 */
export type ErrorCode =
  | 'INVALID_PARAMETER'
  | 'RESOURCE_NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_ERROR';

export interface ResponseMeta {
  readonly apiVersion: string;
  readonly generatedAt: string;
  readonly requestId: string;
}

/** Wraps `data` in the GridView success envelope. */
export function successResponse(
  data: unknown,
  requestId: string,
  headers: Record<string, string> = {},
): Response {
  const meta: ResponseMeta = {
    apiVersion: API_VERSION,
    generatedAt: new Date().toISOString(),
    requestId,
  };
  return jsonResponse({ data, meta }, 200, requestId, headers);
}

/** Wraps an error in the GridView error envelope. */
export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  retryable: boolean,
  requestId: string,
  headers: Record<string, string> = {},
): Response {
  return jsonResponse(
    { error: { code, message, retryable, requestId } },
    status,
    requestId,
    headers,
  );
}

function jsonResponse(
  body: unknown,
  status: number,
  requestId: string,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Request-Id': requestId,
      ...headers,
    },
  });
}
