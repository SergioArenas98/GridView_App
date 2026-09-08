/**
 * The per-version publication-metadata sidecar: its key, its four-valued
 * classification, its immutability, its removal with the version, and its
 * absence from every public surface (ADR 0025 D3, D8).
 *
 * The three failure values are load-bearing and are asserted as **distinct**.
 * *Absent* alone never proves a version predates the record - eligibility for
 * the legacy fallback is a property of the version identifier's namespace, and
 * the storage read only ever says whether the key is currently readable as a
 * valid value.
 */

import { describe, expect, it } from 'vitest';

import {
  publicationMetadataSchemaVersion,
  readStoredPublicationMetadata,
  validatedPublicationMetadata,
  writePublicationMetadataOnce,
} from '../../src/publication/publication-metadata';
import { versionNamespace } from '../../src/publication/sequencer';
import { invalidationUrlsForDocuments } from '../../src/cache/purge';
import { MemorySnapshotStorage } from '../../src/storage/local';
import { KvSnapshotStorage } from '../../src/storage/kv';
import {
  publicationMetadataKey,
  snapshotPrefix,
  versionInventoryKey,
} from '../../src/storage/keys';
import type {
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
} from '../../src/storage/types';

const SEASON = 2026;
const LEGACY_VERSION = '20260901T000000000-aaaaaaaa';
const SIDECAR_VERSION = 'pm1-0000000000001-00000001';
const ORDERING_INPUT = '2026-09-01T00:00:00.000Z';

/** A minimal in-memory Workers KV namespace, enough for the KV adapter. */
function kvNamespace() {
  const values = new Map<string, string>();
  let readFailure: ((key: string) => boolean) | null = null;
  return {
    values,
    failReads(predicate: ((key: string) => boolean) | null) {
      readFailure = predicate;
    },
    namespace: {
      async get(key: string) {
        if (readFailure?.(key)) throw new Error('injected KV read failure');
        return values.get(key) ?? null;
      },
      async put(key: string, value: string) {
        values.set(key, value);
      },
      async delete(key: string) {
        values.delete(key);
      },
      async list({
        prefix = '',
        cursor,
      }: {
        prefix?: string;
        cursor?: string;
      }) {
        void cursor;
        return {
          keys: [...values.keys()]
            .filter((key) => key.startsWith(prefix))
            .map((name) => ({ name })),
          list_complete: true as const,
          cacheStatus: null,
        };
      },
    } as unknown as KVNamespace,
  };
}

describe('the sidecar key', () => {
  it('sits under the version’s own prefix, beside the inventory', () => {
    const key = publicationMetadataKey(SEASON, LEGACY_VERSION);
    expect(key).toBe(
      `snapshot:${SEASON}:${LEGACY_VERSION}:__publication_metadata`,
    );
    expect(key.startsWith(snapshotPrefix(SEASON, LEGACY_VERSION))).toBe(true);
    expect(key).not.toBe(versionInventoryKey(SEASON, LEGACY_VERSION));
  });

  it('never maps to a public route or a cache-invalidation URL', () => {
    // Its suffix is not a `SnapshotDocumentName`, so it cannot even be named
    // here except by an explicit cast - and it expands to no URL.
    expect(
      invalidationUrlsForDocuments(
        'https://api.gridview.local',
        SEASON,
        ['__publication_metadata' as SnapshotDocumentName],
        'season-is-current',
      ),
    ).toEqual([]);
  });
});

