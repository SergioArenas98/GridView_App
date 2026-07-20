import { describe, expect, it } from 'vitest';

import worker from '../../src/index';
import {
  createHarness,
  request,
  seedPublishedSnapshot,
} from '../support/edge-harness';

const publicRoutes = [
  '/v1/status',
  '/v1/bootstrap?season=2026',
  '/v1/home?season=2026',
  '/v1/seasons/current',
  '/v1/seasons/2026',
  '/v1/seasons/2026/calendar',
  '/v1/seasons/2026/grand-prix/13',
  '/v1/seasons/2026/grand-prix/13/results',
  '/v1/seasons/2026/standings/drivers',
  '/v1/seasons/2026/standings/constructors',
  '/v1/seasons/2026/drivers',
  '/v1/drivers/max-verstappen?season=2026',
  '/v1/seasons/2026/constructors',
  '/v1/constructors/ferrari?season=2026',
  '/v1/seasons/2026/circuits',
  '/v1/circuits/monza?season=2026',
  '/v1/content/manifest',
] as const;

describe('public routes', () => {
  it.each(publicRoutes)('serves GET %s from stored snapshots', async (path) => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const providerCallsAfterSync = harness.provider.callCount;

    const response = await worker.fetch(request(path), harness.env);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Request-ID')).toBeTypeOf('string');
    expect(harness.provider.callCount).toBe(providerCallsAfterSync);
    const body = (await response.json()) as {
      data: unknown;
      meta: { requestId: string; sourceUpdatedAt?: string };
    };
    expect(body.data).toBeDefined();
    expect(body.meta.requestId).toBe(response.headers.get('X-Request-ID'));
    if (path !== '/v1/status') {
      expect(body.meta.sourceUpdatedAt).toBe('2026-07-18T11:55:00.000Z');
    }
  });

  it.each(publicRoutes)('supports HEAD %s with no body', async (path) => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);

    const getResponse = await worker.fetch(request(path), harness.env);
    const headResponse = await worker.fetch(request(path, 'HEAD'), harness.env);

    expect(headResponse.status).toBe(getResponse.status);
    expect(headResponse.headers.get('Cache-Control')).toBe(
      getResponse.headers.get('Cache-Control'),
    );
    expect(await headResponse.text()).toBe('');
  });

  it('rejects invalid season, round and ID values before storage access', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const writes = harness.storage.writeLog.length;

    const invalidSeason = await worker.fetch(
      request('/v1/seasons/2200/calendar'),
      harness.env,
    );
    const invalidRound = await worker.fetch(
      request('/v1/seasons/2026/grand-prix/0'),
      harness.env,
    );
    const invalidId = await worker.fetch(
      request('/v1/drivers/Max Verstappen?season=2026'),
      harness.env,
    );

    expect(invalidSeason.status).toBe(400);
    expect(invalidRound.status).toBe(400);
    expect(invalidId.status).toBe(400);
    expect(harness.storage.writeLog).toHaveLength(writes);
  });

  it('returns controlled errors for unknown routes, unknown resources and unsupported methods', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);

    const unknownRoute = await worker.fetch(request('/v1/nope'), harness.env);
    const unknownDriver = await worker.fetch(
      request('/v1/drivers/unknown-driver?season=2026'),
      harness.env,
    );
    const method = await worker.fetch(
      request('/v1/seasons/2026/calendar', 'POST'),
      harness.env,
    );

    expect(unknownRoute.status).toBe(404);
    expect(
      ((await unknownRoute.json()) as { error: { code: string } }).error.code,
    ).toBe('RESOURCE_NOT_FOUND');
    expect(unknownDriver.status).toBe(404);
    expect(method.status).toBe(405);
    expect(method.headers.get('Allow')).toBe('GET, HEAD');
  });
});
