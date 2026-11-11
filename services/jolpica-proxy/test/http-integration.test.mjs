import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';
import { test } from 'node:test';
import {
  authorization,
  close,
  fixture,
  get,
  listen,
  target,
  token,
} from './support.mjs';
import { createProxyServer } from '../src/server.mjs';
import { loadConfig } from '../src/config.mjs';
import { maxResponseBytes } from '../src/policy.mjs';

test('authenticated requests forward once with isolated headers and exact bytes; no cache', async (t) => {
  const payload = gzipSync('{"MRData":{"RaceTable":{}}}');
  const f = await fixture(
    t,
    (_req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
        'Content-Length': payload.length,
        'Set-Cookie': 'session=secret',
      });
      res.end(payload);
    },
    { JOLPICA_PROXY_LOCAL_IPV4: '192.0.2.10' },
  );
  for (let i = 0; i < 2; i++) {
    const response = await get(f.port, {
      headers: {
        Cookie: 'secret-cookie',
        Forwarded: 'for=1.2.3.4',
        'X-Forwarded-For': '1.2.3.4',
        'X-Real-IP': '1.2.3.4',
        'CF-Connecting-IP': '1.2.3.4',
        'True-Client-IP': '1.2.3.4',
        'X-Unnecessary': 'private',
        'User-Agent': 'spoof',
        'Accept-Encoding': 'br',
      },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, payload);
    assert.equal(response.headers['content-encoding'], 'gzip');
    assert.equal(Number(response.headers['content-length']), payload.length);
    assert.equal(response.headers['set-cookie'], undefined);
    assert.equal(response.headers['x-gridview-proxy-error'], undefined);
  }
  assert.equal(f.received.length, 2);
  for (const req of f.received) {
    assert.equal(req.url, target);
    assert.deepEqual(Object.keys(req.headers).sort(), [
      'accept',
      'accept-encoding',
      'connection',
      'host',
      'user-agent',
    ]);
    assert.ok(!JSON.stringify(req.headers).includes(token));
  }
  assert.equal(f.options[0].localAddress, '192.0.2.10');
});

test('missing, wrong, duplicated or malformed auth never reaches upstream', async (t) => {
  const f = await fixture(t, (_req, res) => res.end('{}'));
  for (const auth of [
    '',
    'Bearer bad',
    `bearer ${token}`,
    `${authorization}x`,
    [authorization, authorization],
  ]) {
    const response = await get(f.port, { headers: { Authorization: auth } });
    assert.equal(response.status, 401);
    assert.equal(response.headers['x-gridview-proxy-error'], 'unauthorized');
    assert.ok(!response.body.toString().includes(token));
  }
  assert.equal(f.options.length, 0);
});

test('unsupported methods, raw paths, queries, bodies and Expect are refused without forwarding', async (t) => {
  const f = await fixture(t, (_req, res) => res.end('{}'));
  for (const method of ['POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'])
    assert.equal((await get(f.port, { method })).status, 405);
  for (const path of [
    '//evil.test/test/',
    'https://evil.test/test/',
    '/test/?limit=100',
    '/ergast/f1/2026/races/?limit=100&url=https://evil.test',
    '/ergast/f1/2026/%2e%2e/races/?limit=100',
    '/ergast/f1/2026/races/?limit=100&limit=100',
    '/ergast/f1/2026/races/?limit=%31%30%30',
    '/ergast/f1/2026/qualifying/?limit=100',
  ])
    assert.equal((await get(f.port, { path })).status, 400, path);
  assert.equal(
    (await get(f.port, { path: '/' + 'x'.repeat(513) })).status,
    414,
  );
  assert.equal(
    (await get(f.port, { headers: { 'Content-Length': '1' }, body: 'x' }))
      .status,
    413,
  );
  assert.equal(
    (
      await get(f.port, {
        headers: { 'Transfer-Encoding': 'chunked' },
        body: 'x',
      })
    ).status,
    413,
  );
  assert.equal(
    (await get(f.port, { headers: { Expect: '100-continue' } })).status,
    413,
  );
  assert.equal(
    (await get(f.port, { headers: { Expect: 'something' } })).status,
    417,
  );
  assert.equal(f.options.length, 0);
});

