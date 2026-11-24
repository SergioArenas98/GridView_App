import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import {
  approvedTarget,
  maxResponseBytes,
  responseHeaders,
  upstreamOptions,
} from './policy.mjs';

/** @typedef {import('node:http').IncomingMessage} IncomingMessage */
/** @typedef {import('node:http').ServerResponse} ServerResponse */
/** @typedef {(options: import('node:https').RequestOptions) => import('node:http').ClientRequest} UpstreamRequest */
/** @typedef {'upstream_failure' | 'upstream_timeout' | 'response_too_large' | 'busy'} Failure */

/** @param {string} value */
const digest = (value) => createHash('sha256').update(value).digest();

/** @param {IncomingMessage} req @param {Buffer} expected */
function authenticated(req, expected) {
  let count = 0;
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    if (req.rawHeaders[i]?.toLowerCase() === 'authorization') count++;
  }
  // Fixed-length digests avoid both unequal-length exceptions and character
  // comparison timing. Duplicate Authorization fields are never accepted.
  const equal = timingSafeEqual(
    digest(req.headers.authorization ?? ''),
    expected,
  );
  return count === 1 && equal;
}

/** Proxy errors are bounded, distinguishable and never HTTP 429.
 * @param {ServerResponse} res @param {number} status @param {string} code
 */
function errorResponse(res, status, code) {
  if (res.destroyed) return;
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-GridView-Proxy-Error': code,
    Connection: 'close',
  });
  res.end(JSON.stringify({ error: `proxy_${code}` }));
}

/** Build only; importing never binds a port or contacts a provider.
 * The request seam is for offline fixtures only: production always uses HTTPS
 * and exposes no environment setting capable of choosing an upstream URL.
 * @param {import('./config.mjs').Config} config
 * @param {{request?: UpstreamRequest, onFailure?: (code: Failure) => void}} [dependencies]
 */
export function createProxyServer(config, dependencies = {}) {
  const send = dependencies.request ?? httpsRequest;
  const expected = digest(`Bearer ${config.token}`);
  let active = 0;
  const server = createServer(
    {
      maxHeaderSize: 8192,
      headersTimeout: 3000,
      requestTimeout: 5000,
      connectionsCheckingInterval: 1000,
      keepAliveTimeout: 1000,
    },
    (req, res) => {
      res.sendDate = false;
      const target = req.url ?? '';
      const hasBody =
        req.headers['transfer-encoding'] !== undefined ||
        (req.headers['content-length'] !== undefined &&
          req.headers['content-length'] !== '0');
      // Health is local-only by deployment policy (Caddy does not expose it).
      if (req.method === 'GET' && target === '/healthz' && !hasBody) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end('{"status":"ok"}');
        return;
      }
      if (!authenticated(req, expected)) {
        errorResponse(res, 401, 'unauthorized');
        return;
      }
      if (req.method !== 'GET') {
        errorResponse(res, 405, 'method');
        return;
      }
      if (hasBody) {
        errorResponse(res, 413, 'request_body');
        return;
      }
      if (target.length > 512) {
        errorResponse(res, 414, 'target_too_long');
        return;
      }
      const path = approvedTarget(target);
      if (path === null) {
        errorResponse(res, 400, 'target');
        return;
      }
      if (active >= config.maxConcurrent) {
        errorResponse(res, 503, 'busy');
        return;
      }
      active++;

      /** @type {import('node:http').ClientRequest | undefined} */
      let upstream;
      /** @type {IncomingMessage | undefined} */
      let body;
      let settled = false;
      const timer = setTimeout(
        () => fail(504, 'upstream_timeout'),
        config.timeoutMs,
      );
      // Covers DNS, TCP, TLS, headers, body and downstream backpressure together.
      function release() {
        if (settled) return false;
        settled = true;
        clearTimeout(timer);
        active--;
        body?.destroy();
        upstream?.destroy();
        return true;
      }
      /** @param {number} status @param {Failure} code */
      function fail(status, code) {
        if (!release()) return;
        // Once headers are sent, terminate instead of appending an error to the
        // provider body or silently completing a truncated successful response.
        errorResponse(res, status, code);
        dependencies.onFailure?.(code);
      }
      res.once('finish', release);
      res.once('close', release);
      res.on('error', release);
      req.once('aborted', () => {
        release();
        res.destroy();
      });
      req.on('error', () => {
        release();
        res.destroy();
      });
      try {
        upstream = send(upstreamOptions(path, config.localAddress));
        upstream.on('error', () => fail(502, 'upstream_failure'));
        upstream.on('upgrade', (_response, socket) => {
          socket.destroy();
          fail(502, 'upstream_failure');
        });
        upstream.once('response', (response) => {
          body = response;
          if (settled) {
            response.destroy();
            return;
          }
          response.on('error', () => fail(502, 'upstream_failure'));
          response.once('aborted', () => fail(502, 'upstream_failure'));
          // No redirect is followed. Return 3xx as received; the Worker rejects
          // it under its existing manual-redirect policy. Never rewrite a 429.
          res.writeHead(
            response.statusCode ?? 502,
            responseHeaders(response.headers),
          );
          res.flushHeaders();
          if (Number(response.headers['content-length']) > maxResponseBytes) {
            fail(502, 'response_too_large');
            return;
          }
          let bytes = 0;
          response.on('data', (chunk) => {
            if (settled) return;
            bytes += chunk.length;
            if (bytes > maxResponseBytes) {
              fail(502, 'response_too_large');
              return;
            }
            if (!res.write(chunk)) response.pause();
          });
          res.on('drain', () => response.resume());
          response.once('end', () => {
            if (!settled) res.end();
          });
        });
        upstream.end();
      } catch {
        fail(502, 'upstream_failure');
      }
    },
  );
  server.maxConnections = 64;
  server.on('checkContinue', (_req, res) =>
    errorResponse(res, 413, 'request_body'),
  );
  server.on('checkExpectation', (_req, res) =>
    errorResponse(res, 417, 'expectation'),
  );
  // CONNECT and WebSocket upgrades cannot turn this into a tunnel.
  server.on('connect', (_req, socket) => socket.destroy());
  server.on('upgrade', (_req, socket) => socket.destroy());
  server.on('clientError', (error, socket) => {
    if (!socket.writable) {
      socket.destroy();
      return;
    }
    const status =
      'code' in error && error.code === 'HPE_HEADER_OVERFLOW' ? 431 : 400;
    socket.end(
      `HTTP/1.1 ${status} Bad Request\r\nConnection: close\r\nX-GridView-Proxy-Error: request_headers\r\nContent-Length: 0\r\n\r\n`,
      () => socket.destroy(),
    );
  });
  return server;
}
