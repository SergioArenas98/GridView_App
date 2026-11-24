import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertLosslessText,
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
      restoreRefusal({
        snapshot,
        target: drill,
        confirm: drill,
        protectedIds,
        targetTitle: 'gridview-recovery-drill-data',
      }),
    ).toBeNull();
    expect(
      restoreRefusal({
        snapshot,
        target: drill,
        confirm: undefined,
        protectedIds,
        targetTitle: 'gridview-recovery-drill-data',
      }),
    ).toBe('target-not-confirmed');
    expect(
      restoreRefusal({
        snapshot,
        target: snapshot.namespaceId,
        confirm: snapshot.namespaceId,
        protectedIds,
        targetTitle: 'gridview-recovery-drill-data',
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
      restoreRefusal({
        snapshot,
        target: 'x',
        confirm: 'x',
        protectedIds,
        targetTitle: 'gridview-recovery-drill-data',
      }),
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

  it('parses every namespace id line in wrangler.toml', () => {
    const all = toml.match(/^\s*(?:preview_)?id\s*=\s*"[0-9a-f]{32}"/gm) ?? [];
    expect(protectedNamespaces(toml)).toHaveLength(all.length);
  });

  it('refuses an uncommitted target that is not titled as a drill namespace', () => {
    const args = {
      snapshot: { namespaceId: '1d0fb55486a745a1ad12e03d9f04942b' },
      target: 'a1dfe9f1d35549829c160743bfecbabf',
      confirm: 'a1dfe9f1d35549829c160743bfecbabf',
      protectedIds: protectedNamespaces(toml),
    };
    expect(restoreRefusal({ ...args, targetTitle: 'production-data' })).toBe(
      'target-not-a-drill-namespace',
    );
    expect(restoreRefusal({ ...args, targetTitle: undefined })).toBe(
      'target-not-a-drill-namespace',
    );
    expect(
      restoreRefusal({ ...args, targetTitle: 'gridview-recovery-drill-data' }),
    ).toBeNull();
  });

  it('refuses values that lost bytes in text decoding', () => {
    expect(assertLosslessText('{"a":1}')).toBe('{"a":1}');
    expect(() => assertLosslessText('bad \uFFFD byte')).toThrow(/lossless/);
  });
});
