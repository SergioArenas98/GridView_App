import { describe, expect, it } from 'vitest';

import { CloudflareCacheApiPurgeAdapter } from '../../src/cache/purge';

describe('CloudflareCacheApiPurgeAdapter', () => {
  it('deletes exact public GET URLs through the Worker Cache API', async () => {
    const deleted: string[] = [];
    const adapter = new CloudflareCacheApiPurgeAdapter(
      () =>
        ({
          delete: async (request: RequestInfo | URL) => {
            deleted.push(new Request(request).url);
            return true;
          },
        }) as unknown as Cache,
    );

    const result = await adapter.purgePublicUrls([
      'https://gridview-api-staging.example.workers.dev/v1/home?season=2026',
      'https://gridview-api-staging.example.workers.dev/v1/content/manifest',
    ]);

    expect(result.ok).toBe(true);
    expect(result.failureCategory).toBeNull();
    expect(deleted).toEqual(result.urls);
  });

  it('reports Cache API deletion failures without changing the URL set', async () => {
    const adapter = new CloudflareCacheApiPurgeAdapter(
      () =>
        ({
          delete: async () => {
            throw new Error('forced cache failure');
          },
        }) as unknown as Cache,
    );

    const result = await adapter.purgePublicUrls([
      'https://gridview-api-staging.example.workers.dev/v1/home?season=2026',
    ]);

    expect(result.ok).toBe(false);
    expect(result.failureCategory).toBe('cache-api-delete-failed');
    expect(result.urls).toEqual([
      'https://gridview-api-staging.example.workers.dev/v1/home?season=2026',
    ]);
  });
});
