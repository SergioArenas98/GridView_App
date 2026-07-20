import { describe, expect, it } from 'vitest';

import worker from '../../src/index';
import { resolveProviderMode } from '../../src/config/environment';
import {
  adminRequest,
  createHarness,
  request,
  seedPublishedSnapshot,
} from '../support/edge-harness';

describe('admin security', () => {
  it('rejects missing and invalid authorization with a generic response', async () => {
    const harness = createHarness();

    const missing = await worker.fetch(
      request('/internal/admin/sync/status'),
      harness.env,
    );
    const invalid = await worker.fetch(
      adminRequest(
        '/internal/admin/sync/status',
        'wrong-token',
        undefined,
        'GET',
      ),
      harness.env,
    );

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    const missingBody = (await missing.json()) as {
      error: { code: string; message: string };
    };
    const invalidBody = (await invalid.json()) as {
      error: { code: string; message: string };
    };
    expect(missingBody.error.code).toBe(invalidBody.error.code);
    expect(missingBody.error.message).toBe(invalidBody.error.message);
  });

  it('accepts valid authorization and rejects GET for state-changing routes', async () => {
    const harness = createHarness();

    const status = await worker.fetch(
      adminRequest(
        '/internal/admin/sync/status',
        'local-test-token',
        undefined,
        'GET',
      ),
      harness.env,
    );
    const getSync = await worker.fetch(
      adminRequest(
        '/internal/admin/sync/full',
        'local-test-token',
        undefined,
        'GET',
      ),
      harness.env,
    );

    expect(status.status).toBe(200);
    expect(getSync.status).toBe(405);
  });

  it('does not expose admin secrets in responses or logs', async () => {
    const secret = 'very-secret-test-token';
    const harness = createHarness({ adminToken: secret });

    const response = await worker.fetch(
      adminRequest('/internal/admin/sync/full', secret),
      harness.env,
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).not.toContain(secret);
    expect(harness.logger.serialized()).not.toContain(secret);
  });

  it('public routes cannot trigger writes', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const writes = harness.storage.writeLog.length;

    await worker.fetch(request('/v1/seasons/2026/calendar'), harness.env);
    await worker.fetch(request('/v1/status'), harness.env);

    expect(harness.storage.writeLog).toHaveLength(writes);
  });

  it('does not allow production to select the mock provider silently', () => {
    expect(() => resolveProviderMode('mock', 'production')).toThrow(
      'mock provider',
    );
    expect(resolveProviderMode(undefined, 'production')).toBe('none');
  });
});
