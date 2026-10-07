import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readBounded } from '../../scripts/season-batch/bounded-read.mjs';

const temporary = [];

function scratch() {
  const directory = mkdtempSync(join(tmpdir(), 'gridview-bounded-read-'));
  temporary.push(directory);
  return directory;
}

function fileOf(size, name = 'body.json') {
  const path = join(scratch(), name);
  writeFileSync(path, Buffer.alloc(size, 0x20));
  return path;
}

/**
 * The real `open`, with every `read` on the returned handle recorded: the
 * proof that nothing beyond the bound is ever requested or allocated.
 */
function recordingOpen() {
  const requested = [];
  return {
    requested,
    open: async (path, flags) => {
      const handle = await open(path, flags);
      const read = handle.read.bind(handle);
      handle.read = (buffer, offset, length, position) => {
        requested.push({ length, bufferBytes: buffer.byteLength });
        return read(buffer, offset, length, position);
      };
      return handle;
    },
  };
}

afterEach(() => {
  for (const directory of temporary.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('bounded read', () => {
  it('returns a file of exactly the limit, byte for byte', async () => {
    const path = join(scratch(), 'exact.json');
    writeFileSync(path, '{"a":1}');
    const read = await readBounded(path, 7);
    expect(read.ok).toBe(true);
    expect(new TextDecoder().decode(read.bytes)).toBe('{"a":1}');
  });

  it('returns an empty file as zero bytes', async () => {
    const read = await readBounded(fileOf(0), 10);
    expect(read).toEqual({ ok: true, bytes: new Uint8Array(0) });
  });

  it('refuses a file one byte over the limit', async () => {
    expect(await readBounded(fileOf(11), 10)).toEqual({
      ok: false,
      reason: 'oversized',
    });
  });

  it('never requests or allocates beyond limit + 1, however large the file', async () => {
    const recorder = recordingOpen();
    const read = await readBounded(fileOf(3 * 1024 * 1024), 1024, {
      open: recorder.open,
    });
    expect(read).toEqual({ ok: false, reason: 'oversized' });
    expect(recorder.requested.length).toBeGreaterThan(0);
    for (const request of recorder.requested) {
      expect(request.bufferBytes).toBe(1025);
      expect(request.length).toBeLessThanOrEqual(1025);
    }
    const total = recorder.requested.reduce(
      (sum, request) => sum + request.length,
      0,
    );
    expect(total).toBeLessThanOrEqual(1025);
  });

  it('refuses a directory without reading it', async () => {
    const directory = join(scratch(), 'folder.json');
    mkdirSync(directory);
    // POSIX opens a directory and the handle check refuses it; Windows
    // refuses the open itself. Either way nothing is read.
    const outcome = await readBounded(directory, 10).catch(() => 'rejected');
    expect(
      outcome === 'rejected' ||
        (outcome.ok === false && outcome.reason === 'not-a-file'),
    ).toBe(true);
  });

  it('rejects a path that cannot be opened', async () => {
    await expect(
      readBounded(join(scratch(), 'missing.json'), 10),
    ).rejects.toThrow();
  });

  it.each([-1, 1.5, Number.NaN])('rejects the limit %s', async (limit) => {
    await expect(readBounded(fileOf(1), limit)).rejects.toThrow(RangeError);
  });
});
