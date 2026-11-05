/**
 * Which layer refused a Jolpica request (Cloudflare-to-Jolpica 429
 * investigation, 2026-11-05): the hardened client records closed facts about
 * a 429 and about every answer's cache status, and its behaviour on a 429
 * (typed result, upstream hold, nothing retried) is exactly what it was.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../src/logging/logger';
import {
  ProviderHttpClient,
  type ProviderTransport,
} from '../../src/providers/http/provider-http-client';
import type { ProviderRateLimiterClient } from '../../src/providers/http/provider-rate-limiter';
import type { RealProviderSourceId } from '../../src/providers/http/reservation-engine';
import {
  bodyMediaOf,
  cacheStatusOf,
  classifyRefusalBody,
  edgeColoOf,
  rayOf,
  refusalBodyLimitBytes,
  refusalLayerOf,
  retryAfterFormOf,
  serverClassOf,
} from '../../src/providers/http/refusal-evidence';

const now = new Date('2026-11-05T12:00:00.000Z');
const ray = '0123456789abcdef-DUB';

let realFetch: typeof globalThis.fetch;
beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error('A test attempted a real network fetch');
  }) as typeof globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** The body Jolpica's application (DRF `Throttled`, no wait) answers. */
const drfThrottled = () =>
  new Response('{"detail":"Request was throttled."}', {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      server: 'cloudflare',
      'cf-ray': ray,
      'cf-cache-status': 'DYNAMIC',
    },
  });

/** Cloudflare's RFC 9457 error 1015, as served to a JSON client. */
const cloudflare1015 = (retryAfter = '10') =>
  new Response(
    JSON.stringify({
      type: 'https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1015/',
      title: 'Error 1015: You are being rate limited',
      status: 429,
      error_code: 1015,
      error_name: 'rate_limited',
      retryable: true,
      retry_after: Number(retryAfter),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/problem+json',
        'Retry-After': retryAfter,
        server: 'cloudflare',
        'cf-ray': ray,
      },
    },
  );

function harness(answer: () => Response | Promise<Response>) {
  const reports: [RealProviderSourceId, string | null][] = [];
  let sent = 0;
  const limiter: ProviderRateLimiterClient = {
    async reserve(sourceId) {
      return { outcome: 'allowed', sourceId, headroom: [] };
    },
    async recordRateLimited(sourceId, retryAfter) {
      reports.push([sourceId, retryAfter]);
    },
  };
  const transport: ProviderTransport = async () => {
    sent += 1;
    return answer();
  };
  const logger = new CapturingLogger();
  const client = new ProviderHttpClient({
    transport,
    limiter,
    logger,
    now: () => now,
  });
  const get = () =>
    client.getJson({ sourceId: 'jolpica', path: '/ergast/f1/2026/races/' });
  const line = (operation: string) =>
    logger.events.find((event) => event.operation === operation);
  return { get, reports, logger, line, sent: () => sent };
}

