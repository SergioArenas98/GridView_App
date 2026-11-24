import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveJolpicaTransport } from '../../src/config/environment';
import { CapturingLogger } from '../../src/logging/logger';
import { jolpicaTransport } from '../../src/providers/http/jolpica-transport';
import {
  gridViewUserAgent,
  ProviderHttpClient,
  providerMaxResponseBytes,
  providerRequestTimeoutMillis,
  type ProviderTransport,
} from '../../src/providers/http/provider-http-client';
import type { ProviderRateLimiterClient } from '../../src/providers/http/provider-rate-limiter';

const origin = 'https://egress.example.test';
const token = 'disposable-proxy-test-token';
const config = resolveJolpicaTransport({
  JOLPICA_TRANSPORT: 'proxy',
  JOLPICA_PROXY_ORIGIN: origin,
  JOLPICA_PROXY_TOKEN: token,
});
const now = new Date('2026-11-10T12:00:00.000Z');
const request = {
  sourceId: 'jolpica',
  path: '/ergast/f1/2026/races/',
  query: { limit: 100 },
} as const;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Real network is forbidden');
    }),
  );
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function clientWith(transport: ProviderTransport, proxy = true) {
  const reserve = vi.fn<ProviderRateLimiterClient['reserve']>(
    async (sourceId) => ({ outcome: 'allowed', sourceId, headroom: [] }),
  );
  const recordRateLimited = vi.fn(async () => {});
  const logger = new CapturingLogger();
  const client = new ProviderHttpClient({
    transport: jolpicaTransport(proxy ? config : { mode: 'direct' }, transport),
    limiter: { reserve, recordRateLimited },
    logger,
    now: () => now,
  });
  return { client, reserve, recordRateLimited, logger };
}

describe('Jolpica egress wrapper', () => {
  it('returns the exact original transport in direct mode', () => {
    const transport = vi.fn<ProviderTransport>();
    expect(jolpicaTransport({ mode: 'direct' }, transport)).toBe(transport);
  });

  it('changes only the destination and proxy auth, preserving query bytes, headers, cancellation and the response stream', async () => {
    const controller = new AbortController();
    const canonical = new Request(
      'https://api.jolpi.ca/ergast/f1/2026/races/?limit=100&x=a%2Fb&x=c+d',
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': gridViewUserAgent,
        },
        signal: controller.signal,
        redirect: 'manual',
      },
    );
    const response = new Response('bytes', {
      status: 429,
      headers: {
        'Retry-After': '120',
        'cf-ray': 'abcdef0123456789-DUB',
        server: 'cloudflare',
      },
    });
    const send = vi.fn<ProviderTransport>(async () => response);
    const result = await jolpicaTransport(config, send)(canonical);
    const forwarded = send.mock.calls[0]![0];
    expect(forwarded.url).toBe(
      origin + '/ergast/f1/2026/races/?limit=100&x=a%2Fb&x=c+d',
    );
    expect(forwarded.method).toBe('GET');
    expect(forwarded.redirect).toBe('manual');
    expect(Object.fromEntries(forwarded.headers)).toEqual({
      accept: 'application/json',
      'user-agent': gridViewUserAgent,
      authorization: `Bearer ${token}`,
    });
    expect(canonical.headers.has('Authorization')).toBe(false);
    expect(result).toBe(response);
    expect(result.bodyUsed).toBe(false);
    controller.abort();
    expect(forwarded.signal.aborted).toBe(true);
  });

  it('forwards the exact diagnostic /test/ path without adding a query', async () => {
    const send = vi.fn<ProviderTransport>(async () => new Response('{}'));
    await jolpicaTransport(
      config,
      send,
    )(new Request('https://api.jolpi.ca/test/'));
    expect(send.mock.calls[0]![0].url).toBe(`${origin}/test/`);
  });

  it('leaves other providers untouched and never adds the proxy token', async () => {
    const send = vi.fn<ProviderTransport>(async () => new Response('{}'));
    const canonical = new Request('https://api.openf1.org/v1/sessions');
    await jolpicaTransport(config, send)(canonical);
    expect(send).toHaveBeenCalledWith(canonical);
    expect(canonical.headers.has('Authorization')).toBe(false);
  });

  it.each([
    new Request('https://api.jolpi.ca/ergast/f1/2026/races/', {
      method: 'POST',
      body: '{}',
    }),
    new Request('https://api.jolpi.ca/elsewhere'),
    new Request('https://api.jolpi.ca/test/?url=https://evil.test'),
    new Request('https://api.jolpi.ca/ergast/f1/2026/races/#fragment'),
  ])(
    'refuses requests outside the canonical GET boundary (%#)',
    async (invalid) => {
      const send = vi.fn<ProviderTransport>();
      await expect(jolpicaTransport(config, send)(invalid)).rejects.toThrow(
        'Invalid canonical',
      );
      expect(send).not.toHaveBeenCalled();
    },
  );
});