describe('classification', () => {
  it('accepts a record of the declared shape', () => {
    expect(
      validatedPublicationMetadata({
        schemaVersion: 1,
        sourceOrderingInput: ORDERING_INPUT,
      }),
    ).toEqual({
      kind: 'record',
      record: { schemaVersion: 1, sourceOrderingInput: ORDERING_INPUT },
    });
    expect(publicationMetadataSchemaVersion).toBe(1);
  });

  it('reports an absent key as absent, never as legacy status', () => {
    expect(validatedPublicationMetadata(null)).toEqual({ kind: 'absent' });
    expect(validatedPublicationMetadata(undefined)).toEqual({ kind: 'absent' });
    // Deciding what absence *means* is the version identifier's job.
    expect(versionNamespace(SIDECAR_VERSION)).toBe('sidecar-required');
    expect(versionNamespace(LEGACY_VERSION)).toBe('legacy-format');
  });

  it('reports anything that is not a record of the declared shape as malformed', () => {
    for (const value of [
      42,
      'a string',
      [],
      [{ schemaVersion: 1, sourceOrderingInput: ORDERING_INPUT }],
      {},
      { schemaVersion: 2, sourceOrderingInput: ORDERING_INPUT },
      { schemaVersion: 1 },
      { schemaVersion: 1, sourceOrderingInput: 42 },
      { schemaVersion: 1, sourceOrderingInput: 'yesterday' },
      { schemaVersion: 1, sourceOrderingInput: '' },
    ]) {
      expect(validatedPublicationMetadata(value)).toEqual({
        kind: 'malformed',
      });
    }
  });

  it('reports a failed read as unreadable, never as absent', () => {
    const kv = kvNamespace();
    const storage = new KvSnapshotStorage(kv.namespace);
    kv.failReads((key) => key.endsWith('__publication_metadata'));
    return expect(
      readStoredPublicationMetadata(storage, SEASON, SIDECAR_VERSION),
    ).resolves.toEqual({ kind: 'unreadable' });
  });

  it('never lets a raw error, key or value escape a failed read', async () => {
    const throwing = {
      async readPublicationMetadata() {
        throw new Error('gridview://secret-key exploded');
      },
    } as unknown as SnapshotStorage;
    const result = await readStoredPublicationMetadata(
      throwing,
      SEASON,
      SIDECAR_VERSION,
    );
    expect(result).toEqual({ kind: 'unreadable' });
    expect(JSON.stringify(result)).not.toContain('secret-key');
  });
});

describe('adapter consistency', () => {
  const adapters: [string, () => SnapshotStorage][] = [
    ['memory', () => new MemorySnapshotStorage()],
    ['workers kv', () => new KvSnapshotStorage(kvNamespace().namespace)],
  ];

  for (const [name, make] of adapters) {
    describe(name, () => {
      it('reads back exactly what was written', async () => {
        const storage = make();
        await storage.writePublicationMetadata(SEASON, SIDECAR_VERSION, {
          schemaVersion: 1,
          sourceOrderingInput: ORDERING_INPUT,
        });
        expect(
          await readStoredPublicationMetadata(storage, SEASON, SIDECAR_VERSION),
        ).toEqual({
          kind: 'record',
          record: { schemaVersion: 1, sourceOrderingInput: ORDERING_INPUT },
        });
      });

      it('reports an unwritten key as absent', async () => {
        expect(
          await readStoredPublicationMetadata(make(), SEASON, SIDECAR_VERSION),
        ).toEqual({ kind: 'absent' });
      });

      it('classifies a malformed stored value identically', async () => {
        const storage = make();
        await storage.writePublicationMetadata(SEASON, SIDECAR_VERSION, {
          schemaVersion: 9,
        } as never);
        expect(
          await readStoredPublicationMetadata(storage, SEASON, SIDECAR_VERSION),
        ).toEqual({ kind: 'malformed' });
      });

      it('deletes the record explicitly', async () => {
        const storage = make();
        await storage.writePublicationMetadata(SEASON, SIDECAR_VERSION, {
          schemaVersion: 1,
          sourceOrderingInput: ORDERING_INPUT,
        });
        await storage.deletePublicationMetadata(SEASON, SIDECAR_VERSION);
        expect(
          await readStoredPublicationMetadata(storage, SEASON, SIDECAR_VERSION),
        ).toEqual({ kind: 'absent' });
      });

      it('removes the record with the version during cleanup', async () => {
        const storage = make();
        const document: StoredSnapshot = {
          data: {},
          meta: {
            schemaVersion: 1,
            apiVersion: 1,
            contentVersion: 'test',
            generatedAt: ORDERING_INPUT,
            sourceUpdatedAt: ORDERING_INPUT,
            staleAfter: ORDERING_INPUT,
            stale: false,
          } as unknown as StoredSnapshot['meta'],
          documentName: 'calendar',
          resourceIdentity: 'calendar',
        };
        await storage.writeVersionedDocument(SEASON, SIDECAR_VERSION, document);
        await storage.writeVersionInventory(SEASON, SIDECAR_VERSION, [
          'calendar',
        ]);
        await storage.writePublicationMetadata(SEASON, SIDECAR_VERSION, {
          schemaVersion: 1,
          sourceOrderingInput: ORDERING_INPUT,
        });
        await storage.deleteUnpublishedVersion(SEASON, SIDECAR_VERSION);
        // The whole version goes together: a sidecar that outlived its
        // documents would describe a version that no longer exists.
        expect(
          await readStoredPublicationMetadata(storage, SEASON, SIDECAR_VERSION),
        ).toEqual({ kind: 'absent' });
        expect(
          await storage.readVersionInventory(SEASON, SIDECAR_VERSION),
        ).toBeNull();
      });

      it('keeps the record out of the version inventory', async () => {
        const storage = make();
        await storage.writeVersionInventory(SEASON, SIDECAR_VERSION, [
          'calendar',
        ]);
        await storage.writePublicationMetadata(SEASON, SIDECAR_VERSION, {
          schemaVersion: 1,
          sourceOrderingInput: ORDERING_INPUT,
        });
        // The inventory keeps its existing array shape, with public document
        // names only.
        expect(
          await storage.readVersionInventory(SEASON, SIDECAR_VERSION),
        ).toEqual(['calendar']);
      });
    });
  }
});

