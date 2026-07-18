import type { Env } from './config/environment';
import { errorResponse } from './http/envelope';
import { handleStatus } from './routes/status';

export type { Env };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const isHead = request.method === 'HEAD';

    if (request.method !== 'GET' && !isHead) {
      return errorResponse(
        405,
        'METHOD_NOT_ALLOWED',
        'Only GET and HEAD requests are supported.',
        false,
        requestId,
        { Allow: 'GET, HEAD' },
      );
    }

    const response =
      url.pathname === '/v1/status'
        ? handleStatus(env, requestId)
        : errorResponse(
            404,
            'RESOURCE_NOT_FOUND',
            'The requested resource does not exist.',
            false,
            requestId,
          );

    if (isHead) {
      return new Response(null, {
        status: response.status,
        headers: response.headers,
      });
    }
    return response;
  },
} satisfies ExportedHandler<Env>;
