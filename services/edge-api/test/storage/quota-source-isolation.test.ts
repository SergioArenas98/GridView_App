import { describe, expect, it } from 'vitest';

import { emptyQuotaState } from '../../src/providers/quota-model';
import {
  providerSourceIds,
  type ProviderSourceId,
} from '../../src/providers/provider-source';
import { legacyGlobalQuotaKey, quotaKey } from '../../src/storage/keys';
import { QuotaSourceMismatchError } from '../../src/storage/quota-records';
import { KvSnapshotStorage } from '../../src/storage/kv';
import { MemorySnapshotStorage } from '../../src/storage/local';
import type { QuotaState, SnapshotStorage } from '../../src/storage/types';

const at = new Date('2026-07-20T12:00:00.000Z');

/** The pre-Phase-9B-1 global record, exactly as it used to be written. */
const legacyRecord = {
  dailyLimit: 1000,
  dailyRemaining: 100,
  perMinuteLimit: 60,
  perMinuteRemaining: 10,
  lastProviderSuccessAt: '2026-07-19T09:00:00.000Z',
  lastProviderFailureAt: '2026-07-19T10:00:00.000Z',
  retryAfter: '2026-07-19T10:05:00.000Z',
  usageByJobCategory: { standings: 3 },
  warningLevel: 'high',
};