describe('immutability', () => {
  it('writes once', async () => {
    const storage = new MemorySnapshotStorage();
    expect(
      await writePublicationMetadataOnce(
        storage,
        SEASON,
        SIDECAR_VERSION,
        ORDERING_INPUT,
      ),
    ).toEqual({ outcome: 'written' });
  });

  it('accepts a byte-equivalent rewrite as an idempotent no-op', async () => {
    // A restart after the sidecar write but before `finalize` must be able to
    // retry safely.
    const storage = new MemorySnapshotStorage();
    await writePublicationMetadataOnce(
      storage,
      SEASON,
      SIDECAR_VERSION,
      ORDERING_INPUT,
    );
    const writesBefore = storage.writeLog.length;
    expect(
      await writePublicationMetadataOnce(
        storage,
        SEASON,
        SIDECAR_VERSION,
        ORDERING_INPUT,
      ),
    ).toEqual({ outcome: 'unchanged' });
    expect(storage.writeLog.length).toBe(writesBefore);
  });

  it('refuses different content under the same version identifier', async () => {
    const storage = new MemorySnapshotStorage();
    await writePublicationMetadataOnce(
      storage,
      SEASON,
      SIDECAR_VERSION,
      ORDERING_INPUT,
    );
    expect(
      await writePublicationMetadataOnce(
        storage,
        SEASON,
        SIDECAR_VERSION,
        '2026-09-02T00:00:00.000Z',
      ),
    ).toEqual({ outcome: 'refused', reason: 'conflicting-record' });
    // Never silently overwritten.
    expect(
      await readStoredPublicationMetadata(storage, SEASON, SIDECAR_VERSION),
    ).toMatchObject({
      record: { sourceOrderingInput: ORDERING_INPUT },
    });
  });

  it('refuses to write over a malformed or unreadable existing record', async () => {
    const malformed = new MemorySnapshotStorage();
    await malformed.writePublicationMetadata(SEASON, SIDECAR_VERSION, {
      schemaVersion: 9,
    } as never);
    expect(
      await writePublicationMetadataOnce(
        malformed,
        SEASON,
        SIDECAR_VERSION,
        ORDERING_INPUT,
      ),
    ).toEqual({ outcome: 'refused', reason: 'existing-record-malformed' });

    const kv = kvNamespace();
    const unreadable = new KvSnapshotStorage(kv.namespace);
    kv.failReads(() => true);
    expect(
      await writePublicationMetadataOnce(
        unreadable,
        SEASON,
        SIDECAR_VERSION,
        ORDERING_INPUT,
      ),
    ).toEqual({ outcome: 'refused', reason: 'existing-record-unreadable' });
  });

  it('refuses an ordering input that cannot be ordered', async () => {
    expect(
      await writePublicationMetadataOnce(
        new MemorySnapshotStorage(),
        SEASON,
        SIDECAR_VERSION,
        'yesterday',
      ),
    ).toEqual({ outcome: 'refused', reason: 'invalid-source-ordering-input' });
  });
});