test('health is local, unauthenticated and does not probe upstream', async (t) => {
  const f = await fixture(t, (_req, res) => res.end('{}'));
  assert.equal(
    (
      await get(f.port, { path: '/healthz', headers: { Authorization: '' } })
    ).body.toString(),
    '{"status":"ok"}',
  );
  assert.equal(f.options.length, 0);
  assert.equal((await get(f.port, { path: '/test/' })).status, 200);
  assert.equal(f.options.length, 1);
});

for (const retry of [undefined, '120', 'Wed, 11 Nov 2026 12:00:00 GMT']) {
  test(`upstream 429 body and refusal diagnostics survive (Retry-After=${retry})`, async (t) => {
    const body = '<title>Access denied</title>Error 1015';
    const headers = {
      'Content-Type': 'text/html',
      server: 'cloudflare',
      'cf-ray': 'abcdef0123456789-DUB',
      'cf-cache-status': 'DYNAMIC',
      'cf-mitigated': 'challenge',
      'x-ratelimit-remaining': '0',
      'x-amzn-requestid': 'trace',
      ...(retry ? { 'Retry-After': retry } : {}),
    };
    const f = await fixture(t, (_req, res) => {
      res.writeHead(429, headers);
      res.end(body);
    });
    const response = await get(f.port);
    assert.equal(response.status, 429);
    assert.equal(response.body.toString(), body);
    for (const [name, value] of Object.entries(headers))
      assert.equal(response.headers[name.toLowerCase()], value);
    assert.equal(response.headers['x-gridview-proxy-error'], undefined);
    assert.equal(f.options.length, 1);
  });
}

for (const status of [301, 302, 307, 308, 400, 401, 403, 502, 503, 504]) {
  test(`upstream ${status} remains upstream, without following redirects or retrying`, async (t) => {
    const f = await fixture(t, (_req, res) => {
      res.writeHead(status, { Location: 'http://127.0.0.1/forbidden' });
      res.end('original');
    });
    const response = await get(f.port);
    assert.equal(response.status, status);
    assert.equal(response.body.toString(), 'original');
    assert.equal(response.headers['x-gridview-proxy-error'], undefined);
    assert.equal(f.options.length, 1);
  });
}

test('pre-header network errors produce a bounded 502 without credential leakage or retry', async (t) => {
  const f = await fixture(t, (req) => req.socket.destroy());
  const response = await get(f.port);
  assert.equal(response.status, 502);
  assert.equal(response.headers['x-gridview-proxy-error'], 'upstream_failure');
  assert.equal(response.body.toString(), '{"error":"proxy_upstream_failure"}');
  assert.deepEqual(f.failures, ['upstream_failure']);
  assert.equal(f.options.length, 1);
});

test('synchronous connector errors cannot expose credentials in errors or diagnostics', async (t) => {
  const failures = [];
  const proxy = createProxyServer(loadConfig({ JOLPICA_PROXY_TOKEN: token }), {
    request: () => {
      throw new Error(token);
    },
    onFailure: (code) => failures.push(code),
  });
  const port = await listen(proxy);
  t.after(() => close(proxy));
  const response = await get(port);
  assert.equal(response.status, 502);
  assert.ok(!JSON.stringify({ response, failures }).includes(token));
});

test('absolute pre-header timeout produces 504 and cancels upstream', async (t) => {
  let closed;
  const cancelled = new Promise((resolve) => {
    closed = resolve;
  });
  const f = await fixture(t, (_req, res) => res.on('close', closed), {
    JOLPICA_PROXY_TIMEOUT_MS: '150',
  });
  const response = await get(f.port);
  assert.equal(response.status, 504);
  assert.equal(response.headers['x-gridview-proxy-error'], 'upstream_timeout');
  await cancelled;
  assert.equal(f.options.length, 1);
});

test('concurrency overload is 503, has no queue and does not fabricate 429', async (t) => {
  let release;
  let started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  let calls = 0;
  const f = await fixture(
    t,
    (_req, res) => {
      if (++calls > 1) {
        res.end('{}');
        return;
      }
      release = () => res.end('{}');
      started();
    },
    { JOLPICA_PROXY_MAX_CONCURRENT: '1' },
  );
  const first = get(f.port);
  await ready;
  const second = await get(f.port);
  assert.equal(second.status, 503);
  assert.equal(second.headers['x-gridview-proxy-error'], 'busy');
  assert.equal(f.options.length, 1);
  release();
  assert.equal((await first).status, 200);
  assert.equal((await get(f.port)).status, 200);
  assert.equal(f.options.length, 2);
});