function fakeKv() {
  const values = new Map<string, string>();
  return {
    values,
    async get(key: string) {
      return values.get(key) ?? null;
    },
    async put(key: string, value: string) {
      values.set(key, value);
    },
    async delete(key: string) {
      values.delete(key);
    },
    async list(options: { prefix?: string }) {
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

interface Backend {
  storage: SnapshotStorage;
  /**
   * Places a legacy global record directly. The source-aware API has no writer
   * for that key any more, which is the point.
   */
  seedLegacy: (record: unknown) => void;
  keys: () => string[];
}

function memoryBackend(): Backend {
  const storage = new MemorySnapshotStorage();
  const values = (storage as unknown as { values: Map<string, unknown> })
    .values;
  return {
    storage,
    seedLegacy: (record) => values.set(legacyGlobalQuotaKey, record),
    keys: () => [...values.keys()],
  };
}

function kvBackend(): Backend {
  const kv = fakeKv();
  return {
    storage: new KvSnapshotStorage(kv as unknown as KVNamespace),
    seedLegacy: (record) =>
      kv.values.set(legacyGlobalQuotaKey, JSON.stringify(record)),
    keys: () => [...kv.values.keys()],
  };
}

const implementations: [string, () => Backend][] = [
  ['MemorySnapshotStorage', memoryBackend],
  ['KvSnapshotStorage', kvBackend],
];

/**
 * Places a record under an arbitrary key, bypassing `setQuotaState` so the
 * read-side guard can be exercised against state the writer would never
 * produce.
 */
async function writeRaw(
  storage: SnapshotStorage,
  key: string,
  value: unknown,
): Promise<void> {
  if (storage instanceof MemorySnapshotStorage) {
    (storage as unknown as { values: Map<string, unknown> }).values.set(
      key,
      value,
    );
    return;
  }
  const kv = (
    storage as unknown as { kv: { put(k: string, v: string): Promise<void> } }
  ).kv;
  await kv.put(key, JSON.stringify(value));
}

function stateFor(
  sourceId: ProviderSourceId,
  warningLevel: QuotaState['warningLevel'],
): QuotaState {
  return { ...emptyQuotaState(sourceId, at), warningLevel };
}

describe.each(implementations)(
  'source-aware quota persistence (%s)',
  (_name, createBackend) => {
    it('keeps each source under its own key and never returns another source state', async () => {
      const { storage, keys } = createBackend();

      await storage.setQuotaState('mock', stateFor('mock', 'normal'));
      await storage.setQuotaState('jolpica', stateFor('jolpica', 'high'));
      await storage.setQuotaState('openf1', stateFor('openf1', 'critical'));

      const mock = await storage.getQuotaState('mock');
      const jolpica = await storage.getQuotaState('jolpica');
      const openf1 = await storage.getQuotaState('openf1');

      expect(mock?.sourceId).toBe('mock');
      expect(mock?.warningLevel).toBe('normal');
      expect(jolpica?.sourceId).toBe('jolpica');
      expect(jolpica?.warningLevel).toBe('high');
      expect(openf1?.sourceId).toBe('openf1');
      expect(openf1?.warningLevel).toBe('critical');

      for (const sourceId of providerSourceIds) {
        expect(keys()).toContain(quotaKey(sourceId));
      }
      // No new write ever lands on the global key.
      expect(keys()).not.toContain(legacyGlobalQuotaKey);
    });

    it('writes and reads back a record whose identity matches its key', async () => {
      const { storage } = createBackend();

      await storage.setQuotaState('jolpica', stateFor('jolpica', 'warning'));

      const stored = await storage.getQuotaState('jolpica');
      expect(stored?.sourceId).toBe('jolpica');
      expect(stored?.warningLevel).toBe('warning');
      expect(stored?.windows.map((window) => window.limit)).toEqual([4, 500]);
    });

    it('rejects a write whose state names a different source', async () => {
      const { storage } = createBackend();
      const original = stateFor('jolpica', 'warning');
      await storage.setQuotaState('jolpica', original);

      // Relabelling OpenF1's 3/s + 30/min windows as Jolpica state would make a
      // later rate limiter pace Jolpica against OpenF1's limits.
      await expect(
        storage.setQuotaState('jolpica', stateFor('openf1', 'critical')),
      ).rejects.toBeInstanceOf(QuotaSourceMismatchError);

      // The previous valid value is untouched, and nothing leaked to OpenF1.
      expect(await storage.getQuotaState('jolpica')).toEqual(original);
      expect(await storage.getQuotaState('openf1')).toBeNull();
    });

    it('rejects a mismatched write even when no record exists yet', async () => {
      const { storage, keys } = createBackend();

      await expect(
        storage.setQuotaState('openf1', stateFor('jolpica', 'normal')),
      ).rejects.toBeInstanceOf(QuotaSourceMismatchError);

      expect(await storage.getQuotaState('openf1')).toBeNull();
      expect(keys()).not.toContain(quotaKey('openf1'));
    });

    it('falls back to the legacy global record for the mock source only', async () => {
      const { storage, seedLegacy, keys } = createBackend();
      seedLegacy(legacyRecord);

      const mock = await storage.getQuotaState('mock');

      expect(mock).not.toBeNull();
      expect(mock?.sourceId).toBe('mock');
      expect(mock?.testOnly).toBe(true);
      // Operational fields survive, so staging/mock scheduler behaviour holds.
      expect(mock?.lastProviderSuccessAt).toBe('2026-07-19T09:00:00.000Z');
      expect(mock?.lastProviderFailureAt).toBe('2026-07-19T10:00:00.000Z');
      expect(mock?.retryAfter).toBe('2026-07-19T10:05:00.000Z');
      expect(mock?.usageByJobCategory).toEqual({ standings: 3 });
      // The legacy level was derived from the discarded windows, so it is not
      // carried forward - a migrated `high` or `critical` would block work
      // using inputs that no longer exist.
      expect(mock?.warningLevel).toBe('unknown');
      // The legacy daily/per-minute figures are discarded, never reinterpreted
      // as a window that a source publishes.
      expect(mock?.windows).toEqual([]);
      expect(JSON.stringify(mock)).not.toContain('dailyLimit');
      expect(JSON.stringify(mock)).not.toContain('1000');

      // Reading it neither deletes nor rewrites it.
      expect(keys()).toContain(legacyGlobalQuotaKey);
      expect(keys()).not.toContain(quotaKey('mock'));
    });

    it('never applies the legacy fallback to jolpica or openf1', async () => {
      const { storage, seedLegacy } = createBackend();
      seedLegacy(legacyRecord);

      expect(await storage.getQuotaState('jolpica')).toBeNull();
      expect(await storage.getQuotaState('openf1')).toBeNull();
    });

    it('prefers a source-specific record over the legacy one', async () => {
      const { storage, seedLegacy, keys } = createBackend();
      seedLegacy(legacyRecord);

      await storage.setQuotaState('mock', stateFor('mock', 'normal'));
      const mock = await storage.getQuotaState('mock');

      expect(mock?.warningLevel).toBe('normal');
      expect(mock?.windows.length).toBeGreaterThan(0);
      expect(keys()).toContain(quotaKey('mock'));
      expect(keys()).toContain(legacyGlobalQuotaKey);
    });

    it('ignores an unusable legacy record instead of inventing state', async () => {
      const { storage, seedLegacy } = createBackend();
      seedLegacy({ dailyLimit: 'not-a-number', warningLevel: 'nonsense' });

      const mock = await storage.getQuotaState('mock');

      expect(mock?.lastProviderSuccessAt).toBeNull();
      expect(mock?.retryAfter).toBeNull();
      expect(mock?.warningLevel).toBe('unknown');
      expect(mock?.usageByJobCategory).toEqual({});
    });

    it('rejects a stored record whose source id disagrees with its key', async () => {
      const { storage } = createBackend();
      await storage.setQuotaState('jolpica', stateFor('jolpica', 'high'));

      // Simulate a hand-edited or badly migrated record sitting under the
      // Jolpica key while claiming to be OpenF1 state.
      const corrupt = {
        ...stateFor('openf1', 'critical'),
        sourceId: 'openf1',
      };
      await writeRaw(storage, quotaKey('jolpica'), corrupt);

      // Returning it would hand OpenF1's modelled capacity back as Jolpica's.
      expect(await storage.getQuotaState('jolpica')).toBeNull();
      expect(await storage.getQuotaState('openf1')).toBeNull();
    });

    it('returns null for a source with no record and no legacy fallback', async () => {
      const { storage } = createBackend();

      for (const sourceId of providerSourceIds) {
        expect(await storage.getQuotaState(sourceId)).toBeNull();
      }
    });
  },
);

describe('memory and KV storage parity', () => {
  it('returns the same quota state from both implementations', async () => {
    const memory = memoryBackend();
    const kv = kvBackend();
    const state = stateFor('jolpica', 'warning');

    await memory.storage.setQuotaState('jolpica', state);
    await kv.storage.setQuotaState('jolpica', state);

    expect(await memory.storage.getQuotaState('jolpica')).toEqual(
      await kv.storage.getQuotaState('jolpica'),
    );
    expect(await memory.storage.getQuotaState('openf1')).toEqual(
      await kv.storage.getQuotaState('openf1'),
    );
  });

  it('adapts the legacy record identically in both implementations', async () => {
    const memory = memoryBackend();
    const kv = kvBackend();
    memory.seedLegacy(legacyRecord);
    kv.seedLegacy(legacyRecord);

    expect(await memory.storage.getQuotaState('mock')).toEqual(
      await kv.storage.getQuotaState('mock'),
    );
    expect(await memory.storage.getQuotaState('jolpica')).toEqual(
      await kv.storage.getQuotaState('jolpica'),
    );
  });
});
