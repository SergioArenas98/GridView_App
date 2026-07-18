// A fixture-backed test router. It serves stored fixtures for a handful of
// representative routes so the contract tests can exercise envelopes, cache
// headers and HEAD behaviour without a production router or provider.

import { errorResponse } from '../../src/http/envelope';

import calendar from '../fixtures/api/v1/calendar/2026.json';
import grandPrix from '../fixtures/api/v1/grand-prix/sprint-weekend.json';
import driverStandings from '../fixtures/api/v1/standings/drivers-fractional.json';
import statusOk from '../fixtures/api/v1/status/ok.json';

interface Route {
  body: unknown;
  cacheControl: string;
}

const routes: Record<string, Route> = {
  'GET /v1/status': { body: statusOk, cacheControl: 'public, max-age=60' },
  'GET /v1/seasons/2026/calendar': {
    body: calendar,
    cacheControl: 'public, max-age=1800',
  },
  'GET /v1/seasons/2026/grand-prix/13': {
    body: grandPrix,
    cacheControl: 'public, max-age=3600',
  },
  'GET /v1/seasons/2026/standings/drivers': {
    body: driverStandings,
    cacheControl: 'public, max-age=300',
  },
};

/** Routes a request to a stored fixture, mirroring the real Worker's contract. */
export function fixtureRouter(request: Request): Response {
  const requestId = 'test-request-id';
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

  const route = routes[`GET ${url.pathname}`];
  if (!route) {
    return errorResponse(
      404,
      'RESOURCE_NOT_FOUND',
      'The requested resource does not exist.',
      false,
      requestId,
    );
  }

  const response = new Response(JSON.stringify(route.body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': route.cacheControl,
      'X-Request-Id': requestId,
    },
  });

  if (isHead) {
    return new Response(null, {
      status: response.status,
      headers: response.headers,
    });
  }
  return response;
}