describe('existing hardened client through optional egress', () => {
  it.each([false, true])(
    'preserves reservations, success data and source identity (proxy=%s)',
    async (proxy) => {
      const send = vi.fn<ProviderTransport>(async () =>
        Response.json({ value: 1 }),
      );
      const { client, reserve } = clientWith(send, proxy);
      expect(await client.getJson(request)).toMatchObject({
        ok: true,
        sourceId: 'jolpica',
        data: { value: 1 },
        requestAttempted: true,
      });
      expect(reserve).toHaveBeenCalledExactlyOnceWith('jolpica');
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]![0].url).toBe(
        `${proxy ? origin : 'https://api.jolpi.ca'}/ergast/f1/2026/races/?limit=100`,
      );
      expect(send.mock.calls[0]![0].headers.get('Authorization')).toBe(
        proxy ? `Bearer ${token}` : null,
      );
    },
  );

  it.each([undefined, '120', 'Tue, 10 Nov 2026 12:02:00 GMT', 'invalid'])(
    'preserves 429 evidence and holds exactly as direct mode: %s',
    async (retryAfter) => {
      const headers = {
        'Content-Type': 'text/html',
        server: 'cloudflare',
        'cf-ray': 'abcdef0123456789-DUB',
        ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
      };
      const send = vi.fn<ProviderTransport>(
        async () =>
          new Response('<title>Access denied</title>Error 1015', {
            status: 429,
            headers,
          }),
      );
      const direct = clientWith(send, false);
      const proxy = clientWith(send);
      const expected = await direct.client.getJson(request);
      expect(await proxy.client.getJson(request)).toEqual(expected);
      expect(proxy.recordRateLimited.mock.calls).toEqual(
        direct.recordRateLimited.mock.calls,
      );
      expect(proxy.recordRateLimited).toHaveBeenCalledTimes(1);
      expect(proxy.logger.events).toEqual(direct.logger.events);
      expect(JSON.stringify(proxy.logger.events)).not.toContain(token);
    },
  );

  it.each([301, 302, 307, 308, 401, 403, 502, 503, 504])(
    'preserves HTTP %s without retry or fallback',
    async (status) => {
      const send = vi.fn<ProviderTransport>(
        async () =>
          new Response('', {
            status,
            headers: { Location: 'https://api.jolpi.ca/ergast/f1/2026/races/' },
          }),
      );
      const { client } = clientWith(send);
      expect(await client.getJson(request)).toMatchObject({
        ok: false,
        kind: status < 400 ? 'redirect-rejected' : 'provider-http-error',
        status,
        requestAttempted: true,
      });
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]![0].redirect).toBe('manual');
    },
  );

  it('sanitizes transport exceptions and never retries or logs the credential', async () => {
    const send = vi.fn<ProviderTransport>(async () => {
      throw new Error(`request Authorization: Bearer ${token}`);
    });
    const { client, logger } = clientWith(send);
    expect(await client.getJson(request)).toMatchObject({
      ok: false,
      kind: 'network',
      requestAttempted: true,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.events)).not.toContain(token);
  });

  it.each(['cancelled', 'timeout'] as const)(
    'keeps the client-owned %s signal and deadline',
    async (kind) => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const send = vi.fn<ProviderTransport>(
        (forwarded) =>
          new Promise((_resolve, reject) => {
            forwarded.signal.addEventListener(
              'abort',
              () => reject(new Error('aborted')),
              { once: true },
            );
          }),
      );
      const { client } = clientWith(send);
      const pending = client.getJson({ ...request, signal: controller.signal });
      await vi.advanceTimersByTimeAsync(0);
      if (kind === 'cancelled') controller.abort();
      else await vi.advanceTimersByTimeAsync(providerRequestTimeoutMillis);
      expect(await pending).toMatchObject({
        ok: false,
        kind,
        requestAttempted: true,
      });
      expect(send.mock.calls[0]![0].signal.aborted).toBe(true);
      expect(send).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps response validation in the hardened client', async () => {
    const { client } = clientWith(
      async () =>
        new Response('not-json', {
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    expect(await client.getJson(request)).toMatchObject({
      ok: false,
      kind: 'malformed-json',
    });
  });

  it('keeps the timeout active while consuming the proxy response body', async () => {
    vi.useFakeTimers();
    const send = vi.fn<ProviderTransport>(
      async (forwarded) =>
        new Response(
          new ReadableStream({
            start(controller) {
              forwarded.signal.addEventListener(
                'abort',
                () => controller.error(new Error('aborted')),
                { once: true },
              );
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
    );
    const { client } = clientWith(send);
    const pending = client.getJson(request);
    await vi.advanceTimersByTimeAsync(providerRequestTimeoutMillis + 1);
    expect(await pending).toMatchObject({ ok: false, kind: 'timeout' });
    expect(send.mock.calls[0]![0].signal.aborted).toBe(true);
  });

  it('cancels an oversized streamed body instead of buffering it in the wrapper', async () => {
    const cancel = vi.fn();
    const { client } = clientWith(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(providerMaxResponseBytes + 1));
            },
            cancel,
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
    );
    expect(await client.getJson(request)).toMatchObject({
      ok: false,
      kind: 'response-too-large',
    });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('never reaches proxy transport when the limiter is unavailable', async () => {
    const send = vi.fn<ProviderTransport>();
    const { client, reserve } = clientWith(send);
    reserve.mockRejectedValue(new Error('unavailable'));
    expect(await client.getJson(request)).toMatchObject({
      ok: false,
      kind: 'limiter-unavailable',
      requestAttempted: false,
    });
    expect(send).not.toHaveBeenCalled();
  });
});
