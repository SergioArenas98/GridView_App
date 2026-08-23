import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CapturingLogger } from '../../src/logging/logger';
import {
  buildProviderUrl,
  gridViewUserAgent,
  isAcceptedJsonContentType,
  parseRetryAfter,
  ProviderHttpClient,
  providerMaxResponseBytes,
  providerRequestTimeoutMillis,
  type ProviderTransport,
} from '../../src/providers/http/provider-http-client';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from '../../src/providers/http/provider-rate-limiter';
import type { RealProviderSourceId } from '../../src/providers/http/reservation-engine';

const now = new Date('2026-07-20T12:00:00.000Z');

/**
 * Global network guard. Every test must drive the client through an injected
 * transport; touching real `fetch` fails loudly rather than silently reaching
 * Jolpica, OpenF1 or anything else.
 */
let realFetch: typeof globalThis.fetch;
beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error('A test attempted a real network fetch');
  }) as typeof globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.useRealTimers();
});

const allowAll: ProviderRateLimiterClient = {
  async reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome> {
    return { outcome: 'allowed', sourceId, headroom: [] };
  },
};

function clientWith(
  transport: ProviderTransport,
  limiter: ProviderRateLimiterClient = allowAll,
) {
  const logger = new CapturingLogger();
  const client = new ProviderHttpClient({
    transport,
    limiter,
    logger,
    now: () => now,
  });
  return { client, logger };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function capture() {
  const requests: Request[] = [];
  const transport: ProviderTransport = async (request) => {
    requests.push(request);
    return jsonResponse({ ok: true });
  };
  return { requests, transport };
}

describe('URL construction and origin pinning', () => {
  it('builds the exact fixed origins for each source', () => {
    expect(
      buildProviderUrl('jolpica', '/ergast/f1/2026.json')?.toString(),
    ).toBe('https://api.jolpi.ca/ergast/f1/2026.json');
    expect(buildProviderUrl('openf1', '/v1/sessions')?.toString()).toBe(
      'https://api.openf1.org/v1/sessions',
    );
  });

  it('rejects anything that could resolve outside the pinned origin', () => {
    const rejected = [
      'http://api.jolpi.ca/ergast/f1/2026.json',
      'https://api.jolpi.ca/ergast/f1/2026.json',
      '//evil.example/ergast/f1/2026.json',
      'https://user:pass@api.jolpi.ca/ergast/f1/x',
      '/ergast/f1/../../etc/passwd',
      '/ergast/f1/x#fragment',
      '/ergast/f1/x?injected=1',
      'ergast/f1/2026.json',
      '\\ergast\\f1\\2026.json',
      '/ergast/f1/\\..\\..',
      '',
    ];

    for (const path of rejected) {
      expect(buildProviderUrl('jolpica', path)).toBeNull();
    }
  });

  it('enforces the documented path prefix per source', () => {
    expect(buildProviderUrl('jolpica', '/v1/sessions')).toBeNull();
    expect(buildProviderUrl('openf1', '/ergast/f1/2026.json')).toBeNull();
    // A lookalike prefix is not the prefix.
    expect(buildProviderUrl('jolpica', '/ergast/f2/2026.json')).toBeNull();
    expect(buildProviderUrl('openf1', '/v10/sessions')).toBeNull();
  });

  it('encodes query parameters from structured input only', () => {
    const url = buildProviderUrl('openf1', '/v1/sessions', {
      year: 2026,
      country_name: 'Great Britain',
      latest: true,
    });

    expect(url?.origin).toBe('https://api.openf1.org');
    expect(url?.searchParams.get('year')).toBe('2026');
    expect(url?.searchParams.get('country_name')).toBe('Great Britain');
    expect(url?.toString()).toContain('country_name=Great+Britain');
  });

  it('refuses to send when the request cannot be built, without reserving', async () => {
    let reserved = 0;
    const counting: ProviderRateLimiterClient = {
      async reserve(sourceId) {
        reserved += 1;
        return { outcome: 'allowed', sourceId, headroom: [] };
      },
    };
    const { requests, transport } = capture();
    const { client } = clientWith(transport, counting);

    const result = await client.getJson({
      sourceId: 'jolpica',
      path: 'https://evil.example/ergast/f1/x',
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.kind).toBe('invalid-request');
    expect(!result.ok && result.requestAttempted).toBe(false);
    expect(requests).toHaveLength(0);
    expect(reserved).toBe(0);
  });
});

describe('outbound request policy', () => {
  it('sends the Jolpica identifying User-Agent and a JSON Accept header', async () => {
    const { requests, transport } = capture();
    const { client } = clientWith(transport);

    await client.getJson({ sourceId: 'jolpica', path: '/ergast/f1/2026.json' });

    const request = requests[0]!;
    expect(request.method).toBe('GET');
    expect(request.redirect).toBe('manual');
    expect(request.headers.get('User-Agent')).toBe(gridViewUserAgent);
    expect(gridViewUserAgent).toContain('GridView/1.0');
    expect(request.headers.get('Accept')).toBe('application/json');
  });

  it('invents no credential for OpenF1', async () => {
    const { requests, transport } = capture();
    const { client } = clientWith(transport);

    await client.getJson({ sourceId: 'openf1', path: '/v1/sessions' });

    const request = requests[0]!;
    expect(request.headers.get('Authorization')).toBeNull();
    expect(request.headers.get('Cookie')).toBeNull();
    expect(request.headers.get('X-Api-Key')).toBeNull();
    // Only Jolpica documents a mandatory identifying User-Agent.
    expect(request.headers.get('User-Agent')).toBeNull();
  });

  it('cannot be given caller headers, cookies or authorization', async () => {
    const { requests, transport } = capture();
    const { client } = clientWith(transport);

    await client.getJson({
      sourceId: 'jolpica',
      path: '/ergast/f1/2026.json',
      // The typed request has no header field at all; this proves a stray
      // property cannot leak through.
      ...({
        headers: { Authorization: 'Bearer leak', Cookie: 'session=leak' },
      } as object),
    });

    const request = requests[0]!;
    expect(request.headers.get('Authorization')).toBeNull();
    expect(request.headers.get('Cookie')).toBeNull();
    expect([...request.headers.keys()].sort()).toEqual([
      'accept',
      'user-agent',
    ]);
  });

  it('never retries automatically', async () => {
    let calls = 0;
    const transport: ProviderTransport = async () => {
      calls += 1;
      return new Response('', { status: 503 });
    };
    const { client } = clientWith(transport);

    const result = await client.getJson({
      sourceId: 'openf1',
      path: '/v1/sessions',
    });

    expect(calls).toBe(1);
    expect(!result.ok && result.kind).toBe('provider-http-error');
    expect(!result.ok && result.status).toBe(503);
  });

  it('rejects every 3xx instead of following it', async () => {
    for (const status of [301, 302, 303, 307, 308]) {
      const transport: ProviderTransport = async () =>
        new Response('', {
          status,
          headers: { Location: 'https://evil.example/' },
        });
      const { client } = clientWith(transport);

      const result = await client.getJson({
        sourceId: 'openf1',
        path: '/v1/sessions',
      });

      expect(!result.ok && result.kind).toBe('redirect-rejected');
      expect(!result.ok && result.status).toBe(status);
    }
  });
});

describe('response hardening', () => {
  it('accepts JSON media types including parameters and +json', async () => {
    for (const contentType of [
      'application/json',
      'application/json; charset=utf-8',
      'application/vnd.api+json',
      'APPLICATION/JSON',
    ]) {
      expect(isAcceptedJsonContentType(contentType)).toBe(true);
      const transport: ProviderTransport = async () =>
        new Response(JSON.stringify({ value: 1 }), {
          status: 200,
          headers: { 'Content-Type': contentType },
        });
      const { client } = clientWith(transport);

      const result = await client.getJson<{ value: number }>({
        sourceId: 'openf1',
        path: '/v1/sessions',
      });

      expect(result.ok).toBe(true);
      expect(result.ok && result.data.value).toBe(1);
    }
  });

  it('rejects a missing or non-JSON content type before parsing', async () => {
    const cases: Record<string, string>[] = [
      {},
      { 'Content-Type': 'text/html' },
    ];
    for (const headers of cases) {
      const transport: ProviderTransport = async () =>
        new Response('{"value":1}', { status: 200, headers });
      const { client } = clientWith(transport);

      const result = await client.getJson({
        sourceId: 'openf1',
        path: '/v1/sessions',
      });

      expect(!result.ok && result.kind).toBe('invalid-content-type');
    }
    expect(isAcceptedJsonContentType(null)).toBe(false);
    expect(isAcceptedJsonContentType('text/json')).toBe(false);
  });

  it('rejects an oversized Content-Length without draining the body', async () => {
    let pullCount = 0;
    let cancelled = false;
    // Never closes: draining it would hang or hit the streaming cap instead.
    const transport: ProviderTransport = async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            pullCount += 1;
            controller.enqueue(new Uint8Array(8));
          },
          cancel() {
            cancelled = true;
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(providerMaxResponseBytes + 1),
          },
        },
      );
    const { client } = clientWith(transport);

    const result = await client.getJson({
      sourceId: 'openf1',
      path: '/v1/sessions',
    });

    expect(!result.ok && result.kind).toBe('response-too-large');
    // The stream was cancelled on the trustworthy declaration alone; at most
    // the runtime's own priming pull ran, so the body was never drained.
    expect(cancelled).toBe(true);
    expect(pullCount).toBeLessThanOrEqual(1);
  });

  it('rejects a streamed body over the cap even with no Content-Length', async () => {
    let cancelled = false;
    const chunk = new Uint8Array(64 * 1024);
    const transport: ProviderTransport = async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(chunk.slice());
          },
          cancel() {
            cancelled = true;
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    const { client } = clientWith(transport);

    const result = await client.getJson({
      sourceId: 'openf1',
      path: '/v1/sessions',
    });

    expect(!result.ok && result.kind).toBe('response-too-large');
    expect(cancelled).toBe(true);
  });

  it('accepts a body exactly at the cap', async () => {
    // `{"v":"` + filler + `"}` is exactly the cap.
    const filler = 'x'.repeat(providerMaxResponseBytes - 8);
    const payload = JSON.stringify({ v: filler });
    expect(payload.length).toBe(providerMaxResponseBytes);
    const transport: ProviderTransport = async () =>
      new Response(payload, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    const { client } = clientWith(transport);

    const result = await client.getJson<{ v: string }>({
      sourceId: 'openf1',
      path: '/v1/sessions',
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.v.length).toBe(filler.length);
  });

  it('fails safely on malformed JSON without echoing the body', async () => {
    const transport: ProviderTransport = async () =>
      new Response('{"secret-token":"leak", broken', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    const { client, logger } = clientWith(transport);

    const result = await client.getJson({
      sourceId: 'openf1',
      path: '/v1/sessions',
    });

    expect(!result.ok && result.kind).toBe('malformed-json');
    expect(JSON.stringify(result)).not.toContain('secret-token');
    expect(logger.serialized()).not.toContain('secret-token');
  });

  it('types non-2xx failures without leaking the body', async () => {
    const transport: ProviderTransport = async () =>
      new Response('internal detail: db password', {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    const { client, logger } = clientWith(transport);

    const result = await client.getJson({
      sourceId: 'openf1',
      path: '/v1/sessions',
    });

    expect(!result.ok && result.kind).toBe('provider-http-error');
    expect(!result.ok && result.status).toBe(500);
    expect(JSON.stringify(result)).not.toContain('db password');
    expect(logger.serialized()).not.toContain('db password');
  });
});

describe('timeout, cancellation and network failures', () => {
  it('types a timeout that fires before headers arrive', async () => {
    vi.useFakeTimers();
    const transport: ProviderTransport = (request) =>
      new Promise((_resolve, reject) => {
        request.signal.addEventListener('abort', () =>
          reject(new Error('aborted with host detail')),
        );
      });
    const { client, logger } = clientWith(transport);

    const pending = client.getJson({
      sourceId: 'openf1',
      path: '/v1/sessions',
    });
    await vi.advanceTimersByTimeAsync(providerRequestTimeoutMillis + 1);
    const result = await pending;

    expect(!result.ok && result.kind).toBe('timeout');
    expect(!result.ok && result.requestAttempted).toBe(true);
    expect(logger.serialized()).not.toContain('host detail');
  });

  it('types a timeout that fires while the body is being read', async () => {
    vi.useFakeTimers();
    const transport: ProviderTransport = async (request) =>
      new Response(
        new ReadableStream({
          pull(controller) {
            return new Promise((_resolve, reject) => {
              request.signal.addEventListener('abort', () => {
                controller.error(new Error('aborted'));
                reject(new Error('aborted'));
              });
            });
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    const { client } = clientWith(transport);

    const pending = client.getJson({
      sourceId: 'openf1',
      path: '/v1/sessions',
    });
    await vi.advanceTimersByTimeAsync(providerRequestTimeoutMillis + 1);
    const result = await pending;

    expect(!result.ok && result.kind).toBe('timeout');
  });

  it('reports a pre-aborted caller signal as cancelled without sending', async () => {
    const controller = new AbortController();
    controller.abort();
    const { requests, transport } = capture();
    const { client } = clientWith(transport);

    const result = await client.getJson({
      sourceId: 'openf1',
      path: '/v1/sessions',
      signal: controller.signal,
    });

    expect(!result.ok && result.kind).toBe('cancelled');
    // Nothing left GridView, so it is not an attempted provider request.
    expect(!result.ok && result.requestAttempted).toBe(false);
    expect(requests).toHaveLength(0);
  });

  it('distinguishes mid-flight caller cancellation from a timeout', async () => {
    const controller = new AbortController();
    const transport: ProviderTransport = (request) =>
      new Promise((_resolve, reject) => {
        request.signal.addEventListener('abort', () =>
          reject(new Error('aborted')),
        );
        // The transport is in flight, then the caller cancels.
        queueMicrotask(() => controller.abort());
      });
    const { client } = clientWith(transport);

    const result = await client.getJson({
      sourceId: 'openf1',
      path: '/v1/sessions',
      signal: controller.signal,
    });

    expect(!result.ok && result.kind).toBe('cancelled');
    // A request did leave, so this one is an attempted provider request.
    expect(!result.ok && result.requestAttempted).toBe(true);
  });

  it('types a network failure without leaking the exception', async () => {
    const transport: ProviderTransport = async () => {
      throw new Error('ECONNREFUSED 203.0.113.7:443 internal detail');
    };
    const { client, logger } = clientWith(transport);

    const result = await client.getJson({
      sourceId: 'openf1',
      path: '/v1/sessions',
    });

    expect(!result.ok && result.kind).toBe('network');
    expect(JSON.stringify(result)).not.toContain('ECONNREFUSED');
    expect(logger.serialized()).not.toContain('203.0.113.7');
  });
});

describe('provider 429 and Retry-After', () => {
  it('parses delta-seconds', async () => {
    const transport: ProviderTransport = async () =>
      new Response('', { status: 429, headers: { 'Retry-After': '30' } });
    const { client } = clientWith(transport);

    const result = await client.getJson({
      sourceId: 'jolpica',
      path: '/ergast/f1/2026.json',
    });

    expect(!result.ok && result.kind).toBe('provider-rate-limited');
    expect(!result.ok && result.requestAttempted).toBe(true);
    expect(!result.ok && result.retryAfter).toBe('2026-07-20T12:00:30.000Z');
  });

  it('parses an HTTP date', async () => {
    const transport: ProviderTransport = async () =>
      new Response('', {
        status: 429,
        headers: { 'Retry-After': 'Mon, 20 Jul 2026 12:05:00 GMT' },
      });
    const { client } = clientWith(transport);

    const result = await client.getJson({
      sourceId: 'jolpica',
      path: '/ergast/f1/2026.json',
    });

    expect(!result.ok && result.retryAfter).toBe('2026-07-20T12:05:00.000Z');
  });

  it('invents nothing when Retry-After is missing or malformed', async () => {
    const cases: Record<string, string>[] = [
      {},
      { 'Retry-After': 'soon' },
      { 'Retry-After': '-5' },
      { 'Retry-After': '' },
    ];
    for (const headers of cases) {
      const transport: ProviderTransport = async () =>
        new Response('', { status: 429, headers });
      const { client } = clientWith(transport);

      const result = await client.getJson({
        sourceId: 'jolpica',
        path: '/ergast/f1/2026.json',
      });

      expect(!result.ok && result.kind).toBe('provider-rate-limited');
      expect(!result.ok && result.retryAfter).toBeUndefined();
    }
  });

  it('treats an expired Retry-After as not active at the exact boundary', () => {
    expect(parseRetryAfter('Mon, 20 Jul 2026 12:00:00 GMT', now)).toBeNull();
    expect(parseRetryAfter('Mon, 20 Jul 2026 11:59:59 GMT', now)).toBeNull();
    expect(parseRetryAfter('0', now)).toBe('2026-07-20T12:00:00.000Z');
  });
});

describe('local pacing never counts as a provider attempt', () => {
  it('issues no request when the reservation is deferred', async () => {
    const { requests, transport } = capture();
    const deferring: ProviderRateLimiterClient = {
      async reserve(sourceId) {
        return {
          outcome: 'deferred',
          sourceId,
          retryAt: '2026-07-20T12:00:01.000Z',
          limitingWindows: [
            {
              window: 'second',
              limit: 3,
              retryAt: '2026-07-20T12:00:01.000Z',
            },
          ],
          headroom: [],
        };
      },
    };
    const { client, logger } = clientWith(transport, deferring);

    const result = await client.getJson({
      sourceId: 'openf1',
      path: '/v1/sessions',
    });

    expect(requests).toHaveLength(0);
    expect(!result.ok && result.kind).toBe('rate-limit-deferred');
    expect(!result.ok && result.requestAttempted).toBe(false);
    expect(!result.ok && result.retryAt).toBe('2026-07-20T12:00:01.000Z');
    const event = logger.events.find(
      (e) => e.operation === 'provider.reservation.deferred',
    );
    expect(event?.providerRequestAttempted).toBe(false);
    expect(event?.providerLimitingWindow).toBe('second');
  });

  it('issues no request when the limiter is unavailable', async () => {
    const { requests, transport } = capture();
    const broken: ProviderRateLimiterClient = {
      async reserve(sourceId) {
        return { outcome: 'unavailable', sourceId };
      },
    };
    const { client, logger } = clientWith(transport, broken);

    const result = await client.getJson({
      sourceId: 'jolpica',
      path: '/ergast/f1/2026.json',
    });

    expect(requests).toHaveLength(0);
    expect(!result.ok && result.kind).toBe('limiter-unavailable');
    expect(!result.ok && result.requestAttempted).toBe(false);
    expect(
      logger.events.find(
        (e) => e.operation === 'provider.reservation.unavailable',
      )?.failureCategory,
    ).toBe('limiter-unavailable');
  });

  it('fails closed when the limiter itself throws', async () => {
    const { requests, transport } = capture();
    const throwing: ProviderRateLimiterClient = {
      async reserve() {
        throw new Error('injected limiter failure');
      },
    };
    const { client } = clientWith(transport, throwing);

    const result = await client.getJson({
      sourceId: 'jolpica',
      path: '/ergast/f1/2026.json',
    });

    expect(requests).toHaveLength(0);
    expect(!result.ok && result.kind).toBe('limiter-unavailable');
  });
});

describe('structured logs stay bounded', () => {
  it('records only bounded fields for a completed request', async () => {
    const transport: ProviderTransport = async () =>
      jsonResponse({ secret: 'body-content' });
    const { client, logger } = clientWith(transport);

    await client.getJson({
      sourceId: 'jolpica',
      path: '/ergast/f1/2026.json',
      query: { season: 'sensitive-query-value' },
    });

    const serialized = logger.serialized();
    expect(serialized).not.toContain('body-content');
    expect(serialized).not.toContain('sensitive-query-value');
    expect(serialized).not.toContain('api.jolpi.ca');
    expect(serialized).not.toContain(gridViewUserAgent);
    expect(serialized).not.toContain('reservation-ledger');
    const completed = logger.events.find(
      (e) => e.operation === 'provider.request.completed',
    );
    expect(completed?.providerSourceId).toBe('jolpica');
    expect(completed?.status).toBe(200);
    expect(completed?.providerRequestAttempted).toBe(true);
  });
});
