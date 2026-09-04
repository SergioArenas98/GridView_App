import { describe, expect, it } from 'vitest';

import {
  canonicalizeString,
  compareUtf8,
  encodeUtf8,
  utf8ByteLength,
} from '../../../src/publication/canonical/ordering';
import {
  nullableInstant,
  projectCanonical,
} from '../../../src/publication/canonical/schema';
import { serializeCanonical } from '../../../src/publication/canonical/serialize';
import {
  canonicalRevisionText,
  snapshotRevision,
} from '../../../src/publication/snapshot-revision';

/**
 * Corrects the P2 finding on PR #14 (review thread `PRRT_kwDOTb8J4M6faLlX`,
 * comment `3937033181`): `TextEncoder` replaces every unpaired UTF-16
 * surrogate with the same three bytes (U+FFFD), so hashing its raw output let
 * distinct payloads share a `snapshotRevision`. `canonicalizeString` rewrites
 * a value to be well-formed - and does so injectively - before anything
 * encodes or compares it.
 */
describe('canonical string safety: lone surrogates are injective, not lossy', () => {
  it('gives every lone surrogate code unit U+D800-U+DFFF a distinct canonical form', () => {
    const outputs = new Set<string>();
    for (let unit = 0xd800; unit <= 0xdfff; unit += 1) {
      outputs.add(canonicalizeString(String.fromCharCode(unit)));
    }
    // A Set collapses duplicates, so equal size to the input range is the
    // O(n) proof that no two of the 2048 lone surrogates collide.
    expect(outputs.size).toBe(0xdfff - 0xd800 + 1);
  });

  it('separates U+D800 from U+D801', () => {
    expect(canonicalizeString('\uD800')).not.toBe(canonicalizeString('\uD801'));
    expect(compareUtf8('\uD800', '\uD801')).not.toBe(0);
  });

  it('separates a lone high surrogate from a lone low surrogate', () => {
    expect(canonicalizeString('\uD800')).not.toBe(canonicalizeString('\uDC00'));
    expect(compareUtf8('\uD800', '\uDC00')).not.toBe(0);
  });

  it('separates a lone surrogate from the literal replacement character', () => {
    expect(canonicalizeString('\uD800')).not.toBe(canonicalizeString('\uFFFD'));
    expect(compareUtf8('\uD800', '\uFFFD')).not.toBe(0);
    // U+FFFD is not a surrogate, so it is left untouched.
    expect(canonicalizeString('\uFFFD')).toBe('\uFFFD');
  });

  it('separates a lone surrogate from text that merely looks like its escape', () => {
    const escapeLookalike = '\\uD800'; // the 6 literal characters \, u, D, 8, 0, 0
    expect(canonicalizeString('\uD800')).not.toBe(
      canonicalizeString(escapeLookalike),
    );
    expect(compareUtf8('\uD800', escapeLookalike)).not.toBe(0);
    // The lookalike's backslash is escaped; the real surrogate's is not.
    // The escape hex is lowercase, matching the digest's own hex rendering.
    expect(canonicalizeString('\uD800')).toBe('\\ud800');
    expect(canonicalizeString(escapeLookalike)).toBe('\\\\uD800');
  });

  it('escapes a lone surrogate at the start, middle and end of a string', () => {
    expect(canonicalizeString('\uD800ab')).toBe('\\ud800ab');
    expect(canonicalizeString('a\uD800b')).toBe('a\\ud800b');
    expect(canonicalizeString('ab\uD800')).toBe('ab\\ud800');
  });

  it('escapes adjacent lone surrogates independently', () => {
    expect(canonicalizeString('\uD800\uD801')).toBe('\\ud800\\ud801');
    // Two identical adjacent lone surrogates still round-trip distinctly
    // from one occurrence.
    expect(canonicalizeString('\uD800\uD800')).not.toBe(
      canonicalizeString('\uD800'),
    );
  });

  it('preserves a valid surrogate pair as its one scalar value', () => {
    const emoji = '\u{1F600}';
    expect(canonicalizeString(emoji)).toBe(emoji);
    expect([...encodeUtf8(canonicalizeString(emoji))]).toEqual([
      0xf0, 0x9f, 0x98, 0x80,
    ]);
  });

  it('escapes a lone surrogate next to an otherwise-valid pair without touching the pair', () => {
    const mixed = '\uD800\u{1F600}';
    expect(canonicalizeString(mixed)).toBe('\\ud800\u{1F600}');
    const trailing = '\u{1F600}\uD800';
    expect(canonicalizeString(trailing)).toBe('\u{1F600}\\ud800');
  });

  it('escapes a literal backslash so it can never be mistaken for the escape marker', () => {
    expect(canonicalizeString('\\')).toBe('\\\\');
    expect(canonicalizeString('a\\b')).toBe('a\\\\b');
  });

  it('leaves quotes and control characters untouched - only backslash and surrogates are rewritten', () => {
    expect(canonicalizeString('"quoted"')).toBe('"quoted"');
    expect(canonicalizeString('line\nbreak\ttab')).toBe('line\nbreak\ttab');
  });

  it('is a no-op on ordinary ASCII, BMP and supplementary text', () => {
    for (const value of ['grand-prix', 'é', '€', '\u{1F600}', '']) {
      expect(canonicalizeString(value)).toBe(value);
    }
  });

  it('comparator stays antisymmetric across a mixed surrogate-and-text set', () => {
    const values = [
      '\uD800',
      '\uD801',
      '\uDC00',
      '\uFFFD',
      '\\uD800',
      '\\',
      'a',
      '\u{1F600}',
      '',
    ];
    const sign = (value: number) => (value < 0 ? -1 : value > 0 ? 1 : 0);
    for (const left of values) {
      for (const right of values) {
        expect(sign(compareUtf8(left, right))).toBe(
          sign(-compareUtf8(right, left)),
        );
      }
    }
  });

  it('returns 0 only for identical strings, never for distinct lone surrogates', () => {
    const values = [
      '\uD800',
      '\uD801',
      '\uDC00',
      '\uDC01',
      '\uFFFD',
      '\\uD800',
    ];
    for (const left of values) {
      for (const right of values) {
        if (left === right) {
          expect(compareUtf8(left, right)).toBe(0);
        } else {
          expect(compareUtf8(left, right)).not.toBe(0);
        }
      }
    }
  });

  it('keeps object-key ordering deterministic when a key carries a lone surrogate', () => {
    const unordered = {
      kind: 'object' as const,
      entries: [
        { key: 'b\uD800', value: { kind: 'boolean' as const, value: true } },
        { key: 'a', value: { kind: 'boolean' as const, value: true } },
      ],
    };
    const object = serializeCanonical(unordered);

    const keyA = canonicalizeString('a');
    const keyB = canonicalizeString('b\uD800');
    const expected =
      `{k${utf8ByteLength(keyA)}:${keyA}t` +
      `k${utf8ByteLength(keyB)}:${keyB}t}`;

    // 'a' canonicalizes to itself and must still sort before 'b\uD800',
    // regardless of the input's own order.
    expect(object).toBe(expected);
    // Repeating the call is exactly as deterministic.
    expect(serializeCanonical(unordered)).toBe(object);
  });

  it('frames a string with the exact byte length of the canonicalized text, not the raw text', () => {
    const raw = '\uD800';
    const framed = serializeCanonical({ kind: 'string', value: raw });
    const canonicalText = canonicalizeString(raw);
    expect(framed).toBe(`s${utf8ByteLength(canonicalText)}:${canonicalText}`);
    // The raw lone surrogate is one UTF-16 unit but the escape is 6 ASCII
    // bytes - the frame must report the bytes actually present, not the
    // length TextEncoder would have silently produced from the raw input.
    expect(utf8ByteLength(canonicalText)).toBe(6);
    expect(utf8ByteLength(canonicalText)).not.toBe(utf8ByteLength(raw));
  });

  async function driverRevision(fullName: string): Promise<string> {
    return snapshotRevision({
      documentName: 'driver:driver-1',
      schemaVersion: 1,
      data: {
        driver: {
          id: 'driver-1',
          fullName,
          givenName: null,
          familyName: null,
          shortCode: null,
          permanentNumber: null,
          nationality: null,
          countryCode: null,
          dateOfBirth: null,
          placeOfBirth: null,
          biography: null,
          media: null,
        },
        seasonEntry: null,
        constructor: null,
        standing: null,
      },
    });
  }

  it('gives distinct snapshotRevisions to supported payloads differing only by their lone surrogate', async () => {
    const revisions = await Promise.all(
      ['\uD800', '\uD801', '\uDC00', '\uFFFD', '\\uD800', 'ok'].map(
        driverRevision,
      ),
    );
    expect(new Set(revisions).size).toBe(revisions.length);
  });

  it('still gives equal revisions to truly equal payloads', async () => {
    const first = await driverRevision('\uD800');
    const second = await driverRevision('\uD800');
    expect(first).toBe(second);
  });

  it('keeps two malformed-instant string fallbacks distinct when they differ only by a lone surrogate', () => {
    // Not a valid RFC 3339 date-time, so `projectCanonical` falls back to the
    // opaque `string` kind rather than the `instant` kind - that fallback
    // must go through the same injective framing as any other string.
    const first = serializeCanonical(
      projectCanonical(nullableInstant(), 'not-a-date\uD800'),
    );
    const second = serializeCanonical(
      projectCanonical(nullableInstant(), 'not-a-date\uD801'),
    );
    expect(first).not.toBe(second);
  });

  it('keeps two documentNames distinct when they differ only by a lone surrogate', async () => {
    const input = { schemaVersion: 1, data: { supportedSeasons: [] } };
    const first = canonicalRevisionText({
      ...input,
      documentName: 'season\uD800',
    });
    const second = canonicalRevisionText({
      ...input,
      documentName: 'season\uD801',
    });
    expect(first).not.toBe(second);
    expect(
      await snapshotRevision({ ...input, documentName: 'season\uD800' }),
    ).not.toBe(
      await snapshotRevision({ ...input, documentName: 'season\uD801' }),
    );
  });
});
