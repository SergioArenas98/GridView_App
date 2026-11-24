// Transport-only allowlist, matched against the RAW request-target before any
// URL decoding or normalization. Keep in parity with the seven adapter paths.
const seasonRoute =
  /^\/ergast\/f1\/[1-9][0-9]{3}\/(?:races|circuits|drivers|constructors|driverstandings|constructorstandings)\/\?limit=100$/;
const resultRoute =
  /^\/ergast\/f1\/[1-9][0-9]{3}\/[1-9][0-9]{0,2}\/results\/\?limit=100$/;

/** @param {string} target @returns {string | null} */
export function approvedTarget(target) {
  if (
    target === '/test/' ||
    seasonRoute.test(target) ||
    resultRoute.test(target)
  )
    return target;
  return null;
}

export const userAgent =
  'GridView/1.0 (+https://github.com/SergioArenas98/GridView_App)';
export const maxResponseBytes = 8 * 1024 * 1024;

/** No incoming header, host or origin can enter these options.
 * IPv4 is mandatory; localAddress optionally binds the assigned VPS address.
 * An independent socket avoids pooled-request retry or unbounded agent queues.
 * @param {string} path @param {string | undefined} [localAddress]
 * @returns {import('node:https').RequestOptions}
 */
export function upstreamOptions(path, localAddress) {
  return {
    protocol: 'https:',
    hostname: 'api.jolpi.ca',
    servername: 'api.jolpi.ca',
    port: 443,
    method: 'GET',
    path,
    family: 4,
    localAddress,
    rejectUnauthorized: true,
    agent: false,
    maxHeaderSize: 16 * 1024,
    headers: {
      Accept: 'application/json',
      'User-Agent': userAgent,
      'Accept-Encoding': 'identity',
    },
  };
}

const excluded = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'proxy-connection',
  'set-cookie',
  'set-cookie2',
  'authorization',
  'x-gridview-proxy-error',
]);

/** Keep end-to-end diagnostics, status-related headers and encoded body lengths.
 * Node does not decompress the response, so encoding/length still describe it.
 * @param {import('node:http').IncomingHttpHeaders} headers
 * @returns {import('node:http').OutgoingHttpHeaders}
 */
export function responseHeaders(headers) {
  const hop = new Set(
    (headers.connection ?? '').split(',').map((s) => s.trim().toLowerCase()),
  );
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) => !excluded.has(name) && !hop.has(name),
    ),
  );
}
