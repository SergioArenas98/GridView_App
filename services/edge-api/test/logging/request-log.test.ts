/**
 * What a request's own log lines carry (ADR 0028 D8): production persists
 * no line for a successful public request and no request ID for a failed
 * one; every other environment, and every internal route, keeps both lines.
 * A caller's `X-Request-ID` is adopted only as an opaque token.
 */

import { describe, expect, it } from 'vitest';

import worker from '../../src/index';
import {
  completedLine,
  failedLine,
  requestIdFor,
  requestLogScope,
} from '../../src/logging/request-log';
import type { SnapshotStorage } from '../../src/storage/types';
import { createHarness, request } from '../support/edge-harness';

const generated = () => 'generated-id-0000';

describe('the request ID', () => {
  it.each([
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'gv-18f2a3b4c5d6-9a8b7c6d',
    'trace-2',
    'a'.repeat(64),
  ])('adopts the opaque token %s', (header) => {
    expect(requestIdFor(header, generated)).toBe(header);
  });

  it.each([
    null,
    '',
    'a'.repeat(65),
    'jane.doe@example.com',
    'Bearer secret-token-value',
    'name with spaces',
    'line\nbreak-0000',
  ])('replaces %j with a generated one', (header) => {
    expect(requestIdFor(header, generated)).toBe('generated-id-0000');
  });
});

describe('the request log scope', () => {
  it('is operational only for a public route in production', () => {
    expect(requestLogScope('production', false)).toBe('operational');
    expect(requestLogScope('production', true)).toBe('complete');
    for (const environment of ['staging', 'development', undefined]) {
      expect(requestLogScope(environment, false)).toBe('complete');
      expect(requestLogScope(environment, true)).toBe('complete');
    }
  });

  it('drops the success line and the failure line ID when operational', () => {
    const event = {
      operation: 'request.failed',
      requestId: 'r-1',
      status: 500,
    };
    expect(completedLine('operational', event)).toBeNull();
    expect(completedLine('complete', event)).toBe(event);
    expect(failedLine('operational', event)).toEqual({
      operation: 'request.failed',
      status: 500,
    });
    // The caller's event is not changed.
    expect(event.requestId).toBe('r-1');
    expect(failedLine('complete', event)).toBe(event);
  });
});

function failingStorage(storage: SnapshotStorage): SnapshotStorage {
  const failing = Object.create(storage) as SnapshotStorage;
  failing.getCurrentSeason = async () => {
    throw new Error('storage down');
  };
  return failing;
}

describe('through the Worker', () => {
  const productionHarness = () => {
    const harness = createHarness({
      environment: 'production',
      providerMode: 'none',
    });
    harness.env.PUBLIC_BASE_URL = 'https://api.gridview.test';
    return harness;
  };

  it('writes no line for a successful public request in production', async () => {
    const harness = productionHarness();
    const response = await worker.fetch(request('/v1/status'), harness.env);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Request-ID')).toBeTypeOf('string');
    expect(harness.logger.events).toEqual([]);
  });

  it('writes a failed public request in production without its request ID', async () => {
    const harness = productionHarness();
    harness.env.__LOCAL_STORAGE = failingStorage(harness.storage);
    const response = await worker.fetch(
      request('/v1/status', 'GET', {
        headers: { 'X-Request-ID': 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
      }),
      harness.env,
    );
    expect(response.status).toBe(500);
    expect(harness.logger.events).toEqual([
      {
        level: 'error',
        operation: 'request.failed',
        routeTemplate: 'unknown',
        status: 500,
        durationMs: expect.any(Number),
        failureCategory: 'internal',
      },
    ]);
    expect(harness.logger.serialized()).not.toContain('f47ac10b');
  });

  it('keeps both lines, with the request ID, for an internal route in production', async () => {
    const harness = productionHarness();
    await worker.fetch(request('/internal/admin/sync/status'), harness.env);
    expect(harness.logger.events).toEqual([
      expect.objectContaining({
        operation: 'request.completed',
        requestId: expect.any(String),
        status: 401,
      }),
    ]);
  });

  it('keeps the staging line, and replaces a free-text request ID', async () => {
    const harness = createHarness({
      environment: 'staging',
      providerMode: 'none',
    });
    harness.env.PUBLIC_BASE_URL = 'https://api.gridview.test';
    const response = await worker.fetch(
      request('/v1/status', 'GET', {
        headers: { 'X-Request-ID': 'jane.doe@example.com' },
      }),
      harness.env,
    );
    const echoed = response.headers.get('X-Request-ID');
    expect(echoed).not.toBe('jane.doe@example.com');
    expect(harness.logger.events).toEqual([
      expect.objectContaining({
        operation: 'request.completed',
        requestId: echoed,
        routeTemplate: '/v1/status',
      }),
    ]);
    expect(harness.logger.serialized()).not.toContain('jane.doe');
  });
});
