import { readFileSync, statSync } from 'node:fs';
import { isIPv4 } from 'node:net';

/** @typedef {{token: string, port: number, timeoutMs: number, maxConcurrent: number, localAddress: string | undefined}} Config */

/** @param {string | undefined} value @param {number} fallback @param {number} min @param {number} max */
function integer(value, fallback, min, max) {
  if (value === undefined) return fallback;
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max)
    throw new Error();
  return parsed;
}

/** Read secrets once at startup. Never echo supplied values or file errors.
 * @param {NodeJS.ProcessEnv} env
 * @returns {Config}
 */
export function loadConfig(env) {
  try {
    let token = env.JOLPICA_PROXY_TOKEN;
    const file = env.JOLPICA_PROXY_TOKEN_FILE;
    if (file !== undefined) {
      const stat = statSync(file);
      if (token !== undefined || !stat.isFile() || stat.size > 130)
        throw new Error();
      token = readFileSync(file, 'utf8').replace(/\r?\n$/, '');
    }
    // A 32-random-byte base64url secret is 43 characters. Length cannot prove
    // entropy; deployment must generate it cryptographically, never as a phrase.
    if (!token || !/^[A-Za-z0-9_-]{43,128}$/.test(token)) throw new Error();
    const localAddress = env.JOLPICA_PROXY_LOCAL_IPV4;
    if (localAddress !== undefined && !isIPv4(localAddress)) throw new Error();
    return {
      token,
      port: integer(env.JOLPICA_PROXY_PORT, 8788, 1, 65535),
      timeoutMs: integer(env.JOLPICA_PROXY_TIMEOUT_MS, 8000, 100, 9000),
      maxConcurrent: integer(env.JOLPICA_PROXY_MAX_CONCURRENT, 4, 1, 16),
      localAddress,
    };
  } catch {
    throw new Error('Invalid proxy configuration.');
  }
}
