import http from 'node:http';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resolveJolpicaTransport } from '../../src/config/environment';
import { CapturingLogger } from '../../src/logging/logger';
import { jolpicaTransport } from '../../src/providers/http/jolpica-transport';
import {
  ProviderHttpClient,
  gridViewUserAgent,
} from '../../src/providers/http/provider-http-client';
import { calendarPageLimit } from '../../src/providers/jolpica/calendar-port';
import { circuitsPageLimit } from '../../src/providers/jolpica/circuits-port';
import { participantsPageLimit } from '../../src/providers/jolpica/participants-port';
import { resultsPageLimit } from '../../src/providers/jolpica/results-port';
import { standingsPageLimit } from '../../src/providers/jolpica/standings-port';
import { createProxyServer } from '../../../jolpica-proxy/src/server.mjs';
import { loadConfig } from '../../../jolpica-proxy/src/config.mjs';

vi.mock('node:https', () => ({
  request: () => {
    throw new Error('Non-fixture HTTPS is forbidden');
  },
}));

const token = 'offline-test-token-000000000000000000000000000';
const servers = [];
const network = vi.fn(() => {
  throw new Error('Non-fixture network is forbidden');
});
beforeEach(() => {
  network.mockClear();
  vi.stubGlobal('fetch', network);
});
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  expect(network).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

async function listen(server) {
  servers.unshift(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

async function setup(status) {
  const received = [];
  const upstream = http.createServer((req, res) => {
    received.push({ path: req.url, headers: req.headers });
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Retry-After': '120',
      server: 'cloudflare',
      'cf-ray': 'abcdef0123456789-DUB',
      'cf-cache-status': 'DYNAMIC',
    });
    res.end(
      status === 429 ? '{"detail":"Request was throttled."}' : '{"value":1}',
    );
  });
  const upstreamPort = await listen(upstream);
  const options = [];
  const proxy = createProxyServer(loadConfig({ JOLPICA_PROXY_TOKEN: token }), {
    request: (opts) => {
      options.push(opts);
      return http.request({
        ...opts,
        hostname: '127.0.0.1',
        port: upstreamPort,
        protocol: 'http:',
      });
    },
  });
  const port = await listen(proxy);
  const outbound = [];
  // Node HTTP replaces only the socket destination in this offline test;
  // wrapper URLs remain HTTPS, and production server options remain pinned.
  const transport = async (request) =>
    new Promise((resolve, reject) => {
      outbound.push(request);
      const url = new URL(request.url);
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: url.pathname + url.search,
          method: request.method,
          headers: Object.fromEntries(request.headers),
          signal: request.signal,
          agent: false,
        },
        (res) => {
          resolve(
            new Response(Readable.toWeb(res), {
              status: res.statusCode,
              headers: new Headers(
                Object.entries(res.headers).map(([key, value]) => [
                  key,
                  String(value),
                ]),
              ),
            }),
          );
        },
      );
      req.on('error', reject);
      req.end();
    });
  const config = resolveJolpicaTransport({
    JOLPICA_TRANSPORT: 'proxy',
    JOLPICA_PROXY_ORIGIN: 'https://egress.example.test',
    JOLPICA_PROXY_TOKEN: token,
  });
  const logger = new CapturingLogger();
  const reserve = vi.fn(async (sourceId) => ({
    outcome: 'allowed',
    sourceId,
    headroom: [],
  }));
  const recordRateLimited = vi.fn(async () => {});
  const client = new ProviderHttpClient({
    transport: jolpicaTransport(config, transport),
    logger,
    limiter: { reserve, recordRateLimited },
    now: () => new Date('2026-11-11T12:00:00Z'),
  });
  return {
    client,
    logger,
    reserve,
    recordRateLimited,
    received,
    outbound,
    options,
  };
}

it('the Phase 1 wrapper and hardened client work with the standalone service for all seven routes and the diagnostic', async () => {
  expect([
    calendarPageLimit,
    circuitsPageLimit,
    participantsPageLimit,
    resultsPageLimit,
    standingsPageLimit,
  ]).toEqual([100, 100, 100, 100, 100]);
  const f = await setup(200);
  for (const path of [
    'races',
    'circuits',
    'drivers',
    'constructors',
    'driverstandings',
    'constructorstandings',
    '1/results',
  ]) {
    expect(
      await f.client.getJson({
        sourceId: 'jolpica',
        path: `/ergast/f1/2026/${path}/`,
        query: { limit: 100 },
      }),
    ).toMatchObject({ ok: true, data: { value: 1 }, sourceId: 'jolpica' });
  }
  expect(
    await f.client.getJson({ sourceId: 'jolpica', path: '/test/' }),
  ).toMatchObject({ ok: true });
  expect(f.reserve).toHaveBeenCalledTimes(8);
  expect(f.received).toHaveLength(8);
  for (const request of f.outbound) {
    expect(new URL(request.url).origin).toBe('https://egress.example.test');
    expect(request.redirect).toBe('manual');
    expect(request.headers.get('Authorization')).toBe(`Bearer ${token}`);
  }
  for (const request of f.received) {
    expect(request.headers.authorization).toBeUndefined();
    expect(request.headers['user-agent']).toBe(gridViewUserAgent);
  }
  for (const options of f.options) {
    expect(options.hostname).toBe('api.jolpi.ca');
    expect(options.family).toBe(4);
    expect(options.rejectUnauthorized).toBe(true);
  }
});

it('upstream 429 reaches the existing hold and refusal classification without exposing the proxy secret', async () => {
  const f = await setup(429);
  const result = await f.client.getJson({
    sourceId: 'jolpica',
    path: '/ergast/f1/2026/races/',
    query: { limit: 100 },
  });
  expect(result).toMatchObject({
    ok: false,
    kind: 'provider-rate-limited',
    status: 429,
    retryAfter: '2026-11-11T12:02:00.000Z',
  });
  expect(f.recordRateLimited).toHaveBeenCalledExactlyOnceWith(
    'jolpica',
    '2026-11-11T12:02:00.000Z',
  );
  expect(f.received).toHaveLength(1);
  expect(f.logger.events).toContainEqual(
    expect.objectContaining({
      operation: 'provider.request.rate_limited',
      providerServer: 'cloudflare',
      providerRay: 'abcdef0123456789-DUB',
    }),
  );
  expect(JSON.stringify({ result, logs: f.logger.events })).not.toContain(
    token,
  );
});
