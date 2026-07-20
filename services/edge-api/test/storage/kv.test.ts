import { describe, expect, it } from 'vitest';

import { KvSnapshotStorage } from '../../src/storage/kv';
import type { StoredSnapshot } from '../../src/storage/types';

describe('KvSnapshotStorage', () => {
  it('reads, writes, lists and safely deletes versioned documents with a fake binding', async () => {
    const binding = fakeKv();
    const storage = new KvSnapshotStorage(binding as unknown as KVNamespace);
    const snapshot: StoredSnapshot = {
      documentName: 'calendar',
      resourceIdentity: 'v1:2026:calendar',
      data: [],
      meta: {
        apiVersion: '1',
        schemaVersion: 1,
        season: 2026,
        generatedAt: '2026-07-20T12:00:00.000Z',
        sourceUpdatedAt: '2026-07-18T11:55:00.000Z',
        staleAfter: '2026-07-20T12:15:00.000Z',
        contentVersion: '2026.07.18.1',
      },
    };

    await storage.writeVersionedDocument(2026, 'v1', snapshot);
    await storage.setActiveVersion(2026, 'v1');
    await storage.writeVersionedDocument(2026, 'failed', snapshot);
    await storage.deleteUnpublishedVersion(2026, 'failed');

    expect(await storage.readVersionedDocument(2026, 'v1', 'calendar')).toEqual(
      snapshot,
    );
    expect(
      await storage.readVersionedDocument(2026, 'failed', 'calendar'),
    ).toBeNull();
    expect(await storage.listVersions(2026)).toEqual(['v1']);
  });
});

function fakeKv() {
  const values = new Map<string, string>();
  return {
    async get(key: string) {
      return values.get(key) ?? null;
    },
    async put(key: string, value: string) {
      values.set(key, value);
    },
    async delete(key: string) {
      values.delete(key);
    },
    async list(options: { prefix?: string; cursor?: string }) {
      const prefix = options.prefix ?? '';
      return {
        keys: [...values.keys()]
          .filter((key) => key.startsWith(prefix))
          .sort()
          .map((name) => ({ name })),
        list_complete: true,
        cursor: undefined,
      };
    },
  };
}
