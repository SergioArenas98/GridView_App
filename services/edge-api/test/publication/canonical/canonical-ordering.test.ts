import { describe, expect, it } from 'vitest';

import {
  compareUtf8,
  encodeUtf8,
  utf8ByteLength,
} from '../../../src/publication/canonical/ordering';

/**
 * The documented ordering for `snapshotRevision` is **lexicographic UTF-8
 * code-point order** (ADR 0020 D1.7, "Key ordering").
 *
 * JavaScript's default string comparison is *not* that order: `<` and
 * `Array.prototype.sort` compare UTF-16 code units, and a supplementary code
 * point is stored as a surrogate pair whose leading unit (U+D800-U+DBFF) sorts
 * *below* ordinary BMP characters above U+DFFF. Comparing the encoded bytes is
 * the documented rule itself rather than an approximation of it, and it also
 * sidesteps lone surrogates, which encode to U+FFFD.
 */
describe('canonical key ordering', () => {
  it('measures length in UTF-8 bytes, not UTF-16 units', () => {
    expect(utf8ByteLength('')).toBe(0);
    expect(utf8ByteLength('id')).toBe(2);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('€')).toBe(3);
    expect(utf8ByteLength('\u{1F600}')).toBe(4);
    expect('\u{1F600}'.length).toBe(2);
  });

  it('encodes deterministically', () => {
    expect([...encodeUtf8('é')]).toEqual([0xc3, 0xa9]);
    expect([...encodeUtf8('\u{1F600}')]).toEqual([0xf0, 0x9f, 0x98, 0x80]);
    expect([...encodeUtf8('a')]).toEqual([0x61]);
    // Same input, same bytes, every time and in any order of evaluation.
    expect([...encodeUtf8('grand-prix')]).toEqual([
      ...encodeUtf8('grand-prix'),
    ]);
  });

  it('orders ASCII the way a byte comparison does', () => {
    expect(compareUtf8('a', 'b')).toBeLessThan(0);
    expect(compareUtf8('b', 'a')).toBeGreaterThan(0);
    expect(compareUtf8('a', 'a')).toBe(0);
    expect(compareUtf8('Z', 'a')).toBeLessThan(0);
    expect(compareUtf8('id', 'identity')).toBeLessThan(0);
  });

  it('orders supplementary code points above every BMP code point', () => {
    // U+FFFD < U+1F600 by code point. UTF-16 unit order says the opposite,
    // because the emoji begins with the surrogate U+D83D.
    expect('\u{1F600}' < '�').toBe(true);
    expect(compareUtf8('\u{1F600}', '�')).toBeGreaterThan(0);
    expect(compareUtf8('�', '\u{1F600}')).toBeLessThan(0);
  });

  it('orders non-ASCII BMP code points by code point', () => {
    expect(compareUtf8('a', 'é')).toBeLessThan(0);
    expect(compareUtf8('é', '€')).toBeLessThan(0);
    expect(compareUtf8('€', '�')).toBeLessThan(0);
  });

  it('sorts a mixed set into code-point order, unlike the default sort', () => {
    const keys = ['\u{1F600}', '�', 'é', 'a', 'Z', '€'];
    const canonical = [...keys].sort(compareUtf8);
    expect(canonical).toEqual(['Z', 'a', 'é', '€', '�', '\u{1F600}']);
    expect([...keys].sort()).not.toEqual(canonical);
  });

  it('treats a prefix as smaller than the string that extends it', () => {
    expect(compareUtf8('season', 'seasonEntry')).toBeLessThan(0);
    expect(compareUtf8('', 'a')).toBeLessThan(0);
  });

  it('is a total order: antisymmetric, and transitive across the set', () => {
    // `Math.sign(0)` is `+0` and its negation is `-0`, which `toBe` tells
    // apart. The comparator's contract is the sign, not the bit pattern.
    const sign = (value: number) => (value < 0 ? -1 : value > 0 ? 1 : 0);
    const keys = ['\u{1F600}', '�', 'é', 'a', 'Z', '€', 'season', ''];
    for (const left of keys) {
      for (const right of keys) {
        expect(sign(compareUtf8(left, right))).toBe(
          sign(-compareUtf8(right, left)),
        );
      }
    }
    const sorted = [...keys].sort(compareUtf8);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1] as string;
      const current = sorted[index] as string;
      expect(compareUtf8(previous, current)).toBeLessThan(0);
    }
  });
});
