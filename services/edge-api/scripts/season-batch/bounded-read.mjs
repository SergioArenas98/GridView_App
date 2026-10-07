// A strictly bounded file read for the season-batch CLI.
//
// The file is opened once, and every decision is made on that open handle:
// whether it is a regular file, and how many bytes it holds. At most
// `limit + 1` bytes are ever read, into a buffer allocated for that bound
// before the first read. A larger file is detected by the extra byte and is
// never allocated in full, so a malformed or replaced capture cannot exhaust
// memory. There is no separate stat-then-read, so a file swapped between the
// two cannot bypass the limit either.

import { open } from 'node:fs/promises';

/**
 * @param {string} path
 * @param {number} limit the largest accepted size in bytes
 * @param {{ open?: typeof open }} [options] `open` is injectable for tests only
 * @returns {Promise<
 *   | { ok: true, bytes: Uint8Array }
 *   | { ok: false, reason: 'oversized' | 'not-a-file' }
 * >} the file's bytes, or a closed refusal; an unopenable path rejects
 */
export async function readBounded(path, limit, options = {}) {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new RangeError('A bounded read needs a non-negative integer limit.');
  }
  const handle = await (options.open ?? open)(path, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile()) return { ok: false, reason: 'not-a-file' };
    const buffer = new Uint8Array(limit + 1);
    let total = 0;
    while (total < buffer.byteLength) {
      const { bytesRead } = await handle.read(
        buffer,
        total,
        buffer.byteLength - total,
        total,
      );
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    if (total > limit) return { ok: false, reason: 'oversized' };
    return { ok: true, bytes: buffer.slice(0, total) };
  } finally {
    await handle.close();
  }
}
