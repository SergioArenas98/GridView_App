import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compareEntries,
  entryDigest,
  protectedNamespaces,
  restoreRefusal,
  snapshotDigest,
} from '../../scripts/recovery/kv-snapshot.mjs';

const toml = readFileSync(
  join(import.meta.dirname, '../../wrangler.toml'),
  'utf8',
);
const e = (key, value, metadata = null, expiration = null) => ({
  key,
  value,
  metadata,
  expiration,
});

describe('KV snapshot tool', () => {
  it('protects every namespace committed in wrangler.toml', () => {
    const ids = protectedNamespaces(toml);
    expect(ids).toEqual(
      expect.arrayContaining([
        '1d0fb55486a745a1ad12e03d9f04942b',
        'd76328b37da343db92d927142c072593',
        'f8970084eef14b6a8e24db521d015df3',
      ]),
    );
  });

  it('refuses committed, source, unconfirmed and malformed restore targets', () => {
    const snapshot = { namespaceId: '1d0fb55486a745a1ad12e03d9f04942b' };
    const protectedIds = protectedNamespaces(toml);
    const drill = 'a1dfe9f1d35549829c160743bfecbabf';
    expect(
      restoreRefusal({ snapshot, target: drill, confirm: drill, protectedIds }),
    ).toBeNull();
    expect(
      restoreRefusal({
        snapshot,
        target: drill,
        confirm: undefined,
        protectedIds,
      }),
    ).toBe('target-not-confirmed');
    expect(
      restoreRefusal({
        snapshot,
        target: snapshot.namespaceId,
        confirm: snapshot.namespaceId,
        protectedIds,
      }),
    ).toBe('target-is-snapshot-source');
    for (const id of protectedIds)
      expect(
        restoreRefusal({
          snapshot: { namespaceId: 'f'.repeat(32) },
          target: id,
          confirm: id,
          protectedIds,
        }),
      ).toBe('target-is-committed-namespace');
    expect(
      restoreRefusal({ snapshot, target: 'x', confirm: 'x', protectedIds }),
    ).toBe('invalid-target');
  });

  it('digests are order-independent and sensitive to value, metadata and expiration', () => {
    const a = [e('k1', 'v1'), e('k2', 'v2', { t: 1 })];
    expect(snapshotDigest(a)).toBe(snapshotDigest([...a].reverse()));
    expect(entryDigest(e('k', 'v'))).not.toBe(entryDigest(e('k', 'v2')));
    expect(entryDigest(e('k', 'v'))).not.toBe(
      entryDigest(e('k', 'v', { t: 1 })),
    );
    expect(entryDigest(e('k', 'v'))).not.toBe(
      entryDigest(e('k', 'v', null, 99)),
    );
  });

  it('reports missing, changed and extra keys', () => {
    const expected = [e('a', '1'), e('b', '2'), e('c', '3')];
    const actual = [e('a', '1'), e('b', 'X'), e('d', '4')];
    expect(compareEntries(expected, actual)).toEqual({
      missing: ['c'],
      changed: ['b'],
      extra: ['d'],
    });
    expect(compareEntries(expected, expected)).toEqual({
      missing: [],
      changed: [],
      extra: [],
    });
  });
});