test('downstream cancellation closes upstream and frees the concurrency slot', async (t) => {
  let cancelled;
  const closed = new Promise((resolve) => {
    cancelled = resolve;
  });
  let calls = 0;
  const f = await fixture(
    t,
    (_req, res) => {
      if (++calls > 1) {
        res.end('recovered');
        return;
      }
      res.on('close', cancelled);
      res.write('partial');
    },
    { JOLPICA_PROXY_MAX_CONCURRENT: '1' },
  );
  const client = http.get({
    hostname: '127.0.0.1',
    port: f.port,
    path: target,
    headers: { Authorization: authorization },
    agent: false,
  });
  client.on('error', () => {});
  const [response] = await once(client, 'response');
  response.on('error', () => {});
  response.destroy();
  client.destroy();
  await closed;
  assert.equal((await get(f.port)).body.toString(), 'recovered');
});

for (const status of [200, 429]) {
  test(`body timeout terminates the connection after upstream ${status}, without changing headers`, async (t) => {
    const f = await fixture(
      t,
      (_req, res) => {
        res.writeHead(status, { 'Retry-After': '120' });
        res.write('partial');
      },
      { JOLPICA_PROXY_TIMEOUT_MS: '150' },
    );
    let observed;
    await assert.rejects(
      get(f.port, {
        onResponse: (res) => {
          observed = res.statusCode;
        },
      }),
    );
    assert.equal(observed, status);
    assert.deepEqual(f.failures, ['upstream_timeout']);
  });
}

test('upstream termination mid-body cannot become a complete successful response', async (t) => {
  const f = await fixture(t, (_req, res) => {
    res.write('partial');
    setTimeout(() => res.destroy(), 20);
  });
  await assert.rejects(get(f.port));
  assert.deepEqual(f.failures, ['upstream_failure']);
});

test('large streamed responses pass unchanged up to the bound', async (t) => {
  const body = Buffer.alloc(2 * 1024 * 1024, 'x');
  const f = await fixture(t, (_req, res) => {
    res.write(body.subarray(0, 1024));
    setImmediate(() => res.end(body.subarray(1024)));
  });
  assert.deepEqual((await get(f.port)).body, body);
});

for (const declared of [false, true]) {
  test(`oversized responses terminate rather than silently truncate (declared=${declared})`, async (t) => {
    const f = await fixture(t, (_req, res) => {
      if (declared)
        res.setHeader('Content-Length', String(maxResponseBytes + 1));
      res.end(Buffer.alloc(maxResponseBytes + 1));
    });
    await assert.rejects(get(f.port));
    assert.deepEqual(f.failures, ['response_too_large']);
  });
}

test('oversized headers and tunnel requests never reach upstream', async (t) => {
  const f = await fixture(t, (_req, res) => res.end('{}'));
  const raw = (data) =>
    new Promise((resolve, reject) => {
      const socket = net.connect(f.port, '127.0.0.1', () => socket.write(data));
      let text = '';
      socket.on('data', (chunk) => {
        text += chunk.toString();
      });
      socket.on('end', () => {
        socket.destroy();
        resolve(text);
      });
      socket.on('error', reject);
    });
  assert.match(
    await raw(
      `GET ${target} HTTP/1.1\r\nHost: localhost\r\nX-Large: ${'a'.repeat(9000)}\r\n\r\n`,
    ),
    /^HTTP\/1.1 431/,
  );
  assert.equal(
    await raw('CONNECT evil.test:443 HTTP/1.1\r\nHost: evil.test\r\n\r\n'),
    '',
  );
  assert.equal(
    await raw(
      'GET / HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n',
    ),
    '',
  );
  assert.equal(f.options.length, 0);
});

test(
  'a stalled header cannot hold a connection indefinitely or reach upstream',
  { timeout: 6500 },
  async (t) => {
    const f = await fixture(t, (_req, res) => res.end('{}'));
    const socket = net.connect(f.port, '127.0.0.1', () => {
      socket.write(`GET ${target} HTTP/1.1\r\nHost: localhost\r\n`);
    });
    t.after(() => socket.destroy());
    let response = '';
    socket.on('data', (chunk) => {
      response += chunk;
    });
    await once(socket, 'end');
    assert.match(response, /^HTTP\/1.1 400/);
    assert.match(response, /X-GridView-Proxy-Error: request_headers/);
    assert.equal(f.options.length, 0);
  },
);
