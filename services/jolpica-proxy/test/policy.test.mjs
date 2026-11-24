import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  approvedTarget,
  responseHeaders,
  upstreamOptions,
} from '../src/policy.mjs';
import { loadConfig } from '../src/config.mjs';

const token = 'offline-test-token-000000000000000000000000000';
const env = { JOLPICA_PROXY_TOKEN: token };

test('the seven adapter paths and existing diagnostic are the complete allowlist', () => {
  for (const route of [
    'races',
    'circuits',
    'drivers',
    'constructors',
    'driverstandings',
    'constructorstandings',
    '24/results',
  ]) {
    const target = `/ergast/f1/2026/${route}/?limit=100`;
    assert.equal(approvedTarget(target), target);
  }
  assert.equal(approvedTarget('/test/'), '/test/');
});

test('raw targets reject encoding, traversal, URL injection and all extra query syntax', () => {
  for (const target of [
    '/healthz',
    '/ergast/f1/current/races/?limit=100',
    '/ergast/f1/2026/0/results/?limit=100',
    '/ergast/f1/2026/01/results/?limit=100',
    '/ergast/f1/2026/races/',
    '/ergast/f1/2026/races/?limit=101',
    '/ergast/f1/2026/races/?limit=0100',
    '/ergast/f1/2026/races/?limit=100&offset=0',
    '/ergast/f1/2026/races/?limit=100&limit=100',
    '/ergast/f1/2026/races/?limit=100&',
    '/ergast/f1/2026/races/?limit=%31%30%30',
    '/ergast/f1/2026/races/?limit=100#x',
    '/ergast/f1/2026/races/?url=https://evil.test',
    'https://api.jolpi.ca/ergast/f1/2026/races/?limit=100',
    '//evil.test/ergast/f1/2026/races/?limit=100',
    '/ergast/f1/2026/../2026/races/?limit=100',
    '/ergast/f1/2026/%2e%2e/races/?limit=100',
    '/ergast/f1/2026/%252e%252e/races/?limit=100',
    '/ergast%2ff1/2026/races/?limit=100',
    '/ergast\\f1/2026/races/?limit=100',
    '/test/?',
    '/test/?limit=100',
    '/test',
    '/ergast/f1/2026/races.json?limit=100',
    '/ergast/f1/2026/qualifying/?limit=100',
  ])
    assert.equal(approvedTarget(target), null, target);
});

test('upstream identity, TLS, IPv4 and fresh identifying headers are pinned', () => {
  const options = upstreamOptions('/test/', '192.0.2.10');
  assert.equal(options.protocol, 'https:');
  assert.equal(options.hostname, 'api.jolpi.ca');
  assert.equal(options.servername, 'api.jolpi.ca');
  assert.equal(options.port, 443);
  assert.equal(options.rejectUnauthorized, true);
  assert.equal(options.family, 4);
  assert.equal(options.localAddress, '192.0.2.10');
  assert.equal(options.agent, false);
  assert.deepEqual(Object.keys(options.headers).sort(), [
    'Accept',
    'Accept-Encoding',
    'User-Agent',
  ]);
  assert.equal(upstreamOptions('/test/').localAddress, undefined);
});

test('response headers retain diagnostics and encoding but discard hop headers, cookies and spoofed proxy markers', () => {
  const headers = responseHeaders({
    'retry-after': '30',
    'content-encoding': 'gzip',
    'content-length': '12',
    server: 'cloudflare',
    'cf-ray': 'abc-DUB',
    'cf-cache-status': 'DYNAMIC',
    'x-ratelimit-remaining': '0',
    'x-amzn-requestid': 'trace',
    connection: 'keep-alive, x-private',
    'x-private': 'secret',
    'set-cookie': ['a=b'],
    'transfer-encoding': 'chunked',
    authorization: 'secret',
    'proxy-authenticate': 'secret',
    'x-gridview-proxy-error': 'spoof',
  });
  assert.deepEqual(headers, {
    'retry-after': '30',
    'content-encoding': 'gzip',
    'content-length': '12',
    server: 'cloudflare',
    'cf-ray': 'abc-DUB',
    'cf-cache-status': 'DYNAMIC',
    'x-ratelimit-remaining': '0',
    'x-amzn-requestid': 'trace',
  });
});

test('configuration defaults are bounded; a dedicated token is required', () => {
  assert.deepEqual(loadConfig(env), {
    token,
    port: 8788,
    timeoutMs: 8000,
    maxConcurrent: 4,
    localAddress: undefined,
  });
  for (const bad of [
    undefined,
    '',
    'short',
    ' '.repeat(43),
    'a'.repeat(129),
    'a'.repeat(43) + '\r\n',
  ]) {
    assert.throws(
      () => loadConfig({ JOLPICA_PROXY_TOKEN: bad }),
      /Invalid proxy configuration/,
    );
  }
  for (const override of [
    { JOLPICA_PROXY_PORT: '0' },
    { JOLPICA_PROXY_PORT: '65536' },
    { JOLPICA_PROXY_TIMEOUT_MS: '9001' },
    { JOLPICA_PROXY_TIMEOUT_MS: '0' },
    { JOLPICA_PROXY_MAX_CONCURRENT: '17' },
    { JOLPICA_PROXY_MAX_CONCURRENT: 'NaN' },
    { JOLPICA_PROXY_LOCAL_IPV4: '::1' },
    { JOLPICA_PROXY_LOCAL_IPV4: 'https://evil.test' },
    { JOLPICA_PROXY_TOKEN_FILE: '/nonexistent' },
  ])
    assert.throws(
      () => loadConfig({ ...env, ...override }),
      /^Error: Invalid proxy configuration\.$/,
    );
});
