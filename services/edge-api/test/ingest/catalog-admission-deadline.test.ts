/**
 * Batch admission reads the same pinned catalog a coordinated run pins, so it
 * shares the pin deadline (ADR 0031 and its 2026-11-23 amendment): each of
 * the two identical attempts may take up to ten seconds, response body
 * included, before the call fails.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { batchCatalogCall } from '../../src/ingest/catalog-admission';

const installationId = 'c45d60b8-a723-4b6e-8530-750592af2b94';

afterEach(() => {
  vi.useRealTimers();
});

describe('batch catalog admission deadline', () => {
  it('bounds two uncertain attempts at exactly ten seconds each', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(() => new Promise<Response>(() => {}));
    const config = {
      mode: 'runtime' as const,
      installationId,
      namespace: { idFromName: (s: string) => s, get: () => ({ fetch }) },
    };
    const pending = batchCatalogCall(config as never, '/batch-admit', {
      probe: true,
    });
    const assertion = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(9999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(9999);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
