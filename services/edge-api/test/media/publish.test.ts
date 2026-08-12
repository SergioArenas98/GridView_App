import { describe, expect, it } from 'vitest';

import { isHttpsUrl, publishMedia } from '../../scripts/media/publish.ts';
import {
  FakeObjectStore,
  missingMaster,
  presentMaster,
  register,
  rightsRecord,
  syntheticMaster,
  testUse,
} from './support.ts';

const BASE_URL = 'https://media.gridview.invalid';

async function master(): Promise<Buffer> {
  return syntheticMaster(1600, 900);
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    register: register(rightsRecord()),
    use: testUse,
    target: 'staging' as const,
    publicBaseUrl: BASE_URL,
    readMaster: master,
    probeMaster: presentMaster,
    ...overrides,
  };
}

describe('media publication', () => {
  it('dry-runs without credentials, a bucket or a network', async () => {
    const result = await publishMedia(request());
    expect(result.outcome).toBe('dry-run');
    expect(result.uploaded).toBe(false);
    expect(result.assets).toHaveLength(1);
    expect(result.objects.length).toBeGreaterThan(0);
  });

  it('produces an empty, successful dry-run for an empty inventory', async () => {
    // The current real state. Nothing to publish is not an error.
    const result = await publishMedia(request({ register: register() }));
    expect(result.outcome).toBe('dry-run');
    expect(result.assets).toEqual([]);
    expect(result.objects).toEqual([]);
  });

  it('generates manifest fragments that match the public contract', async () => {
    const result = await publishMedia(request());
    const asset = result.assets[0]!;
    expect(asset.id).toBe('test-shape-portrait-v1');
    expect(asset.entityType).toBe('driver');
    expect(asset.entityId).toBe('test-shape');
    expect(asset.category).toBe('portrait');
    expect(asset.format).toBe('webp');
    expect(asset.version).toBe('v1');
    // The credit comes from the rights record, never invented.
    expect(asset.attribution).toBe('GridView synthetic fixture');
    expect(asset.license).toBe('GridView-owned synthetic fixture');
    for (const variant of Object.values(asset.variants)) {
      expect(variant!.url.startsWith(`${BASE_URL}/media/drivers/`)).toBe(true);
      expect(variant!.width).toBeGreaterThan(0);
      expect(variant!.height).toBeGreaterThan(0);
    }
  });

  it('validates every generated URL against the same HTTPS rule the app applies', async () => {
    const result = await publishMedia(request());
    for (const variant of Object.values(result.assets[0]!.variants)) {
      expect(isHttpsUrl(variant!.url)).toBe(true);
    }
  });

  it('refuses to generate a manifest against a non-HTTPS base URL', async () => {
    const result = await publishMedia(
      request({ publicBaseUrl: 'http://media.gridview.invalid' }),
    );
    expect(result.outcome).toBe('blocked');
    expect(result.assets).toEqual([]);
  });

  it('blocks the whole publication when a single asset is unapproved', async () => {
    // Not "skip the bad one". A partial publication against an inventory an
    // operator believed was approved is worse than none.
    const result = await publishMedia(
      request({
        register: register(
          rightsRecord({ assetId: 'shape-a-portrait-v1' }),
          rightsRecord({
            assetId: 'shape-b-portrait-v1',
            approvalStatus: 'pending',
          }),
        ),
      }),
    );
    expect(result.outcome).toBe('refused');
    expect(result.assets).toEqual([]);
    expect(result.objects).toEqual([]);
    expect(result.refusals.map((r) => r.code)).toContain('not-approved');
  });

  it('validates rights before reading any master', async () => {
    let reads = 0;
    const result = await publishMedia(
      request({
        register: register(rightsRecord({ approvalStatus: 'rejected' })),
        readMaster: async () => {
          reads += 1;
          return master();
        },
      }),
    );
    expect(result.outcome).toBe('refused');
    expect(reads).toBe(0);
  });

  it('refuses when the source master is missing', async () => {
    const result = await publishMedia(request({ probeMaster: missingMaster }));
    expect(result.outcome).toBe('refused');
    expect(result.refusals.map((r) => r.code)).toContain(
      'source-master-missing',
    );
  });

  it('uploads to staging only when explicitly asked', async () => {
    const store = new FakeObjectStore();
    const result = await publishMedia(
      request({ upload: true, store, target: 'staging' }),
    );
    expect(result.outcome).toBe('uploaded');
    expect(result.uploaded).toBe(true);
    expect(store.puts.length).toBe(result.objects.length);
  });

  it('refuses production by default even with upload requested', async () => {
    const store = new FakeObjectStore();
    const result = await publishMedia(
      request({ upload: true, store, target: 'production' }),
    );
    expect(result.outcome).toBe('blocked');
    expect(result.uploaded).toBe(false);
    expect(store.puts).toEqual([]);
  });

  it('permits production only with explicit authorisation', async () => {
    const store = new FakeObjectStore();
    const result = await publishMedia(
      request({
        upload: true,
        store,
        target: 'production',
        productionAuthorised: true,
      }),
    );
    expect(result.outcome).toBe('uploaded');
  });

  it('writes nothing when no store is supplied', async () => {
    const result = await publishMedia(request({ upload: true }));
    expect(result.outcome).toBe('blocked');
    expect(result.uploaded).toBe(false);
  });

  it('refuses to overwrite an immutable key holding different content', async () => {
    const store = new FakeObjectStore();
    store.seedConflicting('media/drivers/test-shape/v1/thumbnail.webp');
    const result = await publishMedia(request({ upload: true, store }));
    expect(result.outcome).toBe('blocked');
    expect(result.reason).toContain('bump the asset version');
  });

  it('checks every key for conflicts before writing any of them', async () => {
    // A conflict discovered mid-upload would leave half a version published.
    const store = new FakeObjectStore();
    store.seedConflicting('media/drivers/test-shape/v1/hero.webp');
    const result = await publishMedia(request({ upload: true, store }));
    expect(result.outcome).toBe('blocked');
    expect(store.puts).toEqual([]);
  });

  it('is idempotent: re-publishing identical content writes nothing new', async () => {
    const store = new FakeObjectStore();
    await publishMedia(request({ upload: true, store }));
    const writes = store.puts.length;
    const again = await publishMedia(request({ upload: true, store }));
    expect(again.outcome).toBe('uploaded');
    expect(store.puts.length).toBe(writes);
  });

  it('bumping the version publishes alongside the old objects rather than over them', async () => {
    const store = new FakeObjectStore();
    await publishMedia(request({ upload: true, store }));
    const v2 = await publishMedia(
      request({
        upload: true,
        store,
        register: register(rightsRecord({ version: 'v2' })),
        readMaster: async () => syntheticMaster(1600, 901),
      }),
    );
    expect(v2.outcome).toBe('uploaded');
    expect(store.objects.has('media/drivers/test-shape/v1/hero.webp')).toBe(
      true,
    );
    expect(store.objects.has('media/drivers/test-shape/v2/hero.webp')).toBe(
      true,
    );
  });

  it('reports an object inventory with hashes, sorted and stable', async () => {
    const first = await publishMedia(request());
    const second = await publishMedia(request());
    expect(second.objects).toEqual(first.objects);
    expect(first.objects.map((o) => o.objectKey)).toEqual(
      [...first.objects.map((o) => o.objectKey)].sort(),
    );
    for (const object of first.objects) {
      expect(object.contentHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('public media URL policy', () => {
  it.each([
    'http://media.test',
    'ftp://media.test',
    'file:///tmp/x',
    'https://user:pass@media.test',
    'not a url',
    '',
  ])('rejects %s', (value) => {
    expect(isHttpsUrl(value)).toBe(false);
  });

  it('accepts a plain HTTPS host', () => {
    expect(isHttpsUrl('https://media.gridview.invalid')).toBe(true);
  });
});
