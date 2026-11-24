import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { createProxyServer } from '../src/server.mjs';
import { loadConfig } from '../src/config.mjs';
import { userAgent } from '../src/policy.mjs';

export const token = 'offline-test-token-000000000000000000000000000';
export const target = '/ergast/f1/2026/races/?limit=100';
export const authorization = `Bearer ${token}`;

// A missing fixture injection fails, rather than accidentally contacting TLS
// upstreams. Test fixtures use only 127.0.0.1 HTTP sockets.
https.request = () => {
  throw new Error('Non-fixture HTTPS is forbidden');
};
syncBuiltinESMExports();

export async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

export async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

export async function fixture(t, handler, overrides = {}) {
  const received = [];
  const options = [];
  const failures = [];
  const upstream = http.createServer((req, res) => {
    received.push(req);
    handler(req, res);
  });
  const upstreamPort = await listen(upstream);
  const config = loadConfig({ JOLPICA_PROXY_TOKEN: token, ...overrides });
  const proxy = createProxyServer(config, {
    request: (opts) => {
      options.push(opts);
      // Only this fixture connector changes the host/protocol. No production
      // setting can do so. Capture every production option before overriding.
      return http.request({
        ...opts,
        protocol: 'http:',
        hostname: '127.0.0.1',
        port: upstreamPort,
        localAddress: '127.0.0.1',
      });
    },
    onFailure: (code) => failures.push(code),
  });
  const port = await listen(proxy);
  t.after(async () => {
    await close(proxy);
    await close(upstream);
    // Assertions belong outside the connector; production intentionally
    // catches its exceptions, which would otherwise swallow test failures.
    for (const opts of options) {
      assert.equal(opts.hostname, 'api.jolpi.ca');
      assert.equal(opts.servername, 'api.jolpi.ca');
      assert.equal(opts.protocol, 'https:');
      assert.equal(opts.rejectUnauthorized, true);
      assert.equal(opts.family, 4);
      assert.deepEqual(opts.headers, {
        Accept: 'application/json',
        'User-Agent': userAgent,
        'Accept-Encoding': 'identity',
      });
    }
  });
  return { proxy, port, received, options, failures };
}

export function get(
  port,
  { path = target, method = 'GET', headers = {}, body, onResponse } = {},
) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: { Authorization: authorization, ...headers },
        agent: false,
      },
      (res) => {
        onResponse?.(res);
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    request.on('error', reject);
    request.end(body);
  });
}
