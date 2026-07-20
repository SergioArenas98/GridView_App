import { describe, expect, it } from 'vitest';

import worker from '../../src/index';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import {
  adminRequest,
  createHarness,
  request,
  seedPublishedSnapshot,
} from '../support/edge-harness';

describe('HTTP caching', () => {
  it('uses stable weak ETags even though request IDs change', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);

    const first = await worker.fetch(
      request('/v1/seasons/2026/calendar'),
      harness.env,
    );
    const second = await worker.fetch(
      request('/v1/seasons/2026/calendar'),
      harness.env,
    );
    const firstBody = (await first.json()) as { meta: { requestId: string } };
    const secondBody = (await second.json()) as { meta: { requestId: string } };

    expect(first.headers.get('ETag')).toMatch(/^W\/"gv1-/);
    expect(second.headers.get('ETag')).toBe(first.headers.get('ETag'));
    expect(secondBody.meta.requestId).not.toBe(firstBody.meta.requestId);
  });

  it('returns 304 with no body for a matching If-None-Match', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const first = await worker.fetch(
      request('/v1/home?season=2026'),
      harness.env,
    );
    const etag = first.headers.get('ETag') ?? '';

    const response = await worker.fetch(
      request('/v1/home?season=2026', 'GET', {
        headers: { 'If-None-Match': etag },
      }),
      harness.env,
    );

    expect(response.status).toBe(304);
    expect(response.headers.get('X-Request-ID')).toBeTypeOf('string');
    expect(await response.text()).toBe('');
  });

  it('returns 200 for a non-matching If-None-Match and keeps HEAD cache parity', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);

    const get = await worker.fetch(
      request('/v1/seasons/2026/standings/drivers', 'GET', {
        headers: { 'If-None-Match': 'W/"gv1-nope"' },
      }),
      harness.env,
    );
    const head = await worker.fetch(
      request('/v1/seasons/2026/standings/drivers', 'HEAD'),
      harness.env,
    );

    expect(get.status).toBe(200);
    expect(head.headers.get('ETag')).toBe(get.headers.get('ETag'));
    expect(head.headers.get('Last-Modified')).toBe(
      get.headers.get('Last-Modified'),
    );
    expect(await head.text()).toBe('');
  });

  it('changes the ETag after immutable contentVersion changes', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const before = await worker.fetch(
      request('/v1/content/manifest'),
      harness.env,
    );

    const nextProvider = new MockFormulaOneProvider({
      clock: harness.clock,
      sourceUpdatedAt: '2026-07-18T12:10:00.000Z',
      contentVersion: '2026.07.18.2',
    });
    const next = createHarness({ provider: nextProvider });
    next.env.__LOCAL_STORAGE = harness.storage;
    const sync = await worker.fetch(
      adminRequest('/internal/admin/sync/full'),
      next.env,
    );
    expect(sync.status).toBe(200);

    const after = await worker.fetch(request('/v1/content/manifest'), next.env);
    expect(after.headers.get('ETag')).not.toBe(before.headers.get('ETag'));
  });

  it('does not apply long-lived public cache settings to errors', async () => {
    const harness = createHarness();
    const response = await worker.fetch(
      request('/v1/seasons/2026/calendar'),
      harness.env,
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
