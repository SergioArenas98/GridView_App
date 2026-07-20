import type { BaseMeta, ErrorCode } from '../contract/types';

export const API_VERSION = '1';

export type JsonHeaders = Record<string, string>;

/** Wraps `data` in a GridView success envelope. */
export function successResponse(
  data: unknown,
  meta: BaseMeta,
  headers: JsonHeaders = {},
  status = 200,
): Response {
  return jsonResponse({ data, meta }, status, meta.requestId, headers);
}

/** Wraps an error in the GridView error envelope. */
export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  retryable: boolean,
  requestId: string,
  headers: JsonHeaders = {},
): Response {
  return jsonResponse(
    { error: { code, message, retryable, requestId } },
    status,
    requestId,
    {
      'Cache-Control': 'no-store',
      ...headers,
    },
  );
}

/** JSON response helper for public and internal non-public responses. */
export function jsonResponse(
  body: unknown,
  status: number,
  requestId: string,
  headers: JsonHeaders = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Request-ID': requestId,
      ...headers,
    },
  });
}
