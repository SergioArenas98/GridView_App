import { describe, expect, it } from 'vitest';

import { fixtureRouter } from '../support/fixture-router';
import { validateSuccessEnvelope } from '../../src/contract/validation';

function request(path: string, method = 'GET'): Request {
  return new Request(`https://api.gridview.test${path}`, { method });
}

describe('fixture-backed router', () => {
  it('serves a season-scoped collection with a valid envelope and cache headers', async () => {
    const response = fixtureRouter(request('/v1/seasons/2026/calendar'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=1800');
    const body = await response.json();
    expect(validateSuccessEnvelope(body, 'SeasonSnapshotMeta')).toEqual([]);
    expect(Array.isArray((body as { data: unknown }).data)).toBe(true);
  });

  it('serves status with BaseMeta', async () => {
    const response = fixtureRouter(request('/v1/status'));
    const body = await response.json();
    expect(validateSuccessEnvelope(body, 'BaseMeta')).toEqual([]);
  });

  it('supports HEAD with headers and no body', async () => {
    const response = fixtureRouter(
      request('/v1/seasons/2026/standings/drivers', 'HEAD'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(await response.text()).toBe('');
  });

  it('returns a RESOURCE_NOT_FOUND error envelope for an unknown route', async () => {
    const response = fixtureRouter(request('/v1/does-not-exist'));
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('rejects non-GET/HEAD methods with 405', async () => {
    const response = fixtureRouter(request('/v1/status', 'POST'));
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
  });
});
