import { describe, expect, it } from 'vitest';

import worker, { type Env } from '../src/index';

const env: Env = { ENVIRONMENT: 'development' };

function request(path: string, method = 'GET'): Request {
  return new Request(`https://api.gridview.test${path}`, { method });
}

describe('GET /v1/status', () => {
  it('returns the success envelope with service metadata', async () => {
    const response = await worker.fetch(request('/v1/status'), env);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');

    const body = (await response.json()) as {
      data: Record<string, unknown>;
      meta: Record<string, unknown>;
    };
    expect(body.data['status']).toBe('ok');
    expect(body.data['service']).toBe('gridview-edge-api');
    expect(body.data['environment']).toBe('development');
    expect(body.data['currentSeason']).toBeNull();
    expect(body.meta['apiVersion']).toBe('1');
    expect(body.meta['requestId']).toBeTypeOf('string');
    expect(response.headers.get('X-Request-Id')).toBe(body.meta['requestId']);
  });

  it('supports HEAD with headers and no body', async () => {
    const response = await worker.fetch(request('/v1/status', 'HEAD'), env);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.text()).toBe('');
  });
});

describe('routing', () => {
  it('returns the error envelope for unknown paths', async () => {
    const response = await worker.fetch(request('/v1/unknown'), env);

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: Record<string, unknown> };
    expect(body.error['code']).toBe('RESOURCE_NOT_FOUND');
    expect(body.error['retryable']).toBe(false);
    expect(body.error['requestId']).toBeTypeOf('string');
  });

  it('rejects non-GET/HEAD methods with 405 and an Allow header', async () => {
    const response = await worker.fetch(request('/v1/status', 'POST'), env);

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
    const body = (await response.json()) as { error: Record<string, unknown> };
    expect(body.error['code']).toBe('METHOD_NOT_ALLOWED');
  });
});
