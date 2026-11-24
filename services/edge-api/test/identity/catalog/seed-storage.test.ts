import { describe, it, expect } from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import { SeedStore } from '../../../src/identity/catalog/storage';
import { sqliteHost } from './sqlite-support';
import type { IdentityStorage } from '../../../src/identity/schema';

describe('R0 atomic local persistence', () => {
  it('rolls back interrupted inserts, replays identical imports and refuses conflicts', async () => {
    const seed = await prepareSeed(loadCorpus()),
      h = sqliteHost();
    let fail = true;
    const storage: IdentityStorage = {
      ...h.storage,
      sql: {
        exec(q, ...args) {
          if (fail && q.startsWith('INSERT INTO identity_seed_bindings'))
            throw Error('synthetic crash');
          return h.storage.sql.exec(q, ...args);
        },
      },
    };
    const s = new SeedStore(storage, '33333333-3333-4333-8333-333333333333');
    await expect(s.import(seed)).rejects.toThrow('synthetic crash');
    expect(await s.read()).toBeNull();
    fail = false;
    expect(await s.import(seed)).toBe('imported');
    expect(await s.import(seed)).toBe('replayed');
    const restored = sqliteHost();
    const restoreStore = new SeedStore(
      restored.storage,
      '44444444-4444-4444-8444-444444444444',
    );
    expect(await restoreStore.import(await s.read())).toBe('imported');
    expect(await restoreStore.read()).toEqual(seed);
    restored.db.close();
    expect(
      await new SeedStore(
        storage,
        '33333333-3333-4333-8333-333333333333',
      ).read(),
    ).toEqual(seed);
    const other = structuredClone(seed);
    other.sources[0]!.baseCommit = 'a'.repeat(40);
    other.sources[0]!.exactCommit = null;
    await expect(s.import(other)).rejects.toThrow('seed-conflict');
    h.db.exec(
      'DELETE FROM identity_seed_bindings WHERE rowid=(SELECT rowid FROM identity_seed_bindings LIMIT 1)',
    );
    await expect(s.read()).rejects.toThrow('seed-index');
    h.db.close();
  });
});