describe('a 429 from Jolpica records which layer refused', () => {
  it("classifies Jolpica's application throttle and keeps the 429 behaviour", async () => {
    const run = harness(drfThrottled);

    const result = await run.get();

    // Exactly the result and the hold the client answered before.
    expect(result).toEqual({
      ok: false,
      sourceId: 'jolpica',
      kind: 'provider-rate-limited',
      requestAttempted: true,
      status: 429,
    });
    expect(run.reports).toEqual([['jolpica', null]]);
    expect(run.sent()).toBe(1);
    expect(run.line('provider.request.rate_limited')).toMatchObject({
      status: 429,
      providerRefusalLayer: 'application',
      providerRefusalBody: 'jolpica-throttled',
      providerRetryAfterForm: 'absent',
      providerServer: 'cloudflare',
      providerBodyMedia: 'json',
      providerCacheStatus: 'DYNAMIC',
      providerEdgeColo: 'DUB',
      providerRay: ray,
    });
    expect(run.line('provider.request.rate_limited')).not.toHaveProperty(
      'providerRetryAfter',
    );
  });

  it("classifies Cloudflare's edge 1015 and still honours its Retry-After", async () => {
    const run = harness(() => cloudflare1015('10'));

    const result = await run.get();

    expect(!result.ok && result.kind).toBe('provider-rate-limited');
    expect(!result.ok && result.retryAfter).toBe('2026-11-05T12:00:10.000Z');
    expect(run.reports).toEqual([['jolpica', '2026-11-05T12:00:10.000Z']]);
    expect(run.line('provider.request.rate_limited')).toMatchObject({
      providerRefusalLayer: 'edge',
      providerRefusalBody: 'cloudflare-1015',
      providerRetryAfterForm: 'delta',
      providerRetryAfter: '2026-11-05T12:00:10.000Z',
      providerBodyMedia: 'problem-json',
      providerCacheStatus: 'absent',
    });
  });

  it("classifies Cloudflare's text and HTML 1015 pages", async () => {
    for (const [body, type] of [
      ['error code: 1015', 'text/plain'],
      ['<html><title>Error 1015</title>rate limited</html>', 'text/html'],
    ] as const) {
      const run = harness(
        () =>
          new Response(body, {
            status: 429,
            headers: { 'Content-Type': type, 'Retry-After': '30' },
          }),
      );
      await run.get();
      expect(run.line('provider.request.rate_limited')).toMatchObject({
        providerRefusalLayer: 'edge',
        providerRefusalBody: 'cloudflare-1015',
      });
    }
  });

  it('holds and answers the 429 even when its body is oversized or unreadable', async () => {
    const marker = 'PROVIDER-BYTES-MUST-NOT-BE-LOGGED';
    const oversize = harness(
      () =>
        new Response(marker + 'x'.repeat(refusalBodyLimitBytes), {
          status: 429,
        }),
    );
    const broken = harness(
      () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.error(new Error(`stream broke ${marker}`));
            },
          }),
          { status: 429 },
        ),
    );

    for (const [run, body] of [
      [oversize, 'oversize'],
      [broken, 'unreadable'],
    ] as const) {
      const result = await run.get();
      // A read failure must never turn the 429 into a network failure.
      expect(!result.ok && result.kind).toBe('provider-rate-limited');
      expect(!result.ok && result.requestAttempted).toBe(true);
      expect(run.reports).toEqual([['jolpica', null]]);
      expect(run.line('provider.request.rate_limited')).toMatchObject({
        providerRefusalLayer: 'unknown',
        providerRefusalBody: body,
      });
      expect(run.logger.serialized()).not.toContain(marker);
    }
  });

  it('holds the source before reading the refusal body, so a slow body never delays the hold', async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const limiter: ProviderRateLimiterClient = {
      async reserve(sourceId) {
        return { outcome: 'allowed', sourceId, headroom: [] };
      },
      async recordRateLimited() {
        order.push('hold');
        // The body can only finish once the hold has been reported.
        release();
      },
    };
    const encoder = new TextEncoder();
    const client = new ProviderHttpClient({
      transport: async () =>
        new Response(
          new ReadableStream({
            async pull(controller) {
              order.push('body-read');
              await gate;
              controller.enqueue(
                encoder.encode('{"detail":"Request was throttled."}'),
              );
              controller.close();
              order.push('body-done');
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        ),
      limiter,
      logger: new CapturingLogger(),
      now: () => now,
    });

    const result = await client.getJson({
      sourceId: 'jolpica',
      path: '/ergast/f1/2026/races/',
    });

    expect(!result.ok && result.kind).toBe('provider-rate-limited');
    // The body could only complete after the hold; had the client awaited the
    // body first, it would have waited for the timeout instead.
    expect(order.filter((step) => step !== 'body-read')).toEqual([
      'hold',
      'body-done',
    ]);
  });

  it('never logs a provider header or body value it did not recognise', async () => {
    const hostile = 'evil-value\u0000<script>';
    const run = harness(
      () =>
        new Response(`{"detail":"${'Throttle me '.repeat(3)}"}`, {
          status: 429,
          headers: {
            'Content-Type': `text/${'x'.repeat(40)}`,
            server: hostile.replace('\u0000', ''),
            'cf-ray': `${ray}\tinjected`,
            'cf-cache-status': 'HIT; evil',
            'Retry-After': 'tomorrow-ish',
          },
        }),
    );

    await run.get();

    expect(run.line('provider.request.rate_limited')).toMatchObject({
      providerRefusalLayer: 'unknown',
      providerRefusalBody: 'other',
      providerServer: 'other',
      providerCacheStatus: 'other',
      providerBodyMedia: 'other',
      providerRetryAfterForm: 'invalid',
    });
    const serialized = run.logger.serialized();
    for (const fragment of ['evil', 'injected', 'Throttle me', 'tomorrow']) {
      expect(serialized).not.toContain(fragment);
    }
    expect(run.line('provider.request.rate_limited')).not.toHaveProperty(
      'providerRay',
    );
  });

  it('records whether an answer came from Cloudflare cache, and from where', async () => {
    const run = harness(
      () =>
        new Response('{"MRData":{}}', {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'cf-cache-status': 'hit',
            'cf-ray': '00000000000000ff-ATL',
          },
        }),
    );

    const result = await run.get();

    expect(result.ok).toBe(true);
    expect(run.line('provider.request.completed')).toMatchObject({
      status: 200,
      providerCacheStatus: 'HIT',
      providerEdgeColo: 'ATL',
    });
    expect(run.line('provider.request.completed')).not.toHaveProperty(
      'providerRay',
    );
  });
});

describe('the closed vocabularies', () => {
  it('classifies refusal bodies', () => {
    expect(classifyRefusalBody('{"detail":"Request was throttled."}')).toBe(
      'jolpica-throttled',
    );
    expect(
      classifyRefusalBody(
        '{"detail":"Request was throttled. Expected available in 3 seconds."}',
      ),
    ).toBe('jolpica-throttled');
    expect(classifyRefusalBody('{"error":"ratelimited"}')).toBe(
      'jolpica-ratelimited',
    );
    expect(classifyRefusalBody('{"error_code":1015}')).toBe('cloudflare-1015');
    expect(classifyRefusalBody('{"error_code":"1015"}')).toBe(
      'cloudflare-1015',
    );
    expect(classifyRefusalBody('{"error_code":1020}')).toBe('cloudflare-other');
    expect(classifyRefusalBody('{"error_code":42}')).toBe('other');
    expect(classifyRefusalBody('error code: 1006')).toBe('cloudflare-other');
    expect(classifyRefusalBody('{not json')).toBe('other');
    expect(classifyRefusalBody('[1015]')).toBe('other');
    expect(classifyRefusalBody('   ')).toBe('empty');
    expect(classifyRefusalBody(null)).toBe('oversize');
  });

  it('maps bodies to layers', () => {
    expect(refusalLayerOf('jolpica-throttled')).toBe('application');
    expect(refusalLayerOf('jolpica-ratelimited')).toBe('application');
    expect(refusalLayerOf('cloudflare-1015')).toBe('edge');
    expect(refusalLayerOf('cloudflare-other')).toBe('edge');
    for (const body of ['empty', 'oversize', 'unreadable', 'other'] as const) {
      expect(refusalLayerOf(body)).toBe('unknown');
    }
  });

  it('reads headers into closed values only', () => {
    expect(retryAfterFormOf(null)).toBe('absent');
    expect(retryAfterFormOf('9')).toBe('delta');
    expect(retryAfterFormOf('Wed, 04 Nov 2026 20:23:29 GMT')).toBe('date');
    expect(retryAfterFormOf('soon')).toBe('invalid');
    expect(retryAfterFormOf('')).toBe('invalid');

    expect(cacheStatusOf('EXPIRED')).toBe('EXPIRED');
    expect(cacheStatusOf(null)).toBe('absent');
    expect(cacheStatusOf('HIT, MISS')).toBe('other');

    expect(edgeColoOf(ray)).toBe('DUB');
    expect(edgeColoOf('0123456789abcdef')).toBeUndefined();
    expect(edgeColoOf('0123456789ABCDEF-DUB')).toBeUndefined();
    expect(rayOf(` ${ray} `)).toBe(ray);
    expect(rayOf('x'.repeat(16) + '-DUB')).toBeUndefined();

    expect(serverClassOf('Cloudflare')).toBe('cloudflare');
    expect(serverClassOf('nginx')).toBe('other');
    expect(serverClassOf(null)).toBe('absent');

    expect(bodyMediaOf('application/json; charset=utf-8')).toBe('json');
    expect(bodyMediaOf('text/html')).toBe('html');
    expect(bodyMediaOf(null)).toBe('absent');
  });
});
